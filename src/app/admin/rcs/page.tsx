"use client";

import React, { useState, useEffect, useCallback } from "react";
import styles from "./rcs.module.css";
import { 
   Plus, 
   Search, 
   Edit2, 
   Power, 
   RotateCcw, 
   X, 
   HelpCircle, 
   Trash2, 
   ChevronLeft, 
   ChevronRight, 
   AlertTriangle 
 } from "lucide-react";
import { PasswordInput } from "@/components/password-input";

interface RC {
  id: string;
  name: string;
  email: string;
  phone_number: string | null;
  is_active: boolean;
  must_change_password: boolean;
  created_at: string;
}

export default function RCManagement() {
  // RC List State
  const [rcs, setRcs] = useState<RC[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortField, setSortField] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRcs, setTotalRcs] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleteSubmitting, setIsDeleteSubmitting] = useState(false);

  // Active RC for actions
  const [selectedRc, setSelectedRc] = useState<RC | null>(null);

  // Form states
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formConfirmPassword, setFormConfirmPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isFormSubmitting, setIsFormSubmitting] = useState(false);

  // Fetch RC list
  const fetchRcs = useCallback(async () => {
    setIsLoading(true);
    try {
      const url = `/api/admin/rcs?page=${page}&limit=10&search=${encodeURIComponent(search)}&status=${statusFilter}&sortField=${sortField}&sortOrder=${sortOrder}`;
      const response = await fetch(url);
      const data = await response.json();
      if (response.ok && data.success) {
        setRcs(data.rcs);
        setTotalPages(data.pagination.totalPages);
        setTotalRcs(data.pagination.total);
      }
    } catch (err) {
      console.error("Error fetching RCs:", err);
    } finally {
      setIsLoading(false);
    }
  }, [page, search, statusFilter, sortField, sortOrder]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRcs();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchRcs]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchRcs();
  };

  // Add individual RC
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (formPassword.length < 6) {
      setFormError("Password must be at least 6 characters long.");
      return;
    }

    setIsFormSubmitting(true);

    try {
      const response = await fetch("/api/admin/rcs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          email: formEmail,
          password: formPassword,
          phoneNumber: formPhone,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setFormError(data.error || "Failed to create RC account.");
        setIsFormSubmitting(false);
        return;
      }

      setIsAddOpen(false);
      resetForm();
      fetchRcs();
    } catch (err) {
      console.error(err);
      setFormError("A network error occurred. Please try again.");
      setIsFormSubmitting(false);
    }
  };

  // Edit RC profile details
  const handleEditOpen = (rc: RC) => {
    setSelectedRc(rc);
    setFormName(rc.name);
    setFormEmail(rc.email);
    setFormPhone(rc.phone_number || "");
    setIsEditOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRc) return;
    setFormError(null);
    setIsFormSubmitting(true);

    try {
      const response = await fetch(`/api/admin/rcs/${selectedRc.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_details",
          name: formName,
          email: formEmail,
          phoneNumber: formPhone,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setFormError(data.error || "Failed to update RC details.");
        setIsFormSubmitting(false);
        return;
      }

      setIsEditOpen(false);
      resetForm();
      fetchRcs();
    } catch (err) {
      console.error(err);
      setFormError("A network error occurred.");
      setIsFormSubmitting(false);
    }
  };

  // Toggle active/inactive status
  const handleToggleActive = async (rc: RC) => {
    const actionMsg = rc.is_active 
      ? "Deactivating the RC account will revoke their current session and prevent logins. Continue?"
      : "Activate this RC account?";
    if (!confirm(actionMsg)) return;

    try {
      const response = await fetch(`/api/admin/rcs/${rc.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle_active",
          isActive: !rc.is_active,
        }),
      });

      if (response.ok) {
        fetchRcs();
      } else {
        const data = await response.json();
        alert(data.error || "Failed to toggle active status.");
      }
    } catch (err) {
      console.error(err);
      alert("A network error occurred.");
    }
  };

  // Reset RC Password
  const handleResetOpen = (rc: RC) => {
    setSelectedRc(rc);
    setFormPassword("");
    setFormConfirmPassword("");
    setFormError(null);
    setIsResetOpen(true);
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRc) return;
    setFormError(null);

    if (formPassword !== formConfirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }

    if (formPassword.length < 6) {
      setFormError("Password must be at least 6 characters long.");
      return;
    }

    setIsFormSubmitting(true);

    try {
      const response = await fetch(`/api/admin/rcs/${selectedRc.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reset_password",
          password: formPassword,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setIsResetOpen(false);
        resetForm();
        alert("Password reset successfully. Active sessions revoked.");
      } else {
        setFormError(data.error || "Failed to reset password.");
        setIsFormSubmitting(false);
      }
    } catch (err) {
      console.error(err);
      setFormError("A network error occurred.");
      setIsFormSubmitting(false);
    }
  };

  // Delete RC modal triggers
  const handleDeleteOpen = (rc: RC) => {
    setSelectedRc(rc);
    setDeleteConfirmText("");
    setDeleteError(null);
    setIsDeleteOpen(true);
  };

  const handleDeleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRc) return;
    if (deleteConfirmText !== "DELETE") return;

    setDeleteError(null);
    setIsDeleteSubmitting(true);

    try {
      const response = await fetch(`/api/admin/rcs/${selectedRc.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();

      if (!response.ok) {
        setDeleteError(data.error || "Failed to delete RC account.");
        setIsDeleteSubmitting(false);
        return;
      }

      setIsDeleteOpen(false);
      setSelectedRc(null);
      setDeleteConfirmText("");
      setIsDeleteSubmitting(false);
      fetchRcs();
    } catch (err) {
      console.error(err);
      setDeleteError("A network error occurred. Please try again.");
      setIsDeleteSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormName("");
    setFormEmail("");
    setFormPhone("");
    setFormPassword("");
    setFormConfirmPassword("");
    setFormError(null);
    setIsFormSubmitting(false);
    setSelectedRc(null);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
    setPage(1);
  };

  return (
    <div className={styles.container}>
      <div className={styles.titleArea}>
        <h1 className={styles.title}>Residential Coordinators (RCs)</h1>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={() => setIsAddOpen(true)}
        >
          <Plus size={16} />
          <span>Add RC</span>
        </button>
      </div>

      {/* Filter and Search Actions Bar */}
      <div className={styles.actionsBar}>
        <form className={styles.searchFilterGroup} onSubmit={handleSearchSubmit}>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search RC by name, email or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" className={`${styles.btn} ${styles.btnOutline}`}>
            <Search size={16} />
            <span>Search</span>
          </button>
        </form>

        <div className={styles.searchFilterGroup} style={{ flex: 0 }}>
          <select
            className={styles.selectInput}
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Accounts</option>
            <option value="inactive">Inactive Accounts</option>
          </select>
        </div>
      </div>

      {/* Main RC Directory Table */}
      <div className={styles.tableCard}>
        <div className={styles.tableWrapper}>
          {isLoading ? (
            <div className={styles.emptyState}>
              <div className="spinner" style={{ width: "32px", height: "32px", border: "4px solid var(--primary-light)", borderTopColor: "var(--primary)", borderRadius: "50%" }} />
              <span>Loading RC directory...</span>
            </div>
          ) : rcs.length === 0 ? (
            <div className={styles.emptyState}>
              <HelpCircle size={40} />
              <span>No Residential Coordinators found matching your criteria.</span>
            </div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th 
                    className={`${styles.th} ${styles.thSortable}`}
                    onClick={() => handleSort("name")}
                  >
                    Name {sortField === "name" && (sortOrder === "asc" ? "▲" : "▼")}
                  </th>
                  <th 
                    className={`${styles.th} ${styles.thSortable}`}
                    onClick={() => handleSort("email")}
                  >
                    Email / Username {sortField === "email" && (sortOrder === "asc" ? "▲" : "▼")}
                  </th>
                  <th className={`${styles.th} ${styles.mobileHidden}`}>Phone Number</th>
                  <th 
                    className={`${styles.th} ${styles.thSortable} ${styles.mobileHidden}`}
                    onClick={() => handleSort("created_at")}
                  >
                    Created Date {sortField === "created_at" && (sortOrder === "asc" ? "▲" : "▼")}
                  </th>
                  <th className={styles.th}>Status</th>
                  <th className={styles.th} style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rcs.map((rc) => (
                  <tr key={rc.id} className={styles.tr}>
                    <td className={styles.td} style={{ fontWeight: 600 }}>
                      {rc.name}
                    </td>
                    <td className={styles.td} style={{ fontFamily: "monospace" }}>
                      {rc.email}
                    </td>
                    <td className={`${styles.td} ${styles.mobileHidden}`}>
                      {rc.phone_number || "—"}
                    </td>
                    <td className={`${styles.td} ${styles.mobileHidden}`}>
                      {formatDate(rc.created_at)}
                    </td>
                    <td className={styles.td}>
                      <span className={`${styles.badge} ${rc.is_active ? styles.badgeActive : styles.badgeInactive}`}>
                        {rc.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className={styles.td} style={{ textAlign: "right" }}>
                      <div className={styles.rowActions} style={{ justifyContent: "flex-end" }}>
                        <button
                          type="button"
                          className={styles.actionBtn}
                          title="Edit RC Profile"
                          onClick={() => handleEditOpen(rc)}
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          type="button"
                          className={styles.actionBtn}
                          title="Change RC Password"
                          onClick={() => handleResetOpen(rc)}
                        >
                          <RotateCcw size={16} />
                        </button>
                        <button
                          type="button"
                          className={styles.actionBtn}
                          title={rc.is_active ? "Deactivate Account" : "Activate Account"}
                          style={{ color: rc.is_active ? "var(--danger)" : "var(--success)" }}
                          onClick={() => handleToggleActive(rc)}
                        >
                          <Power size={16} />
                        </button>
                        <button
                          type="button"
                          className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                          title="Delete RC Account"
                          onClick={() => handleDeleteOpen(rc)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Bar */}
        {!isLoading && rcs.length > 0 && (
          <div className={styles.pagination}>
            <span>
              Showing Page {page} of {totalPages} ({totalRcs} total RCs)
            </span>
            <div className={styles.paginationBtns}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnOutline}`}
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
                style={{ padding: "6px 12px" }}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnOutline}`}
                disabled={page === totalPages}
                onClick={() => setPage(page + 1)}
                style={{ padding: "6px 12px" }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL: Add RC */}
      {isAddOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Add Residential Coordinator</h2>
              <button type="button" className={styles.closeBtn} onClick={() => { setIsAddOpen(false); resetForm(); }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddSubmit}>
              <div className={styles.modalBody}>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Full Name</label>
                    <input
                      type="text"
                      className={styles.formInput}
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="RC Name"
                      required
                      disabled={isFormSubmitting}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Email / Username</label>
                    <input
                      type="email"
                      className={styles.formInput}
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      placeholder="rc@ech.com"
                      required
                      disabled={isFormSubmitting}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Initial Password</label>
                    <PasswordInput
                      className={styles.formInput}
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      required
                      disabled={isFormSubmitting}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Phone Number</label>
                    <input
                      type="text"
                      className={styles.formInput}
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      placeholder="Optional"
                      disabled={isFormSubmitting}
                    />
                  </div>
                </div>

                {formError && (
                  <div className={styles.errorBox}>
                    <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                    <span>{formError}</span>
                  </div>
                )}
              </div>
              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnOutline}`}
                  onClick={() => { setIsAddOpen(false); resetForm(); }}
                  disabled={isFormSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  disabled={isFormSubmitting}
                >
                  {isFormSubmitting ? <div className="spinner" style={{ width: "16px", height: "16px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%" }} /> : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Edit RC */}
      {isEditOpen && selectedRc && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Edit RC Details</h2>
              <button type="button" className={styles.closeBtn} onClick={() => { setIsEditOpen(false); resetForm(); }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className={styles.modalBody}>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Full Name</label>
                    <input
                      type="text"
                      className={styles.formInput}
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      required
                      disabled={isFormSubmitting}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Email / Username</label>
                    <input
                      type="email"
                      className={styles.formInput}
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      required
                      disabled={isFormSubmitting}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Phone Number</label>
                    <input
                      type="text"
                      className={styles.formInput}
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      disabled={isFormSubmitting}
                    />
                  </div>
                </div>

                {formError && (
                  <div className={styles.errorBox}>
                    <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                    <span>{formError}</span>
                  </div>
                )}
              </div>
              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnOutline}`}
                  onClick={() => { setIsEditOpen(false); resetForm(); }}
                  disabled={isFormSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  disabled={isFormSubmitting}
                >
                  {isFormSubmitting ? <div className="spinner" style={{ width: "16px", height: "16px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%" }} /> : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Reset Password */}
      {isResetOpen && selectedRc && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Reset RC Password</h2>
              <button type="button" className={styles.closeBtn} onClick={() => { setIsResetOpen(false); resetForm(); }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleResetSubmit}>
              <div className={styles.modalBody}>
                <p style={{ fontSize: "0.85rem", marginBottom: "16px", color: "var(--text-muted)" }}>
                  Resetting the password for <strong>{selectedRc.name}</strong> will revoke all of their active login sessions. They will be forced to change password on next login.
                </p>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>New Password</label>
                    <PasswordInput
                      className={styles.formInput}
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      required
                      disabled={isFormSubmitting}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Confirm Password</label>
                    <PasswordInput
                      className={styles.formInput}
                      value={formConfirmPassword}
                      onChange={(e) => setFormConfirmPassword(e.target.value)}
                      placeholder="Confirm new password"
                      required
                      disabled={isFormSubmitting}
                    />
                  </div>
                </div>

                {formError && (
                  <div className={styles.errorBox}>
                    <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                    <span>{formError}</span>
                  </div>
                )}
              </div>
              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnOutline}`}
                  onClick={() => { setIsResetOpen(false); resetForm(); }}
                  disabled={isFormSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  disabled={isFormSubmitting}
                >
                  {isFormSubmitting ? <div className="spinner" style={{ width: "16px", height: "16px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%" }} /> : "Reset Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Delete RC */}
      {isDeleteOpen && selectedRc && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle} style={{ color: "var(--danger)" }}>Delete RC Account</h2>
              <button type="button" className={styles.closeBtn} onClick={() => { setIsDeleteOpen(false); setSelectedRc(null); setDeleteConfirmText(""); setDeleteError(null); }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleDeleteSubmit}>
              <div className={styles.modalBody}>
                <p style={{ fontSize: "0.9rem", marginBottom: "16px", lineHeight: "1.4" }}>
                  Are you sure you want to permanently delete the RC account for <strong>{selectedRc.name}</strong> ({selectedRc.email})?
                </p>
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "20px", background: "var(--primary-light)", padding: "12px 16px", borderRadius: "4px" }}>
                  <strong>Note:</strong> Deletion is only allowed if the RC has zero historical activity (e.g. no complaint status updates). If they have historical activity, the operation will fail and you must de-activate their account instead.
                </p>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Type <strong>DELETE</strong> to confirm</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="DELETE"
                    required
                    disabled={isDeleteSubmitting}
                  />
                </div>

                {deleteError && (
                  <div className={styles.errorBox}>
                    <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                    <span>{deleteError}</span>
                  </div>
                )}
              </div>
              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnOutline}`}
                  onClick={() => { setIsDeleteOpen(false); setSelectedRc(null); setDeleteConfirmText(""); setDeleteError(null); }}
                  disabled={isDeleteSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  style={{ background: "var(--danger)", color: "white" }}
                  disabled={deleteConfirmText !== "DELETE" || isDeleteSubmitting}
                >
                  {isDeleteSubmitting ? <div className="spinner" style={{ width: "16px", height: "16px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%" }} /> : "Permanently Delete"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
