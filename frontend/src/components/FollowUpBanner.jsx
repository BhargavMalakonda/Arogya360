/**
 * FollowUpBanner.jsx
 *
 * Queries Firestore for overdue follow-ups belonging to the current user and
 * renders a high-visibility banner when any are found.
 *
 * Query (matches composite index: uid ASC + follow_up_completed ASC + follow_up_date ASC):
 *   assessments where uid == currentUser.uid
 *                AND follow_up_completed == false
 *                AND follow_up_date <= Timestamp.now()
 *
 * Display logic:
 *   - 0 results  → render nothing (no empty state)
 *   - 1 result   → banner with date + check-in buttons
 *   - N > 1      → banner for the oldest overdue item + "+N-1 more" chip
 *                  Each can be resolved individually; count decrements live
 *
 * Check-in options (all set follow_up_completed: true + symptom_resolution):
 *   "Feeling Better"  → symptom_resolution: "better"  → confetti + banner disappears
 *   "No Change"       → symptom_resolution: "same"    → navigate to /triage (follow-up re-check)
 *   "Feeling Worse"   → symptom_resolution: "worse"   → navigate to /triage (follow-up re-check)
 *
 * SCHEMA NOTE: symptom_resolution is an additive field. Existing documents that
 * don't have it are treated identically to null — no reads of this field happen
 * here, only writes. The Firestore query is unchanged (still uses follow_up_completed).
 *
 * PERSISTENCE: Follow-up context is written to sessionStorage key
 * 'arogya360_followup_context' so it survives a hard browser refresh on /triage.
 * Triage.jsx reads and immediately clears it on mount so it cannot affect a later
 * fresh assessment session.
 *
 * DEMO_MODE FALLBACK NOTE: If Gemini is unavailable during a follow-up re-check,
 * the static fallback response fires normally but won't reference the previous
 * assessment. This is an accepted limitation — flagged per spec.
 *
 * Error handling: fails silently (console.error only) so a Firestore hiccup
 * never breaks the Home page.
 *
 * UI: Redesigned to match approved reference (followon_msg).
 * All data-fetching, Firestore, confetti, and navigation logic is UNCHANGED.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import confetti from 'canvas-confetti';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';

// ── Date formatter — unchanged ────────────────────────────────────────────────
function formatDate(value) {
  if (!value) return '';
  const d = value?.toDate ? value.toDate() : new Date(value);
  return d.toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SVG DECORATIONS  (inline, no external assets, aria-hidden throughout)
// ═══════════════════════════════════════════════════════════════════════════════

// Small ringing bell — left icon circle
const BellSmall = () => (
  <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg"
    className="w-full h-full" aria-hidden="true">
    {/* ring lines */}
    <line x1="8"  y1="10" x2="5"  y2="7"  stroke="#F59E0B" strokeWidth="2.2" strokeLinecap="round"/>
    <line x1="32" y1="10" x2="35" y2="7"  stroke="#F59E0B" strokeWidth="2.2" strokeLinecap="round"/>
    <line x1="6"  y1="20" x2="2"  y2="20" stroke="#F59E0B" strokeWidth="2.2" strokeLinecap="round"/>
    <line x1="34" y1="20" x2="38" y2="20" stroke="#F59E0B" strokeWidth="2.2" strokeLinecap="round"/>
    {/* bell body */}
    <path
      d="M20 6C14.477 6 10 10.477 10 16v8l-2 3h24l-2-3v-8c0-5.523-4.477-10-10-10z"
      fill="url(#bellGrad)" stroke="#D97706" strokeWidth="0.8"
    />
    {/* clapper */}
    <circle cx="20" cy="29.5" r="2.2" fill="#D97706"/>
    <defs>
      <linearGradient id="bellGrad" x1="10" y1="6" x2="30" y2="32" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FCD34D"/>
        <stop offset="1" stopColor="#F59E0B"/>
      </linearGradient>
    </defs>
  </svg>
);

