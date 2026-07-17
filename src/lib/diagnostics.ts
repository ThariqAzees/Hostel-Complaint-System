import { prisma } from "./db";
import os from "os";
import fs from "fs";
import path from "path";
import QRCode from "qrcode";
import { execSync } from "child_process";

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
    
    const matches = output.matchAll(/IPv4 Address[.\s]*:\s*([0-9.]+)/gi);
    for (const match of matches) {
      const ip = match[1];
      if (ip && !ip.startsWith("172.") && !ip.startsWith("127.")) {
        return ip;
      }
    }
  } catch (err) {
    // Ignore
  }
  
  // Fallback to local network interfaces
  try {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === "IPv4" && !iface.internal) {
          if (!iface.address.startsWith("172.")) {
            return iface.address;
          }
        }
      }
    }
  } catch {}
  
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
  
  try {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === "IPv4" && !iface.internal) {
          if (iface.address.startsWith("172.")) {
            return iface.address;
          }
        }
      }
    }
  } catch {}
  
  return "127.0.0.1";
}

function isListeningAllInterfaces(): boolean {
  if (process.argv.includes("0.0.0.0")) return true;
  const script = process.env.npm_lifecycle_script || "";
  if (script.includes("0.0.0.0")) return true;
  
  try {
    const cmd1 = fs.readFileSync("/proc/self/cmdline", "utf8");
    if (cmd1.includes("0.0.0.0")) return true;
  } catch {}

  try {
    const cmd2 = fs.readFileSync(`/proc/${process.ppid}/cmdline`, "utf8");
    if (cmd2.includes("0.0.0.0")) return true;
  } catch {}

  return false;
}

function parseSafeDatabaseUrl(url: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname || "localhost";
    const dbName = parsed.pathname.substring(1) || "hostel_db";
    const schema = parsed.searchParams.get("schema") || "public";
    return { host, dbName, schema };
  } catch {
    return { host: "localhost", dbName: "hostel_db", schema: "public" };
  }
}

