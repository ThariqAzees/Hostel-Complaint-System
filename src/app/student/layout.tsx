import React from "react";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import StudentHeader from "./header";
import styles from "./student-layout.module.css";
import { APP_CONFIG } from "@/config/app-config";

interface StudentLayoutProps {
  children: React.ReactNode;
}

export default async function StudentLayout({ children }: StudentLayoutProps) {
  const user = await getSessionUser();

  // Redirect if session is invalid or user is not a student
  if (!user || user.role !== "STUDENT") {
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
