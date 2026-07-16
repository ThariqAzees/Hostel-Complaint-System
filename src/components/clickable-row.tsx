"use client";

import React from "react";
import { useRouter } from "next/navigation";

interface ClickableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  href: string;
  children: React.ReactNode;
}

export default function ClickableRow({ href, children, ...props }: ClickableRowProps) {
  const router = useRouter();

  const handleRowClick = (e: React.MouseEvent<HTMLTableRowElement>) => {
    // Avoid triggering navigation when clicking on buttons or interactive badges
    const target = e.target as HTMLElement;
    if (
      target.tagName === "BUTTON" ||
      target.tagName === "A" ||
      target.closest("button") ||
      target.closest("a")
    ) {
      return;
    }
    router.push(href);
  };

  return (
    <tr {...props} onClick={handleRowClick}>
      {children}
    </tr>
  );
}
