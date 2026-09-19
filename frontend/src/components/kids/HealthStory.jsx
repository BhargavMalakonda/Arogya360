/**
 * HealthStory.jsx
 *
 * Health Stories module for Kids Zone.
 * Fully local — no API calls, no Gemini, no Firestore.
 * All story content lives in kidsStories.js.
 *
 * Props:
 *   onBack     {function}           — return to Kids Zone hub
 *   onXpEarned {function(pts, cat)} — called via KidsZone which handles addProgress();
 *                                     do NOT import kidsProgress.js directly here.
 *
 * Internal phases:
 *   LIST     → choose a story
 *   READING  → paginated page-by-page view (prev / next)
 *   FINISH   → moral + XP award + actions
 */

import React, { useState } from 'react';
import SecondaryButton from '../SecondaryButton';
import PrimaryButton from '../PrimaryButton';
import kidsStories from '../../data/kidsStories';

// ── Shared glass card ─────────────────────────────────────────────────────────
const KidsGlassCard = ({ children, className = '', style = {} }) => (
  <div
    style={{
      background: 'rgba(255,255,255,0.88)',
      backdropFilter: 'blur(20px) saturate(170%)',
      WebkitBackdropFilter: 'blur(20px) saturate(170%)',
      border: '1px solid rgba(255,255,255,0.92)',
      borderRadius: '18px',
      boxShadow: '0 4px 18px rgba(88,86,214,0.07), 0 1px 5px rgba(30,31,59,0.04)',
      ...style,
    }}
    className={className}
  >
    {children}
  </div>
);

const KidsBackBtn = ({ onClick, label, children }) => (
  <button onClick={onClick}
    className="text-[13px] text-brand-indigo font-semibold font-display hover:text-brand-indigo/75 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-indigo/40 rounded px-1"
    aria-label={label}>{children}</button>
);
const PHASE = {
  LIST:    'list',
  READING: 'reading',
  FINISH:  'finish',
};

