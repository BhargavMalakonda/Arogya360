/**
 * HistoryDetail.jsx
 *
 * Read-only view of a single completed assessment.
 * Module 2 explicit requirement: display ALL of the following fields —
 * do NOT show partial data:
 *   Initial Symptom, Risk Level, Symptom Category, Matched Symptoms,
 *   Recommendations, Prevention Tips, Follow Up Date,
 *   Knowledge Base Version, Assessment Version
 *
 * Stage 6: visual-only redesign. All Firestore logic, state, handlers,
 * field names, and navigation are UNCHANGED.
 */

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import SecondaryButton from '../components/SecondaryButton';
import PrimaryButton from '../components/PrimaryButton';
import DoctorSummaryPanel from '../components/DoctorSummaryPanel';

// ── Risk level display config — UNCHANGED ────────────────────────────────────
const RISK_CONFIG = {
  'ESI-1': {
    label: 'Emergency',
    badgeBg: 'bg-esi-emergency text-white',
    textClass: 'text-esi-emergency',
    iconBg: 'rgba(220,38,38,0.10)',
    iconBorder: 'rgba(220,38,38,0.25)',
    iconColor: '#B91C1C',
    pillBg: 'rgba(220,38,38,0.08)',
    pillBorder: 'rgba(220,38,38,0.22)',
    cardBg: 'rgba(254,242,242,0.80)',
    cardBorder: 'rgba(220,38,38,0.18)',
  },
  'ESI-2': {
    label: 'High Risk',
    badgeBg: 'bg-esi-emergency text-white',
    textClass: 'text-esi-emergency',
    iconBg: 'rgba(220,38,38,0.10)',
    iconBorder: 'rgba(220,38,38,0.25)',
    iconColor: '#B91C1C',
    pillBg: 'rgba(220,38,38,0.08)',
    pillBorder: 'rgba(220,38,38,0.22)',
    cardBg: 'rgba(254,242,242,0.80)',
    cardBorder: 'rgba(220,38,38,0.18)',
  },
  'ESI-3': {
    label: 'Moderate Risk',
    badgeBg: 'bg-esi-warning text-white',
    textClass: 'text-esi-warning',
    iconBg: 'rgba(245,158,11,0.10)',
    iconBorder: 'rgba(245,158,11,0.28)',
    iconColor: '#B45309',
    pillBg: 'rgba(245,158,11,0.08)',
    pillBorder: 'rgba(245,158,11,0.22)',
    cardBg: 'rgba(255,251,235,0.80)',
    cardBorder: 'rgba(245,158,11,0.18)',
  },
  'ESI-4': {
    label: 'Low Risk',
    badgeBg: 'bg-esi-success text-white',
    textClass: 'text-esi-success',
    iconBg: 'rgba(22,163,74,0.10)',
    iconBorder: 'rgba(22,163,74,0.28)',
    iconColor: '#15803D',
    pillBg: 'rgba(22,163,74,0.08)',
    pillBorder: 'rgba(22,163,74,0.22)',
    cardBg: 'rgba(240,253,244,0.85)',
    cardBorder: 'rgba(22,163,74,0.18)',
  },
  'ESI-5': {
    label: 'Non-Urgent',
    badgeBg: 'bg-esi-success text-white',
    textClass: 'text-esi-success',
    iconBg: 'rgba(22,163,74,0.10)',
    iconBorder: 'rgba(22,163,74,0.28)',
    iconColor: '#15803D',
    pillBg: 'rgba(22,163,74,0.08)',
    pillBorder: 'rgba(22,163,74,0.22)',
    cardBg: 'rgba(240,253,244,0.85)',
    cardBorder: 'rgba(22,163,74,0.18)',
  },
};
const DEFAULT_RISK = {
  label: 'Unknown',
  badgeBg: 'bg-gray-300 text-gray-700',
  textClass: 'text-gray-500',
  iconBg: 'rgba(100,116,139,0.10)',
  iconBorder: 'rgba(100,116,139,0.25)',
  iconColor: '#475569',
  pillBg: 'rgba(100,116,139,0.08)',
  pillBorder: 'rgba(100,116,139,0.20)',
  cardBg: 'rgba(248,250,252,0.88)',
  cardBorder: 'rgba(148,163,184,0.22)',
};

