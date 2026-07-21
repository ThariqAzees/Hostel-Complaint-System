"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./rc-layout.module.css";
import { LayoutDashboard, Bell, LogOut, Menu, X, KeyRound } from "lucide-react";
import { APP_CONFIG } from "@/config/app-config";
import NotificationDropdown from "@/components/notification-dropdown";

export default function RcSidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

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
    { name: "Dashboard", href: "/rc/dashboard", icon: LayoutDashboard },
    { name: "Notifications", href: "/rc/notifications", icon: Bell },
    { name: "Change Password", href: "/change-password", icon: KeyRound },
  ];

  const toggleSidebar = () => setIsOpen(!isOpen);

  return (
    <>
      {/* Mobile Header Bar */}
      <div className={styles.mobileHeader}>
        <button type="button" className={styles.menuBtn} onClick={toggleSidebar}>
          <Menu size={24} />
        </button>
        <div className={styles.logoText}>
          ECH RC <span className={styles.logoSub}>| {APP_CONFIG.BLOCK_NAME}</span>
        </div>
        <NotificationDropdown role="RC" />
      </div>

      {/* Overlay to close drawer on mobile */}
      <div 
        className={`${styles.sidebarOverlay} ${isOpen ? styles.sidebarOverlayOpen : ""}`} 
        onClick={toggleSidebar}
      />

      {/* Sidebar Panel */}
      <aside className={`${styles.sidebar} ${isOpen ? styles.sidebarOpen : ""}`}>
        <div className={styles.sidebarHeader}>
          <div className={styles.logoText}>
            ECH RC <span className={styles.logoSub}>| {APP_CONFIG.BLOCK_NAME}</span>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "8px" }}>
            <NotificationDropdown role="RC" />
            {isOpen && (
              <button 
                type="button" 
                className={styles.menuBtn} 
                onClick={toggleSidebar}
              >
                <X size={20} />
              </button>
            )}
          </div>
        </div>

        <nav className={styles.sidebarNav}>
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navLink} ${isActive ? styles.activeLink : ""}`}
                onClick={() => setIsOpen(false)}
              >
                <Icon size={18} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className={styles.sidebarFooter}>
          <button type="button" className={styles.logoutBtn} onClick={handleLogout}>
            <LogOut size={18} />
            <span>Log Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
