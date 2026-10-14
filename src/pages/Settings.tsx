import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  RotateCcw,
  Download,
  Upload,
  AlertTriangle,
  ShieldCheck,
  Bell,
  Volume2,
  Minimize2,
  Power,
  FileText,
  HelpCircle,
  Check,
  Zap,
} from 'lucide-react';
import { AppSettings } from '../types';

interface SettingsPageProps {
  settings: AppSettings;
  onUpdateSettings: (partial: Partial<AppSettings>) => void;
  onRefreshConfig: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  settings,
  onUpdateSettings,
  onRefreshConfig,
}) => {
  const [hostsStatus, setHostsStatus] = useState<{ isConfigured: boolean; canWriteDirectly: boolean }>({
    isConfigured: false,
    canWriteDirectly: false,
  });
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);
  const [trimNotice, setTrimNotice] = useState<string | null>(null);

  const checkHosts = async () => {
    if (window.focusGuardApi) {
      try {
        const res = await window.focusGuardApi.checkHostsStatus();
        setHostsStatus(res);
      } catch (e) {
        console.error('Failed to check hosts status:', e);
      }
    }
  };

  useEffect(() => {
    checkHosts();
  }, []);

  const handleEmergencyRestoreHosts = async () => {
    if (window.focusGuardApi) {
      try {
        const res = await window.focusGuardApi.restoreHosts();
        setRestoreMessage(res.message);
        checkHosts();
        setTimeout(() => setRestoreMessage(null), 4000);
      } catch (err: unknown) {
        setRestoreMessage(`Failed to restore: ${String(err)}`);
      }
    }
  };

  const handleExportBackup = async () => {
    if (window.focusGuardApi) {
      try {
        const json = await window.focusGuardApi.exportBackup();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `focusguard_backup_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (e) {
        console.error('Export failed:', e);
      }
    }
  };

  const handleResetFactory = async () => {
    if (confirm('Are you sure you want to restore FocusGuard to factory defaults? All custom rules will be reset.')) {
      if (window.focusGuardApi) {
        await window.focusGuardApi.resetToFactory();
        onRefreshConfig();
      }
    }
  };

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full bg-black text-white select-none">
      {/* Header */}
      <div className="border-b border-white/10 pb-5">
        <div className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">
          Configuration & Engine Controls
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white mt-1 flex items-center gap-2.5">
          <SettingsIcon className="text-white" size={24} />
          System Settings
        </h1>
        <p className="text-xs text-zinc-400 mt-1">
          Configure notifications, system tray behavior, local backup, and recovery mechanisms.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-4xl">
        {/* General Behavior */}
        <div className="p-5 rounded-2xl bg-zinc-950 border border-white/10 space-y-4">
          <h3 className="font-bold text-sm text-white font-mono uppercase tracking-wider">
            Application Preferences
          </h3>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-white">Minimize to System Tray</div>
              <div className="text-[11px] text-zinc-500">Keep FocusGuard protecting in the background</div>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={settings.minimizeToTray}
                onChange={(e) => onUpdateSettings({ minimizeToTray: e.target.checked })}
              />
              <span className="slider"></span>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-white">Interception Notifications</div>
              <div className="text-[11px] text-zinc-500">Show desktop alert when a distraction is blocked</div>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={settings.notificationsEnabled}
                onChange={(e) => onUpdateSettings({ notificationsEnabled: e.target.checked })}
              />
              <span className="slider"></span>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-white">Audible Notification Chime</div>
              <div className="text-[11px] text-zinc-500">Play subtle sound when a distraction is terminated</div>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={settings.soundEnabled}
                onChange={(e) => onUpdateSettings({ soundEnabled: e.target.checked })}
              />
              <span className="slider"></span>
            </label>
          </div>
        </div>

        {/* Hosts & Safety Recovery */}
        <div className="p-5 rounded-2xl bg-zinc-950 border border-white/10 space-y-4">
          <h3 className="font-bold text-sm text-white font-mono uppercase tracking-wider">
            DNS & Hosts Safety Engine
          </h3>

          <div className="p-3.5 rounded-xl bg-black border border-white/10 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400 font-mono">Hosts File Status</span>
              {hostsStatus.isConfigured ? (
                <span className="badge badge-blocked">FILTERING ACTIVE</span>
              ) : (
                <span className="badge badge-idle">CLEAN / INACTIVE</span>
              )}
            </div>
            <p className="text-[11px] text-zinc-500">
              {hostsStatus.isConfigured
                ? 'Protected redirect markers are installed in Windows hosts file.'
                : 'Windows hosts file contains no active FocusGuard block entries.'}
            </p>
          </div>

          <button
            onClick={handleEmergencyRestoreHosts}
            className="btn-secondary w-full justify-center text-xs"
          >
            <RotateCcw size={13} />
            <span>Emergency Restore Clean Hosts File</span>
          </button>

          {restoreMessage && (
            <p className="text-xs font-mono text-white text-center">{restoreMessage}</p>
          )}
        </div>

        {/* Memory & Engine Optimization */}
        <div className="p-5 rounded-2xl bg-zinc-950 border border-white/10 space-y-4 md:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-white font-mono uppercase tracking-wider flex items-center gap-2">
              <Zap size={14} className="text-white" />
              RAM & Resource Optimization
            </h3>
            <span className="badge badge-active text-[10px]">ULTRA-LOW RAM ACTIVE</span>
          </div>
          <p className="text-xs text-zinc-400">
            FocusGuard is optimized with zero-RAM background mode (Chromium window destroyed when closed to tray), GPU hardware-acceleration bypass, adaptive process scanning, and native Win32 working set trimming.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div className="p-3 rounded-xl bg-black border border-white/10">
              <div className="text-[10px] font-mono text-zinc-500 uppercase">Tray Background Mode</div>
              <div className="text-sm font-bold text-white mt-0.5">Zero-Window (~15 MB)</div>
            </div>
            <div className="p-3 rounded-xl bg-black border border-white/10">
              <div className="text-[10px] font-mono text-zinc-500 uppercase">Chromium GPU Process</div>
              <div className="text-sm font-bold text-white mt-0.5">Disabled (0 MB)</div>
            </div>
            <div className="p-3 rounded-xl bg-black border border-white/10">
              <div className="text-[10px] font-mono text-zinc-500 uppercase">Native Memory Trimmer</div>
              <div className="text-sm font-bold text-white mt-0.5">Active (Every 60s)</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={async () => {
                if (window.focusGuardApi?.trimMemory) {
                  await window.focusGuardApi.trimMemory();
                  setTrimNotice('Memory flushed to standby cache!');
                  setTimeout(() => setTrimNotice(null), 3000);
                }
              }}
              className="btn-secondary text-xs"
            >
              <Zap size={13} />
              <span>Flush & Trim Working Set Now</span>
            </button>
            {trimNotice && <span className="text-xs font-mono text-white">{trimNotice}</span>}
          </div>
        </div>

        {/* Database & Backup */}
        <div className="p-5 rounded-2xl bg-zinc-950 border border-white/10 space-y-4 md:col-span-2">
          <h3 className="font-bold text-sm text-white font-mono uppercase tracking-wider">
            Data Persistence & Maintenance
          </h3>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <button onClick={handleExportBackup} className="btn-secondary flex-1 justify-center text-xs">
              <Download size={13} />
              <span>Export Local JSON Backup</span>
            </button>
            <button onClick={handleResetFactory} className="btn-danger flex-1 justify-center text-xs">
              <AlertTriangle size={13} />
              <span>Reset to Factory Defaults</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
