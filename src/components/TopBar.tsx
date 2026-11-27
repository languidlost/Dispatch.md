import React from 'react';
import { Send } from 'lucide-react';
import { WorkspaceTab } from '../types';

interface TopBarProps {
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
  onReleaseNext: () => void;
  pendingCount: number;
  isReleasing: boolean;
}

const NAV_ITEMS: Array<{ id: WorkspaceTab; label: string }> = [
  { id: 'queue', label: 'Queue' },
  { id: 'repository', label: 'Repository' },
  { id: 'rules', label: 'Snip Rules' },
  { id: 'media', label: 'Drive & Photos' },
  { id: 'connections', label: 'Connections' },
];

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  onSelectTab,
  onReleaseNext,
  pendingCount,
  isReleasing,
}) => {
  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between gap-8 sticky top-0 z-30">
      {/* Zone 1: Brand Wordmark */}
      <button
        type="button"
        onClick={() => onSelectTab('queue')}
        className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-4"
      >
        Dispatch.md
      </button>

      {/* Zone 2: Single-line navigation links */}
      <nav aria-label="Primary workspace navigation" className="hidden md:flex items-center gap-7">
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`py-5 text-sm font-medium whitespace-nowrap shrink-0 border-b-2 transition-colors cursor-pointer ${
                isActive
                  ? 'border-blue-600 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Zone 3: Single primary action */}
      <div className="shrink-0">
        <button
          type="button"
          onClick={onReleaseNext}
          disabled={pendingCount === 0 || isReleasing}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-500 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2"
        >
          <Send className="w-4 h-4 shrink-0" />
          <span>
            {isReleasing
              ? 'Releasing...'
              : pendingCount > 0
                ? `Release Next (${pendingCount})`
                : 'Queue Empty'}
          </span>
        </button>
      </div>
    </header>
  );
};
