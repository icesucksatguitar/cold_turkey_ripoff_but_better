import React, { useState } from 'react';
import {
  Clock,
  Play,
  Shield,
  Lock,
  CheckCircle2,
  Coffee,
  GraduationCap,
  Bot,
  Sparkles,
  Pause,
  AlertTriangle,
  Tv,
} from 'lucide-react';
import { ActiveSession, StrictModeLevel, WindowActivity } from '../types';

interface FocusSessionPageProps {
  activeSession: ActiveSession | null;
  remainingSeconds: number;
  currentActivity?: WindowActivity | null;
  onStartSession: (params: {
    name: string;
    durationMinutes: number;
    strictMode: StrictModeLevel;
    blockWebsites: boolean;
    blockApps: boolean;
    preset?: string;
    pwLectureMode?: boolean;
  }) => void;
  onStopSession: () => void;
  onNavigateTab: (tab: any) => void;
}

export const FocusSessionPage: React.FC<FocusSessionPageProps> = ({
  activeSession,
  remainingSeconds,
  currentActivity,
  onStartSession,
  onStopSession,
  onNavigateTab,
}) => {
  const [sessionName, setSessionName] = useState('Physics Wallah Lecture Focus');
  const [duration, setDuration] = useState(60);
  const [strictMode, setStrictMode] = useState<StrictModeLevel>('locked');
  const [blockWebsites, setBlockWebsites] = useState(true);
  const [blockApps, setBlockApps] = useState(true);
  const [pwLectureMode, setPwLectureMode] = useState(true);

  const presets = [
    { name: 'PW Lecture Focus', mins: 60, strict: 'locked' as StrictModeLevel, pw: true },
    { name: 'PW Deep Marathon', mins: 90, strict: 'locked' as StrictModeLevel, pw: true },
    { name: 'Pomodoro Sprint', mins: 25, strict: 'none' as StrictModeLevel, pw: false },
    { name: 'Ultra Focus Lock', mins: 120, strict: 'extreme' as StrictModeLevel, pw: true },
  ];

  const handleStart = () => {
    onStartSession({
      name: sessionName.trim() || 'Focus Session',
      durationMinutes: duration,
      strictMode,
      blockWebsites,
      blockApps,
      pwLectureMode,
    });
  };

  const formatTime = (secs: number) => {
    const hours = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (hours > 0) {
      return `${hours}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    }
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // ACTIVE SESSION VIEW
  if (activeSession) {
    const isOnBreak = activeSession.isOnBreak;
    const isPwMode = activeSession.pwLectureMode;
    const currentAct = activeSession.currentActivity;

    return (
      <div className="p-6 space-y-6 overflow-y-auto h-full bg-black text-white flex flex-col items-center justify-center select-none">
        <div
          className={`w-full max-w-xl p-8 rounded-2xl border transition-all duration-500 shadow-2xl text-center space-y-6 ${
            isOnBreak
              ? 'bg-amber-950/20 border-amber-500/40 shadow-amber-950/40'
              : currentAct === 'ai_assistant'
              ? 'bg-indigo-950/20 border-indigo-500/40 shadow-indigo-950/40'
              : 'bg-zinc-950 border-white/20 shadow-2xl'
          }`}
        >
          {/* Header Icon & Status Pill */}
          <div className="flex flex-col items-center gap-3">
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center font-bold transition-all duration-300 ${
                isOnBreak
                  ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20 animate-pulse'
                  : currentAct === 'ai_assistant'
                  ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                  : 'bg-white text-black'
              }`}
            >
              {isOnBreak ? (
                <Coffee size={28} />
              ) : currentAct === 'ai_assistant' ? (
                <Sparkles size={28} />
              ) : isPwMode ? (
                <GraduationCap size={28} />
              ) : (
                <Shield size={28} />
              )}
            </div>

            {/* Dynamic Status Badges */}
            {isOnBreak ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-amber-500/20 border border-amber-500/50 text-amber-300 animate-pulse">
                <Pause size={12} />
                <span>OFF-TASK BREAK ACTIVE • TIMER PAUSED</span>
              </div>
            ) : currentAct === 'ai_assistant' ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-indigo-500/20 border border-indigo-500/50 text-indigo-300">
                <Bot size={12} />
                <span>AI STUDY ASSISTANT ACTIVE • TIMER RUNNING</span>
              </div>
            ) : isPwMode ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/20 border border-emerald-500/50 text-emerald-300">
                <Tv size={12} />
                <span>PHYSICS WALLAH DETECTED • TIMER RUNNING</span>
              </div>
            ) : (
              <div className="badge badge-blocked">SESSION ACTIVE</div>
            )}

            <h2 className="text-2xl font-bold text-white tracking-tight">{activeSession.name}</h2>
          </div>

          {/* Large Timer Displays */}
          {isOnBreak ? (
            <div className="space-y-3">
              {/* Break Stopwatch */}
              <div className="p-6 rounded-xl bg-black/80 border border-amber-500/40">
                <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 font-bold block mb-1">
                  Break Stopwatch Elapsed
                </span>
                <div className="font-mono text-5xl font-extrabold text-amber-400 tracking-tight">
                  {formatTime(activeSession.currentBreakSeconds || 0)}
                </div>
                <p className="text-xs text-amber-200/70 mt-2 font-mono">
                  Off-task tab: &quot;{activeSession.activeWindowTitle || activeSession.activeProcessName || 'Other Window'}&quot;
                </p>
              </div>

              {/* Frozen Focus Timer Notice */}
              <div className="p-3 rounded-lg bg-zinc-900/80 border border-white/10 flex items-center justify-between text-xs font-mono text-zinc-300">
                <span className="text-zinc-400">Focus Countdown (Paused):</span>
                <span className="text-white font-bold">{formatTime(remainingSeconds)} remaining</span>
              </div>

              {/* Action Banner */}
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-left text-xs text-amber-200 flex items-start gap-2.5">
                <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                <span>
                  Switch back to your <strong>Physics Wallah lecture</strong> (pw.live) or allowed AI assistant (<strong>ChatGPT, Claude, Gemini</strong>) to automatically resume your focus timer.
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Focus Countdown */}
              <div className="p-6 rounded-xl bg-black border border-white/10 font-mono text-5xl font-extrabold text-white tracking-tight">
                {formatTime(remainingSeconds)}
              </div>

              {/* Active Window Status Subtitle */}
              {isPwMode && (
                <div className="p-3 rounded-lg bg-zinc-900 border border-white/10 text-xs text-zinc-300 text-left font-mono space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500 text-[10px] uppercase">Active Window:</span>
                    <span className="text-emerald-400 font-bold text-[10px]">
                      {currentAct === 'ai_assistant' ? 'AI ASSISTANT ALLOWED' : 'PHYSICS WALLAH STUDYING'}
                    </span>
                  </div>
                  <div className="truncate text-white font-medium text-xs">
                    {activeSession.activeWindowTitle || (currentAct === 'ai_assistant' ? 'ChatGPT / Claude / Gemini' : 'pw.live lecture')}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Grid Stats Bar */}
          <div className="grid grid-cols-3 gap-2.5 text-xs text-zinc-400 font-mono">
            <div className="p-3 rounded-lg bg-zinc-900/90 border border-white/5">
              <span className="text-zinc-500 block text-[10px] uppercase">Strictness</span>
              <span className="text-white font-bold capitalize">{activeSession.strictMode}</span>
            </div>
            <div className="p-3 rounded-lg bg-zinc-900/90 border border-white/5">
              <span className="text-zinc-500 block text-[10px] uppercase">Breaks Taken</span>
              <span className="text-white font-bold">{activeSession.breakCount || 0}</span>
            </div>
            <div className="p-3 rounded-lg bg-zinc-900/90 border border-white/5">
              <span className="text-zinc-500 block text-[10px] uppercase">Total Break</span>
              <span className="text-white font-bold">
                {formatTime(activeSession.totalBreakSeconds || 0)}
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-center gap-3 pt-2">
            <button onClick={() => onNavigateTab('dashboard')} className="btn-secondary text-xs">
              Go to Dashboard
            </button>
            <button onClick={onStopSession} className="btn-danger text-xs">
              End Session
            </button>
          </div>
        </div>
      </div>
    );
  }

  // CONFIGURATION VIEW (NEW SESSION)
  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full bg-black text-white select-none">
      {/* Header */}
      <div className="border-b border-white/10 pb-5">
        <div className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">
          Targeted Session Lock
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white mt-1 flex items-center gap-2.5">
          <Clock className="text-white" size={24} />
          Focus Session Configurator
        </h1>
        <p className="text-xs text-zinc-400 mt-1">
          Lock down your computer for focused study with intelligent Physics Wallah lecture detection and AI study assist.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
        {/* Left Column: Preset cards & Lecture Mode Highlight */}
        <div className="space-y-4">
          <div>
            <label className="text-xs font-mono text-zinc-400 uppercase tracking-wider block mb-2">
              Select Template
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {presets.map((p) => (
                <div
                  key={p.name}
                  onClick={() => {
                    setSessionName(p.name);
                    setDuration(p.mins);
                    setStrictMode(p.strict);
                    setPwLectureMode(p.pw);
                  }}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    duration === p.mins && sessionName === p.name
                      ? 'bg-white text-black border-white shadow-lg'
                      : 'bg-zinc-950 border-white/10 hover:border-white/30 text-white'
                  }`}
                >
                  <div className="font-bold text-sm flex items-center justify-between">
                    <span>{p.name}</span>
                    {p.pw && <GraduationCap size={13} className="text-zinc-400" />}
                  </div>
                  <div className="font-mono text-xs mt-1 font-bold">{p.mins} min</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-mono text-zinc-400 uppercase tracking-wider block mb-1">
              Custom Duration (Minutes)
            </label>
            <input
              type="number"
              min={5}
              max={720}
              value={duration}
              onChange={(e) => setDuration(Math.max(1, parseInt(e.target.value) || 1))}
              className="input-field font-mono"
            />
          </div>

          {/* Physics Wallah Detection Feature Card */}
          <div
            onClick={() => setPwLectureMode(!pwLectureMode)}
            className={`p-4 rounded-xl border transition-all cursor-pointer ${
              pwLectureMode
                ? 'bg-zinc-900 border-white/30'
                : 'bg-zinc-950 border-white/10 opacity-70'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GraduationCap size={16} className={pwLectureMode ? 'text-white' : 'text-zinc-500'} />
                <span className="text-xs font-bold font-mono uppercase text-white">
                  Physics Wallah & AI Lecture Mode
                </span>
              </div>
              <input
                type="checkbox"
                checked={pwLectureMode}
                onChange={(e) => setPwLectureMode(e.target.checked)}
                className="accent-white"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            <p className="text-[11px] text-zinc-400 mt-2 leading-relaxed">
              Detects when you are on <strong>pw.live</strong> or watching Physics Wallah lectures. Switching to anything other than <strong>ChatGPT, Claude, or Gemini</strong> immediately pauses the focus countdown and logs the time as a break.
            </p>

            {/* Allowed tools preview */}
            {pwLectureMode && (
              <div className="mt-3 pt-3 border-t border-white/10 grid grid-cols-2 gap-2 text-[10px] font-mono">
                <div className="p-2 rounded bg-black/60 border border-white/5">
                  <span className="text-emerald-400 font-bold block">✓ Focus Active:</span>
                  <span className="text-zinc-400">pw.live & PW Lectures</span>
                </div>
                <div className="p-2 rounded bg-black/60 border border-white/5">
                  <span className="text-indigo-400 font-bold block">✓ Permitted AI:</span>
                  <span className="text-zinc-400">ChatGPT, Claude, Gemini</span>
                </div>
              </div>
            )}
          </div>

          {/* Live Foreground Window Status */}
          {currentActivity && (
            <div className="p-3 rounded-xl bg-zinc-950 border border-white/10 text-xs font-mono space-y-1">
              <div className="text-[10px] text-zinc-500 uppercase flex items-center justify-between">
                <span>Current Foreground Window:</span>
                {currentActivity.isPw ? (
                  <span className="text-emerald-400 font-bold">Physics Wallah Detected ✅</span>
                ) : currentActivity.isAi ? (
                  <span className="text-indigo-400 font-bold">AI Assistant Allowed 🤖</span>
                ) : (
                  <span className="text-zinc-400 font-normal">Other Window (Break)</span>
                )}
              </div>
              <div className="truncate text-zinc-300 font-medium text-[11px]">
                {currentActivity.title || currentActivity.process || 'Idle / Desktop'}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Parameters & Start */}
        <div className="space-y-4 p-5 rounded-2xl bg-zinc-950 border border-white/10">
          <div>
            <label className="text-xs font-mono text-zinc-400 uppercase tracking-wider block mb-1">
              Session Label
            </label>
            <input
              type="text"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              className="input-field"
            />
          </div>

          <div>
            <label className="text-xs font-mono text-zinc-400 uppercase tracking-wider block mb-2">
              Strict Enforcement Level
            </label>
            <div className="space-y-2">
              {[
                { id: 'none', label: 'Standard', desc: 'Can be paused or stopped anytime' },
                { id: 'locked', label: 'Locked Strict', desc: 'Requires verification phrase to end early' },
                { id: 'extreme', label: 'Extreme Discipline', desc: 'Unbreakable until timer reaches zero' },
              ].map((opt) => (
                <div
                  key={opt.id}
                  onClick={() => setStrictMode(opt.id as StrictModeLevel)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    strictMode === opt.id
                      ? 'bg-zinc-900 border-white text-white'
                      : 'bg-black border-white/5 text-zinc-400 hover:border-white/20'
                  }`}
                >
                  <div className="font-semibold text-xs text-white flex items-center justify-between">
                    <span>{opt.label}</span>
                    {strictMode === opt.id && <CheckCircle2 size={13} className="text-white" />}
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">{opt.desc}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs text-zinc-300 pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={blockWebsites}
                onChange={(e) => setBlockWebsites(e.target.checked)}
                className="accent-white"
              />
              <span>Block Distracting Websites</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={blockApps}
                onChange={(e) => setBlockApps(e.target.checked)}
                className="accent-white"
              />
              <span>Block Apps</span>
            </label>
          </div>

          <button onClick={handleStart} className="btn-primary w-full justify-center mt-2">
            <Play size={14} fill="currentColor" />
            <span>Engage Focus Lock ({duration}m)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
