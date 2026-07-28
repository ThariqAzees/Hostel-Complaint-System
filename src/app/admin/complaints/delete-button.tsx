"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, X, AlertTriangle } from "lucide-react";
import styles from "./complaints.module.css";

interface ComplaintData {
  id: string;
  complaint_code: string;
  title: string;
  studentName: string;
  roomNumber: string;
  category: string;
  status: string;
}

interface DeleteComplaintButtonProps {
  complaint: ComplaintData;
}

export default function DeleteComplaintButton({ complaint }: DeleteComplaintButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isClosed = complaint.status === "CLOSED";

  const handleOpen = () => {
    setConfirmText("");
    setError(null);
    setIsOpen(true);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setIsOpen(false);
    setConfirmText("");
    setError(null);
  };

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isClosed) return;
    if (confirmText !== "DELETE") return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/complaints/${complaint.id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete complaint.");
      }

      setIsOpen(false);
      router.refresh();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "An unexpected error occurred.";
      setError(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
        onClick={handleOpen}
        title="Delete Complaint"
      >
        <Trash2 size={16} />
      </button>

      {isOpen && (
        <div className={styles.modalOverlay} onClick={handleClose}>
          <div
            className={`${styles.modal} animate-scale`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle} style={{ color: "var(--danger)" }}>
                Delete Complaint?
              </h2>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={handleClose}
                disabled={isSubmitting}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleDelete}>
              <div className={styles.modalBody}>
                {/* Yellow info banner if status !== CLOSED */}
                {!isClosed && (
                  <div className={styles.infoBanner}>
                    <AlertTriangle size={18} className={styles.infoIcon} />
                    <span>
                      This complaint cannot be permanently deleted because it has not been closed yet.
                    </span>
                  </div>
                )}

                <div className={styles.warningMessage}>
                  You are about to permanently delete this complaint and all associated records.
                  <span className={styles.warningAlert}> This action cannot be undone.</span>
                </div>

                <div className={styles.detailGrid}>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Code:</span>
                    <span className={styles.detailValue}>{complaint.complaint_code}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Title:</span>
                    <span className={styles.detailValue}>{complaint.title}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Student:</span>
                    <span className={styles.detailValue}>{complaint.studentName}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Room Number:</span>
                    <span className={styles.detailValue}>Room {complaint.roomNumber}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Category:</span>
                    <span className={styles.detailValue}>{complaint.category}</span>
                  </div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Status:</span>
                    <span className={styles.detailValue} style={{ fontWeight: 700 }}>
                      {complaint.status}
                    </span>
                  </div>
                </div>

                {isClosed && (
                  <div className={styles.formGroup}>
                    <label htmlFor="confirm-input" className={styles.formLabel}>
                      Type <span className={styles.codeText}>DELETE</span> to confirm:
                    </label>
                    <input
                      type="text"
                      id="confirm-input"
                      className={styles.formInput}
                      placeholder="Type DELETE..."
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      disabled={isSubmitting}
                      required
                      autoComplete="off"
                    />
                  </div>
                )}

                {error && (
                  <div className={styles.errorBox}>
                    <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                    <span>{error}</span>
                  </div>
                )}
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnOutline}`}
                  onClick={handleClose}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`${styles.btn} ${styles.btnDanger}`}
                  disabled={!isClosed || confirmText !== "DELETE" || isSubmitting}
                >
                  {isSubmitting ? (
                    <div
                      className={styles.spinner}
                      style={{
                        width: "16px",
                        height: "16px",
                        border: "2px solid rgba(255,255,255,0.3)",
                        borderTopColor: "white",
                        borderRadius: "50%",
                      }}
                    />
                  ) : (
                    "Delete Complaint"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
