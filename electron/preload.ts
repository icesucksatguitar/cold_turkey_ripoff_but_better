import { contextBridge, ipcRenderer } from 'electron';
import {
  BlockerStoreData,
  BlockedApp,
  ActiveSession,
  RunningProcessInfo,
  StrictModeLevel,
} from './types';

const api = {
  // Store & Settings
  getConfig: (): Promise<BlockerStoreData> => ipcRenderer.invoke('store:get'),
  saveConfig: (data: BlockerStoreData): Promise<boolean> => ipcRenderer.invoke('store:save', data),
  clearLogs: (): Promise<boolean> => ipcRenderer.invoke('store:clearLogs'),
  exportBackup: (): Promise<string> => ipcRenderer.invoke('store:exportBackup'),
  importBackup: (jsonContent: string): Promise<boolean> => ipcRenderer.invoke('store:importBackup', jsonContent),
  resetToFactory: (): Promise<boolean> => ipcRenderer.invoke('store:resetToFactory'),

  // Session Management
  startSession: (params: {
    name: string;
    durationMinutes: number;
    strictMode: StrictModeLevel;
    blockWebsites: boolean;
    blockApps: boolean;
    preset?: string;
    pwLectureMode?: boolean;
  }): Promise<ActiveSession> => ipcRenderer.invoke('session:start', params),

  pauseSession: (): Promise<boolean> => ipcRenderer.invoke('session:pause'),
  resumeSession: (): Promise<boolean> => ipcRenderer.invoke('session:resume'),
  stopSession: (overridePassword?: boolean): Promise<boolean> =>
    ipcRenderer.invoke('session:stop', overridePassword),

  // Application Blocker
  getRunningProcesses: (): Promise<RunningProcessInfo[]> => ipcRenderer.invoke('apps:getRunning'),
  getInstalledApps: (): Promise<import('./types').InstalledAppInfo[]> => ipcRenderer.invoke('apps:getInstalled'),
  killApp: (executableName: string): Promise<boolean> => ipcRenderer.invoke('apps:kill', executableName),

  // Hosts / Web Blocker
  applyHostsBlock: (): Promise<{ success: boolean; requiresElevation: boolean; message: string }> =>
    ipcRenderer.invoke('hosts:apply'),
  restoreHosts: (): Promise<{ success: boolean; requiresElevation: boolean; message: string }> =>
    ipcRenderer.invoke('hosts:restore'),
  checkHostsStatus: (): Promise<{ isConfigured: boolean; canWriteDirectly: boolean }> =>
    ipcRenderer.invoke('hosts:check'),

  // Physics Wallah & Window Activity Tracker
  getCurrentActivity: (): Promise<import('./types').WindowActivity | null> =>
    ipcRenderer.invoke('activity:getCurrent'),

  // Window Controls
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),

  // Memory Management
  trimMemory: (): Promise<boolean> => ipcRenderer.invoke('system:trimMemory'),
  getMemoryUsage: (): Promise<NodeJS.MemoryUsage> => ipcRenderer.invoke('system:getMemoryUsage'),

  // Real-time Event Listeners
  onSessionTick: (callback: (secondsRemaining: number) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, seconds: number) => callback(seconds);
    ipcRenderer.on('scheduler:tick', handler);
    return () => ipcRenderer.removeListener('scheduler:tick', handler);
  },

  onSessionUpdate: (callback: (session: ActiveSession | null) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, session: ActiveSession | null) => callback(session);
    ipcRenderer.on('scheduler:sessionUpdated', handler);
    return () => ipcRenderer.removeListener('scheduler:sessionUpdated', handler);
  },

  onActivityChanged: (callback: (activity: import('./types').WindowActivity) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, act: import('./types').WindowActivity) =>
      callback(act);
    ipcRenderer.on('activity:changed', handler);
    return () => ipcRenderer.removeListener('activity:changed', handler);
  },

  onProcessBlocked: (callback: (info: { app: BlockedApp; pid: number; attempt: number }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, info: { app: BlockedApp; pid: number; attempt: number }) =>
      callback(info);
    ipcRenderer.on('apps:blocked', handler);
    return () => ipcRenderer.removeListener('apps:blocked', handler);
  },
};

export type FocusGuardApi = typeof api;

contextBridge.exposeInMainWorld('focusGuardApi', api);
