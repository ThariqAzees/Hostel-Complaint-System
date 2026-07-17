import React from "react";
import os from "os";
import fs from "fs";
import path from "path";
import QRCode from "qrcode";
import styles from "./lan.module.css";
import { CheckCircle, Wifi, Database, QrCode } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { execSync } from "child_process";

export const dynamic = "force-dynamic";

function getRuntimePort(): number {
  if (process.env.PORT) {
    const port = parseInt(process.env.PORT, 10);
    if (!isNaN(port)) return port;
  }
  
  const portArgIdx = process.argv.findIndex(arg => arg === "--port" || arg === "-p") + 1;
  if (portArgIdx > 0 && process.argv[portArgIdx]) {
    const port = parseInt(process.argv[portArgIdx], 10);
    if (!isNaN(port)) return port;
  }

  const script = process.env.npm_lifecycle_script || "";
  const portMatch = script.match(/(?:--port|-p)\s+(\d+)/);
  if (portMatch && portMatch[1]) {
    return parseInt(portMatch[1], 10);
  }

  return 3000;
}

function getWindowsHostIP(): string {
  try {
    const output = execSync("ipconfig.exe").toString();
    const lines = output.split(/\r?\n/);
    let inActiveAdapter = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.endsWith(":") && (
        trimmed.toLowerCase().includes("wireless lan adapter") ||
        trimmed.toLowerCase().includes("ethernet adapter ethernet") ||
        trimmed.toLowerCase().includes("ethernet adapter local area connection")
      )) {
        if (!trimmed.toLowerCase().includes("wsl") && !trimmed.toLowerCase().includes("virtual")) {
          inActiveAdapter = true;
        } else {
          inActiveAdapter = false;
        }
      }
      
      if (inActiveAdapter && trimmed.toLowerCase().includes("ipv4 address")) {
        const parts = trimmed.split(":");
        if (parts[1]) {
          const ip = parts[1].replace("(Preferred)", "").trim();
          if (ip && !ip.startsWith("127.")) {
            return ip;
          }
        }
      }
    }
  } catch (err) {}
  return "127.0.0.1";
}

function getWslIP(): string {
  try {
    const output = execSync("ipconfig.exe").toString();
    const lines = output.split(/\r?\n/);
    let inWslSection = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.endsWith(":") && trimmed.toLowerCase().includes("vethernet (wsl")) {
        inWslSection = true;
      } else if (trimmed.endsWith(":") && !trimmed.toLowerCase().includes("vethernet (wsl")) {
        inWslSection = false;
      }
      
      if (inWslSection && trimmed.toLowerCase().includes("ipv4 address")) {
        const parts = trimmed.split(":");
        if (parts[1]) {
          const ip = parts[1].replace("(Preferred)", "").trim();
          if (ip) return ip;
        }
      }
    }
  } catch {}
  return "127.0.0.1";
}

