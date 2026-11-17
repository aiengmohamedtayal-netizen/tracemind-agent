import React from 'react';
import { motion } from 'motion/react';
import { Plus, Radar } from 'lucide-react';

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
    <header className="sticky top-0 z-40 flex flex-wrap md:flex-nowrap items-center justify-between gap-y-2.5 gap-x-4 md:gap-8 px-4 sm:px-6 py-3 bg-[#060913]/85 backdrop-blur-md border-b border-slate-800/60 shadow-lg">
      {/* Zone 1: Wordmark with Radar icon */}
      <a
        href="#overview"
        onClick={(e) => {
          e.preventDefault();
          onSelectTab('overview');
        }}
        className="flex items-center gap-2.5 whitespace-nowrap shrink-0 group focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
      >
        <span className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 group-hover:border-cyan-400/60 transition-colors">
          <Radar className="w-4 h-4 text-cyan-400" />
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        </span>
        <span className="text-lg font-bold tracking-tight text-white group-hover:text-cyan-300 transition-colors">
          Trace<span className="text-cyan-400">Mind</span>
        </span>
      </a>

      {/* Zone 2: Navigation Links */}
      <nav
        aria-label="Primary Navigation"
        className="order-3 md:order-2 w-full md:w-auto flex items-center gap-5 sm:gap-7 overflow-x-auto text-xs sm:text-sm font-medium text-slate-400 pt-1.5 md:pt-0 border-t md:border-t-0 border-slate-800/60"
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
              className={`relative py-1.5 whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400 ${
                isCurrent
                  ? 'text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {item.label}
              {isCurrent && (
                <motion.span
                  layoutId="tracemind-nav-underline"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  className="absolute inset-x-0 -bottom-[1px] h-0.5 bg-cyan-400 rounded-full shadow-[0_0_10px_rgba(34,211,238,0.8)]"
                />
              )}
            </a>
          );
        })}
      </nav>

      {/* Zone 3: Primary Action */}
      <div className="order-2 md:order-3 flex items-center shrink-0">
        <button
          type="button"
          onClick={() => onSelectTab('analyze')}
          className="inline-flex items-center gap-1.5 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-bold px-3.5 sm:px-4 py-2 text-xs rounded-lg shadow-[0_0_20px_rgba(6,182,212,0.35)] transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" aria-hidden="true" />
          New Log Analysis
        </button>
      </div>
    </header>
  );
};
