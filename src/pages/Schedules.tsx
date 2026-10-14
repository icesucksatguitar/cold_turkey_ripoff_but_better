import React, { useState } from 'react';
import {
  Calendar,
  Plus,
  Trash2,
  Clock,
  Globe,
  AppWindow,
  Lock,
  Check,
} from 'lucide-react';
import { FocusSchedule, StrictModeLevel } from '../types';

interface SchedulesProps {
  schedules: FocusSchedule[];
  onAddSchedule: (schedule: Omit<FocusSchedule, 'id'>) => void;
  onToggleSchedule: (id: string) => void;
  onRemoveSchedule: (id: string) => void;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const Schedules: React.FC<SchedulesProps> = ({
  schedules,
  onAddSchedule,
  onToggleSchedule,
  onRemoveSchedule,
}) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('Deep Work Routine');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('12:00');
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]); // Mon-Fri
  const [blockWebsites, setBlockWebsites] = useState(true);
  const [blockApps, setBlockApps] = useState(true);
  const [strictMode, setStrictMode] = useState<StrictModeLevel>('locked');
  const [presetName, setPresetName] = useState('Deep Work');

  const handleDayToggle = (day: number) => {
    if (selectedDays.includes(day)) {
      if (selectedDays.length > 1) {
        setSelectedDays(selectedDays.filter((d) => d !== day));
      }
    } else {
      setSelectedDays([...selectedDays, day].sort());
    }
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onAddSchedule({
      name: name.trim(),
      startTime,
      endTime,
      daysOfWeek: selectedDays,
      blockWebsites,
      blockApps,
      strictMode,
      enabled: true,
      presetName,
    });

    setShowAddModal(false);
  };

  return (
    <div className="p-6 space-y-5 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2.5">
            <Calendar className="text-emerald-400" size={22} />
            Focus Schedules
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Automate recurring distraction-free blocks during your daily routine.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary text-xs"
        >
          <Plus size={15} />
          New Schedule
        </button>
      </div>

      {/* Schedules Grid */}
      {schedules.length === 0 ? (
        <div className="glass-panel p-10 text-center space-y-3">
          <Calendar size={36} className="mx-auto text-slate-600" />
          <h3 className="text-sm font-semibold text-slate-300">No recurring schedules</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Set up automatic focus windows for study hours, morning deep work, or bedtime device blocks.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary text-xs mx-auto mt-2"
          >
            <Plus size={14} />
            Create First Schedule
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {schedules.map((schedule) => (
            <div
              key={schedule.id}
              className={`p-4 rounded-xl border transition-all ${
                schedule.enabled
                  ? 'glass-panel border-white/10 hover:border-emerald-500/30'
                  : 'bg-slate-900/30 border-white/5 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-sm text-slate-100">{schedule.name}</h3>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                    <Clock size={13} className="text-emerald-400" />
                    <span className="font-mono font-medium">
                      {schedule.startTime} – {schedule.endTime}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={schedule.enabled}
                      onChange={() => onToggleSchedule(schedule.id)}
                    />
                    <span className="slider"></span>
                  </label>
                  <button
                    onClick={() => onRemoveSchedule(schedule.id)}
                    className="w-7 h-7 rounded flex items-center justify-center text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    title="Delete schedule"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Days Chips */}
              <div className="flex items-center gap-1 mt-4">
                {DAY_NAMES.map((name, index) => {
                  const isSelected = schedule.daysOfWeek.includes(index);
                  return (
                    <span
                      key={name}
                      className={`text-[10px] font-bold w-6 h-6 rounded flex items-center justify-center ${
                        isSelected
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-white/5 text-slate-600'
                      }`}
                    >
                      {name.charAt(0)}
                    </span>
                  );
                })}
              </div>

              {/* Rule Pills */}
              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/5 text-[11px] text-slate-400">
                {schedule.blockWebsites && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/20 text-[10px]">
                    <Globe size={10} /> Websites
                  </span>
                )}
                {schedule.blockApps && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-[10px]">
                    <AppWindow size={10} /> Apps
                  </span>
                )}
                {schedule.strictMode !== 'none' && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20 text-[10px] uppercase font-bold">
                    <Lock size={10} /> Strict
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Schedule Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="glass-panel max-w-lg w-full p-6 space-y-4 border border-emerald-500/30">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Calendar size={16} className="text-emerald-400" />
                Create Focus Schedule
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-500 hover:text-slate-300"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-400">Schedule Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-field text-xs"
                  required
                />
              </div>

              {/* Time Range */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-400">Start Time (24h)</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="input-field text-xs font-mono"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-400">End Time (24h)</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="input-field text-xs font-mono"
                    required
                  />
                </div>
              </div>

              {/* Days of Week */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-400">Active Days</label>
                <div className="grid grid-cols-7 gap-1">
                  {DAY_NAMES.map((dayName, idx) => {
                    const isSelected = selectedDays.includes(idx);
                    return (
                      <button
                        type="button"
                        key={dayName}
                        onClick={() => handleDayToggle(idx)}
                        className={`py-1.5 rounded text-xs font-bold transition-all ${
                          isSelected
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-white/5 text-slate-500 hover:text-slate-300 border border-transparent'
                        }`}
                      >
                        {dayName}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Strict Mode Selector */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-400">Strictness Level</label>
                <select
                  value={strictMode}
                  onChange={(e) => setStrictMode(e.target.value as StrictModeLevel)}
                  className="input-field text-xs cursor-pointer"
                >
                  <option value="none">Casual (Can pause or stop anytime)</option>
                  <option value="locked">Locked (Disabled stop button)</option>
                  <option value="extreme">Extreme (Requires verification phrase)</option>
                </select>
              </div>

              {/* Distraction Toggles */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <label className="p-3 rounded-lg bg-slate-900/60 border border-white/5 flex items-center justify-between cursor-pointer">
                  <span className="text-xs text-slate-300 font-medium">Block Websites</span>
                  <input
                    type="checkbox"
                    checked={blockWebsites}
                    onChange={(e) => setBlockWebsites(e.target.checked)}
                    className="w-4 h-4 rounded text-sky-500"
                  />
                </label>
                <label className="p-3 rounded-lg bg-slate-900/60 border border-white/5 flex items-center justify-between cursor-pointer">
                  <span className="text-xs text-slate-300 font-medium">Block Apps</span>
                  <input
                    type="checkbox"
                    checked={blockApps}
                    onChange={(e) => setBlockApps(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-500"
                  />
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary text-xs">
                  Save Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
