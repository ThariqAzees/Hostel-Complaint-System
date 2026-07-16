import React, { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import styles from "./audit-logs.module.css";
import AdminAuditFilter from "./audit-filter";
import { ChevronLeft, ChevronRight, ClipboardList } from "lucide-react";

export const dynamic = "force-dynamic";

interface AdminAuditLogsPageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
    action?: string;
  }>;
}

export default async function AdminAuditLogsPage({ searchParams }: AdminAuditLogsPageProps) {
  const adminUser = await getSessionUser();
  if (!adminUser || adminUser.role !== "ADMIN") {
    redirect("/login");
  }

  // Await dynamic route search parameters (Next.js 15+)
  const resolvedSearchParams = await searchParams;
  const page = parseInt(resolvedSearchParams.page || "1", 10);
  const search = resolvedSearchParams.search || "";
  const action = resolvedSearchParams.action || "";

  const pageSize = 15; // Displays slightly more logs per page since they are simple text
  const skip = (page - 1) * pageSize;

  const where: any = {};

  if (search) {
    where.OR = [
      { description: { contains: search, mode: "insensitive" } },
      { user: { name: { contains: search, mode: "insensitive" } } },
    ];
  }

  if (action && action !== "ALL") {
    where.action = action;
  }

  // Fetch audit logs in transaction
  const [logs, filteredCount] = await prisma.$transaction([
    prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            name: true,
            role: true,
          },
        },
      },
      orderBy: { created_at: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  const totalPages = Math.ceil(filteredCount / pageSize);
  const startItem = filteredCount === 0 ? 0 : skip + 1;
  const endItem = Math.min(skip + pageSize, filteredCount);

  const getPageUrl = (targetPage: number) => {
    const params = new URLSearchParams();
    params.set("page", targetPage.toString());
    if (search) params.set("search", search);
    if (action) params.set("action", action);
    return `/admin/audit-logs?${params.toString()}`;
  };

  const formatTimestamp = (date: Date) => {
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const getActionLabel = (actionCode: string) => {
    return actionCode.replace(/_/g, " ");
  };

  return (
    <div className={`${styles.container} animate-fade`}>
      <div className={styles.titleArea}>
        <h1 className={styles.title}>System Audit Logs</h1>
      </div>

      <Suspense fallback={<div>Loading filters...</div>}>
        <AdminAuditFilter />
      </Suspense>

      <div className={styles.tableWrapper}>
        {logs.length === 0 ? (
          <div className={styles.emptyState}>
            <ClipboardList size={48} style={{ color: "var(--text-light)" }} />
            <span className={styles.emptyTitle}>No Logs Found</span>
            <span>There are no system audit logs matching these search parameters.</span>
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Timestamp</th>
                <th className={styles.th}>User</th>
                <th className={styles.th}>Action</th>
                <th className={styles.th}>Entity ID</th>
                <th className={styles.th}>Description</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className={styles.tr}>
                  <td className={`${styles.td} ${styles.timeCell}`}>{formatTimestamp(log.created_at)}</td>
                  <td className={`${styles.td} ${styles.userCell}`}>
                    {log.user.name} <span style={{ fontWeight: 400, fontSize: "0.75rem", color: "var(--text-light)" }}>({log.user.role})</span>
                  </td>
                  <td className={`${styles.td} ${styles.actionCell}`}>{getActionLabel(log.action)}</td>
                  <td className={`${styles.td} ${styles.entityCell}`}>
                    {log.entity_type}: {log.entity_id.slice(0, 8)}...
                  </td>
                  <td className={styles.td} style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>{log.description}</td>
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
