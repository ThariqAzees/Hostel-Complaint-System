import React from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import StudentHeader from "./header";
import styles from "./student-layout.module.css";
import { APP_CONFIG } from "@/config/app-config";

import { cookies } from "next/headers";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

interface StudentLayoutProps {
  children: React.ReactNode;
}

export default async function StudentLayout({ children }: StudentLayoutProps) {
  const user = await getSessionUser();

  // Redirect if session is invalid or user is not a student
  if (!user || user.role !== "STUDENT") {
    const cookieStore = await cookies();
    if (cookieStore.has("hostel_session")) {
      redirect("/api/auth/logout");
    }
    redirect("/login");
  }

  // Redirect to change password if required
  if (user.must_change_password) {
    redirect("/change-password");
  }

  return (
    <div className={styles.container}>
      <StudentHeader />
      <main className={styles.main}>{children}</main>
      <footer className={styles.footer}>
        <div className={styles.footerTitle}>{APP_CONFIG.ORGANIZATION_NAME}</div>
        <div>{APP_CONFIG.INSTITUTION_NAME} • {APP_CONFIG.APP_NAME}</div>
      </footer>
    </div>
  );
}
