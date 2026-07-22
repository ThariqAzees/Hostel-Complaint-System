import { prisma } from "./db";
import { ComplaintStatus, ComplaintPriority } from "@/generated/prisma/enums";

export type TransitionAction =
  | "ACKNOWLEDGE"
  | "STUDENT_REOPEN"
  | "RC_VERIFY_CLOSE";

// Valid role checks for each action
const ACTION_ROLES: Record<TransitionAction, ("STUDENT" | "RC" | "ADMIN")[]> = {
  ACKNOWLEDGE: ["RC"],
  STUDENT_REOPEN: ["STUDENT"],
  RC_VERIFY_CLOSE: ["RC"],
};

// Transition matrix mapping: Action + Current Status -> Target Status
const TRANSITIONS: Record<TransitionAction, Partial<Record<ComplaintStatus, ComplaintStatus>>> = {
  ACKNOWLEDGE: {
    SUBMITTED: "AWAITING_RC_VERIFICATION",
    REOPENED: "AWAITING_RC_VERIFICATION",
  },
  STUDENT_REOPEN: {
    AWAITING_RC_VERIFICATION: "REOPENED",
    AWAITING_STUDENT_CONFIRMATION: "REOPENED", // legacy compatibility
  },
  RC_VERIFY_CLOSE: {
    AWAITING_RC_VERIFICATION: "CLOSED",
    AWAITING_STUDENT_CONFIRMATION: "CLOSED", // legacy compatibility
    ACKNOWLEDGED: "CLOSED", // legacy compatibility
  },
};

export async function transitionComplaint(
  complaintId: string,
  action: TransitionAction,
  userId: string,
  userRole: "STUDENT" | "RC" | "ADMIN",
  remarks?: string
) {
  return await prisma.$transaction(async (tx) => {
    // 1. Retrieve the complaint
    const complaint = await tx.complaint.findUnique({
      where: { id: complaintId },
      include: { student: true },
    });

    if (!complaint) {
      throw new Error("Complaint not found.");
    }

    // 2. Validate current state transition
    const targetStatus = TRANSITIONS[action][complaint.status];
    if (!targetStatus) {
      throw new Error(`Invalid transition. Action "${action}" is not allowed when complaint is in status "${complaint.status}".`);
    }

    // 3. Validate user role authorization
    const allowedRoles = ACTION_ROLES[action];
    if (!allowedRoles.includes(userRole)) {
      throw new Error(`Unauthorized. Role "${userRole}" is not permitted to perform action "${action}".`);
    }

    // 4. Validate ownership for students
    if (userRole === "STUDENT" && complaint.student_id !== userId) {
      throw new Error("Unauthorized. Students can only update their own complaints.");
    }

    // 5. Enforce Reopening constraints (Only available after 2 days from creation)
    if (action === "STUDENT_REOPEN") {
      const twoDaysInMs = 2 * 24 * 60 * 60 * 1000;
      if (Date.now() - new Date(complaint.created_at).getTime() < twoDaysInMs) {
        throw new Error("Complaints can only be reopened after 2 days from creation.");
      }
    }

    // 6. Update Complaint Status & Resolution Timestamps
    const updateData: { status: ComplaintStatus; closed_at?: Date; resolved_at?: Date } = { status: targetStatus };
    if (targetStatus === "CLOSED") {
      updateData.closed_at = new Date();
      updateData.resolved_at = new Date();
    }

    const updatedComplaint = await tx.complaint.update({
      where: { id: complaintId },
      data: updateData,
    });

    // 7. Insert timeline event (ComplaintUpdate)
    await tx.complaintUpdate.create({
      data: {
        complaint_id: complaintId,
        updated_by_id: userId,
        previous_status: complaint.status,
        new_status: targetStatus,
        remarks: remarks || null,
      },
    });

    // 8. Resolve Notification Recipient and Message
    let recipientIds: string[] = [];
    let notifTitle = "";
    let notifMessage = "";

    const studentName = complaint.student.name;

    switch (action) {
      case "ACKNOWLEDGE":
        recipientIds = [complaint.student_id];
        notifTitle = "Complaint Acknowledged";
        notifMessage = `Your complaint ${complaint.complaint_code} has been acknowledged.`;
        break;
      case "STUDENT_REOPEN":
        // Notify active RC
        const rcUserForReopen = await tx.user.findFirst({
          where: { role: "RC", is_active: true },
          select: { id: true },
        });
        if (rcUserForReopen) recipientIds = [rcUserForReopen.id];
        notifTitle = "Complaint Reopened";
        notifMessage = `Student ${studentName} reopened complaint ${complaint.complaint_code} with remarks: ${remarks || "None"}.`;
        break;
      case "RC_VERIFY_CLOSE":
        recipientIds = [complaint.student_id];
        notifTitle = "Complaint Closed";
        notifMessage = `Your complaint ${complaint.complaint_code} has been verified and closed by the RC. Remarks: ${remarks || "None"}.`;
        break;
    }

    // Batch create notifications
    for (const recipientId of recipientIds) {
      await tx.notification.create({
        data: {
          user_id: recipientId,
          complaint_id: complaintId,
          title: notifTitle,
          message: notifMessage,
        },
      });
    }

    // 9. Log the state change in administrative AuditLog
    await tx.auditLog.create({
      data: {
        performed_by: userId,
        action: `TRANSITION_${action}`,
        entity_type: "Complaint",
        entity_id: complaintId,
        description: `Complaint ${complaint.complaint_code} transitioned from ${complaint.status} to ${targetStatus} via action ${action}. Remarks: ${remarks || "None"}.`,
      },
    });

    return updatedComplaint;
  });
}

