import React from 'react';
import { Shield, Minus, Square, X, Lock } from 'lucide-react';
import { ActiveSession } from '../types';

interface HeaderProps {
  activeSession: ActiveSession | null;
  remainingSeconds: number;
}

export const Header: React.FC<HeaderProps> = ({ activeSession, remainingSeconds }) => {
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleMinimize = () => {
    window.focusGuardApi?.minimizeWindow();
  };

  const handleMaximize = () => {
    window.focusGuardApi?.maximizeWindow();
  };

  const handleClose = () => {
    window.focusGuardApi?.closeWindow();
  };

  return (
    <header className="h-10 bg-black border-b border-white/10 flex items-center justify-between px-3.5 select-none titlebar-drag z-50">
      {/* Brand & Status */}
      <div className="flex items-center gap-2.5">
        <div className="w-5 h-5 rounded bg-white text-black flex items-center justify-center font-bold">
          <Shield size={12} strokeWidth={2.8} />
        </div>
        <span className="font-bold text-xs tracking-widest text-white">
          FOCUS<span className="text-zinc-400 font-light">GUARD</span>
        </span>

        {activeSession && (
          <div className="ml-3 flex items-center gap-1.5 px-2 py-0.5 rounded border border-white/30 bg-zinc-900 text-white text-[11px] font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-white mono-pulse"></span>
            <span>FOCUSING {formatTime(remainingSeconds)}</span>
            {activeSession.strictMode !== 'none' && (
              <Lock size={10} className="text-white ml-0.5" />
            )}
          </div>
        )}
      </div>

      {/* Window Controls (no-drag) */}
      <div className="flex items-center gap-1 titlebar-no-drag">
        <button
          onClick={handleMinimize}
          className="w-7 h-7 rounded flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          title="Minimize"
        >
          <Minus size={13} />
        </button>
        <button
          onClick={handleMaximize}
          className="w-7 h-7 rounded flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          title="Maximize"
        >
          <Square size={11} />
        </button>
        <button
          onClick={handleClose}
          className="w-7 h-7 rounded flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/20 transition-colors"
          title="Close to Tray"
        >
          <X size={14} />
        </button>
      </div>
    </header>
  );
};
