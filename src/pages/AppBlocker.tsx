import React, { useState, useEffect } from 'react';
import {
  AppWindow,
  Search,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  Plus,
  Trash2,
  Check,
  Power,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { BlockedApp, InstalledAppInfo } from '../types';

interface AppBlockerProps {
  apps: BlockedApp[];
  onAddApp: (name: string, executableName: string, path?: string) => void;
  onToggleApp: (id: string) => void;
  onRemoveApp: (id: string) => void;
  onBlockAllApps?: (appsToBlock: Array<{ name: string; executableName: string; path?: string }>) => void;
  onUnblockAllApps?: () => void;
}

export const AppBlocker: React.FC<AppBlockerProps> = ({
  apps,
  onAddApp,
  onToggleApp,
  onRemoveApp,
  onBlockAllApps,
  onUnblockAllApps,
}) => {
  const [installedApps, setInstalledApps] = useState<InstalledAppInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'blocked' | 'running'>('all');
  
  // Custom manual add accordion state
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customExe, setCustomExe] = useState('');

  // Extract all apps from the PC
  const loadApps = async () => {
    setIsLoading(true);
    if (window.focusGuardApi && window.focusGuardApi.getInstalledApps) {
      try {
        const list = await window.focusGuardApi.getInstalledApps();
        setInstalledApps(list);
      } catch (err) {
        console.error('Failed to query installed apps:', err);
      }
    } else {
      // Development fallback simulation
      setInstalledApps([
        { id: 'app-discord', name: 'Discord', executableName: 'Discord.exe', isBlocked: true, isRunning: true },
        { id: 'app-spotify', name: 'Spotify', executableName: 'Spotify.exe', isBlocked: true, isRunning: false },
        { id: 'app-steam', name: 'Steam', executableName: 'steam.exe', isBlocked: true, isRunning: false },
        { id: 'app-chrome', name: 'Google Chrome', executableName: 'chrome.exe', isBlocked: false, isRunning: true },
        { id: 'app-edge', name: 'Microsoft Edge', executableName: 'msedge.exe', isBlocked: false, isRunning: true },
        { id: 'app-epic', name: 'Epic Games Launcher', executableName: 'EpicGamesLauncher.exe', isBlocked: false, isRunning: false },
        { id: 'app-slack', name: 'Slack', executableName: 'slack.exe', isBlocked: false, isRunning: false },
        { id: 'app-obsidian', name: 'Obsidian', executableName: 'Obsidian.exe', isBlocked: false, isRunning: true },
      ]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadApps();
  }, []);

  // Compute merged status between installed apps and the current store
  const mergedApps = React.useMemo(() => {
    const blockedMap = new Map<string, BlockedApp>();
    for (const b of apps) {
      blockedMap.set(b.executableName.toLowerCase().trim(), b);
    }

    return installedApps.map((inst) => {
      const stored = blockedMap.get(inst.executableName.toLowerCase().trim());
      return {
        ...inst,
        isBlocked: stored ? stored.enabled : false,
        storeId: stored?.id,
      };
    });
  }, [installedApps, apps]);

  // Handle single-click toggle
  const handleToggle = async (item: typeof mergedApps[0]) => {
    const nextState = !item.isBlocked;

    if (item.storeId) {
      // App is already tracked in store, toggle it
      onToggleApp(item.storeId);
    } else {
      // App is newly being blocked, add it to store
      onAddApp(item.name, item.executableName, item.path);
    }

    // If turning ON (blocking), immediately terminate any running instance on screen
    if (nextState && window.focusGuardApi && window.focusGuardApi.killApp) {
      try {
        await window.focusGuardApi.killApp(item.executableName);
      } catch (err) {
        console.warn('Could not kill process:', err);
      }
    }
  };

  const handleManualAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customExe.trim()) return;
    let clean = customExe.trim();
    if (!clean.toLowerCase().endsWith('.exe')) clean = `${clean}.exe`;
    onAddApp(customName.trim() || clean.replace(/\.exe$/i, ''), clean);
    if (window.focusGuardApi && window.focusGuardApi.killApp) {
      window.focusGuardApi.killApp(clean).catch(() => {});
    }
    setCustomName('');
    setCustomExe('');
    setShowManualAdd(false);
    loadApps();
  };

  // Filter apps
  const filteredApps = mergedApps.filter((a) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      a.name.toLowerCase().includes(q) ||
      a.executableName.toLowerCase().includes(q);

    if (!matchesSearch) return false;
    if (filterMode === 'blocked') return a.isBlocked;
    if (filterMode === 'running') return a.isRunning;
    return true;
  });

  const totalDetected = installedApps.length;
  const totalBlocked = apps.filter((a) => a.enabled).length;
  const totalRunning = mergedApps.filter((a) => a.isRunning).length;

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full bg-black text-white select-none">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono tracking-widest text-zinc-400 uppercase">
            <span>Windows Process Firewall</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-1 flex items-center gap-3">
            <AppWindow size={24} className="text-white" />
            Application Blocker
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Auto-detected applications on your PC. Toggle any app ON to block and terminate it immediately.
          </p>
        </div>

        {/* Rescan Button */}
        <button
          onClick={loadApps}
          disabled={isLoading}
          className="btn-primary"
          title="Rescan PC for installed and running applications"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          <span>{isLoading ? 'Scanning PC...' : 'Rescan PC Apps'}</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-4 rounded-xl bg-zinc-950 border border-white/10 flex flex-col">
          <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">Detected PC Apps</span>
          <span className="text-2xl font-mono font-bold text-white mt-1">{totalDetected}</span>
        </div>
        <div className="p-4 rounded-xl bg-zinc-950 border border-white/20 flex flex-col">
          <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider">Currently Blocked</span>
          <span className="text-2xl font-mono font-bold text-white mt-1">{totalBlocked}</span>
        </div>
        <div className="p-4 rounded-xl bg-zinc-950 border border-white/10 flex flex-col">
          <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">Running Right Now</span>
          <span className="text-2xl font-mono font-bold text-white mt-1">{totalRunning}</span>
        </div>
      </div>

      {/* Bulk Control Action Card */}
      <div className="p-4 rounded-xl bg-zinc-950 border border-white/15 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white text-black flex items-center justify-center font-bold shrink-0">
            <ShieldAlert size={18} />
          </div>
          <div>
            <div className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
              <span>System-Wide Application Lockdown</span>
              <span className="px-1.5 py-0.5 rounded bg-white/10 text-white text-[10px] font-normal">
                {mergedApps.length} Apps Ready
              </span>
            </div>
            <div className="text-[11px] text-zinc-400 mt-0.5">
              Instantly enforce full process restriction across all detected applications on this PC.
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
          <button
            onClick={() => {
              if (onBlockAllApps) {
                onBlockAllApps(mergedApps);
              }
            }}
            className="btn-primary text-xs font-mono font-bold"
            title="Block and terminate all detected applications immediately"
          >
            <ShieldAlert size={14} />
            <span>BLOCK ALL ({mergedApps.length} APPS)</span>
          </button>

          <button
            onClick={() => {
              if (onUnblockAllApps) {
                onUnblockAllApps();
              }
            }}
            className="btn-secondary text-xs font-mono"
            title="Unblock all applications"
          >
            <ShieldCheck size={14} />
            <span>ALLOW ALL</span>
          </button>
        </div>
      </div>

      {/* Controls & Search */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search size={14} className="absolute left-3.5 top-3 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search detected apps..."
            className="input-field pl-9"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-zinc-950 border border-white/10 w-full md:w-auto">
          <button
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1.5 rounded text-xs font-mono font-medium transition-colors ${
              filterMode === 'all'
                ? 'bg-white text-black font-bold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            ALL ({mergedApps.length})
          </button>
          <button
            onClick={() => setFilterMode('blocked')}
            className={`px-3 py-1.5 rounded text-xs font-mono font-medium transition-colors ${
              filterMode === 'blocked'
                ? 'bg-white text-black font-bold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            BLOCKED ({totalBlocked})
          </button>
          <button
            onClick={() => setFilterMode('running')}
            className={`px-3 py-1.5 rounded text-xs font-mono font-medium transition-colors ${
              filterMode === 'running'
                ? 'bg-white text-black font-bold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            RUNNING ({totalRunning})
          </button>
        </div>
      </div>

      {/* Extracted App List */}
      <div className="space-y-2">
        {filteredApps.length === 0 ? (
          <div className="p-12 text-center rounded-xl bg-zinc-950 border border-white/10">
            <AppWindow size={36} className="mx-auto text-zinc-600 mb-3" />
            <p className="text-sm font-semibold text-white">No matching applications found</p>
            <p className="text-xs text-zinc-500 mt-1">Try adjusting your search query or rescan your PC.</p>
          </div>
        ) : (
          filteredApps.map((item) => (
            <div
              key={item.executableName}
              className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-4 ${
                item.isBlocked
                  ? 'bg-zinc-900/90 border-white/30 shadow-md'
                  : 'bg-zinc-950/60 border-white/5 hover:border-white/15'
              }`}
            >
              {/* App Meta */}
              <div className="flex items-center gap-3.5 min-w-0">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center font-mono font-bold text-sm shrink-0 transition-colors ${
                    item.isBlocked
                      ? 'bg-white text-black border border-white'
                      : 'bg-zinc-900 text-zinc-400 border border-white/10'
                  }`}
                >
                  {item.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-white truncate">{item.name}</span>
                    {item.isBlocked && (
                      <span className="badge badge-blocked">BLOCKED</span>
                    )}
                    {item.isRunning && (
                      <span className="badge badge-running">
                        <span className="w-1.5 h-1.5 rounded-full bg-white mono-pulse"></span>
                        RUNNING
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 mt-0.5 truncate">
                    <span>{item.executableName}</span>
                    {item.path && (
                      <span className="text-[11px] text-zinc-600 truncate hidden md:inline">
                        • {item.path}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Toggle Switch */}
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs font-mono font-bold tracking-wider text-zinc-400 hidden sm:inline">
                  {item.isBlocked ? 'BLOCKED' : 'ALLOW'}
                </span>
                <label className="switch" title={item.isBlocked ? 'Click to unblock' : 'Click to block and terminate'}>
                  <input
                    type="checkbox"
                    checked={item.isBlocked}
                    onChange={() => handleToggle(item)}
                  />
                  <span className="slider"></span>
                </label>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Manual Custom Executable Fallback (Accordion) */}
      <div className="pt-4 border-t border-white/10">
        <button
          onClick={() => setShowManualAdd(!showManualAdd)}
          className="text-xs font-mono text-zinc-400 hover:text-white flex items-center gap-2 transition-colors"
        >
          {showManualAdd ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          <span>Advanced: Manually add custom executable path</span>
        </button>

        {showManualAdd && (
          <form onSubmit={handleManualAddSubmit} className="mt-3 p-4 rounded-xl bg-zinc-950 border border-white/10 flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Display Name (optional)"
              className="input-field"
            />
            <input
              type="text"
              value={customExe}
              onChange={(e) => setCustomExe(e.target.value)}
              placeholder="Executable (e.g. game.exe)"
              className="input-field"
              required
            />
            <button type="submit" className="btn-primary shrink-0">
              <Plus size={14} />
              <span>Block Custom App</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
