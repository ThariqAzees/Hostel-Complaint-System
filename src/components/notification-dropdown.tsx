"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import styles from "./notification-dropdown.module.css";

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  complaint_id: string | null;
  created_at: string;
}

interface NotificationDropdownProps {
  role: "STUDENT" | "RC" | "ADMIN";
}

export default function NotificationDropdown({ role }: NotificationDropdownProps) {
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const isSessionValidRef = useRef(true);

  // Fetch notifications from API
  const fetchNotifications = async () => {
    if (!isSessionValidRef.current) return;
    try {
      const response = await fetch("/api/notifications");
      if (response.status === 401) {
        isSessionValidRef.current = false;
        return;
      }
      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {
      // Silent catch to prevent console errors during server boot/rebuilds
    }
  };

  useEffect(() => {
    // Fetch once on mount
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchNotifications();

    const interval = setInterval(() => {
      if (document.visibilityState === "visible" && isSessionValidRef.current) {
        fetchNotifications();
      }
    }, 30000); // Poll every 30 seconds

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && isSessionValidRef.current) {
        fetchNotifications();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleToggle = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      fetchNotifications();
    }
  };

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
    setIsOpen(false);

    // If unread, mark it as read on the backend
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

        // Update local state
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
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const viewAllHref = role === "STUDENT" ? "/student/notifications" : "/rc/notifications";
  const alignmentClass = role === "RC" ? styles.dropdownRC : styles.dropdownSTUDENT;

  return (
    <div className={styles.wrapper} ref={dropdownRef}>
      <button
        type="button"
        className={styles.bellBtn}
        onClick={handleToggle}
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-controls="notification-dropdown-menu"
        aria-label="Toggle notifications menu"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span key={unreadCount} className={styles.badge}>
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          id="notification-dropdown-menu"
          role="region"
          aria-label="Notifications"
          className={`${styles.dropdown} ${alignmentClass}`}
        >
          <div className={styles.header}>
            <span className={styles.title}>Notifications</span>
            {unreadCount > 0 && (
              <button type="button" className={styles.markAllBtn} onClick={handleMarkAllRead}>
                Mark all read
              </button>
            )}
          </div>

          <div className={styles.list}>
            {notifications.length === 0 ? (
              <div className={styles.emptyState}>No notifications yet.</div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`${styles.item} ${!notif.is_read ? styles.itemUnread : ""}`}
                  onClick={() => handleItemClick(notif)}
                >
                  <span className={styles.itemTitle}>{notif.title}</span>
                  <span className={styles.itemMsg}>{notif.message}</span>
                  <span className={styles.itemTime}>{formatDate(notif.created_at)}</span>
                </div>
              ))
            )}
          </div>

          <div className={styles.footer}>
            <Link href={viewAllHref} className={styles.viewAllLink} onClick={() => setIsOpen(false)}>
              View all notification history
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