// Large decorative bell + clock — right background art
const BellClockArt = () => (
  <svg viewBox="0 0 160 120" fill="none" xmlns="http://www.w3.org/2000/svg"
    className="w-full h-full" aria-hidden="true">
    {/* soft wave blob behind */}
    <ellipse cx="110" cy="95" rx="70" ry="38" fill="#FDE68A" opacity="0.45"/>
    {/* motion lines */}
    <line x1="58" y1="42" x2="48" y2="34" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" opacity="0.6"/>
    <line x1="55" y1="55" x2="42" y2="55" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" opacity="0.5"/>
    {/* large bell */}
    <path
      d="M100 14C84.536 14 72 26.536 72 42v22l-5 8h66l-5-8V42c0-15.464-12.536-28-28-28z"
      fill="#FCD34D" opacity="0.70"
    />
    <path
      d="M100 14C84.536 14 72 26.536 72 42v22l-5 8h66l-5-8V42c0-15.464-12.536-28-28-28z"
      stroke="#F59E0B" strokeWidth="1.2" opacity="0.50"
    />
    <circle cx="100" cy="74" r="4" fill="#F59E0B" opacity="0.60"/>
    {/* clock face */}
    <circle cx="126" cy="80" r="20" fill="#FEF3C7" stroke="#FCD34D" strokeWidth="2" opacity="0.85"/>
    <circle cx="126" cy="80" r="2"  fill="#F59E0B"/>
    {/* clock hands */}
    <line x1="126" y1="80" x2="126" y2="66" stroke="#D97706" strokeWidth="2.2" strokeLinecap="round"/>
    <line x1="126" y1="80" x2="136" y2="82" stroke="#D97706" strokeWidth="2.2" strokeLinecap="round"/>
  </svg>
);

// Document icon for condition badge
const DocIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="9" y1="13" x2="15" y2="13"/>
    <line x1="9" y1="17" x2="13" y2="17"/>
  </svg>
);

// Arrow right for buttons
const ArrowRight = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT  — only the return/JSX is redesigned; all logic is untouched
// ═══════════════════════════════════════════════════════════════════════════════

