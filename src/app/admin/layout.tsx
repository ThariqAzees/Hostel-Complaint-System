import React from "react";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import Sidebar from "./sidebar";
import styles from "./admin-layout.module.css";
import { APP_CONFIG } from "@/config/app-config";

import { cookies } from "next/headers";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const user = await getSessionUser();

  // Redirect to login if session is invalid or user is not an admin
  if (!user || user.role !== "ADMIN") {
    const cookieStore = await cookies();
    if (cookieStore.has("hostel_session")) {
      redirect("/api/auth/logout");
    }
    redirect("/login");
  }

  // Double check must_change_password redirect
  if (user.must_change_password) {
    redirect("/change-password");
  }

  // Get current system time formatted nicely
  const getFormattedDate = () => {
    return new Date().toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className={styles.container}>
      <Sidebar user={{ name: user.name, role: user.role }} />
      <div className={styles.main}>
        <header className={styles.header}>
          <div className={styles.headerTitle}>
            {APP_CONFIG.BLOCK_NAME} Block Portal
          </div>
          <div className={styles.headerRight}>
            <div className={styles.dateDisplay}>{getFormattedDate()}</div>
          </div>
        </header>
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
