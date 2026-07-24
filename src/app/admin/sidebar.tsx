"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./admin-layout.module.css";
import { LayoutDashboard, Users, AlertCircle, ClipboardList, LogOut, KeyRound, Menu, X, UserCheck } from "lucide-react";

interface SidebarProps {
  user: {
    name: string;
    role: string;
  };
}

export default function Sidebar({ user }: SidebarProps) {
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

  // Get initials for profile avatar
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  const navItems = [
    { name: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
    { name: "Students", href: "/admin/students", icon: Users },
    { name: "RC Management", href: "/admin/rcs", icon: UserCheck },
    { name: "Complaints Queue", href: "/admin/complaints", icon: AlertCircle },
    { name: "Audit Logs", href: "/admin/audit-logs", icon: ClipboardList },
    { name: "Change Password", href: "/change-password", icon: KeyRound },
  ];

  const toggleSidebar = () => setIsOpen(!isOpen);

  return (
    <>
      {/* Mobile Header Bar */}
      <div className={styles.mobileHeader}>
        <button type="button" className={styles.menuBtn} onClick={toggleSidebar} aria-label="Toggle menu">
          <Menu size={24} />
        </button>
        <div className={styles.logoText}>
          ECH Portal <span className={styles.logoSub}>Admin</span>
        </div>
        <div style={{ width: "24px" }} />
      </div>

      {/* Overlay to close drawer on mobile */}
      <div 
        className={`${styles.sidebarOverlay} ${isOpen ? styles.sidebarOverlayOpen : ""}`} 
        onClick={toggleSidebar}
      />

      {/* Sidebar Panel */}
      <aside className={`${styles.sidebar} ${isOpen ? styles.sidebarOpen : ""}`}>
        <div className={styles.sidebarHeader}>
          <div className={styles.logoArea}>
            <div className={styles.logoText}>ECH Portal</div>
            <div className={styles.logoSub}>Mantharai Block Admin</div>
          </div>
          {isOpen && (
            <button 
              type="button" 
              className={styles.menuBtn} 
              onClick={toggleSidebar}
              aria-label="Close menu"
              style={{ marginLeft: "auto" }}
            >
              <X size={20} />
            </button>
          )}
        </div>

        <nav className={styles.nav}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
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

        <div>
          <div className={styles.userBadge}>
            <div className={styles.avatar}>{getInitials(user.name)}</div>
            <div className={styles.userInfo}>
              <span className={styles.userName}>{user.name}</span>
              <span className={styles.userRole}>{user.role}</span>
            </div>
          </div>

          <button type="button" className={styles.logoutBtn} onClick={handleLogout}>
            <LogOut size={18} />
            <span>Log Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
