# API Documentation

This document provides a reference for all backend API endpoints, payload structures, response formats, and CSRF headers.

---

## 1. Global API Standards

*   **Content-Type**: All requests and responses use `application/json` unless otherwise specified (e.g. multipart/form-data for uploads).
*   **CSRF Protection**: All state-modifying requests (`POST`, `PUT`, `DELETE`) require the request `origin` or `referer` header to match the server `host` domain. Requests failing this check receive a `403 Forbidden` response.
*   **Error Format**:
    ```json
    {
      "error": "Error description message."
    }
    ```

---

## 2. Authentication API

### Login
*   **Endpoint**: `POST /api/auth/login`
*   **Request Body**:
    ```json
    {
      "username": "2023105001",
      "password": "temp_password_or_dob"
    }
    ```
*   **Responses**:
    *   `200 OK`: Sets an `hostel_session` HttpOnly cookie.
        ```json
        {
          "success": true,
          "user": {
            "id": "user-uuid",
            "name": "Student One",
            "role": "STUDENT",
            "mustChangePassword": false
          }
        }
        ```
    *   `400 Bad Request`: Missing fields.
    *   `401 Unauthorized`: Invalid credentials.

### Logout
*   **Endpoint**: `POST /api/auth/logout`
*   **Request Body**: None (Clears cookie).
*   **Responses**:
    *   `200 OK`: Clears cookie.
        ```json
        { "success": true }
        ```

### Password Change
*   **Endpoint**: `POST /api/auth/change-password`
*   **Request Body**:
    ```json
    {
      "currentPassword": "dob_temp_password",
      "newPassword": "secure_new_password"
    }
    ```
*   **Responses**:
    *   `200 OK`: Resets password and increments database `token_version`.
        ```json
        { "success": true, "message": "Password changed successfully." }
        ```
    *   `400 Bad Request`: Password complexity mismatch or matching current password.

---

## 3. Student Complaints API

### Submit Complaint
*   **Endpoint**: `POST /api/student/complaints`
*   **Content-Type**: `multipart/form-data`
*   **Form Parameters**:
    *   `title` (string, min 5 chars, required)
    *   `category` (string, required: `Electrical`, `Plumbing`, `Carpentry`, `Wi-Fi`, `Housekeeping`, `Others`)
    *   `description` (string, min 15 chars, required)
    *   `image` (File, max 5MB, optional: JPEG/PNG/WebP format)
*   **Responses**:
    *   `200 OK`: Atomic insert of Complaint, Timeline Update, Audit Log, and Notification.
        ```json
        {
          "success": true,
          "id": "complaint-uuid",
          "complaintCode": "MNT-2026-000001"
        }
        ```

### Student State Transition
*   **Endpoint**: `POST /api/student/complaints/[id]/transition`
*   **Request Body**:
    ```json
    {
      "action": "STUDENT_MARK_COMPLETED" | "STUDENT_CONFIRM_FIXED" | "STUDENT_REOPEN",
      "remarks": "Feedback comments (required if action is STUDENT_REOPEN)"
    }
    ```
*   **Responses**:
    *   `200 OK`: Complaint status successfully transitioned.
        ```json
        { "success": true }
        ```
    *   `400 Bad Request`: Invalid transition, or student does not own complaint, or reopening requested before 2 days have elapsed from creation.

---

## 4. RC Complaints API

### RC State Transition
*   **Endpoint**: `POST /api/rc/complaints/[id]/transition`
*   **Request Body**:
    ```json
    {
      "action": "ACKNOWLEDGE" | "RC_VERIFY_CLOSE",
      "remarks": "Transition notes or closing remarks (optional)"
    }
    ```
*   **Responses**:
    *   `200 OK`: Complaint status successfully transitioned.
        ```json
        { "success": true }
        ```
    *   `400 Bad Request`: Transition mismatch, or unauthorized role action.

---

## 5. Admin Portal API

### Create Student
*   **Endpoint**: `POST /api/admin/students`
*   **Request Body**:
    ```json
    {
      "registrationNumber": "2023105004",
      "name": "Student Four",
      "dateOfBirth": "2005-04-12T00:00:00.000Z",
      "roomNumber": "104",
      "email": "student4@ech.com",
      "phoneNumber": "9876543233"
    }
    ```
*   **Responses**:
    *   `200 OK`: Account created with DOB-based temp password.
        ```json
        { "success": true }
        ```

### Modify / Reset Student
*   **Endpoint**: `PUT /api/admin/students/[id]`
*   **Request Body**:
    ```json
    {
      "name": "Updated Name",
      "roomNumber": "105",
      "email": "updated@ech.com",
      "phoneNumber": "9876543244",
      "isActive": true,
      "resetPassword": false
    }
    ```
*   **Responses**:
    *   `200 OK`: Record updated.
        ```json
        { "success": true }
        ```

### Staged Excel Parse
*   **Endpoint**: `POST /api/admin/students/import`
*   **Content-Type**: `multipart/form-data`
*   **Form Parameters**:
    *   `file` (File, binary SheetJS Excel file: `.xlsx`, required)
*   **Responses**:
    *   `200 OK`: Parses sheet and populates staging tables.
        ```json
        {
          "success": true,
          "importId": "import-uuid",
          "total": 12,
          "valid": 10,
          "invalid": 2
        }
        ```

### Staged Excel Confirmation
*   **Endpoint**: `POST /api/admin/students/import/confirm`
*   **Request Body**:
    ```json
    {
      "importId": "import-uuid"
    }
    ```
*   **Responses**:
    *   `200 OK`: Staged user validation confirmation and batch staging creation.
        ```json
        { "success": true, "createdCount": 10 }
        ```

---

## 6. Notifications API

### Get Notifications
*   **Endpoint**: `GET /api/notifications`
*   **Responses**:
    *   `200 OK`: Returns last 20 notifications and unread count.
        ```json
        {
          "success": true,
          "notifications": [
            {
              "id": "notif-uuid",
              "title": "Complaint Acknowledged",
              "message": "Your complaint MNT-2026-000001 has been acknowledged.",
              "is_read": false,
              "complaint_id": "complaint-uuid",
              "created_at": "2026-07-16T08:00:00.000Z"
            }
          ],
          "unreadCount": 1
        }
        ```

### Mark Read / Mark All Read
*   **Endpoint**: `PUT /api/notifications`
*   **Request Body**:
    *   To read a single notification:
        ```json
        { "id": "notif-uuid" }
        ```
    *   To read all notifications (Mark All Read):
        ```json
        {}
        ```
*   **Responses**:
    *   `200 OK`: Updated.
        ```json
        { "success": true }
        ```
