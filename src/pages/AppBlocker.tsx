import React, { useState, useEffect } from 'react';
import {
  AppWindow,
  Plus,
  Trash2,
  Search,
  ListPlus,
  RefreshCw,
  ShieldCheck,
  AlertCircle,
  Activity,
} from 'lucide-react';
import { BlockedApp, RunningProcessInfo } from '../types';

interface AppBlockerProps {
  apps: BlockedApp[];
  onAddApp: (name: string, executableName: string, path?: string) => void;
  onToggleApp: (id: string) => void;
  onRemoveApp: (id: string) => void;
  relaunchCounts?: Record<string, number>;
}

export const AppBlocker: React.FC<AppBlockerProps> = ({
  apps,
  onAddApp,
  onToggleApp,
  onRemoveApp,
}) => {
  const [appName, setAppName] = useState('');
  const [exeName, setExeName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showProcessPicker, setShowProcessPicker] = useState(false);
  const [runningProcesses, setRunningProcesses] = useState<RunningProcessInfo[]>([]);
  const [isLoadingProcesses, setIsLoadingProcesses] = useState(false);
  const [processFilter, setProcessFilter] = useState('');

  const handleManualAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!exeName.trim()) return;
    onAddApp(appName.trim() || exeName.trim(), exeName.trim());
    setAppName('');
    setExeName('');
  };

  const loadRunningProcesses = async () => {
    setIsLoadingProcesses(true);
    if (window.focusGuardApi) {
      try {
        const procs = await window.focusGuardApi.getRunningProcesses();
        setRunningProcesses(procs);
      } catch (err) {
        console.error('Failed to query running processes:', err);
      }
    } else {
      // Mock processes for dev
      setRunningProcesses([
        { pid: 1420, name: 'Discord.exe', windowTitle: 'Discord' },
        { pid: 5892, name: 'steam.exe', windowTitle: 'Steam' },
        { pid: 8912, name: 'Spotify.exe', windowTitle: 'Spotify Premium' },
        { pid: 9942, name: 'EpicGamesLauncher.exe', windowTitle: 'Epic Games' },
      ]);
    }
    setIsLoadingProcesses(false);
  };

  useEffect(() => {
    if (showProcessPicker) {
      loadRunningProcesses();
    }
  }, [showProcessPicker]);

  const filteredApps = apps.filter(
    (a) =>
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.executableName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredRunningProcesses = runningProcesses.filter((p) => {
    const q = processFilter.toLowerCase();
    return p.name.toLowerCase().includes(q) || (p.windowTitle && p.windowTitle.toLowerCase().includes(q));
  });

  return (
    <div className="p-6 space-y-5 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2.5">
            <AppWindow className="text-indigo-400" size={22} />
            Application Blocker
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Intercepts running processes and prevents launching during focus sessions.
          </p>
        </div>

        <button
          onClick={() => setShowProcessPicker(true)}
          className="btn-primary text-xs"
        >
          <ListPlus size={15} />
          Pick from Running Apps
        </button>
      </div>

      {/* Manual Add Form Card */}
      <div className="glass-panel p-4">
        <form onSubmit={handleManualAdd} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            <div className="md:col-span-5">
              <input
                type="text"
                placeholder="Executable filename (e.g. Discord.exe or steam.exe)"
                value={exeName}
                onChange={(e) => setExeName(e.target.value)}
                className="input-field text-xs font-mono"
              />
            </div>

            <div className="md:col-span-5">
              <input
                type="text"
                placeholder="Friendly display name (optional, e.g. Discord)"
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                className="input-field text-xs"
              />
            </div>

            <div className="md:col-span-2">
              <button type="submit" className="btn-secondary w-full justify-center text-xs">
                <Plus size={14} />
                Add App
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Search */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search apps..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field pl-9 text-xs"
          />
        </div>
      </div>

      {/* Apps List */}
      <div className="glass-panel overflow-hidden">
        {filteredApps.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <AppWindow size={32} className="mx-auto text-slate-600" />
            <p className="text-sm font-semibold text-slate-300">No applications blocked</p>
            <p className="text-xs text-slate-500">
              Click &quot;Pick from Running Apps&quot; or enter an executable name above.
            </p>
          </div>
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-slate-900/40 text-slate-400">
                <th className="py-2.5 px-4 font-semibold">Application</th>
                <th className="py-2.5 px-4 font-semibold">Executable</th>
                <th className="py-2.5 px-4 font-semibold">Status</th>
                <th className="py-2.5 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredApps.map((item) => (
                <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 px-4 font-semibold text-slate-200">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 text-[10px] font-bold">
                        {item.name.charAt(0).toUpperCase()}
                      </div>
                      <span>{item.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">
                    {item.executableName}
                  </td>
                  <td className="py-3 px-4">
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={item.enabled}
                        onChange={() => onToggleApp(item.id)}
                      />
                      <span className="slider"></span>
                    </label>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => onRemoveApp(item.id)}
                      className="w-7 h-7 rounded flex items-center justify-center text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors ml-auto"
                      title="Remove application"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Safety Notice Card */}
      <div className="p-3.5 rounded-xl bg-slate-900/40 border border-white/5 flex items-start gap-3">
        <ShieldCheck size={16} className="text-sky-400 shrink-0 mt-0.5" />
        <div className="text-[11px] text-slate-400 leading-relaxed">
          <strong className="text-slate-200">Built-in Windows Safety Guard:</strong> FocusGuard maintains
          a strict whitelist of essential system processes (e.g. explorer.exe, dwm.exe, svchost.exe) that
          can never be terminated, ensuring total operating system stability.
        </div>
      </div>

      {/* Running Process Browser Modal */}
      {showProcessPicker && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="glass-panel max-w-xl w-full p-6 space-y-4 border border-indigo-500/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity size={18} className="text-indigo-400" />
                <h3 className="text-sm font-bold text-slate-100">Running Applications on Windows</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={loadRunningProcesses}
                  className="w-7 h-7 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10"
                  title="Refresh list"
                >
                  <RefreshCw size={13} className={isLoadingProcesses ? 'animate-spin' : ''} />
                </button>
                <button
                  onClick={() => setShowProcessPicker(false)}
                  className="text-slate-500 hover:text-slate-300 ml-2"
                >
                  ✕
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-400">
              Select any currently running program to instantly add it to your distraction block list:
            </p>

            <div className="relative">
              <Search size={14} className="absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Filter running processes..."
                value={processFilter}
                onChange={(e) => setProcessFilter(e.target.value)}
                className="input-field pl-9 text-xs"
              />
            </div>

            <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
              {filteredRunningProcesses.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  {isLoadingProcesses ? 'Scanning active processes...' : 'No matching processes found.'}
                </div>
              ) : (
                filteredRunningProcesses.map((proc, idx) => {
                  const isAlreadyAdded = apps.some(
                    (a) => a.executableName.toLowerCase() === proc.name.toLowerCase()
                  );
                  return (
                    <div
                      key={`${proc.pid}-${idx}`}
                      className="p-2.5 rounded-lg bg-slate-900/60 border border-white/5 flex items-center justify-between hover:bg-white/5 transition-colors"
                    >
                      <div className="overflow-hidden mr-2">
                        <div className="font-semibold text-xs text-slate-200 truncate">
                          {proc.windowTitle || proc.name}
                        </div>
                        <div className="font-mono text-[10px] text-slate-400 truncate">
                          {proc.name} (PID: {proc.pid})
                        </div>
                      </div>

                      {isAlreadyAdded ? (
                        <span className="text-[10px] font-semibold text-slate-500 px-2 py-0.5 rounded bg-white/5">
                          Added
                        </span>
                      ) : (
                        <button
                          onClick={() => {
                            onAddApp(proc.windowTitle || proc.name, proc.name);
                          }}
                          className="btn-primary py-1 px-2.5 text-[11px]"
                        >
                          <Plus size={11} />
                          Block
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowProcessPicker(false)}
                className="btn-secondary text-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
