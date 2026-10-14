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
        const filePath = await window.focusGuardApi.exportBackup();
        setRestoreMessage(`Backup saved: ${filePath}`);
        setTimeout(() => setRestoreMessage(null), 4000);
      } catch (e) {
        setRestoreMessage(`Export error: ${String(e)}`);
      }
    }
  };

  const handleImportBackup = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const text = await file.text();
      if (window.focusGuardApi) {
        const success = await window.focusGuardApi.importBackup(text);
        if (success) {
          setRestoreMessage('Settings imported successfully!');
          onRefreshConfig();
          setTimeout(() => setRestoreMessage(null), 4000);
        } else {
          setRestoreMessage('Failed to import: invalid JSON format.');
        }
      }
    };
    input.click();
  };

  const handleFactoryReset = async () => {
    if (confirm('Are you sure you want to restore FocusGuard to factory defaults? All custom rules will be backed up.')) {
      if (window.focusGuardApi) {
        await window.focusGuardApi.resetToFactory();
        onRefreshConfig();
        setRestoreMessage('FocusGuard has been reset to factory defaults.');
        setTimeout(() => setRestoreMessage(null), 4000);
      }
    }
  };

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2.5">
          <SettingsIcon className="text-sky-400" size={22} />
          Settings & System Recovery
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Configure startup behavior, desktop notifications, emergency hosts restoration, and local backups.
        </p>
      </div>

      {restoreMessage && (
        <div className="p-3 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-300 text-xs flex items-center gap-2">
          <Check size={14} />
          <span>{restoreMessage}</span>
        </div>
      )}

      {/* General Preferences */}
      <div className="glass-panel p-5 space-y-4">
        <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
          Desktop Integration
        </h2>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-400">
                <Power size={16} />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-200">Start on Windows Boot</div>
                <div className="text-[11px] text-slate-400">
                  Automatically start FocusGuard in the system tray when Windows starts
                </div>
              </div>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={settings.startOnBoot}
                onChange={(e) => onUpdateSettings({ startOnBoot: e.target.checked })}
              />
              <span className="slider"></span>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                <Minimize2 size={16} />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-200">Minimize to System Tray</div>
                <div className="text-[11px] text-slate-400">
                  Closing the window keeps the blocking engine active in the background
                </div>
              </div>
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
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <Bell size={16} />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-200">Desktop Notifications</div>
                <div className="text-[11px] text-slate-400">
                  Notify when applications are intercepted or focus sessions finish
                </div>
              </div>
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
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
                <Volume2 size={16} />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-200">Sound Effects</div>
                <div className="text-[11px] text-slate-400">Play chime when session completes</div>
              </div>
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
      </div>

      {/* Emergency System Recovery */}
      <div className="glass-panel p-5 space-y-4 border border-rose-500/20">
        <div className="flex items-center gap-2">
          <AlertTriangle size={18} className="text-rose-400" />
          <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
            System Settings Recovery
          </h2>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          FocusGuard modifies the Windows hosts file during active focus sessions. If a crash or
          improper shutdown leaves websites blocked unexpectedly, you can clean it up here with one click.
        </p>

        <div className="p-3.5 rounded-lg bg-slate-900/60 border border-white/5 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-200">Hosts File State</div>
            <div className="text-[11px] text-slate-400">
              {hostsStatus.isConfigured ? (
                <span className="text-amber-400 font-semibold">Active block entries present in hosts</span>
              ) : (
                <span className="text-emerald-400 font-semibold">Clean (no FocusGuard block entries)</span>
              )}
            </div>
          </div>

          <button
            onClick={handleEmergencyRestoreHosts}
            className="btn-danger text-xs"
          >
            <RotateCcw size={13} />
            Emergency Restore Hosts File
          </button>
        </div>
      </div>

      {/* Backup and Data Management */}
      <div className="glass-panel p-5 space-y-4">
        <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
          Data & Backup Management
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={handleExportBackup}
            className="btn-secondary text-xs justify-center py-2.5"
          >
            <Download size={14} />
            Export Backup (.json)
          </button>

          <button
            onClick={handleImportBackup}
            className="btn-secondary text-xs justify-center py-2.5"
          >
            <Upload size={14} />
            Import Backup
          </button>

          <button
            onClick={handleFactoryReset}
            className="btn-secondary text-xs justify-center py-2.5 text-rose-400 hover:text-rose-300"
          >
            <RotateCcw size={14} />
            Factory Reset
          </button>
        </div>
      </div>

      {/* Honest Technical Limitations & Troubleshooting Card */}
      <div className="glass-panel p-5 space-y-3 border border-sky-500/20">
        <div className="flex items-center gap-2">
          <HelpCircle size={18} className="text-sky-400" />
          <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
            Technical Architecture & Limitations
          </h2>
        </div>

        <div className="text-xs text-slate-400 space-y-2.5 leading-relaxed">
          <p>
            <strong className="text-slate-200">1. DNS-over-HTTPS (DoH) Bypass:</strong> Modern browsers
            such as Google Chrome, Mozilla Firefox, and Microsoft Edge sometimes enable &quot;Secure DNS&quot;
            (DoH) by default. When DoH is enabled, the browser directly queries Cloudflare or Google DNS
            over HTTPS, bypassing the Windows system hosts file.
            <br />
            <span className="text-sky-300">Fix:</span> In your browser Settings → Security → disable
            &quot;Use Secure DNS&quot; (or set to &quot;Use your current service provider&quot;) for the
            hosts file block to take 100% immediate effect.
          </p>

          <p>
            <strong className="text-slate-200">2. VPNs & Proxies:</strong> If you connect to a third-party
            VPN tunnel or SOCKS5 proxy, traffic routing may bypass local loopback resolution depending on the
            VPN client configuration.
          </p>

          <p>
            <strong className="text-slate-200">3. Process Relaunching:</strong> FocusGuard inspects the
            active Windows process table every second and terminates blocked executables via taskkill. If a
            program has a background watchdog service, FocusGuard continues to terminate each newly launched
            instance and records every relaunch attempt.
          </p>
        </div>
      </div>
    </div>
  );
};
