"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./details.module.css";
import { Check, X, ShieldAlert } from "lucide-react";

interface ConfirmationPanelProps {
  complaintId: string;
}

export default function ConfirmationPanel({ complaintId }: ConfirmationPanelProps) {
  const router = useRouter();
  const [remarks, setRemarks] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAction = async (action: "STUDENT_CONFIRM_FIXED" | "STUDENT_REJECT_FIXED") => {
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

      // Prefetch dashboard and redirect
      router.prefetch("/student/dashboard");
      router.refresh();
      router.push("/student/dashboard");
    } catch (err) {
      console.error("Action submit error:", err);
      setError("A connection error occurred. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.confirmationPanel}>
      <div>
        <h3 className={styles.confirmTitle}>Action Required: Verify Fix</h3>
        <p className={styles.confirmSub}>
          The Residential Counselor has marked this complaint as resolved. Please test the repair and confirm if it is fixed. If the problem persists, mark it as &quot;Not Fixed&quot; to reopen it.
        </p>
      </div>

      <textarea
        className={styles.remarksTextarea}
        placeholder="Add any remarks or feedback (optional)..."
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

      <div className={styles.confirmActions}>
        <button
          type="button"
          className={`${styles.btnConfirm} ${styles.btnConfirmSuccess}`}
          onClick={() => handleAction("STUDENT_CONFIRM_FIXED")}
          disabled={isLoading}
        >
          <Check size={18} />
          <span>Fixed</span>
        </button>
        <button
          type="button"
          className={`${styles.btnConfirm} ${styles.btnConfirmDanger}`}
          onClick={() => handleAction("STUDENT_REJECT_FIXED")}
          disabled={isLoading}
        >
          <X size={18} />
          <span>Not Fixed</span>
        </button>
      </div>
    </div>
  );
}
