import type { NextConfig } from "next";
import os from "os";
import { execSync } from "child_process";

function getLocalIPs(): string[] {
  const ips: string[] = [];
  
  // 1. Local interfaces inside WSL/Linux container
  try {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === "IPv4" && !iface.internal) {
          ips.push(iface.address);
        }
      }
    }
  } catch {}

  // 2. Windows Host IP via ipconfig.exe if running under WSL
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
            ips.push(ip);
          }
        }
      }
    }
  } catch (err) {
    // Not in WSL or ipconfig.exe not available
  }

  return Array.from(new Set(ips));
}

function getAllowedOrigins(): string[] {
  const ips = ["localhost", "127.0.0.1", ...getLocalIPs()];
  const origins: string[] = [];
  for (const ip of ips) {
    origins.push(ip);
    // Include all common development ports to support dynamic fallback ports (e.g. 3001)
    for (let port = 3000; port <= 3010; port++) {
      origins.push(`${ip}:${port}`);
    }
  }
  return origins;
}

const nextConfig: NextConfig = {
  allowedDevOrigins: getAllowedOrigins(),
  devIndicators: false,
};

export default nextConfig;
