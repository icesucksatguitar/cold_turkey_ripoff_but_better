import React from 'react';
import {
  LayoutDashboard,
  Globe,
  AppWindow,
  Calendar,
  Clock,
  Activity,
  Settings,
  ShieldCheck,
  Lock,
} from 'lucide-react';
import { ActiveSession } from '../types';

export type TabType =
  | 'dashboard'
  | 'websites'
  | 'apps'
  | 'schedules'
  | 'session'
  | 'activity'
  | 'settings';

interface SidebarProps {
  currentTab: TabType;
  onTabChange: (tab: TabType) => void;
  websitesCount: number;
  appsCount: number;
  schedulesCount: number;
  activeSession: ActiveSession | null;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  websitesCount,
  appsCount,
  schedulesCount,
  activeSession,
}) => {
  const navItems = [
    { id: 'dashboard' as TabType, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'apps' as TabType, label: 'App Blocker', icon: AppWindow, count: appsCount },
    { id: 'websites' as TabType, label: 'Website Blocker', icon: Globe, count: websitesCount },
    { id: 'schedules' as TabType, label: 'Schedules', icon: Calendar, count: schedulesCount },
    { id: 'session' as TabType, label: 'Focus Session', icon: Clock },
    { id: 'activity' as TabType, label: 'Activity & Audit', icon: Activity },
    { id: 'settings' as TabType, label: 'Settings & Restore', icon: Settings },
  ];

  return (
    <aside className="w-56 bg-black border-r border-white/10 flex flex-col justify-between p-3 select-none">
      <div className="space-y-1">
        <div className="px-3 py-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest font-mono">
          System Menu
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-white text-black font-semibold shadow-md'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon
                  size={15}
                  className={isActive ? 'text-black' : 'text-zinc-400'}
                />
                <span>{item.label}</span>
              </div>
              {item.count !== undefined && item.count > 0 && (
                <span
                  className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                    isActive
                      ? 'bg-black text-white'
                      : 'bg-zinc-800 text-zinc-300 border border-white/10'
                  }`}
                >
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom Session Widget */}
      <div className="p-3 rounded-xl bg-zinc-950 border border-white/10 space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-zinc-400 font-medium">Engine Status</span>
          {activeSession ? (
            <span className="flex items-center gap-1 text-white font-mono font-bold text-[10px]">
              <ShieldCheck size={12} className="text-white" />
              ACTIVE
            </span>
          ) : (
            <span className="text-zinc-500 font-mono text-[10px]">STANDBY</span>
          )}
        </div>
        <div className="text-[10px] text-zinc-400 truncate">
          {activeSession ? (
            <div className="flex items-center gap-1 text-white font-medium">
              {activeSession.strictMode !== 'none' && <Lock size={10} className="text-white" />}
              <span>{activeSession.name}</span>
            </div>
          ) : (
            'Local protection active'
          )}
        </div>
      </div>
    </aside>
  );
};