// ── Main component ────────────────────────────────────────────────────────────
const HealthStory = ({ onBack, onXpEarned }) => {
  const [phase, setPhase]         = useState(PHASE.LIST);
  const [activeStory, setActiveStory] = useState(null);
  const [pageIndex, setPageIndex] = useState(0);

  const totalPages = activeStory?.pages.length ?? 0;
  const currentPage = activeStory?.pages[pageIndex] ?? null;
  const isFirstPage = pageIndex === 0;
  const isLastPage  = pageIndex === totalPages - 1;

  // ── Actions ───────────────────────────────────────────────────────────────

  const openStory = (story) => {
    setActiveStory(story);
    setPageIndex(0);
    setPhase(PHASE.READING);
  };

  const goNext = () => {
    if (isLastPage) {
      // Award XP once on completion, via the prop callback
      if (typeof onXpEarned === 'function' && activeStory.xpReward > 0) {
        onXpEarned(activeStory.xpReward, 'story');
      }
      setPhase(PHASE.FINISH);
    } else {
      setPageIndex((i) => i + 1);
    }
  };

  const goPrev = () => {
    if (!isFirstPage) setPageIndex((i) => i - 1);
  };

  const returnToList = () => {
    setPhase(PHASE.LIST);
    setActiveStory(null);
    setPageIndex(0);
  };

  // ── PHASE: LIST ───────────────────────────────────────────────────────────
  if (phase === PHASE.LIST) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <KidsBackBtn onClick={onBack} label="Back to Kids Zone">← Back</KidsBackBtn>
          <h2 className="text-[18px] font-bold text-on-surface font-display">📖 Health Stories</h2>
        </div>
        <p className="text-[13px] text-on-surface-variant font-body">Read fun stories about kids who stay healthy!</p>
        <div className="space-y-3">
          {kidsStories.map((story) => (
            <button
              key={story.id}
              onClick={() => openStory(story)}
              className={`w-full flex items-start gap-4 p-4 rounded-2xl border-2 ${story.color} text-left transition-transform active:scale-95 focus:outline-none focus:ring-2 focus:ring-brand-indigo/50`}
              aria-label={`Read story: ${story.title}`}
            >
              <span className="text-[28px] flex-shrink-0 mt-0.5" aria-hidden="true">{story.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-bold text-on-surface">{story.title}</p>
                <p className="text-[12px] text-on-surface-variant mt-0.5 leading-snug">{story.description}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[11px] text-on-surface-variant/55">{story.pages.length} pages</span>
                  <span className="text-[11px] text-on-surface-variant/55">Ages {story.ageRange}</span>
                  <span className="text-[11px] text-amber-600 font-semibold">+{story.xpReward} XP</span>
                </div>
              </div>
              <span className="text-on-surface-variant/40 text-lg flex-shrink-0 mt-1" aria-hidden="true">›</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── PHASE: READING ────────────────────────────────────────────────────────
  if (phase === PHASE.READING && currentPage) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <KidsBackBtn onClick={returnToList} label="Back to story list">← Stories</KidsBackBtn>
          <span className="text-[13px] font-semibold text-on-surface font-display">
            {activeStory.emoji} {activeStory.title}
          </span>
        </div>

        {/* Page progress dots */}
        <div className="flex items-center justify-center gap-2"
          role="progressbar" aria-valuenow={pageIndex + 1} aria-valuemin={1} aria-valuemax={totalPages}
          aria-label={`Page ${pageIndex + 1} of ${totalPages}`}>
          {activeStory.pages.map((_, i) => (
            <div key={i} className={`rounded-full transition-all duration-300 ${
              i < pageIndex ? 'w-3 h-3 bg-brand-indigo opacity-40'
              : i === pageIndex ? 'w-4 h-4 bg-brand-indigo ring-2 ring-brand-indigo ring-offset-1'
              : 'w-3 h-3 bg-white/40'
            }`} />
          ))}
        </div>

        {/* Story page card */}
        <KidsGlassCard className="p-6 min-h-[220px] flex flex-col items-center justify-center text-center gap-4">
          <span className="text-[56px] leading-none select-none" aria-hidden="true"
            style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.10))' }}>
            {currentPage.emoji}
          </span>
          <p className="text-[15px] text-on-surface leading-relaxed whitespace-pre-line font-body">
            {currentPage.text}
          </p>
          <p className="text-[11px] text-on-surface-variant/55 mt-auto font-body">
            Page {pageIndex + 1} of {totalPages}
          </p>
        </KidsGlassCard>

        {/* Navigation */}
        <div className="flex gap-3">
          <SecondaryButton onClick={goPrev} disabled={isFirstPage} className="flex-1 disabled:opacity-30 disabled:cursor-not-allowed">
            ← Previous
          </SecondaryButton>
          <PrimaryButton onClick={goNext} className="flex-1">
            {isLastPage ? 'Finish Story 🎉' : 'Next →'}
          </PrimaryButton>
        </div>
      </div>
    );
  }

  // ── PHASE: FINISH ─────────────────────────────────────────────────────────
  if (phase === PHASE.FINISH && activeStory) {
    return (
      <div className="space-y-4">
        <KidsGlassCard className="p-6 text-center space-y-4">
          <p className="text-[44px]" aria-hidden="true">🎊</p>
          <h3 className="text-[18px] font-extrabold text-on-surface font-display">You finished the story!</h3>
          <p className="text-[13px] font-semibold text-on-surface-variant italic font-body">"{activeStory.title}"</p>
          <div className="rounded-xl px-4 py-3" style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.28)' }}>
            <p className="text-[10px] text-amber-600 font-bold uppercase tracking-[0.12em] mb-1 font-display">Today's healthy habit</p>
            <p className="text-[13px] font-bold text-amber-800 font-display">{activeStory.moral}</p>
          </div>
          <div className="rounded-xl px-4 py-2" style={{ background: 'rgba(22,163,74,0.09)', border: '1px solid rgba(22,163,74,0.22)' }}>
            <p className="text-[13px] font-bold text-green-700">+{activeStory.xpReward} XP earned! 🌟</p>
          </div>
        </KidsGlassCard>
        <div className="space-y-2">
          <PrimaryButton onClick={returnToList} className="w-full">Read Another Story 📖</PrimaryButton>
          <button onClick={onBack} className="w-full py-2.5 text-[13px] text-on-surface-variant font-body hover:text-on-surface transition-colors">Back to Kids Zone</button>
        </div>
      </div>
    );
  }

  return null;
};

export default HealthStory;
