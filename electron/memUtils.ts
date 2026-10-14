import * as path from 'path';
import * as fs from 'fs';
import { execFile } from 'child_process';

let cachedHelperPath: string | null = null;

export function getMemtrimPath(): string | null {
  if (cachedHelperPath && fs.existsSync(cachedHelperPath)) {
    return cachedHelperPath;
  }

  const possiblePaths = [
    path.join(__dirname, 'scripts', 'memtrim.exe'),
    path.join(__dirname, '../scripts', 'memtrim.exe'),
    path.join(__dirname, '../../electron/scripts', 'memtrim.exe'),
    path.join(process.cwd(), 'electron', 'scripts', 'memtrim.exe'),
    path.join(process.resourcesPath || '', 'electron', 'scripts', 'memtrim.exe'),
    path.join(process.resourcesPath || '', 'scripts', 'memtrim.exe'),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      cachedHelperPath = p;
      return p;
    }
  }

  return null;
}

/**
 * Trims the working set of all FocusGuard / Electron processes to absolute minimum.
 * Flushes memory from V8 and prompts Windows kernel to page out clean inactive pages.
 */
export function trimMemory(): void {
  try {
    // Force Node/V8 garbage collection if enabled via --expose-gc
    if (typeof global !== 'undefined' && typeof (global as any).gc === 'function') {
      try {
        (global as any).gc();
      } catch {}
    }

    const helper = getMemtrimPath();
    if (helper) {
      execFile(helper, ['--trim'], (err) => {
        if (err) {
          // Non-critical; silently ignore
        }
      });
    }
  } catch {}
}

let trimIntervalTimer: NodeJS.Timeout | null = null;

export function startPeriodicMemoryTrimming(intervalMs = 60000): void {
  if (trimIntervalTimer) {
    clearInterval(trimIntervalTimer);
  }

  // Initial trim after startup settle
  setTimeout(() => {
    trimMemory();
  }, 3000);

  trimIntervalTimer = setInterval(() => {
    trimMemory();
  }, intervalMs);
}

export function stopPeriodicMemoryTrimming(): void {
  if (trimIntervalTimer) {
    clearInterval(trimIntervalTimer);
    trimIntervalTimer = null;
  }
}
