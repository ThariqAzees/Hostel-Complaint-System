import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET(request: Request) {
  const adminUser = await getSessionUser();
  if (!adminUser || adminUser.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized. Admin access required." }, { status: 401 });
  }

  try {
    // 1. Fetch Student metrics
    const [totalStudents, activeStudents, inactiveStudents] = await prisma.$transaction([
      prisma.user.count({ where: { role: "STUDENT" } }),
      prisma.user.count({ where: { role: "STUDENT", is_active: true } }),
      prisma.user.count({ where: { role: "STUDENT", is_active: false } }),
    ]);

    // 2. Fetch Complaint metrics
    const [
      totalComplaints,
      submittedComplaints,
      acknowledgedComplaints,
      inProgressComplaints,
      awaitingStudentComplaints,
      awaitingRcVerificationComplaints,
      reopenedComplaints,
      closedComplaints,
    ] = await prisma.$transaction([
      prisma.complaint.count(),
      prisma.complaint.count({ where: { status: "SUBMITTED" } }),
      prisma.complaint.count({ where: { status: "ACKNOWLEDGED" } }),
      prisma.complaint.count({ where: { status: "IN_PROGRESS" } }),
      prisma.complaint.count({ where: { status: "AWAITING_STUDENT_CONFIRMATION" } }),
      prisma.complaint.count({ where: { status: "AWAITING_RC_VERIFICATION" } }),
      prisma.complaint.count({ where: { status: "REOPENED" } }),
      prisma.complaint.count({ where: { status: "CLOSED" } }),
    ]);

    // 3. Calculate average resolution time (in hours) for resolved/closed complaints
    const resolvedOrClosedList = await prisma.complaint.findMany({
      where: {
        resolved_at: { not: null },
      },
      select: {
        created_at: true,
        resolved_at: true,
      },
    });

    let averageResolutionTimeHours = 0;
    if (resolvedOrClosedList.length > 0) {
      const totalResolutionMs = resolvedOrClosedList.reduce((acc, curr) => {
        const resolutionTime = curr.resolved_at!.getTime() - curr.created_at.getTime();
        return acc + resolutionTime;
      }, 0);
      const avgMs = totalResolutionMs / resolvedOrClosedList.length;
      averageResolutionTimeHours = parseFloat((avgMs / (1000 * 60 * 60)).toFixed(1)); // Rounded to 1 decimal place
    }

    return NextResponse.json({
      success: true,
      metrics: {
        students: {
          total: totalStudents,
          active: activeStudents,
          inactive: inactiveStudents,
        },
        complaints: {
          total: totalComplaints,
          submitted: submittedComplaints,
          acknowledged: acknowledgedComplaints,
          inProgress: inProgressComplaints,
          awaitingStudent: awaitingStudentComplaints,
          awaitingRcVerification: awaitingRcVerificationComplaints,
          reopened: reopenedComplaints,
          closed: closedComplaints,
          activeTotal: totalComplaints - closedComplaints,
        },
        averageResolutionTimeHours,
      },
    });
  } catch (err) {
    console.error("Fetch admin metrics error:", err);
    return NextResponse.json({ error: "An internal server error occurred" }, { status: 500 });
  }
}
