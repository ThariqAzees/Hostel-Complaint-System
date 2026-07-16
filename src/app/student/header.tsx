"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./student-layout.module.css";
import { LayoutDashboard, PlusCircle, LogOut } from "lucide-react";
import { APP_CONFIG } from "@/config/app-config";
import NotificationDropdown from "@/components/notification-dropdown";

export default function StudentHeader() {
  const pathname = usePathname();

  const handleLogout = async () => {
    if (!confirm("Are you sure you want to log out?")) return;

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        window.location.href = "/login";
      } else {
        alert("Logout failed. Please try again.");
      }
    } catch (err) {
      console.error("Logout error:", err);
      alert("A connection error occurred during logout.");
    }
  };

  const navItems = [
    { name: "Dashboard", href: "/student/dashboard", icon: LayoutDashboard },
    { name: "Raise Complaint", href: "/student/complaints/new", icon: PlusCircle },
  ];

  return (
    <header className={styles.header}>
      <div className={styles.navContainer}>
        <div className={styles.logoArea}>
          <div className={styles.logoText}>ECH Student</div>
          <span className={styles.logoSub}>| {APP_CONFIG.BLOCK_NAME} Block</span>
        </div>

        <nav className={styles.navLinks}>
          <NotificationDropdown role="STUDENT" />
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navLink} ${isActive ? styles.activeLink : ""}`}
              >
                {item.name}
              </Link>
            );
          })}
          
          <button type="button" className={styles.logoutBtn} onClick={handleLogout}>
            <LogOut size={16} />
            <span className={styles.logoutText}>Log Out</span>
          </button>
        </nav>
      </div>
    </header>
  );
}
