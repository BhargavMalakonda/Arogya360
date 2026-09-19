/**
 * HealthActivity.jsx
 *
 * Health Activities daily checklist for Kids Zone.
 * Fully local — no API calls, no Gemini, no Firestore.
 *
 * localStorage key: "kidsZoneActivities"  ← this file's ONLY storage key
 * NOT "kidsZoneProgress" — that key belongs to kidsProgress.js exclusively.
 *
 * Schema stored under "kidsZoneActivities":
 * {
 *   "lastResetDate": "YYYY-MM-DD",   // ISO date of last reset
 *   "checked": {                      // per-activity completion flags
 *     "drink-water":   boolean,
 *     "brush-teeth":   boolean,
 *     "eat-fruit":     boolean,
 *     "play-outside":  boolean,
 *     "wash-hands":    boolean
 *   },
 *   "xpAwarded": {                    // tracks which items already paid XP today
 *     "drink-water":   boolean,       // prevents double-award on uncheck+recheck
 *     ...
 *   }
 * }
 *
 * Day-boundary rule: on mount, compare lastResetDate to today's YYYY-MM-DD.
 * If different, reset checked and xpAwarded to all-false and update lastResetDate.
 *
 * Props:
 *   onBack     {function}           — return to Kids Zone hub
 *   onXpEarned {function(pts, cat)} — called with (xpReward, 'activity') when
 *                                     an activity is checked for the FIRST time today.
 *                                     KidsZone.jsx handles addProgress() internally —
 *                                     do NOT import kidsProgress.js here.
 */

import React, { useCallback, useEffect, useState } from 'react';
import kidsActivities from '../../data/kidsActivities';

const STORAGE_KEY = 'kidsZoneActivities';

// ── Date helper ────────────────────────────────────────────────────────────────
function todayISO() {
  // Returns "YYYY-MM-DD" in local time (not UTC) so the reset fires at midnight
  // for the user's timezone, not at a UTC offset.
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ── localStorage helpers ───────────────────────────────────────────────────────
function buildFreshState(dateStr) {
  const checked   = {};
  const xpAwarded = {};
  kidsActivities.forEach((a) => {
    checked[a.id]   = false;
    xpAwarded[a.id] = false;
  });
  return { lastResetDate: dateStr, checked, xpAwarded };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return buildFreshState(todayISO());

    const parsed = JSON.parse(raw);
    const today  = todayISO();

    // New day — reset everything
    if (!parsed.lastResetDate || parsed.lastResetDate !== today) {
      const fresh = buildFreshState(today);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
      return fresh;
    }

    // Same day — normalise: ensure all current activity IDs are present
    const checked   = parsed.checked   ?? {};
    const xpAwarded = parsed.xpAwarded ?? {};
    kidsActivities.forEach((a) => {
      if (!(a.id in checked))   checked[a.id]   = false;
      if (!(a.id in xpAwarded)) xpAwarded[a.id] = false;
    });

    return { lastResetDate: today, checked, xpAwarded };
  } catch {
    return buildFreshState(todayISO());
  }
}

