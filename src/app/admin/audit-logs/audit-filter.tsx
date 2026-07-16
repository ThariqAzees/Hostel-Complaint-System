"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./audit-logs.module.css";

export default function AdminAuditFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [action, setAction] = useState(searchParams.get("action") || "ALL");

  useEffect(() => {
    setSearch(searchParams.get("search") || "");
    setAction(searchParams.get("action") || "ALL");
  }, [searchParams]);

  const updateParams = (newSearch: string, newAction: string) => {
    const params = new URLSearchParams();
    params.set("page", "1");

    if (newSearch.trim()) {
      params.set("search", newSearch.trim());
    }
    if (newAction && newAction !== "ALL") {
      params.set("action", newAction);
    }

    router.push(`/admin/audit-logs?${params.toString()}`);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      updateParams(search, action);
    }
  };

  return (
    <div className={styles.actionsBar}>
      <div className={styles.searchFilterGroup}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search by Description or Performed By (Press Enter)"
          value={search}
          onChange={handleSearchChange}
          onKeyDown={handleKeyDown}
          onBlur={() => updateParams(search, action)}
        />

        <select
          id="admin-action-filter"
          className={styles.selectInput}
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            updateParams(search, e.target.value);
          }}
        >
          <option value="ALL">All Actions</option>
          <option value="CREATE_STUDENT">Create Student</option>
          <option value="MODIFY_STUDENT">Modify Student</option>
          <option value="DEACTIVATE_STUDENT">Deactivate Student</option>
          <option value="ACTIVATE_STUDENT">Activate Student</option>
          <option value="PASSWORD_RESET">Password Reset</option>
          <option value="IMPORT_EXCEL">Import Excel</option>
          <option value="CONFIRM_IMPORT">Confirm Import</option>
          <option value="REJECT_IMPORT">Reject Import</option>
          <option value="CREATE_COMPLAINT">Create Complaint</option>
          <option value="TRANSITION_ACKNOWLEDGE">Acknowledge</option>
          <option value="TRANSITION_START_WORK">Start Work</option>
          <option value="TRANSITION_REQUEST_CONFIRMATION">Request Confirmation</option>
          <option value="TRANSITION_STUDENT_CONFIRM_FIXED">Student Confirm Fixed</option>
          <option value="TRANSITION_STUDENT_REJECT_FIXED">Student Reject Fixed</option>
          <option value="TRANSITION_RC_VERIFY_CLOSE">RC Verify Close</option>
        </select>
      </div>
    </div>
  );
}
