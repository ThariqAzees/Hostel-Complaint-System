import React from "react";
import type { Metadata } from "next";
import LoginForm from "./login-form";

export const metadata: Metadata = {
  title: "ECH Hostel Complaint Management System | Mantharai Block",
  description: "Hostel Complaint Management System for Mantharai Block residents of Engineering College Hostels (ECH), Anna University, providing complaint submission, tracking and resolution management.",
  alternates: {
    canonical: "/login",
  },
};

export default function LoginPage() {
  return <LoginForm />;
}
