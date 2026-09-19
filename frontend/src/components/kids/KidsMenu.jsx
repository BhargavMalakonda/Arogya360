/**
 * KidsMenu.jsx
 *
 * The four-card hub for Kids Zone.
 * Each card calls onSelect(moduleId) to switch the active module in KidsZone.jsx.
 * Uses only local data — no Gemini, no Firestore, no backend.
 *
 * Props:
 *   onSelect {function} — called with one of: 'game' | 'quiz' | 'story' | 'activity'
 */

import React from 'react';
import LottieAnimation from './LottieAnimation';

const MENU_ITEMS = [
  {
    id: 'game',
    label: 'Health Games',
    emoji: '🎮',
    description: 'Play and learn healthy habits',
    cardBg: 'rgba(239,246,255,0.90)',
    cardBorder: 'rgba(59,130,246,0.28)',
    iconBg: 'rgba(59,130,246,0.12)',
    accentColor: '#2563EB',
    hoverShadow: '0 8px 24px rgba(59,130,246,0.18)',
  },
  {
    id: 'quiz',
    label: 'Health Quizzes',
    emoji: '🧠',
    description: 'Test your health knowledge',
    cardBg: 'rgba(255,251,235,0.90)',
    cardBorder: 'rgba(234,179,8,0.30)',
    iconBg: 'rgba(234,179,8,0.12)',
    accentColor: '#B45309',
    hoverShadow: '0 8px 24px rgba(234,179,8,0.18)',
  },
  {
    id: 'story',
    label: 'Health Stories',
    emoji: '📖',
    description: 'Read fun healthy stories',
    cardBg: 'rgba(240,253,244,0.90)',
    cardBorder: 'rgba(22,163,74,0.28)',
    iconBg: 'rgba(22,163,74,0.12)',
    accentColor: '#15803D',
    hoverShadow: '0 8px 24px rgba(22,163,74,0.16)',
  },
  {
    id: 'activity',
    label: 'Daily Activities',
    emoji: '🌟',
    description: 'Check off healthy habits',
    cardBg: 'rgba(255,241,242,0.90)',
    cardBorder: 'rgba(244,63,94,0.28)',
    iconBg: 'rgba(244,63,94,0.12)',
    accentColor: '#BE123C',
    hoverShadow: '0 8px 24px rgba(244,63,94,0.16)',
  },
];

const KidsMenu = ({ onSelect }) => {
  return (
    <div className="space-y-5">
      {/* Hero mascot */}
      <div className="flex justify-center py-2">
        <LottieAnimation animationKey="hero" size="w-16 h-16" />
      </div>

      <p className="text-center text-[13px] text-on-surface-variant font-body -mt-2">
        Choose something fun to do!
      </p>

      {/* 2×2 module grid */}
      <div className="grid grid-cols-2 gap-4">
        {MENU_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className="flex flex-col items-center gap-3 p-5 text-center active:scale-95 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-indigo/50 rounded-[20px]"
            style={{
              background: item.cardBg,
              backdropFilter: 'blur(16px) saturate(160%)',
              WebkitBackdropFilter: 'blur(16px) saturate(160%)',
              border: `2px solid ${item.cardBorder}`,
              borderRadius: '20px',
              boxShadow: '0 4px 16px rgba(30,31,59,0.06)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = item.hoverShadow; e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(30,31,59,0.06)'; e.currentTarget.style.transform = ''; }}
            aria-label={`Open ${item.label}`}
          >
            {/* Emoji in tinted circle */}
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ background: item.iconBg }}
            >
              <span className="text-3xl leading-none" aria-hidden="true">
                {item.emoji}
              </span>
            </div>
            <span className="text-[13px] font-bold leading-tight font-display" style={{ color: item.accentColor }}>
              {item.label}
            </span>
            <span className="text-[11px] text-on-surface-variant font-body leading-snug">
              {item.description}
            </span>
          </button>
        ))}
      </div>

      <p className="text-center text-[11px] text-on-surface-variant/55 font-body pt-1">
        Tap a card to start ↑
      </p>
    </div>
  );
};

export default KidsMenu;
