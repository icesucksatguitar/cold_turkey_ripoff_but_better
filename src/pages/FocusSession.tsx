import React, { useState } from 'react';
import {
  Clock,
  Play,
  Shield,
  Lock,
  AlertOctagon,
  Globe,
  AppWindow,
  CheckCircle2,
} from 'lucide-react';
import { ActiveSession, StrictModeLevel } from '../types';

interface FocusSessionPageProps {
  activeSession: ActiveSession | null;
  remainingSeconds: number;
  onStartSession: (params: {
    name: string;
    durationMinutes: number;
    strictMode: StrictModeLevel;
    blockWebsites: boolean;
    blockApps: boolean;
    preset?: string;
  }) => void;
  onStopSession: () => void;
  onNavigateTab: (tab: any) => void;
}

export const FocusSessionPage: React.FC<FocusSessionPageProps> = ({
  activeSession,
  remainingSeconds,
  onStartSession,
  onStopSession,
  onNavigateTab,
}) => {
  const [sessionName, setSessionName] = useState('Deep Work Session');
  const [duration, setDuration] = useState(50);
  const [strictMode, setStrictMode] = useState<StrictModeLevel>('locked');
  const [blockWebsites, setBlockWebsites] = useState(true);
  const [blockApps, setBlockApps] = useState(true);

  const presets = [
    { name: 'Pomodoro', mins: 25, strict: 'none' as StrictModeLevel },
    { name: 'Deep Work', mins: 50, strict: 'locked' as StrictModeLevel },
    { name: 'Study Flow', mins: 90, strict: 'locked' as StrictModeLevel },
    { name: 'Ultra Focus', mins: 120, strict: 'extreme' as StrictModeLevel },
  ];

  const handleStart = () => {
    onStartSession({
      name: sessionName.trim() || 'Focus Session',
      durationMinutes: duration,
      strictMode,
      blockWebsites,
      blockApps,
    });
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (activeSession) {
    return (
      <div className="p-6 space-y-6 overflow-y-auto h-full bg-black text-white flex flex-col items-center justify-center select-none">
        <div className="w-full max-w-lg p-8 rounded-2xl bg-zinc-950 border border-white/20 shadow-2xl text-center space-y-6">
          <div className="flex items-center justify-center">
            <div className="w-14 h-14 rounded-2xl bg-white text-black flex items-center justify-center font-bold">
              <Shield size={28} />
            </div>
          </div>

          <div>
            <div className="badge badge-blocked">
              SESSION ACTIVE
            </div>
            <h2 className="text-2xl font-bold text-white mt-2">{activeSession.name}</h2>
            <p className="text-xs text-zinc-400 mt-1">
              Active system restriction enabled across your computer.
            </p>
          </div>

          <div className="p-6 rounded-xl bg-black border border-white/10 font-mono text-5xl font-extrabold text-white">
            {formatTime(remainingSeconds)}
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs text-zinc-400 font-mono">
            <div className="p-3 rounded-lg bg-zinc-900 border border-white/5">
              <span className="text-zinc-500 block text-[10px] uppercase">Strict Enforcement</span>
              <span className="text-white font-bold">{activeSession.strictMode}</span>
            </div>
            <div className="p-3 rounded-lg bg-zinc-900 border border-white/5">
              <span className="text-zinc-500 block text-[10px] uppercase">Web & App Block</span>
              <span className="text-white font-bold">Enabled</span>
            </div>
          </div>

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
          Lock down your computer for a dedicated duration with strict mode enforcement.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
        {/* Left Column: Preset cards */}
        <div className="space-y-3">
          <label className="text-xs font-mono text-zinc-400 uppercase tracking-wider block">
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
                }}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                  duration === p.mins
                    ? 'bg-white text-black border-white shadow-lg'
                    : 'bg-zinc-950 border-white/10 hover:border-white/30 text-white'
                }`}
              >
                <div className="font-bold text-sm">{p.name}</div>
                <div className="font-mono text-xs mt-1 font-bold">{p.mins} min</div>
              </div>
            ))}
          </div>

          <div className="pt-3">
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
        </div>

        {/* Right Column: Parameters */}
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
                { id: 'locked', label: 'Locked Strict', desc: 'Requires long verification phrase to end early' },
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
              <span>Block Websites</span>
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