// formatDate — UNCHANGED logic
function formatDate(value) {
  if (!value) return '—';
  const d = value?.toDate ? value.toDate() : new Date(value);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatDateTime(value) {
  if (!value) return '—';
  const d = value?.toDate ? value.toDate() : new Date(value);
  return {
    date: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
    time: d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
  };
}

// ── Shared glass card ─────────────────────────────────────────────────────────
const glassStyle = {
  background: 'rgba(255,255,255,0.86)',
  backdropFilter: 'blur(22px) saturate(175%)',
  WebkitBackdropFilter: 'blur(22px) saturate(175%)',
  border: '1px solid rgba(255,255,255,0.92)',
  borderRadius: '18px',
  boxShadow: '0 4px 20px rgba(88,86,214,0.06), 0 1px 6px rgba(30,31,59,0.04)',
};

// ── Section card component ─────────────────────────────────────────────────────
const SectionCard = ({ icon, title, children, style = {} }) => (
  <div style={{ ...glassStyle, ...style }} className="flex items-start gap-4 px-5 py-5 md:px-6">
    {icon && (
      <div
        className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-brand-indigo"
        style={{ background: 'rgba(88,86,214,0.09)', border: '1.5px solid rgba(88,86,214,0.20)' }}
      >
        {icon}
      </div>
    )}
    <div className="flex-1 min-w-0">
      {title && (
        <h2 className="text-[15px] font-bold text-on-surface font-display mb-2 leading-tight">
          {title}
        </h2>
      )}
      {children}
    </div>
  </div>
);

// ── Inline SVG icons ──────────────────────────────────────────────────────────
const IconShield = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5" aria-hidden="true">
    <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
  </svg>
);
const IconSymptoms = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5" aria-hidden="true">
    <rect x="3" y="3" width="14" height="14" rx="3"/>
    <path d="M7 10h6M10 7v6" strokeLinecap="round"/>
  </svg>
);
const IconCondition = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5" aria-hidden="true">
    <circle cx="10" cy="10" r="7"/>
    <path d="M7.5 8.5C7.5 7.1 8.6 6 10 6s2.5 1.1 2.5 2.5c0 1.8-2.5 3-2.5 4.5M10 15.5v.5" strokeLinecap="round"/>
  </svg>
);
const IconRec = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5" aria-hidden="true">
    <rect x="3" y="3" width="14" height="14" rx="2"/>
    <path d="M7 8h6M7 12h4" strokeLinecap="round"/>
  </svg>
);
const IconPrevention = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5" aria-hidden="true">
    <path d="M10 2a6 6 0 00-3.819 10.602c.414.388.819.81.819 1.324V15a1 1 0 001 1h4a1 1 0 001-1v-1.074c0-.514.405-.936.819-1.324A6 6 0 0010 2zM8 16.5v.5a2 2 0 104 0v-.5H8z"/>
  </svg>
);
const IconFollowUp = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5" aria-hidden="true">
    <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd"/>
  </svg>
);
const IconGov = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5" aria-hidden="true">
    <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z"/>
  </svg>
);
const IconMeta = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5" aria-hidden="true">
    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
  </svg>
);
const IconCalendar = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5" aria-hidden="true">
    <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd"/>
  </svg>
);
const IconArrowLeft = () => (
  <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4" aria-hidden="true">
    <path d="M13 8H3M7 4L3 8l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconDownload = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true">
    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd"/>
  </svg>
);
const IconWhatsApp = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true">
    <path fillRule="evenodd" d="M10 0C4.477 0 0 4.477 0 10c0 1.763.463 3.42 1.27 4.86L0 20l5.29-1.24A9.953 9.953 0 0010 20c5.523 0 10-4.477 10-10S15.523 0 10 0zm5.05 14.28c-.21.59-1.24 1.13-1.71 1.2-.45.06-.97.09-1.57-.1-.36-.12-.83-.28-1.42-.54-2.49-1.08-4.12-3.59-4.25-3.76-.12-.17-.98-1.3-.98-2.48s.62-1.76.84-2c.21-.24.46-.3.62-.3h.44c.14 0 .34-.06.53.4l.68 1.65c.05.13.08.28.02.44l-.25.38-.37.42c-.12.13-.25.27-.11.53.14.26.63 1.04 1.35 1.68.93.83 1.71 1.09 1.97 1.21.26.12.41.1.56-.06l.41-.48c.18-.21.35-.14.59-.05l1.68.79c.24.11.39.17.45.27.06.1.06.56-.15 1.16z" clipRule="evenodd"/>
  </svg>
);

