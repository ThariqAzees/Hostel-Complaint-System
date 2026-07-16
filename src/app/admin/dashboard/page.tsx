import React from "react";
import { prisma } from "@/lib/db";
import styles from "./dashboard.module.css";
import { Users, AlertCircle, CheckCircle, Clock, ClipboardList, Activity } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  // 1. Fetch Student metrics
  const [totalStudents, activeStudents] = await prisma.$transaction([
    prisma.user.count({ where: { role: "STUDENT" } }),
    prisma.user.count({ where: { role: "STUDENT", is_active: true } }),
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

  const activeComplaintsCount = totalComplaints - closedComplaints;
  const completedComplaintsCount = closedComplaints;

  // 3. Calculate average resolution time
  const resolvedOrClosedList = await prisma.complaint.findMany({
    where: { resolved_at: { not: null } },
    select: { created_at: true, resolved_at: true },
  });

  let averageResolutionHours = "0";
  if (resolvedOrClosedList.length > 0) {
    const totalMs = resolvedOrClosedList.reduce((acc, curr) => {
      return acc + (curr.resolved_at!.getTime() - curr.created_at.getTime());
    }, 0);
    const avgMs = totalMs / resolvedOrClosedList.length;
    averageResolutionHours = (avgMs / (1000 * 60 * 60)).toFixed(1);
  }

  // 4. Fetch recent audit logs (last 5)
  const recentLogs = await prisma.auditLog.findMany({
    take: 5,
    orderBy: { created_at: "desc" },
    include: {
      user: {
        select: { name: true, role: true },
      },
    },
  });

  // Calculate percentages for status bars
  const getPercentage = (count: number) => {
    if (totalComplaints === 0) return 0;
    return Math.round((count / totalComplaints) * 100);
  };

  const getRelativeTime = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const statusItems = [
    { name: "Submitted (New)", count: submittedComplaints, color: "#64748b" }, // Slate
    { name: "Acknowledged", count: acknowledgedComplaints, color: "#a855f7" }, // Purple
    { name: "In Progress", count: inProgressComplaints, color: "#f59e0b" }, // Amber
    { name: "Awaiting Student Confirmation", count: awaitingStudentComplaints, color: "#0ea5e9" }, // Sky
    { name: "Awaiting RC Verification", count: awaitingRcVerificationComplaints, color: "#10b981" }, // Emerald
    { name: "Reopened", count: reopenedComplaints, color: "#ef4444" }, // Rose
    { name: "Closed (Verified)", count: closedComplaints, color: "#6366f1" }, // Indigo
  ];

  return (
    <div className="animate-fade">
      <div className={styles.grid}>
        {/* KPI: Total Students */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiTitle}>Total Students</span>
            <span className={styles.kpiValue}>{totalStudents}</span>
            <span style={{ fontSize: "0.75rem", color: "var(--success)" }}>
              {activeStudents} Active Accounts
            </span>
          </div>
          <div className={styles.kpiIcon} style={{ background: "rgba(99, 102, 241, 0.1)", color: "var(--primary)" }}>
            <Users size={24} />
          </div>
        </div>

        {/* KPI: Active Complaints */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiTitle}>Active Complaints</span>
            <span className={styles.kpiValue}>{activeComplaintsCount}</span>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
              Pending verification / action
            </span>
          </div>
          <div className={styles.kpiIcon} style={{ background: "rgba(245, 158, 11, 0.1)", color: "var(--warning)" }}>
            <AlertCircle size={24} />
          </div>
        </div>

        {/* KPI: Completed Cases */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiTitle}>Completed Cases</span>
            <span className={styles.kpiValue}>{completedComplaintsCount}</span>
            <span style={{ fontSize: "0.75rem", color: "var(--success)" }}>
              {totalComplaints > 0 ? Math.round((completedComplaintsCount / totalComplaints) * 100) : 0}% Resolution Rate
            </span>
          </div>
          <div className={styles.kpiIcon} style={{ background: "rgba(16, 185, 129, 0.1)", color: "var(--success)" }}>
            <CheckCircle size={24} />
          </div>
        </div>

        {/* KPI: Avg. Resolution Time */}
        <div className={styles.kpiCard}>
          <div className={styles.kpiInfo}>
            <span className={styles.kpiTitle}>Avg. Resolution</span>
            <span className={styles.kpiValue}>{averageResolutionHours} Hrs</span>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
              From submission to resolve
            </span>
          </div>
          <div className={styles.kpiIcon} style={{ background: "rgba(14, 165, 233, 0.1)", color: "var(--info)" }}>
            <Clock size={24} />
          </div>
        </div>
      </div>

      <div className={styles.layoutSection}>
        {/* Left Card: Status Breakdown */}
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Complaint Queue Status</h2>
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 500 }}>
              {totalComplaints} Total Submissions
            </span>
          </div>
          <div className={styles.breakdownContainer}>
            {statusItems.map((item) => {
              const pct = getPercentage(item.count);
              return (
                <div key={item.name} className={styles.breakdownItem}>
                  <div className={styles.breakdownLabelRow}>
                    <span className={styles.breakdownName}>{item.name}</span>
                    <span className={styles.breakdownCount}>
                      {item.count} ({pct}%)
                    </span>
                  </div>
                  <div className={styles.progressTrack}>
                    <div
                      className={styles.progressBar}
                      style={{
                        width: `${pct}%`,
                        backgroundColor: item.color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Card: Recent Activity logs */}
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Recent Activity Log</h2>
            <ClipboardList size={18} style={{ color: "var(--text-muted)" }} />
          </div>

          <div className={styles.logList}>
            {recentLogs.length === 0 ? (
              <div className={styles.emptyState}>
                <Activity size={24} />
                <span>No recent actions recorded.</span>
              </div>
            ) : (
              recentLogs.map((log) => (
                <div key={log.id} className={styles.logItem}>
                  <div className={styles.logIcon}>
                    <Activity size={14} />
                  </div>
                  <div className={styles.logContent}>
                    <span className={styles.logDesc}>{log.description}</span>
                    <div className={styles.logMeta}>
                      <span style={{ fontWeight: 600 }}>{log.user.name}</span>
                      <span>•</span>
                      <span>{log.user.role}</span>
                      <span>•</span>
                      <span className={styles.logTime}>{getRelativeTime(log.created_at)}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
