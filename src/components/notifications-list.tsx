"use client";

import React, { useState, useEffect } from "react";
import { formatIST } from "@/lib/date";
import { useRouter } from "next/navigation";
import styles from "./notifications-list.module.css";
import { Bell, CheckCheck, ShieldAlert } from "lucide-react";

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  complaint_id: string | null;
  created_at: string;
}

interface NotificationsListProps {
  role: "STUDENT" | "RC" | "ADMIN";
}

export default function NotificationsList({ role }: NotificationsListProps) {
  const router = useRouter();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = async () => {
    try {
      const response = await fetch("/api/notifications");
      if (!response.ok) {
        throw new Error("Failed to fetch notifications");
      }
      const data = await response.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (err) {
      console.error(err);
      setError("Failed to load notifications history.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchNotifications();
  }, []);

  const handleMarkAllRead = async () => {
    try {
      const response = await fetch("/api/notifications", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "host": window.location.host,
          "origin": window.location.origin,
          "referer": window.location.href,
        },
        body: JSON.stringify({}),
      });

      if (response.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
        setUnreadCount(0);
      }
    } catch (err) {
      console.error("Error marking all read:", err);
    }
  };

  const handleItemClick = async (notif: NotificationItem) => {
    // If unread, mark read on backend
    if (!notif.is_read) {
      try {
        await fetch("/api/notifications", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "host": window.location.host,
            "origin": window.location.origin,
            "referer": window.location.href,
          },
          body: JSON.stringify({ id: notif.id }),
        });

        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch (err) {
        console.error("Error marking notification read:", err);
      }
    }

    // Redirect to detailed complaint page based on role and complaint_id
    if (notif.complaint_id) {
      const targetDir = role === "STUDENT" ? "student" : "rc";
      router.push(`/${targetDir}/complaints/${notif.complaint_id}`);
    }
  };

  const formatDate = (dateStr: string) => {
    return formatIST(dateStr);
  };

  if (isLoading) {
    return (
      <div className={styles.container} style={{ textAlign: "center", padding: "40px" }}>
        <div className="spinner" style={{ margin: "0 auto 16px auto" }} />
        <span style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Loading notification history...</span>
      </div>
    );
  }

  return (
    <div className={`${styles.container} animate-fade`}>
      <div className={styles.header}>
        <h1 className={styles.title}>Notification History</h1>
        {unreadCount > 0 && (
          <button type="button" className={styles.markAllBtn} onClick={handleMarkAllRead}>
            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <CheckCheck size={16} />
              <span>Mark all read</span>
            </span>
          </button>
        )}
      </div>

      {error && (
        <div className={styles.errorBox}>
          <ShieldAlert size={18} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      <div className={styles.list}>
        {notifications.length === 0 ? (
          <div className={styles.emptyState}>
            <Bell size={48} style={{ color: "var(--text-light)" }} />
            <span className={styles.emptyTitle}>No Notifications</span>
            <span>You don&apos;t have any notification alerts yet.</span>
          </div>
        ) : (
          notifications.map((notif) => (
            <div
              key={notif.id}
              className={`${styles.item} ${!notif.is_read ? styles.itemUnread : ""}`}
              onClick={() => handleItemClick(notif)}
            >
              <div className={styles.itemHeader}>
                <span className={styles.itemTitle}>{notif.title}</span>
                <span className={styles.itemTime}>{formatDate(notif.created_at)}</span>
              </div>
              <span className={styles.itemMsg}>{notif.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
