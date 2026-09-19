import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import staticLabels from '../lib/staticLabels';

// ── Stage 2 refinement: compact capsule active indicator ─────────────────────
// Active state is now a small frosted capsule tightly wrapping icon + label,
// NOT a background spanning the full nav slot width.
// The NavLink itself stays full-width (flex-1) for hit-target size, but has
// no background. Only the inner <span> capsule gets the soft highlight.
// All routes, NavLink props, icons, labels, and i18n logic are UNCHANGED.

// ── Icons — unchanged SVGs ────────────────────────────────────────────────────
const HomeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    className="w-5 h-5" aria-hidden="true">
    <path d="M3 12L12 3l9 9" />
    <path d="M9 21V12h6v9" />
    <path d="M3 12v9h18v-9" />
  </svg>
);

const TriageIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    className="w-5 h-5" aria-hidden="true">
    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
  </svg>
);

const HistoryIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    className="w-5 h-5" aria-hidden="true">
    <rect x="8" y="2" width="8" height="4" rx="1" />
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <line x1="9" y1="12" x2="15" y2="12" />
    <line x1="9" y1="16" x2="13" y2="16" />
  </svg>
);

const KidsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    className="w-5 h-5" aria-hidden="true">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

const CureAIIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    className="w-5 h-5" aria-hidden="true">
    {/* Heartbeat pulse — represents wellness check-in */}
    <polyline points="3 12 6 12 8 6 10 18 12 10 14 14 16 12 21 12" strokeLinejoin="round"/>
  </svg>
);

// ── NAV_ITEMS — Cure AI inserted between Assess and History ──────────────────
const NAV_ITEMS = [
  { to: '/home',      end: true,  Icon: HomeIcon,    labelKey: 'home'    },
  { to: '/triage',   end: false, Icon: TriageIcon,  labelKey: 'triage'  },
  { to: '/cure-ai',  end: false, Icon: CureAIIcon,  labelKey: 'cureai'  },
  { to: '/history',  end: false, Icon: HistoryIcon, labelKey: 'history' },
  { to: '/kids-zone',end: false, Icon: KidsIcon,    labelKey: 'kids'    },
];

// ── Component ─────────────────────────────────────────────────────────────────
const BottomNav = () => {
  const { userProfile } = useAuth();
  const language = userProfile?.language_pref || 'en';
  const labels = staticLabels[language] || staticLabels.en;

  return (
    // Outer wrapper: fixed, floating 14px from bottom, 16px side margins.
    // The nav itself spans nearly the full viewport (100vw - 32px) so it
    // visually anchors to both edges like the reference, independent of the
    // narrower main content above it.
    <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-3.5 pointer-events-none">
      <nav
        aria-label="Main navigation"
        className={[
          'bg-white/[0.72]',
          '[backdrop-filter:blur(20px)_saturate(170%)]',
          '[-webkit-backdrop-filter:blur(20px)_saturate(170%)]',
          'border border-white/[0.85]',
          'shadow-[0_8px_32px_0_rgba(88,86,214,0.06),0_2px_8px_0_rgba(30,31,59,0.03)]',
          'rounded-3xl',
          'flex items-center justify-around px-1 py-1.5',
          'pointer-events-auto',
          // Full-width: stretches edge-to-edge within the 16px side padding
          'w-full',
        ].join(' ')}
      >
        {NAV_ITEMS.map(({ to, end, Icon, labelKey }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            // NavLink occupies its full equal-width touch target (flex-1).
            // NO background here — active highlight lives on the inner capsule only.
            className={({ isActive }) => [
              'flex flex-col items-center',
              'flex-1 py-2',
              // Color applied at the outer level so icon + label both inherit it
              isActive ? 'text-brand-indigo' : 'text-on-surface-variant',
              'transition-colors duration-200 ease-out',
              'focus:outline-none focus:ring-brand-indigo/40 focus:ring-offset-0',
            ].join(' ')}
          >
            {({ isActive }) => (
              // Inner capsule — compact sizing around icon + label only.
              // mx-auto keeps it centred inside the full-width NavLink.
              <span className={[
                'flex flex-col items-center gap-1',
                'px-2.5 py-1.5',
                // Very compact pill — rounded-xl = 12px
                'rounded-xl',
                // Transition on the capsule background
                'transition-all duration-200 ease-out',
                isActive
                  // Active: subtle translucent indigo fill — more compact
                  ? 'bg-brand-indigo/[0.08] shadow-sm'
                  // Inactive: transparent, with a gentle hover
                  : 'bg-transparent hover:bg-surface-container-low/30',
              ].join(' ')}>

                {/* Icon wrapper — no glow dot, just the icon */}
                <span className="flex items-center justify-center w-5 h-5">
                  <Icon />
                </span>

                {/* Label — smaller text */}
                <span className="text-[9px] font-semibold leading-none tracking-wide max-w-full truncate">
                  {labels[labelKey]}
                </span>

              </span>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
};

export default BottomNav;
