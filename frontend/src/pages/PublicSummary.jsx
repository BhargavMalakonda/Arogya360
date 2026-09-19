/**
 * PublicSummary.jsx
 *
 * Unauthenticated public page served at /summary/:token.
 *
 * — No TopBar, no BottomNav, no authenticated-app chrome.
 * — Fetches GET /api/summary/{token} with NO Authorization header.
 * — Displays ONLY an explicit allow-list of fields returned by the backend.
 * — Privacy: uid, name, email, district, pincode, address, phone, assessment_id,
 *   share_token, internal IDs, model reasoning are NEVER rendered, even if the
 *   backend unexpectedly returns them. The component destructures only the seven
 *   known allowed fields and ignores everything else.
 * — Does NOT log the share token or the complete API response.
 *
 * qa_history shape (verified against backend allow-list):
 *   { question: string, answer: string, clinical_hint: string }
 *
 * HTTP error handling:
 *   404  → "This summary link is invalid."
 *   410  → "This summary link has expired. Please ask the patient for a new one."
 *   other → "Unable to load this summary. Please try again later."
 *
 * Print:
 *   @media print rules hide the header actions and ensure content prints cleanly.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_BASE_URL;

// ── ESI risk colours — locked, matches Result.jsx / HistoryDetail.jsx ─────────
const RISK_CONFIG = {
  'ESI-1': {
    label: 'Emergency',
    description: 'Seek immediate emergency care',
    iconColor: '#B91C1C',
    pillBg: 'rgba(220,38,38,0.09)',
    pillBorder: 'rgba(220,38,38,0.25)',
    cardBg: 'rgba(254,242,242,0.85)',
    cardBorder: 'rgba(220,38,38,0.20)',
    badgeBg: '#DC2626',
  },
  'ESI-2': {
    label: 'High Risk',
    description: 'Seek urgent medical attention today',
    iconColor: '#B91C1C',
    pillBg: 'rgba(220,38,38,0.09)',
    pillBorder: 'rgba(220,38,38,0.25)',
    cardBg: 'rgba(254,242,242,0.85)',
    cardBorder: 'rgba(220,38,38,0.20)',
    badgeBg: '#DC2626',
  },
  'ESI-3': {
    label: 'Moderate Risk',
    description: 'See a doctor within 24–48 hours',
    iconColor: '#B45309',
    pillBg: 'rgba(245,158,11,0.09)',
    pillBorder: 'rgba(245,158,11,0.28)',
    cardBg: 'rgba(255,251,235,0.85)',
    cardBorder: 'rgba(245,158,11,0.20)',
    badgeBg: '#D97706',
  },
  'ESI-4': {
    label: 'Low Risk',
    description: 'Monitor at home; visit a clinic if symptoms worsen',
    iconColor: '#15803D',
    pillBg: 'rgba(22,163,74,0.09)',
    pillBorder: 'rgba(22,163,74,0.25)',
    cardBg: 'rgba(240,253,244,0.85)',
    cardBorder: 'rgba(22,163,74,0.20)',
    badgeBg: '#16A34A',
  },
  'ESI-5': {
    label: 'Non-Urgent',
    description: 'Self-care and preventive measures are sufficient',
    iconColor: '#15803D',
    pillBg: 'rgba(22,163,74,0.09)',
    pillBorder: 'rgba(22,163,74,0.25)',
    cardBg: 'rgba(240,253,244,0.85)',
    cardBorder: 'rgba(22,163,74,0.20)',
    badgeBg: '#16A34A',
  },
};
const DEFAULT_RISK = {
  label: 'Assessment',
  description: 'Review results below',
  iconColor: '#475569',
  pillBg: 'rgba(100,116,139,0.08)',
  pillBorder: 'rgba(100,116,139,0.22)',
  cardBg: 'rgba(248,250,252,0.88)',
  cardBorder: 'rgba(148,163,184,0.22)',
  badgeBg: '#64748B',
};

// ── Shared card style ─────────────────────────────────────────────────────────
const cardStyle = {
  background: '#ffffff',
  border: '1px solid rgba(226,232,240,0.80)',
  borderRadius: '16px',
  boxShadow: '0 2px 12px rgba(30,31,59,0.05)',
};

// ── Format created_at — backend returns a string ──────────────────────────────
function formatCreatedAt(raw) {
  if (!raw) return null;
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return null;
  }
}

// ── Inline SVG icons — aria-hidden, decorative ───────────────────────────────
const IconShield = ({ color }) => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5" aria-hidden="true" style={{ color }}>
    <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
  </svg>
);
const IconSymptoms = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="#5856D6" strokeWidth="1.6" className="w-5 h-5" aria-hidden="true">
    <rect x="3" y="3" width="14" height="14" rx="3"/>
    <path d="M7 10h6M10 7v6" strokeLinecap="round"/>
  </svg>
);
const IconCondition = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="#5856D6" strokeWidth="1.6" className="w-5 h-5" aria-hidden="true">
    <circle cx="10" cy="10" r="7"/>
    <path d="M7.5 8.5C7.5 7.1 8.6 6 10 6s2.5 1.1 2.5 2.5c0 1.8-2.5 3-2.5 4.5M10 15.5v.5" strokeLinecap="round"/>
  </svg>
);
const IconRec = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="#5856D6" strokeWidth="1.6" className="w-5 h-5" aria-hidden="true">
    <rect x="3" y="3" width="14" height="14" rx="2"/>
    <path d="M7 8h6M7 12h4" strokeLinecap="round"/>
  </svg>
);
const IconTimeline = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="#5856D6" strokeWidth="1.6" className="w-5 h-5" aria-hidden="true">
    <circle cx="10" cy="10" r="7"/>
    <path d="M10 6v4l2.5 2.5" strokeLinecap="round"/>
  </svg>
);
const IconCalendar = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true" style={{ color: '#5856D6' }}>
    <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd"/>
  </svg>
);
const IconPrint = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true">
    <path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v5a2 2 0 002 2h1v2a1 1 0 001 1h8a1 1 0 001-1v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a1 1 0 00-1-1H6a1 1 0 00-1 1zm2 0h6v3H7V4zm-1 9H5v2h10v-2h-1a1 1 0 01-1 1H8a1 1 0 01-1-1zm0-2a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd"/>
  </svg>
);

// ── Section card wrapper ──────────────────────────────────────────────────────
const SectionCard = ({ icon, title, children }) => (
  <div style={cardStyle} className="px-5 py-5 md:px-6">
    <div className="flex items-start gap-3 mb-3">
      <div
        className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
        style={{ background: 'rgba(88,86,214,0.08)', border: '1.5px solid rgba(88,86,214,0.18)' }}
      >
        {icon}
      </div>
      <h2 className="text-[15px] font-bold text-gray-800 leading-tight pt-1.5">
        {title}
      </h2>
    </div>
    {children}
  </div>
);

// ── Loading skeleton ──────────────────────────────────────────────────────────
const LoadingSkeleton = () => (
  <div className="space-y-4">
    {[80, 48, 64, 96].map((h, i) => (
      <div
        key={i}
        className="rounded-2xl animate-pulse"
        style={{ height: `${h}px`, background: 'rgba(226,232,240,0.70)' }}
      />
    ))}
  </div>
);

// ── Error display ─────────────────────────────────────────────────────────────
const ErrorDisplay = ({ message, showRetry, onRetry }) => (
  <div style={cardStyle} className="px-6 py-8 text-center space-y-4">
    <div
      className="w-12 h-12 rounded-full flex items-center justify-center mx-auto"
      style={{ background: 'rgba(220,38,38,0.08)', border: '1.5px solid rgba(220,38,38,0.20)' }}
    >
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-6 h-6" style={{ color: '#B91C1C' }} aria-hidden="true">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
      </svg>
    </div>
    <p className="text-[15px] font-semibold text-gray-800 leading-snug">{message}</p>
    {showRetry && (
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold"
        style={{
          background: 'rgba(88,86,214,0.09)',
          border: '1.5px solid rgba(88,86,214,0.22)',
          color: '#4338CA',
        }}
      >
        Try again
      </button>
    )}
  </div>
);

// ── Component ─────────────────────────────────────────────────────────────────
const PublicSummary = () => {
  const { token } = useParams();

  const [status, setStatus] = useState('loading'); // loading | success | error
  const [errorCode, setErrorCode] = useState(null); // 404 | 410 | other
  const [summary, setSummary] = useState(null);

  const fetchSummary = useCallback(async () => {
    setStatus('loading');
    setErrorCode(null);
    try {
      // IMPORTANT: No Authorization header. This is a fully unauthenticated request.
      const res = await fetch(`${API_BASE}/api/summary/${token}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        // No Authorization header by design.
      });

      if (res.status === 404) {
        setErrorCode(404);
        setStatus('error');
        return;
      }
      if (res.status === 410) {
        setErrorCode(410);
        setStatus('error');
        return;
      }
      if (!res.ok) {
        setErrorCode('other');
        setStatus('error');
        return;
      }

      const raw = await res.json();

      // Allow-list: extract only the seven known safe fields.
      // Any unexpected fields the backend may return are silently discarded.
      // NEVER log raw or token.
      const safe = {
        condition_pattern: raw.condition_pattern ?? '',
        risk_level:        raw.risk_level ?? '',
        matched_symptoms:  Array.isArray(raw.matched_symptoms) ? raw.matched_symptoms : [],
        symptom_category:  raw.symptom_category ?? '',
        qa_history:        Array.isArray(raw.qa_history) ? raw.qa_history : [],
        recommendations:   Array.isArray(raw.recommendations) ? raw.recommendations : [],
        created_at:        raw.created_at ?? '',
      };
      setSummary(safe);
      setStatus('success');
    } catch {
      // Network/parse error — do not log token or response content
      console.error('[PublicSummary] fetch failed');
      setErrorCode('other');
      setStatus('error');
    }
  }, [token]);

  useEffect(() => {
    if (token) fetchSummary();
  }, [token, fetchSummary]);

  const riskConfig = summary ? (RISK_CONFIG[summary.risk_level] || DEFAULT_RISK) : DEFAULT_RISK;
  const createdFormatted = summary ? formatCreatedAt(summary.created_at) : null;

  // ── Error messages ────────────────────────────────────────────────────────
  const errorMessage =
    errorCode === 404
      ? 'This summary link is invalid.'
      : errorCode === 410
      ? 'This summary link has expired. Please ask the patient for a new one.'
      : 'Unable to load this summary. Please try again later.';

  const showRetry = errorCode !== 404 && errorCode !== 410;

  return (
    <>
      {/* ── Print styles injected inline so they work without a separate CSS file ── */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
          .print-container { max-width: 100% !important; padding: 0 !important; }
          .print-card { box-shadow: none !important; border: 1px solid #e2e8f0 !important; }
        }
      `}</style>

      <div
        className="min-h-screen print-container"
        style={{ background: 'linear-gradient(160deg, #F8F9FF 0%, #EEF0FF 50%, #F5F8FF 100%)' }}
      >
        {/* ── Header — Arogya360 branding, no app chrome ─────────────────── */}
        <header
          className="no-print"
          style={{
            background: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(16px)',
            borderBottom: '1px solid rgba(226,232,240,0.80)',
          }}
        >
          <div className="max-w-[760px] mx-auto px-4 md:px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              {/* Arogya360 logo mark */}
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-[13px] font-bold"
                style={{ background: 'linear-gradient(135deg, #706DF2 0%, #5856D6 100%)' }}
                aria-hidden="true"
              >
                A
              </div>
              <span className="text-[15px] font-bold text-gray-800">Arogya360</span>
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors"
              style={{
                background: 'rgba(88,86,214,0.07)',
                border: '1px solid rgba(88,86,214,0.18)',
                color: '#4338CA',
              }}
              aria-label="Print this summary"
            >
              <IconPrint />
              Print
            </button>
          </div>
        </header>

        {/* ── Print header — visible only when printing ─────────────────── */}
        <div className="hidden" style={{ display: 'none' }}>
          {/* Replaced by @media print via CSS above for the real print header */}
        </div>

        {/* ── Main content ───────────────────────────────────────────────── */}
        <main className="max-w-[760px] mx-auto px-4 md:px-6 py-6 pb-16 space-y-4">

          {/* Print-only branding row */}
          <div
            className="flex items-center gap-2 pb-2"
            style={{ display: 'none' }}
            aria-hidden="true"
          >
            {/* hidden — not needed since we have the header */}
          </div>

          {/* ── Page title ─────────────────────────────────────────────── */}
          <div className="pt-2 pb-1">
            <p
              className="text-[11px] font-semibold tracking-[0.12em] uppercase mb-1"
              style={{ color: '#5856D6' }}
            >
              Secure Doctor Summary
            </p>
            <h1 className="text-[24px] md:text-[28px] font-bold text-gray-900 tracking-tight leading-tight">
              Patient Health Assessment
            </h1>
            {createdFormatted && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <IconCalendar />
                <p className="text-[13px] text-gray-500">
                  Assessment date: <span className="font-semibold text-gray-700">{createdFormatted}</span>
                </p>
              </div>
            )}
          </div>

          {/* ── Loading ───────────────────────────────────────────────────── */}
          {status === 'loading' && <LoadingSkeleton />}

          {/* ── Error ─────────────────────────────────────────────────────── */}
          {status === 'error' && (
            <ErrorDisplay
              message={errorMessage}
              showRetry={showRetry}
              onRetry={fetchSummary}
            />
          )}

          {/* ── Success ───────────────────────────────────────────────────── */}
          {status === 'success' && summary && (
            <>
              {/* 1. Risk level card — locked ESI colours */}
              <div
                className="print-card px-5 py-5 md:px-6"
                style={{
                  background: riskConfig.cardBg,
                  border: `1px solid ${riskConfig.cardBorder}`,
                  borderRadius: '16px',
                  boxShadow: '0 2px 12px rgba(30,31,59,0.05)',
                }}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center"
                    style={{
                      background: riskConfig.pillBg,
                      border: `1.5px solid ${riskConfig.pillBorder}`,
                    }}
                  >
                    <IconShield color={riskConfig.iconColor} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-[11px] font-semibold tracking-[0.10em] uppercase text-gray-400">
                        Risk Level
                      </p>
                      {summary.risk_level && (
                        <span
                          className="text-[11px] font-bold px-2.5 py-0.5 rounded-full text-white"
                          style={{ background: riskConfig.badgeBg }}
                        >
                          {summary.risk_level}
                        </span>
                      )}
                    </div>
                    <h2
                      className="text-[22px] md:text-[26px] font-bold leading-tight tracking-tight"
                      style={{ color: riskConfig.iconColor }}
                    >
                      {riskConfig.label}
                    </h2>
                    <p className="text-[13px] text-gray-500 mt-0.5 leading-relaxed">
                      {riskConfig.description}
                    </p>
                  </div>
                </div>
              </div>

              {/* 2. Condition pattern */}
              {summary.condition_pattern && (
                <SectionCard icon={<IconCondition />} title="Condition Pattern">
                  <p className="text-[15px] font-semibold text-gray-800 leading-snug">
                    {summary.condition_pattern}
                  </p>
                </SectionCard>
              )}

              {/* 3. Matched symptoms + category */}
              {summary.matched_symptoms.length > 0 && (
                <SectionCard icon={<IconSymptoms />} title="Matched Symptoms">
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {summary.matched_symptoms.map((sym, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 rounded-full text-[12px] font-medium"
                        style={{
                          background: 'rgba(88,86,214,0.07)',
                          border: '1px solid rgba(88,86,214,0.16)',
                          color: '#4338CA',
                        }}
                      >
                        {sym.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                  {summary.symptom_category && (
                    <p className="text-[12px] text-gray-400 capitalize">
                      Category: <span className="font-semibold text-gray-600">{summary.symptom_category}</span>
                    </p>
                  )}
                </SectionCard>
              )}

              {/* 4. Doctor-facing Q&A timeline */}
              {summary.qa_history.length > 0 && (
                <SectionCard icon={<IconTimeline />} title="Clinical Q&A Timeline">
                  <p className="text-[11px] text-gray-400 mb-3 leading-relaxed">
                    Questions asked by the triage system and the patient's responses, in order.
                  </p>
                  <ol className="space-y-4">
                    {summary.qa_history.map((item, i) => {
                      // Allow-list: only render question, answer, clinical_hint
                      const question     = typeof item.question     === 'string' ? item.question.trim()     : '';
                      const answer       = typeof item.answer       === 'string' ? item.answer.trim()       : '';
                      const clinicalHint = typeof item.clinical_hint === 'string' ? item.clinical_hint.trim() : '';

                      if (!question && !answer) return null;

                      return (
                        <li key={i} className="flex gap-3">
                          {/* Step number */}
                          <div className="flex-shrink-0 flex flex-col items-center">
                            <div
                              className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
                              style={{ background: '#5856D6', minWidth: '24px' }}
                              aria-label={`Step ${i + 1}`}
                            >
                              {i + 1}
                            </div>
                            {i < summary.qa_history.length - 1 && (
                              <div
                                className="w-px flex-1 mt-1"
                                style={{ background: 'rgba(88,86,214,0.15)', minHeight: '16px' }}
                                aria-hidden="true"
                              />
                            )}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0 pb-1">
                            {question && (
                              <div className="mb-1.5">
                                <p className="text-[10px] font-semibold tracking-[0.08em] uppercase text-gray-400 mb-0.5">
                                  Question
                                </p>
                                <p className="text-[13px] text-gray-800 leading-relaxed font-medium">
                                  {question}
                                </p>
                              </div>
                            )}
                            {answer && (
                              <div className="mb-1.5">
                                <p className="text-[10px] font-semibold tracking-[0.08em] uppercase text-gray-400 mb-0.5">
                                  Patient response
                                </p>
                                <p
                                  className="text-[13px] leading-relaxed px-3 py-2 rounded-lg"
                                  style={{
                                    background: 'rgba(88,86,214,0.05)',
                                    border: '1px solid rgba(88,86,214,0.12)',
                                    color: '#374151',
                                  }}
                                >
                                  {answer}
                                </p>
                              </div>
                            )}
                            {clinicalHint && (
                              <div
                                className="flex items-start gap-1.5 px-2.5 py-1.5 rounded-lg"
                                style={{
                                  background: 'rgba(245,158,11,0.06)',
                                  border: '1px solid rgba(245,158,11,0.20)',
                                }}
                              >
                                <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: '#B45309' }} aria-hidden="true">
                                  <path fillRule="evenodd" d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM0 8a8 8 0 1116 0A8 8 0 010 8zm8.75-3.25a.75.75 0 00-1.5 0V8c0 .414.336.75.75.75h2.5a.75.75 0 000-1.5H8.75V4.75z" clipRule="evenodd"/>
                                </svg>
                                <p className="text-[11px] text-amber-700 leading-relaxed">
                                  {clinicalHint}
                                </p>
                              </div>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </SectionCard>
              )}

              {/* 5. Recommendations */}
              {summary.recommendations.length > 0 && (
                <SectionCard icon={<IconRec />} title="Recommendations">
                  <ul className="space-y-2">
                    {summary.recommendations.map((rec, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-[13px] text-gray-700 leading-relaxed">
                        <span
                          className="flex-shrink-0 mt-0.5 font-bold text-[14px] leading-none"
                          style={{ color: '#5856D6' }}
                        >
                          •
                        </span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </SectionCard>
              )}

              {/* 6. Disclaimer */}
              <div
                className="print-card px-5 py-4 rounded-2xl"
                style={{
                  background: 'rgba(248,250,252,0.90)',
                  border: '1px solid rgba(226,232,240,0.80)',
                }}
                role="note"
                aria-label="Disclaimer"
              >
                <p className="text-[12px] text-gray-500 leading-relaxed text-center">
                  Patient self-reported triage summary. Not a diagnosis.
                  Generated by Arogya360.
                </p>
              </div>
            </>
          )}
        </main>
      </div>
    </>
  );
};

export default PublicSummary;
