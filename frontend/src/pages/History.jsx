import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import PrimaryButton from '../components/PrimaryButton';

// ── Risk level config (locked esi-* tokens) — UNCHANGED ──────────────────────
const RISK_BADGE = {
  'ESI-1': 'bg-esi-emergency text-white',
  'ESI-2': 'bg-esi-emergency text-white',
  'ESI-3': 'bg-esi-warning text-white',
  'ESI-4': 'bg-esi-success text-white',
  'ESI-5': 'bg-esi-success text-white',
};

// Dot colour for inline risk pill
const RISK_DOT = {
  'ESI-1': '#B91C1C',
  'ESI-2': '#B91C1C',
  'ESI-3': '#B45309',
  'ESI-4': '#15803D',
  'ESI-5': '#15803D',
};
const RISK_PILL_BG = {
  'ESI-1': 'rgba(220,38,38,0.09)',
  'ESI-2': 'rgba(220,38,38,0.09)',
  'ESI-3': 'rgba(245,158,11,0.09)',
  'ESI-4': 'rgba(22,163,74,0.09)',
  'ESI-5': 'rgba(22,163,74,0.09)',
};
const RISK_PILL_BORDER = {
  'ESI-1': 'rgba(220,38,38,0.22)',
  'ESI-2': 'rgba(220,38,38,0.22)',
  'ESI-3': 'rgba(245,158,11,0.22)',
  'ESI-4': 'rgba(22,163,74,0.22)',
  'ESI-5': 'rgba(22,163,74,0.22)',
};
const RISK_LABEL = {
  'ESI-1': 'Emergency',
  'ESI-2': 'High Risk',
  'ESI-3': 'Medium Risk',
  'ESI-4': 'Low Risk',
  'ESI-5': 'Non-Urgent',
};

function riskBadgeClass(riskLevel) {
  return RISK_BADGE[riskLevel] || 'bg-gray-300 text-gray-700';
}

