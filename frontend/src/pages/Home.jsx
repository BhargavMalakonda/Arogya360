/**
 * Home.jsx — Arogya360 Home Page
 *
 * Visual reference: frontend/src/assets/ui-reference/Home_reference.png
 *
 * Layout (top → bottom):
 *   1. FollowUpBanner  (Firestore, unchanged)
 *   2. Greeting row    ← left: Good Morning / Hello {name} / subtitle
 *                      ← right: Smarter Care clickable card
 *   3. Assessment card (navigates to /triage, unchanged)
 *   4. Bottom row      ← Community Insights card (real data, View Insights → modal)
 *                      ← Find Care Nearby card  (existing loadNearbyCare / FacilityList)
 *
 * Modals (two only):
 *   • SmarterCareModal  — triggered by Smarter Care card
 *   • InsightsModal     — triggered by "View Insights →" button
 *
 * Removed from this page:
 *   • DailyHealthCard (Stay Healthy / Daily Wellness Guide section)
 *
 * All data-fetching, Firebase, auth and navigation logic is UNCHANGED.
 * DO NOT modify AuthContext, firebase.js, or backend.
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import FollowUpBanner from '../components/FollowUpBanner';
import { auth } from '../lib/firebase';
import findCareImg from '../assets/ui-reference/Find_care.png';
// Reuse existing daily content data — same source as DailyHealthCard.jsx
import dailyContent from '../data/dailyContent.json';

const API_BASE = import.meta.env.VITE_API_BASE_URL;

// ═══════════════════════════════════════════════════════════════════════════════
// ICONS  (all inline SVG, no external dep)
// ═══════════════════════════════════════════════════════════════════════════════

const IcArrow = ({ className = 'w-4 h-4' }) => (
  <svg viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IcChevronRight = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IcX = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const IcShield = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    <path d="m9 12 2 2 4-4"/>
  </svg>
);
const IcZap = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
);
const IcUser = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
  </svg>
);
const IcHeart = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
  </svg>
);
const IcRobot = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="8" width="18" height="12" rx="2"/>
    <path d="M9 8V6a3 3 0 0 1 6 0v2"/>
    <circle cx="9" cy="14" r="1.5" fill="currentColor"/>
    <circle cx="15" cy="14" r="1.5" fill="currentColor"/>
    <path d="M8 18h8"/>
  </svg>
);
const IcUsers = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);
const IcBarChart = () => (
  <svg viewBox="0 0 20 20" fill="none" className="w-5 h-5" aria-hidden="true">
    <rect x="2" y="11" width="4" height="7" rx="1" fill="currentColor" opacity="0.55"/>
    <rect x="8" y="6" width="4" height="12" rx="1" fill="currentColor"/>
    <rect x="14" y="3" width="4" height="15" rx="1" fill="currentColor" opacity="0.40"/>
  </svg>
);
const IcLocation = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
    <circle cx="12" cy="9" r="2.5"/>
  </svg>
);
const IcStethoscope = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4.5 6.5a4 4 0 0 0 7.5 2"/>
    <path d="M4.5 6.5C4.5 4 6 2 8 2s3.5 2 3.5 4.5"/>
    <path d="M12 8.5c0 4.5 3 7.5 6 7.5a4 4 0 0 0 4-4v-1.5"/>
    <circle cx="22" cy="11" r="1.5" fill="currentColor" stroke="none"/>
  </svg>
);
const IcTrendUp = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
    <polyline points="17 6 23 6 23 12"/>
  </svg>
);
const IcDocument = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="9" y1="13" x2="15" y2="13"/>
    <line x1="9" y1="17" x2="13" y2="17"/>
  </svg>
);
const IcAlert = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);
const IcLeaf = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 22c1.25-4.5 4-8 10-10 3-1 6-1 10-1-1 4-3 7-6 9-4 2-8 2-14 2z"/>
    <path d="M12 12 2 22"/>
  </svg>
);
const IcInfo = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);
const IcCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

// Daily Wellness icons (same as DailyHealthCard.jsx)
const IcSun = () => (
  <svg viewBox="0 0 18 18" fill="none" className="w-4 h-4" aria-hidden="true">
    <path d="M9 1.5v2M9 14.5v2M1.5 9h2M14.5 9h2M3.7 3.7l1.4 1.4M12.9 12.9l1.4 1.4M3.7 14.3l1.4-1.4M12.9 5.1l1.4-1.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    <circle cx="9" cy="9" r="2.75" stroke="currentColor" strokeWidth="1.4"/>
  </svg>
);
const IcGoal = () => (
  <svg viewBox="0 0 18 18" fill="none" className="w-4 h-4 flex-shrink-0" aria-hidden="true">
    <circle cx="9" cy="9" r="7.5" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="9" cy="9" r="3.5" stroke="currentColor" strokeWidth="1.5"/>
    <circle cx="9" cy="9" r="1" fill="currentColor"/>
  </svg>
);
const IcFact = () => (
  <svg viewBox="0 0 18 18" fill="none" className="w-4 h-4 flex-shrink-0" aria-hidden="true">
    <circle cx="9" cy="9" r="7.5" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M9 7.5v5M9 5.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
const IcTip = () => (
  <svg viewBox="0 0 18 18" fill="none" className="w-4 h-4 flex-shrink-0" aria-hidden="true">
    <path d="M9 2a5 5 0 0 1 2.5 9.33V13H6.5v-1.67A5 5 0 0 1 9 2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
    <path d="M7 15h4M7.5 17h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);

// ═══════════════════════════════════════════════════════════════════════════════
// GREETING HELPER
// ═══════════════════════════════════════════════════════════════════════════════

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

// ═══════════════════════════════════════════════════════════════════════════════
// GLASS CARD SHELL
// ═══════════════════════════════════════════════════════════════════════════════

const GlassCard = ({ children, className = '', style = {}, onClick }) => (
  <div
    onClick={onClick}
    className={className}
    style={{
      background: 'rgba(255,255,255,0.88)',
      backdropFilter: 'blur(20px) saturate(170%)',
      WebkitBackdropFilter: 'blur(20px) saturate(170%)',
      border: '1px solid rgba(255,255,255,0.92)',
      borderRadius: '20px',
      boxShadow: '0 8px 32px rgba(88,86,214,0.07), 0 2px 8px rgba(30,31,59,0.04)',
      ...style,
    }}
  >
    {children}
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// PRIMARY CTA BUTTON
// ═══════════════════════════════════════════════════════════════════════════════

const PrimaryBtn = ({ onClick, children, className = '' }) => (
  <button
    type="button"
    onClick={onClick}
    className={[
      'inline-flex items-center justify-center gap-2',
      'px-5 py-2.5 rounded-xl',
      'text-[13px] font-semibold text-white',
      'bg-gradient-to-r from-[#706DF2] to-[#5856D6]',
      'shadow-[0_4px_14px_rgba(88,86,214,0.32)]',
      'hover:shadow-[0_6px_18px_rgba(88,86,214,0.42)] hover:opacity-95',
      'active:scale-[0.98]',
      'transition-all duration-150',
      'focus:outline-none focus:ring-2 focus:ring-brand-indigo focus:ring-offset-1',
      'disabled:opacity-50 disabled:cursor-not-allowed',
      className,
    ].join(' ')}
  >
    {children}
  </button>
);

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL OVERLAY — light blur+dim backdrop, popup panel stays sharp
// ═══════════════════════════════════════════════════════════════════════════════

const FloatingPopup = ({ onClose, children, maxWidth = '420px' }) => {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    // Fixed full-viewport container — captures pointer events (blocks clicks through)
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop — blur + dim, click closes popup */}
      <div
        className="absolute inset-0"
        onClick={onClose}
        style={{
          background: '#5856D6)',
          backdropFilter: 'blur(5px)',
          WebkitBackdropFilter: 'blur(5px)',
        }}
        aria-hidden="true"
      />

      {/* Popup panel — sharp, above backdrop */}
      <div
        className="relative z-10 w-full"
        style={{ maxWidth }}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// DAILY WELLNESS MODAL
