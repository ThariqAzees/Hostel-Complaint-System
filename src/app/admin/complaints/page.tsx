import React, { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import styles from "./complaints.module.css";
import AdminComplaintsFilter from "./complaints-filter";
import { ChevronLeft, ChevronRight, FileText } from "lucide-react";

export const dynamic = "force-dynamic";

interface AdminComplaintsPageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
    status?: string;
    category?: string;
  }>;
}

export default async function AdminComplaintsPage({ searchParams }: AdminComplaintsPageProps) {
  const adminUser = await getSessionUser();
  if (!adminUser || adminUser.role !== "ADMIN") {
    redirect("/login");
  }

  // Await dynamic route search parameters (Next.js 15+)
  const resolvedSearchParams = await searchParams;
  const page = parseInt(resolvedSearchParams.page || "1", 10);
  const search = resolvedSearchParams.search || "";
  const status = resolvedSearchParams.status || "";
  const category = resolvedSearchParams.category || "";

  const pageSize = 10;
  const skip = (page - 1) * pageSize;

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

  // Fetch complaints
  const [complaints, filteredCount] = await prisma.$transaction([
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
    return `/admin/complaints?${params.toString()}`;
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
      case "AWAITING_RC_VERIFICATION": return "Awaiting RC";
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
      <div className={styles.titleArea}>
        <h1 className={styles.title}>Complaints Queue</h1>
      </div>

      <Suspense fallback={<div>Loading filters...</div>}>
        <AdminComplaintsFilter />
      </Suspense>

      <div className={styles.tableWrapper}>
        {complaints.length === 0 ? (
          <div className={styles.emptyState}>
            <FileText size={48} style={{ color: "var(--text-light)" }} />
            <span className={styles.emptyTitle}>No Complaints Found</span>
            <span>There are no complaints registered in the system matching these filters.</span>
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Code</th>
                <th className={styles.th}>Student</th>
                <th className={styles.th}>Room</th>
                <th className={styles.th}>Title</th>
                <th className={styles.th}>Category</th>
                <th className={styles.th}>Status</th>
                <th className={styles.th}>Date</th>
              </tr>
            </thead>
            <tbody>
              {complaints.map((complaint) => (
                <tr key={complaint.id} className={styles.tr}>
                  <td className={`${styles.td} ${styles.codeCell}`}>{complaint.complaint_code}</td>
                  <td className={`${styles.td} ${styles.studentCell}`}>{complaint.student.name}</td>
                  <td className={styles.td}>Room {complaint.student.room_number || "—"}</td>
                  <td className={styles.td} style={{ maxWidth: "240px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {complaint.title}
                  </td>
                  <td className={styles.td}>{complaint.category}</td>
                  <td className={styles.td}>
                    <span className={`${styles.badge} ${getStatusBadgeClass(complaint.status)}`}>
                      {getStatusLabel(complaint.status)}
                    </span>
                  </td>
                  <td className={styles.td}>{formatDate(complaint.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

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