// formatDate — UNCHANGED logic
function formatDate(value) {
  if (!value) return '—';
  const d = value?.toDate ? value.toDate() : new Date(value);
  return d.toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

// formatDateBlock — splits into day / month / year for the reference date column
function formatDateBlock(value) {
  if (!value) return { day: '—', month: '', year: '' };
  const d = value?.toDate ? value.toDate() : new Date(value);
  return {
    day: d.toLocaleDateString('en-IN', { day: '2-digit' }),
    month: d.toLocaleDateString('en-IN', { month: 'short' }).toUpperCase(),
    year: d.toLocaleDateString('en-IN', { year: 'numeric' }),
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

// ── Inline SVG icons ──────────────────────────────────────────────────────────
const IconDoc = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"
    className="w-4 h-4" aria-hidden="true">
    <rect x="4" y="2" width="12" height="16" rx="2"/>
    <path d="M7 7h6M7 11h4" strokeLinecap="round"/>
  </svg>
);
const IconChevronRight = () => (
  <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4 flex-shrink-0" aria-hidden="true">
    <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconClipboard = () => (
  <svg viewBox="0 0 48 48" fill="none" className="w-12 h-12" aria-hidden="true">
    <rect x="8" y="8" width="32" height="36" rx="4" stroke="currentColor" strokeWidth="2" fill="rgba(88,86,214,0.06)"/>
    <path d="M16 20h16M16 28h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <rect x="18" y="4" width="12" height="8" rx="2" stroke="currentColor" strokeWidth="2" fill="white"/>
  </svg>
);
const IconPlus = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true">
    <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"/>
  </svg>
);

// ── Component ─────────────────────────────────────────────────────────────────
const History = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // ── State — UNCHANGED ──────────────────────────────────────────────────────
  const [assessments, setAssessments] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | loaded | empty | error | unauth

  // ── Firestore query — UNCHANGED ────────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !user) { setStatus('unauth'); return; }
    if (authLoading || !user) return;

    let cancelled = false;
    const fetchHistory = async () => {
      setStatus('loading');
      try {
        const q = query(
          collection(db, 'assessments'),
          where('uid', '==', user.uid),
          orderBy('created_at', 'desc'),
          limit(20)
        );
        const snap = await getDocs(q);
        if (cancelled) return;
        if (snap.empty) {
          setAssessments([]);
          setStatus('empty');
        } else {
          setAssessments(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
          setStatus('loaded');
        }
      } catch (err) {
        if (!cancelled) { console.error('[History] Firestore error:', err); setStatus('error'); }
      }
    };
    fetchHistory();
    return () => { cancelled = true; };
  }, [user, authLoading]);

  // ── Unauth — UNCHANGED ─────────────────────────────────────────────────────
  if (status === 'unauth') { navigate('/auth', { replace: true }); return null; }

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <div className="w-full max-w-[860px] mx-auto px-4 md:px-6 pt-8 space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-[76px] rounded-[18px] animate-pulse"
            style={{ background: 'rgba(255,255,255,0.30)' }} />
        ))}
      </div>
    );
  }

  // ── Error ───────────────────────────────────────────────────────────────────
  if (status === 'error') {
    return (
      <div className="w-full max-w-[860px] mx-auto px-4 md:px-6 pt-8">
        <div style={glassStyle} className="px-6 py-6">
          <p className="text-[13px] text-esi-emergency font-body mb-4">
            Could not load your assessment history. Please try again.
          </p>
          <PrimaryButton onClick={() => window.location.reload()} className="w-full">
            Retry
          </PrimaryButton>
        </div>
      </div>
    );
  }

  // ── Empty State ─────────────────────────────────────────────────────────────
  if (status === 'empty') {
    return (
      <div className="w-full max-w-[860px] mx-auto px-4 md:px-6 pt-8 pb-24">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-[26px] md:text-[30px] font-bold text-on-surface tracking-[-0.02em] font-display mb-1">
            Your Health History
          </h1>
          <p className="text-[14px] text-on-surface-variant font-body">
            View your past assessments and track your health journey.
          </p>
        </div>

        {/* Empty state card */}
        <div style={glassStyle} className="flex flex-col items-center text-center px-8 py-12">
          <div className="text-brand-indigo/40 mb-4">
            <IconClipboard />
          </div>
          <h2 className="text-[17px] font-bold text-on-surface font-display mb-2">
            No assessments yet
          </h2>
          <p className="text-[14px] text-on-surface-variant font-body mb-6 max-w-[280px] leading-relaxed">
            Your completed symptom assessments will appear here.
          </p>
          {/* onClick → navigate('/triage') UNCHANGED */}
          <PrimaryButton onClick={() => navigate('/triage')} className="w-full max-w-[240px]">
            <IconPlus />
            Start Your First Assessment
          </PrimaryButton>
        </div>
      </div>
    );
  }

  // ── History Loaded ──────────────────────────────────────────────────────────
  return (
    <div className="w-full max-w-[860px] mx-auto px-4 md:px-6 pt-6 pb-24 space-y-4 page-enter">

      {/* Page header */}
      <div className="pt-2 pb-2">
        <h1 className="text-[26px] md:text-[30px] font-bold text-on-surface tracking-[-0.02em] font-display mb-1">
          Your Health History
        </h1>
        <p className="text-[14px] text-on-surface-variant font-body">
          View your past assessments and track your health journey.
        </p>
      </div>

      {/* Assessment list */}
      <div className="space-y-3">
        {assessments.map((a) => {
          const dateBlock = formatDateBlock(a.created_at);
          const riskLabel = RISK_LABEL[a.risk_level] || a.risk_level || '—';
          const pillBg = RISK_PILL_BG[a.risk_level] || 'rgba(100,116,139,0.08)';
          const pillBorder = RISK_PILL_BORDER[a.risk_level] || 'rgba(100,116,139,0.20)';
          const dotColor = RISK_DOT[a.risk_level] || '#475569';

          return (
            // Link → /history/:id UNCHANGED
            <Link
              key={a.id}
              to={`/history/${a.id}`}
              className="block group focus:outline-none focus:ring-2 focus:ring-brand-indigo/40 rounded-[18px]"
              aria-label={`View assessment from ${formatDate(a.created_at)}`}
            >
              <div
                style={glassStyle}
                className="flex items-center gap-0 transition-all duration-200 group-hover:shadow-[0_8px_28px_rgba(88,86,214,0.11)] group-hover:-translate-y-px overflow-hidden"
              >
                {/* Date block — left column */}
                <div
                  className="flex-shrink-0 flex flex-col items-center justify-center w-[68px] py-4 self-stretch"
                  style={{ background: 'rgba(88,86,214,0.04)', borderRight: '1px solid rgba(88,86,214,0.08)' }}
                >
                  <span className="text-[10px] font-semibold text-brand-indigo/70 tracking-wider uppercase leading-none">
                    {dateBlock.month}
                  </span>
                  <span className="text-[22px] font-bold text-on-surface leading-tight font-display">
                    {dateBlock.day}
                  </span>
                  <span className="text-[10px] text-on-surface-variant leading-none mt-0.5">
                    {dateBlock.year}
                  </span>
                </div>

                {/* Main content */}
                <div className="flex-1 min-w-0 flex items-center gap-3 px-4 py-4">
                  <div className="flex-1 min-w-0">
                    {/* Initial symptom / title */}
                    <p className="text-[14px] font-semibold text-on-surface font-display truncate leading-snug mb-0.5">
                      {a.initial_symptom || 'Symptom assessment'}
                    </p>
                    {/* Condition pattern */}
                    <p className="text-[12px] text-on-surface-variant font-body truncate mb-1.5">
                      {a.condition_pattern || '—'}
                    </p>
                    {/* Questions completed indicator */}
                    <div className="flex items-center gap-1.5 text-[11px] text-on-surface-variant/65 font-body">
                      <IconDoc />
                      <span>6 questions completed</span>
                    </div>
                  </div>

                  {/* Risk pill */}
                  <span
                    className="flex-shrink-0 flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full font-display"
                    style={{ background: pillBg, color: dotColor, border: `1px solid ${pillBorder}` }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: dotColor }} />
                    {riskLabel}
                  </span>
                </div>

                {/* Chevron */}
                <div className="flex-shrink-0 pr-4 text-on-surface-variant/40 group-hover:text-brand-indigo/60 transition-colors">
                  <IconChevronRight />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Footer count */}
      <p className="text-[12px] text-on-surface-variant/55 text-center font-body pt-1">
        Showing up to 20 most recent assessments
      </p>
    </div>
  );
};

export default History;
