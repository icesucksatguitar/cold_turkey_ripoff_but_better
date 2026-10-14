import { exec } from 'child_process';
import { promisify } from 'util';
import { BlockedApp, RunningProcessInfo } from '../types';
import { BlockerStore } from '../store';

const execAsync = promisify(exec);

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
  private isScanning = false;
  private relaunchCounters: Map<string, number> = new Map();
  private onBlockEvent?: BlockEventCallback;

  constructor(store: BlockerStore) {
    this.store = store;
  }

  public setOnBlockEvent(callback: BlockEventCallback) {
    this.onBlockEvent = callback;
  }

  /**
   * Start periodic scanning and enforcement
   */
  public start(intervalMs = 1000) {
    this.stop();
    this.intervalTimer = setInterval(() => {
      this.scanAndEnforce().catch((err) => {
        console.error('Error during app blocker scan:', err);
      });
    }, intervalMs);

    // Initial immediate scan
    this.scanAndEnforce().catch(() => {});
  }

  /**
   * Stop scanning
   */
  public stop() {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
    this.relaunchCounters.clear();
  }

  public isRunning(): boolean {
    return this.intervalTimer !== null;
  }

  /**
   * Queries currently running processes using Windows tasklist
   */
  public async getRunningProcesses(): Promise<RunningProcessInfo[]> {
    try {
      // Use powershell to get processes with window titles if possible, fallback to tasklist
      const psCommand = `powershell -NoProfile -Command "Get-Process | Where-Object { $_.MainWindowTitle -ne '' -or $_.ProcessName -in @('Discord','Steam','Spotify','EpicGamesLauncher','Battle.net','Telegram','WhatsApp','slack') } | Select-Object Id, ProcessName, MainWindowTitle | ConvertTo-Json"`;
      
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
        // Line format: "Image Name","PID","Session Name","Session#","Mem Usage"
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
   * Scan active processes and terminate any blocked application
   */
  public async scanAndEnforce(): Promise<void> {
    if (this.isScanning) return;
    this.isScanning = true;

    try {
      const data = this.store.getData();
      const activeSession = data.activeSession;

      // Only enforce if there's an active session configured to block apps
      if (!activeSession || activeSession.isPaused || !activeSession.blockApps) {
        this.isScanning = false;
        return;
      }

      const enabledBlockedApps = data.apps.filter((a) => a.enabled);
      if (enabledBlockedApps.length === 0) {
        this.isScanning = false;
        return;
      }

      // Fast check via tasklist
      const { stdout } = await execAsync('tasklist /FO CSV /NH', { timeout: 2500 });
      const lines = stdout.split('\r\n').filter((line) => line.trim().length > 0);

      // Build target map: normalized executable name -> BlockedApp
      const targetMap = new Map<string, BlockedApp>();
      for (const app of enabledBlockedApps) {
        const norm = app.executableName.trim().toLowerCase();
        if (norm) {
          const fullNorm = norm.endsWith('.exe') ? norm : `${norm}.exe`;
          targetMap.set(fullNorm, app);
        }
      }

      for (const line of lines) {
        const parts = line.split('","').map((p) => p.replace(/"/g, '').trim());
        if (parts.length < 2) continue;

        const imageName = parts[0].toLowerCase();
        const pid = parseInt(parts[1], 10);

        if (isNaN(pid) || pid <= 4) continue;

        // Safety safeguard: never touch protected system processes
        if (CRITICAL_SYSTEM_PROCESSES.has(imageName)) {
          continue;
        }

        const matchedApp = targetMap.get(imageName);
        if (matchedApp) {
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

      // Execute taskkill
      await execAsync(`taskkill /F /PID ${pid}`, { timeout: 2000 });

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
      // Process may have exited on its own or access denied
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`Failed to terminate PID ${pid} (${app.name}):`, msg);
    }
  }

  public getRelaunchCount(executableName: string): number {
    return this.relaunchCounters.get(executableName.toLowerCase()) || 0;
  }
}
