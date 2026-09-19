import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

// ── BMI helpers ───────────────────────────────────────────────────────────────
/**
 * Returns { bmi: number, category: string } or null when inputs are invalid.
 * BMI = weight_kg / (height_m)^2, rounded to one decimal place.
 * Categories follow standard WHO thresholds.
 */
function computeBmi(heightCm, weightKg) {
  const h = parseFloat(heightCm);
  const w = parseFloat(weightKg);
  if (!h || !w || h <= 0 || w <= 0) return null;
  const hm = h / 100;
  const bmi = Math.round((w / (hm * hm)) * 10) / 10;
  let category;
  if (bmi < 18.5)       category = 'Underweight';
  else if (bmi < 25)    category = 'Normal';
  else if (bmi < 30)    category = 'Overweight';
  else                  category = 'Obese';
  return { bmi, category };
}

// ── Language options — UNCHANGED ──────────────────────────────────────────────
const LANGUAGE_OPTIONS = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिंदी'  },
  { code: 'te', label: 'తెలుగు' },
];

// ── Shared glass surface ──────────────────────────────────────────────────────
const GlassCard = ({ children, className = '', style = {} }) => (
  <div
    style={{
      background: 'rgba(255,255,255,0.86)',
      backdropFilter: 'blur(22px) saturate(175%)',
      WebkitBackdropFilter: 'blur(22px) saturate(175%)',
      border: '1px solid rgba(255,255,255,0.92)',
      borderRadius: '20px',
      boxShadow: '0 4px 20px rgba(88,86,214,0.07), 0 1px 6px rgba(30,31,59,0.04)',
      ...style,
    }}
    className={className}
  >
    {children}
  </div>
);

// ── Section heading inside a card ─────────────────────────────────────────────
const SectionHeading = ({ eyebrow, title }) => (
  <div className="mb-4">
    {eyebrow && (
      <p className="text-[10px] font-semibold tracking-[0.14em] uppercase text-brand-indigo/65 mb-1 font-display">
        {eyebrow}
      </p>
    )}
    <h2 className="text-[16px] font-bold text-on-surface font-display leading-tight">
      {title}
    </h2>
  </div>
);

// ── Profile field row ─────────────────────────────────────────────────────────
const ProfileRow = ({ icon, label, value }) => (
  <div className="flex items-center justify-between py-3"
    style={{ borderBottom: '1px solid rgba(88,86,214,0.06)' }}>
    <div className="flex items-center gap-2.5 text-[13px] text-on-surface-variant font-body">
      {icon && <span className="text-brand-indigo/60">{icon}</span>}
      {label}
    </div>
    <span className="text-[13px] font-semibold text-on-surface font-display">
      {value || '—'}
    </span>
  </div>
);

// ── Inline SVG icons ──────────────────────────────────────────────────────────
const IconBack = () => (
  <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4" aria-hidden="true">
    <path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconPin = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"
    className="w-3.5 h-3.5" aria-hidden="true">
    <path d="M8 1.5C6.07 1.5 4.5 3.07 4.5 5c0 3 3.5 8 3.5 8s3.5-5 3.5-8c0-1.93-1.57-3.5-3.5-3.5z" strokeLinejoin="round"/>
    <circle cx="8" cy="5" r="1.25"/>
  </svg>
);
const IconHash = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"
    className="w-3.5 h-3.5" aria-hidden="true">
    <path d="M3 6h10M3 10h10M6.5 2l-1.5 12M11.5 2L10 14" strokeLinecap="round"/>
  </svg>
);
const IconLogout = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"
    className="w-4 h-4" aria-hidden="true">
    <path d="M13 3h4v14h-4M9 7l-4 3 4 3M5 10h9" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconCheck = () => (
  <svg viewBox="0 0 12 12" fill="none" className="w-3 h-3" aria-hidden="true">
    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconRuler = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"
    className="w-3.5 h-3.5" aria-hidden="true">
    <rect x="1" y="6" width="14" height="4" rx="1" />
    <path d="M4 6v2M7 6v3M10 6v2M13 6v3" strokeLinecap="round"/>
  </svg>
);

