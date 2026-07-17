# Engineering College Hostels (ECH), Anna University — Mantharai Block
## Hostel Complaint Management System (CMS)

A production-ready Complaint Management System specifically developed for **Mantharai Block** residents of Engineering College Hostels (ECH), Anna University. The application serves 2 floors and 108 rooms, providing streamlined complaint raising, tracking, Residential Counselor (RC) verification, and closure workflows.

---

## Technical Documentation
For detailed insights into specific system layers, refer to the following guides:
*   [System Architecture Guide](./architecture.md): System layout, folder design, JWT authentication flow, and RBAC matrix.
*   [API Documentation Reference](./api.md): Endpoints, JSON payloads, responses, file upload parameters, and CSRF protection headers.
*   [Database Schema Guide](./database.md): Model relationships, ER diagram, index optimizations, and cascade rules.
*   [Deployment & Installation Guide](./deployment.md): Local installation, database setup, environment variables, seeding, testing, and production builds.

---

## 1. Project Overview & Architecture

The application is structured as a single-block, multi-role complaint handling system. It defines strict access control boundaries for three distinct roles:
*   **STUDENT**: Residence room occupants who raise complaints, verify repairs, or reopen incomplete tasks.
*   **RC (Residential Counselor)**: The administrative coordinator who reviews block complaints, manages repair stages, and closes resolved issues.
*   **ADMIN**: Hostel management personnel who oversee accounts, manage student databases (including bulk Excel staging), and track system-wide logs.

The architecture is designed to keep data models clean and decoupled. While optimized specifically for Mantharai Block, the code structure makes no hardcoded multi-hostel assumptions, enabling future block expansions by adding a block identifier column without complete rewrite.

---

## 2. Technology Stack

*   **Framework**: Next.js (App Router with Promise-based route parameter handling)
*   **Database ORM**: Prisma (PostgreSQL connector)
*   **Language**: TypeScript
*   **Security/Session**: JWT sessions saved in HttpOnly, SameSite secure cookies, paired with CSRF Origin/Referer request validation
*   **Styling**: Vanilla CSS Modules (styled using curated HSL values, responsive grid layouts, and glassmorphism accents)
*   **Icons**: Lucide React

---

## 3. Folder Structure

```text
├── prisma/
│   ├── schema.prisma             # PostgreSQL Database Schema
│   └── seed.ts                   # Initial Seed Scripts (Admin, RC, Students)
├── public/
│   └── uploads/                  # User Image Attachments
│       └── complaints/           # Securely stored complaint uploads
├── src/
│   ├── app/
│   │   ├── admin/                # Administrator Views & Staging Pages
│   │   ├── student/              # Student Dashboard, Directory, & Submissions
│   │   ├── rc/                   # RC Dashboard, Queue, & Actions
│   │   ├── api/                  # API Route Handlers (Auth, Admin, Student, RC, Notifications)
│   │   ├── login/                # Authentication page
│   │   └── change-password/      # Enforced security reset page
│   ├── components/               # Shareable components (Notification bell, lists)
│   ├── config/                   # Global configuration (Block name, limits)
│   ├── generated/                # Automatically generated Prisma files
│   ├── lib/
│   │   ├── auth.ts               # Session token signed, parsed, and validated
│   │   ├── db.ts                 # Prisma DB instance manager
│   │   └── state-machine.ts      # Centralized database state machine
│   └── middleware.ts             # Global session guards, redirects, and role gates
└── README.md                     # Project documentation
```

---

## 4. Database Setup & Prisma Commands

Make sure a PostgreSQL database is running locally or remotely.

1.  **Configure Environment Variables**:
    Create a `.env` file in the root directory (see section 5).
2.  **Run Migrations**:
    Apply current schema migrations to the PostgreSQL database:
    ```bash
    npx prisma migrate dev --name init
    ```
3.  **Generate Prisma Client**:
    Compile database types inside the custom generated path:
    ```bash
    npx prisma generate
    ```
4.  **Seed the Database**:
    Initialize default accounts (Admin, RC, Students):
    ```bash
    npx prisma db seed
    ```

---

## 5. Environment Variables

The application expects the following variables in the `.env` file:

```env
# PostgreSQL database connection string
DATABASE_URL="postgresql://hostel_user:hostel_pass@localhost:5432/hostel_db?schema=public"

# Secret string used to sign Session JWT tokens
JWT_SECRET="super-secret-key-for-mantharai-hostel-complaint-system-2026"

# Host address used by CSRF validator to verify request origin
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Node Environment
NODE_ENV="development"
```

---

## 6. Default Development Accounts

The database seed script generates the following credentials:

| Role      | Username / Registration No. | Password / Temp Password | Account Details                   |
| :-------- | :-------------------------- | :----------------------- | :-------------------------------- |
| **ADMIN** | `admin@ech.com`             | `admin_password`         | System Administrator              |
| **RC**    | `rc@ech.com`                | `rc_password`            | Residential Counselor             |
| **STUDENT**| `2023105001`                | `150305`                 | Student 1 (DOB: 15-03-2005, Rm 101)|
| **STUDENT**| `2023105002`                | `220704`                 | Student 2 (DOB: 22-07-2004, Rm 102)|
| **STUDENT**| `2023105003`                | `051205`                 | Student 3 (DOB: 05-12-2005, Rm 103)|

