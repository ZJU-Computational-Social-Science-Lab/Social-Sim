/**
 * Tab bar for the simulation page workspace.
 *
 * Renders two tabs (Timeline, Agents) with active state styling
 * and hover-to-peek behavior. Active tab shows a highlighted indicator.
 *
 * Exports: TabBar
 */

import React, { useRef, useCallback } from 'react';
import { useSimulationStore } from '../store';
import { useTranslation } from 'react-i18next';
import { Clock, Users } from 'lucide-react';

const TABS = [
  { key: 'timeline', icon: Clock },
  { key: 'agents', icon: Users },
] as const;

const PEEK_DELAY_MS = 300;
// Delay before clearing peekTab on mouse leave — gives the cursor time to
// travel from a tab button into the PeekOverlay without dismissing it.
const PEEK_DISMISS_DELAY_MS = 120;

export const TabBar: React.FC = () => {
  const { t } = useTranslation();
  const activeTab = useSimulationStore((s) => s.activeTab);
  const peekTab = useSimulationStore((s) => s.peekTab);
  const setActiveTab = useSimulationStore((s) => s.setActiveTab);
  const setPeekTab = useSimulationStore((s) => s.setPeekTab);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = useCallback(
    (tab: 'timeline' | 'agents') => {
      // Cancel any in-flight dismiss so re-entering a tab doesn't close the overlay
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }
      if (tab === activeTab) return;
      hoverTimerRef.current = setTimeout(() => {
        setPeekTab(tab);
      }, PEEK_DELAY_MS);
    },
    [activeTab, setPeekTab]
  );

  const handleMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    // Delay the dismiss so the cursor can reach the PeekOverlay without a flicker
    dismissTimerRef.current = setTimeout(() => {
      // Don't dismiss if cursor has entered the overlay
      if (!useSimulationStore.getState().peekOverlayActive) {
        setPeekTab(null);
      }
    }, PEEK_DISMISS_DELAY_MS);
  }, [setPeekTab]);

  const handleClick = useCallback(
    (tab: 'timeline' | 'agents') => {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = null;
      }
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }
      setPeekTab(null);
      setActiveTab(tab);
    },
    [setActiveTab, setPeekTab]
  );

  return (
    <div className="flex items-center gap-1 px-4 py-1 border-b" style={{ background: 'var(--ss-workspace-surface)', borderColor: 'var(--ss-workspace-border)' }}>
      {TABS.map(({ key, icon: Icon }) => {
        const isActive = activeTab === key;
        const isPeeked = peekTab === key;
        return (
          <button
            key={key}
            onClick={() => handleClick(key)}
            onMouseEnter={() => handleMouseEnter(key)}
            onMouseLeave={handleMouseLeave}
            className={`
              flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-md
              transition-all duration-150
              ${isActive
                ? 'shadow-sm'
                : isPeeked
                  ? ''
                  : 'hover:text-slate-700 hover:bg-slate-50'
              }
            `}
            style={
              isActive
                ? { background: 'var(--ss-brand-soft)', color: 'var(--ss-brand-primary)' }
                : isPeeked
                  ? { background: 'var(--ss-workspace-surface)', color: 'var(--ss-workspace-text)' }
                  : { color: 'var(--ss-workspace-muted)' }
            }
          >
            <Icon size={14} />
            {t(`simPage.tabs.${key}`)}
          </button>
        );
      })}
    </div>
  );
};
