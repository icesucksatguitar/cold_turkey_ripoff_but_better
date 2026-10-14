import React, { useState } from 'react';
import {
  Activity,
  ShieldAlert,
  PlayCircle,
  CheckCircle,
  Calendar,
  AlertTriangle,
  Info,
  Trash2,
  Search,
} from 'lucide-react';
import { ActivityLog as ActivityLogType } from '../types';

interface ActivityLogProps {
  logs: ActivityLogType[];
  onClearLogs: () => void;
}

export const ActivityLogPage: React.FC<ActivityLogProps> = ({ logs, onClearLogs }) => {
  const [filterType, setFilterType] = useState<string>('all');
  const [search, setSearch] = useState('');

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.target.toLowerCase().includes(search.toLowerCase()) ||
      log.details.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    if (filterType === 'all') return true;
    if (filterType === 'blocked') return log.type === 'app_blocked' || log.type === 'website_blocked';
    if (filterType === 'sessions') return log.type === 'session_start' || log.type === 'session_end';
    if (filterType === 'system') return log.type === 'system' || log.type === 'schedule_trigger';
    return true;
  });

  const getLogIcon = (type: ActivityLogType['type']) => {
    switch (type) {
      case 'app_blocked':
        return <ShieldAlert size={14} className="text-amber-400" />;
      case 'session_start':
        return <PlayCircle size={14} className="text-sky-400" />;
      case 'session_end':
        return <CheckCircle size={14} className="text-emerald-400" />;
      case 'schedule_trigger':
        return <Calendar size={14} className="text-indigo-400" />;
      case 'emergency_unlock':
        return <AlertTriangle size={14} className="text-rose-400" />;
      default:
        return <Info size={14} className="text-slate-400" />;
    }
  };

  const formatTimestamp = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
      ' • ' +
      d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="p-6 space-y-5 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2.5">
            <Activity className="text-sky-400" size={22} />
            Activity & Audit Log
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Local forensic record of blocked processes, completed sessions, and schedule triggers.
          </p>
        </div>

        {logs.length > 0 && (
          <button
            onClick={onClearLogs}
            className="btn-secondary text-xs text-rose-400 hover:text-rose-300"
          >
            <Trash2 size={13} />
            Clear Log History
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search activity records..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          {[
            { id: 'all', label: 'All Events' },
            { id: 'blocked', label: 'Interceptions' },
            { id: 'sessions', label: 'Sessions' },
            { id: 'system', label: 'System & Schedules' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id)}
              className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-all ${
                filterType === tab.id
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                  : 'bg-white/5 text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Logs Feed */}
      <div className="glass-panel overflow-hidden">
        {filteredLogs.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <Activity size={32} className="mx-auto text-slate-600" />
            <p className="text-sm font-semibold text-slate-300">No activity logged</p>
            <p className="text-xs text-slate-500">
              When an application is intercepted or a focus session runs, events will appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/5 max-h-[520px] overflow-y-auto">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                className="p-3.5 hover:bg-white/[0.02] flex items-start gap-3 transition-colors"
              >
                <div className="mt-0.5 w-7 h-7 rounded-lg bg-slate-900 border border-white/10 flex items-center justify-center shrink-0">
                  {getLogIcon(log.type)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-xs text-slate-200">{log.target}</span>
                    <span className="font-mono text-[10px] text-slate-500 shrink-0">
                      {formatTimestamp(log.timestamp)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed break-words">
                    {log.details}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
