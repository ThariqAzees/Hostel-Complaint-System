"use client";

import React, { useState } from "react";
import styles from "./login.module.css";
import { ShieldAlert } from "lucide-react";
import { APP_CONFIG } from "@/config/app-config";

import Link from "next/link";

export default function LoginPage() {
  const [tab, setTab] = useState<"student" | "staff">("student");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Login failed. Please check your credentials.");
        setIsLoading(false);
        return;
      }

      // Successful login - redirect based on user role and password change status
      if (data.user.mustChangePassword) {
        window.location.href = "/change-password";
      } else {
        if (data.user.role === "ADMIN") {
          window.location.href = "/admin/dashboard";
        } else if (data.user.role === "RC") {
          window.location.href = "/rc/dashboard";
        } else if (data.user.role === "STUDENT") {
          window.location.href = "/student/dashboard";
        } else {
          setError("Unknown user role. Contact system administrator.");
          setIsLoading(false);
        }
      }
    } catch (err) {
      console.error(err);
      setError("A connection error occurred. Please try again.");
      setIsLoading(false);
    }
  };

  const handleTabChange = (selectedTab: "student" | "staff") => {
    setTab(selectedTab);
    setUsername("");
    setPassword("");
    setError(null);
  };

  return (
    <div className={styles.container}>
      <div className={`${styles.card} animate-scale`}>
        <div className={styles.header}>
          <div className={styles.logo}>ECH Portal</div>
          <h1 className={styles.title}>{APP_CONFIG.BLOCK_NAME} Block</h1>
          <p className={styles.subtitle}>{APP_CONFIG.APP_NAME}</p>
        </div>

        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tab} ${tab === "student" ? styles.activeTab : ""}`}
            onClick={() => handleTabChange("student")}
          >
            Student Login
          </button>
          <button
            type="button"
            className={`${styles.tab} ${tab === "staff" ? styles.activeTab : ""}`}
            onClick={() => handleTabChange("staff")}
          >
            Staff Login
          </button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.group}>
            <label htmlFor="username" className={styles.label}>
              {tab === "student" ? "Registration Number" : "Email Address / Username"}
              {tab === "student" && <span className={styles.labelTip}>10 Digits</span>}
            </label>
            <input
              type="text"
              id="username"
              className={styles.input}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={tab === "student" ? "e.g., 2023105001" : "e.g., admin@ech.com"}
              disabled={isLoading}
              required
              autoFocus
            />
          </div>

          <div className={styles.group}>
            <label htmlFor="password" className={styles.label}>
              Password
              {tab === "student" && <span className={styles.labelTip}>Initial: DOB (DDMMYY)</span>}
            </label>
            <input
              type="password"
              id="password"
              className={styles.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={tab === "student" ? "e.g., 150305" : "••••••••"}
              disabled={isLoading}
              required
            />
          </div>

          {error && (
            <div className={styles.errorBox}>
              <ShieldAlert size={18} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <button type="submit" className={styles.button} disabled={isLoading}>
            {isLoading ? (
              <div className={`${styles.loadingSpinner} spinner`} />
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        <div className={styles.footerText}>
          {APP_CONFIG.ORGANIZATION_NAME} <br />
          <strong>{APP_CONFIG.INSTITUTION_NAME}</strong>
        </div>
      </div>
    </div>
  );
}
