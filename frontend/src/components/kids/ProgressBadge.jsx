/**
 * ProgressBadge.jsx
 *
 * Healthy Hero progress indicator for Kids Zone.
 *
 * Reads live from localStorage via kidsProgress.js on mount.
 * Re-reads whenever the `refreshKey` prop increments (parent bumps it
 * after calling addProgress so the badge updates without a page reload).
 *
 * No Firestore, no Firebase, no backend, no Gemini.
 *
 * Props:
 *   refreshKey {number}  — increment to trigger a re-read from localStorage
 *                          (e.g. pass Date.now() after calling addProgress)
 */

import React, { useEffect, useState } from 'react';
import {
  getProgress,
  getBadgeForPoints,
  getProgressFraction,
  BADGE_LEVELS,
} from '../../lib/kidsProgress';

const ProgressBadge = ({ refreshKey = 0 }) => {
  const [progress, setProgress] = useState(() => getProgress());

  // Re-read localStorage whenever refreshKey changes (parent signals a new award)
  useEffect(() => {
    setProgress(getProgress());
  }, [refreshKey]);

  const { totalPoints, categoryPoints } = progress;
  const badge = getBadgeForPoints(totalPoints);
  const fraction = getProgressFraction(totalPoints);
  const pct = Math.round(fraction * 100);

  // Points until next badge (null if at max rank)
  const pointsToNext = badge.nextAt !== null
    ? badge.nextAt - totalPoints
    : null;

  // Per-category display — only show categories that have points
  const earnedCategories = Object.entries(categoryPoints).filter(([, pts]) => pts > 0);

  return (
    <div
      style={{
        background: 'rgba(255,251,235,0.92)',
        backdropFilter: 'blur(18px) saturate(160%)',
        WebkitBackdropFilter: 'blur(18px) saturate(160%)',
        border: '1.5px solid rgba(251,191,36,0.35)',
        borderRadius: '18px',
        boxShadow: '0 4px 20px rgba(251,191,36,0.15), 0 1px 6px rgba(30,31,59,0.04)',
      }}
      className="flex flex-col gap-3 px-5 py-4"
      role="region"
      aria-label="Healthy Hero progress"
    >
      {/* Badge row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[28px] leading-none" aria-hidden="true">{badge.emoji}</span>
          <div>
            <p className="text-[14px] font-bold text-amber-800 leading-tight font-display">{badge.label}</p>
            <p className="text-[12px] text-amber-600 font-body">{totalPoints} XP earned</p>
          </div>
        </div>

        {/* Next rank hint */}
        {pointsToNext !== null ? (
          <p className="text-[11px] text-amber-500 text-right font-body leading-snug">
            {pointsToNext} XP to<br />
            <span className="font-bold text-amber-700">
              {BADGE_LEVELS[BADGE_LEVELS.findIndex(b => b.label === badge.label) + 1]?.label}
            </span>
          </p>
        ) : (
          <p className="text-[11px] text-amber-600 font-bold text-right font-display">
            Max Rank!<br />🎉
          </p>
        )}
      </div>

      {/* Progress bar */}
      <div>
        <div
          className="w-full rounded-full h-3 overflow-hidden"
          style={{ background: 'rgba(251,191,36,0.20)' }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Progress to next badge: ${pct}%`}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${pct}%`,
              background: 'linear-gradient(90deg, #F59E0B 0%, #FCD34D 100%)',
              boxShadow: '0 0 8px rgba(251,191,36,0.50)',
            }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-amber-400 font-body">{badge.minPoints} XP</span>
          <span className="text-[10px] text-amber-400 font-body">
            {badge.nextAt !== null ? `${badge.nextAt} XP` : '🏆'}
          </span>
        </div>
      </div>

      {/* Per-category breakdown */}
      {earnedCategories.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1" style={{ borderTop: '1px solid rgba(251,191,36,0.20)' }}>
          {earnedCategories.map(([cat, pts]) => {
            const ICONS = { game: '🎮', quiz: '🧠', story: '📖', activity: '🌟' };
            return (
              <span
                key={cat}
                className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] text-amber-700 font-body"
                style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.25)' }}
              >
                <span aria-hidden="true">{ICONS[cat] || '⭐'}</span>
                {pts} XP
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ProgressBadge;
