import React from "react";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import NotificationsList from "@/components/notifications-list";

export const dynamic = "force-dynamic";

export default async function StudentNotificationsPage() {
  const studentUser = await getSessionUser();
  if (!studentUser || studentUser.role !== "STUDENT") {
    redirect("/login");
  }

  // Mandatory password change check
  if (studentUser.must_change_password) {
    redirect("/change-password");
  }

  return <NotificationsList role="STUDENT" />;
}
