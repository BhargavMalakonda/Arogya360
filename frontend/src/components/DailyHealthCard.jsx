/**
 * DailyHealthCard.jsx
 *
 * CONTENT SOURCE: src/data/dailyContent.json -- a curated STATIC content set.
 * Intentionally NOT LLM-generated, for three reasons:
 *   1. Zero API cost / latency on every Home page load.
 *   2. Content is hand-authored against WHO/ICMR preventive-health guidelines
 *      and human-reviewed -- no risk of the model producing numeric targets,
 *      medication names, or diagnostic claims in a patient-facing UI.
 *   3. Day-of-week selection is deterministic (new Date().getDay()) so the
 *      card is stable across refreshes during a demo or live review.
 *
 * To update content, edit src/data/dailyContent.json directly.
 */

import React from 'react';
import CardContainer from './CardContainer';
import dailyContent from '../data/dailyContent.json';

// Day-of-week selector (0 = Sunday ... 6 = Saturday).
// Deterministic -- same index all day, no randomisation.
const todayIndex = new Date().getDay();
const todayGoal  = dailyContent.goals[todayIndex];
const todayFact  = dailyContent.facts[todayIndex];
const todayTip   = dailyContent.tips[todayIndex];

// --- Inline SVG icons (decorative, aria-hidden) ---
const GoalIcon = () => (
  <svg viewBox="0 0 18 18" fill="none" className="w-4 h-4 flex-shrink-0" aria-hidden="true">
    <circle cx="9" cy="9" r="7.5" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="9" cy="9" r="3.5" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="9" cy="9" r="1"   fill="currentColor" />
  </svg>
);

const FactIcon = () => (
  <svg viewBox="0 0 18 18" fill="none" className="w-4 h-4 flex-shrink-0" aria-hidden="true">
    <circle cx="9" cy="9" r="7.5" stroke="currentColor" strokeWidth="1.5" />
    <path d="M9 7.5v5M9 5.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const TipIcon = () => (
  <svg viewBox="0 0 18 18" fill="none" className="w-4 h-4 flex-shrink-0" aria-hidden="true">
    <path d="M9 2a5 5 0 0 1 2.5 9.33V13H6.5v-1.67A5 5 0 0 1 9 2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    <path d="M7 15h4M7.5 17h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

// Single labelled row: coloured icon square + label pill + body text
const Row = ({ icon, label, color, text }) => (
  <div className="flex gap-3">
    <div
      className="mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
      style={{ background: color + '18', color }}
    >
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <span
        className="inline-block text-[10px] font-bold tracking-[0.12em] uppercase px-2 py-0.5 rounded-full mb-1 font-display"
        style={{ background: color + '12', color }}
      >
        {label}
      </span>
      <p className="text-[13px] text-on-surface font-body leading-relaxed">{text}</p>
    </div>
  </div>
);

const DailyHealthCard = () => (
  <CardContainer>

    {/* Header */}
    <div className="flex items-center justify-between mb-4">
      <div>
        <p className="text-[10px] font-semibold tracking-[0.14em] uppercase text-brand-indigo/65 mb-0.5 font-display">
          Today&#8217;s Health
        </p>
        <h2 className="text-[15px] font-bold text-on-surface font-display leading-tight">
          Daily Wellness Guide
        </h2>
      </div>
      {/* Sun icon */}
      <div
        className="w-8 h-8 rounded-xl flex items-center justify-center"
        style={{ background: 'rgba(88,86,214,0.08)', border: '1px solid rgba(88,86,214,0.12)' }}
        aria-hidden="true"
      >
        <svg viewBox="0 0 18 18" fill="none" className="w-4 h-4 text-brand-indigo" aria-hidden="true">
          <path d="M9 1.5v2M9 14.5v2M1.5 9h2M14.5 9h2M3.7 3.7l1.4 1.4M12.9 12.9l1.4 1.4M3.7 14.3l1.4-1.4M12.9 5.1l1.4-1.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="9" cy="9" r="2.75" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      </div>
    </div>

    {/* Three content rows */}
    <div className="space-y-4">
      <Row
        icon={<GoalIcon />}
        label="Today's Goal"
        color="#5856D6"
        text={todayGoal}
      />
      <div style={{ borderTop: '1px solid rgba(88,86,214,0.07)' }} />
      <Row
        icon={<FactIcon />}
        label="Health Fact"
        color="#0E9F6E"
        text={todayFact}
      />
      <div style={{ borderTop: '1px solid rgba(88,86,214,0.07)' }} />
      <Row
        icon={<TipIcon />}
        label="Preventive Tip"
        color="#D97706"
        text={todayTip}
      />
    </div>

    {/* Footer disclaimer */}
    <p
      className="text-[11px] text-on-surface-variant/50 font-body mt-4 pt-3 leading-snug"
      style={{ borderTop: '1px solid rgba(0,0,0,0.04)' }}
    >
      Guidance based on WHO &amp; ICMR preventive-health guidelines. Not a substitute for medical advice.
    </p>

  </CardContainer>
);

export default DailyHealthCard;
