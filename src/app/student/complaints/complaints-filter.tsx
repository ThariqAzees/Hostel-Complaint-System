/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import styles from "./complaints.module.css";

export default function ComplaintsFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Local state initialized from URL search params
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [status, setStatus] = useState(searchParams.get("status") || "ALL");
  const [category, setCategory] = useState(searchParams.get("category") || "ALL");

  // Sync state with URL when back button is pressed
  useEffect(() => {
    setSearch(searchParams.get("search") || "");
    setStatus(searchParams.get("status") || "ALL");
    setCategory(searchParams.get("category") || "ALL");
  }, [searchParams]);

  // Trigger search params update
  const updateParams = (newSearch: string, newStatus: string, newCategory: string) => {
    const params = new URLSearchParams();
    
    // Always reset page to 1 on filter changes
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

    router.push(`/student/complaints?${params.toString()}`);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      updateParams(search, status, category);
    }
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setStatus(val);
    updateParams(search, val, category);
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setCategory(val);
    updateParams(search, status, val);
  };

  return (
    <div className={styles.filtersSection}>
      <div className={styles.searchWrapper}>
        <Search size={18} className={styles.searchIcon} />
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search by Complaint Code or Title (Press Enter)"
          value={search}
          onChange={handleSearchChange}
          onKeyDown={handleKeyDown}
          onBlur={() => updateParams(search, status, category)}
        />
      </div>

      <div className={styles.filterWrapper}>
        <select
          id="status-filter"
          className={styles.filterSelect}
          value={status}
          onChange={handleStatusChange}
        >
          <option value="ALL">All Statuses</option>
          <option value="SUBMITTED">Submitted</option>
          <option value="ACKNOWLEDGED">Acknowledged</option>
          <option value="AWAITING_STUDENT_CONFIRMATION">Waiting for Your Confirmation</option>
          <option value="AWAITING_RC_VERIFICATION">Awaiting RC Verification</option>
          <option value="REOPENED">Reopened</option>
          <option value="CLOSED">Closed</option>
        </select>
      </div>

      <div className={styles.filterWrapper}>
        <select
          id="category-filter"
          className={styles.filterSelect}
          value={category}
          onChange={handleCategoryChange}
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
