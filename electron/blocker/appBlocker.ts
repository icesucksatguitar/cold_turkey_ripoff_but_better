import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import { BlockedApp, RunningProcessInfo, InstalledAppInfo } from '../types';
import { BlockerStore } from '../store';
import { getMemtrimPath, trimMemory } from '../memUtils';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

// Protected system processes that can NEVER be terminated under any circumstances
const CRITICAL_SYSTEM_PROCESSES = new Set([
  'system',
  'smss.exe',
  'csrss.exe',
  'wininit.exe',
  'services.exe',
  'lsass.exe',
  'svchost.exe',
  'fontdrvhost.exe',
  'winlogon.exe',
  'dwm.exe',
  'explorer.exe',
  'taskhostw.exe',
  'sihost.exe',
  'ctfmon.exe',
  'electron.exe',
  'focusguard.exe',
  'node.exe',
  'code.exe',
  'cmd.exe',
  'powershell.exe',
  'pwsh.exe',
]);

export interface BlockEventCallback {
  (app: BlockedApp, pid: number, relaunchCount: number): void;
}

export class AppBlocker {
  private store: BlockerStore;
  private intervalTimer: NodeJS.Timeout | null = null;
  private burstTimeout: NodeJS.Timeout | null = null;
  private isScanning = false;
  private currentIntervalMs = 1200;
  private relaunchCounters: Map<string, number> = new Map();
  private onBlockEvent?: BlockEventCallback;

  constructor(store: BlockerStore) {
    this.store = store;
  }

  public setOnBlockEvent(callback: BlockEventCallback) {
    this.onBlockEvent = callback;
  }

  /**
   * Start periodic scanning and enforcement with power-saving adaptive timing
   */
  public start(intervalMs = 1200) {
    this.stop();
    this.currentIntervalMs = intervalMs;
    this.intervalTimer = setInterval(() => {
      this.scanAndEnforce().catch((err) => {
        console.error('Error during app blocker scan:', err);
      });
    }, this.currentIntervalMs);

    // Initial immediate scan
    this.scanAndEnforce().catch(() => {});
  }

  /**
   * Temporary burst mode: scans at 400ms for 8 seconds after an interception
   * to defeat rapid re-launch attempts, then automatically returns to power-saving mode.
   */
  public triggerBurstScan() {
    if (this.burstTimeout) {
      clearTimeout(this.burstTimeout);
    }

    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
    }

    // High frequency scan
    this.intervalTimer = setInterval(() => {
      this.scanAndEnforce().catch(() => {});
    }, 400);

