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
    <div className="p-6 space-y-6 overflow-y-auto h-full bg-black text-white select-none">
      {/* Top Banner / Hero Card */}
      <div className="relative overflow-hidden rounded-2xl bg-zinc-950 p-6 border border-white/15 shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
          {/* Circular Countdown Display */}
          <div className="flex flex-col items-center">
            <div className="relative w-52 h-52 flex items-center justify-center">
              {/* SVG Ring (Pure Monochromatic) */}
              <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  stroke="rgba(255, 255, 255, 0.08)"
                  strokeWidth="4"
                  fill="transparent"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  className="transition-all duration-1000 ease-linear timer-glow"
                  stroke="#ffffff"
                  strokeWidth="4.5"
                  strokeDasharray={264}
                  strokeDashoffset={264 - (264 * progressPercent) / 100}
                  strokeLinecap="round"
                  fill="transparent"
                />
              </svg>

              {/* Inside Digital Timer */}
              <div className="absolute flex flex-col items-center text-center">
                <span className="font-mono text-4xl font-extrabold tracking-tight text-white">
                  {isFocusing ? formatTime(remainingSeconds) : '00:00'}
                </span>
                <span className="text-[10px] font-mono font-bold tracking-widest text-zinc-400 mt-1 uppercase">
                  {isFocusing ? (isPaused ? 'PAUSED' : session.name) : 'STANDBY'}
                </span>
                {isStrict && (
                  <span className="mt-1 flex items-center gap-1 text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-white text-black">
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
                      {isPaused ? <Play size={13} fill="currentColor" /> : <Pause size={13} />}
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
                  className="btn-primary"
                >
                  <Play size={13} fill="currentColor" />
                  <span>Start 50m Deep Work</span>
                </button>
              )}
            </div>
          </div>

          {/* Quick Presets / Overview */}
          <div className="flex-1 w-full space-y-3.5">
            <div>
              <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-500">
                Focus Engine
              </div>
              <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2 mt-0.5">
                <Zap size={18} className="text-white" />
                Quick Focus Presets
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Immediate system-wide app and website restriction for uninterrupted flow.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {[
                { name: 'Pomodoro Sprint', mins: 25, strict: 'none' as StrictModeLevel, desc: 'Casual sprint with break' },
                { name: 'Deep Work Flow', mins: 50, strict: 'locked' as StrictModeLevel, desc: 'Locked focus block' },
                { name: 'Study Marathon', mins: 90, strict: 'locked' as StrictModeLevel, desc: 'Extended focus block' },
                { name: 'Iron Discipline', mins: 120, strict: 'extreme' as StrictModeLevel, desc: 'Strict verification lock' },
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
                  className={`p-3.5 rounded-xl border transition-all ${
                    isFocusing
                      ? 'opacity-40 cursor-not-allowed bg-zinc-950 border-white/5'
                      : 'bg-zinc-950 border-white/10 hover:border-white/40 hover:bg-zinc-900 cursor-pointer shadow-sm'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-white">{preset.name}</span>
                    <span className="font-mono text-xs text-white font-bold">{preset.mins}m</span>
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-1">{preset.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Row (Monochrome) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div
          onClick={() => onNavigateTab('apps')}
          className="p-4 rounded-xl bg-zinc-950 border border-white/10 hover:border-white/30 cursor-pointer transition-all flex items-center justify-between"
        >
          <div>
            <div className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-widest">
              Blocked Apps
            </div>
            <div className="text-2xl font-mono font-bold text-white mt-1">
              {data.apps.filter((a) => a.enabled).length}
            </div>
            <div className="text-[11px] text-zinc-500 mt-0.5">
              {data.apps.length} configured
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-white/10 flex items-center justify-center text-white">
            <AppWindow size={18} />
          </div>
        </div>

        <div
          onClick={() => onNavigateTab('websites')}
          className="p-4 rounded-xl bg-zinc-950 border border-white/10 hover:border-white/30 cursor-pointer transition-all flex items-center justify-between"
        >
          <div>
            <div className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-widest">
              Blocked Domains
            </div>
            <div className="text-2xl font-mono font-bold text-white mt-1">
              {data.websites.filter((w) => w.enabled).length}
            </div>
            <div className="text-[11px] text-zinc-500 mt-0.5">
              {data.websites.length} configured
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-white/10 flex items-center justify-center text-white">
            <Globe size={18} />
          </div>
        </div>

        <div
          onClick={() => onNavigateTab('schedules')}
          className="p-4 rounded-xl bg-zinc-950 border border-white/10 hover:border-white/30 cursor-pointer transition-all flex items-center justify-between"
        >
          <div>
            <div className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-widest">
              Active Schedules
            </div>
            <div className="text-2xl font-mono font-bold text-white mt-1">
              {data.schedules.filter((s) => s.enabled).length}
            </div>
            <div className="text-[11px] text-zinc-500 mt-0.5">
              {data.schedules.length} recurring rules
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-white/10 flex items-center justify-center text-white">
            <Calendar size={18} />
          </div>
        </div>

        <div
          onClick={() => onNavigateTab('activity')}
          className="p-4 rounded-xl bg-zinc-950 border border-white/10 hover:border-white/30 cursor-pointer transition-all flex items-center justify-between"
        >
          <div>
            <div className="text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-widest">
              Interceptions Today
            </div>
            <div className="text-2xl font-mono font-bold text-white mt-1">
              {interceptionsToday}
            </div>
            <div className="text-[11px] text-zinc-500 mt-0.5">
              {data.activityLogs.length} total events
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-white/10 flex items-center justify-center text-white">
            <ShieldAlert size={18} />
          </div>
        </div>
      </div>

      {/* Emergency Unlock Modal */}
      {showEmergencyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="w-full max-w-md p-6 rounded-2xl bg-zinc-950 border border-white/20 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-white border-b border-white/10 pb-3">
              <AlertTriangle size={22} className="text-white" />
              <div>
                <h3 className="font-bold text-base text-white">Strict Session Verification</h3>
                <p className="text-xs text-zinc-400">Emergency unlock confirmation required.</p>
              </div>
            </div>

            <p className="text-xs text-zinc-300">
              To verify and end this focus session early, type the exact verification phrase below:
            </p>

            <div className="p-3 rounded-lg bg-black border border-white/20 font-mono text-center text-sm font-bold tracking-widest text-white select-all">
              {emergencyPhrase}
            </div>

            <input
              type="text"
              value={userTypedPhrase}
              onChange={(e) => {
                setUserTypedPhrase(e.target.value);
                setEmergencyError('');
              }}
              placeholder="Type phrase exactly as shown..."
              className="input-field font-mono text-center tracking-wider"
              autoFocus
            />

            {emergencyError && (
              <p className="text-xs font-mono text-zinc-400">{emergencyError}</p>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowEmergencyModal(false)}
                className="btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleEmergencyUnlockConfirm}
                className="btn-primary text-xs"
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
