/**
 * KidsZone.jsx
 *
 * Main page for the Fun Mode — Kids Zone feature.
 * Route: /kids-zone  (defined in App.jsx — do not change the route here)
 *
 * Navigation strategy: LOCAL COMPONENT STATE
 * ─────────────────────────────────────────────
 * `activeModule` drives which view is shown:
 *   'menu'     → KidsMenu hub (default)
 *   'game'     → HealthGame
 *   'quiz'     → HealthQuiz
 *   'story'    → HealthStory
 *   'activity' → HealthActivity
 *
 * Nested React Router routes are intentionally NOT used — this keeps the
 * /kids-zone route path unchanged in App.jsx and self-contains all navigation
 * within this page.
 *
 * Module remount on re-entry:
 * Each module receives a `key={moduleKey}` that resets to a new value each time
 * the user navigates back to the hub and then re-opens the same module. This
 * ensures the module starts fresh (e.g. HealthGame reshuffles items, HealthQuiz
 * returns to the list screen) rather than resuming mid-session state.
 *
 * XP wiring:
 * handleXpEarned(amount, category) is passed as onXpEarned to ALL FOUR modules.
 * It calls addProgress() from kidsProgress.js and bumps progressRefreshKey so
 * ProgressBadge re-reads localStorage immediately after any XP award.
 *
 * Architecture: frontend-only, local, deterministic.
 * No Gemini, no FastAPI, no Firestore, no external APIs.
 */

import React, { useState } from 'react';
import KidsMenu from '../components/kids/KidsMenu';
import HealthGame from '../components/kids/HealthGame';
import HealthQuiz from '../components/kids/HealthQuiz';
import HealthStory from '../components/kids/HealthStory';
import HealthActivity from '../components/kids/HealthActivity';
import ProgressBadge from '../components/kids/ProgressBadge';
import { addProgress } from '../lib/kidsProgress';

// ── Module ID constants ───────────────────────────────────────────────────────
const MODULES = {
  MENU:     'menu',
  GAME:     'game',
  QUIZ:     'quiz',
  STORY:    'story',
  ACTIVITY: 'activity',
};

// ── Component ─────────────────────────────────────────────────────────────────
const KidsZone = () => {
  // Which module is currently shown
  const [activeModule, setActiveModule] = useState(MODULES.MENU);

  // Incremented each time the user navigates back to the hub, so the next
  // module open gets a fresh key and remounts cleanly.
  const [moduleKey, setModuleKey] = useState(0);

  // Drives ProgressBadge re-read after any XP award
  const [progressRefreshKey, setProgressRefreshKey] = useState(0);

  // ── Navigation helpers ────────────────────────────────────────────────────

  /** Open a module from the hub. */
  const openModule = (moduleId) => {
    setActiveModule(moduleId);
  };

  /** Return to the hub from any module. Bumps moduleKey so re-opening remounts. */
  const handleBack = () => {
    setActiveModule(MODULES.MENU);
    setModuleKey((k) => k + 1);
  };

  // ── XP handler (all four modules call this via onXpEarned prop) ───────────
  /**
   * Called by HealthGame, HealthQuiz, HealthStory, HealthActivity with
   * (amount, category). Writes to localStorage via kidsProgress.js and
   * bumps progressRefreshKey so ProgressBadge updates immediately.
   *
   * @param {number} amount    — XP to award
   * @param {string} category  — 'game' | 'quiz' | 'story' | 'activity'
   */
  const handleXpEarned = (amount, category = 'game') => {
    addProgress(amount, category);
    setProgressRefreshKey((k) => k + 1);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="w-full max-w-[860px] mx-auto px-4 md:px-5 pt-5 pb-24 space-y-5 page-enter">

      {/* ── Page header — always visible ── */}
      <div className="flex items-center justify-between px-1 pt-2">
        <div>
          <h1 className="text-[24px] md:text-[28px] font-extrabold text-on-surface leading-tight tracking-[-0.02em] font-display">
            🌈 Kids Zone
          </h1>
          <p className="text-[12px] text-on-surface-variant font-body mt-0.5">
            Fun Mode · Learn healthy habits!
          </p>
        </div>
      </div>

      {/* ── Healthy Hero progress badge — always visible ── */}
      <ProgressBadge refreshKey={progressRefreshKey} />

      {/* ── Module area ── */}
      <div>

        {/* Hub — four-card menu */}
        {activeModule === MODULES.MENU && (
          <KidsMenu onSelect={openModule} />
        )}

        {/* Health Games
            key={moduleKey} remounts the component each time the user re-enters,
            so HealthGame reshuffles items rather than resuming a previous round. */}
        {activeModule === MODULES.GAME && (
          <HealthGame
            key={`game-${moduleKey}`}
            onBack={handleBack}
            onXpEarned={handleXpEarned}
          />
        )}

        {/* Health Quizzes */}
        {activeModule === MODULES.QUIZ && (
          <HealthQuiz
            key={`quiz-${moduleKey}`}
            onBack={handleBack}
            onXpEarned={handleXpEarned}
          />
        )}

        {/* Health Stories */}
        {activeModule === MODULES.STORY && (
          <HealthStory
            key={`story-${moduleKey}`}
            onBack={handleBack}
            onXpEarned={handleXpEarned}
          />
        )}

        {/* Health Activities — daily checklist; remount so it re-reads
            localStorage and applies the day-boundary reset check on re-entry. */}
        {activeModule === MODULES.ACTIVITY && (
          <HealthActivity
            key={`activity-${moduleKey}`}
            onBack={handleBack}
            onXpEarned={handleXpEarned}
          />
        )}

      </div>
    </div>
  );
};

export default KidsZone;
