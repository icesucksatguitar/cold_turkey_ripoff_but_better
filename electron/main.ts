import { app, BrowserWindow, ipcMain, Notification, dialog } from 'electron';
import * as path from 'path';
import { BlockerStore } from './store';
import { AppBlocker } from './blocker/appBlocker';
import { WebBlocker } from './blocker/webBlocker';
import { Scheduler } from './blocker/scheduler';
import { AppTray } from './tray';
import { BlockerStoreData } from './types';

let mainWindow: BrowserWindow | null = null;
let store: BlockerStore;
let appBlocker: AppBlocker;
let webBlocker: WebBlocker;
let scheduler: Scheduler;
let tray: AppTray;
let isQuitting = false;

// Guarantee single instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(initApp);
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
      if (mainWindow && !mainWindow.isDestroyed()) {
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

  // Initialize background scheduler
  await scheduler.init();

  // Create UI Window
  createWindow();

  // Initialize System Tray
  tray = new AppTray({
    onShowApp: () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
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
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
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
          message: 'A locked strict session is currently running. FocusGuard cannot be closed until it finishes.',
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
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1140,
    height: 780,
    minWidth: 920,
    minHeight: 640,
    frame: false,
    backgroundColor: '#020617',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  // Load URL or build file
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Minimize to tray instead of quitting
  mainWindow.on('close', (e) => {
    const settings = store.getData().settings;
    if (!isQuitting && settings.minimizeToTray) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function setupIpcHandlers() {
  // Store handlers
  ipcMain.handle('store:get', () => {
    return store.getData();
  });

  ipcMain.handle('store:save', (_event, data: BlockerStoreData) => {
    store.persist(data);
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
  });

  ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });

  ipcMain.on('window:close', () => {
    mainWindow?.close();
  });
}

app.on('before-quit', async () => {
  isQuitting = true;
  scheduler?.stopClock();
  appBlocker?.stop();
  tray?.destroy();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    const settings = store?.getData()?.settings;
    if (!settings?.minimizeToTray) {
      app.quit();
    }
  }
});
