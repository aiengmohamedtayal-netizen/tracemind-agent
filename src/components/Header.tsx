import React from 'react';
import { motion } from 'motion/react';
import { Plus } from 'lucide-react';

export type NavTabId =
  | 'overview'
  | 'analyze'
  | 'investigate'
  | 'history';

interface HeaderProps {
  activeTab: NavTabId;
  onSelectTab: (tab: NavTabId) => void;
  anomalyCount: number;
}

const NAV_ITEMS: { id: NavTabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'analyze', label: 'Analyze' },
  { id: 'investigate', label: 'Investigate' },
  { id: 'history', label: 'History' },
];

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onSelectTab,
}) => {
  return (
    <header className="sticky top-0 z-30 flex flex-wrap md:flex-nowrap items-center justify-between gap-y-2.5 gap-x-4 md:gap-8 px-4 sm:px-6 py-3 bg-white/95 border-b border-slate-200/90 shadow-2xs">
      {/* Zone 1: Single text element wordmark */}
      <a
        href="#overview"
        onClick={(e) => {
          e.preventDefault();
          onSelectTab('overview');
        }}
        className="text-lg font-bold tracking-tight text-slate-900 hover:text-blue-600 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      >
        TraceMind
      </a>

      {/* Zone 2: 5 concise single-line text navigation links */}
      <nav
        aria-label="Primary Navigation"
        className="order-3 md:order-2 w-full md:w-auto flex items-center gap-5 sm:gap-7 overflow-x-auto text-xs sm:text-sm font-medium text-slate-600 pt-1.5 md:pt-0 border-t md:border-t-0 border-slate-100"
      >
        {NAV_ITEMS.map((item) => {
          const isCurrent = activeTab === item.id;
          return (
            <a
              key={item.id}
              href={`#${item.id}`}
              aria-current={isCurrent ? 'page' : undefined}
              onClick={(e) => {
                e.preventDefault();
                onSelectTab(item.id);
              }}
              className={`relative py-1.5 whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                isCurrent
                  ? 'text-slate-950 font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {item.label}
              {isCurrent && (
                <motion.span
                  layoutId="tracemind-nav-underline"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  className="absolute inset-x-0 -bottom-[1px] h-0.5 bg-blue-600 rounded-full"
                />
              )}
            </a>
          );
        })}
      </nav>

      {/* Zone 3: 1 primary action */}
      <div className="order-2 md:order-3 flex items-center shrink-0">
        <button
          type="button"
          onClick={() => onSelectTab('analyze')}
          className="tm-btn-primary px-3.5 sm:px-4 py-2 text-xs whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" aria-hidden="true" />
          New Log Analysis
        </button>
      </div>
    </header>
  );
};
