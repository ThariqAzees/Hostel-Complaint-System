# Deployment, Installation, & Testing Manual

This document provides a guide to setting up, running, testing, and deploying the Hostel Complaint Management System in local and production environments.

---

## 1. Local Development Setup

### System Prerequisites
*   Node.js (v18.x or higher)
*   NPM (v9.x or higher)
*   PostgreSQL Database instance

### Step-by-Step Installation
1.  **Clone / Download** the repository to your host system or WSL environment.
2.  **Install Node Modules**:
    ```bash
    npm install
    ```
3.  **Configure Environment Variables**:
    Create a `.env` file in the root folder (see section 2).
4.  **Database Migration**:
    Initialize database schema tables:
    ```bash
    npx prisma migrate dev --name init
    ```
5.  **Generate Prisma Client**:
    Compile database types inside the custom generated folder path:
    ```bash
    npx prisma generate
    ```
6.  **Seeding Database**:
    Seed default administrative, counselor, and student accounts:
    ```bash
    npx prisma db seed
    ```
7.  **Run Development Server**:
    Start Next.js with Turbopack (default in dev scripts):
    ```bash
    npm run dev
    ```
    Access the portal at: **`http://localhost:3000`** (or `http://127.0.0.1:3000`).

---

## 2. Environment Variables Configuration

Create a `.env` file in the root folder with the following variables:

```env
# Database connection string
DATABASE_URL="postgresql://db_user:db_pass@db_host:5432/db_name?schema=public"

# Session JWT cookie signing key (Change in production!)
JWT_SECRET="super-secret-key-for-mantharai-hostel-complaint-system-2026"

# Host address used by CSRF validator to verify request origin
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Node Environment
NODE_ENV="development"

# --- Student Import Optimization Settings ---
# Concurrency limit for parallel password hashing (default: 8)
IMPORT_HASH_CONCURRENCY=8

# Timeout (in seconds) after which a processing batch is considered stuck/failed (default: 120)
IMPORT_HEARTBEAT_TIMEOUT_SECONDS=120

# Interval (in seconds) between database heartbeat updates during import processing (default: 10)
IMPORT_HEARTBEAT_INTERVAL_SECONDS=10
```

---

## 3. Default Seed Accounts

The database seed script generates the following default credentials for testing and development:

*   **ADMIN**:
    *   Username/Email: `admin@ech.com`
    *   Password: `admin_password`
*   **RC (Residential Counselor)**:
    *   Username/Email: `rc@ech.com`
    *   Password: `rc_password`
*   **STUDENT 1**:
    *   Registration No: `2023105001`
    *   Initial Password: `150305` (Date of Birth: 15-03-2005)
*   **STUDENT 2**:
    *   Registration No: `2023105002`
    *   Initial Password: `220704` (Date of Birth: 22-07-2004)

---

## 4. Production Build & Deployment

### Compilation & Build
To build the application for a production environment:
1.  Verify the production database is connected via `DATABASE_URL` in `.env`.
2.  Set `NODE_ENV="production"` in your environment.
3.  Compile static pages, build typescript types, and generate dynamic routes:
    ```bash
    npm run build
    ```
4.  Start the Next.js production server:
    ```bash
    npm run start
    ```

---

## 5. Security & Verification Testing

### Production Readiness Checklist
Before migrating to public deployment, verify that:
*   [x] **Session Invalidations**: Password changes dynamically increment `token_version` to invalidate old cookie sessions.
*   [x] **CSRF Headers**: All mutating APIs check `origin`/`referer` match.
*   [x] **Upload Validations**: Upload files are capped at 5MB, format checked (`JPEG`, `PNG`, `WebP`), and given a random UUID filename.
*   [x] **Role-Based Guards**: Middleware guards prevent cross-access between Student, RC, and Admin.

---

## 6. Known Limitations & Future Enhancements

### Limitations
1.  **Single Block Focus**: Configured specifically for Mantharai Block residents (2 floors, 108 rooms). Adding multi-hostel support requires introducing block/block-group mapping keys.
2.  **In-App Alerts only**: Notifications are currently in-app only, displayed on the bell dropdown and history pages.
3.  **Local Photo Storage**: Images are uploaded directly to the local disk server. This is efficient for single-host server instances, but needs migration to cloud stores (like AWS S3 or Google Cloud Storage) if scaled across multi-region server clusters.

### Enhancements
1.  **SMS/Email Gateway Integration**: Hook up notifications to Twilio or SendGrid APIs to alert students immediately when the RC updates a complaint status.
2.  **Advanced Analytics**: Expand the Admin Dashboard with resolution metrics (e.g. average time to close, issues per room, category counts).
3.  **Calendar Scheduling**: Allow RCs to schedule inspection time slots so students can select a time for electricians or plumbers to enter their room.

---

## 7. Temporary LAN Deployment (Hostel Wi-Fi)

To temporarily host this application on the hostel or college Wi-Fi so students can access it from their laptops or mobile phones without deploying to the public internet:

### Host Scenarios
1. **Using a Laptop**: Useful for temporary local demonstrations or tests in a block common area.
2. **Using the RC Office Computer**: Ideal for running the system continuously on a low-spec block server PC.
3. **Using Hostel Wi-Fi**: Both host PC and clients connect to the same local Wi-Fi router.

### Steps to Run
1. **Connect to Wi-Fi**: Connect the Host PC/Laptop to the Wi-Fi network.
2. **Bind to 0.0.0.0**: Execute the dev or start script. Because the default script bindings have been updated, running `npm start` or `npm run dev` automatically listens on all network interfaces (`0.0.0.0`). If port 3000 is already in use, the server will fall back to an open port (e.g., 3001) automatically.
3. **Get the Local LAN IP**:
   - The active LAN IPv4 and runtime port are displayed dynamically in the server startup diagnostic banner.
4. **Distribute the Address**: Share the LAN address: `http://<YOUR_IP>:<PORT>`. Admin users can log in and visit the `/lan` page to access the offline connection QR code.

For detailed networking instructions, firewall configuration commands, and WSL VM setup, consult the [Firewall Guide](file:///c:/Users/acer/Downloads/project/Hostel/firewall.md).