const FollowUpBanner = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [overdue,  setOverdue]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [marking,  setMarking]  = useState(new Set());
  const bannerRef = useRef(null);

  // ── Firestore query — UNCHANGED ────────────────────────────────────────────
  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let cancelled = false;

    const fetchOverdue = async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, 'assessments'),
          where('uid', '==', user.uid),
          where('follow_up_completed', '==', false),
          where('follow_up_date', '<=', Timestamp.now())
        );
        const snap = await getDocs(q);
        if (cancelled) return;

        const docs = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => {
            const aTs = a.follow_up_date?.toMillis?.() ?? 0;
            const bTs = b.follow_up_date?.toMillis?.() ?? 0;
            return aTs - bTs;
          });
        setOverdue(docs);
      } catch (err) {
        console.error('[FollowUpBanner] Firestore error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchOverdue();
    return () => { cancelled = true; };
  }, [user]);

  // ── handleCheckIn — UNCHANGED ──────────────────────────────────────────────
  const handleCheckIn = async (assessmentId, resolution, assessment) => {
    setOverdue((prev) => prev.filter((a) => a.id !== assessmentId));
    setMarking((prev) => new Set(prev).add(assessmentId));

    try {
      await updateDoc(doc(db, 'assessments', assessmentId), {
        follow_up_completed: true,
        symptom_resolution: resolution,
      });
    } catch (err) {
      console.error('[FollowUpBanner] updateDoc error:', err);
    } finally {
      setMarking((prev) => {
        const next = new Set(prev);
        next.delete(assessmentId);
        return next;
      });
    }

    if (resolution === 'better') {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#4f46e5', '#10b981', '#f59e0b', '#ef4444'],
      });
      return;
    }

    const followupPayload = {
      isFollowUp: true,
      previousConditionPattern: assessment.condition_pattern ?? null,
      previousAssessmentDate: assessment.created_at
        ? (assessment.created_at?.toDate
            ? assessment.created_at.toDate().toISOString()
            : new Date(assessment.created_at).toISOString())
        : null,
      symptomResolution: resolution,
    };

    try {
      sessionStorage.setItem('arogya360_followup_context', JSON.stringify(followupPayload));
    } catch { /* non-fatal */ }

    navigate('/triage', { state: followupPayload });
  };

  // ── Early exits — UNCHANGED ────────────────────────────────────────────────
  if (loading) return null;
  if (overdue.length === 0) return null;

  const lead          = overdue[0];
  const extraCount    = overdue.length - 1;
  const isMarkingLead = marking.has(lead.id);

  // ── Formatted date for the lead item ──────────────────────────────────────
  const leadDate = formatDate(lead.follow_up_date);

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER — redesigned to match approved followon_msg reference
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div ref={bannerRef} role="alert">

      {/* ── Lead follow-up card ────────────────────────────────────────── */}
      <div
        className="relative w-full overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #fffbf0 0%, #fff8e8 60%, #fef3c7 100%)',
          borderRadius: '20px',
          border: '1px solid rgba(251,191,36,0.25)',
          boxShadow: '0 4px 24px rgba(245,158,11,0.10), 0 1px 6px rgba(30,31,59,0.04)',
        }}
      >

        {/* ── Right-side decorative art (absolute, behind content) ──── */}
        <div
          className="absolute right-0 bottom-0 pointer-events-none select-none"
          style={{ width: '180px', height: '130px', opacity: 0.9 }}
          aria-hidden="true"
        >
          <BellClockArt />
        </div>

        {/* ── Three decorative dots — upper-right ─────────────────────── */}
        <div
          className="absolute top-4 right-5 flex items-center gap-1 pointer-events-none select-none"
          aria-hidden="true"
        >
          {[0,1,2].map(i => (
            <div
              key={i}
              className="rounded-full"
              style={{ width: '5px', height: '5px', background: 'rgba(217,119,6,0.30)' }}
            />
          ))}
        </div>

        {/* ── Main content ─────────────────────────────────────────────── */}
        <div className="relative z-10 px-5 py-5 sm:px-6 sm:py-5">
          <div className="flex items-start gap-4">

            {/* Left: bell circle icon */}
            <div
              className="flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center self-start mt-0.5"
              style={{
                background: 'radial-gradient(circle, rgba(254,243,199,1) 0%, rgba(253,230,138,0.7) 100%)',
                border: '1.5px solid rgba(251,191,36,0.40)',
                boxShadow: '0 2px 8px rgba(245,158,11,0.15)',
              }}
              aria-hidden="true"
            >
              <div className="w-7 h-7">
                <BellSmall />
              </div>
            </div>

            {/* Center / right: text + buttons (stops before right-art) */}
            <div className="flex-1 min-w-0 pr-4 sm:pr-28">

              {/* Eyebrow label */}
              <p
                className="text-[10px] font-bold tracking-[0.14em] uppercase mb-1 font-display"
                style={{ color: '#B45309' }}
              >
                Follow-Up Due
                {extraCount > 0 && (
                  <span
                    className="ml-2 px-2 py-0.5 rounded-full text-[9px] font-semibold"
                    style={{ background: '#F59E0B', color: '#fff' }}
                  >
                    +{extraCount} more
                  </span>
                )}
              </p>

              {/* Assessment sentence */}
              <p className="text-[14px] font-bold text-on-surface leading-snug mb-2 font-display">
                Your assessment from{' '}
                <span style={{ color: '#D97706' }}>{leadDate}</span>
                {' '}has a pending follow-up.
              </p>

              {/* Condition badge */}
              {lead.condition_pattern && (
                <div className="inline-flex items-center gap-1.5 mb-3">
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium"
                    style={{
                      background: 'rgba(254,243,199,0.90)',
                      border: '1px solid rgba(217,119,6,0.25)',
                      color: '#92400E',
                    }}
                  >
                    <span style={{ color: '#D97706' }}><DocIcon /></span>
                    Condition: {lead.condition_pattern}
                  </span>
                </div>
              )}

              {/* Question */}
              <p
                className="text-[13px] font-medium mb-3"
                style={{ color: '#78350F' }}
              >
                How are you feeling today?
              </p>

              {/* Action buttons — horizontal row */}
              <div className="flex flex-col sm:flex-row gap-2.5">

                {/* Feeling Better */}
                <button
                  type="button"
                  onClick={() => handleCheckIn(lead.id, 'better', lead)}
                  disabled={isMarkingLead}
                  aria-label="Feeling better"
                  className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-green-400 disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-95 active:scale-[0.98]"
                  style={{
                    background: 'rgba(209,250,229,0.80)',
                    border: '1.5px solid rgba(52,211,153,0.50)',
                    minWidth: '180px',
                    flex: '0 0 auto',
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl leading-none" aria-hidden="true">😊</span>
                    <span
                      className="text-[13px] font-bold font-display"
                      style={{ color: '#065F46' }}
                    >
                      {isMarkingLead ? 'Saving…' : 'Feeling Better'}
                    </span>
                  </div>
                  <span style={{ color: '#059669' }}><ArrowRight /></span>
                </button>

                {/* No Change */}
                <button
                  type="button"
                  onClick={() => handleCheckIn(lead.id, 'same', lead)}
                  disabled={isMarkingLead}
                  aria-label="No change"
                  className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-amber-300 disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-95 active:scale-[0.98]"
                  style={{
                    background: 'rgba(254,243,199,0.85)',
                    border: '1.5px solid rgba(251,191,36,0.45)',
                    minWidth: '180px',
                    flex: '0 0 auto',
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl leading-none" aria-hidden="true">😐</span>
                    <span
                      className="text-[13px] font-bold font-display"
                      style={{ color: '#78350F' }}
                    >
                      {isMarkingLead ? 'Saving…' : 'No Change'}
                    </span>
                  </div>
                  <span style={{ color: '#D97706' }}><ArrowRight /></span>
                </button>

              </div>{/* /buttons */}
            </div>{/* /center content */}
          </div>{/* /flex row */}
        </div>{/* /main content */}
      </div>{/* /lead card */}

      {/* ── Extra overdue items — compact secondary cards ──────────── */}
      {extraCount > 0 && (
        <div className="mt-2.5 space-y-2">
          {overdue.slice(1).map((a) => {
            const isMarkingThis = marking.has(a.id);
            return (
              <div
                key={a.id}
                className="relative overflow-hidden px-4 py-3.5 sm:px-5"
                style={{
                  background: 'linear-gradient(135deg, #fffbf0 0%, #fef3c7 100%)',
                  borderRadius: '16px',
                  border: '1px solid rgba(251,191,36,0.22)',
                  boxShadow: '0 2px 10px rgba(245,158,11,0.08)',
                }}
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <p className="text-[12px] font-bold text-amber-900 font-display truncate">
                      {a.condition_pattern || 'Assessment'}
                    </p>
                    <p className="text-[11px] text-amber-700 mt-0.5">
                      Due {formatDate(a.follow_up_date)}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => handleCheckIn(a.id, 'better', a)}
                      disabled={isMarkingThis}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-colors disabled:opacity-50"
                      style={{ background: 'rgba(209,250,229,0.80)', border: '1px solid rgba(52,211,153,0.40)', color: '#065F46' }}
                    >
                      😊 {isMarkingThis ? '…' : 'Better'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCheckIn(a.id, 'same', a)}
                      disabled={isMarkingThis}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-colors disabled:opacity-50"
                      style={{ background: 'rgba(254,243,199,0.85)', border: '1px solid rgba(251,191,36,0.40)', color: '#78350F' }}
                    >
                      😐 {isMarkingThis ? '…' : 'Same'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCheckIn(a.id, 'worse', a)}
                      disabled={isMarkingThis}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-colors disabled:opacity-50"
                      style={{ background: 'rgba(254,226,226,0.80)', border: '1px solid rgba(252,165,165,0.40)', color: '#7F1D1D' }}
                    >
                      😟 {isMarkingThis ? '…' : 'Worse'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};

export default FollowUpBanner;
