/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./complaints.module.css";

export default function AdminComplaintsFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [status, setStatus] = useState(searchParams.get("status") || "ALL");
  const [category, setCategory] = useState(searchParams.get("category") || "ALL");

  useEffect(() => {
    setSearch(searchParams.get("search") || "");
    setStatus(searchParams.get("status") || "ALL");
    setCategory(searchParams.get("category") || "ALL");
  }, [searchParams]);

  const updateParams = (newSearch: string, newStatus: string, newCategory: string) => {
    const params = new URLSearchParams();
    params.set("page", "1");

    if (newSearch.trim()) {
      params.set("search", newSearch.trim());
    }
    if (newStatus && newStatus !== "ALL") {
      params.set("status", newStatus);
    }
    if (newCategory && newCategory !== "ALL") {
      params.set("category", newCategory);
    }

    router.push(`/admin/complaints?${params.toString()}`);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      updateParams(search, status, category);
    }
  };

  return (
    <div className={styles.actionsBar}>
      <div className={styles.searchFilterGroup}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search by Code, Student Name, or Title (Press Enter)"
          value={search}
          onChange={handleSearchChange}
          onKeyDown={handleKeyDown}
          onBlur={() => updateParams(search, status, category)}
        />

        <select
          id="admin-status-filter"
          className={styles.selectInput}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            updateParams(search, e.target.value, category);
          }}
        >
          <option value="ALL">All Statuses</option>
          <option value="SUBMITTED">Submitted</option>
          <option value="ACKNOWLEDGED">Acknowledged (Legacy)</option>
          <option value="AWAITING_STUDENT_CONFIRMATION">Awaiting RC Verification (Legacy)</option>
          <option value="AWAITING_RC_VERIFICATION">Awaiting RC Verification</option>
          <option value="REOPENED">Reopened</option>
          <option value="CLOSED">Closed</option>
        </select>

        <select
          id="admin-category-filter"
          className={styles.selectInput}
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            updateParams(search, status, e.target.value);
          }}
        >
          <option value="ALL">All Categories</option>
          <option value="Electrical">Electrical</option>
          <option value="Plumbing">Plumbing</option>
          <option value="Carpentry">Carpentry</option>
          <option value="Wi-Fi">Wi-Fi</option>
          <option value="Housekeeping">Housekeeping</option>
          <option value="Others">Others</option>
        </select>
      </div>
    </div>
  );
}