// ── Component ─────────────────────────────────────────────────────────────────
const Profile = () => {
  const { user, userProfile, logout, refreshProfile } = useAuth();
  const navigate = useNavigate();

  // ── State — UNCHANGED ──────────────────────────────────────────────────────
  const [langUpdating, setLangUpdating] = useState(false);
  const [langError, setLangError]       = useState('');

  // ── Body metrics state ─────────────────────────────────────────────────────
  // Seeded from Firestore on mount; empty string means not set.
  const [heightCm, setHeightCm]         = useState(userProfile?.height_cm ?? '');
  const [weightKg, setWeightKg]         = useState(userProfile?.weight_kg ?? '');
  const [metricsUpdating, setMetricsUpdating] = useState(false);
  const [metricsError, setMetricsError]       = useState('');
  const [metricsSaved, setMetricsSaved]       = useState(false);

  // ── Loading state ──────────────────────────────────────────────────────────
  if (!userProfile) {
    return (
      <div className="w-full max-w-[720px] mx-auto px-4 pt-10">
        <GlassCard className="px-6 py-6">
          <p className="text-[13px] text-on-surface-variant font-body">Loading profile…</p>
        </GlassCard>
      </div>
    );
  }

  // ── handleLanguageChange — UNCHANGED logic ─────────────────────────────────
  const handleLanguageChange = async (newLang) => {
    if (newLang === userProfile.language_pref || langUpdating) return;
    setLangUpdating(true);
    setLangError('');
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { language_pref: newLang });
      await refreshProfile();
    } catch (err) {
      console.error('[Profile] language update failed:', err);
      setLangError('Could not update language. Please try again.');
    } finally {
      setLangUpdating(false);
    }
  };

  // ── handleBodyMetricsUpdate ────────────────────────────────────────────────
  // Writes height_cm / weight_kg alongside existing profile fields.
  // Both fields are optional — either may be cleared independently.
  const handleBodyMetricsUpdate = async () => {
    if (metricsUpdating) return;
    setMetricsUpdating(true);
    setMetricsError('');
    setMetricsSaved(false);

    // Validate: if provided, must be a positive number within physiological bounds
    const h = heightCm === '' ? null : parseFloat(heightCm);
    const w = weightKg === '' ? null : parseFloat(weightKg);
    if (h !== null && (isNaN(h) || h < 50 || h > 280)) {
      setMetricsError('Height must be between 50 and 280 cm.');
      setMetricsUpdating(false);
      return;
    }
    if (w !== null && (isNaN(w) || w < 1 || w > 500)) {
      setMetricsError('Weight must be between 1 and 500 kg.');
      setMetricsUpdating(false);
      return;
    }

    try {
      const userRef = doc(db, 'users', user.uid);
      // Store null (not empty string) so Firestore field is cleanly absent when cleared
      await updateDoc(userRef, {
        height_cm: h,
        weight_kg: w,
      });
      await refreshProfile();
      setMetricsSaved(true);
      setTimeout(() => setMetricsSaved(false), 3000);
    } catch (err) {
      console.error('[Profile] body metrics update failed:', err);
      setMetricsError('Could not save. Please try again.');
    } finally {
      setMetricsUpdating(false);
    }
  };

  // Avatar initial
  const initial = userProfile.name?.charAt(0)?.toUpperCase() ?? '?';

  return (
    <div className="w-full max-w-[720px] mx-auto px-4 md:px-6 pt-6 pb-20 space-y-5 page-enter">

      {/* ── Back button — navigate(-1) UNCHANGED ──────────────────────────── */}
      <button
        onClick={() => navigate(-1)}
        aria-label="Go back"
        className={[
          'inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-indigo font-display',
          'hover:text-brand-indigo/80 transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-brand-indigo/40 rounded-lg px-1 py-1',
        ].join(' ')}
      >
        <IconBack />
        Back
      </button>

      {/* ══════════════════════════════════════════════════════════════════════
          PROFILE HEADER CARD
          ══════════════════════════════════════════════════════════════════════ */}
      <GlassCard
        className="px-6 py-6 md:px-8"
        style={{
          background: 'rgba(255,255,255,0.90)',
          backdropFilter: 'blur(28px) saturate(190%)',
          WebkitBackdropFilter: 'blur(28px) saturate(190%)',
        }}
      >
        <div className="flex items-center gap-5">
          {/* Avatar — existing initial from userProfile.name */}
          <div
            className="flex-shrink-0 w-[72px] h-[72px] rounded-full flex items-center justify-center text-white text-[28px] font-bold font-display select-none"
            style={{
              background: 'linear-gradient(135deg, #706DF2 0%, #5856D6 100%)',
              boxShadow: '0 6px 20px rgba(88,86,214,0.35)',
            }}
            aria-hidden="true"
          >
            {initial}
          </div>

          {/* Identity — userProfile.name, userProfile.email */}
          <div className="flex-1 min-w-0">
            <h1 className="text-[20px] font-bold text-on-surface font-display leading-tight truncate">
              {userProfile.name}
            </h1>
            {userProfile.email && (
              <p className="text-[13px] text-on-surface-variant font-body mt-0.5 truncate">
                {userProfile.email}
              </p>
            )}
          </div>
        </div>

        {/* Profile rows — district + pincode, all existing values */}
        <div className="mt-5">
          <ProfileRow icon={<IconPin />}  label="District" value={userProfile.district} />
          <ProfileRow icon={<IconHash />} label="Pincode"  value={userProfile.pincode}  />

        </div>

        <p className="text-[11px] text-on-surface-variant/50 font-body mt-4 leading-relaxed">
          To update other profile details, please contact support or re-complete onboarding.
        </p>
      </GlassCard>

      {/* ══════════════════════════════════════════════════════════════════════
          BODY METRICS — optional height / weight, with neutral BMI readout
          ══════════════════════════════════════════════════════════════════════ */}
      <GlassCard className="px-6 py-5 md:px-8">
        <SectionHeading eyebrow="Optional" title="Body Metrics" />
        <p className="text-[13px] text-on-surface-variant font-body mb-5 leading-relaxed">
          Providing height and weight helps the triage assistant weigh relevant
          risk factors. Both fields are optional.
        </p>

        <div className="grid grid-cols-2 gap-3 mb-4">
          {/* Height input */}
          <div>
            <label
              htmlFor="height-cm"
              className="block text-[11px] font-semibold tracking-[0.10em] uppercase text-on-surface-variant/70 font-display mb-1.5"
            >
              Height (cm)
            </label>
            <input
              id="height-cm"
              type="number"
              inputMode="decimal"
              placeholder="e.g. 165"
              min="50"
              max="280"
              value={heightCm}
              onChange={e => { setHeightCm(e.target.value); setMetricsSaved(false); }}
              className={[
                'w-full h-[44px] rounded-xl px-3',
                'text-[14px] font-semibold text-on-surface font-display',
                'focus:outline-none focus:ring-2 focus:ring-brand-indigo/50',
                'transition-all duration-150',
              ].join(' ')}
              style={{
                background: 'rgba(88,86,214,0.05)',
                border: '1.5px solid rgba(88,86,214,0.18)',
              }}
              aria-describedby="metrics-status"
            />
          </div>

          {/* Weight input */}
          <div>
            <label
              htmlFor="weight-kg"
              className="block text-[11px] font-semibold tracking-[0.10em] uppercase text-on-surface-variant/70 font-display mb-1.5"
            >
              Weight (kg)
            </label>
            <input
              id="weight-kg"
              type="number"
              inputMode="decimal"
              placeholder="e.g. 60"
              min="1"
              max="500"
              value={weightKg}
              onChange={e => { setWeightKg(e.target.value); setMetricsSaved(false); }}
              className={[
                'w-full h-[44px] rounded-xl px-3',
                'text-[14px] font-semibold text-on-surface font-display',
                'focus:outline-none focus:ring-2 focus:ring-brand-indigo/50',
                'transition-all duration-150',
              ].join(' ')}
              style={{
                background: 'rgba(88,86,214,0.05)',
                border: '1.5px solid rgba(88,86,214,0.18)',
              }}
              aria-describedby="metrics-status"
            />
          </div>
        </div>

        {/* Live BMI readout — shown only when both inputs are valid numbers */}
        {(() => {
          const result = computeBmi(heightCm, weightKg);
          if (!result) return null;
          return (
            <div
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl mb-4"
              style={{
                background: 'rgba(88,86,214,0.06)',
                border: '1px solid rgba(88,86,214,0.14)',
              }}
              aria-live="polite"
            >
              <IconRuler />
              <span className="text-[13px] font-semibold text-on-surface font-display">
                BMI {result.bmi}
              </span>
              <span className="text-[12px] text-on-surface-variant font-body">
                — {result.category}
              </span>
            </div>
          );
        })()}

        {/* Save button */}
        <button
          type="button"
          onClick={handleBodyMetricsUpdate}
          disabled={metricsUpdating}
          className={[
            'w-full h-[44px] flex items-center justify-center gap-2',
            'rounded-xl px-5',
            'text-[14px] font-semibold text-white font-display',
            'transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-brand-indigo/40 focus:ring-offset-1',
            'disabled:opacity-50 disabled:cursor-not-allowed hover:-translate-y-px',
          ].join(' ')}
          style={{
            background: 'linear-gradient(135deg, #706DF2 0%, #5856D6 100%)',
            boxShadow: '0 3px 12px rgba(88,86,214,0.30)',
          }}
        >
          {metricsUpdating ? 'Saving…' : 'Save Metrics'}
        </button>

        {/* Feedback — id tied to aria-describedby above */}
        <div id="metrics-status" aria-live="polite">
          {metricsSaved && (
            <p className="text-[12px] text-green-600 font-body mt-2.5 flex items-center gap-1.5">
              <IconCheck />
              Saved
            </p>
          )}
          {metricsUpdating && !metricsSaved && (
            <p className="text-[12px] text-on-surface-variant/65 font-body mt-2.5 flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-indigo animate-ping" />
              Saving…
            </p>
          )}
          {metricsError && (
            <p className="text-[12px] text-esi-emergency font-body mt-2.5">{metricsError}</p>
          )}
        </div>
      </GlassCard>

      {/* ══════════════════════════════════════════════════════════════════════
          LANGUAGE SELECTOR
          handleLanguageChange — UNCHANGED
          LANGUAGE_OPTIONS — UNCHANGED
          Firestore updateDoc — UNCHANGED
          ══════════════════════════════════════════════════════════════════════ */}
      <GlassCard className="px-6 py-5 md:px-8">
        <SectionHeading eyebrow="Preferences" title="Language" />

        {/* Segmented glass capsule — role="group" aria-label UNCHANGED */}
        <div
          role="group"
          aria-label="Select language"
          className="flex items-center p-1 rounded-full"
          style={{
            background: 'rgba(88,86,214,0.06)',
            border: '1px solid rgba(88,86,214,0.14)',
          }}
        >
          {LANGUAGE_OPTIONS.map(({ code, label }) => {
            const isActive = userProfile.language_pref === code;
            return (
              <button
                key={code}
                onClick={() => handleLanguageChange(code)}
                disabled={langUpdating}
                aria-pressed={isActive}
                className={[
                  'flex-1 flex items-center justify-center gap-1.5',
                  'py-2.5 px-3 rounded-full',
                  'text-[14px] font-semibold font-display',
                  'transition-all duration-200',
                  'focus:outline-none focus:ring-2 focus:ring-brand-indigo/50 focus:ring-offset-1',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  // Active: white frosted pill + indigo text + subtle shadow
                  isActive
                    ? 'text-brand-indigo'
                    : 'text-on-surface-variant hover:text-on-surface',
                ].join(' ')}
                style={isActive ? {
                  background: 'rgba(255,255,255,0.95)',
                  boxShadow: '0 2px 8px rgba(88,86,214,0.18), inset 0 1px 1px rgba(255,255,255,0.9)',
                  border: '1px solid rgba(88,86,214,0.20)',
                } : {
                  background: 'transparent',
                  border: '1px solid transparent',
                }}
              >
                {/* Checkmark — active state indicator beyond color */}
                {isActive && <IconCheck />}
                {label}
              </button>
            );
          })}
        </div>

        {/* Saving / error feedback — UNCHANGED states */}
        {langUpdating && (
          <p className="text-[12px] text-on-surface-variant/65 font-body mt-2.5 flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-indigo animate-ping" />
            Saving…
          </p>
        )}
        {langError && (
          <p className="text-[12px] text-esi-emergency font-body mt-2.5">{langError}</p>
        )}
      </GlassCard>

      {/* ══════════════════════════════════════════════════════════════════════
          ACCOUNT — logout
          logout handler from useAuth — UNCHANGED
          ══════════════════════════════════════════════════════════════════════ */}
      <GlassCard className="px-6 py-5 md:px-8">
        <SectionHeading eyebrow="Account" title="Sign Out" />
        <p className="text-[13px] text-on-surface-variant font-body mb-4 leading-relaxed">
          You'll be signed out from your current session on this device.
        </p>

        {/* Logout button — onClick={logout} UNCHANGED */}
        <button
          type="button"
          onClick={logout}
          className={[
            'w-full h-[48px] flex items-center justify-center gap-2.5',
            'rounded-xl px-5',
            'text-[14px] font-semibold font-display',
            'transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-esi-emergency/40 focus:ring-offset-1',
            'hover:-translate-y-px',
          ].join(' ')}
          style={{
            color: '#B91C1C',
            background: 'rgba(220,38,38,0.06)',
            border: '1.5px solid rgba(220,38,38,0.22)',
            boxShadow: '0 2px 8px rgba(220,38,38,0.08)',
          }}
        >
          <IconLogout />
          Log Out
        </button>
      </GlassCard>
    </div>
  );
};

export default Profile;
