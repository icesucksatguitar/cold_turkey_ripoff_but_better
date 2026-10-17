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
  Coffee,
  Play,
  Pause,
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
    if (filterType === 'breaks') return log.type === 'break_start' || log.type === 'break_end';
    if (filterType === 'system') return log.type === 'system' || log.type === 'schedule_trigger';
    return true;
  });

  const getLogIcon = (type: ActivityLogType['type']) => {
    switch (type) {
      case 'app_blocked':
        return <ShieldAlert size={14} className="text-white" />;
      case 'session_start':
        return <PlayCircle size={14} className="text-white" />;
      case 'session_end':
        return <CheckCircle size={14} className="text-white" />;
      case 'break_start':
        return <Coffee size={14} className="text-amber-400" />;
      case 'break_end':
        return <Play size={14} className="text-emerald-400" />;
      case 'schedule_trigger':
        return <Calendar size={14} className="text-white" />;
      case 'emergency_unlock':
        return <AlertTriangle size={14} className="text-white" />;
      default:
        return <Info size={14} className="text-zinc-400" />;
    }
  };

  const formatTimestamp = (ts: number) => {
    const d = new Date(ts);
    return (
      d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
      ' • ' +
      d.toLocaleDateString([], { month: 'short', day: 'numeric' })
    );
  };

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full bg-black text-white select-none">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">
            Audit Trail
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-1 flex items-center gap-2.5">
            <Activity className="text-white" size={24} />
            Activity & Security Logs
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Local event telemetry documenting every intercepted launch and focus event.
          </p>
        </div>

        {logs.length > 0 && (
          <button onClick={onClearLogs} className="btn-secondary text-xs">
            <Trash2 size={13} />
            <span>Clear History</span>
          </button>
        )}
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search size={14} className="absolute left-3.5 top-3 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search event logs..."
            className="input-field pl-9"
          />
        </div>

        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-zinc-950 border border-white/10 w-full md:w-auto">
          {[
            { id: 'all', label: 'All Events' },
            { id: 'blocked', label: 'Interceptions' },
            { id: 'sessions', label: 'Sessions' },
            { id: 'breaks', label: 'Breaks' },
            { id: 'system', label: 'System' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilterType(f.id)}
              className={`px-3 py-1.5 rounded text-xs font-mono uppercase transition-colors ${
                filterType === f.id
                  ? 'bg-white text-black font-bold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Logs Table / List */}
      <div className="space-y-2">
        {filteredLogs.length === 0 ? (
          <div className="p-12 text-center rounded-xl bg-zinc-950 border border-white/10">
            <Activity size={36} className="mx-auto text-zinc-600 mb-3" />
            <p className="text-sm font-semibold text-white">No activity records found</p>
            <p className="text-xs text-zinc-500 mt-1">Events will appear here as distractions are blocked.</p>
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div
              key={log.id}
              className="p-3.5 rounded-xl bg-zinc-950 border border-white/5 hover:border-white/15 transition-all flex items-start gap-3.5"
            >
              <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-white/10 flex items-center justify-center shrink-0 mt-0.5">
                {getLogIcon(log.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-white truncate">{log.target}</span>
                    <span className="badge badge-idle">
                      {log.type.replace('_', ' ')}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-zinc-500 shrink-0">
                    {formatTimestamp(log.timestamp)}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-1 font-mono break-all">{log.details}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
