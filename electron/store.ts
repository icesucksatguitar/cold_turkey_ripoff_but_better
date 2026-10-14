import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import {
  BlockerStoreData,
  BlockedWebsite,
  BlockedApp,
  FocusSchedule,
  ActiveSession,
  ActivityLog,
  AppSettings,
} from './types';

const DEFAULT_SETTINGS: AppSettings = {
  startOnBoot: false,
  minimizeToTray: true,
  notificationsEnabled: true,
  soundEnabled: true,
  appBlockIntervalMs: 1000,
  hostsBlockMethod: 'hosts_file',
  theme: 'midnight',
  emergencyPhraseLength: 32,
};

const DEFAULT_WEBSITES: BlockedWebsite[] = [
  {
    id: 'web-1',
    domain: 'youtube.com',
    includeSubdomains: true,
    category: 'entertainment',
    enabled: true,
    createdAt: Date.now(),
  },
  {
    id: 'web-2',
    domain: 'x.com',
    includeSubdomains: true,
    category: 'social',
    enabled: true,
    createdAt: Date.now(),
  },
  {
    id: 'web-3',
    domain: 'twitter.com',
    includeSubdomains: true,
    category: 'social',
    enabled: true,
    createdAt: Date.now(),
  },
  {
    id: 'web-4',
    domain: 'reddit.com',
    includeSubdomains: true,
    category: 'social',
    enabled: true,
    createdAt: Date.now(),
  },
  {
    id: 'web-5',
    domain: 'instagram.com',
    includeSubdomains: true,
    category: 'social',
    enabled: true,
    createdAt: Date.now(),
  },
  {
    id: 'web-6',
    domain: 'tiktok.com',
    includeSubdomains: true,
    category: 'entertainment',
    enabled: true,
    createdAt: Date.now(),
  },
  {
    id: 'web-7',
    domain: 'twitch.tv',
    includeSubdomains: true,
    category: 'entertainment',
    enabled: true,
    createdAt: Date.now(),
  },
];

const DEFAULT_APPS: BlockedApp[] = [
  {
    id: 'app-1',
    name: 'Discord',
    executableName: 'Discord.exe',
    enabled: true,
    createdAt: Date.now(),
  },
  {
    id: 'app-2',
    name: 'Steam',
    executableName: 'steam.exe',
    enabled: true,
    createdAt: Date.now(),
  },
  {
    id: 'app-3',
    name: 'Spotify',
    executableName: 'Spotify.exe',
    enabled: false,
    createdAt: Date.now(),
  },
];

const DEFAULT_SCHEDULES: FocusSchedule[] = [
  {
    id: 'sched-1',
    name: 'Workday Focus Hours',
    enabled: false,
    startTime: '09:00',
    endTime: '12:00',
    daysOfWeek: [1, 2, 3, 4, 5], // Monday through Friday
    blockWebsites: true,
    blockApps: true,
    strictMode: 'locked',
    presetName: 'Deep Work',
  },
  {
    id: 'sched-2',
    name: 'Afternoon Sprint',
    enabled: false,
    startTime: '14:00',
    endTime: '17:00',
    daysOfWeek: [1, 2, 3, 4, 5],
    blockWebsites: true,
    blockApps: true,
    strictMode: 'none',
    presetName: 'Study',
  },
];

export class BlockerStore {
  private dataDir: string;
  private filePath: string;
  private backupDir: string;
  private data: BlockerStoreData;

  constructor() {
    try {
      this.dataDir = app ? app.getPath('userData') : path.join(process.env.APPDATA || process.cwd(), 'FocusGuard');
    } catch {
      this.dataDir = path.join(process.env.APPDATA || process.cwd(), 'FocusGuard');
    }

    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    this.backupDir = path.join(this.dataDir, 'backups');
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }

    this.filePath = path.join(this.dataDir, 'config.json');
    this.data = this.loadInitialData();
  }

  public getDataDir(): string {
    return this.dataDir;
  }

  public getBackupDir(): string {
    return this.backupDir;
  }

  private loadInitialData(): BlockerStoreData {
    if (fs.existsSync(this.filePath)) {
      try {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw) as Partial<BlockerStoreData>;
        return {
          websites: parsed.websites || DEFAULT_WEBSITES,
          apps: parsed.apps || DEFAULT_APPS,
          schedules: parsed.schedules || DEFAULT_SCHEDULES,
          activeSession: parsed.activeSession || null,
          activityLogs: (parsed.activityLogs || []).slice(0, 100),
          settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
        };
      } catch (err) {
        console.error('Failed to parse config.json, recovering with defaults:', err);
      }
    }

    const defaultData: BlockerStoreData = {
      websites: DEFAULT_WEBSITES,
      apps: DEFAULT_APPS,
      schedules: DEFAULT_SCHEDULES,
      activeSession: null,
      activityLogs: [
        {
          id: 'log-init',
          timestamp: Date.now(),
          type: 'system',
          target: 'System',
          details: 'FocusGuard local database initialized.',
        },
      ],
      settings: DEFAULT_SETTINGS,
    };

    this.persist(defaultData);
    return defaultData;
  }

  public getData(): BlockerStoreData {
    return this.data;
  }

  public persist(newData?: BlockerStoreData): void {
    if (newData) {
      this.data = newData;
    }

    try {
      const jsonStr = JSON.stringify(this.data, null, 2);
      const tempPath = `${this.filePath}.tmp`;
      fs.writeFileSync(tempPath, jsonStr, 'utf-8');
      fs.renameSync(tempPath, this.filePath);
    } catch (err) {
      console.error('Error persisting config to disk:', err);
    }
  }

  public addLog(type: ActivityLog['type'], target: string, details: string): ActivityLog {
    const log: ActivityLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      type,
      target,
      details,
    };

    // Keep the most recent 100 logs to minimize memory usage
    this.data.activityLogs.unshift(log);
    if (this.data.activityLogs.length > 100) {
      this.data.activityLogs = this.data.activityLogs.slice(0, 100);
    }

    this.persist();
    return log;
  }

  public clearLogs(): void {
    this.data.activityLogs = [];
    this.persist();
  }

  public exportBackup(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(this.backupDir, `focusguard_backup_${timestamp}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(this.data, null, 2), 'utf-8');
    return backupFile;
  }

  public importBackup(jsonContent: string): boolean {
    try {
      const parsed = JSON.parse(jsonContent);
      if (Array.isArray(parsed.websites) && Array.isArray(parsed.apps)) {
        // Back up current config first
        this.exportBackup();
        this.data = {
          websites: parsed.websites,
          apps: parsed.apps,
          schedules: parsed.schedules || [],
          activeSession: null, // do not import active lock to prevent corrupted lockups
          activityLogs: parsed.activityLogs || [],
          settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
        };
        this.persist();
        this.addLog('system', 'Backup', 'Config successfully imported from backup file.');
        return true;
      }
    } catch (e) {
      console.error('Failed to import backup:', e);
    }
    return false;
  }

  public resetToFactory(): void {
    this.exportBackup();
    this.data = {
      websites: DEFAULT_WEBSITES,
      apps: DEFAULT_APPS,
      schedules: DEFAULT_SCHEDULES,
      activeSession: null,
      activityLogs: [
        {
          id: `log-${Date.now()}`,
          timestamp: Date.now(),
          type: 'system',
          target: 'System',
          details: 'FocusGuard restored to factory settings.',
        },
      ],
      settings: DEFAULT_SETTINGS,
    };
    this.persist();
  }
}
