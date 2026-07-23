import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://ech-hostel-complaint-app.purplebeach-66ccd89a.centralindia.azurecontainerapps.io"),
  title: "Hostel Complaint Management System - ECH",
  description: "Mantharai Block Complaint Management Portal - Engineering College Hostels, Anna University",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
