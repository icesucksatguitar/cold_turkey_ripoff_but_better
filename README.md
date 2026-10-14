# FocusGuard - Local Windows Productivity Blocker

FocusGuard is a complete, native-feeling Windows desktop productivity blocker inspired by Cold Turkey Blocker. It runs **100% locally on your PC** to help you maintain deep focus by enforcing distraction blocks across unwanted websites and desktop applications.

FocusGuard operates with **zero cloud dependencies, no accounts, and no subscriptions**. Your browsing history, applications, schedules, and focus stats never leave your machine.

---

## 1. Architecture & Design Decisions

### Why Electron + React + TypeScript + Node Windows Integration?
During the initial environment inspection, the following environmental constraints were identified:
- **Rust and Visual Studio C++ MSVC Build Tools** were not present in the environment. Tauri requires Visual Studio C++ (MSVC) build tools and SDKs (>8 GB) which require full administrative installation.
- **Node.js (v24.18.0) and npm (v12.2.0)** were pre-installed and fully functional.
- **Electron (v35)** with TypeScript allows running the background blocking engine persistently in a native Node.js process with direct access to Windows operating system APIs, system tray, notifications, process tables, and the Windows filesystem.
- **React 19 + TypeScript + Vite**: Provides an ultra-responsive, modern dark UI styled with a custom design system, fluid countdown rings, and instant navigation.

### Architecture Overview

```
focusguard/
├── electron/
│   ├── main.ts              # Single-instance lock, window lifecycle, IPC handlers
│   ├── preload.ts           # Secure ContextBridge isolation layer
│   ├── store.ts             # Persistent atomic JSON database (%APPDATA%/FocusGuard/config.json)
│   ├── tray.ts              # Native Windows system tray, tooltip countdown, context menu
│   ├── types.ts             # Core domain models and interfaces
│   ├── blocker/
│   │   ├── appBlocker.ts    # Windows process scanner & taskkill enforcement
│   │   ├── webBlocker.ts    # Atomic Windows hosts-file blocker with rollback
│   │   └── scheduler.ts     # 1-second clock, recurring schedules, strict mode lock
│   └── tests/
│       └── blocker.test.ts  # Node.js automated test suite
├── src/                     # React 19 + Vite Desktop Interface
│   ├── App.tsx              # Main application shell & tab routing
│   ├── index.css            # Custom modern dark design system
│   ├── components/
│   │   ├── Header.tsx       # Frameless titlebar with window controls
│   │   └── Sidebar.tsx      # Sidebar navigation with active badges
│   └── pages/
│       ├── Dashboard.tsx    # Radial SVG countdown, quick presets, emergency modal
│       ├── WebsiteBlocker.tsx # Domain manager, subdomain inclusion, hosts preview
│       ├── AppBlocker.tsx   # Process picker, relaunch counter, whitelist guards
│       ├── Schedules.tsx    # Weekly recurring schedule calendar engine
│       ├── FocusSession.tsx # Duration slider, strictness configuration
│       ├── ActivityLog.tsx  # Chronological forensic audit log
│       └── Settings.tsx     # Startup, recovery, backup export/import, technical guide
```

---

## 2. Prerequisites & Development Setup

### System Requirements
- Windows 10 or Windows 11 (64-bit)
- Node.js 18+ (tested on Node.js v24.18.0)
- npm 9+ (tested on npm 12.2.0)

### Installation
Clone the repository and install project dependencies:
```powershell
git clone <repo-url>
cd coldturkey-ripoff
npm install
```

---

## 3. How to Run the Application

### Development Mode
Runs Vite dev server with Hot Module Replacement (HMR) and launches Electron:
```powershell
npm run electron:dev
```
*(Or run `npm run dev` in one terminal and `npm start` in another).*

### Production Build & Execution
Builds the optimized React bundle and compiles the Electron backend with TypeScript:
```powershell
npm run build
npm start
```

---

## 4. How Website and Application Blocking Work

### Website Blocking Engine (`electron/blocker/webBlocker.ts`)
1. **Loopback Redirection**: Targets domains by mapping them to loopback IP addresses `127.0.0.1` (IPv4) and `::1` (IPv6) in the Windows system hosts file (`C:\Windows\System32\drivers\etc\hosts`).
2. **Subdomain Auto-Expansion**: For any domain (e.g. `youtube.com`), automatically generates entries for `www.youtube.com`, `m.youtube.com`, `mobile.youtube.com`, and `api.youtube.com`.
3. **Atomic Safety & Marker Isolation**: All rules are isolated within explicit boundary markers:
   ```hosts
   # BEGIN FOCUSGUARD BLOCK
   # Automatically managed by FocusGuard. Do not edit manually.
   127.0.0.1 youtube.com
   ::1 youtube.com
   127.0.0.1 www.youtube.com
   ::1 www.youtube.com
   # END FOCUSGUARD BLOCK
   ```
   FocusGuard **never** modifies or deletes existing user hosts file entries outside these markers.
