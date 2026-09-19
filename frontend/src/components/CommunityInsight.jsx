/**
 * CommunityInsight.jsx
 *
 * Displays local symptom-category trends for the authenticated user's pincode.
 *
 * Data source: GET /api/community/insights (FastAPI backend, Admin SDK aggregation).
 * The backend reads the user's pincode from their own Firestore profile — it is NOT
 * passed from the client, preventing probing of other pincodes.
 *
 * This component does NOT query Firestore directly — that approach required a
 * weakened `allow list` security rule that would expose individual assessment
 * documents to cross-user list queries. The backend endpoint returns only integer
 * counts (never document field values) and applies Module 2 §3 privacy suppression
 * server-side (count < 3 rows are omitted entirely from the response).
 *
 * Display contract from Module 2 §3 (updated — Prompt B):
 *   { symptom_category, count_last_7_days, display_label,
 *     prevention_tips?,  prevention_framing? }
 *
 *   prevention_tips and prevention_framing are optional — when absent the Stay
 *   Healthy section is simply not rendered (backward-compatible with the old
 *   response shape).
 *
 * Rules enforced by the backend, but also respected here in rendering:
 *  - No trend arrows (forbidden in v1 — no historical baseline)
 *  - Only symptom_category — never condition_pattern (medicolegal safeguard)
 *  - Privacy suppression: count < 3 → backend omits the row entirely;
 *    frontend shows "Limited community activity data available" fallback
 *    if the response has zero rows but no error (empty pincode area).
 *
 * Stage 3: layout updated to horizontal glass card matching design reference.
 * All data-fetching, state, privacy, and API logic is UNCHANGED.
 */

import React, { useEffect, useState } from 'react';
import { auth } from '../lib/firebase';

const API_BASE = import.meta.env.VITE_API_BASE_URL;

// Privacy fallback string (Module 2 §3) — shown when no categories meet threshold
const PRIVACY_FALLBACK = 'Limited community activity data available';

// ── Bar chart icon — inline SVG, decorative, aria-hidden ─────────────────────
const BarChartIcon = () => (
  <svg
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="w-5 h-5"
    aria-hidden="true"
  >
    <rect x="2"  y="11" width="4" height="7"  rx="1" fill="currentColor" opacity="0.55" />
    <rect x="8"  y="6"  width="4" height="12" rx="1" fill="currentColor" />
    <rect x="14" y="3"  width="4" height="15" rx="1" fill="currentColor" opacity="0.40" />
  </svg>
);

