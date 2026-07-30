import React, { Suspense } from "react";
import { formatIST } from "@/lib/date";
import Link from "next/link";
import ClickableRow from "@/components/clickable-row";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkAndUpdateOverdueComplaints } from "@/lib/state-machine";
import { cookies } from "next/headers";
import styles from "./dashboard.module.css";
import RcFilter from "./rc-filter";
import { ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { ComplaintStatus } from "@/generated/prisma/enums";

export const dynamic = "force-dynamic";

interface RcDashboardPageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
    status?: string;
    category?: string;
  }>;
}

export default async function RcDashboardPage({ searchParams }: RcDashboardPageProps) {
  const rcUser = await getSessionUser();
  if (!rcUser || rcUser.role !== "RC") {
    const cookieStore = await cookies();
    if (cookieStore.has("hostel_session")) {
      redirect("/api/auth/logout");
    }
    redirect("/login");
  }

  // Trigger overdue sweep on load
  await checkAndUpdateOverdueComplaints();

  // Await async search parameters (Next.js 15+)
  const resolvedSearchParams = await searchParams;
  const page = parseInt(resolvedSearchParams.page || "1", 10);
  const search = resolvedSearchParams.search || "";
  const status = resolvedSearchParams.status || "";
  const category = resolvedSearchParams.category || "";

  const pageSize = 10;
  const skip = (page - 1) * pageSize;
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();

  // Build filter object for all complaints
  const where: NonNullable<Parameters<typeof prisma.complaint.findMany>[0]>["where"] = {};

  if (search) {
    where.OR = [
      { complaint_code: { contains: search, mode: "insensitive" } },
      { title: { contains: search, mode: "insensitive" } },
      { student: { name: { contains: search, mode: "insensitive" } } },
    ];
  }

  if (status && status !== "ALL") {
    where.status = status as ComplaintStatus;
  }

  if (category && category !== "ALL") {
    where.category = category;
  }

  // Fetch KPI status totals and paginated list in a transaction
  const [
    totalCount,
    submittedCount,
    acknowledgedCount,
    overdueCount,
    awaitingStudentCount,
    awaitingRcCount,
    reopenedCount,
    closedCount,
    complaints,
    filteredCount,
    overdueComplaintsList,
  ] = await prisma.$transaction([
    prisma.complaint.count(),
    prisma.complaint.count({ where: { status: "SUBMITTED" } }),
    prisma.complaint.count({ where: { status: "ACKNOWLEDGED" } }),
    prisma.complaint.count({ where: { overdue: true, status: { not: "CLOSED" } } }),
    prisma.complaint.count({ where: { status: "AWAITING_STUDENT_CONFIRMATION" } }),
    prisma.complaint.count({ where: { status: "AWAITING_RC_VERIFICATION" } }),
    prisma.complaint.count({ where: { status: "REOPENED" } }),
    prisma.complaint.count({ where: { status: "CLOSED" } }),
    prisma.complaint.findMany({
      where,
      include: {
        student: {
          select: {
            name: true,
            room_number: true,
          },
        },
      },
      orderBy: [
        { overdue: "desc" },
        { created_at: "desc" },
      ],
      skip,
      take: pageSize,
    }),
    prisma.complaint.count({ where }),
    prisma.complaint.findMany({
      where: { overdue: true, status: { not: "CLOSED" } },
      include: {
        student: {
          select: { name: true, room_number: true },
        },
      },
      orderBy: { created_at: "asc" },
    }),
  ]);

  const totalPages = Math.ceil(filteredCount / pageSize);
  const startItem = filteredCount === 0 ? 0 : skip + 1;
  const endItem = Math.min(skip + pageSize, filteredCount);

  const getPageUrl = (targetPage: number) => {
    const params = new URLSearchParams();
    params.set("page", targetPage.toString());
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    if (category) params.set("category", category);
    return `/rc/dashboard?${params.toString()}`;
  };

  const getStatusBadgeClass = (statusState: string) => {
    switch (statusState) {
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

  const getStatusLabel = (statusState: string) => {
    switch (statusState) {
      case "SUBMITTED": return "Submitted";
      case "ACKNOWLEDGED": return "Acknowledged";
      case "IN_PROGRESS": return "In Progress";
      case "AWAITING_STUDENT_CONFIRMATION": return "Awaiting Student Confirmation";
      case "AWAITING_RC_VERIFICATION": return "Awaiting RC Verification";
      case "REOPENED": return "Reopened";
      case "CLOSED": return "Closed";
      default: return statusState;
    }
  };

  const formatDate = (date: Date) => {
    return formatIST(date);
  };

  return (
    <div className="animate-fade">
      <div className={styles.titleSection}>
        <h1 className={styles.title}>RC Dashboard</h1>
        <p className={styles.subtitle}>Manage all resident complaints for Mantharai Block.</p>
      </div>

      {/* Stats KPI Counters Grid */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statTitle}>Total Issues</span>
          <span className={styles.statValue}>{totalCount}</span>
        </div>
        <div className={styles.statCard} style={{ borderLeft: "3px solid #64748b" }}>
          <span className={styles.statTitle}>Submitted</span>
          <span className={styles.statValue}>{submittedCount}</span>
        </div>
        <div className={styles.statCard} style={{ borderLeft: "3px solid #7e22ce" }}>
          <span className={styles.statTitle}>Acknowledged</span>
          <span className={styles.statValue}>{acknowledgedCount}</span>
        </div>
        <div className={styles.statCard} style={{ borderLeft: "3px solid #ef4444" }}>
          <span className={styles.statTitle}>Overdue</span>
          <span className={styles.statValue}>{overdueCount}</span>
        </div>
        <div className={styles.statCard} style={{ borderLeft: "3px solid #0369a1" }}>
          <span className={styles.statTitle}>Awaiting Student</span>
          <span className={styles.statValue}>{awaitingStudentCount}</span>
        </div>
        <div className={styles.statCard} style={{ borderLeft: "3px solid #047857" }}>
          <span className={styles.statTitle}>Awaiting RC</span>
          <span className={styles.statValue}>{awaitingRcCount}</span>
        </div>
        <div className={styles.statCard} style={{ borderLeft: "3px solid #b91c1c" }}>
          <span className={styles.statTitle}>Reopened</span>
          <span className={styles.statValue}>{reopenedCount}</span>
        </div>
        <div className={styles.statCard} style={{ borderLeft: "3px solid #4338ca" }}>
          <span className={styles.statTitle}>Closed</span>
          <span className={styles.statValue}>{closedCount}</span>
        </div>
      </div>

      {overdueCount > 0 && (
        <div className={styles.overdueCard}>
          <div className={styles.overdueHeaderSection}>
            <h2 className={styles.overdueTitle}>Overdue Complaints</h2>
            <span className={styles.overdueActionBadge}>Action Required</span>
          </div>
          <div className={styles.desktopTable}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr>
                  <th className={styles.th}>Code</th>
                  <th className={styles.th}>Student Name</th>
                  <th className={`${styles.th} ${styles.mobileHidden}`}>Room</th>
                  <th className={`${styles.th} ${styles.mobileHidden}`}>Category</th>
                  <th className={styles.th}>Days Pending</th>
                  <th className={styles.th}>Current Status</th>
                  <th className={`${styles.th} ${styles.mobileHidden}`}>Priority</th>
                </tr>
              </thead>
              <tbody>
                {overdueComplaintsList.map((complaint) => (
                  <ClickableRow
                    key={complaint.id}
                    href={`/rc/complaints/${complaint.id}`}
                    className={styles.tr}
                  >
                    <td className={`${styles.td} ${styles.codeCell}`}>{complaint.complaint_code}</td>
                    <td className={styles.td} style={{ fontWeight: 600 }}>{complaint.student.name}</td>
                    <td className={`${styles.td} ${styles.mobileHidden}`}>Room {complaint.student.room_number || "—"}</td>
                    <td className={`${styles.td} ${styles.mobileHidden}`}>{complaint.category}</td>
                    <td className={styles.td} style={{ color: "#ef4444", fontWeight: 700 }}>
                      {Math.floor((nowMs - new Date(complaint.created_at).getTime()) / (1000 * 60 * 60 * 24))} Days
                    </td>
                    <td className={styles.td}>
                      <span className={`${styles.badge} ${getStatusBadgeClass(complaint.status)}`}>
                        {getStatusLabel(complaint.status)}
                      </span>
                    </td>
                    <td className={`${styles.td} ${styles.mobileHidden}`}>
                      <span style={{ display: "inline-flex", padding: "4px 8px", borderRadius: "4px", fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", background: "#ef4444", color: "white" }}>
                        HIGH
                      </span>
                    </td>
                  </ClickableRow>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.mobileCardList}>
            {overdueComplaintsList.map((complaint) => (
              <Link
                key={complaint.id}
                href={`/rc/complaints/${complaint.id}`}
                className={styles.mobileCard}
              >
                <div className={styles.mobileCardHeader}>
                  <span className={styles.mobileCardCode}>{complaint.complaint_code}</span>
                  <span className={styles.mobileCardBadgeRed}>OVERDUE</span>
                </div>
                <div className={styles.mobileCardBody}>
                  <h4 className={styles.mobileCardTitle}>{complaint.title}</h4>
                  <div className={styles.mobileCardMeta}>
                    <span>Student: {complaint.student.name} • Room {complaint.student.room_number || "—"}</span>
                    <span>Category: {complaint.category}</span>
                    <span style={{ color: "#ef4444", fontWeight: 700 }}>
                      Pending: {Math.floor((nowMs - new Date(complaint.created_at).getTime()) / (1000 * 60 * 60 * 24))} Days
                    </span>
                  </div>
                </div>
                <div className={styles.mobileCardFooter}>
                  <span className={`${styles.badge} ${getStatusBadgeClass(complaint.status)}`}>
                    {getStatusLabel(complaint.status)}
                  </span>
                  <span className={styles.mobileCardAction}>View Details →</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Filters Area */}
      <Suspense fallback={<div>Loading filters...</div>}>
        <RcFilter />
      </Suspense>

      {/* Queue Table */}
      <div className={styles.tableCard}>
        {complaints.length === 0 ? (
          <div className={styles.emptyState}>
            <FileText size={48} style={{ color: "var(--text-light)" }} />
            <span className={styles.emptyTitle}>No Complaints Found</span>
            <span>There are no complaints matching your current filters.</span>
          </div>
        ) : (
          <>
            <div className={`${styles.tableWrapper} ${styles.desktopTable}`}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.th}>Code</th>
                    <th className={styles.th}>Student Name</th>
                    <th className={`${styles.th} ${styles.mobileHidden}`}>Room</th>
                    <th className={styles.th}>Title</th>
                    <th className={`${styles.th} ${styles.mobileHidden}`}>Category</th>
                    <th className={styles.th}>Status</th>
                    <th className={`${styles.th} ${styles.mobileHidden}`}>Raised On</th>
                  </tr>
                </thead>
                <tbody>
                  {complaints.map((complaint) => (
                    <ClickableRow
                      key={complaint.id}
                      href={`/rc/complaints/${complaint.id}`}
                      className={styles.tr}
                    >
                      <td className={`${styles.td} ${styles.codeCell}`}>{complaint.complaint_code}</td>
                      <td className={styles.td} style={{ fontWeight: 600 }}>{complaint.student.name}</td>
                      <td className={`${styles.td} ${styles.mobileHidden}`}>Room {complaint.student.room_number || "—"}</td>
                      <td className={`${styles.td} ${styles.titleCell}`}>{complaint.title}</td>
                      <td className={`${styles.td} ${styles.mobileHidden}`}>{complaint.category}</td>
                      <td className={styles.td}>
                        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                          <span className={`${styles.badge} ${getStatusBadgeClass(complaint.status)}`}>
                            {getStatusLabel(complaint.status)}
                          </span>
                          {complaint.overdue && (
                            <span style={{ background: "#fee2e2", color: "#b91c1c", fontWeight: 700, padding: "4px 8px", borderRadius: "4px", fontSize: "0.7rem", textTransform: "uppercase" }}>
                              OVERDUE
                            </span>
                          )}
                        </div>
                      </td>
                      <td className={`${styles.td} ${styles.mobileHidden}`}>{formatDate(complaint.created_at)}</td>
                    </ClickableRow>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={styles.mobileCardList}>
              {complaints.map((complaint) => (
                <Link
                  key={complaint.id}
                  href={`/rc/complaints/${complaint.id}`}
                  className={styles.mobileCard}
                >
                  <div className={styles.mobileCardHeader}>
                    <span className={styles.mobileCardCode}>{complaint.complaint_code}</span>
                    {complaint.overdue && (
                      <span className={styles.mobileCardBadgeRed}>OVERDUE</span>
                    )}
                  </div>
                  <div className={styles.mobileCardBody}>
                    <h4 className={styles.mobileCardTitle}>{complaint.title}</h4>
                    <div className={styles.mobileCardMeta}>
                      <span>Student: {complaint.student.name} • Room {complaint.student.room_number || "—"}</span>
                      <span>Category: {complaint.category}</span>
                      <span>Submitted: {formatDate(complaint.created_at)}</span>
                    </div>
                  </div>
                  <div className={styles.mobileCardFooter}>
                    <span className={`${styles.badge} ${getStatusBadgeClass(complaint.status)}`}>
                      {getStatusLabel(complaint.status)}
                    </span>
                    <span className={styles.mobileCardAction}>View Details →</span>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <div className={styles.paginationInfo}>
            Showing <strong>{startItem}</strong> to <strong>{endItem}</strong> of <strong>{filteredCount}</strong> entries
          </div>
          <div className={styles.paginationButtons}>
            <Link href={page > 1 ? getPageUrl(page - 1) : "#"}>
              <button type="button" className={styles.pageBtn} disabled={page <= 1}>
                <ChevronLeft size={16} />
                <span>Previous</span>
              </button>
            </Link>
            <Link href={page < totalPages ? getPageUrl(page + 1) : "#"}>
              <button type="button" className={styles.pageBtn} disabled={page >= totalPages}>
                <span>Next</span>
                <ChevronRight size={16} />
              </button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
