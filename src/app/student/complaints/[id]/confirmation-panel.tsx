"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./details.module.css";
import { X, ShieldAlert } from "lucide-react";

interface ConfirmationPanelProps {
  complaintId: string;
  status: string;
  createdAt: string;
}

export default function ConfirmationPanel({ complaintId, createdAt }: ConfirmationPanelProps) {
  const router = useRouter();
  const [remarks, setRemarks] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAction = async (action: "STUDENT_REOPEN") => {
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch(`/api/student/complaints/${complaintId}/transition`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          remarks: remarks.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to update complaint status.");
        setIsLoading(false);
        return;
      }

      router.prefetch("/student/dashboard");
      router.refresh();
      router.push("/student/dashboard");
    } catch (err) {
      console.error("Action submit error:", err);
      setError("A connection error occurred. Please try again.");
      setIsLoading(false);
    }
  };

  // Reopening check (2 days from creation)
  const creationTime = new Date(createdAt).getTime();
  const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
  // eslint-disable-next-line react-hooks/purity
  const canReopen = Date.now() >= creationTime + twoDaysMs;

  const getDaysLeftToReopen = () => {
    // eslint-disable-next-line react-hooks/purity
    const diff = (creationTime + twoDaysMs) - Date.now();
    const hours = Math.ceil(diff / (1000 * 60 * 60));
    if (hours > 24) {
      return `${Math.ceil(hours / 24)} days`;
    }
    return `${hours} hours`;
  };

  return (
    <div className={styles.confirmationPanel}>
      <div>
        <h3 className={styles.confirmTitle}>Report Unresolved Issue</h3>
        <p className={styles.confirmSub}>
          If the maintenance work is still unresolved, you can reopen this complaint. Please note that reopening is only permitted 2 days after the complaint was raised.
        </p>
      </div>

      <textarea
        className={styles.remarksTextarea}
        placeholder="Add remarks explaining why the issue is still unresolved (required)..."
        value={remarks}
        onChange={(e) => setRemarks(e.target.value)}
        maxLength={300}
        disabled={isLoading}
      />

      {error && (
        <div className="error-box" style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px" }}>
          <ShieldAlert size={16} />
          <span>{error}</span>
        </div>
      )}

      <div className={styles.confirmActions} style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
        <div style={{ display: "flex", gap: "12px", width: "100%" }}>
          {canReopen ? (
            <button
              type="button"
              className={`${styles.btnConfirm} ${styles.btnConfirmDanger}`}
              onClick={() => {
                if (!remarks.trim()) {
                  setError("Please enter remarks explaining why the issue is still unresolved.");
                  return;
                }
                handleAction("STUDENT_REOPEN");
              }}
              disabled={isLoading}
              style={{ flex: 1 }}
            >
              <X size={18} />
              <span>Reopen Complaint</span>
            </button>
          ) : (
            <button
              type="button"
              className={`${styles.btnConfirm} ${styles.btnConfirmDanger}`}
              disabled={true}
              style={{ flex: 1, opacity: 0.5, cursor: "not-allowed" }}
              title={`Reopening will be available in ${getDaysLeftToReopen()}`}
            >
              <X size={18} />
              <span>Reopen (Locked)</span>
            </button>
          )}
        </div>

        {!canReopen && (
          <p style={{ fontSize: "0.8rem", color: "var(--text-light)", fontStyle: "italic", marginTop: "4px" }}>
            This complaint can be reopened after 2 days if the issue is still unresolved.
          </p>
        )}
      </div>
    </div>
  );
}
