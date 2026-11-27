import React, { useState } from 'react';
import {
  Clock,
  FileText,
  FolderOpen,
  Layers,
  Link2,
  Pause,
  Play,
  Plus,
  Scissors,
  X,
} from 'lucide-react';
import { PlatformDispatchConfig, ScheduleConfig, WorkspaceTab } from '../types';

interface SidebarProps {
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
  schedule: ScheduleConfig;
  onUpdateSchedule: (next: ScheduleConfig) => void;
  countdownText: string;
  stats: {
    docsCount: number;
    queuedCount: number;
    publishedCount: number;
    mediaCount: number;
  };
  connectedSummary: {
    google: boolean;
    facebook: boolean;
    instagram: boolean;
    twitter: boolean;
  };
  platformModes: PlatformDispatchConfig;
}

const SIDEBAR_ITEMS: Array<{
  id: WorkspaceTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'queue', label: 'Queue & Preview', icon: Layers },
  { id: 'repository', label: 'Markdown Files', icon: FileText },
  { id: 'rules', label: 'Snipping Rules', icon: Scissors },
  { id: 'media', label: 'Drive & Photos', icon: FolderOpen },
  { id: 'connections', label: 'Social APIs & Deploy', icon: Link2 },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  schedule,
  onUpdateSchedule,
  countdownText,
  stats,
  connectedSummary,
  platformModes,
}) => {
  const [newTimeInput, setNewTimeInput] = useState('12:00');

  const handleAddDailyTime = () => {
    if (!newTimeInput || schedule.dailyTimes.includes(newTimeInput)) return;
    const sorted = [...schedule.dailyTimes, newTimeInput].sort();
    onUpdateSchedule({ ...schedule, dailyTimes: sorted });
  };

  const handleRemoveDailyTime = (time: string) => {
    onUpdateSchedule({
      ...schedule,
      dailyTimes: schedule.dailyTimes.filter((t) => t !== time),
    });
  };

  return (
    <aside className="w-full lg:w-64 shrink-0 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col justify-between">
      <div className="p-4 space-y-6">
        {/* Workspace Navigation (mobile + desktop structured list) */}
        <div className="space-y-1">
          <div className="px-2 pb-1.5 text-xs font-medium text-slate-500">Workspace</div>
          {SIDEBAR_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            const countLabel =
              item.id === 'queue'
                ? stats.queuedCount
                : item.id === 'repository'
                  ? stats.docsCount
                  : item.id === 'media'
                    ? stats.mediaCount
                    : null;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors cursor-pointer ${
                  active
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span className="flex items-center gap-2.5 truncate">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                {countLabel !== null && (
                  <span className="font-mono text-xs tabular-nums text-slate-500">
                    {countLabel}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Automated Release Scheduler */}
        <div className="pt-5 border-t border-slate-200 space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Clock className="w-4 h-4 text-slate-500" />
              <span>Auto-Release</span>
            </div>
            <button
              type="button"
              onClick={() => onUpdateSchedule({ ...schedule, enabled: !schedule.enabled })}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                schedule.enabled
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {schedule.enabled ? (
                <>
                  <Pause className="w-3 h-3" />
                  <span>Active</span>
                </>
              ) : (
                <>
                  <Play className="w-3 h-3" />
                  <span>Paused</span>
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => onUpdateSchedule({ ...schedule, mode: 'interval' })}
              className={`py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                schedule.mode === 'interval'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Interval
            </button>
            <button
              type="button"
              onClick={() => onUpdateSchedule({ ...schedule, mode: 'times' })}
              className={`py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                schedule.mode === 'times'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Scheduled Times
            </button>
          </div>

          {schedule.mode === 'interval' ? (
            <div className="space-y-2">
              <label className="block text-xs text-slate-600" htmlFor="interval-minutes-input">
                Release 1 post every (minutes)
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="interval-minutes-input"
                  type="number"
                  min={1}
                  max={10080}
                  value={schedule.intervalMinutes}
                  onChange={(e) =>
                    onUpdateSchedule({
                      ...schedule,
                      intervalMinutes: Math.max(1, Number(e.target.value) || 60),
                    })
                  }
                  className="w-full px-2.5 py-1.5 text-sm font-mono tabular-nums border border-slate-200 rounded-md bg-white text-slate-900 focus:outline-none focus:border-blue-600"
                />
                <span className="text-xs text-slate-500 shrink-0">min</span>
              </div>
              <div className="flex items-center gap-1.5">
                {[15, 60, 120, 360].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => onUpdateSchedule({ ...schedule, intervalMinutes: preset })}
                    className={`flex-1 py-1 text-xs font-mono tabular-nums rounded border transition-colors cursor-pointer ${
                      schedule.intervalMinutes === preset
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {preset >= 60 ? `${preset / 60}h` : `${preset}m`}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-xs text-slate-600">Daily release slots (local time)</div>
              <div className="flex items-center gap-1.5">
                <input
                  type="time"
                  value={newTimeInput}
                  onChange={(e) => setNewTimeInput(e.target.value)}
                  className="flex-1 px-2 py-1 text-xs font-mono tabular-nums border border-slate-200 rounded-md bg-white text-slate-900"
                />
                <button
                  type="button"
                  onClick={handleAddDailyTime}
                  aria-label="Add release time slot"
                  className="p-1.5 bg-slate-900 text-white rounded-md hover:bg-slate-800 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-md bg-slate-50/60">
                {schedule.dailyTimes.length === 0 ? (
                  <div className="px-2.5 py-2 text-xs text-slate-500">No slots configured</div>
                ) : (
                  schedule.dailyTimes.map((t) => (
                    <div
                      key={t}
                      className="flex items-center justify-between px-2.5 py-1.5 text-xs font-mono tabular-nums text-slate-700"
                    >
                      <span>{t}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveDailyTime(t)}
                        aria-label={`Remove time ${t}`}
                        className="text-slate-400 hover:text-red-600 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={schedule.respectActiveWindow}
              onChange={(e) =>
                onUpdateSchedule({ ...schedule, respectActiveWindow: e.target.checked })
              }
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-600"
            />
            <span>Quiet window ({schedule.activeWindowStart}–{schedule.activeWindowEnd})</span>
          </label>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Next dispatch</span>
            <span className="font-mono tabular-nums font-medium text-slate-900">
              {countdownText}
            </span>
          </div>
        </div>
      </div>

      {/* Account & Mode Summary */}
      <div className="p-4 border-t border-slate-200 bg-slate-50/70 space-y-2 text-xs text-slate-600">
        <div className="flex items-center justify-between">
          <span>Facebook</span>
          <span
            className={
              platformModes.facebook === 'official' && connectedSummary.facebook
                ? 'font-medium text-emerald-700'
                : platformModes.facebook === 'skip'
                  ? 'text-slate-400'
                  : 'font-medium text-slate-700'
            }
          >
            {platformModes.facebook === 'official'
              ? connectedSummary.facebook
                ? 'Live API'
                : 'Live (No token)'
              : platformModes.facebook === 'webhook'
                ? 'Webhook'
                : platformModes.facebook === 'skip'
                  ? 'Skipped'
                  : 'Dry-Run'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span>Instagram</span>
          <span
            className={
              platformModes.instagram === 'official' && connectedSummary.instagram
                ? 'font-medium text-emerald-700'
                : platformModes.instagram === 'skip'
                  ? 'text-slate-400'
                  : 'font-medium text-slate-700'
            }
          >
            {platformModes.instagram === 'official'
              ? connectedSummary.instagram
                ? 'Live API'
                : 'Live (No token)'
              : platformModes.instagram === 'webhook'
                ? 'Webhook'
                : platformModes.instagram === 'skip'
                  ? 'Skipped'
                  : 'Dry-Run'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span>X (Twitter)</span>
          <span
            className={
              platformModes.twitter === 'official' && connectedSummary.twitter
                ? 'font-medium text-emerald-700'
                : platformModes.twitter === 'skip'
                  ? 'text-slate-400'
                  : 'font-medium text-slate-700'
            }
          >
            {platformModes.twitter === 'official'
              ? connectedSummary.twitter
                ? 'Live API'
                : 'Live (No token)'
              : platformModes.twitter === 'webhook'
                ? 'Webhook'
                : platformModes.twitter === 'skip'
                  ? 'Manual / Skip'
                  : 'Dry-Run'}
          </span>
        </div>
        <div className="flex items-center justify-between pt-1 border-t border-slate-200/70">
          <span>Google Drive</span>
          <span className={connectedSummary.google ? 'text-emerald-700 font-medium' : 'text-slate-500'}>
            {connectedSummary.google ? 'Connected' : 'Signed out'}
          </span>
        </div>
      </div>
    </aside>
  );
};
