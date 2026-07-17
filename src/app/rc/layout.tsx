import React from "react";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import RcSidebar from "./sidebar";
import styles from "./rc-layout.module.css";

import { cookies } from "next/headers";

interface RcLayoutProps {
  children: React.ReactNode;
}

export default async function RcLayout({ children }: RcLayoutProps) {
  const user = await getSessionUser();

  // Redirect to login if session is invalid or user is not RC
  if (!user || user.role !== "RC") {
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
      <RcSidebar />
      <div className={styles.mainWrapper}>
        <main className={styles.main}>{children}</main>
      </div>
    </div>
  );
}
