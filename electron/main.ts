import { app, BrowserWindow, ipcMain, Notification, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { BlockerStore } from './store';
import { AppBlocker } from './blocker/appBlocker';
import { WebBlocker } from './blocker/webBlocker';
import { Scheduler } from './blocker/scheduler';
import { AppTray } from './tray';
import { BlockerStoreData } from './types';
import {
  trimMemory,
  startPeriodicMemoryTrimming,
  stopPeriodicMemoryTrimming,
} from './memUtils';

// ============================================================================
// ULTRA-LOW RAM Chromium & Node Optimizations
// Eliminates GPU process, constrains V8 heap, and minimizes background services
// ============================================================================
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('disable-accelerated-2d-canvas');
app.commandLine.appendSwitch('disable-accelerated-video-decode');
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=48 --expose-gc');
app.commandLine.appendSwitch('renderer-process-limit', '1');
app.commandLine.appendSwitch(
  'disable-features',
  'AudioServiceOutOfProcess,CalculateNativeWinOcclusion,InterestFeedContentSuggestions'
);
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('disable-component-update');
app.commandLine.appendSwitch('disable-sync');
app.commandLine.appendSwitch('disable-extensions');
app.commandLine.appendSwitch('disable-default-apps');
app.commandLine.appendSwitch('no-zygote');

process.on('uncaughtException', (err) => {
  try {
    fs.appendFileSync('crash.log', 'Uncaught Exception: ' + (err?.stack || err) + '\n');
  } catch {}
});
process.on('unhandledRejection', (reason) => {
  try {
    fs.appendFileSync(
      'crash.log',
      'Unhandled Rejection: ' + (reason instanceof Error ? reason.stack : String(reason)) + '\n'
    );
  } catch {}
});
app.on('quit', (_e, code) => {
  try {
    fs.appendFileSync('crash.log', 'App quit with code: ' + code + '\n');
  } catch {}
});

let mainWindow: BrowserWindow | null = null;
let store: BlockerStore;
let appBlocker: AppBlocker;
let webBlocker: WebBlocker;
let scheduler: Scheduler;
let tray: AppTray;
let isQuitting = false;

const logDir = path.join(process.env.APPDATA || process.cwd(), 'FocusGuard');
if (!fs.existsSync(logDir)) {
  try {
    fs.mkdirSync(logDir, { recursive: true });
  } catch {}
}
const logFile = path.join(logDir, 'app_lifecycle.log');
function log(msg: string) {
  try {
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`);
  } catch {}
}

// Guarantee single instance
const gotTheLock = app.requestSingleInstanceLock();
log('requestSingleInstanceLock result: ' + gotTheLock);

if (!gotTheLock) {
  log('Did not get single instance lock, quitting.');
  app.quit();
} else {
  app.on('second-instance', () => {
    log('Second instance triggered');
    showWindow();
  });

  app.whenReady().then(() => {
    log('app.whenReady resolved');
    return initApp();
  });
}

async function initApp() {
  store = new BlockerStore();
  appBlocker = new AppBlocker(store);
  webBlocker = new WebBlocker(store);
  scheduler = new Scheduler(store, appBlocker, webBlocker);

  // App blocker event hook
  appBlocker.setOnBlockEvent((blockedApp, pid, attempt) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('apps:blocked', {
        app: blockedApp,
        pid,
        attempt,
      });
    }

    const settings = store.getData().settings;
    if (settings.notificationsEnabled && Notification.isSupported()) {
      new Notification({
        title: `Distraction Blocked: ${blockedApp.name}`,
        body: `${blockedApp.name} (${pid}) was closed. Stay focused on your goals!`,
        silent: !settings.soundEnabled,
      }).show();
    }
  });

  // Scheduler event hooks
  scheduler.setEvents({
    onSessionUpdated: (session) => {
      tray.updateSession(session);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('scheduler:sessionUpdated', session);
      }
    },
    onTimeTick: (secondsRemaining) => {
      tray.updateTime(secondsRemaining);
      // Only send IPC tick to renderer when window is actively visible to prevent unnecessary React re-renders
      if (
        mainWindow &&
        !mainWindow.isDestroyed() &&
        mainWindow.isVisible() &&
        !mainWindow.isMinimized()
      ) {
        mainWindow.webContents.send('scheduler:tick', secondsRemaining);
      }
    },
    onNotificationRequest: (title, body) => {
      const settings = store.getData().settings;
      if (settings.notificationsEnabled && Notification.isSupported()) {
        new Notification({
          title,
          body,
          silent: !settings.soundEnabled,
        }).show();
      }
    },
  });

  // Initialize background scheduler and adaptive app blocker
  await scheduler.init();
  appBlocker.start(1200);

  // Apply website block on startup if websites are enabled
  try {
    const initialWebsites = (store.getData().websites || []).filter((w) => w.enabled);
    if (initialWebsites.length > 0) {
      await webBlocker.applyBlock(store.getData().websites);
    }
  } catch (err) {
    log('Failed to apply initial website block: ' + err);
  }

  // Create UI Window initially
  createWindow();

  // Initialize System Tray
  tray = new AppTray({
    onShowApp: () => {
      showWindow();
    },
    onQuickStart: async (mins) => {
      await scheduler.startSession({
        name: `${mins}m Quick Focus`,
        durationMinutes: mins,
        strictMode: 'none',
        blockWebsites: true,
        blockApps: true,
      });
    },
    onPauseResume: async () => {
      const active = scheduler.getActiveSession();
      if (active?.isPaused) {
        await scheduler.resumeSession();
      } else {
        scheduler.pauseSession();
      }
    },
    onEmergencyStop: async () => {
      showWindow();
    },
    onRestoreHosts: async () => {
      await webBlocker.removeBlock();
      dialog.showMessageBox({
        type: 'info',
        title: 'FocusGuard Recovery',
        message: 'Hosts file block entries have been cleanly removed.',
      });
    },
    onQuit: () => {
      const active = scheduler.getActiveSession();
      if (active && active.strictMode === 'locked') {
        dialog.showMessageBox({
          type: 'warning',
          title: 'Strict Session in Progress',
          message:
            'A locked strict session is currently running. FocusGuard cannot be closed until it finishes.',
        });
        return;
      }
      isQuitting = true;
      app.quit();
    },
  });
  tray.init();
  tray.updateSession(scheduler.getActiveSession());

  setupIpcHandlers();

  // Start periodic 60-second Windows working set trimming
  startPeriodicMemoryTrimming(60000);
}

/**
 * Display or resurrect the UI Window
 */
function showWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
  } else {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
}

/**
 * Destroys BrowserWindow when minimized to tray.
 * Reclaims the entire Chromium renderer process (~250MB) and flushes working set.
 */
function destroyWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    log('destroyWindow: freeing Chromium renderer process');
    mainWindow.removeAllListeners();
    mainWindow.destroy();
    mainWindow = null;

    // Flush RAM immediately
    setTimeout(() => {
      trimMemory();
    }, 200);
  }
}

function createWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
    return;
  }

  log('createWindow invoked');
  const iconPath = path.join(__dirname, '../assets/icon.ico');
  mainWindow = new BrowserWindow({
    width: 1140,
    height: 780,
    minWidth: 920,
    minHeight: 640,
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    frame: true,
    backgroundColor: '#020617',
    title: 'FocusGuard - Local Windows Productivity Blocker',
    show: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: false,
    },
  });

  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    log(`[RENDERER CONSOLE ${level}]: ${message} (${sourceId}:${line})`);
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    log(`Render process gone: reason=${details.reason}, exitCode=${details.exitCode}`);
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    log(`Page load error (${errorCode}): ${errorDescription} on ${validatedURL}`);
  });

  mainWindow.webContents.on('did-finish-load', () => {
    log('FocusGuard UI loaded successfully');
    // Once UI has initialized, trim working set of unnecessary startup allocations
    setTimeout(() => {
      trimMemory();
    }, 1200);
  });

  // Load URL or build file
  const distHtmlPath = path.join(__dirname, '../dist/index.html');
  log('Loading UI: isPackaged=' + app.isPackaged + ', distPath=' + distHtmlPath);
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else if (app.isPackaged || fs.existsSync(distHtmlPath)) {
    mainWindow.loadFile(distHtmlPath);
  } else {
    mainWindow.loadURL('http://localhost:5173');
  }

  mainWindow.show();
  mainWindow.focus();

  // Minimize event: trim working set
  mainWindow.on('minimize', () => {
    log('Window minimized, trimming working set');
    setTimeout(() => {
      trimMemory();
    }, 300);
  });

  // Close event: minimize to tray by DESTROYING the BrowserWindow
  mainWindow.on('close', (e) => {
    const settings = store.getData().settings;
    log(
      'mainWindow close event, minimizeToTray=' +
        settings.minimizeToTray +
        ', isQuitting=' +
        isQuitting
    );
    if (!isQuitting && settings.minimizeToTray) {
      e.preventDefault();
      destroyWindow();
    }
  });

  mainWindow.on('closed', () => {
    log('mainWindow closed event');
    mainWindow = null;
  });
}

function setupIpcHandlers() {
  // Store handlers
  ipcMain.handle('store:get', () => {
    return store.getData();
  });

  ipcMain.handle('store:save', async (_event, data: BlockerStoreData) => {
    store.persist(data);
    appBlocker.scanAndEnforce().catch(() => {});

    // Synchronize website blocking immediately
    try {
      const enabledWebsites = (data.websites || []).filter((w) => w.enabled);
      if (enabledWebsites.length > 0) {
        await webBlocker.applyBlock(data.websites);
      } else {
        await webBlocker.removeBlock();
      }
    } catch (err) {
      log('Error syncing website block in store:save: ' + err);
    }

    return true;
  });

  ipcMain.handle('store:clearLogs', () => {
    store.clearLogs();
    return true;
  });

  ipcMain.handle('store:exportBackup', () => {
    return store.exportBackup();
  });

  ipcMain.handle('store:importBackup', (_event, jsonContent: string) => {
    return store.importBackup(jsonContent);
  });

  ipcMain.handle('store:resetToFactory', () => {
    store.resetToFactory();
    return true;
  });

  // Session handlers
  ipcMain.handle('session:start', async (_event, params) => {
    return await scheduler.startSession(params);
  });

  ipcMain.handle('session:pause', () => {
    return scheduler.pauseSession();
  });

  ipcMain.handle('session:resume', async () => {
    return await scheduler.resumeSession();
  });

  ipcMain.handle('session:stop', async (_event, overridePassword?: boolean) => {
    return await scheduler.stopSession(overridePassword);
  });

  // App handlers
  ipcMain.handle('apps:getRunning', async () => {
    return await appBlocker.getRunningProcesses();
  });

  ipcMain.handle('apps:getInstalled', async () => {
    return await appBlocker.getInstalledApps();
  });

  ipcMain.handle('apps:kill', async (_event, executableName: string) => {
    return await appBlocker.terminateAppImmediately(executableName);
  });

  // Hosts / Website handlers
  ipcMain.handle('hosts:apply', async () => {
    const websites = store.getData().websites;
    return await webBlocker.applyBlock(websites);
  });

  ipcMain.handle('hosts:restore', async () => {
    return await webBlocker.removeBlock();
  });

  ipcMain.handle('hosts:check', () => {
    return {
      isConfigured: webBlocker.isBlockActiveInHosts(),
      canWriteDirectly: webBlocker.hasDirectWriteAccess(),
    };
  });

  // Window controls
  ipcMain.on('window:minimize', () => {
    mainWindow?.minimize();
    setTimeout(() => trimMemory(), 200);
  });

  ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });

  ipcMain.on('window:close', () => {
    const settings = store.getData().settings;
    if (settings.minimizeToTray) {
      destroyWindow();
    } else {
      mainWindow?.close();
    }
  });

  // System memory diagnostics and manual trim
  ipcMain.handle('system:trimMemory', () => {
    trimMemory();
    return true;
  });

  ipcMain.handle('system:getMemoryUsage', () => {
    return process.memoryUsage();
  });
}

app.on('before-quit', async () => {
  log('app before-quit event');
  isQuitting = true;
  stopPeriodicMemoryTrimming();
  scheduler?.stopClock();
  appBlocker?.stop();
  tray?.destroy();
});

app.on('window-all-closed', () => {
  log('app window-all-closed event');
  if (process.platform !== 'darwin') {
    const settings = store?.getData()?.settings;
    if (!settings?.minimizeToTray) {
      log('minimizeToTray is false, quitting app');
      app.quit();
    } else {
      log('minimizeToTray is true, keeping app running in tray with zero-window footprint');
      // Window is already destroyed, main background process stays running with negligible RAM
    }
  }
});