function persistState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // localStorage write failure (e.g. private mode) is non-fatal
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
const HealthActivity = ({ onBack, onXpEarned }) => {
  const [activityState, setActivityState] = useState(() => loadState());

  const { checked, xpAwarded } = activityState;

  // Count completed items
  const completedCount = kidsActivities.filter((a) => checked[a.id]).length;
  const totalCount     = kidsActivities.length;
  const allDone        = completedCount === totalCount;

  // ── Toggle a checklist item ───────────────────────────────────────────────
  const handleToggle = useCallback((activity) => {
    setActivityState((prev) => {
      const wasChecked    = prev.checked[activity.id];
      const alreadyPaid   = prev.xpAwarded[activity.id];
      const nowChecked    = !wasChecked;

      // Award XP only when: checking (not unchecking) AND XP not yet given today
      if (nowChecked && !alreadyPaid && typeof onXpEarned === 'function') {
        onXpEarned(activity.xpReward, 'activity');
      }

      const next = {
        ...prev,
        checked:   { ...prev.checked,   [activity.id]: nowChecked },
        xpAwarded: {
          ...prev.xpAwarded,
          // Once XP is awarded, mark it so uncheck+recheck doesn't double-award
          [activity.id]: alreadyPaid || nowChecked,
        },
      };

      persistState(next);
      return next;
    });
  }, [onXpEarned]);

  // ── Progress bar percentage ───────────────────────────────────────────────
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="text-[13px] text-brand-indigo font-semibold font-display hover:text-brand-indigo/75 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-indigo/40 rounded px-1"
          aria-label="Back to Kids Zone"
        >
          ← Back
        </button>
        <h2 className="text-[18px] font-bold text-on-surface font-display">🌟 Today's Health Activities</h2>
      </div>

      {/* Daily progress bar */}
      <div>
        <div className="flex justify-between items-baseline mb-1">
          <p className="text-[12px] text-on-surface-variant font-body">
            {completedCount} of {totalCount} done today
          </p>
          <p className="text-[12px] font-bold text-brand-indigo font-display">{progressPct}%</p>
        </div>
        <div
          className="w-full rounded-full h-3 overflow-hidden"
          style={{ background: 'rgba(88,86,214,0.10)' }}
          role="progressbar"
          aria-valuenow={completedCount}
          aria-valuemin={0}
          aria-valuemax={totalCount}
          aria-label={`${completedCount} of ${totalCount} activities completed today`}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progressPct}%`,
              background: allDone
                ? 'linear-gradient(90deg,#4ADE80,#22C55E)'
                : 'linear-gradient(90deg,#706DF2,#5856D6)',
              boxShadow: allDone
                ? '0 0 6px rgba(34,197,94,0.50)'
                : '0 0 6px rgba(88,86,214,0.40)',
            }}
          />
        </div>
      </div>

      {/* All-done celebration */}
      {allDone && (
        <div
          className="p-4 text-center rounded-[18px]"
          style={{
            background: 'rgba(240,253,244,0.92)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1.5px solid rgba(22,163,74,0.28)',
            boxShadow: '0 4px 16px rgba(22,163,74,0.12)',
          }}
        >
          <p className="text-[28px] mb-1" aria-hidden="true">🎊</p>
          <p className="text-[14px] font-extrabold text-green-800 font-display">Amazing! You completed all today's activities!</p>
          <p className="text-[12px] text-green-600 font-body mt-0.5">Come back tomorrow for a fresh checklist!</p>
        </div>
      )}

      {/* Checklist */}
      <div className="space-y-3">
        {kidsActivities.map((activity) => {
          const isDone = checked[activity.id];
          return (
            <button
              key={activity.id}
              onClick={() => handleToggle(activity)}
              className={[
                'w-full flex items-center gap-4 px-4 py-4 rounded-2xl border-2 text-left transition-all duration-200 active:scale-95 focus:outline-none focus:ring-2 focus:ring-brand-indigo/50 min-h-[68px]',
                isDone
                  ? 'bg-green-50/90 border-green-300'
                  : 'bg-white/70 border-white/60 hover:bg-white/90',
              ].join(' ')}
              style={isDone ? {} : { backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' }}
              role="checkbox"
              aria-checked={isDone}
              aria-label={`${isDone ? 'Uncheck' : 'Check'}: ${activity.label}`}
            >
              {/* Checkbox circle */}
              <div
                className={`flex-shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
                  isDone ? 'bg-green-500 border-green-500' : 'bg-white border-on-surface-variant/30'
                }`}
                aria-hidden="true"
              >
                {isDone && (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="white" className="w-4 h-4" aria-hidden="true">
                    <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
                  </svg>
                )}
              </div>

              <span className="text-[22px] flex-shrink-0" aria-hidden="true">{activity.emoji}</span>

              <div className="flex-1 min-w-0">
                <p className={`text-[13px] font-bold leading-tight ${isDone ? 'text-green-800 line-through decoration-green-400' : 'text-on-surface'} font-display`}>
                  {activity.label}
                </p>
                <p className="text-[11px] text-on-surface-variant mt-0.5 leading-snug font-body">{activity.description}</p>
              </div>

              {/* XP badge */}
              <span
                className={`flex-shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full font-display`}
                style={isDone
                  ? { background: 'rgba(22,163,74,0.15)', color: '#15803D', border: '1px solid rgba(22,163,74,0.22)' }
                  : { background: 'rgba(251,191,36,0.15)', color: '#B45309', border: '1px solid rgba(251,191,36,0.28)' }
                }
              >
                {isDone ? '✓' : `+${activity.xpReward} XP`}
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-[11px] text-center text-on-surface-variant/55 font-body pt-1">
        🔄 Checklist resets automatically each new day
      </p>
    </div>
  );
};

export default HealthActivity;
