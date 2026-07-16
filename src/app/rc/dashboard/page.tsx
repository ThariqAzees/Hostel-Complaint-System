import React, { Suspense } from "react";
import Link from "next/link";
import ClickableRow from "@/components/clickable-row";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import styles from "./dashboard.module.css";
import RcFilter from "./rc-filter";
import { ChevronLeft, ChevronRight, FileText, ClipboardList } from "lucide-react";

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
    redirect("/login");
  }

  // Await async search parameters (Next.js 15+)
  const resolvedSearchParams = await searchParams;
  const page = parseInt(resolvedSearchParams.page || "1", 10);
  const search = resolvedSearchParams.search || "";
  const status = resolvedSearchParams.status || "";
  const category = resolvedSearchParams.category || "";

  const pageSize = 10;
  const skip = (page - 1) * pageSize;

  // Build filter object for all complaints
  const where: any = {};

  if (search) {
    where.OR = [
      { complaint_code: { contains: search, mode: "insensitive" } },
      { title: { contains: search, mode: "insensitive" } },
      { student: { name: { contains: search, mode: "insensitive" } } },
    ];
  }

  if (status && status !== "ALL") {
    where.status = status;
  }

  if (category && category !== "ALL") {
    where.category = category;
  }

  // Fetch KPI status totals and paginated list in a transaction
  const [
    totalCount,
    submittedCount,
    acknowledgedCount,
    inProgressCount,
    awaitingStudentCount,
    awaitingRcCount,
    reopenedCount,
    closedCount,
    complaints,
    filteredCount,
  ] = await prisma.$transaction([
    prisma.complaint.count(),
    prisma.complaint.count({ where: { status: "SUBMITTED" } }),
    prisma.complaint.count({ where: { status: "ACKNOWLEDGED" } }),
    prisma.complaint.count({ where: { status: "IN_PROGRESS" } }),
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
      orderBy: { created_at: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.complaint.count({ where }),
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
      case "AWAITING_STUDENT_CONFIRMATION": return "Awaiting Action";
      case "AWAITING_RC_VERIFICATION": return "Awaiting RC Verification";
      case "REOPENED": return "Reopened";
      case "CLOSED": return "Closed";
      default: return statusState;
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
        <div className={styles.statCard} style={{ borderLeft: "3px solid #d97706" }}>
          <span className={styles.statTitle}>In Progress</span>
          <span className={styles.statValue}>{inProgressCount}</span>
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
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>Code</th>
                  <th className={styles.th}>Student Name</th>
                  <th className={styles.th}>Room</th>
                  <th className={styles.th}>Title</th>
                  <th className={styles.th}>Category</th>
                  <th className={styles.th}>Status</th>
                  <th className={styles.th}>Raised On</th>
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
                    <td className={styles.td}>Room {complaint.student.room_number || "—"}</td>
                    <td className={`${styles.td} ${styles.titleCell}`}>{complaint.title}</td>
                    <td className={styles.td}>{complaint.category}</td>
                    <td className={styles.td}>
                      <span className={`${styles.badge} ${getStatusBadgeClass(complaint.status)}`}>
                        {getStatusLabel(complaint.status)}
                      </span>
                    </td>
                    <td className={styles.td}>{formatDate(complaint.created_at)}</td>
                  </ClickableRow>
                ))}
              </tbody>
            </table>
          </div>
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
