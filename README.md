# ECH Hostel Complaint Management System (CMS) — Mantharai Block

A specialized portal designed to help **Residential Counselors (RCs)** track, manage, and verify maintenance complaints raised by residents of the Mantharai Block at Engineering College Hostels (ECH), Anna University.

---

## 1. Key Features for RCs
* **Central Complaint Queue**: View, search, and filter complaints by Room, Category, Status, or Priority.
* **Overdue Escalations**: Automatically flags complaints unresolved for more than 3 days as `HIGH` priority, highlighting them in the dashboard warning banner.
* **Notification System**: Immediate in-app alerts for new submissions, student re-openings, and overdue sweeps.
* **Verification & Closure**: Add counselor remarks and verify completed repairs before closing.

---

## 2. Default Access Credentials
To access the system, use the following default account details:

| Role | Username / Registration No. | Password / Temp Password | Purpose |
| :--- | :--- | :--- | :--- |
| **Residential Counselor (RC)** | `rc@ech.com` | `rc_password` | Manage and close complaints |
| **System Administrator** | `admin@ech.com` | `admin_password` | Account and student database setup |

---

## 3. Complaint Lifecycle Workflow
All status transitions occur transactionally inside a central state machine. RCs oversee the following workflow:

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

---

## 4. Setup & Quick Start

### Step 1: Environment Configuration
Create a `.env` file in the root directory:
```env
DATABASE_URL="postgresql://hostel_user:hostel_pass@localhost:5432/hostel_db?schema=public"
JWT_SECRET="super-secret-key-for-mantharai-hostel-complaint-system-2026"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NODE_ENV="development"
```

### Step 2: Install and Initialize Database
```bash
# Install dependencies
npm install

# Run database migrations
npx prisma migrate dev --name init

# Generate Prisma client types
npx prisma generate

# Seed default accounts (RC, Admin, Students)
npx prisma db seed
```

### Step 3: Run the Server
* **Development Mode**: `npm run dev`
* **Production Mode**: 
  ```bash
  npm run build
  npm start
  ```

---

## 5. Hosting on Hostel Wi-Fi (LAN Access)
To run the server on the hostel Wi-Fi network so students and RCs can access the portal from their mobile devices offline:

1. **Start the server** in development or production mode (the server automatically binds to `0.0.0.0` to listen on all local network interfaces).
2. **Retrieve the LAN IP** displayed in the startup terminal logs (e.g., `http://192.168.1.15:3000`).
3. Connect any mobile phone or laptop to the **same Wi-Fi network** and navigate to the displayed URL.
4. RCs can log in and visit the `/lan` page to view connection statuses and view/print the offline connection QR code.
