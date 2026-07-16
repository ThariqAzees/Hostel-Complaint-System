import { prisma } from "./db";
import { ComplaintStatus } from "../generated/prisma/enums";

export type TransitionAction =
  | "ACKNOWLEDGE"
  | "START_WORK"
  | "REQUEST_CONFIRMATION"
  | "STUDENT_CONFIRM_FIXED"
  | "STUDENT_REJECT_FIXED"
  | "RC_VERIFY_CLOSE";

// Valid role checks for each action
const ACTION_ROLES: Record<TransitionAction, ("STUDENT" | "RC" | "ADMIN")[]> = {
  ACKNOWLEDGE: ["RC"],
  START_WORK: ["RC"],
  REQUEST_CONFIRMATION: ["RC"],
  STUDENT_CONFIRM_FIXED: ["STUDENT"],
  STUDENT_REJECT_FIXED: ["STUDENT"],
  RC_VERIFY_CLOSE: ["RC"],
};

// Transition matrix mapping: Action + Current Status -> Target Status
const TRANSITIONS: Record<TransitionAction, Partial<Record<ComplaintStatus, ComplaintStatus>>> = {
  ACKNOWLEDGE: {
    SUBMITTED: "ACKNOWLEDGED",
  },
  START_WORK: {
    ACKNOWLEDGED: "IN_PROGRESS",
    REOPENED: "IN_PROGRESS",
  },
  REQUEST_CONFIRMATION: {
    IN_PROGRESS: "AWAITING_STUDENT_CONFIRMATION",
  },
  STUDENT_CONFIRM_FIXED: {
    AWAITING_STUDENT_CONFIRMATION: "AWAITING_RC_VERIFICATION",
  },
  STUDENT_REJECT_FIXED: {
    AWAITING_STUDENT_CONFIRMATION: "REOPENED",
  },
  RC_VERIFY_CLOSE: {
    AWAITING_RC_VERIFICATION: "CLOSED",
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
    // 1. Retrieve the complaint (with student profile for details)
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

    // 5. Update Complaint Status & Resolution Timestamps
    const updateData: any = { status: targetStatus };
    if (targetStatus === "CLOSED") {
      updateData.closed_at = new Date();
    }
    if (targetStatus === "CLOSED" || targetStatus === "AWAITING_RC_VERIFICATION") {
      updateData.resolved_at = new Date();
    }

    const updatedComplaint = await tx.complaint.update({
      where: { id: complaintId },
      data: updateData,
    });

    // 6. Insert timeline event (ComplaintUpdate)
    await tx.complaintUpdate.create({
      data: {
        complaint_id: complaintId,
        updated_by_id: userId,
        previous_status: complaint.status,
        new_status: targetStatus,
        remarks: remarks || null,
      },
    });

    // 7. Resolve Notification Recipient and Message
    let recipientId: string | null = null;
    let notifTitle = "";
    let notifMessage = "";

    const userDisplayName = userRole === "STUDENT" ? complaint.student.name : "RC";

    switch (action) {
      case "ACKNOWLEDGE":
        recipientId = complaint.student_id;
        notifTitle = "Complaint Acknowledged";
        notifMessage = `Your complaint ${complaint.complaint_code} has been acknowledged by the Residential Counselor.`;
        break;
      case "START_WORK":
        recipientId = complaint.student_id;
        notifTitle = "Work Started on Complaint";
        notifMessage = `The RC has started working on resolving your complaint ${complaint.complaint_code}.`;
        break;
      case "REQUEST_CONFIRMATION":
        recipientId = complaint.student_id;
        notifTitle = "Fix Confirmation Required";
        notifMessage = `The RC has marked complaint ${complaint.complaint_code} as resolved. Please verify and confirm if it is fixed.`;
        break;
      case "STUDENT_CONFIRM_FIXED":
        // Notify the RC
        const rcUser = await tx.user.findFirst({
          where: { role: "RC", is_active: true },
          select: { id: true },
        });
        recipientId = rcUser?.id || null;
        notifTitle = "Student Confirmed Fix";
        notifMessage = `Student ${userDisplayName} has confirmed the fix for complaint ${complaint.complaint_code}. Final closure pending your verification.`;
        break;
      case "STUDENT_REJECT_FIXED":
        // Notify the RC
        const rcUserForReject = await tx.user.findFirst({
          where: { role: "RC", is_active: true },
          select: { id: true },
        });
        recipientId = rcUserForReject?.id || null;
        notifTitle = "Student Rejected Fix (Reopened)";
        notifMessage = `Student ${userDisplayName} reported that complaint ${complaint.complaint_code} is still not fixed. The complaint has been reopened.`;
        break;
      case "RC_VERIFY_CLOSE":
        recipientId = complaint.student_id;
        notifTitle = "Complaint Closed";
        notifMessage = `Your complaint ${complaint.complaint_code} has been verified and officially closed by the RC. Remarks: ${remarks || "None"}.`;
        break;
    }

    if (recipientId) {
      await tx.notification.create({
        data: {
          user_id: recipientId,
          complaint_id: complaintId,
          title: notifTitle,
          message: notifMessage,
        },
      });
    }

    // 8. Log the state change in administrative AuditLog
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