// Reuses the same dailyContent.json data source as DailyHealthCard.jsx.
// No duplicate logic — todayIndex picks the same day-of-week entry.
// ═══════════════════════════════════════════════════════════════════════════════

const todayIndex = new Date().getDay(); // 0=Sun … 6=Sat — same as DailyHealthCard.jsx

const WellnessModal = ({ onClose }) => {
  const goal = dailyContent.goals[todayIndex];
  const fact = dailyContent.facts[todayIndex];
  const tip  = dailyContent.tips[todayIndex];

  const Row = ({ icon, labelText, labelColor, labelBg, text }) => (
    <div className="flex gap-3">
      <div
        className="mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: labelBg, color: labelColor }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <span
          className="inline-block text-[10px] font-bold tracking-[0.12em] uppercase px-2 py-0.5 rounded-full mb-1.5 font-display"
          style={{ background: labelBg, color: labelColor }}
        >
          {labelText}
        </span>
        <p className="text-[13px] text-on-surface font-body leading-relaxed">{text}</p>
      </div>
    </div>
  );

  return (
    <FloatingPopup onClose={onClose} maxWidth="500px">
      <div
        style={{
          background: 'rgba(255,255,255,0.98)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderRadius: '24px',
          boxShadow: '0 24px 64px rgba(30,31,59,0.22), 0 4px 16px rgba(88,86,214,0.12)',
          border: '1px solid rgba(255,255,255,0.95)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-3">
          <div>
            <p className="text-[10px] font-bold tracking-[0.16em] uppercase text-brand-indigo/70 mb-0.5 font-display">
              Today's Health
            </p>
            <h2 className="text-[18px] font-bold text-on-surface font-display leading-tight">
              Daily Wellness Guide
            </h2>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center text-brand-indigo"
              style={{ background: 'rgba(88,86,214,0.08)', border: '1px solid rgba(88,86,214,0.12)' }}
              aria-hidden="true"
            >
              <IcSun />
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="text-outline hover:text-on-surface transition-colors focus:outline-none focus:ring-2 focus:ring-brand-indigo rounded-lg p-1"
            >
              <IcX />
            </button>
          </div>
        </div>

        {/* Content rows */}
        <div className="px-6 pb-2 space-y-4">
          <Row
            icon={<IcGoal />}
            labelText="Today's Goal"
            labelColor="#5856D6"
            labelBg="rgba(88,86,214,0.10)"
            text={goal}
          />
          <div style={{ borderTop: '1px solid rgba(88,86,214,0.07)' }} />
          <Row
            icon={<IcFact />}
            labelText="Health Fact"
            labelColor="#0E9F6E"
            labelBg="rgba(14,159,110,0.10)"
            text={fact}
          />
          <div style={{ borderTop: '1px solid rgba(88,86,214,0.07)' }} />
          <Row
            icon={<IcTip />}
            labelText="Preventive Tip"
            labelColor="#D97706"
            labelBg="rgba(217,119,6,0.10)"
            text={tip}
          />
        </div>

        {/* Disclaimer */}
        <p
          className="text-[11px] text-on-surface-variant/50 font-body mx-6 mt-3 mb-5 pt-3 leading-snug"
          style={{ borderTop: '1px solid rgba(0,0,0,0.04)' }}
        >
          Guidance based on WHO &amp; ICMR preventive-health guidelines. Not a substitute for medical advice.
        </p>
      </div>
    </FloatingPopup>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// POPUP 1 — SMARTER CARE MODAL
// ═══════════════════════════════════════════════════════════════════════════════

const SmarterCareModal = ({ onClose }) => (
  <FloatingPopup onClose={onClose} maxWidth="440px">
    <div
      style={{
        background: 'rgba(255,255,255,0.98)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderRadius: '24px',
        boxShadow: '0 24px 64px rgba(30,31,59,0.22), 0 4px 16px rgba(88,86,214,0.12)',
        border: '1px solid rgba(255,255,255,0.95)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(88,86,214,0.10)', color: '#5856D6' }}>
            <IcHeart />
          </div>
          <div>
            <h2 className="text-[17px] font-bold text-on-surface font-display leading-snug">
              Smarter care for a healthier you
            </h2>
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Close"
          className="flex-shrink-0 text-outline hover:text-on-surface transition-colors focus:outline-none focus:ring-2 focus:ring-brand-indigo rounded-lg p-1 mt-0.5">
          <IcX />
        </button>
      </div>

      {/* Subtitle */}
      <p className="px-6 pb-4 text-[13px] text-on-surface-variant leading-relaxed">
        Arogya360 combines community insights, expert guidance, and AI to help you make better
        health decisions — every day, for a brighter tomorrow.
      </p>

      {/* 2×2 feature grid */}
      <div className="grid grid-cols-2 gap-3 px-6 pb-4">
        {[
          { icon: <IcRobot />, color: '#5856D6', bg: '#EEF0FF', title: 'AI-Powered Guidance',    desc: 'Get instant, reliable health information' },
          { icon: <IcUsers />, color: '#0060AC', bg: '#E6F0FF', title: 'Community Insights',     desc: 'See what\'s trending in your area' },
          { icon: <IcShield />, color: '#5856D6', bg: '#EEF0FF', title: 'Trusted & Secure',      desc: 'Your data stays private and safe' },
          { icon: <IcHeart />,  color: '#E5484D', bg: '#FEF0F0', title: 'Better Outcomes',       desc: 'Small steps lead to healthier communities' },
        ].map(f => (
          <div key={f.title}
            className="flex items-start gap-3 p-3 rounded-2xl"
            style={{ background: 'rgba(248,248,255,0.80)', border: '1px solid rgba(200,200,230,0.30)' }}>
            <div className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: f.bg, color: f.color }}>
              {f.icon}
            </div>
            <div>
              <p className="text-[12px] font-bold text-on-surface leading-snug mb-0.5">{f.title}</p>
              <p className="text-[11px] text-on-surface-variant leading-snug">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Got it button */}
      <div className="px-6 pb-6">
        <PrimaryBtn onClick={onClose} className="w-full py-3 text-[14px]">
          Got it
        </PrimaryBtn>
      </div>
    </div>
  </FloatingPopup>
);

// ═══════════════════════════════════════════════════════════════════════════════
// POPUP 2 — COMMUNITY INSIGHTS MODAL
// Uses real data passed as props from the card
// ═══════════════════════════════════════════════════════════════════════════════

const InsightsModal = ({ onClose, pincode, insights, loading, error }) => {
  // Derive stay-healthy tips from real insights data (mirrors CommunityInsight.jsx logic)
  const stayHealthyFraming = (() => {
    if (!insights) return null;
    for (const row of insights) {
      if (typeof row.prevention_framing === 'string' && row.prevention_framing.trim())
        return row.prevention_framing.trim();
    }
    return null;
  })();

  const allTips = (() => {
    if (!insights) return [];
    const seen = new Set();
    const tips = [];
    for (const row of insights) {
      if (!Array.isArray(row.prevention_tips)) continue;
      for (const tip of row.prevention_tips) {
        if (typeof tip === 'string' && tip.trim() && !seen.has(tip.trim()) && tips.length < 5) {
          seen.add(tip.trim());
          tips.push(tip.trim());
        }
      }
    }
    return tips;
  })();

  const totalReports = insights?.reduce((s, r) => s + (r.count_last_7_days || 0), 0) ?? 0;
  const activeSymptoms = insights?.length ?? 0;
  const mostCommon = insights?.map(r => r.display_label).filter(Boolean).join(', ') || '—';

  return (
    <FloatingPopup onClose={onClose} maxWidth="440px">
      <div
        style={{
          background: 'rgba(255,255,255,0.98)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderRadius: '24px',
          boxShadow: '0 24px 64px rgba(30,31,59,0.22), 0 4px 16px rgba(88,86,214,0.12)',
          border: '1px solid rgba(255,255,255,0.95)',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-6 pt-5 pb-3 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(88,86,214,0.10)', color: '#5856D6' }}>
              <IcBarChart />
            </div>
            <div>
              <h2 className="text-[16px] font-bold text-on-surface font-display leading-none">
                Community Insights
                {pincode && (
                  <span className="ml-1.5 text-brand-indigo font-bold">· {pincode}</span>
                )}
              </h2>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="flex-shrink-0 text-outline hover:text-on-surface transition-colors focus:outline-none focus:ring-2 focus:ring-brand-indigo rounded-lg p-1">
            <IcX />
          </button>
        </div>

        {/* Period label */}
        <p className="px-6 pb-3 text-right text-[11px] text-outline font-medium flex-shrink-0">
          Last 7 days
        </p>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-4" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(88,86,214,0.2) transparent' }}>

          {loading && (
            <div className="space-y-2 py-4">
              {[1,2,3].map(i => <div key={i} className="h-10 rounded-xl bg-surface-container animate-pulse"/>)}
            </div>
          )}

          {error && !loading && (
            <p className="text-[13px] text-esi-emergency py-4">{error}</p>
          )}

          {!loading && !error && (
            <>
              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3">
                {/* Total Reports */}
                <div className="flex flex-col gap-1 p-3 rounded-2xl"
                  style={{ background: 'rgba(248,248,255,0.80)', border: '1px solid rgba(200,200,230,0.30)' }}>
                  <div className="flex items-center gap-1 text-brand-indigo">
                    <IcTrendUp />
                    <span className="text-[20px] font-extrabold text-on-surface font-display leading-none tabular-nums">
                      {totalReports.toLocaleString()}
                    </span>
                  </div>
                  <p className="text-[10px] text-outline font-medium">Total Reports</p>
                </div>

                {/* Active Symptoms */}
                <div className="flex flex-col gap-1 p-3 rounded-2xl"
                  style={{ background: 'rgba(248,248,255,0.80)', border: '1px solid rgba(200,200,230,0.30)' }}>
                  <div className="flex items-center gap-1 text-emerald-600">
                    <IcDocument />
                    <span className="text-[20px] font-extrabold text-on-surface font-display leading-none tabular-nums">
                      {activeSymptoms}
                    </span>
                  </div>
                  <p className="text-[10px] text-outline font-medium">Active Symptoms</p>
                </div>

                {/* Risk Alerts placeholder — shown only when backend returns */}
                <div className="flex flex-col gap-1 p-3 rounded-2xl"
                  style={{ background: 'rgba(255,246,246,0.90)', border: '1px solid rgba(229,72,77,0.15)' }}>
                  <div className="flex items-center gap-1 text-esi-emergency">
                    <IcAlert />
                    <span className="text-[20px] font-extrabold text-on-surface font-display leading-none tabular-nums">
                      {/* Risk alerts not in current API — show 0 */}
                      0
                    </span>
                  </div>
                  <p className="text-[10px] text-outline font-medium">Risk Alerts</p>
                </div>
              </div>

              {/* Most common */}
              {mostCommon !== '—' && (
                <p className="text-[13px] text-on-surface">
                  Most common: <span className="font-semibold">{mostCommon}</span>
                </p>
              )}

              {insights?.length === 0 && (
                <p className="text-[13px] text-on-surface-variant py-2">
                  Limited community activity data available in your area.
                </p>
              )}

              {/* Stay Healthy section */}
              {stayHealthyFraming && allTips.length > 0 && (
                <div className="space-y-3">
                  {/* Section header */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-emerald-600"><IcLeaf /></span>
                    <p className="text-[11px] font-bold tracking-[0.14em] uppercase text-emerald-600">
                      Stay Healthy
                    </p>
                  </div>

                  {/* Framing text */}
                  <p className="text-[13px] text-on-surface-variant leading-relaxed">
                    {stayHealthyFraming}
                  </p>

                  {/* Tips */}
                  <div className="space-y-2.5">
                    {allTips.map((tip, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <div className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5"
                          style={{ background: 'rgba(22,163,74,0.12)', color: '#16A34A' }}>
                          <IcCheck />
                        </div>
                        <p className="text-[12px] text-on-surface-variant leading-relaxed">{tip}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Privacy disclaimer */}
              <div className="flex items-start gap-2 p-3 rounded-xl"
                style={{ background: 'rgba(88,86,214,0.05)', border: '1px solid rgba(88,86,214,0.12)' }}>
                <span className="flex-shrink-0 text-brand-indigo/60 mt-0.5"><IcInfo /></span>
                <p className="text-[11px] text-on-surface-variant/80 leading-relaxed">
                  This information is based on anonymised, aggregated data from your area and is
                  for general guidance only. Not a substitute for medical advice.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Close button */}
        <div className="px-6 py-4 border-t border-outline-variant/20 flex-shrink-0">
          <button type="button" onClick={onClose}
            className="w-full py-2.5 rounded-xl text-[13px] font-semibold text-on-surface border border-outline-variant/50 bg-surface-container-low hover:bg-surface-container transition-colors focus:outline-none focus:ring-2 focus:ring-brand-indigo focus:ring-offset-1">
            Close
          </button>
        </div>
      </div>
    </FloatingPopup>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMMUNITY INSIGHTS CARD  (summary view, data fetched here)
// ═══════════════════════════════════════════════════════════════════════════════

const CommunityInsightsCard = () => {
  const [pincode, setPincode]     = useState(null);
  const [insights, setInsights]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Data fetch — same logic as CommunityInsight.jsx
  useEffect(() => {
    let cancelled = false;
    const fetchInsights = async () => {
      setLoading(true); setError(null);
      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) { setLoading(false); return; }
        const res = await fetch(`${API_BASE}/api/community/insights`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`Server error ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        setPincode(data.pincode || null);
        setInsights(data.insights || []);
      } catch (err) {
        if (!cancelled) setError('Could not load community data.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchInsights();
    return () => { cancelled = true; };
  }, []);

  const totalReports  = insights.reduce((s, r) => s + (r.count_last_7_days || 0), 0);
  const activeSymptoms = insights.length;
  const mostCommon    = insights.map(r => r.display_label).filter(Boolean).join(', ') || null;

  return (
    <>
      <GlassCard className="flex flex-col h-full">
        <div className="p-5">
          {/* Card header row */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(88,86,214,0.09)', color: '#5856D6' }}>
                <IcBarChart />
              </div>
              <div>
                <h3 className="text-[14px] font-bold text-on-surface font-display leading-tight">
                  Community Insights
                </h3>
                <p className="text-[11px] text-on-surface-variant mt-0.5">
                  See what's trending in your area.
                </p>
              </div>
            </div>
            <span className="text-[11px] text-outline font-medium whitespace-nowrap mt-0.5">
              Last 7 days
            </span>
          </div>

          {loading && (
            <div className="space-y-2 py-2">
              {[1,2].map(i => <div key={i} className="h-8 rounded-xl bg-surface-container animate-pulse"/>)}
            </div>
          )}

          {error && !loading && (
            <p className="text-[12px] text-esi-emergency py-1">{error}</p>
          )}

          {!loading && !error && (
            <>
              {/* Stats mini-row */}
              <div className="flex items-center gap-3 mb-3">
                {/* Total */}
                <div className="flex items-center gap-1.5 flex-1 p-2.5 rounded-xl"
                  style={{ background: 'rgba(88,86,214,0.05)', border: '1px solid rgba(88,86,214,0.10)' }}>
                  <span className="text-brand-indigo"><IcTrendUp /></span>
                  <div>
                    <p className="text-[16px] font-extrabold text-on-surface font-display leading-none tabular-nums">
                      {totalReports.toLocaleString()}
                    </p>
                    <p className="text-[9px] text-outline">Total Reports</p>
                  </div>
                </div>
                {/* Active */}
                <div className="flex items-center gap-1.5 flex-1 p-2.5 rounded-xl"
                  style={{ background: 'rgba(22,163,74,0.05)', border: '1px solid rgba(22,163,74,0.12)' }}>
                  <span className="text-emerald-600"><IcDocument /></span>
                  <div>
                    <p className="text-[16px] font-extrabold text-on-surface font-display leading-none tabular-nums">
                      {activeSymptoms}
                    </p>
                    <p className="text-[9px] text-outline">Active Symptoms</p>
                  </div>
                </div>
                {/* Risk */}
                <div className="flex items-center gap-1.5 flex-1 p-2.5 rounded-xl"
                  style={{ background: 'rgba(229,72,77,0.05)', border: '1px solid rgba(229,72,77,0.12)' }}>
                  <span className="text-esi-emergency"><IcAlert /></span>
                  <div>
                    <p className="text-[16px] font-extrabold text-on-surface font-display leading-none tabular-nums">0</p>
                    <p className="text-[9px] text-outline">Risk Alerts</p>
                  </div>
                </div>
              </div>

              {mostCommon && (
                <p className="text-[12px] text-on-surface mb-1">
                  Most common: <span className="font-medium">{mostCommon}</span>
                </p>
              )}
            </>
          )}
        </div>

        {/* Card footer with View Insights link */}
        <div className="px-5 pb-4 mt-auto">
          <div
            style={{ borderTop: '1px solid rgba(88,86,214,0.08)' }}
            className="pt-3 flex items-center justify-end"
          >
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-1 text-[12px] font-semibold text-brand-indigo hover:underline focus:outline-none"
            >
              View Insights <IcArrow className="w-3.5 h-3.5"/>
            </button>
          </div>
        </div>
      </GlassCard>

      {modalOpen && (
        <InsightsModal
          onClose={() => setModalOpen(false)}
          pincode={pincode}
          insights={insights}
          loading={loading}
          error={error}
        />
      )}
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// HOME COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const Home = () => {
  const { userProfile } = useAuth();
  const navigate = useNavigate();

  // Smarter Care modal state
  const [smarterCareOpen, setSmarterCareOpen] = useState(false);
  // Daily Wellness modal state
  const [wellnessOpen, setWellnessOpen] = useState(false);

  const firstName = userProfile?.name?.split(' ')[0] || 'there';
  const greeting  = getGreeting();

  return (
    <div className="w-full max-w-[860px] mx-auto px-4 md:px-5 pt-3 pb-28 space-y-4 page-enter">

      {/* ── Follow-up banner (Firestore, unchanged) ─────────────────── */}
      <FollowUpBanner />

      {/* ══════════════════════════════════════════════════════════════
          1. GREETING ROW
          ══════════════════════════════════════════════════════════════ */}
      {userProfile && (
        <div className="flex items-start justify-between gap-4 pt-2 pb-1 px-1">
          {/* Left: greeting */}
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold tracking-[0.16em] uppercase text-brand-indigo mb-1.5 font-display">
              {greeting}
            </p>
            <h1 className="text-[30px] md:text-[34px] font-extrabold text-on-surface leading-tight tracking-[-0.025em] font-display mb-2">
              Hello, {firstName}&nbsp;👋
            </h1>
            <p className="text-[13px] text-on-surface-variant font-body leading-relaxed max-w-[420px]">
              Welcome to Arogya360. Start your symptom assessment to get personalized health guidance.
            </p>
            {/* Daily Wellness trigger — subtle chip below greeting text */}
          </div>

          {/* Right: Smarter Care clickable card */}
          <button
            type="button"
            onClick={() => setWellnessOpen(true)}
            aria-label="Learn about Smarter Care"
            className="hidden sm:flex flex-shrink-0 items-center gap-3 px-4 py-3 rounded-2xl cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-indigo/40 transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: 'rgba(255,255,255,0.88)',
              backdropFilter: 'blur(20px) saturate(170%)',
              WebkitBackdropFilter: 'blur(20px) saturate(170%)',
              border: '1px solid rgba(255,255,255,0.92)',
              borderRadius: '20px',
              boxShadow: '0 6px 20px rgba(88,86,214,0.09)',
              width: '190px',
            }}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(88,86,214,0.10)', color: '#5856D6' }}>
              <IcHeart />
            </div>
            <div className="text-left flex-1 min-w-0">
              <p className="text-[13px] font-bold text-on-surface font-display leading-tight">Smarter care</p>
              <p className="text-[11px] text-on-surface-variant leading-tight">for a healthier you</p>
            </div>
            <span className="text-outline/60 flex-shrink-0"><IcChevronRight /></span>
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          2. ASSESSMENT CARD
          ══════════════════════════════════════════════════════════════ */}
      <GlassCard>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 px-6 py-5">
          {/* Icon */}
          <div className="flex-shrink-0 hidden sm:flex w-14 h-14 rounded-2xl items-center justify-center"
            style={{ background: 'rgba(88,86,214,0.08)', border: '1px solid rgba(88,86,214,0.13)', color: '#5856D6' }}>
            <IcStethoscope />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h2 className="text-[20px] md:text-[22px] font-bold text-on-surface font-display leading-tight mb-1">
              Start Your Symptom Assessment
            </h2>
            <p className="text-[13px] text-on-surface-variant font-body leading-relaxed mb-4">
              Answer a few simple questions about your symptoms to get personalized health guidance.
            </p>

            {/* CTA — navigate('/triage') UNCHANGED */}
            <PrimaryBtn onClick={() => navigate('/triage')} className="px-6 py-2.5">
              Start Symptom Assessment
              <IcArrow />
            </PrimaryBtn>
          </div>
        </div>

        {/* Feature row — 3 items */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 px-6 pb-5 pt-1">
          {[
            { Icon: IcShield, color: '#5856D6', bg: '#EEF0FF', title: 'Private & Secure',       sub: 'Your data stays confidential' },
            { Icon: IcZap,    color: '#059669', bg: '#ECFDF5', title: 'Quick & Easy',            sub: 'Takes only a few minutes'     },
            { Icon: IcUser,   color: '#0060AC', bg: '#E6F0FF', title: 'Personalized Guidance',   sub: 'Tailored to your needs'        },
          ].map(({ Icon, color, bg, title, sub }) => (
            <div key={title} className="flex items-center gap-3 p-3 rounded-xl"
              style={{ background: 'rgba(248,248,255,0.65)', border: '1px solid rgba(200,200,230,0.25)' }}>
              <div className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
                style={{ background: bg, color }}>
                <Icon />
              </div>
              <div>
                <p className="text-[12px] font-bold text-on-surface font-display leading-tight">{title}</p>
                <p className="text-[11px] text-on-surface-variant leading-snug">{sub}</p>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* ══════════════════════════════════════════════════════════════
          3. BOTTOM ROW: Community Insights | Find Care
          ══════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Community Insights card (with modal) */}
        <CommunityInsightsCard />

        {/* Find Care Nearby — image-only card, button navigates to /find-care */}
        <GlassCard style={{ padding: 0, overflow: 'hidden' }}>
          {/* Relative container — image + button overlay are siblings */}
          <div className="relative w-full">
            <img
              src={findCareImg}
              alt="Find Care Nearby — map showing clinics, hospitals and pharmacies"
              style={{
                display: 'block',
                width: '100%',
                height: '100%',
                minHeight: '240px',
                maxHeight: '340px',
                objectFit: 'cover',
                objectPosition: 'center',
                borderRadius: '20px',
              }}
            />
            {/* Gradient scrim — fades from card-bg at bottom to transparent */}
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '20px',
                background: 'linear-gradient(to top, rgba(238,240,255,0.80) 0%, rgba(238,240,255,0.30) 40%, transparent 70%)',
                pointerEvents: 'none',
              }}
            />
            {/* Button — lower-right, absolutely positioned over the image */}
            <div
              style={{
                position: 'absolute',
                bottom: '60px',
                right: '220px',
              }}
            >
              <PrimaryBtn
                onClick={() => navigate('/find-care')}
                className="shadow-[0_6px_20px_rgba(88,86,214,0.45)] whitespace-nowrap"
              >
                Find Care Now <IcArrow />
              </PrimaryBtn>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* ── Smarter Care modal ─────────────────────────────────────────── */}
      {smarterCareOpen && (
        <SmarterCareModal onClose={() => setSmarterCareOpen(false)} />
      )}

      {/* ── Daily Wellness modal ───────────────────────────────────────── */}
      {wellnessOpen && (
        <WellnessModal onClose={() => setWellnessOpen(false)} />
      )}
    </div>
  );
};

export default Home;
