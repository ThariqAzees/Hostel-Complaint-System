import React from "react";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import NotificationsList from "@/components/notifications-list";

export const dynamic = "force-dynamic";

export default async function RcNotificationsPage() {
  const rcUser = await getSessionUser();
  if (!rcUser || rcUser.role !== "RC") {
    redirect("/login");
  }

  // Mandatory password change check
  if (rcUser.must_change_password) {
    redirect("/change-password");
  }

  return <NotificationsList role="RC" />;
}
