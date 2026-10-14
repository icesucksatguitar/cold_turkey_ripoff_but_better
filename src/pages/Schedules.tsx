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
      presetName,
    });

    setShowAddModal(false);
  };

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full bg-black text-white select-none">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">
            Automated Enforcement
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-1 flex items-center gap-2.5">
            <Calendar className="text-white" size={24} />
            Weekly Schedules
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Automate recurring distraction-free blocks across specific days and time intervals.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="btn-primary"
        >
          <Plus size={14} />
          <span>Add Schedule</span>
        </button>
      </div>

      {/* Schedules List */}
      <div className="space-y-3">
        {schedules.length === 0 ? (
          <div className="p-12 text-center rounded-xl bg-zinc-950 border border-white/10">
            <Calendar size={36} className="mx-auto text-zinc-600 mb-3" />
            <p className="text-sm font-semibold text-white">No schedules configured</p>
            <p className="text-xs text-zinc-500 mt-1">Create an automated routine to stay productive automatically.</p>
          </div>
        ) : (
          schedules.map((sched) => (
            <div
              key={sched.id}
              className={`p-4 rounded-xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                sched.enabled
                  ? 'bg-zinc-950 border-white/20 shadow-md'
                  : 'bg-zinc-950/50 border-white/5 opacity-60'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-base text-white">{sched.name}</span>
                  {sched.enabled ? (
                    <span className="badge badge-blocked">ACTIVE</span>
                  ) : (
                    <span className="badge badge-idle">DISABLED</span>
                  )}
                  {sched.strictMode !== 'none' && (
                    <span className="badge badge-idle">
                      <Lock size={10} />
                      {sched.strictMode}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4 text-xs font-mono text-zinc-400">
                  <div className="flex items-center gap-1.5 text-white">
                    <Clock size={13} className="text-zinc-500" />
                    <span>{sched.startTime} — {sched.endTime}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    {sched.blockWebsites && (
                      <span className="flex items-center gap-1">
                        <Globe size={11} className="text-zinc-500" />
                        Websites
                      </span>
                    )}
                    {sched.blockWebsites && sched.blockApps && <span>•</span>}
                    {sched.blockApps && (
                      <span className="flex items-center gap-1">
                        <AppWindow size={11} className="text-zinc-500" />
                        Apps
                      </span>
                    )}
                  </div>
                </div>

                {/* Day Pills */}
                <div className="flex items-center gap-1 pt-1">
                  {DAY_NAMES.map((dayName, idx) => {
                    const isSelected = sched.daysOfWeek.includes(idx);
                    return (
                      <span
                        key={dayName}
                        className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                          isSelected
                            ? 'bg-white text-black'
                            : 'bg-zinc-900 text-zinc-600'
                        }`}
                      >
                        {dayName}
                      </span>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-3 self-end md:self-center">
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={sched.enabled}
                    onChange={() => onToggleSchedule(sched.id)}
                  />
                  <span className="slider"></span>
                </label>

                <button
                  onClick={() => onRemoveSchedule(sched.id)}
                  className="w-8 h-8 rounded flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10 transition-colors"
                  title="Remove schedule"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Schedule Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="w-full max-w-md p-6 rounded-2xl bg-zinc-950 border border-white/20 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-bold text-base text-white">Create Automated Schedule</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-zinc-400 hover:text-white text-sm"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="text-xs text-zinc-400 block mb-1">Routine Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-field text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">Start Time (24h)</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="input-field text-xs font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">End Time (24h)</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="input-field text-xs font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-zinc-400 block mb-1.5">Active Days</label>
                <div className="flex items-center gap-1.5">
                  {DAY_NAMES.map((dName, idx) => {
                    const active = selectedDays.includes(idx);
                    return (
                      <button
                        type="button"
                        key={dName}
                        onClick={() => handleDayToggle(idx)}
                        className={`flex-1 py-1.5 rounded text-xs font-mono font-bold transition-all ${
                          active
                            ? 'bg-white text-black'
                            : 'bg-zinc-900 text-zinc-500 hover:text-white'
                        }`}
                      >
                        {dName}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs text-zinc-300 pt-1">
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

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
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