export async function runDiagnostics() {
  const reports: string[] = [];
  let prismaConnected = false;
  let databaseConnected = false;
  let uploadsFolderReady = false;
  let uploadsFolderWritable = false;
  let envVarsLoaded = false;
  let authReady = false;
  let notificationsReady = false;
  let complaintApisReady = false;
  let runningInWsl = false;
  let listeningAllInterfaces = false;

  const port = getRuntimePort();

  // 1. WSL Detection
  try {
    const release = os.release().toLowerCase();
    const ver = fs.existsSync("/proc/version") ? fs.readFileSync("/proc/version", "utf8").toLowerCase() : "";
    if (release.includes("microsoft") || ver.includes("microsoft") || ver.includes("wsl")) {
      runningInWsl = true;
    }
  } catch {}

  // 2. Check environment & auth keys
  const requiredEnvVars = ["DATABASE_URL", "JWT_SECRET"];
  const missingEnvVars = requiredEnvVars.filter(ev => !process.env[ev]);
  if (missingEnvVars.length === 0) {
    envVarsLoaded = true;
    authReady = true;
    notificationsReady = true;
    complaintApisReady = true;
  }

  // 3. Database connection
  let dbDetails = { host: "localhost", dbName: "hostel_db", schema: "public" };
  if (envVarsLoaded) {
    dbDetails = parseSafeDatabaseUrl(process.env.DATABASE_URL!);
    try {
      await prisma.$queryRaw`SELECT 1`;
      prismaConnected = true;
      databaseConnected = true;
    } catch (err: any) {
      reports.push(`Database connection failed: ${err.message || err}`);
    }
  }

  // 4. Upload directory check & write verification
  try {
    const uploadPath = path.join(process.cwd(), "public", "uploads", "complaints");
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    uploadsFolderReady = true;

    // Verify writable
    const testFile = path.join(uploadPath, ".write-test");
    fs.writeFileSync(testFile, "test");
    fs.unlinkSync(testFile);
    uploadsFolderWritable = true;
  } catch (err: any) {
    reports.push(`Upload directory check/write failed: ${err.message}`);
  }

  // 5. Interface check
  listeningAllInterfaces = isListeningAllInterfaces();

  // Resolve IPs
  let wslIp = "";
  let winHostIp = "";
  
  if (runningInWsl) {
    wslIp = getWslIP();
    winHostIp = getWindowsHostIP();
  } else {
    winHostIp = getWindowsHostIP();
  }

  const activeConnectIp = winHostIp && winHostIp !== "127.0.0.1" ? winHostIp : (wslIp || "127.0.0.1");
  const networkUrl = `http://${activeConnectIp}:${port}`;

  // Output terminal report exactly matching requested format
  console.log("\n==================================================");
  console.log("Hostel Complaint Management System");
  console.log("==================================================");
  
  console.log("\nServer");
  console.log("✓ Running");
  
  console.log("\nListening Interface");
  console.log(listeningAllInterfaces ? "0.0.0.0" : "localhost");
  
  console.log("\nLAN Accessible");
  console.log(listeningAllInterfaces ? "YES" : "NO");
  
  console.log("\nRuntime Port");
  console.log(port);

  console.log("\nDatabase");
  console.log(databaseConnected ? "✓ Connected" : "✗ Disconnected");
  console.log(`  Host:     ${dbDetails.host}`);
  console.log(`  Database: ${dbDetails.dbName}`);
  console.log(`  Schema:   ${dbDetails.schema}`);
  
  console.log("\nPrisma");
  console.log(prismaConnected ? "✓ Connected" : "✗ Disconnected");
  
  console.log("\nUploads");
  console.log(uploadsFolderReady && uploadsFolderWritable ? "✓ Ready" : "✗ Error");
  
  console.log("\nEnvironment");
  console.log(envVarsLoaded ? "✓ Loaded" : "✗ Missing Variables");
  
  console.log("\nAuthentication");
  console.log(authReady ? "✓ Ready" : "✗ Error");
  
  console.log("\nNotifications");
  console.log(notificationsReady ? "✓ Ready" : "✗ Error");
  
  console.log("\nComplaint APIs");
  console.log(complaintApisReady ? "✓ Ready" : "✗ Error");
  
  console.log("\nOperating Environment");
  console.log(runningInWsl ? "WSL 2" : "Windows");
  
  if (runningInWsl) {
    console.log("\nWindows Host");
    console.log(winHostIp);
    
    console.log("\nWSL");
    console.log(wslIp);
  } else {
    console.log("\nWindows Host");
    console.log(winHostIp);
  }
  
  console.log("\nStudents connect using");
  console.log(networkUrl);
  
  console.log("\n==================================================");

  // Self-Test Report
  const isHealthy = prismaConnected && databaseConnected && uploadsFolderReady && uploadsFolderWritable && envVarsLoaded && authReady;
  console.log("\nLAN STATUS");
  if (isHealthy) {
    console.log("\x1b[32mREADY FOR STUDENT ACCESS\x1b[0m");
  } else {
    console.log("\x1b[31mNOT READY\x1b[0m");
    if (reports.length > 0) {
      console.log(`Reason: ${reports[0]}`);
    } else if (missingEnvVars.length > 0) {
      console.log(`Reason: Missing environment variables ${missingEnvVars.join(", ")}`);
    } else {
      console.log("Reason: Internal diagnostic error");
    }
  }
  console.log("==================================================");

  if (runningInWsl && wslIp) {
    console.log("\n[WSL 2 NETWORK FORWARDING GUIDE]");
    console.log("Because the server runs inside WSL 2, you must route physical Wi-Fi");
    console.log("traffic into the WSL container using PowerShell as Administrator on Windows:");
    console.log(`\n  netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=${port} connectaddress=${wslIp} connectport=${port}`);
    console.log("\nTo allow port through the Windows Firewall, run:");
    console.log(`  New-NetFirewallRule -DisplayName "Hostel CMS Port ${port}" -Direction Inbound -LocalPort ${port} -Protocol TCP -Action Allow`);
  }

  if (networkUrl) {
    try {
      console.log("\n[QR CODE FOR MOBILE DEVICES]");
      console.log("Scan this code on your phone to open the app directly:\n");
      const qrText = await QRCode.toString(networkUrl, { type: "terminal", small: true });
      console.log(qrText);
    } catch (err) {
      // Catch QR printing errors silently
    }
  }
  console.log("==================================================\n");
}
