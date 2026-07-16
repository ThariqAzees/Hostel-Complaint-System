# Testing Checklist: Hostel Complaint Management System

This checklist contains all critical workflows that must be validated before the system is marked complete.

---

## 1. ADMIN WORKFLOWS
- [ ] **Admin Login**
  - [ ] Login using Admin email/username and password.
  - [ ] Dashboard displays student & complaint statistics.
- [ ] **Individual Student Creation**
  - [ ] Admin submits Student form with unique Registration Number, Student Name, DOB, and Room Number.
  - [ ] Verify that fields match validation criteria (e.g., DOB required, Reg No unique).
  - [ ] Account is created and initial password is DOB hashed (`DDMMYY` format).
  - [ ] Verify `must_change_password = true` and `is_active = true`.
- [ ] **Excel Bulk Import**
  - [ ] Upload `.xlsx` file.
  - [ ] Verify backend validates file format, parses contents, and validates every row.
  - [ ] Verify backend queries DB for existing Registration Numbers to tag duplicates.
  - [ ] Verify preview displays: Valid, Invalid, Duplicate records.
  - [ ] Confirm import.
  - [ ] Verify backend retrieves stored batch, creates valid student accounts, and locks the batch (cannot confirm twice).
- [ ] **Student Management**
  - [ ] Search students by Registration Number, Name, Room.
  - [ ] Filter students by status (Active/Inactive).
  - [ ] Toggle active state (`is_active = false/true`).
  - [ ] Admin resets Student password:
    - [ ] Hashed DOB is set as password.
    - [ ] `must_change_password = true`.
    - [ ] Active JWT sessions are revoked (token version incremented).
    - [ ] AuditLog entry created.
- [ ] **Single RC Management**
  - [ ] Create single RC account.
  - [ ] Verify backend blocks creation of multiple active RC accounts for the block.

---

## 2. STUDENT WORKFLOWS
- [ ] **Initial Login & Mandatory Password Change**
  - [ ] Student logs in using Registration Number + DOB temporary password.
  - [ ] Check `must_change_password` and verify student is blocked from Dashboard and redirected to password change page.
  - [ ] Verify that direct API requests are blocked.
  - [ ] Change password (validate strength criteria).
  - [ ] Save hashed new password, set `must_change_password = false`.
  - [ ] Allow access to Student Dashboard.
- [ ] **Student Dashboard**
  - [ ] Displays welcome message, Room, Registration Number.
  - [ ] Displays correct complaint counts (Total, Active, In Progress, Closed, Reopened).
  - [ ] Displays recent complaints and notifications list.
- [ ] **Complaint Submission**
  - [ ] Raise complaint form: Title, Category, Description, and optional Image.
  - [ ] Verify image upload enforces safe limits (size < 5MB, MIME/extension restricted, file renamed, saved locally, not Base64).
  - [ ] Auto-associate Student ID, Registration Number, Room Number from session.
  - [ ] Generate unique, concurrency-safe Complaint Code: `MNT-2026-XXXXXX`.
- [ ] **Complaint Details & Timeline**
  - [ ] View status tracking, updates, and remarks.
  - [ ] Student cannot access other student complaints.
- [ ] **Student Resolution Response**
  - [ ] Awaiting Student Confirmation -> Choose FIXED -> Status moves to `AWAITING_RC_VERIFICATION`.
  - [ ] Awaiting Student Confirmation -> Choose NOT_FIXED -> Status moves to `REOPENED`.

---

## 3. RC WORKFLOWS
- [ ] **RC Login & Dashboard**
  - [ ] Login using RC credentials.
  - [ ] Dashboard shows complaint counts (New, In Progress, Resolved, Reopened, etc.).
  - [ ] Complaint queue shows all block complaints (no assignment required).
- [ ] **Queue Filtering**
  - [ ] Filter by Category, Status, Submission Date.
  - [ ] Search by Complaint ID, Registration Number, Student Name, Room Number.
- [ ] **Workflow Actions**
  - [ ] Acknowledge complaint -> Status: `ACKNOWLEDGED`.
  - [ ] Start work -> Status: `IN_PROGRESS`.
  - [ ] Mark resolved with remarks -> Status: `AWAITING_STUDENT_CONFIRMATION`.
  - [ ] Process reopened complaint -> Status moves back to `IN_PROGRESS`.
  - [ ] Verify student-confirmed complaint -> Close complaint -> Status: `CLOSED`.

---

## 4. SYSTEM WORKFLOWS & SECURITY
- [ ] **Role-Based Access Control**
  - [ ] Student blocked from Admin & RC pages/APIs.
  - [ ] RC blocked from Admin pages/APIs.
  - [ ] Unauthenticated users blocked from all protected routes.
- [ ] **Session Revocation**
  - [ ] Verify token version check blocks older/revoked JWT tokens.
  - [ ] Logout invalidates session.
- [ ] **CSRF Protection**
  - [ ] Verify Origin/Referer verification blocks state-changing cross-site requests.
- [ ] **Data Privacy**
  - [ ] DOB is never exposed in general APIs or logs.
- [ ] **Audit Logging**
  - [ ] Verify critical events (e.g., student creation, Excel import, password resets) create audit logs.
  - [ ] Verify database does not delete audit logs when a user is deactivated (no cascading deletion).