    // Revert back after 8 seconds
    this.burstTimeout = setTimeout(() => {
      if (this.intervalTimer) {
        clearInterval(this.intervalTimer);
        this.intervalTimer = setInterval(() => {
          this.scanAndEnforce().catch(() => {});
        }, this.currentIntervalMs);
      }
      this.burstTimeout = null;
    }, 8000);
  }

  /**
   * Stop scanning
   */
  public stop() {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    if (this.burstTimeout) {
      clearTimeout(this.burstTimeout);
      this.burstTimeout = null;
    }
  }

  public isRunning(): boolean {
    return this.intervalTimer !== null;
  }

  /**
   * Queries currently running processes using Windows tasklist
   */
  public async getRunningProcesses(): Promise<RunningProcessInfo[]> {
    try {
      const psCommand = `powershell -NoProfile -Command "Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -ne '' } | Select-Object Id, ProcessName, MainWindowTitle | ConvertTo-Json -Compress"`;

      try {
        const { stdout } = await execAsync(psCommand, { timeout: 4000 });
        if (stdout.trim()) {
          const parsed = JSON.parse(stdout);
          const list = Array.isArray(parsed) ? parsed : [parsed];
          return list
            .filter((p) => p && p.ProcessName)
            .map((p) => ({
              pid: Number(p.Id),
              name: p.ProcessName.toLowerCase().endsWith('.exe') ? p.ProcessName : `${p.ProcessName}.exe`,
              windowTitle: p.MainWindowTitle || undefined,
            }));
        }
      } catch {
        // Fallback to tasklist if PowerShell has issue
      }

      const { stdout } = await execAsync('tasklist /FO CSV /NH', { timeout: 3000 });
      const lines = stdout.split('\r\n').filter((line) => line.trim().length > 0);
      const results: RunningProcessInfo[] = [];

      for (const line of lines) {
        const parts = line.split('","').map((p) => p.replace(/"/g, '').trim());
        if (parts.length >= 2) {
          const name = parts[0];
          const pid = parseInt(parts[1], 10);
          if (name && !isNaN(pid)) {
            results.push({ pid, name });
          }
        }
      }

      return results;
    } catch (err) {
      console.error('Failed to enumerate running processes:', err);
      return [];
    }
  }

  /**
   * Extract all installed applications from the PC and cross-reference with blocklist
   */
  public async getInstalledApps(): Promise<InstalledAppInfo[]> {
    try {
      const possibleScriptPaths = [
        path.join(__dirname, '../scripts/getInstalledApps.ps1'),
        path.join(__dirname, 'scripts/getInstalledApps.ps1'),
        path.join(process.cwd(), 'electron/scripts/getInstalledApps.ps1'),
        path.join(process.resourcesPath || '', 'electron/scripts/getInstalledApps.ps1'),
      ];

      let scriptPath = '';
      for (const p of possibleScriptPaths) {
        if (fs.existsSync(p)) {
          scriptPath = p;
          break;
        }
      }

      let jsonOutput = '';
      if (scriptPath) {
        const { stdout } = await execAsync(
          `powershell -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`,
          { timeout: 8000 }
        );
        jsonOutput = stdout;
      } else {
        const inlinePs = `powershell -NoProfile -Command "$paths = @('$env:ProgramData\\Microsoft\\Windows\\Start Menu\\Programs','$env:AppData\\Microsoft\\Windows\\Start Menu\\Programs'); $sh = New-Object -ComObject WScript.Shell; $res = @(); foreach ($p in $paths) { if (Test-Path $p) { Get-ChildItem -Path $p -Filter '*.lnk' -Recurse -ErrorAction SilentlyContinue | ForEach-Object { try { $t = $sh.CreateShortcut($_.FullName).TargetPath; if ($t -and $t.EndsWith('.exe') -and (Test-Path $t)) { $res += [PSCustomObject]@{ name = $_.BaseName; executableName = [System.IO.Path]::GetFileName($t); path = $t } } } catch {} } } }; $res | Sort-Object name -Unique | ConvertTo-Json -Compress"`;
        const { stdout } = await execAsync(inlinePs, { timeout: 8000 });
        jsonOutput = stdout;
      }

      const rawApps: Array<{ name: string; executableName: string; path?: string }> = jsonOutput.trim()
        ? JSON.parse(jsonOutput.trim())
        : [];
      const appList = Array.isArray(rawApps) ? rawApps : [rawApps];

      // Query currently running processes to annotate isRunning
      const runningSet = new Set<string>();
      try {
        const { stdout: tlOut } = await execAsync('tasklist /FO CSV /NH', { timeout: 2500 });
        for (const line of tlOut.split('\r\n')) {
          const parts = line.split('","');
          if (parts.length > 0 && parts[0]) {
            runningSet.add(parts[0].replace(/"/g, '').trim().toLowerCase());
          }
        }
      } catch {}

      // Cross-reference with stored apps
      const storeData = this.store.getData();
      const blockedMap = new Map<string, BlockedApp>();
      for (const b of storeData.apps) {
        blockedMap.set(b.executableName.toLowerCase().trim(), b);
      }

      const results: InstalledAppInfo[] = [];
      const seen = new Set<string>();

      for (const item of appList) {
        if (!item || !item.executableName) continue;
        const exeKey = item.executableName.toLowerCase().trim();
        if (seen.has(exeKey)) continue;
        seen.add(exeKey);

        const existing = blockedMap.get(exeKey);
        results.push({
          id: existing ? existing.id : `app-${exeKey.replace(/[^a-z0-9]/g, '-')}`,
          name: item.name || item.executableName.replace(/\.exe$/i, ''),
          executableName: item.executableName,
          path: item.path,
          isBlocked: existing ? existing.enabled : false,
          isRunning: runningSet.has(exeKey),
        });
      }

      for (const stored of storeData.apps) {
        const exeKey = stored.executableName.toLowerCase().trim();
        if (!seen.has(exeKey)) {
          seen.add(exeKey);
          results.push({
            id: stored.id,
            name: stored.name,
            executableName: stored.executableName,
            path: stored.path,
            isBlocked: stored.enabled,
            isRunning: runningSet.has(exeKey),
          });
        }
      }

      // Reclaim memory immediately after large list allocation
      setTimeout(() => trimMemory(), 500);

      return results.sort((a, b) => {
        if (a.isBlocked && !b.isBlocked) return -1;
        if (!a.isBlocked && b.isBlocked) return 1;
        return a.name.localeCompare(b.name);
      });
    } catch (err) {
      console.error('Failed to get installed apps:', err);
      const storeData = this.store.getData();
      return storeData.apps.map((a) => ({
        id: a.id,
        name: a.name,
        executableName: a.executableName,
        path: a.path,
        isBlocked: a.enabled,
        isRunning: false,
      }));
    }
  }

  /**
   * Immediately terminate a specific application executable and all its child processes
   */
  public async terminateAppImmediately(executableName: string): Promise<boolean> {
    const norm = executableName.trim().toLowerCase();
    const fullExe = norm.endsWith('.exe') ? norm : `${norm}.exe`;

    if (CRITICAL_SYSTEM_PROCESSES.has(fullExe)) {
      console.warn(`Refusing to terminate critical system process: ${fullExe}`);
      return false;
    }

    const memtrimPath = getMemtrimPath();
    if (memtrimPath) {
      try {
        await execFileAsync(memtrimPath, ['--kill', fullExe.replace(/\.exe$/i, '')], { timeout: 2000 });
        return true;
      } catch {}
    }

    try {
      await execAsync(`taskkill /F /IM "${fullExe}" /T`, { timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Scan active processes and terminate any blocked application
   * Highly optimized: zero-work shortcut when no apps are blocked, and native fast-path
   */
  public async scanAndEnforce(): Promise<void> {
    if (this.isScanning) return;
    this.isScanning = true;

    try {
      const data = this.store.getData();
      const activeSession = data.activeSession;

      // If active session is paused, skip enforcement during pause
      if (activeSession && activeSession.isPaused) {
        return;
      }

      // If active session explicitly disabled app blocking, skip
      if (activeSession && activeSession.blockApps === false) {
        return;
      }

      const enabledBlockedApps = data.apps.filter((a) => a.enabled);
      if (enabledBlockedApps.length === 0) {
        return;
      }

      // Build target map: normalized executable name -> BlockedApp
      const targetMap = new Map<string, BlockedApp>();
      const checkArgs: string[] = [];
      for (const app of enabledBlockedApps) {
        const norm = app.executableName.trim().toLowerCase();
        if (norm) {
          const fullNorm = norm.endsWith('.exe') ? norm : `${norm}.exe`;
          if (!CRITICAL_SYSTEM_PROCESSES.has(fullNorm)) {
            targetMap.set(fullNorm, app);
            checkArgs.push(norm.replace(/\.exe$/i, ''));
          }
        }
      }

      if (targetMap.size === 0) {
        return;
      }

      const memtrimPath = getMemtrimPath();
      if (memtrimPath) {
        // Native ultra-fast path: < 5ms, negligible RAM
        try {
          const { stdout } = await execFileAsync(memtrimPath, ['--check', ...checkArgs], { timeout: 1500 });
          if (stdout && stdout.trim().length > 0) {
            const lines = stdout.split('\r\n').filter((l) => l.trim().length > 0);
            for (const line of lines) {
              const parts = line.split(',');
              if (parts.length >= 2) {
                const pid = parseInt(parts[0], 10);
                const exeName = parts[1].trim().toLowerCase();
                const matchedApp = targetMap.get(exeName);
                if (matchedApp && pid && pid > 4) {
                  this.triggerBurstScan();
                  await this.terminateProcess(matchedApp, pid, parts[1]);
                }
              }
            }
          }
          return;
        } catch {
          // Fallback to tasklist if error
        }
      }

      // Fallback path: tasklist
      const { stdout } = await execAsync('tasklist /FO CSV /NH', { timeout: 2500 });
      const lines = stdout.split('\r\n').filter((line) => line.trim().length > 0);

      const terminatedThisCycle = new Set<string>();

      for (const line of lines) {
        const parts = line.split('","').map((p) => p.replace(/"/g, '').trim());
        if (parts.length < 2) continue;

        const imageName = parts[0].toLowerCase();
        const pid = parseInt(parts[1], 10);

        if (isNaN(pid) || pid <= 4) continue;
        if (CRITICAL_SYSTEM_PROCESSES.has(imageName)) continue;

        const matchedApp = targetMap.get(imageName);
        if (matchedApp && !terminatedThisCycle.has(imageName)) {
          terminatedThisCycle.add(imageName);
          this.triggerBurstScan();
          await this.terminateProcess(matchedApp, pid, parts[0]);
        }
      }
    } catch (err) {
      console.error('Error in scanAndEnforce:', err);
    } finally {
      this.isScanning = false;
    }
  }

  /**
   * Terminate blocked process instance safely
   */
  private async terminateProcess(app: BlockedApp, pid: number, originalName: string): Promise<void> {
    try {
      const countKey = app.executableName.toLowerCase();
      const currentCount = (this.relaunchCounters.get(countKey) || 0) + 1;
      this.relaunchCounters.set(countKey, currentCount);

      const exeName = originalName.toLowerCase().endsWith('.exe') ? originalName : `${originalName}.exe`;

      const memtrimPath = getMemtrimPath();
      if (memtrimPath) {
        try {
          await execFileAsync(memtrimPath, ['--kill', exeName.replace(/\.exe$/i, '')], { timeout: 2000 });
        } catch {}
      }

      // Also ensure taskkill /T terminates process tree
      try {
        await execAsync(`taskkill /F /IM "${exeName}" /T`, { timeout: 2000 });
      } catch {}

      // Log event
      this.store.addLog(
        'app_blocked',
        app.name,
        `Intercepted & terminated ${originalName} (PID: ${pid}). Attempt #${currentCount}`
      );

      // Trigger callback (for Windows notification & UI updates)
      if (this.onBlockEvent) {
        this.onBlockEvent(app, pid, currentCount);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`Failed to terminate PID ${pid} (${app.name}):`, msg);
    }
  }

  public getRelaunchCount(executableName: string): number {
    return this.relaunchCounters.get(executableName.toLowerCase()) || 0;
  }
}