// ── Component ─────────────────────────────────────────────────────────────────
const HistoryDetail = () => {
  const { assessmentId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // ── State — UNCHANGED ──────────────────────────────────────────────────────
  const [assessment, setAssessment] = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');

  // ── Firestore fetch — UNCHANGED ────────────────────────────────────────────
  useEffect(() => {
    if (!assessmentId || !user) return;
    let cancelled = false;
    const fetchDetail = async () => {
      try {
        const snap = await getDoc(doc(db, 'assessments', assessmentId));
        if (cancelled) return;
        if (!snap.exists()) {
          setError('Assessment not found.');
        } else {
          const data = snap.data();
          if (data.uid !== user.uid) {
            setError('You do not have permission to view this assessment.');
          } else {
            setAssessment(data);
          }
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[HistoryDetail] Firestore error:', err);
          setError('Failed to load assessment details. Please try again.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchDetail();
    return () => { cancelled = true; };
  }, [assessmentId, user]);

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="w-full max-w-[860px] mx-auto px-4 md:px-6 pt-8 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-[18px] animate-pulse"
            style={{ background: 'rgba(255,255,255,0.30)' }} />
        ))}
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="w-full max-w-[860px] mx-auto px-4 md:px-6 pt-8">
        <div style={glassStyle} className="px-6 py-6">
          <p className="text-[13px] text-esi-emergency font-body mb-4">{error}</p>
          {/* navigate('/history') — UNCHANGED */}
          <SecondaryButton onClick={() => navigate('/history')} className="w-full">
            ← Back to History
          </SecondaryButton>
        </div>
      </div>
    );
  }

  if (!assessment) return null;

  const riskConfig = RISK_CONFIG[assessment.risk_level] || DEFAULT_RISK;
  const createdDT = formatDateTime(assessment.created_at);

  return (
    <div className="w-full max-w-[860px] mx-auto px-4 md:px-6 pt-6 pb-28 space-y-4 page-enter">

      {/* ── Page header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 pt-2 pb-1">
        <div>
          <h1 className="text-[26px] md:text-[30px] font-bold text-on-surface tracking-[-0.02em] font-display mb-1">
            Assessment Details
          </h1>
          <p className="text-[14px] text-on-surface-variant font-body">
            Here's the complete information from your assessment.
          </p>
        </div>

        {/* Assessment date card — top right */}
        <div
          style={{
            ...glassStyle,
            minWidth: '180px',
          }}
          className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
        >
          <div
            className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-brand-indigo"
            style={{ background: 'rgba(88,86,214,0.09)', border: '1.5px solid rgba(88,86,214,0.20)' }}
          >
            <IconCalendar />
          </div>
          <div>
            <p className="text-[10px] font-semibold tracking-[0.10em] uppercase text-on-surface-variant/60 font-display mb-0.5">
              Assessment Date
            </p>
            <p className="text-[13px] font-bold text-on-surface font-display leading-tight">
              {createdDT.date}
            </p>
            <p className="text-[11px] text-on-surface-variant font-body">
              {createdDT.time}
            </p>
          </div>
        </div>
      </div>

      {/* ── Assessment Result card (risk) ──────────────────────────────────── */}
      <div
        style={{
          ...glassStyle,
          background: riskConfig.cardBg,
          border: `1px solid ${riskConfig.cardBorder}`,
        }}
        className="px-5 py-5 md:px-6 md:py-6"
      >
        <div className="flex items-start gap-4">
          {/* Shield icon */}
          <div
            className="flex-shrink-0 w-12 h-12 rounded-[14px] flex items-center justify-center"
            style={{ background: riskConfig.iconBg, border: `1.5px solid ${riskConfig.iconBorder}`, color: riskConfig.iconColor }}
          >
            <IconShield />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-1">
              <p className="text-[11px] font-semibold tracking-[0.12em] uppercase text-on-surface-variant/65 font-display">
                Assessment Result
              </p>
              {/* Risk pill */}
              <span
                className="flex-shrink-0 flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full font-display ml-2"
                style={{ background: riskConfig.pillBg, color: riskConfig.iconColor, border: `1px solid ${riskConfig.pillBorder}` }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: riskConfig.iconColor }} />
                {riskConfig.label}
              </span>
            </div>
            <h2
              className="text-[26px] md:text-[30px] font-bold leading-none tracking-[-0.02em] font-display mb-2"
              style={{ color: riskConfig.iconColor }}
            >
              {riskConfig.label}
            </h2>
            <p className="text-[13px] text-on-surface-variant font-body leading-relaxed">
              {/* riskConfig.description via RISK_CONFIG — we use the standard description */}
              {assessment.initial_symptom
                ? `Initial complaint: ${assessment.initial_symptom}`
                : 'Assessment result based on your symptoms.'}
            </p>
          </div>
        </div>
      </div>

      {/* ── Two-column row: Symptoms + Possible Condition ─────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Symptoms Reported */}
        <SectionCard icon={<IconSymptoms />} title="Symptoms Reported">
          {Array.isArray(assessment.matched_symptoms) && assessment.matched_symptoms.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {assessment.matched_symptoms.map((sym, i) => (
                <span
                  key={i}
                  className="px-2.5 py-1 rounded-full text-[12px] font-body text-brand-indigo/80"
                  style={{ background: 'rgba(88,86,214,0.07)', border: '1px solid rgba(88,86,214,0.16)' }}
                >
                  {sym.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-on-surface-variant font-body">
              No matched symptoms recorded.
            </p>
          )}
          {/* Symptom category — Module 2 requirement */}
          {assessment.symptom_category && (
            <p className="text-[11px] text-on-surface-variant/55 font-body mt-2 capitalize">
              Category: {assessment.symptom_category}
            </p>
          )}
        </SectionCard>

        {/* Possible Condition */}
        <SectionCard icon={<IconCondition />} title="Possible Condition">
          <p className="text-[14px] font-semibold text-on-surface font-display leading-snug">
            {assessment.condition_pattern || '—'}
          </p>
        </SectionCard>
      </div>

      {/* ── Recommendations ───────────────────────────────────────────────── */}
      {Array.isArray(assessment.recommendations) && assessment.recommendations.length > 0 && (
        <SectionCard icon={<IconRec />} title="Recommendations">
          <ul className="space-y-2">
            {assessment.recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[13px] font-body text-on-surface">
                <span className="flex-shrink-0 mt-0.5 text-brand-indigo font-bold text-[14px] leading-none">•</span>
                <span className="leading-relaxed">{rec}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {/* ── Prevention Tips ───────────────────────────────────────────────── */}
      {Array.isArray(assessment.prevention_tips) && assessment.prevention_tips.length > 0 && (
        <SectionCard icon={<IconPrevention />} title="Prevention Tips">
          <ul className="space-y-2">
            {assessment.prevention_tips.map((tip, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[13px] font-body text-on-surface">
                <span className="flex-shrink-0 mt-0.5 text-esi-success font-bold text-[14px] leading-none">•</span>
                <span className="leading-relaxed">{tip}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {/* ── Two-column row: Follow Up + Government Resources ─────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Follow Up */}
        <SectionCard icon={<IconFollowUp />} title="Follow Up">
          <p className="text-[13px] font-body text-on-surface leading-relaxed mb-1">
            Suggested follow-up date:{' '}
            <span className="font-semibold">{formatDate(assessment.follow_up_date)}</span>
          </p>
          <span
            className={`inline-flex text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
              assessment.follow_up_completed
                ? 'bg-esi-success text-white'
                : 'text-on-surface-variant/70'
            }`}
            style={assessment.follow_up_completed ? {} : {
              background: 'rgba(100,116,139,0.08)',
              border: '1px solid rgba(100,116,139,0.20)',
            }}
          >
            {assessment.follow_up_completed ? 'Completed' : 'Pending'}
          </span>
          <p className="text-[12px] text-on-surface-variant font-body mt-2 leading-relaxed">
            If your symptoms persist or worsen, please consult a healthcare professional.
          </p>
        </SectionCard>

        {/* Government Benefits — only if data exists, otherwise placeholder */}
        {Array.isArray(assessment.government_resources) && assessment.government_resources.length > 0 ? (
          <SectionCard icon={<IconGov />} title="Government Benefits & Resources">
            <div className="space-y-2">
              {assessment.government_resources.map((scheme, i) => (
                <div key={i}>
                  <p className="text-[12px] font-bold text-on-surface font-display mb-0.5">{scheme.scheme_name}</p>
                  <p className="text-[11px] text-on-surface-variant font-body leading-snug mb-0.5">{scheme.benefit}</p>
                  {scheme.eligibility_note && (
                    <p className="text-[10px] text-on-surface-variant/65 font-body italic mb-0.5">
                      {scheme.eligibility_note}
                    </p>
                  )}
                  {scheme.link && (
                    <a href={scheme.link} target="_blank" rel="noopener noreferrer"
                      className="text-[11px] text-brand-indigo font-body hover:underline">
                      Learn more →
                    </a>
                  )}
                </div>
              ))}
            </div>
          </SectionCard>
        ) : (
          <SectionCard icon={<IconGov />} title="Government Benefits & Resources">
            <p className="text-[13px] text-on-surface-variant font-body leading-relaxed">
              No specific schemes available for this condition at the moment.
            </p>
            <p className="text-[12px] text-on-surface-variant/65 font-body mt-1 leading-relaxed">
              Check back later or consult your local health centre for more information.
            </p>
          </SectionCard>
        )}
      </div>

      {/* ── Assessment Metadata (Module 2 required fields) ─────────────────── */}
      <SectionCard icon={<IconMeta />} title="Assessment Metadata">
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-[12px]">
          <div>
            <p className="text-on-surface-variant/60 mb-0.5">Knowledge Base</p>
            <p className="font-semibold text-on-surface">{assessment.knowledge_base_version || '—'}</p>
          </div>
          <div>
            <p className="text-on-surface-variant/60 mb-0.5">Assessment Version</p>
            <p className="font-semibold text-on-surface">{assessment.assessment_version || '—'}</p>
          </div>
          {assessment.district && (
            <div>
              <p className="text-on-surface-variant/60 mb-0.5">District</p>
              <p className="font-semibold text-on-surface">{assessment.district}</p>
            </div>
          )}
          {assessment.pincode && (
            <div>
              <p className="text-on-surface-variant/60 mb-0.5">Pincode</p>
              <p className="font-semibold text-on-surface">{assessment.pincode}</p>
            </div>
          )}
        </div>
      </SectionCard>

      {/* ── Action buttons — navigate('/history') UNCHANGED ──────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <button
          type="button"
          onClick={() => navigate('/history')}
          className={[
            'flex-1 h-[52px] flex items-center justify-center gap-2',
            'rounded-2xl px-5',
            'text-[14px] font-semibold text-white font-display',
            'bg-[linear-gradient(135deg,#706DF2_0%,#5856D6_100%)]',
            'shadow-[0_4px_16px_rgba(88,86,214,0.35)]',
            'hover:brightness-[1.05] active:scale-[0.98]',
            'transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-brand-indigo/50 focus:ring-offset-1',
          ].join(' ')}
        >
          <IconArrowLeft />
          Back to History
        </button>
      </div>

      {/* ── Doctor Summary — secure QR share panel ───────────────────────── */}
      {/* assessmentId comes from useParams() above — Firestore doc ID, UNCHANGED */}
      <DoctorSummaryPanel assessmentId={assessmentId} />

      <p className="text-[11px] text-on-surface-variant/45 text-center font-body pb-2 leading-relaxed">
        This assessment is for informational guidance only and does not constitute medical advice.
      </p>
    </div>
  );
};

export default HistoryDetail;