// ── Chevron right — decorative, aria-hidden ───────────────────────────────────
const ChevronRight = () => (
  <svg
    viewBox="0 0 16 16"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="w-4 h-4 flex-shrink-0"
    aria-hidden="true"
  >
    <path
      d="M6 4l4 4-4 4"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// ── Shared glass card shell ───────────────────────────────────────────────────
// Exact DESIGN.md Level 1 glass values.
const GlassCard = ({ children, className = '' }) => (
  <div
    style={{
      background: 'rgba(255,255,255,0.72)',
      backdropFilter: 'blur(20px) saturate(170%)',
      WebkitBackdropFilter: 'blur(20px) saturate(170%)',
      border: '1px solid rgba(255,255,255,0.85)',
      borderRadius: '18px',
      boxShadow:
        '0 8px 32px 0 rgba(88,86,214,0.06), 0 2px 8px 0 rgba(30,31,59,0.03)',
    }}
    className={className}
  >
    {children}
  </div>
);

// ── Icon pill — shared container ──────────────────────────────────────────────
const IconPill = ({ children }) => (
  <div
    className="flex-shrink-0 w-10 h-10 rounded-[14px] flex items-center justify-center text-brand-indigo"
    style={{
      background: 'rgba(88,86,214,0.08)',
      border: '1px solid rgba(88,86,214,0.14)',
    }}
  >
    {children}
  </div>
);

// ── CommunityInsight component ────────────────────────────────────────────────

const CommunityInsight = () => {
  // ── State — UNCHANGED from original ────────────────────────────────────────
  const [pincode, setPincode]   = useState(null);
  const [insights, setInsights] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  // ── Data fetch — UNCHANGED from original ───────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const fetchInsights = async () => {
      setLoading(true);
      setError(null);

      try {
        const token = await auth.currentUser.getIdToken();
        const res = await fetch(`${API_BASE}/api/community/insights`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          throw new Error(`Server error ${res.status}`);
        }

        const data = await res.json();
        if (cancelled) return;

        setPincode(data.pincode || null);
        setInsights(data.insights || []);
      } catch (err) {
        if (!cancelled) {
          console.error('[CommunityInsight] fetch error:', err);
          setError('Could not load community data.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchInsights();
    return () => { cancelled = true; };
  }, []);

  const displayPincode = pincode ?? '…';

  // ── Shared card style — compact Level 1 glass ────────────────────────────
  const cardStyle = {
    background: 'rgba(255,255,255,0.72)',
    backdropFilter: 'blur(20px) saturate(170%)',
    WebkitBackdropFilter: 'blur(20px) saturate(170%)',
    border: '1px solid rgba(255,255,255,0.85)',
    borderRadius: '16px',
    boxShadow: '0 6px 22px rgba(88,86,214,0.07), 0 2px 6px rgba(30,31,59,0.03)',
  };

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={cardStyle} className="flex items-center gap-3 px-4 py-3.5 md:px-5">
        <div className="flex-shrink-0 w-9 h-9 rounded-[12px] bg-brand-indigo/[0.06] animate-pulse" />
        <div className="flex-1 space-y-1.5">
          <div className="h-2.5 w-28 rounded-full bg-brand-indigo/[0.08] animate-pulse" />
          <div className="h-3 w-44 rounded-full bg-on-surface/[0.07] animate-pulse" />
          <div className="h-2.5 w-56 rounded-full bg-on-surface/[0.05] animate-pulse" />
        </div>
        <div className="flex-shrink-0 w-10 h-7 rounded-lg bg-brand-indigo/[0.06] animate-pulse" />
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div style={cardStyle} className="flex items-center gap-3 px-4 py-3.5 md:px-5">
        <IconPill><BarChartIcon /></IconPill>
        <div className="flex-1">
          <p className="text-[10px] font-semibold tracking-[0.14em] uppercase text-brand-indigo/65 font-display mb-0.5">
            Community Insights
          </p>
          <p className="text-[13px] text-on-surface-variant font-body">{error}</p>
        </div>
      </div>
    );
  }

  // ── No pincode ─────────────────────────────────────────────────────────────
  if (!pincode) {
    return (
      <div style={cardStyle} className="flex items-center gap-3 px-4 py-3.5 md:px-5">
        <IconPill><BarChartIcon /></IconPill>
        <div className="flex-1">
          <p className="text-[10px] font-semibold tracking-[0.14em] uppercase text-brand-indigo/65 font-display mb-0.5">
            Community Insights
          </p>
          <p className="text-[13px] text-on-surface-variant font-body">
            Complete your profile to see health activity in your area.
          </p>
        </div>
      </div>
    );
  }

  // ── Privacy suppression fallback ───────────────────────────────────────────
  if (insights.length === 0) {
    return (
      <div style={cardStyle} className="flex items-center gap-3 px-4 py-3.5 md:px-5">
        <IconPill><BarChartIcon /></IconPill>
        <div className="flex-1">
          <p className="text-[10px] font-semibold tracking-[0.14em] uppercase text-brand-indigo/65 font-display mb-0.5">
            Community Insights · {displayPincode}
          </p>
          <p className="text-[13px] text-on-surface-variant font-body">{PRIVACY_FALLBACK}</p>
        </div>
      </div>
    );
  }

  // ── Loaded — compact horizontal row, ALL insights via map() ───────────────
  // Data lock: fetchInsights(), API endpoint, auth, state, mapping UNCHANGED.
  // insights.map() renders every record — no slicing, no filtering.

  // ── Stay Healthy data derivation ─────────────────────────────────────────
  // Collects prevention tips grouped by category so category context is
  // preserved when multiple categories return tips. Rules per spec:
  //   1. Ignore rows where prevention_tips is missing or not an array.
  //   2. Ignore empty tip arrays.
  //   3. Keep only non-empty string tips.
  //   4. Deduplicate across all groups (global seen set).
  //   5. Cap total unique tips at 5.
  //   6. Use the first valid non-empty prevention_framing as section framing.
  // Backward-compatible: old API responses without these fields → section hidden.
  const stayHealthyFraming = (() => {
    for (const row of insights) {
      if (typeof row.prevention_framing === 'string' && row.prevention_framing.trim()) {
        return row.prevention_framing.trim();
      }
    }
    return null;
  })();

  // tipGroups: [{ label: string, tips: string[] }] — per category, deduped globally
  const tipGroups = (() => {
    const seen = new Set();
    let totalCount = 0;
    const MAX_TIPS = 5;
    const groups = [];

    for (const row of insights) {
      if (!Array.isArray(row.prevention_tips)) continue;
      const validTips = [];
      for (const tip of row.prevention_tips) {
        if (totalCount >= MAX_TIPS) break;
        if (typeof tip === 'string' && tip.trim() && !seen.has(tip.trim())) {
          seen.add(tip.trim());
          validTips.push(tip.trim());
          totalCount++;
        }
      }
      if (validTips.length > 0) {
        groups.push({ label: row.display_label || row.symptom_category, tips: validTips });
      }
    }
    return groups;
  })();

  // Show Stay Healthy only when both framing and at least one tip are available.
  const showStayHealthy = stayHealthyFraming !== null && tipGroups.length > 0;
  // When only one category has tips, suppress the category sub-label (cleaner layout).
  const showCategoryLabels = tipGroups.length > 1;

  return (
    <div style={cardStyle}>
      {insights.map(({ symptom_category, count_last_7_days, display_label }, idx) => (
        <div
          key={symptom_category}
          className={[
            'flex items-center gap-3 px-4 py-3.5 md:px-5',
            idx > 0 ? 'border-t border-white/40' : '',
          ].join(' ')}
        >
          {/* LEFT: icon */}
          <IconPill><BarChartIcon /></IconPill>

          {/* CENTER: eyebrow + label + description */}
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold tracking-[0.14em] uppercase text-brand-indigo/65 mb-0.5 font-display">
              Community Insights · {displayPincode}
            </p>
            <h3 className="text-[14px] font-bold text-on-surface leading-tight font-display truncate mb-0.5">
              {display_label}
            </h3>
            <p className="text-[11px] text-on-surface-variant font-body leading-snug">
              Symptom activity in your area — last 7 days. Anonymised, aggregated data only.
            </p>
          </div>

          {/* RIGHT: count + label + chevron */}
          <div className="flex-shrink-0 flex items-center gap-1.5">
            <div className="text-right">
              <p className="text-[18px] font-bold text-on-surface leading-none font-display tabular-nums">
                {count_last_7_days}
              </p>
              <p className="text-[10px] text-on-surface-variant font-body">
                report{count_last_7_days !== 1 ? 's' : ''}
              </p>
            </div>
            <span className="text-on-surface-variant/50">
              <ChevronRight />
            </span>
          </div>
        </div>
      ))}

      {/* ── Stay Healthy section ─────────────────────────────────────────────
          Rendered only when valid prevention_framing + prevention_tips are
          returned by the backend.  Absent in old API responses → not shown.
          Located INSIDE the same outer card, after all insight rows.
          Individual insight rows above are NOT modified.
          ────────────────────────────────────────────────────────────────────── */}
      {showStayHealthy && (
        <div
          className="px-4 py-4 md:px-5"
          style={{ borderTop: '1px solid rgba(255,255,255,0.40)' }}
        >
          {/* Section header */}
          <div className="flex items-center gap-2 mb-2">
            {/* Leaf icon — inline SVG, no new dependency */}
            <svg
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="w-4 h-4 flex-shrink-0"
              aria-hidden="true"
              style={{ color: 'rgba(22,163,74,0.85)' }}
            >
              <path
                d="M3 17c2-5 5-9 14-13C15 8 13 12 9 15l-2 2H3z"
                fill="currentColor"
                opacity="0.75"
              />
              <path
                d="M9 15c0-4 2-8 8-11"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                opacity="0.55"
              />
            </svg>
            <p
              className="text-[10px] font-semibold tracking-[0.14em] uppercase font-display"
              style={{ color: 'rgba(22,163,74,0.80)' }}
            >
              Stay Healthy
            </p>
          </div>

          {/* Framing sentence — exact backend text, not paraphrased */}
          <p className="text-[12px] text-on-surface-variant font-body leading-relaxed mb-3">
            {stayHealthyFraming}
          </p>

          {/* Tips — grouped by category label when multiple categories present */}
          <div className="space-y-2.5">
            {tipGroups.map(({ label, tips }) => (
              <div key={label}>
                {showCategoryLabels && (
                  <p className="text-[10px] font-semibold text-brand-indigo/55 font-display mb-1 uppercase tracking-[0.10em]">
                    {label}
                  </p>
                )}
                <ul
                  className="space-y-1.5"
                  aria-label={showCategoryLabels ? `${label} tips` : 'Health tips'}
                >
                  {tips.map((tip, i) => (
                    <li key={i} className="flex items-start gap-2">
                      {/* Checkmark — inline character, no icon dependency */}
                      <span
                        className="flex-shrink-0 mt-[1px] text-[12px] font-bold leading-none"
                        aria-hidden="true"
                        style={{ color: 'rgba(22,163,74,0.80)' }}
                      >
                        ✓
                      </span>
                      <span className="text-[12px] text-on-surface-variant font-body leading-snug">
                        {tip}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CommunityInsight;
