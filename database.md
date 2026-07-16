# Database Schema Guide

This document describes the database design, model properties, constraints, indexes, cascade delete boundaries, and relationships inside the PostgreSQL schema.

---

## 1. Entity Relationship (ER) Diagram

The relationships between database models are illustrated below:

```mermaid
erDiagram
    User ||--o{ Complaint : "raises (StudentComplaints)"
    User ||--o{ ComplaintUpdate : "updates (UpdatedByUser)"
    User ||--o{ AuditLog : "triggers (UserAuditLogs)"
    User ||--o{ Notification : "receives (NotificationToUser)"
    User ||--o{ StudentImport : "uploads (UserImports)"
    
    Complaint ||--o{ ComplaintUpdate : "timeline (updates relation)"
    Complaint ||--o{ Notification : "notifies (complaint relation)"
    
    StudentImport ||--o{ ImportRecord : "stages (records relation)"

    User {
        string id PK
        string registration_number UK "Nullable"
        string name
        datetime date_of_birth "Nullable"
        string email "Nullable"
        string phone_number "Nullable"
        string password_hash
        enum role "ADMIN | STUDENT | RC"
        string room_number "Nullable"
        boolean must_change_password
        boolean is_active
        int token_version
        datetime created_at
        datetime updated_at
    }

    Complaint {
        string id PK
        string complaint_code UK "MNT-YYYY-XXXXXX"
        string student_id FK
        string title
        string description
        string category "Electrical | Plumbing | Carpentry | Masonry | Housekeeping | Others"
        string image_url "Nullable"
        enum status "SUBMITTED | ACKNOWLEDGED | IN_PROGRESS | AWAITING_STUDENT_CONFIRMATION | AWAITING_RC_VERIFICATION | REOPENED | CLOSED"
        datetime created_at
        datetime updated_at
        datetime resolved_at "Nullable"
        datetime closed_at "Nullable"
    }

    ComplaintUpdate {
        string id PK
        string complaint_id FK
        string updated_by_id FK
        enum previous_status
        enum new_status
        string remarks "Nullable"
        datetime created_at
    }

    Notification {
        string id PK
        string user_id FK
        string complaint_id FK "Nullable"
        string title
        string message
        boolean is_read
        datetime created_at
    }

    AuditLog {
        string id PK
        string performed_by FK
        string action
        string entity_type
        string entity_id
        string description
        datetime created_at
    }

    StudentImport {
        string id PK
        string uploaded_by FK
        string original_filename
        int total_records
        int successful_records
        int failed_records
        string status "PENDING | CONFIRMED | REJECTED"
        datetime created_at
    }

    ImportRecord {
        string id PK
        string import_id FK
        string registration_number
        string name
        datetime date_of_birth
        string email "Nullable"
        string phone_number "Nullable"
        string room_number
        string status "VALID | INVALID | DUPLICATE"
        string error_message "Nullable"
        datetime created_at
    }
```

---

## 2. Table Column Configurations & Constraints

### Users Table (`users`)
*   `registration_number`: Unique constraint (`@unique`). Nullable because administrators and RCs do not possess Anna University student registrations.
*   `date_of_birth`: Nullable. Required by application-level validation only during student creation.
*   `room_number`: Nullable. Required for students.
*   `is_active`: Defaults to `true`. Deactivation locks logins immediately.
*   `token_version`: Defaults to `0`. Incremented on password changes to invalidate active cookie JWTs.

### Complaints Table (`complaints`)
*   `complaint_code`: Unique constraint (`@unique`). Formatted as `MNT-[YEAR]-[6-DIGIT-SEQUENCE]` (e.g. `MNT-2026-000001`).
*   `status`: Defaults to `SUBMITTED`.
*   `resolved_at` / `closed_at`: Timestamp logs stored during work progression and official verification closure.

---

## 3. Indexes & Performance Tuning

Indexes are configured on all columns evaluated in filters, sorts, search operations, or joins:

*   **Users Table**:
    *   `@@index([registration_number])`
    *   `@@index([role])`
    *   `@@index([room_number])`
    *   `@@index([is_active])`
*   **Complaints Table**:
    *   `@@index([complaint_code])`
    *   `@@index([student_id])`
    *   `@@index([status])`
    *   `@@index([category])`
    *   `@@index([created_at])`
*   **Complaint Updates Table**:
    *   `@@index([complaint_id])`
*   **Notifications Table**:
    *   `@@index([user_id])`
    *   `@@index([is_read])`
*   **Audit Logs Table**:
    *   `@@index([performed_by])`
    *   `@@index([created_at])`

---

## 4. Delete Cascade Behaviors

Database relationships are protected by cascading boundary rules to maintain transactional safety:

*   **Restrict Deletion (`onDelete: Restrict`)**:
    *   `User` cannot be deleted if they are referenced by any existing `Complaint`, staged `StudentImport`, or `AuditLog`.
*   **Cascade Deletion (`onDelete: Cascade`)**:
    *   Deleting a `Complaint` automatically purges all connected `ComplaintUpdate` timeline traces.
    *   Deleting a `User` automatically purges all connected `Notification` records.
    *   Deleting a `StudentImport` log automatically deletes all raw staged sheet records in `ImportRecord`.
*   **Set Null Deletion (`onDelete: SetNull`)**:
    *   Deleting a `Complaint` preserves the `Notification` entry in the student's inbox but sets the relative `complaint_id` foreign key to `NULL`.