/**
 * Sweeps the database for complaints pending for more than 3 days,
 * escalates priority to HIGH, sets overdue flag, creates timeline logs, and notifies staff/admins.
 * Runs atomically to prevent duplicates.
 */
export async function checkAndUpdateOverdueComplaints() {
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

  // Fetch all complaints matching overdue condition
  const overdueComplaints = await prisma.complaint.findMany({
    where: {
      created_at: { lt: threeDaysAgo },
      status: { not: "CLOSED" },
      overdue: false,
    },
    include: {
      student: {
        select: { name: true },
      },
    },
  });

  if (overdueComplaints.length === 0) {
    return 0;
  }

  let updatedCount = 0;

  for (const complaint of overdueComplaints) {
    try {
      await prisma.$transaction(async (tx) => {
        // Double-check row locks/status
        const current = await tx.complaint.findUnique({
          where: { id: complaint.id },
          select: { overdue: true, status: true, student_id: true, complaint_code: true },
        });

        if (!current || current.overdue || current.status === "CLOSED") {
          return;
        }

        // 1. Get system actor (first active Admin)
        const systemAdmin = await tx.user.findFirst({
          where: { role: "ADMIN", is_active: true },
          select: { id: true },
        });
        const actorId = systemAdmin?.id || current.student_id;

        // 2. Set overdue true and priority HIGH
        await tx.complaint.update({
          where: { id: complaint.id },
          data: {
            overdue: true,
            priority: ComplaintPriority.HIGH,
          },
        });

        // 3. Create timeline event
        await tx.complaintUpdate.create({
          data: {
            complaint_id: complaint.id,
            updated_by_id: actorId,
            previous_status: current.status,
            new_status: current.status,
            remarks: "Complaint automatically flagged as overdue after remaining unresolved for more than 3 days.",
          },
        });

        // 4. Create notifications for RCs
        const rcUsers = await tx.user.findMany({
          where: { role: "RC", is_active: true },
          select: { id: true },
        });
        for (const rc of rcUsers) {
          await tx.notification.create({
            data: {
              user_id: rc.id,
              complaint_id: complaint.id,
              title: "Complaint Overdue Alert",
              message: `Complaint ${current.complaint_code} is unresolved for more than 3 days. Priority escalated to HIGH.`,
            },
          });
        }

        // 5. Create notifications for Admins
        const adminUsers = await tx.user.findMany({
          where: { role: "ADMIN", is_active: true },
          select: { id: true },
        });
        for (const admin of adminUsers) {
          await tx.notification.create({
            data: {
              user_id: admin.id,
              complaint_id: complaint.id,
              title: "Complaint Overdue Alert",
              message: `Complaint ${current.complaint_code} is unresolved for more than 3 days. Priority escalated to HIGH.`,
            },
          });
        }

        // 6. Create AuditLog
        await tx.auditLog.create({
          data: {
            performed_by: actorId,
            action: "COMPLAINT_OVERDUE",
            entity_type: "Complaint",
            entity_id: complaint.id,
            description: `Complaint ${current.complaint_code} was automatically flagged as overdue after remaining unresolved for more than 3 days. Priority escalated to HIGH.`,
          },
        });

        updatedCount++;
      });
    } catch (err) {
      console.error(`Failed to transition overdue complaint ${complaint.id}:`, err);
    }
  }

  return updatedCount;
}
