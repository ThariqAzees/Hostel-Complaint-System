import React from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import styles from "../../../student/complaints/[id]/details.module.css";
import RcActionsPanel from "./rc-actions-panel";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

interface RcComplaintDetailsPageProps {
  params: Promise<{ id: string }>;
}

export default async function RcComplaintDetailsPage({ params }: RcComplaintDetailsPageProps) {
  const rcUser = await getSessionUser();
  if (!rcUser || rcUser.role !== "RC") {
    redirect("/login");
  }

  // Await dynamic parameters (Next.js 15+)
  const { id } = await params;

  // Retrieve complaint details and updates (newest first)
  const complaint = await prisma.complaint.findUnique({
    where: { id },
    include: {
      student: true,
      updates: {
        include: {
          updater: true,
        },
        orderBy: {
          created_at: "desc",
        },
      },
    },
  });

  if (!complaint) {
    notFound();
  }

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
      case "ACKNOWLEDGED": return "Acknowledged (Legacy)";
      case "IN_PROGRESS": return "In Progress";
      case "AWAITING_STUDENT_CONFIRMATION": return "Awaiting RC Verification (Legacy)";
      case "AWAITING_RC_VERIFICATION": return "Awaiting My Verification";
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
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className={`${styles.container} animate-fade`}>
      <Link href="/rc/dashboard" className={styles.backBtn}>
        <ArrowLeft size={16} />
        <span>Back to RC Dashboard</span>
      </Link>

      <div className={styles.card}>
        <div className={styles.header}>
          <div>
            <span className={styles.code}>{complaint.complaint_code}</span>
            <h1 className={styles.title}>{complaint.title}</h1>
          </div>
          <span className={`${styles.badge} ${getStatusBadgeClass(complaint.status)}`} style={{ padding: "6px 12px", fontSize: "0.8rem" }}>
            {getStatusLabel(complaint.status)}
          </span>
        </div>

        {/* Meta summary card */}
        <div className={styles.metaGrid}>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Student Name</span>
            <span className={styles.metaValue}>{complaint.student.name}</span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Registration / Room</span>
            <span className={styles.metaValue}>
              {complaint.student.registration_number} • Room {complaint.student.room_number || "—"}
            </span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Category</span>
            <span className={styles.metaValue}>{complaint.category}</span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Submitted On</span>
            <span className={styles.metaValue}>{formatDate(complaint.created_at)}</span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Last Updated</span>
            <span className={styles.metaValue}>{formatDate(complaint.updated_at)}</span>
          </div>
        </div>

        <div className={styles.descriptionSection}>
          <h2 className={styles.descriptionTitle}>Description</h2>
          <p className={styles.descriptionText}>{complaint.description}</p>
        </div>

        {/* Image Attachment */}
        {complaint.image_url && (
          <div className={styles.imageSection}>
            <h2 className={styles.descriptionTitle}>Attached Photo</h2>
            <div className={styles.imageContainer}>
              <img
                src={`/api/complaints/${complaint.id}/image`}
                alt="Complaint Attachment"
                className={styles.complaintImage}
              />
            </div>
          </div>
        )}
      </div>

      {/* RC central transition actions panel */}
      <RcActionsPanel complaintId={complaint.id} status={complaint.status} />

      {/* Timeline Updates */}
      <div className={styles.timelineCard}>
        <h2 className={styles.timelineTitle}>Complaint History & Timeline</h2>
        <div className={styles.timelineList}>
          {complaint.updates.map((update, idx) => (
            <div key={update.id} className={styles.timelineNode}>
              <div className={`${styles.timelineDot} ${idx === 0 ? styles.timelineDotActive : ""}`} />
              <div className={styles.timelineContent}>
                <div className={styles.timelineHeader}>
                  <span className={styles.timelineStatus}>
                    Status changed to <span className={`${styles.badge} ${getStatusBadgeClass(update.new_status)}`}>
                      {getStatusLabel(update.new_status)}
                    </span>
                  </span>
                  <span className={styles.timelineTime}>{formatDate(update.created_at)}</span>
                </div>
                <span className={styles.timelineUser}>
                  Updated by: <strong>{update.updater.name}</strong> ({update.updater.role})
                </span>
                {update.remarks && (
                  <p className={styles.timelineRemarks}>{update.remarks}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
