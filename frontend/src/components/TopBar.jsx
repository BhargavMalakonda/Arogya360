/**
 * TopBar.jsx — Arogya360 Home Header
 *
 * Reference layout (left → right):
 *   Left  : Arogya360 wordmark
 *   Right : [ 👤 {name} ▼ ]  [ 🎓 Educator ]
 *
 * - Profile pill navigates to /profile (logout is accessible from Profile page)
 * - No visible logout button in the header
 * - Educator pill toggles educatorMode → localStorage (unchanged behaviour)
 * - All existing functionality preserved
 *
 * DO NOT modify AuthContext, firebase.js, or backend.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// ── Icons ─────────────────────────────────────────────────────────────────────

const PersonIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    <path d="M8 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM12.735 14c.618 0 1.093-.561.872-1.139a6.002 6.002 0 0 0-11.215 0c-.22.578.254 1.139.872 1.139h9.471Z" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor"
    strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="4 6 8 10 12 6" />
  </svg>
);

const EducatorIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
    <path d="M6 12v5c3 3 9 3 12 0v-5"/>
  </svg>
);

// Logout door-with-arrow
const LogoutIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
);

// ── TopBar ────────────────────────────────────────────────────────────────────

const TopBar = () => {
  const { user, userProfile, logout } = useAuth();
  const navigate = useNavigate();

  // Educator mode — localStorage persistence unchanged
  const [educatorMode, setEducatorMode] = useState(
    () => localStorage.getItem('educatorMode') === 'true'
  );

  useEffect(() => {
    localStorage.setItem('educatorMode', String(educatorMode));
  }, [educatorMode]);

  const firstName =
    userProfile?.name?.split(' ')[0] ||
    user?.email?.split('@')[0] ||
    'Profile';

  // ── Shared pill style ─────────────────────────────────────────────────────
  const pillBase = [
    'inline-flex items-center gap-1.5',
    'px-3 py-1.5 rounded-full',
    'text-xs font-semibold',
    'border',
    'transition-all duration-150 ease-out',
    'focus:outline-none focus:ring-2 focus:ring-brand-indigo/40 focus:ring-offset-0',
    'select-none cursor-pointer',
  ].join(' ');

  const pillNeutral = [
    pillBase,
    'bg-surface-container-low border-outline-variant/50 text-on-surface',
    'hover:bg-surface-container hover:border-outline-variant',
  ].join(' ');

  const pillActive = [
    pillBase,
    'bg-brand-indigo/10 border-brand-indigo/30 text-brand-indigo',
    'hover:bg-brand-indigo/15',
  ].join(' ');

  return (
    <div className="sticky top-0 z-50 px-3 pt-3 pb-0 pointer-events-none">
      <div
        className={[
          'bg-white/[0.88]',
          '[backdrop-filter:blur(28px)_saturate(190%)]',
          '[-webkit-backdrop-filter:blur(28px)_saturate(190%)]',
          'border border-white/[0.95]',
          'shadow-[0_16px_48px_-4px_rgba(88,86,214,0.12),0_4px_12px_0_rgba(30,31,59,0.05),inset_0_1px_1px_0_rgba(255,255,255,0.9)]',
          'rounded-2xl',
          'flex items-center justify-between px-4 py-2',
          'pointer-events-auto',
          'transition-all duration-200 ease-out',
        ].join(' ')}
      >
        {/* ── Left: Wordmark ─────────────────────────────────────────── */}
        <span className="text-[17px] font-bold tracking-tight font-display select-none">
          <span className="text-on-surface">Arogya</span>
          <span className="text-brand-indigo">360</span>
        </span>

        {/* ── Right: [ Educator ] [ void ▼ ] [ logout icon ] ──────── */}
        <div className="flex items-center gap-2">

          {/* 1. Educator pill — toggles localStorage educatorMode */}
          <button
            type="button"
            onClick={() => setEducatorMode(v => !v)}
            aria-pressed={educatorMode}
            aria-label={educatorMode ? 'Disable Educator mode' : 'Enable Educator mode'}
            className={educatorMode ? pillActive : pillNeutral}
          >
            <EducatorIcon />
            <span className="hidden sm:inline">Educator</span>
          </button>

          {/* 2. Profile pill — navigates to /profile where logout lives */}
          <button
            type="button"
            onClick={() => navigate('/profile')}
            aria-label="View profile"
            className={pillNeutral}
          >
            <PersonIcon />
            <span className="hidden sm:inline max-w-[80px] truncate">{firstName}</span>
            <ChevronDownIcon />
          </button>

          {/* 3. Logout — icon-only pill */}
          <button
            type="button"
            onClick={logout}
            aria-label="Log out"
            className={[
              'inline-flex items-center justify-center',
              'w-8 h-8 rounded-full',
              'bg-surface-container-low border border-outline-variant/50',
              'text-esi-emergency',
              'hover:bg-error-container/30 hover:border-esi-emergency/30',
              'transition-all duration-150 ease-out',
              'focus:outline-none focus:ring-2 focus:ring-esi-emergency/40 focus:ring-offset-0',
            ].join(' ')}
          >
            <LogoutIcon />
          </button>

        </div>
      </div>
    </div>
  );
};

export default TopBar;
