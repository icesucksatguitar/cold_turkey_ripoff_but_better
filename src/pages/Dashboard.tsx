import React, { useState } from 'react';
import {
  Play,
  Pause,
  Square,
  Shield,
  ShieldAlert,
  Globe,
  AppWindow,
  Calendar,
  Zap,
  Lock,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { ActiveSession, BlockerStoreData, StrictModeLevel } from '../types';

interface DashboardProps {
  data: BlockerStoreData;
  remainingSeconds: number;
  onStartSession: (params: {
    name: string;
    durationMinutes: number;
    strictMode: StrictModeLevel;
    blockWebsites: boolean;
    blockApps: boolean;
    preset?: string;
  }) => void;
  onPauseSession: () => void;
  onResumeSession: () => void;
  onStopSession: (override?: boolean) => Promise<boolean>;
  onNavigateTab: (tab: any) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  data,
  remainingSeconds,
  onStartSession,
  onPauseSession,
  onResumeSession,
  onStopSession,
  onNavigateTab,
}) => {
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [emergencyPhrase, setEmergencyPhrase] = useState('');
  const [userTypedPhrase, setUserTypedPhrase] = useState('');
  const [emergencyError, setEmergencyError] = useState('');

  const session = data.activeSession;
  const isFocusing = !!session;
  const isPaused = session?.isPaused || false;
  const isStrict = session ? session.strictMode !== 'none' : false;

  // Calculate progress percentage
  const totalSeconds = session ? session.durationMinutes * 60 : 1;
  const progressPercent = session
    ? Math.min(100, Math.max(0, ((totalSeconds - remainingSeconds) / totalSeconds) * 100))
    : 0;

  // Format time MM:SS
  const formatTime = (secs: number) => {
    const hours = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (hours > 0) {
      return `${hours}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    }
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleStopClick = () => {
    if (!session) return;
    if (session.strictMode === 'none') {
      onStopSession(false);
    } else {
      // Trigger emergency unlock phrase
      const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let randomStr = '';
      for (let i = 0; i < 24; i++) {
        randomStr += characters.charAt(Math.floor(Math.random() * characters.length));
        if ((i + 1) % 6 === 0 && i !== 23) randomStr += '-';
      }
      setEmergencyPhrase(randomStr);
      setUserTypedPhrase('');
      setEmergencyError('');
      setShowEmergencyModal(true);
    }
  };

  const handleEmergencyUnlockConfirm = async () => {
    if (userTypedPhrase.trim() === emergencyPhrase.trim()) {
      await onStopSession(true);
      setShowEmergencyModal(false);
    } else {
      setEmergencyError('Verification phrase does not match exactly.');
    }
  };

  // Interceptions count from logs today
  const todayStart = new Date().setHours(0, 0, 0, 0);
  const interceptionsToday = data.activityLogs.filter(
    (l) => l.type === 'app_blocked' && l.timestamp >= todayStart
  ).length;

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      {/* Top Banner / Hero Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900/90 via-slate-900/60 to-slate-950 p-6 border border-white/10 shadow-xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
          {/* Circular Countdown Display */}
          <div className="flex flex-col items-center">
            <div className="relative w-52 h-52 flex items-center justify-center">
              {/* SVG Ring */}
              <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  className="stroke-slate-800"
                  strokeWidth="5"
                  fill="transparent"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  className="transition-all duration-1000 ease-linear"
                  stroke="url(#timerGradient)"
                  strokeWidth="5"
                  strokeDasharray={264}
                  strokeDashoffset={264 - (264 * progressPercent) / 100}
                  strokeLinecap="round"
                  fill="transparent"
                />
                <defs>
                  <linearGradient id="timerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#38bdf8" />
                    <stop offset="100%" stopColor="#6366f1" />
                  </linearGradient>
                </defs>
              </svg>

              {/* Inside Digital Timer */}
              <div className="absolute flex flex-col items-center text-center">
                <span className="font-mono text-3xl font-bold tracking-tight text-white drop-shadow">
                  {isFocusing ? formatTime(remainingSeconds) : '00:00'}
                </span>
                <span className="text-[11px] font-semibold tracking-wider text-slate-400 mt-0.5 uppercase">
                  {isFocusing ? (isPaused ? 'PAUSED' : session.name) : 'READY'}
                </span>
                {isStrict && (
                  <span className="mt-1 flex items-center gap-1 text-[10px] text-rose-400 font-semibold px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30">
                    <Lock size={9} />
                    STRICT
                  </span>
                )}
              </div>
            </div>

            {/* Timer Actions */}
            <div className="flex items-center gap-2 mt-4">
              {isFocusing ? (
                <>
                  {!isStrict && (
                    <button
                      onClick={isPaused ? onResumeSession : onPauseSession}
                      className="btn-secondary text-xs"
                      title={isPaused ? 'Resume' : 'Pause'}
                    >
                      {isPaused ? <Play size={14} className="text-emerald-400" /> : <Pause size={14} />}
                      {isPaused ? 'Resume' : 'Pause'}
                    </button>
                  )}
                  <button
                    onClick={handleStopClick}
                    className="btn-danger text-xs"
                    title={isStrict ? 'Emergency Stop' : 'Stop Session'}
                  >
                    <Square size={13} />
                    {isStrict ? 'Emergency Unlock' : 'End Session'}
                  </button>
                </>
              ) : (
                <button
                  onClick={() =>
                    onStartSession({
                      name: 'Deep Work',
                      durationMinutes: 50,
                      strictMode: 'locked',
                      blockWebsites: true,
                      blockApps: true,
                      preset: 'Deep Work',
                    })
                  }
                  className="btn-primary text-xs"
                >
                  <Play size={14} fill="currentColor" />
                  Start 50m Deep Work
                </button>
              )}
            </div>
          </div>

          {/* Quick Presets / Overview */}
          <div className="flex-1 w-full space-y-4">
            <div>
              <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Zap size={18} className="text-sky-400" />
                Quick Focus Presets
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                One-click local distraction blocking for your flow state.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {[
                { name: 'Pomodoro Sprint', mins: 25, strict: 'none' as StrictModeLevel, desc: 'Casual sprint with break' },
                { name: 'Deep Work Flow', mins: 50, strict: 'locked' as StrictModeLevel, desc: 'Locked focus session' },
                { name: 'Study Marathon', mins: 90, strict: 'locked' as StrictModeLevel, desc: 'Extended study block' },
                { name: 'Iron Discipline', mins: 120, strict: 'extreme' as StrictModeLevel, desc: 'Extreme verification lock' },
              ].map((preset) => (
                <div
                  key={preset.name}
                  onClick={() => {
                    if (!isFocusing) {
                      onStartSession({
                        name: preset.name,
                        durationMinutes: preset.mins,
                        strictMode: preset.strict,
                        blockWebsites: true,
                        blockApps: true,
                        preset: preset.name,
                      });
                    }
                  }}
                  className={`p-3 rounded-xl border transition-all ${
                    isFocusing
                      ? 'opacity-50 cursor-not-allowed bg-slate-900/40 border-white/5'
                      : 'glass-card-interactive border-white/5 hover:border-sky-500/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-slate-200">{preset.name}</span>
                    <span className="font-mono text-xs text-sky-400 font-bold">{preset.mins}m</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">{preset.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5">
        <div
          onClick={() => onNavigateTab('websites')}
          className="glass-card-interactive p-4 flex items-center justify-between"
        >
          <div>
            <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              Blocked Domains
            </div>
            <div className="text-2xl font-bold text-slate-100 mt-1">
              {data.websites.filter((w) => w.enabled).length}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {data.websites.length} configured
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
            <Globe size={18} />
          </div>
        </div>

        <div
          onClick={() => onNavigateTab('apps')}
          className="glass-card-interactive p-4 flex items-center justify-between"
        >
          <div>
            <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              Blocked Apps
            </div>
            <div className="text-2xl font-bold text-slate-100 mt-1">
              {data.apps.filter((a) => a.enabled).length}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {data.apps.length} configured
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <AppWindow size={18} />
          </div>
        </div>

        <div
          onClick={() => onNavigateTab('schedules')}
          className="glass-card-interactive p-4 flex items-center justify-between"
        >
          <div>
            <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              Active Schedules
            </div>
            <div className="text-2xl font-bold text-slate-100 mt-1">
              {data.schedules.filter((s) => s.enabled).length}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {data.schedules.length} recurring rules
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Calendar size={18} />
          </div>
        </div>

        <div
          onClick={() => onNavigateTab('activity')}
          className="glass-card-interactive p-4 flex items-center justify-between"
        >
          <div>
            <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              Interceptions Today
            </div>
            <div className="text-2xl font-bold text-slate-100 mt-1">
              {interceptionsToday}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Apps intercepted</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <ShieldAlert size={18} />
          </div>
        </div>
      </div>

      {/* Local Architecture & Enforcement Status */}
      <div className="glass-panel p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-emerald-400" />
            <h3 className="text-sm font-semibold text-slate-200">System Integration Status</h3>
          </div>
          <span className="badge badge-active text-[10px]">LOCAL ONLY • NO CLOUD</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-slate-900/50 border border-white/5 space-y-1">
            <div className="text-slate-400 font-medium">Hosts File Protection</div>
            <div className="text-slate-200 text-[11px]">
              {isFocusing && session.blockWebsites
                ? 'Active (127.0.0.1 loopback isolation)'
                : 'Clean (no active block rules)'}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-slate-900/50 border border-white/5 space-y-1">
            <div className="text-slate-400 font-medium">Windows Process Scanner</div>
            <div className="text-slate-200 text-[11px]">
              {isFocusing && session.blockApps
                ? `Active (polling every ${data.settings.appBlockIntervalMs}ms)`
                : 'Standby'}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-slate-900/50 border border-white/5 space-y-1">
            <div className="text-slate-400 font-medium">Persistent Configuration</div>
            <div className="text-slate-200 text-[11px]">
              Saved locally in %APPDATA%/FocusGuard
            </div>
          </div>
        </div>
      </div>

      {/* Emergency Unlock Modal */}
      {showEmergencyModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="glass-panel max-w-md w-full p-6 space-y-4 border border-rose-500/30 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-100">Emergency Strict Mode Unlock</h3>
                <p className="text-xs text-rose-300">Deliberate pause safeguard</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Strict Mode protects you from reflexive distractions. To ensure this cancellation is
              deliberate, you must type the exact verification phrase below:
            </p>

            <div className="p-3 rounded-lg bg-slate-950 border border-rose-500/30 text-center font-mono font-bold text-sm text-sky-400 tracking-wider select-all">
              {emergencyPhrase}
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-400">Type verification phrase:</label>
              <input
                type="text"
                value={userTypedPhrase}
                onChange={(e) => {
                  setUserTypedPhrase(e.target.value);
                  setEmergencyError('');
                }}
                placeholder="Type phrase here..."
                className="input-field font-mono text-xs"
                autoFocus
              />
              {emergencyError && <p className="text-[11px] text-rose-400">{emergencyError}</p>}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowEmergencyModal(false)}
                className="btn-secondary text-xs"
              >
                Keep Focusing
              </button>
              <button
                onClick={handleEmergencyUnlockConfirm}
                className="btn-danger text-xs"
              >
                Confirm Unlock
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
