export type StrictModeLevel = 'none' | 'locked' | 'extreme';

export interface BlockedWebsite {
  id: string;
  domain: string;
  includeSubdomains: boolean;
  category: 'social' | 'entertainment' | 'gaming' | 'news' | 'adult' | 'custom';
  enabled: boolean;
  createdAt: number;
}

export interface BlockedApp {
  id: string;
  name: string;
  executableName: string; // e.g., "Discord.exe" or "steam.exe"
  path?: string;
  enabled: boolean;
  createdAt: number;
}

export interface FocusSchedule {
  id: string;
  name: string;
  enabled: boolean;
  startTime: string; // "HH:mm" (24h)
  endTime: string;   // "HH:mm" (24h)
  daysOfWeek: number[]; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  blockWebsites: boolean;
  blockApps: boolean;
  strictMode: StrictModeLevel;
  presetName?: string;
}

export interface ActiveSession {
  id: string;
  name: string;
  startTime: number;      // Unix timestamp ms
  durationMinutes: number;
  endTime: number;        // Unix timestamp ms
  strictMode: StrictModeLevel;
  isPaused: boolean;
  pausedTimeRemainingMs?: number;
  preset?: string;
  blockWebsites: boolean;
  blockApps: boolean;
  source: 'manual' | 'schedule';
}

export interface ActivityLog {
  id: string;
  timestamp: number;
  type: 'app_blocked' | 'website_blocked' | 'session_start' | 'session_end' | 'schedule_trigger' | 'emergency_unlock' | 'system';
  target: string;
  details: string;
}

export interface AppSettings {
  startOnBoot: boolean;
  minimizeToTray: boolean;
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  appBlockIntervalMs: number; // default 1000ms
  hostsBlockMethod: 'hosts_file' | 'loopback';
  theme: 'dark' | 'midnight' | 'slate';
  emergencyPhraseLength: number; // default 32
}

export interface SystemStatus {
  isElevated: boolean;
  hostsFileConfigured: boolean;
  activeSession: ActiveSession | null;
  blockedWebsitesCount: number;
  blockedAppsCount: number;
  activeSchedulesCount: number;
  lastBackupPath: string | null;
}

export interface RunningProcessInfo {
  pid: number;
  name: string;
  windowTitle?: string;
}

export interface InstalledAppInfo {
  id: string;
  name: string;
  executableName: string;
  path?: string;
  isBlocked: boolean;
  isRunning?: boolean;
}

export interface BlockerStoreData {
  websites: BlockedWebsite[];
  apps: BlockedApp[];
  schedules: FocusSchedule[];
  activeSession: ActiveSession | null;
  activityLogs: ActivityLog[];
  settings: AppSettings;
}

export interface IpcResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
