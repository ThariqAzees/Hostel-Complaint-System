"use client";

import React, { useState } from "react";
import styles from "./change-password.module.css";
import { Check, X, ShieldAlert, KeyRound } from "lucide-react";
import { PasswordInput } from "@/components/password-input";

interface ChangePasswordFormProps {
  mustChangePassword: boolean;
}

export default function ChangePasswordForm({ mustChangePassword }: ChangePasswordFormProps) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Password rules
  const rules = {
    length: newPassword.length >= 8,
    uppercase: /[A-Z]/.test(newPassword),
    lowercase: /[a-z]/.test(newPassword),
    number: /[0-9]/.test(newPassword),
    special: /[^A-Za-z0-9]/.test(newPassword),
  };

  const getStrengthScore = () => {
    let score = 0;
    if (rules.length) score += 20;
    if (rules.uppercase) score += 20;
    if (rules.lowercase) score += 20;
    if (rules.number) score += 20;
    if (rules.special) score += 20;
    return score;
  };

  const getStrengthColor = (score: number) => {
    if (score <= 40) return "var(--danger)";
    if (score <= 80) return "var(--warning)";
    return "var(--success)";
  };

  const isFormValid = Object.values(rules).every(Boolean) && newPassword === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ newPassword, confirmPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to update password.");
        setIsLoading(false);
        return;
      }

      setSuccess("Password updated successfully! Redirecting...");
      setTimeout(() => {
        window.location.href = "/";
      }, 1500);
    } catch (err) {
      console.error(err);
      setError("A connection error occurred. Please try again.");
      setIsLoading(false);
    }
  };

  const score = getStrengthScore();

  return (
    <div className={styles.container}>
      <div className={`${styles.card} animate-scale`}>
        <div className={styles.header}>
          <div style={{ display: "inline-flex", padding: "12px", background: "var(--primary-light)", borderRadius: "50%", marginBottom: "16px", color: "var(--primary)" }}>
            <KeyRound size={28} />
          </div>
          <h1 className={styles.title}>
            {mustChangePassword ? "Secure Your Account" : "Change Password"}
          </h1>
          <p className={styles.subtitle}>
            {mustChangePassword 
              ? "This is your first login. You must change your temporary password to access the portal." 
              : "Update your account password to keep your account secure."}
          </p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.group}>
            <label htmlFor="newPassword" className={styles.label}>
              New Password
            </label>
            <PasswordInput
              id="newPassword"
              className={styles.input}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
              disabled={isLoading}
              required
              autoFocus
            />
          </div>

          {newPassword.length > 0 && (
            <div className={styles.strengthContainer}>
              <div className={styles.strengthBar}>
                <div
                  className={styles.strengthProgress}
                  style={{
                    width: `${score}%`,
                    backgroundColor: getStrengthColor(score),
                  }}
                />
              </div>

              <div className={styles.rules}>
                <div className={`${styles.rule} ${rules.length ? styles.ruleValid : ""}`}>
                  {rules.length ? <Check size={14} className={styles.ruleIcon} /> : <X size={14} className={styles.ruleIcon} />}
                  <span>At least 8 characters</span>
                </div>
                <div className={`${styles.rule} ${rules.uppercase ? styles.ruleValid : ""}`}>
                  {rules.uppercase ? <Check size={14} className={styles.ruleIcon} /> : <X size={14} className={styles.ruleIcon} />}
                  <span>At least one uppercase letter</span>
                </div>
                <div className={`${styles.rule} ${rules.lowercase ? styles.ruleValid : ""}`}>
                  {rules.lowercase ? <Check size={14} className={styles.ruleIcon} /> : <X size={14} className={styles.ruleIcon} />}
                  <span>At least one lowercase letter</span>
                </div>
                <div className={`${styles.rule} ${rules.number ? styles.ruleValid : ""}`}>
                  {rules.number ? <Check size={14} className={styles.ruleIcon} /> : <X size={14} className={styles.ruleIcon} />}
                  <span>At least one number (0-9)</span>
                </div>
                <div className={`${styles.rule} ${rules.special ? styles.ruleValid : ""}`}>
                  {rules.special ? <Check size={14} className={styles.ruleIcon} /> : <X size={14} className={styles.ruleIcon} />}
                  <span>At least one special character</span>
                </div>
              </div>
            </div>
          )}

          <div className={styles.group}>
            <label htmlFor="confirmPassword" className={styles.label}>
              Confirm Password
            </label>
            <PasswordInput
              id="confirmPassword"
              className={styles.input}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              disabled={isLoading}
              required
            />
          </div>

          {newPassword && confirmPassword && newPassword !== confirmPassword && (
            <div className={styles.errorBox}>
              <ShieldAlert size={18} style={{ flexShrink: 0 }} />
              <span>Passwords do not match.</span>
            </div>
          )}

          {error && (
            <div className={styles.errorBox}>
              <ShieldAlert size={18} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className={styles.successBox}>
              <Check size={18} style={{ flexShrink: 0 }} />
              <span>{success}</span>
            </div>
          )}

          <button
            type="submit"
            className={styles.button}
            disabled={isLoading || !isFormValid}
          >
            {isLoading ? (
              <div className={`${styles.loadingSpinner} spinner`} />
            ) : (
              "Update Password"
            )}
          </button>

          {!mustChangePassword && (
            <button
              type="button"
              onClick={() => window.location.href = "/"}
              style={{
                display: "block",
                width: "100%",
                background: "transparent",
                border: "1px solid var(--border-color, #e2e8f0)",
                color: "var(--text-secondary, #64748b)",
                marginTop: "12px",
                padding: "10px 16px",
                borderRadius: "var(--radius-md, 8px)",
                cursor: "pointer",
                fontWeight: "500",
                fontSize: "14px",
                textAlign: "center",
                transition: "all 0.2s"
              }}
            >
              Cancel and Return
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
