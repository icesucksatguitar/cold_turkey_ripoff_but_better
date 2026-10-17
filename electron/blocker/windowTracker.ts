import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { WindowActivity } from '../types';

export type ActivityCallback = (activity: WindowActivity) => void;

export class WindowActivityTracker {
  private child: ChildProcess | null = null;
  private isRunning = false;
  private latestActivity: WindowActivity | null = null;
  private listeners: Set<ActivityCallback> = new Set();
  private restartTimeout: NodeJS.Timeout | null = null;

  constructor() {}

  public addListener(cb: ActivityCallback): () => void {
    this.listeners.add(cb);
    if (this.latestActivity) {
      cb(this.latestActivity);
    }
    return () => {
      this.listeners.delete(cb);
    };
  }

  public getLatestActivity(): WindowActivity | null {
    return this.latestActivity;
  }

  /**
   * Start streaming window and tab activity
   */
  public start(intervalMs = 900): void {
    if (this.isRunning) return;
    this.isRunning = true;

    const exePath = this.getTrackerExePath();
    if (!exePath) {
      console.warn('[WindowTracker] windowTracker.exe not found, falling back to dummy activity');
      this.startFallbackPolling(intervalMs);
      return;
    }

    try {
      this.child = spawn(exePath, ['--stream', String(intervalMs)], {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let buffer = '';

      this.child.stdout?.on('data', (chunk: Buffer) => {
        buffer += chunk.toString('utf-8');
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('{')) continue;

          try {
            const parsed: WindowActivity = JSON.parse(trimmed);
            this.handleActivityUpdate(parsed);
          } catch (e) {
            // Ignore malformed partial lines
          }
        }
      });

      this.child.stderr?.on('data', (err) => {
        console.error('[WindowTracker stderr]:', err.toString());
      });

      this.child.on('exit', (code, signal) => {
        this.child = null;
        if (this.isRunning) {
          // Restart after short delay if unexpectedly exited
          this.restartTimeout = setTimeout(() => {
            if (this.isRunning) {
              this.isRunning = false;
              this.start(intervalMs);
            }
          }, 2000);
        }
      });
    } catch (err) {
      console.error('[WindowTracker] Failed to spawn tracker process:', err);
      this.startFallbackPolling(intervalMs);
    }
  }

  /**
   * Stop tracker process to conserve CPU/RAM when no session needs it
   */
  public stop(): void {
    this.isRunning = false;
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }

    if (this.child) {
      try {
        this.child.kill();
      } catch {}
      this.child = null;
    }
  }

  private handleActivityUpdate(activity: WindowActivity) {
    this.latestActivity = activity;
    for (const listener of this.listeners) {
      try {
        listener(activity);
      } catch (e) {
        console.error('Error in window activity listener:', e);
      }
    }
  }

  private getTrackerExePath(): string | null {
    const candidates = [
      path.join(__dirname, '../scripts/windowTracker.exe'),
      path.join(__dirname, 'scripts/windowTracker.exe'),
      path.join(process.cwd(), 'electron/scripts/windowTracker.exe'),
      path.join(process.cwd(), 'dist-electron/scripts/windowTracker.exe'),
      path.join(process.resourcesPath || '', 'electron/scripts/windowTracker.exe'),
    ];

    for (const c of candidates) {
      if (fs.existsSync(c)) {
        return c;
      }
    }
    return null;
  }

  private startFallbackPolling(intervalMs: number) {
    // If windowTracker.exe is absent, default to neutral so as not to break focus session
    const fallback: WindowActivity = {
      pid: 0,
      process: 'browser',
      title: 'Physics Wallah (Fallback Mode)',
      url: 'https://pw.live',
      isPw: true,
      isAi: false,
      isSelf: false,
      isDesktop: false,
    };
    this.handleActivityUpdate(fallback);
  }
}
