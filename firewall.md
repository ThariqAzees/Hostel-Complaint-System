# LAN Wi-Fi Hosting & Firewall Setup Guide

This document details how to configure Windows Defender Firewall and Windows Subsystem for Linux (WSL 2) networking to successfully host this application on your local Wi-Fi or LAN.

---

## 1. Windows Defender Firewall Setup

To allow other devices (phones, laptops) on the same Wi-Fi network to access port 3000 on your host Windows PC, you must open incoming TCP traffic.

### Method A: Using PowerShell (Fastest)
1. Open the Start menu, search for **PowerShell**, right-click it, and select **Run as Administrator**.
2. Run the following command to allow incoming connections on port 3000:
   ```powershell
   New-NetFirewallRule -DisplayName "Hostel CMS Port 3000" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
   ```
   *Note: If the application starts on a different port (e.g., 3001), replace `3000` in the commands above and below with the actual runtime port printed in the startup report.*

### Method B: Manual Configuration (GUI)
1. Press `Win + R`, type `wf.msc`, and press **Enter** to open Windows Defender Firewall with Advanced Security.
2. Click **Inbound Rules** in the left panel.
3. Click **New Rule...** in the right panel.
4. Choose **Port** and click **Next**.
5. Select **TCP** and enter `3000` in **Specific local ports**, then click **Next**.
6. Select **Allow the connection** and click **Next**.
7. Check **Domain**, **Private**, and **Public** profiles, then click **Next**.
8. Name the rule `Hostel CMS Port 3000` and click **Finish**.

---

## 2. WSL 2 Networking & Port Forwarding

If you run the Node.js server inside a **WSL 2 container** (Linux virtual machine), Windows routes WSL traffic on a private virtual adapter. External devices on the physical Wi-Fi network cannot see the WSL environment directly.

To route incoming traffic from your physical Windows PC network card to the WSL instance:

### Step-by-Step Forwarding Setup
1. **Find your WSL IP Address**:
   Inside your WSL console, run:
   ```bash
   ip addr show eth0 | grep "inet "
   ```
   *(e.g., you will see an IP like `172.23.45.168`)*
2. **Configure Port Forwarding**:
   Open **PowerShell as Administrator** on Windows and run the following command (replace `<WSL_IP>` with the IP from Step 1):
   ```powershell
   netsh interface portproxy add v4tov4 listenport=3000 listenaddress=0.0.0.0 connectport=3000 connectaddress=<WSL_IP>
   ```
3. **Verify the Forwarding Rule**:
   ```powershell
   netsh interface portproxy show all
   ```

---

## 3. Wi-Fi Access Point "Client Isolation" Warning

Many institutional or enterprise Wi-Fi networks (and some home routers) enable a security feature called **Client Isolation** (sometimes labeled *AP Isolation*, *Wireless Isolation*, or *Station Isolation*).

* **What it does**: It blocks devices connected to the same wireless access point from communicating with each other. Even if your firewall is off and port forwarding is correct, students' phones will not be able to load the host IP.
* **How to fix it**:
  1. Access your router's administration portal.
  2. Locate **Wireless / Advanced Wireless Settings**.
  3. Turn **Client Isolation / AP Isolation** to **Disabled**.
  4. Alternatively, use a **mobile phone hotspot** (sharing a connection from your phone to host PC and other phones) since mobile hotspots typically do not enforce Client Isolation.

---

## 4. Common Troubleshooting

### Connection Times Out (ERR_CONNECTION_TIMED_OUT)
* The host firewall is blocking port 3000. Run the PowerShell rule command again.
* If using WSL 2, the `netsh portproxy` rule was not set up, or the WSL virtual IP address has changed after a computer restart.

### Page Resolves but API Calls Fail (CSRF Error)
* The system validates that state-changing requests match the host URL to prevent CSRF. The middleware handles this matching automatically. If you run into origin blocks, verify the browser matches the exact URL (either IP address or localhost) shown on the LAN Utility Page.
