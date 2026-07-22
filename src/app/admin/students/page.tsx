"use client";

import React, { useState, useEffect, useCallback } from "react";
import styles from "./students.module.css";
import { 
  Plus, 
  Upload, 
  Search, 
  Edit2, 
  Power, 
  RotateCcw, 
  X, 
  FileSpreadsheet, 
  Check, 
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  HelpCircle
} from "lucide-react";

interface Student {
  id: string;
  registration_number: string;
  name: string;
  date_of_birth: string;
  email: string | null;
  phone_number: string | null;
  room_number: string;
  is_active: boolean;
  must_change_password: boolean;
}

interface ImportBatch {
  id: string;
  filename: string;
  total: number;
  valid: number;
  invalid: number;
}

interface ImportRecord {
  id: string;
  registration_number: string;
  name: string;
  date_of_birth: string;
  room_number: string;
  status: "VALID" | "INVALID" | "DUPLICATE";
  error_message: string | null;
}

export default function StudentManagement() {
  // Student List State
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortField, setSortField] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalStudents, setTotalStudents] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Modals state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isResetSuccessOpen, setIsResetSuccessOpen] = useState(false);
  
  // Active student for edit/reset actions
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [tempPasswordMsg, setTempPasswordMsg] = useState("");

  // Form states for individual creation/modification
  const [formName, setFormName] = useState("");
  const [formRegNo, setFormRegNo] = useState("");
  const [formDob, setFormDob] = useState("");
  const [formRoom, setFormRoom] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isFormSubmitting, setIsFormSubmitting] = useState(false);

  // Excel Import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importBatch, setImportBatch] = useState<ImportBatch | null>(null);
  const [importRecords, setImportRecords] = useState<ImportRecord[]>([]);
  const [isImportUploading, setIsImportUploading] = useState(false);
  const [isImportConfirming, setIsImportConfirming] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);

  // Fetch student list
  const fetchStudents = useCallback(async () => {
    setIsLoading(true);
    try {
      const url = `/api/admin/students?page=${page}&limit=10&search=${encodeURIComponent(search)}&status=${statusFilter}&sortField=${sortField}&sortOrder=${sortOrder}`;
      const response = await fetch(url);
      const data = await response.json();
      if (response.ok && data.success) {
        setStudents(data.students);
        setTotalPages(data.pagination.totalPages);
        setTotalStudents(data.pagination.total);
      }
    } catch (err) {
      console.error("Error fetching students:", err);
    } finally {
      setIsLoading(false);
    }
  }, [page, search, statusFilter, sortField, sortOrder]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchStudents();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchStudents]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchStudents();
  };

  // Add individual student
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsFormSubmitting(true);

    try {
      const response = await fetch("/api/admin/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registrationNumber: formRegNo,
          name: formName,
          dateOfBirth: formDob,
          roomNumber: formRoom,
          email: formEmail,
          phoneNumber: formPhone,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setFormError(data.error || "Failed to create student.");
        setIsFormSubmitting(false);
        return;
      }

      setIsAddOpen(false);
      resetForm();
      fetchStudents();
    } catch (err) {
      console.error(err);
      setFormError("A network error occurred. Please try again.");
      setIsFormSubmitting(false);
    }
  };

  // Edit student details
  const handleEditOpen = (student: Student) => {
    setSelectedStudent(student);
    setFormName(student.name);
    setFormRegNo(student.registration_number);
    setFormRoom(student.room_number);
    setFormEmail(student.email || "");
    setFormPhone(student.phone_number || "");
    setIsEditOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;
    setFormError(null);
    setIsFormSubmitting(true);

    try {
      const response = await fetch(`/api/admin/students/${selectedStudent.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_details",
          name: formName,
          roomNumber: formRoom,
          email: formEmail,
          phoneNumber: formPhone,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setFormError(data.error || "Failed to update student details.");
        setIsFormSubmitting(false);
        return;
      }

      setIsEditOpen(false);
      resetForm();
      fetchStudents();
    } catch (err) {
      console.error(err);
      setFormError("A network error occurred.");
      setIsFormSubmitting(false);
    }
  };

  // Toggle active/inactive status
  const handleToggleActive = async (student: Student) => {
    const actionMsg = student.is_active 
      ? "Deactivating the student account will revoke their current session and prevent logins. Continue?"
      : "Activate this student account?";
    if (!confirm(actionMsg)) return;

    try {
      const response = await fetch(`/api/admin/students/${student.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle_active",
          isActive: !student.is_active,
        }),
      });

      if (response.ok) {
        fetchStudents();
      } else {
        const data = await response.json();
        alert(data.error || "Failed to toggle active status.");
      }
    } catch (err) {
      console.error(err);
      alert("A network error occurred.");
    }
  };

  // Reset student password to DOB format
  const handleResetPassword = async (student: Student) => {
    if (!confirm(`Are you sure you want to reset password for ${student.name}? This will revoke their active sessions.`)) return;

    try {
      const response = await fetch(`/api/admin/students/${student.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reset_password",
        }),
      });

      const data = await response.json();
      if (response.ok) {
        // Format DOB for success display: e.g. "150305"
        const date = new Date(student.date_of_birth);
        const day = String(date.getUTCDate()).padStart(2, "0");
        const month = String(date.getUTCMonth() + 1).padStart(2, "0");
        const year = String(date.getUTCFullYear()).slice(-2);
        
        setSelectedStudent(student);
        setTempPasswordMsg(`${day}${month}${year}`);
        setIsResetSuccessOpen(true);
      } else {
        alert(data.error || "Failed to reset password.");
      }
    } catch (err) {
      console.error(err);
      alert("A network error occurred.");
    }
  };

  // Excel File upload handler
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    setImportError(null);
    setImportBatch(null);
    setImportRecords([]);
    setIsImportUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/admin/students/import", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setImportError(data.error || "Failed to upload file.");
        setIsImportUploading(false);
        return;
      }

      setImportBatch(data.importBatch);
      setImportRecords(data.records);
    } catch (err) {
      console.error(err);
      setImportError("An error occurred during file upload.");
    } finally {
      setIsImportUploading(false);
    }
  };

  // Confirm bulk import
  const handleConfirmImport = async () => {
    if (!importBatch) return;

    setIsImportConfirming(true);
    setImportError(null);

    try {
      const response = await fetch("/api/admin/students/import/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ importId: importBatch.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        setImportError(data.error || "Failed to process import confirmation.");
        setIsImportConfirming(false);
        return;
      }

      setImportSuccessMsg(`Bulk import completed successfully! Imported ${data.importedCount} students.`);
      setTimeout(() => {
        setIsImportOpen(false);
        resetImportState();
        fetchStudents();
      }, 2000);
    } catch (err) {
      console.error(err);
      setImportError("An error occurred during confirmation.");
      setIsImportConfirming(false);
    }
  };

  const resetForm = () => {
    setFormName("");
    setFormRegNo("");
    setFormDob("");
    setFormRoom("");
    setFormEmail("");
    setFormPhone("");
    setFormError(null);
    setIsFormSubmitting(false);
    setSelectedStudent(null);
  };

  const resetImportState = () => {
    setImportFile(null);
    setImportBatch(null);
    setImportRecords([]);
    setImportError(null);
    setImportSuccessMsg(null);
    setIsImportUploading(false);
    setIsImportConfirming(false);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "UTC",
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
        <h1 className={styles.title}>Student Directory</h1>
        <div className={styles.btnGroup}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSecondary}`}
            onClick={() => setIsImportOpen(true)}
          >
            <Upload size={16} />
            <span>Import Excel</span>
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={() => setIsAddOpen(true)}
          >
            <Plus size={16} />
            <span>Add Student</span>
          </button>
        </div>
      </div>

      {/* Filter and Search actions bar */}
      <div className={styles.actionsBar}>
        <form className={styles.searchFilterGroup} onSubmit={handleSearchSubmit}>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search by name, reg number, or room..."
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

      {/* Main Student Directory Table */}
      <div className={styles.tableCard}>
        <div className={styles.tableWrapper}>
          {isLoading ? (
            <div className={styles.emptyState}>
              <div className="spinner" style={{ width: "32px", height: "32px", border: "4px solid var(--primary-light)", borderTopColor: "var(--primary)", borderRadius: "50%" }} />
              <span>Loading student directory...</span>
            </div>
          ) : students.length === 0 ? (
            <div className={styles.emptyState}>
              <HelpCircle size={40} />
              <span>No students found matching your criteria.</span>
            </div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th 
                    className={`${styles.th} ${styles.thSortable}`}
                    onClick={() => handleSort("registration_number")}
                  >
                    Reg Number {sortField === "registration_number" && (sortOrder === "asc" ? "▲" : "▼")}
                  </th>
                  <th 
                    className={`${styles.th} ${styles.thSortable}`}
                    onClick={() => handleSort("name")}
                  >
                    Name {sortField === "name" && (sortOrder === "asc" ? "▲" : "▼")}
                  </th>
                  <th 
                    className={`${styles.th} ${styles.thSortable}`}
                    onClick={() => handleSort("room_number")}
                  >
                    Room {sortField === "room_number" && (sortOrder === "asc" ? "▲" : "▼")}
                  </th>
                  <th className={`${styles.th} ${styles.mobileHidden}`}>Date of Birth</th>
                  <th className={`${styles.th} ${styles.mobileHidden}`}>Contact Info</th>
                  <th className={styles.th}>Status</th>
                  <th className={styles.th} style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.id} className={styles.tr}>
                    <td className={styles.td} style={{ fontFamily: "monospace", fontWeight: 600 }}>
                       {student.registration_number}
                    </td>
                    <td className={styles.td}>
                      <div className={styles.studentNameCell}>
                        <span style={{ fontWeight: 600 }}>{student.name}</span>
                        {student.email && (
                          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                            {student.email}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={styles.td} style={{ fontWeight: 600 }}>
                      {student.room_number}
                    </td>
                    <td className={`${styles.td} ${styles.mobileHidden}`}>{formatDate(student.date_of_birth)}</td>
                    <td className={`${styles.td} ${styles.mobileHidden}`}>{student.phone_number || "—"}</td>
                    <td className={styles.td}>
                      <span className={`${styles.badge} ${student.is_active ? styles.badgeActive : styles.badgeInactive}`}>
                        {student.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className={styles.td} style={{ textAlign: "right" }}>
                      <div className={styles.rowActions} style={{ justifyContent: "flex-end" }}>
                        <button
                          type="button"
                          className={styles.actionBtn}
                          title="Edit Student Details"
                          onClick={() => handleEditOpen(student)}
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          type="button"
                          className={styles.actionBtn}
                          title="Reset Password to DOB"
                          onClick={() => handleResetPassword(student)}
                        >
                          <RotateCcw size={16} />
                        </button>
                        <button
                          type="button"
                          className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                          title={student.is_active ? "Deactivate Account" : "Activate Account"}
                          onClick={() => handleToggleActive(student)}
                        >
                          <Power size={16} />
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
        {!isLoading && students.length > 0 && (
          <div className={styles.pagination}>
            <span>
              Showing Page {page} of {totalPages} ({totalStudents} total students)
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

      {/* MODAL: Add Student */}
      {isAddOpen && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modal} animate-scale`}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Add Individual Student</h2>
              <button type="button" className={styles.closeBtn} onClick={() => setIsAddOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddSubmit}>
              <div className={styles.modalBody}>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Reg Number (10 digits)</label>
                    <input
                      type="text"
                      className={styles.formInput}
                      value={formRegNo}
                      onChange={(e) => setFormRegNo(e.target.value)}
                      placeholder="e.g. 2023105001"
                      required
                      disabled={isFormSubmitting}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Full Name</label>
                    <input
                      type="text"
                      className={styles.formInput}
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="Student Name"
                      required
                      disabled={isFormSubmitting}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Date of Birth</label>
                    <input
                      type="date"
                      className={styles.formInput}
                      value={formDob}
                      onChange={(e) => setFormDob(e.target.value)}
                      required
                      disabled={isFormSubmitting}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Room Number</label>
                    <input
                      type="text"
                      className={styles.formInput}
                      value={formRoom}
                      onChange={(e) => setFormRoom(e.target.value)}
                      placeholder="e.g. 104"
                      required
                      disabled={isFormSubmitting}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Email Address</label>
                    <input
                      type="email"
                      className={styles.formInput}
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      placeholder="Optional"
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
                  onClick={() => setIsAddOpen(false)}
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

      {/* MODAL: Edit Student */}
      {isEditOpen && selectedStudent && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modal} animate-scale`}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Edit Student Profile</h2>
              <button type="button" className={styles.closeBtn} onClick={() => setIsEditOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className={styles.modalBody}>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Reg Number</label>
                    <input
                      type="text"
                      className={styles.formInput}
                      value={formRegNo}
                      disabled
                    />
                  </div>
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
                    <label className={styles.formLabel}>Room Number</label>
                    <input
                      type="text"
                      className={styles.formInput}
                      value={formRoom}
                      onChange={(e) => setFormRoom(e.target.value)}
                      required
                      disabled={isFormSubmitting}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel}>Email Address</label>
                    <input
                      type="email"
                      className={styles.formInput}
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      disabled={isFormSubmitting}
                    />
                  </div>
                  <div className={styles.formGroup} style={{ gridColumn: "1 / -1" }}>
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
                  onClick={() => setIsEditOpen(false)}
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

      {/* MODAL: Excel Bulk Import Drawer */}
      {isImportOpen && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modal} ${styles.modalLarge} animate-scale`}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Excel Bulk Student Import</h2>
              <button 
                type="button" 
                className={styles.closeBtn} 
                onClick={() => {
                  setIsImportOpen(false);
                  resetImportState();
                }}
              >
                <X size={20} />
              </button>
            </div>
            <div className={styles.modalBody}>
              {!importBatch && !isLoading ? (
                // 1. File Upload Dropzone
                <label className={`${styles.fileUploadZone} ${importFile ? styles.fileSelected : ""}`}>
                  <input
                    type="file"
                    accept=".xlsx"
                    onChange={handleFileChange}
                    style={{ display: "none" }}
                    disabled={isImportUploading}
                  />
                  <FileSpreadsheet size={48} className={styles.uploadIcon} />
                  <span style={{ fontWeight: 600, fontSize: "1rem" }}>
                    {isImportUploading ? "Uploading & parsing file..." : "Click to select student Excel list (.xlsx)"}
                  </span>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                    Columns required: registration_number, student_name, date_of_birth, room_number
                  </span>
                </label>
              ) : (
                // 2. Import Preview & Status Report
                <div>
                  <div className={styles.importSummary}>
                    <div className={styles.summaryCard} style={{ borderColor: "var(--card-border)" }}>
                      <div className={styles.summaryVal}>{importBatch?.total}</div>
                      <div className={styles.summaryLabel}>Total Records</div>
                    </div>
                    <div className={styles.summaryCard} style={{ borderColor: "var(--success)" }}>
                      <div className={styles.summaryVal} style={{ color: "var(--success)" }}>{importBatch?.valid}</div>
                      <div className={styles.summaryLabel}>Valid (Ready)</div>
                    </div>
                    <div className={styles.summaryCard} style={{ borderColor: "var(--danger)" }}>
                      <div className={styles.summaryVal} style={{ color: "var(--danger)" }}>{importBatch?.invalid}</div>
                      <div className={styles.summaryLabel}>Errors / Dupes</div>
                    </div>
                  </div>

                  <h3 style={{ fontSize: "0.9rem", fontWeight: 700, marginBottom: "12px", textTransform: "uppercase" }}>Preview parsed records</h3>
                  
                  <div className={styles.importPreview}>
                    <table className={styles.previewTable}>
                      <thead>
                        <tr style={{ background: "var(--background)", borderBottom: "1px solid var(--card-border)" }}>
                          <th style={{ padding: "10px", textAlign: "left" }}>Reg Number</th>
                          <th style={{ padding: "10px", textAlign: "left" }}>Name</th>
                          <th style={{ padding: "10px", textAlign: "left" }}>Room</th>
                          <th style={{ padding: "10px", textAlign: "left" }}>DOB</th>
                          <th style={{ padding: "10px", textAlign: "left" }}>Status</th>
                          <th style={{ padding: "10px", textAlign: "left" }}>Error/Warning</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importRecords.map((rec, index) => (
                          <tr key={index} style={{ borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
                            <td style={{ padding: "10px", fontFamily: "monospace" }}>{rec.registration_number || "—"}</td>
                            <td style={{ padding: "10px", fontWeight: 600 }}>{rec.name || "—"}</td>
                            <td style={{ padding: "10px" }}>{rec.room_number || "—"}</td>
                            <td style={{ padding: "10px" }}>{rec.date_of_birth ? formatDate(rec.date_of_birth) : "—"}</td>
                            <td style={{ padding: "10px" }}>
                              <span className={`${styles.badge} ${
                                rec.status === "VALID" 
                                  ? styles.badgeValid 
                                  : rec.status === "INVALID" 
                                    ? styles.badgeInvalid 
                                    : styles.badgeDuplicate
                              }`}>
                                {rec.status}
                              </span>
                            </td>
                            <td style={{ padding: "10px", color: "var(--danger)", fontSize: "0.75rem" }}>
                              {rec.error_message || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {importError && (
                <div className={styles.errorBox} style={{ marginTop: "16px" }}>
                  <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                  <span>{importError}</span>
                </div>
              )}

              {importSuccessMsg && (
                <div className={styles.successBox} style={{ marginTop: "16px" }}>
                  <Check size={18} style={{ flexShrink: 0 }} />
                  <span>{importSuccessMsg}</span>
                </div>
              )}
            </div>
            <div className={styles.modalFooter}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnOutline}`}
                onClick={() => {
                  setIsImportOpen(false);
                  resetImportState();
                }}
                disabled={isImportConfirming}
              >
                Cancel
              </button>
              {importBatch && (
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnOutline}`}
                  onClick={resetImportState}
                  disabled={isImportConfirming}
                  style={{ marginRight: "auto" }}
                >
                  Upload Another File
                </button>
              )}
              {importBatch && (
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  disabled={isImportConfirming || importBatch.valid === 0}
                  onClick={handleConfirmImport}
                >
                  {isImportConfirming ? (
                    <div className="spinner" style={{ width: "16px", height: "16px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%" }} />
                  ) : (
                    `Confirm Import (${importBatch.valid} Valid Students)`
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Reset Password Success Display */}
      {isResetSuccessOpen && selectedStudent && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modal} animate-scale`}>
            <div className={styles.modalHeader} style={{ borderBottom: "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--success)" }}>
                <Check size={24} />
                <h2 className={styles.modalTitle} style={{ fontSize: "1.1rem" }}>Password Reset Successful</h2>
              </div>
            </div>
            <div className={styles.modalBody} style={{ padding: "0 28px 28px" }}>
              <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", marginBottom: "16px", lineHeight: "1.4" }}>
                The password for student <strong>{selectedStudent.name}</strong> has been successfully reverted to their temporary DOB-based format.
              </p>
              <div style={{ background: "var(--background)", border: "1px solid var(--card-border)", padding: "16px", borderRadius: "var(--radius-sm)", textAlign: "center", marginBottom: "8px" }}>
                <div style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-light)", fontWeight: 600, letterSpacing: "0.5px", marginBottom: "4px" }}>Temporary Password</div>
                <div style={{ fontSize: "1.5rem", fontWeight: 700, fontFamily: "monospace", color: "var(--foreground)" }}>{tempPasswordMsg}</div>
              </div>
              <p style={{ fontSize: "0.75rem", color: "var(--text-light)", textAlign: "center" }}>
                The student will be forced to change this password on their next login.
              </p>
            </div>
            <div className={styles.modalFooter}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={() => {
                  setIsResetSuccessOpen(false);
                  setSelectedStudent(null);
                  setTempPasswordMsg("");
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
