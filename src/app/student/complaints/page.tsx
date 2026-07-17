import React, { Suspense } from "react";
import Link from "next/link";
import ClickableRow from "@/components/clickable-row";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkAndUpdateOverdueComplaints } from "@/lib/state-machine";
import { cookies } from "next/headers";
import styles from "./complaints.module.css";
import ComplaintsFilter from "./complaints-filter";
import { ChevronLeft, ChevronRight, FileText, Plus } from "lucide-react";

export const dynamic = "force-dynamic";

interface ComplaintsPageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
    status?: string;
    category?: string;
  }>;
}

export default async function StudentComplaintsPage({ searchParams }: ComplaintsPageProps) {
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

  // Await Next.js 15+ asynchronous searchParams
  const resolvedSearchParams = await searchParams;
  const page = parseInt(resolvedSearchParams.page || "1", 10);
  const search = resolvedSearchParams.search || "";
  const status = resolvedSearchParams.status || "";
  const category = resolvedSearchParams.category || "";

  const pageSize = 10;
  const skip = (page - 1) * pageSize;

  // Build prisma query filters
  const where: any = {
    student_id: studentUser.id,
  };

  if (search) {
    where.OR = [
      { complaint_code: { contains: search, mode: "insensitive" } },
      { title: { contains: search, mode: "insensitive" } },
    ];
  }

  if (status && status !== "ALL") {
    where.status = status;
  }

  if (category && category !== "ALL") {
    where.category = category;
  }

  // Run transactional query for list and total counts
  const [complaints, totalCount] = await prisma.$transaction([
    prisma.complaint.findMany({
      where,
      orderBy: { created_at: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.complaint.count({ where }),
  ]);

  const totalPages = Math.ceil(totalCount / pageSize);
  const startItem = totalCount === 0 ? 0 : skip + 1;
  const endItem = Math.min(skip + pageSize, totalCount);

  const getPageUrl = (targetPage: number) => {
    const params = new URLSearchParams();
    params.set("page", targetPage.toString());
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    if (category) params.set("category", category);
    return `/student/complaints?${params.toString()}`;
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
      case "AWAITING_STUDENT_CONFIRMATION": return "Awaiting My Action";
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
    <div className={`${styles.container} animate-fade`}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div className={styles.header}>
          <h1 className={styles.title}>My Complaints</h1>
          <p className={styles.subtitle}>Track and manage your submitted hostel maintenance complaints.</p>
        </div>
        <Link href="/student/complaints/new">
          <button type="button" className="btn btn-primary" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Plus size={16} />
            <span>Raise New</span>
          </button>
        </Link>
      </div>

      <Suspense fallback={<div>Loading filters...</div>}>
        <ComplaintsFilter />
      </Suspense>

      <div className={styles.tableCard}>
        {complaints.length === 0 ? (
          <div className={styles.emptyState}>
            <FileText size={48} style={{ color: "var(--text-light)" }} />
            <span className={styles.emptyTitle}>No Complaints Found</span>
            <span>We couldn&apos;t find any complaints matching your filters.</span>
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>Code</th>
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
                    href={`/student/complaints/${complaint.id}`}
                    className={styles.tr}
                  >
                    <td className={`${styles.td} ${styles.codeCell}`}>{complaint.complaint_code}</td>
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

      {totalPages > 1 && (
        <div className={styles.pagination}>
          <div className={styles.paginationInfo}>
            Showing <strong>{startItem}</strong> to <strong>{endItem}</strong> of <strong>{totalCount}</strong> entries
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
