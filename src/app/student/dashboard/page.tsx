import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkAndUpdateOverdueComplaints } from "@/lib/state-machine";
import { cookies } from "next/headers";
import styles from "./dashboard.module.css";
import { Plus, User, Award, Home, FileText, Bell, ClipboardList } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function StudentDashboard() {
  const studentUser = await getSessionUser();
  if (!studentUser || studentUser.role !== "STUDENT") {
    const cookieStore = await cookies();
    if (cookieStore.has("hostel_session")) {
      redirect("/api/auth/logout");
    }
    redirect("/login");
  }

  // Trigger overdue sweep on load
  await checkAndUpdateOverdueComplaints();

  // Fetch student complaint metrics
  const [
    totalComplaints,
    submittedComplaints,
    acknowledgedComplaints,
    awaitingStudentComplaints,
    awaitingRcVerificationComplaints,
    reopenedComplaints,
    closedComplaints,
  ] = await prisma.$transaction([
    prisma.complaint.count({ where: { student_id: studentUser.id } }),
    prisma.complaint.count({ where: { student_id: studentUser.id, status: "SUBMITTED" } }),
    prisma.complaint.count({ where: { student_id: studentUser.id, status: "ACKNOWLEDGED" } }),
    prisma.complaint.count({ where: { student_id: studentUser.id, status: "AWAITING_STUDENT_CONFIRMATION" } }),
    prisma.complaint.count({ where: { student_id: studentUser.id, status: "AWAITING_RC_VERIFICATION" } }),
    prisma.complaint.count({ where: { student_id: studentUser.id, status: "REOPENED" } }),
    prisma.complaint.count({ where: { student_id: studentUser.id, status: "CLOSED" } }),
  ]);

  const activeComplaints = totalComplaints - closedComplaints;

  // Fetch recent complaints (last 5)
  const recentComplaints = await prisma.complaint.findMany({
    where: { student_id: studentUser.id },
    take: 5,
    orderBy: { created_at: "desc" },
  });

  // Fetch notifications (last 5)
  const recentNotifications = await prisma.notification.findMany({
    where: { user_id: studentUser.id },
    take: 5,
    orderBy: { created_at: "desc" },
  });

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "SUBMITTED": return styles.badgeSubmitted;
      case "ACKNOWLEDGED": return styles.badgeAcknowledged;
      case "IN_PROGRESS": return styles.badgeInProgress;
      case "AWAITING_STUDENT_CONFIRMATION": return styles.badgeAwaitingStudent;
      case "AWAITING_RC_VERIFICATION": return styles.badgeAwaitingRc;
      case "REOPENED": return styles.badgeReopened;
      case "CLOSED": return styles.badgeClosed;
      default: return "";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "SUBMITTED": return "Submitted";
      case "ACKNOWLEDGED": return "Acknowledged";
      case "IN_PROGRESS": return "In Progress";
      case "AWAITING_STUDENT_CONFIRMATION": return "Waiting for Your Confirmation";
      case "AWAITING_RC_VERIFICATION": return "Awaiting Verification";
      case "REOPENED": return "Reopened";
      case "CLOSED": return "Closed";
      default: return status;
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="animate-fade">
      {/* Student Profile Card Header */}
      <div className={styles.profileHeader}>
        <div className={styles.profileInfo}>
          <h1 className={styles.studentName}>{studentUser.name}</h1>
          <div className={styles.studentMeta}>
            <div className={styles.metaItem}>
              <Award size={16} />
              <span>Reg No: <strong>{studentUser.registration_number}</strong></span>
            </div>
            <span className={styles.metaDivider}>|</span>
            <div className={styles.metaItem}>
              <Home size={16} />
              <span>Room: <strong>{studentUser.room_number}</strong></span>
            </div>
          </div>
        </div>
        <Link href="/student/complaints/new">
          <button type="button" className={styles.btnRaise}>
            <Plus size={18} />
            <span>Raise New Complaint</span>
          </button>
        </Link>
      </div>

      {/* Stats KPI Counters Grid */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statTitle}>Total Raised</span>
          <span className={styles.statValue}>{totalComplaints}</span>
        </div>
        <div className={styles.statCard} style={{ borderLeft: "3px solid var(--warning)" }}>
          <span className={styles.statTitle}>Active</span>
          <span className={styles.statValue}>{activeComplaints}</span>
        </div>
        <div className={styles.statCard} style={{ borderLeft: "3px solid var(--info)" }}>
          <span className={styles.statTitle}>Awaiting Confirm</span>
          <span className={styles.statValue}>{awaitingStudentComplaints}</span>
        </div>
        <div className={styles.statCard} style={{ borderLeft: "3px solid var(--success)" }}>
          <span className={styles.statTitle}>Closed</span>
          <span className={styles.statValue}>{closedComplaints}</span>
        </div>
        <div className={styles.statCard} style={{ borderLeft: "3px solid var(--danger)" }}>
          <span className={styles.statTitle}>Reopened</span>
          <span className={styles.statValue}>{reopenedComplaints}</span>
        </div>
      </div>

      {/* Split layout: Recent Complaints on Left, Notifications on Right */}
      <div className={styles.dashboardSection}>
        {/* Left Side: Recent Complaints */}
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Recent Complaints</h2>
            <ClipboardList size={18} style={{ color: "var(--text-muted)" }} />
          </div>

          <div className={styles.complaintList}>
            {recentComplaints.length === 0 ? (
              <div className={styles.emptyState}>
                <FileText size={32} style={{ color: "var(--text-light)" }} />
                <span>You have not raised any complaints yet.</span>
                <Link href="/student/complaints/new" style={{ color: "var(--primary)", fontWeight: 600, marginTop: "8px" }}>
                  Raise your first complaint
                </Link>
              </div>
            ) : (
              recentComplaints.map((complaint) => (
                <Link
                  key={complaint.id}
                  href={`/student/complaints/${complaint.id}`}
                  style={{ textDecoration: "none", color: "inherit", display: "block" }}
                >
                  <div className={styles.complaintItem} style={{ cursor: "pointer" }}>
                    <div className={styles.complaintInfo}>
                      <span className={styles.complaintCode}>{complaint.complaint_code}</span>
                      <span className={styles.complaintTitle}>{complaint.title}</span>
                      <div className={styles.complaintMeta}>
                        <span>{complaint.category}</span>
                        <span>•</span>
                        <span>{formatDate(complaint.created_at)}</span>
                      </div>
                    </div>
                    <div className={styles.complaintRight}>
                      <span className={`${styles.badge} ${getStatusBadgeClass(complaint.status)}`}>
                        {getStatusLabel(complaint.status)}
                      </span>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Right Side: Notifications */}
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Recent Notifications</h2>
            <Bell size={18} style={{ color: "var(--text-muted)" }} />
          </div>

          <div className={styles.notificationList}>
            {recentNotifications.length === 0 ? (
              <div className={styles.emptyState}>
                <Bell size={32} style={{ color: "var(--text-light)" }} />
                <span>No new notifications.</span>
              </div>
            ) : (
              recentNotifications.map((notif) => {
                const itemContent = (
                  <div 
                    className={`${styles.notificationItem} ${!notif.is_read ? styles.notificationUnread : ""}`}
                    style={notif.complaint_id ? { cursor: "pointer" } : undefined}
                  >
                    <span className={styles.notificationTitle}>{notif.title}</span>
                    <span className={styles.notificationMsg}>{notif.message}</span>
                    <span className={styles.notificationTime}>
                      {formatDate(notif.created_at)}
                    </span>
                  </div>
                );

                if (notif.complaint_id) {
                  return (
                    <Link
                      key={notif.id}
                      href={`/student/complaints/${notif.complaint_id}`}
                      style={{ textDecoration: "none", color: "inherit", display: "block" }}
                    >
                      {itemContent}
                    </Link>
                  );
                }

                return <div key={notif.id}>{itemContent}</div>;
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
