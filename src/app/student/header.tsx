"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./student-layout.module.css";
import { LayoutDashboard, PlusCircle, LogOut, KeyRound, Menu, X } from "lucide-react";
import { APP_CONFIG } from "@/config/app-config";
import NotificationDropdown from "@/components/notification-dropdown";

export default function StudentHeader() {
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
    { name: "Dashboard", href: "/student/dashboard", icon: LayoutDashboard },
    { name: "Raise Complaint", href: "/student/complaints/new", icon: PlusCircle },
    { name: "Change Password", href: "/change-password", icon: KeyRound },
  ];

  const toggleMenu = () => setIsOpen(!isOpen);

  return (
    <header className={styles.header}>
      <div className={styles.navContainer}>
        <div className={styles.logoArea}>
          <div className={styles.logoText}>ECH Student</div>
          <span className={styles.logoSub}>| {APP_CONFIG.BLOCK_NAME} Block</span>
        </div>

        {/* Mobile view controls */}
        <div className={styles.mobileRight}>
          <NotificationDropdown role="STUDENT" />
          <button type="button" className={styles.menuBtn} onClick={toggleMenu} aria-label="Toggle menu">
            {isOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Desktop view navigation */}
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

      {/* Mobile navigation drawer */}
      <div 
        className={`${styles.sidebarOverlay} ${isOpen ? styles.sidebarOverlayOpen : ""}`} 
        onClick={toggleMenu}
      />
      <aside className={`${styles.mobileDrawer} ${isOpen ? styles.drawerOpen : ""}`}>
        <nav className={styles.drawerNav}>
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.drawerLink} ${isActive ? styles.activeDrawerLink : ""}`}
                onClick={() => setIsOpen(false)}
              >
                <Icon size={18} />
                <span>{item.name}</span>
              </Link>
            );
          })}
          
          <button type="button" className={styles.drawerLogoutBtn} onClick={handleLogout}>
            <LogOut size={18} />
            <span>Log Out</span>
          </button>
        </nav>
      </aside>
    </header>
  );
}
