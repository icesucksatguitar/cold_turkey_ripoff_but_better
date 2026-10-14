import { useState, useEffect, useCallback } from 'react';
import {
  BlockerStoreData,
  BlockedWebsite,
  BlockedApp,
  FocusSchedule,
  ActiveSession,
  ActivityLog,
  AppSettings,
  StrictModeLevel,
} from '../types';

const INITIAL_FALLBACK_DATA: BlockerStoreData = {
  websites: [
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
      domain: 'reddit.com',
      includeSubdomains: true,
      category: 'social',
      enabled: true,
      createdAt: Date.now(),
    },
  ],
  apps: [
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
  ],
  schedules: [],
  activeSession: null,
  activityLogs: [],
  settings: {
    startOnBoot: false,
    minimizeToTray: true,
    notificationsEnabled: true,
    soundEnabled: true,
    appBlockIntervalMs: 1000,
    hostsBlockMethod: 'hosts_file',
    theme: 'midnight',
    emergencyPhraseLength: 32,
  },
};

export function useBlockerStore() {
  const [data, setData] = useState<BlockerStoreData>(INITIAL_FALLBACK_DATA);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }, []);

  // Fetch initial config
  const refreshConfig = useCallback(async () => {
    if (window.focusGuardApi) {
      try {
        const config = await window.focusGuardApi.getConfig();
        setData(config);
        if (config.activeSession) {
          const diff = Math.max(0, Math.round((config.activeSession.endTime - Date.now()) / 1000));
          setRemainingSeconds(diff);
        } else {
          setRemainingSeconds(0);
        }
      } catch (e) {
        console.error('Failed to load config from electron:', e);
      }
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    refreshConfig();

    if (window.focusGuardApi) {
      const unsubTick = window.focusGuardApi.onSessionTick((seconds) => {
        setRemainingSeconds(seconds);
      });

      const unsubSession = window.focusGuardApi.onSessionUpdate((session) => {
        setData((prev) => ({ ...prev, activeSession: session }));
        if (!session) {
          setRemainingSeconds(0);
        }
      });

      const unsubBlocked = window.focusGuardApi.onProcessBlocked((info) => {
        showToast(`Intercepted ${info.app.name} (${info.pid}) - Attempt #${info.attempt}`);
        refreshConfig();
      });

      return () => {
        unsubTick();
        unsubSession();
        unsubBlocked();
      };
    }
  }, [refreshConfig, showToast]);

  // Save full data updates
  const updateData = async (updater: (prev: BlockerStoreData) => BlockerStoreData) => {
    setData((prev) => {
      const next = updater(prev);
      if (window.focusGuardApi) {
        window.focusGuardApi.saveConfig(next);
      }
      return next;
    });
  };

  // Website operations
  const addWebsite = async (domain: string, category: BlockedWebsite['category'], includeSubdomains: boolean) => {
    const cleanDomain = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!cleanDomain) return;

    await updateData((prev) => {
      const exists = prev.websites.some((w) => w.domain.toLowerCase() === cleanDomain);
      if (exists) {
        showToast(`Domain ${cleanDomain} is already in the block list.`);
        return prev;
      }
      const newWeb: BlockedWebsite = {
        id: `web-${Date.now()}`,
        domain: cleanDomain,
        category,
        includeSubdomains,
        enabled: true,
        createdAt: Date.now(),
      };
      return { ...prev, websites: [...prev.websites, newWeb] };
    });
    showToast(`Added ${cleanDomain} to block list.`);
  };

  const toggleWebsite = async (id: string) => {
    await updateData((prev) => ({
      ...prev,
      websites: prev.websites.map((w) => (w.id === id ? { ...w, enabled: !w.enabled } : w)),
    }));
  };

  const removeWebsite = async (id: string) => {
    await updateData((prev) => ({
      ...prev,
      websites: prev.websites.filter((w) => w.id !== id),
    }));
    showToast('Domain removed from block list.');
  };

  const blockAllWebsites = async () => {
    await updateData((prev) => ({
      ...prev,
      websites: prev.websites.map((w) => ({ ...w, enabled: true })),
    }));
    if (window.focusGuardApi && window.focusGuardApi.applyHostsBlock) {
      window.focusGuardApi.applyHostsBlock().catch(() => {});
    }
    showToast('Blocked all websites in list.');
  };

  const unblockAllWebsites = async () => {
    await updateData((prev) => ({
      ...prev,
      websites: prev.websites.map((w) => ({ ...w, enabled: false })),
    }));
    if (window.focusGuardApi && window.focusGuardApi.restoreHosts) {
      window.focusGuardApi.restoreHosts().catch(() => {});
    }
    showToast('Unblocked all websites.');
  };

  // App operations
  const addApp = async (name: string, executableName: string, path?: string) => {
    let cleanExe = executableName.trim();
    if (!cleanExe) return;
    if (!cleanExe.toLowerCase().endsWith('.exe')) {
      cleanExe = `${cleanExe}.exe`;
    }

    await updateData((prev) => {
      const exists = prev.apps.some((a) => a.executableName.toLowerCase() === cleanExe.toLowerCase());
      if (exists) {
        showToast(`${cleanExe} is already in your app block list.`);
        return prev;
      }
      const newApp: BlockedApp = {
        id: `app-${Date.now()}`,
        name: name.trim() || cleanExe.replace(/\.exe$/i, ''),
        executableName: cleanExe,
        path,
        enabled: true,
        createdAt: Date.now(),
      };
      return { ...prev, apps: [...prev.apps, newApp] };
    });
    showToast(`Added ${cleanExe} to app block list.`);
  };

  const toggleApp = async (id: string) => {
    await updateData((prev) => ({
      ...prev,
      apps: prev.apps.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a)),
    }));
  };

  const removeApp = async (id: string) => {
    await updateData((prev) => ({
      ...prev,
      apps: prev.apps.filter((a) => a.id !== id),
    }));
    showToast('Application removed from block list.');
  };

  const blockAllApps = async (appsToBlock: Array<{ name: string; executableName: string; path?: string }>) => {
    await updateData((prev) => {
      const existingMap = new Map(prev.apps.map((a) => [a.executableName.toLowerCase().trim(), a]));
      const updatedApps: BlockedApp[] = [...prev.apps];

      for (const item of appsToBlock) {
        let cleanExe = item.executableName.trim();
        if (!cleanExe) continue;
        if (!cleanExe.toLowerCase().endsWith('.exe')) cleanExe = `${cleanExe}.exe`;
        const key = cleanExe.toLowerCase();

        const existing = existingMap.get(key);
        if (existing) {
          existing.enabled = true;
        } else {
          const newApp: BlockedApp = {
            id: `app-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: item.name || cleanExe.replace(/\.exe$/i, ''),
            executableName: cleanExe,
            path: item.path,
            enabled: true,
            createdAt: Date.now(),
          };
          updatedApps.push(newApp);
          existingMap.set(key, newApp);
        }
      }

      return { ...prev, apps: updatedApps };
    });

    // Terminate any active running instances immediately
    if (window.focusGuardApi && window.focusGuardApi.killApp) {
      for (const item of appsToBlock) {
        window.focusGuardApi.killApp(item.executableName).catch(() => {});
      }
    }

    showToast(`Blocked all ${appsToBlock.length} applications and terminated running tasks.`);
  };

  const unblockAllApps = async () => {
    await updateData((prev) => ({
      ...prev,
      apps: prev.apps.map((a) => ({ ...a, enabled: false })),
    }));
    showToast('Unblocked all applications.');
  };

  // Schedules operations
  const addSchedule = async (schedule: Omit<FocusSchedule, 'id'>) => {
    const newSchedule: FocusSchedule = {
      ...schedule,
      id: `sched-${Date.now()}`,
    };
    await updateData((prev) => ({
      ...prev,
      schedules: [...prev.schedules, newSchedule],
    }));
    showToast(`Added schedule: ${schedule.name}`);
  };

  const toggleSchedule = async (id: string) => {
    await updateData((prev) => ({
      ...prev,
      schedules: prev.schedules.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)),
    }));
  };

  const removeSchedule = async (id: string) => {
    await updateData((prev) => ({
      ...prev,
      schedules: prev.schedules.filter((s) => s.id !== id),
    }));
    showToast('Schedule removed.');
  };

  // Session controls
  const startSession = async (params: {
    name: string;
    durationMinutes: number;
    strictMode: StrictModeLevel;
    blockWebsites: boolean;
    blockApps: boolean;
    preset?: string;
  }) => {
    if (window.focusGuardApi) {
      try {
        const session = await window.focusGuardApi.startSession(params);
        setData((prev) => ({ ...prev, activeSession: session }));
        setRemainingSeconds(params.durationMinutes * 60);
        showToast(`Focus Session Started: ${params.durationMinutes}m`);
      } catch (e) {
        showToast(`Failed to start session: ${String(e)}`);
      }
    } else {
      // Browser fallback simulation
      const mockSession: ActiveSession = {
        id: `session-${Date.now()}`,
        name: params.name,
        startTime: Date.now(),
        durationMinutes: params.durationMinutes,
        endTime: Date.now() + params.durationMinutes * 60 * 1000,
        strictMode: params.strictMode,
        isPaused: false,
        blockWebsites: params.blockWebsites,
        blockApps: params.blockApps,
        preset: params.preset,
        source: 'manual',
      };
      setData((prev) => ({ ...prev, activeSession: mockSession }));
      setRemainingSeconds(params.durationMinutes * 60);
      showToast('Session started (simulation)');
    }
  };

  const pauseSession = async () => {
    if (window.focusGuardApi) {
      await window.focusGuardApi.pauseSession();
      refreshConfig();
    }
  };

  const resumeSession = async () => {
    if (window.focusGuardApi) {
      await window.focusGuardApi.resumeSession();
      refreshConfig();
    }
  };

  const stopSession = async (overridePassword?: boolean): Promise<boolean> => {
    if (window.focusGuardApi) {
      const stopped = await window.focusGuardApi.stopSession(overridePassword);
      if (stopped) {
        refreshConfig();
        showToast('Focus session ended.');
        return true;
      }
      return false;
    } else {
      setData((prev) => ({ ...prev, activeSession: null }));
      setRemainingSeconds(0);
      showToast('Session ended (simulation)');
      return true;
    }
  };

  const updateSettings = async (partial: Partial<AppSettings>) => {
    await updateData((prev) => ({
      ...prev,
      settings: { ...prev.settings, ...partial },
    }));
    showToast('Settings saved.');
  };

  return {
    data,
    isLoading,
    remainingSeconds,
    toastMessage,
    showToast,
    refreshConfig,
    addWebsite,
    toggleWebsite,
    removeWebsite,
    blockAllWebsites,
    unblockAllWebsites,
    addApp,
    toggleApp,
    removeApp,
    blockAllApps,
    unblockAllApps,
    addSchedule,
    toggleSchedule,
    removeSchedule,
    startSession,
    pauseSession,
    resumeSession,
    stopSession,
    updateSettings,
  };
}