4. **Automatic Backups**: A timestamped backup (`hosts_backup_<timestamp>.txt`) is automatically saved in `%APPDATA%\FocusGuard\backups\` prior to every modification.
5. **DNS Cache Flushing**: Immediately executes `ipconfig /flushdns` after applying or removing blocks so browser DNS resolution takes immediate effect without rebooting.
6. **Elevation Handling**: If FocusGuard is running without administrative rights, it executes an automated, elevated PowerShell script via `Start-Process powershell -Verb RunAs` that writes the prepared changes safely.

### Application Blocking Engine (`electron/blocker/appBlocker.ts`)
1. **Process Polling**: FocusGuard polls the Windows process list every 1,000 ms using Windows native utilities (`tasklist` / PowerShell `Get-Process`).
2. **Instant Interception**: When a blocked process is detected (e.g. `Discord.exe` or `steam.exe`), FocusGuard immediately issues a force termination (`taskkill /F /PID <pid>`).
3. **Relaunch Tracking**: Tracks how many times a blocked application was relaunched during an active session and displays attempt counts in notifications and logs.
4. **Critical System Whitelist**: To safeguard your operating system, critical Windows system processes (e.g. `explorer.exe`, `dwm.exe`, `svchost.exe`, `csrss.exe`, `lsass.exe`, `powershell.exe`, `electron.exe`, etc.) can **never** be blocked or terminated.

---

## 5. Focus Sessions, Schedules, and Strict Mode

### Focus Presets & Custom Duration
- Quick start with 1-click presets:
  - **Pomodoro Sprint**: 25 min focus
  - **Deep Work Flow**: 50 min focus
  - **Study Marathon**: 90 min focus
  - **Ultra Focus**: 120 min focus
- Or adjust the custom slider from **5 to 240 minutes**.

### Strict Focus Mode Levels
- **Standard (Casual)**: You can pause or stop the session anytime.
- **Locked**: Ordinary UI stop buttons are disabled. The session cannot be cancelled until the countdown timer reaches zero.
- **Extreme**: If an emergency occurs, ending the session requires typing a randomized 24-character security phrase (e.g., `X7K9-W2M4-P8Q3-R5T1-V9N6-B4C2`).

### Recurring Schedules
Create weekly schedules for recurring focus blocks (e.g. Monday–Friday 9:00 AM to 12:00 PM). The background engine continuously checks the clock and starts the session automatically when the window arrives.

---

## 6. Permissions and Honest Limitations

FocusGuard prioritizes complete honesty regarding Windows technical constraints:

1. **DNS-over-HTTPS (DoH) / Secure DNS**:
   - Modern browsers (Google Chrome, Firefox, Microsoft Edge) often enable "Secure DNS" by default. This causes the browser to query external DNS resolvers (Cloudflare/Google) over HTTPS, bypassing the Windows `hosts` file.
   - **Resolution**: To ensure website blocking works in Chrome/Edge, open `chrome://settings/security` (or `edge://settings/privacy`) and disable "Use secure DNS" or select "Use your current service provider".
2. **VPNs & Custom Proxies**:
   - If a third-party VPN tunnel or proxy handles DNS resolution inside its own virtual network adapter, it may bypass local loopback resolution.
3. **Administrator Privileges**:
   - Modifying `C:\Windows\System32\drivers\etc\hosts` requires Administrator elevation on Windows. FocusGuard cleanly triggers a standard Windows UAC prompt when updating the hosts file.
4. **Process Watchdog Limitations**:
   - While FocusGuard terminates blocked applications within milliseconds, applications with persistent multi-process watchdogs may attempt to relaunch. FocusGuard intercepts each relaunch attempt, records it, and logs the incident.

---

## 7. Emergency Recovery & System Restoration

If your PC abruptly reboots or crashes during a focus session, FocusGuard provides multiple recovery mechanisms:

### Method 1: In-App Emergency Button
1. Open FocusGuard.
2. Go to **Settings & System Recovery**.
3. Click **Emergency Restore Hosts File**.
4. FocusGuard will immediately strip all block markers and flush your DNS cache.

### Method 2: System Tray Menu
- Right-click the FocusGuard system tray icon.
- Select **Emergency Restore Hosts File**.

### Method 3: Manual Restore
- Open `%APPDATA%\FocusGuard\backups\`.
- Your original `hosts` files are preserved with exact timestamps.
- Copy the backup file back to `C:\Windows\System32\drivers\etc\hosts` in an Administrator text editor or PowerShell terminal.

---

## 8. Automated Testing

FocusGuard includes automated tests for all critical modules:
```powershell
npm test
```
The test suite validates:
- Domain and subdomain loopback entry generation.
- IPv4 (`127.0.0.1`) and IPv6 (`::1`) mapping.
- Unrelated hosts file entry preservation.
- Local JSON store persistence and log rotation.
- AppBlocker lifecycle and relaunch tracking.
- Scheduler strict mode locking and override authorization.

---

## 9. Building the Windows Installer & Portable Binary

FocusGuard uses `electron-builder` to produce reproducible Windows installers:

### Pack Directory (Fast Verification)
```powershell
npm run pack:win
```
Outputs unpacked desktop binary in `release/win-unpacked/FocusGuard.exe`.

### Build Windows Installer & Portable Executable
```powershell
npm run dist:win
```
Outputs:
- **`release/FocusGuard-Setup-1.0.0.exe`**: Full NSIS installer with desktop shortcut and uninstaller.
- **`release/FocusGuard-1.0.0.exe`**: Standalone portable Windows executable.

---

## 10. Uninstallation

Uninstalling FocusGuard is clean and non-destructive:
1. Run the uninstaller via Windows Settings → Installed Apps.
2. The uninstaller removes all application files and shortcuts.
3. Any active hosts entries are stripped prior to removal.
