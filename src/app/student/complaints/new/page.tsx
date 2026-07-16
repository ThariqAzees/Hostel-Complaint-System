import React from "react";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import ComplaintForm from "./complaint-form";
import styles from "./new-complaint.module.css";

export const dynamic = "force-dynamic";

export default async function NewComplaintPage() {
  const studentUser = await getSessionUser();

  if (!studentUser || studentUser.role !== "STUDENT") {
    redirect("/login");
  }

  // Double check must_change_password redirect
  if (studentUser.must_change_password) {
    redirect("/change-password");
  }

  const studentData = {
    name: studentUser.name,
    registrationNumber: studentUser.registration_number,
    roomNumber: studentUser.room_number,
  };

  return (
    <div className={`${styles.container} animate-fade`}>
      <ComplaintForm student={studentData} />
    </div>
  );
}
