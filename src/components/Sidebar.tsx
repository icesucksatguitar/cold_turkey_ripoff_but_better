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
    { id: 'websites' as TabType, label: 'Website Blocker', icon: Globe, count: websitesCount },
    { id: 'apps' as TabType, label: 'App Blocker', icon: AppWindow, count: appsCount },
    { id: 'schedules' as TabType, label: 'Schedules', icon: Calendar, count: schedulesCount },
    { id: 'session' as TabType, label: 'Focus Session', icon: Clock },
    { id: 'activity' as TabType, label: 'Activity & Audit', icon: Activity },
    { id: 'settings' as TabType, label: 'Settings & Restore', icon: Settings },
  ];

  return (
    <aside className="w-56 bg-slate-950/70 border-r border-white/5 flex flex-col justify-between p-3 select-none">
      <div className="space-y-1">
        <div className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
          Navigation
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
                  ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30 shadow-sm shadow-sky-500/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon
                  size={16}
                  className={isActive ? 'text-sky-400' : 'text-slate-500 group-hover:text-slate-300'}
                />
                <span>{item.label}</span>
              </div>
              {item.count !== undefined && item.count > 0 && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    isActive
                      ? 'bg-sky-500/30 text-sky-200'
                      : 'bg-white/10 text-slate-400'
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
      <div className="p-2.5 rounded-xl bg-slate-900/60 border border-white/5 space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-400 font-medium">Protection Status</span>
          {activeSession ? (
            <span className="flex items-center gap-1 text-emerald-400 font-semibold text-[10px]">
              <ShieldCheck size={12} />
              ACTIVE
            </span>
          ) : (
            <span className="text-slate-500 font-medium text-[10px]">STANDBY</span>
          )}
        </div>
        <div className="text-[10px] text-slate-500">
          {activeSession ? (
            <div className="flex items-center gap-1 text-sky-300 font-medium">
              {activeSession.strictMode !== 'none' && <Lock size={10} className="text-rose-400" />}
              <span>{activeSession.name}</span>
            </div>
          ) : (
            'Local filtering engine ready'
          )}
        </div>
      </div>
    </aside>
  );
};