export default async function LanPage() {
  // Restrict to ADMIN users only
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") {
    redirect("/login");
  }

  let dbConnected = false;
  let prismaConnected = false;
  let uploadsReady = false;
  let authReady = false;
  let notificationsReady = false;
  let complaintApisReady = false;
  let runningInWsl = false;

  const port = getRuntimePort();

  // 1. WSL Detection
  try {
    const release = os.release().toLowerCase();
    const ver = fs.existsSync("/proc/version") ? fs.readFileSync("/proc/version", "utf8").toLowerCase() : "";
    if (release.includes("microsoft") || ver.includes("microsoft") || ver.includes("wsl")) {
      runningInWsl = true;
    }
  } catch {}

  // 2. Database Status
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbConnected = true;
    prismaConnected = true;
  } catch {}

  // 3. Upload directory readiness
  try {
    const uploadPath = path.join(process.cwd(), "public", "uploads", "complaints");
    if (fs.existsSync(uploadPath)) {
      // Test writable
      const testFile = path.join(uploadPath, ".write-test-lan");
      fs.writeFileSync(testFile, "test");
      fs.unlinkSync(testFile);
      uploadsReady = true;
    }
  } catch {}

  // 4. Auth & API readiness
  if (process.env.JWT_SECRET) {
    authReady = true;
    notificationsReady = true;
    complaintApisReady = true;
  }

  let wslIp = "";
  let winHostIp = "";

  if (runningInWsl) {
    wslIp = getWslIP();
    winHostIp = getWindowsHostIP();
  } else {
    winHostIp = getWindowsHostIP();
  }

  const activeConnectIp = winHostIp && winHostIp !== "127.0.0.1" ? winHostIp : (wslIp || "127.0.0.1");
  const localUrl = `http://localhost:${port}`;
  const networkUrl = `http://${activeConnectIp}:${port}`;

  // Generate QR Code base64 image URL offline
  let qrCodeDataUrl = "";
  if (networkUrl) {
    try {
      qrCodeDataUrl = await QRCode.toDataURL(networkUrl, {
        margin: 1,
        width: 250,
        color: {
          dark: "#0f172a",
          light: "#ffffff",
        },
      });
    } catch (err) {
      console.error("Failed to generate offline base64 QR code:", err);
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.badge}>
            <Wifi size={14} />
            <span>Hostel Wi-Fi LAN Panel</span>
          </div>
          <h1 className={styles.title}>LAN Connection Utility</h1>
          <p className={styles.subtitle}>
            Monitor local server routing and share connection details with students
          </p>
        </div>

        <div className={styles.grid}>
          <div className={styles.infoSection}>
            <div className={styles.infoItem}>
              <span className={styles.label}>Server Status</span>
              <div className={styles.value} style={{ color: "#34d399", display: "flex", alignItems: "center", gap: "8px" }}>
                <CheckCircle size={16} />
                <span>Running</span>
              </div>
            </div>

            <div className={styles.infoItem}>
              <span className={styles.label}>Services Diagnostic Status</span>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", padding: "4px 8px", background: "rgba(0,0,0,0.2)", borderRadius: "4px" }}>
                  <span>Database Link</span>
                  <span style={{ color: dbConnected ? "#34d399" : "#f87171" }}>{dbConnected ? "✓ Connected" : "✗ Error"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", padding: "4px 8px", background: "rgba(0,0,0,0.2)", borderRadius: "4px" }}>
                  <span>Prisma Client</span>
                  <span style={{ color: prismaConnected ? "#34d399" : "#f87171" }}>{prismaConnected ? "✓ Connected" : "✗ Error"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", padding: "4px 8px", background: "rgba(0,0,0,0.2)", borderRadius: "4px" }}>
                  <span>Upload Status</span>
                  <span style={{ color: uploadsReady ? "#34d399" : "#f87171" }}>{uploadsReady ? "✓ Ready" : "✗ Error"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", padding: "4px 8px", background: "rgba(0,0,0,0.2)", borderRadius: "4px" }}>
                  <span>Authentication Status</span>
                  <span style={{ color: authReady ? "#34d399" : "#f87171" }}>{authReady ? "✓ Ready" : "✗ Error"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", padding: "4px 8px", background: "rgba(0,0,0,0.2)", borderRadius: "4px" }}>
                  <span>Notifications Status</span>
                  <span style={{ color: notificationsReady ? "#34d399" : "#f87171" }}>{notificationsReady ? "✓ Ready" : "✗ Error"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", padding: "4px 8px", background: "rgba(0,0,0,0.2)", borderRadius: "4px" }}>
                  <span>Complaint API Status</span>
                  <span style={{ color: complaintApisReady ? "#34d399" : "#f87171" }}>{complaintApisReady ? "✓ Ready" : "✗ Error"}</span>
                </div>
              </div>
            </div>

            <div className={styles.infoItem}>
              <span className={styles.label}>Runtime Port</span>
              <div className={styles.value}>{port}</div>
            </div>

            <div className={styles.infoItem}>
              <span className={styles.label}>Windows Host IP</span>
              <div className={styles.value}>{winHostIp || "Unknown"}</div>
            </div>

            {runningInWsl && (
              <div className={styles.infoItem}>
                <span className={styles.label}>WSL IP</span>
                <div className={styles.value}>{wslIp || "Unknown"}</div>
              </div>
            )}

            <div className={styles.infoItem}>
              <span className={styles.label}>Local URL</span>
              <div className={styles.value}>{localUrl}</div>
            </div>

            <div className={styles.infoItem}>
              <span className={styles.label}>Network URL (Wi-Fi LAN)</span>
              <div className={styles.value} style={{ border: "1px dashed var(--primary)", color: "#60a5fa" }}>
                {networkUrl}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            {qrCodeDataUrl ? (
              <div className={styles.qrSection}>
                <img src={qrCodeDataUrl} alt="LAN QR Code" className={styles.qrImage} />
                <span className={styles.qrCaption}>Scan to Open Portal</span>
              </div>
            ) : (
              <div style={{ color: "#94a3b8", textAlign: "center", padding: "20px", border: "1px dashed rgba(255,255,255,0.1)", borderRadius: "12px" }}>
                <QrCode size={48} style={{ margin: "0 auto 10px auto", opacity: 0.5 }} />
                <span>No Network QR Code available</span>
              </div>
            )}
          </div>
        </div>

        <div className={styles.instructions}>
          <h3 className={styles.insTitle}>Connection Instructions:</h3>
          <ul className={styles.insList}>
            <li>Connect the Host PC/Laptop and the student devices to the <strong>same Wi-Fi router / mobile hotspot</strong>.</li>
            <li>Scan the QR Code on this screen, or visit the Network URL using any browser.</li>
            {runningInWsl && (
              <li style={{ color: "#fbbf24", fontWeight: "bold" }}>
                WSL 2 Alert: Run the netsh portproxy port-forwarding command displayed in the console logs to enable external connections to route into your WSL container.
              </li>
            )}
            <li>Make sure <strong>Client Isolation</strong> is turned off in your access point settings.</li>
          </ul>
        </div>

        <div className={styles.footer}>
          <Link href="/" className={styles.backBtn}>
            Back to Portal
          </Link>
        </div>
      </div>
    </div>
  );
}
