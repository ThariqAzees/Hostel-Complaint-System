import React from "react";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import ChangePasswordForm from "./change-password-form";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  let mustChangePassword = false;
  
  try {
    const user = await getSessionUser();

    // Redirect to login if user is not authenticated
    if (!user) {
      redirect("/login");
    }

    mustChangePassword = user.must_change_password;
  } catch (err: unknown) {
    if (isRedirectError(err)) {
      throw err;
    }
    
    console.error("CRASH IN SERVER RENDER ChangePasswordPage:", err);
    throw err;
  }

  return <ChangePasswordForm mustChangePassword={mustChangePassword} />;
}
