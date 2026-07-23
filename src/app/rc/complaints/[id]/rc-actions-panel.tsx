"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./rc-details.module.css";
import { Check, Clipboard, ShieldAlert } from "lucide-react";
import { ComplaintStatus } from "@/generated/prisma/enums";

interface RcActionsPanelProps {
  complaintId: string;
  status: ComplaintStatus;
}

export default function RcActionsPanel({ complaintId, status }: RcActionsPanelProps) {
  const router = useRouter();
  const [remarks, setRemarks] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAction = async (action: string) => {
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch(`/api/rc/complaints/${complaintId}/transition`, {
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
        setError(data.error || "Failed to execute complaint transition.");
        setIsLoading(false);
        return;
      }

      router.prefetch("/rc/dashboard");
      router.refresh();
      router.push("/rc/dashboard");
    } catch (err) {
      console.error("RC Action submit error:", err);
      setError("A connection error occurred. Please try again.");
      setIsLoading(false);
    }
  };

  // Determine what button to render based on status
  const renderActions = () => {
    switch (status) {
      case "SUBMITTED":
      case "REOPENED":
        return (
          <div className={styles.confirmationPanel} style={{ background: "var(--card-bg)" }}>
            <h3 className={styles.confirmTitle}>Acknowledge Complaint</h3>
            <p className={styles.confirmSub}>
              Acknowledge that this complaint has been logged and queued for inspection.
            </p>
            <textarea
              className={styles.remarksTextarea}
              placeholder="Add optional remarks (e.g. Scheduled for inspection tomorrow)..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              disabled={isLoading}
              maxLength={300}
            />
            <button
              type="button"
              className={`${styles.btnConfirm} ${styles.btnConfirmSuccess}`}
              onClick={() => handleAction("ACKNOWLEDGE")}
              disabled={isLoading}
              style={{ background: "#4f46e5" }} /* Indigo for acknowledge */
            >
              <Clipboard size={18} />
              <span>Acknowledge Receipt</span>
            </button>
          </div>
        );
      case "AWAITING_RC_VERIFICATION":
        return (
          <div className={styles.confirmationPanel} style={{ background: "var(--card-bg)" }}>
            <h3 className={styles.confirmTitle}>Final Verification & Closure</h3>
            <p className={styles.confirmSub}>
              Verify that the repair works are fully completed and close the complaint. Final closure logs resolved timestamps.
            </p>
            <textarea
              className={styles.remarksTextarea}
              placeholder="Provide final remarks (e.g. Verified room switch working. Closed.)..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              disabled={isLoading}
              maxLength={300}
            />
            <button
              type="button"
              className={`${styles.btnConfirm} ${styles.btnConfirmSuccess}`}
              onClick={() => handleAction("RC_VERIFY_CLOSE")}
              disabled={isLoading}
              style={{ background: "#059669" }} /* Green for verify and close */
            >
              <Check size={18} />
              <span>Verify & Close Complaint</span>
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div style={{ marginBottom: "32px" }}>
      {error && (
        <div className="error-box" style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "16px" }}>
          <ShieldAlert size={16} />
          <span>{error}</span>
        </div>
      )}
      {renderActions()}
    </div>
  );
}