*Note: Newly imported students default to `must_change_password = true`, requiring them to set a custom password on their first login. Temporary passwords are generated from their Date of Birth in `DDMMYY` format.*

---

## 7. Complaint Lifecycle Workflow

All status transitions occur transactionally inside the central state machine.

### Transition Matrix

```mermaid
stateDiagram-v2
    [*] --> SUBMITTED : Student submits complaint
    SUBMITTED --> ACKNOWLEDGED : RC Acknowledges
    REOPENED --> ACKNOWLEDGED : RC Acknowledges
    
    ACKNOWLEDGED --> AWAITING_STUDENT_CONFIRMATION : Student marks Maintenance Completed
    
    AWAITING_STUDENT_CONFIRMATION --> REOPENED : Student Reopens (available after 2 days)
    AWAITING_STUDENT_CONFIRMATION --> AWAITING_RC_VERIFICATION : Student Confirms Fixed
    
    AWAITING_RC_VERIFICATION --> CLOSED : RC Verifies and Closes
    CLOSED --> [*]
```

At every transition, the state machine:
1.  Verifies current state matches prerequisite transition rules.
2.  Updates complaint status.
3.  Logs a `ComplaintUpdate` timeline trace containing remarks and updater ID.
4.  Generates a student or RC `Notification`.
5.  Inserts an administrative `AuditLog` record.

---

## 8. API Overview

All mutating endpoints require CSRF headers matching the application's origin.

### Authentication
*   `POST /api/auth/login`: Authenticates credentials, signs JWT session, sets secure cookie.
*   `POST /api/auth/logout`: Clears session cookie, revoking active access.
*   `POST /api/auth/change-password`: Resets temporary password, increments `token_version` to invalidate other devices.

### Student API
*   `POST /api/student/complaints`: Submits new complaint (supports `multipart/form-data` with optional JPEG/PNG/WebP uploads).
*   `POST /api/student/complaints/[id]/transition`: Transitions complaint (allows `STUDENT_MARK_COMPLETED`, `STUDENT_CONFIRM_FIXED`, and `STUDENT_REOPEN`).

### RC API
*   `POST /api/rc/complaints/[id]/transition`: Transitions complaint (allows `ACKNOWLEDGE` and `RC_VERIFY_CLOSE`).

### Admin API
*   `GET /api/admin/metrics`: Summary system KPIs (Total users, Active complaints, Closed complaints, Excel staging counts).
*   `POST /api/admin/students`: Creates a single student record.
*   `PUT /api/admin/students/[id]`: Modifies student details, deactivates account, or resets password.
*   `POST /api/admin/students/import`: Staged Excel file parse and upload.
*   `POST /api/admin/students/import/confirm`: Atomically commits staged students to active database.

### Notifications API
*   `GET /api/notifications`: Retrieves last 20 notifications for current user with unread counts.
*   `PUT /api/notifications`: Marks specific notification or all user notifications as read.

---

## 9. Security Features

*   **Cookie Security**: JWT tokens stored in `httpOnly`, `sameSite: "lax"`, and `secure` (production mode) cookies to protect against XSS token extraction.
*   **CSRF Shield**: Rejects state-modifying requests if request headers `origin` or `referer` do not match `host` or configuration variables.
*   **Session Revocation**: Password changes or administrative resets increment `token_version` in the database, instantly invalidating old cookies.
*   **Authorization Guard**: The global `middleware.ts` runs prior to page loads or API routing, checking roles and deactivation status.
*   **Directory Access Control**: Prisma queries automatically filter lists based on session context, preventing students from querying other rooms' complaints.

---

## 10. Running on Hostel Wi-Fi (LAN Hosting)

To temporarily host this application on your local Wi-Fi router so that any student connected to the same network can access it from their mobile phone or laptop:

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Build the Application
Compile code and build typescript static outputs:
```bash
npm run build
```

### Step 3: Start Server on All Interfaces
Binds the Next.js server to interface `0.0.0.0` (all network cards):
```bash
npm start
```
*Note: In development mode, run `npm run dev` (which is pre-configured to listen on all interfaces). If port 3000 is occupied, Next.js will automatically select an alternative port (e.g., 3001), which will be shown in the console.*

### Step 4: Find Local IP Address
The system automatically displays the correct connection IP in the server logs. Alternatively, check:
* **Windows**: `ipconfig` (Look for the Wireless LAN adapter Wi-Fi IPv4 address).
* **WSL 2 / Linux**: The active IP is displayed in the startup diagnostic console banner.

### Step 5: Open LAN Web Page
Open the system in any device browser connected to the same network:
```text
http://<YOUR_HOST_IP>:<PORT>
```
*(e.g., http://192.168.137.102:3000)*

Administrators can navigate to `/lan` after logging in to view live connection statuses and print/scan the offline QR code.
