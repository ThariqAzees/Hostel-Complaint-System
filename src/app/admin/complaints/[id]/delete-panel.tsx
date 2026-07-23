"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../../../student/complaints/[id]/details.module.css";
import { Trash2, X, AlertTriangle } from "lucide-react";

interface DeletePanelProps {
  complaintId: string;
  complaintCode: string;
  title: string;
  studentName: string;
  registrationNumber: string;
}

export default function DeletePanel({
  complaintId,
  complaintCode,
  title,
  studentName,
  registrationNumber,
}: DeletePanelProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleDelete = async () => {
    if (confirmText !== "DELETE") return;

    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/admin/complaints/${complaintId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to delete complaint.");
        setIsSubmitting(false);
        return;
      }

      setIsOpen(false);
      setConfirmText("");
      setIsSubmitting(false);
      router.prefetch("/admin/complaints");
      router.refresh();
      router.push("/admin/complaints");
    } catch (err) {
      console.error(err);
      setError("A connection error occurred. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className={styles.confirmationPanel} style={{ background: "var(--card-bg)" }}>
        <h3 className={styles.confirmTitle} style={{ color: "var(--danger)" }}>
          Administrative Actions
        </h3>
        <p className={styles.confirmSub}>
          As an Admin, you can permanently delete this complaint and all its history if it was submitted accidentally or incorrectly.
        </p>
        <button
          type="button"
          className={styles.btnConfirm}
          onClick={() => {
            setIsOpen(true);
            setConfirmText("");
            setError(null);
          }}
          style={{ background: "var(--danger)", width: "100%", maxWidth: "320px", marginTop: "12px" }}
        >
          <Trash2 size={18} />
          <span>Delete Complaint</span>
        </button>
      </div>

      {isOpen && (
        <div className={styles.modalOverlay} style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.4)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          padding: "16px"
        }}>
          <div className="animate-scale" style={{
            background: "var(--card-bg)",
            border: "1px solid var(--card-border)",
            borderRadius: "var(--radius-md)",
            width: "100%",
            maxWidth: "450px",
            boxShadow: "var(--shadow-lg)",
            overflow: "hidden"
          }}>
            {/* Modal Header */}
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "16px 20px",
              borderBottom: "1px solid var(--card-border)"
            }}>
              <h2 style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--danger)", margin: 0 }}>
                Delete Complaint Permanently?
              </h2>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setConfirmText("");
                  setError(null);
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-light)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "4px",
                  borderRadius: "50%"
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "20px" }}>
              <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", marginBottom: "12px", lineHeight: "1.4" }}>
                You are about to permanently delete:
              </p>
              
              <div style={{
                background: "var(--background)",
                border: "1px solid var(--card-border)",
                padding: "12px",
                borderRadius: "var(--radius-sm)",
                marginBottom: "16px"
              }}>
                <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--primary)" }}>
                  {complaintCode}
                </div>
                <div style={{ fontWeight: 600, fontSize: "1rem", marginTop: "2px" }}>
                  {title}
                </div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-light)", marginTop: "4px" }}>
                  Student: {studentName} ({registrationNumber})
                </div>
              </div>

              <p style={{ fontSize: "0.85rem", color: "var(--danger)", fontWeight: 600, marginBottom: "16px", lineHeight: "1.4" }}>
                Warning: Deleting this complaint will permanently remove all associated timeline history and related notifications. This action cannot be undone.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "16px" }}>
                <label htmlFor="comp-delete-input" style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-light)" }}>
                  Type <span style={{ fontFamily: "monospace", fontWeight: 700, color: "var(--danger)" }}>DELETE</span> to confirm:
                </label>
                <input
                  id="comp-delete-input"
                  type="text"
                  placeholder="Type DELETE..."
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  disabled={isSubmitting}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--card-border)",
                    background: "var(--background)",
                    color: "var(--foreground)",
                    fontSize: "0.9rem"
                  }}
                />
              </div>

              {error && (
                <div className="error-box" style={{
                  display: "flex",
                  gap: "8px",
                  alignItems: "center",
                  padding: "10px 12px",
                  borderRadius: "var(--radius-sm)",
                  background: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid rgba(239, 68, 68, 0.2)",
                  color: "var(--danger)",
                  fontSize: "0.85rem",
                  marginTop: "12px"
                }}>
                  <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                  <span>{error}</span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              display: "flex",
              gap: "12px",
              padding: "16px 20px",
              borderTop: "1px solid var(--card-border)",
              background: "rgba(0, 0, 0, 0.02)"
            }}>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  setConfirmText("");
                  setError(null);
                }}
                disabled={isSubmitting}
                style={{
                  flex: 1,
                  padding: "8px 16px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--card-border)",
                  background: "transparent",
                  color: "var(--text-muted)",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontSize: "0.9rem"
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={confirmText !== "DELETE" || isSubmitting}
                style={{
                  flex: 1,
                  padding: "8px 16px",
                  borderRadius: "var(--radius-sm)",
                  border: "none",
                  background: confirmText === "DELETE" ? "var(--danger)" : "rgba(239, 68, 68, 0.5)",
                  color: "white",
                  fontWeight: 600,
                  cursor: confirmText === "DELETE" ? "pointer" : "not-allowed",
                  fontSize: "0.9rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px"
                }}
              >
                {isSubmitting ? (
                  <div className="spinner" style={{
                    width: "16px",
                    height: "16px",
                    border: "2px solid rgba(255,255,255,0.3)",
                    borderTopColor: "white",
                    borderRadius: "50%"
                  }} />
                ) : (
                  <>
                    <Trash2 size={16} />
                    <span>Delete Permanently</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
