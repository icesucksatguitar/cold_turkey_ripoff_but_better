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
      <div className="p-6 flex flex-col items-center justify-center h-full text-center space-y-6">
        <div className="w-20 h-20 rounded-3xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 shadow-xl shadow-sky-500/10">
          <Clock size={36} className="animate-pulse" />
        </div>

        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-slate-100">{activeSession.name} in Progress</h2>
          <p className="text-xs text-slate-400">
            Session active • Started for {activeSession.durationMinutes} minutes
          </p>
        </div>

        <div className="font-mono text-5xl font-bold text-sky-400 tracking-tight">
          {formatTime(remainingSeconds)}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigateTab('dashboard')}
            className="btn-primary text-xs"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full max-w-3xl mx-auto">
      <div>
        <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2.5">
          <Clock className="text-sky-400" size={22} />
          Configure Focus Session
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Select your focus duration and strictness level to lock out distracting websites and desktop apps.
        </p>
      </div>

      {/* Preset Chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {presets.map((p) => (
          <button
            key={p.name}
            onClick={() => {
              setSessionName(p.name);
              setDuration(p.mins);
              setStrictMode(p.strict);
            }}
            className={`p-3 rounded-xl border text-left transition-all ${
              duration === p.mins
                ? 'bg-sky-500/15 border-sky-500/40 shadow-sm shadow-sky-500/20'
                : 'glass-panel hover:border-white/20'
            }`}
          >
            <div className="font-bold text-xs text-slate-200">{p.name}</div>
            <div className="font-mono text-sm text-sky-400 font-bold mt-1">{p.mins} min</div>
          </button>
        ))}
      </div>

      {/* Custom Duration Slider */}
      <div className="glass-panel p-5 space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-300">Duration</label>
          <div className="flex items-center gap-2">
            <span className="font-mono text-lg font-bold text-sky-400">{duration}</span>
            <span className="text-xs text-slate-500">minutes</span>
          </div>
        </div>

        <input
          type="range"
          min="5"
          max="240"
          step="5"
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
          className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
        />

        <div className="flex justify-between text-[10px] text-slate-500 font-mono">
          <span>5m</span>
          <span>60m (1h)</span>
          <span>120m (2h)</span>
          <span>180m (3h)</span>
          <span>240m (4h)</span>
        </div>
      </div>

      {/* Strict Mode Selector */}
      <div className="space-y-3">
        <label className="text-xs font-semibold text-slate-300 block">Strict Mode Level</label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            {
              id: 'none' as StrictModeLevel,
              label: 'Standard',
              badge: 'Casual',
              desc: 'Allows pausing or ending the session anytime if plans change.',
              icon: Shield,
              color: 'text-sky-400',
              border: 'border-sky-500/30',
            },
            {
              id: 'locked' as StrictModeLevel,
              label: 'Locked Focus',
              badge: 'Recommended',
              desc: 'Disables stop buttons. Cannot be stopped until the countdown completes.',
              icon: Lock,
              color: 'text-indigo-400',
              border: 'border-indigo-500/30',
            },
            {
              id: 'extreme' as StrictModeLevel,
              label: 'Extreme Mode',
              badge: 'Iron Will',
              desc: 'Requires accurately typing a 24-character security phrase to cancel.',
              icon: AlertOctagon,
              color: 'text-rose-400',
              border: 'border-rose-500/30',
            },
          ].map((mode) => {
            const Icon = mode.icon;
            const isSelected = strictMode === mode.id;
            return (
              <div
                key={mode.id}
                onClick={() => setStrictMode(mode.id)}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  isSelected
                    ? `bg-slate-900/90 ${mode.border} shadow-lg`
                    : 'glass-panel hover:border-white/10'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Icon size={18} className={mode.color} />
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/5 text-slate-400">
                    {mode.badge}
                  </span>
                </div>
                <h4 className="font-bold text-xs text-slate-200">{mode.label}</h4>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{mode.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Distraction Selection */}
      <div className="grid grid-cols-2 gap-3">
        <label className="glass-panel p-4 flex items-center justify-between cursor-pointer">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-400">
              <Globe size={16} />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-200">Block Websites</div>
              <div className="text-[10px] text-slate-400">Apply local DNS loopback</div>
            </div>
          </div>
          <input
            type="checkbox"
            checked={blockWebsites}
            onChange={(e) => setBlockWebsites(e.target.checked)}
            className="w-4 h-4 rounded text-sky-500"
          />
        </label>

        <label className="glass-panel p-4 flex items-center justify-between cursor-pointer">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
              <AppWindow size={16} />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-200">Block Applications</div>
              <div className="text-[10px] text-slate-400">Scan & terminate blocked processes</div>
            </div>
          </div>
          <input
            type="checkbox"
            checked={blockApps}
            onChange={(e) => setBlockApps(e.target.checked)}
            className="w-4 h-4 rounded text-indigo-500"
          />
        </label>
      </div>

      {/* Start Button */}
      <div className="pt-2">
        <button
          onClick={handleStart}
          className="btn-primary w-full justify-center py-3 text-sm shadow-xl shadow-sky-500/25"
        >
          <Play size={16} fill="currentColor" />
          Start {duration}m Focus Session Now
        </button>
      </div>
    </div>
  );
};
