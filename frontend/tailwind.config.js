/** @type {import('tailwindcss').Config} */

// ─────────────────────────────────────────────────────────────────────────────
// Stage 1 — Ethereal Clinical Glass design-token foundation
// Source of truth: C:\Users\EJU\Desktop\Aiims Delhi\DESIGN.md
//
// TOKEN HIERARCHY (do NOT collapse these into one value):
//   A. DESIGN.md role tokens   — formal Material-style semantic roles
//   B. Brand atmospheric hues  — visual/gradient hues from DESIGN.md prose
//   C. Arogya360 locked tokens — ESI colors locked per claude.md (medical safety)
//
// RADIUS MAPPING (Option C — do NOT override Tailwind built-ins):
//   DESIGN.md rounded-sm  (0.25rem / 4px)  → Tailwind rounded-sm  (unchanged)
//   DESIGN.md rounded     (0.5rem  / 8px)  → Tailwind rounded     (unchanged)
//   DESIGN.md rounded-md  (0.75rem / 12px) → Tailwind rounded-xl  (closest native = 0.75rem)
//              NOTE: Tailwind rounded-xl = 0.75rem = 12px (matches DESIGN.md rounded-md)
//   DESIGN.md rounded-lg  (1rem    / 16px) → Tailwind rounded-2xl (1rem = 16px)
//   DESIGN.md rounded-xl  (1.5rem  / 24px) → Tailwind rounded-3xl (1.5rem = 24px)
//   DESIGN.md rounded-full (9999px)        → Tailwind rounded-full (unchanged)
//   Cards/panels: rounded-2xl (16px)
//   Dialogs/overlays: rounded-3xl (24px)
// ─────────────────────────────────────────────────────────────────────────────

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {

      // ── A. DESIGN.md ROLE TOKENS (exact values from DESIGN.md frontmatter) ──

      colors: {

        // Surface roles
        'surface':                    '#fcf8ff',
        'surface-dim':                '#d8d7fc',
        'surface-bright':             '#fcf8ff',
        'surface-container-lowest':   '#ffffff',
        'surface-container-low':      '#f5f2ff',
        'surface-container':          '#eeecff',
        'surface-container-high':     '#e8e6ff',
        'surface-container-highest':  '#e1e0ff',
        'on-surface':                 '#181934',
        'on-surface-variant':         '#464554',
        'inverse-surface':            '#2d2e4b',
        'inverse-on-surface':         '#f2efff',
        'outline':                    '#777585',
        'outline-variant':            '#c7c4d6',
        'surface-tint':               '#4f4ccd',
        'surface-variant':            '#e1e0ff',
        'background':                 '#fcf8ff',
        'on-background':              '#181934',

        // Primary role tokens
        'primary':                    '#3f3bbd',
        'on-primary':                 '#ffffff',
        'primary-container':          '#5856d6',
        'on-primary-container':       '#e7e4ff',
        'inverse-primary':            '#c2c1ff',
        'primary-fixed':              '#e2dfff',
        'primary-fixed-dim':          '#c2c1ff',
        'on-primary-fixed':           '#0c006a',
        'on-primary-fixed-variant':   '#3631b4',

        // Secondary role tokens
        'secondary':                  '#0060ac',
        'on-secondary':               '#ffffff',
        'secondary-container':        '#68abff',
        'on-secondary-container':     '#003e73',
        'secondary-fixed':            '#d4e3ff',
        'secondary-fixed-dim':        '#a4c9ff',
        'on-secondary-fixed':         '#001c39',
        'on-secondary-fixed-variant': '#004883',

        // Tertiary role tokens
        'tertiary':                   '#7120b5',
        'on-tertiary':                '#ffffff',
        'tertiary-container':         '#8b40cf',
        'on-tertiary-container':      '#f3e0ff',
        'tertiary-fixed':             '#f0dbff',
        'tertiary-fixed-dim':         '#deb7ff',
        'on-tertiary-fixed':          '#2c0050',
        'on-tertiary-fixed-variant':  '#670fac',

        // Error role tokens
        'error':                      '#ba1a1a',
        'on-error':                   '#ffffff',
        'error-container':            '#ffdad6',
        'on-error-container':         '#93000a',

        // ── B. BRAND ATMOSPHERIC HUES (from DESIGN.md Brand & Style prose) ──
        // Distinct from role tokens above — used for gradients, glows, accents.
        // Primary Violet: CTAs, active selection rings, key workflows
        'brand-gradient-from':        '#706DF2',
        'brand-gradient-to':          '#5856D6',
        'brand-violet':               '#5856D6',
        // Tertiary Iridescent Lilac: glow indicators, pill accents, ambient radials
        'brand-lilac':                '#C084FC',
        // Secondary Celestial Blue: patient monitoring, diagnostic indicators
        'brand-celestial':            '#4A90E2',

        // ── C. AROGYA360 LOCKED TOKENS (claude.md — medical safety, never change) ──
        // ESI emergency detection colors — color-coded medical risk convention
        'esi-emergency':              '#DC2626',   // ESI-1 / ESI-2
        'esi-warning':                '#F59E0B',   // ESI-3
        'esi-success':                '#16A34A',   // ESI-4 / ESI-5

        // brand-indigo: kept for backward compatibility with existing component
        // classNames; value updated to #5856D6 (= primary-container / brand-violet)
        // per Stage 0 approval decision #3.
        // NOTE: Result.jsx jsPDF hardcodes setTextColor(79, 70, 229) = old #4F46E5.
        // That value will be updated manually during Stage 5 (Result).
        'brand-indigo':               '#5856D6',   // was #4F46E5, updated Stage 1

        // brand-purple: kept for backward compatibility
        'brand-purple':               '#7C3AED',
      },

      // ── TYPOGRAPHY (DESIGN.md: Plus Jakarta Sans for headings/metrics/badges/controls,
      //    Inter for body/dense text) ──────────────────────────────────────────
      fontFamily: {
        // font-display → Plus Jakarta Sans (DESIGN.md: headings, metrics, badges, controls)
        // Exact Indic fallback stacks per DESIGN.md multilingual specification:
        //   Hindi:  Plus Jakarta Sans, "Noto Sans Devanagari", "Kohinoor Devanagari", sans-serif
        //   Telugu: Plus Jakarta Sans, "Noto Sans Telugu", "Kohinoor Telugu", sans-serif
        // Combined stack covers both scripts; contextual per-script stacks are
        // available as CSS custom properties (--font-heading-hi, --font-heading-te)
        // in index.css for targeted application when language_pref is active.
        'display': [
          '"Plus Jakarta Sans"',
          '"Noto Sans Devanagari"',
          '"Kohinoor Devanagari"',
          '"Noto Sans Telugu"',
          '"Kohinoor Telugu"',
          'ui-sans-serif',
          'system-ui',
          'sans-serif',
        ],
        // font-sans → also Plus Jakarta Sans (keeps Tailwind default class working
        // for headings and controls that already use font-sans or rely on h1-h6 base)
        'sans': [
          '"Plus Jakarta Sans"',
          '"Noto Sans Devanagari"',
          '"Kohinoor Devanagari"',
          '"Noto Sans Telugu"',
          '"Kohinoor Telugu"',
          'ui-sans-serif',
          'system-ui',
          'sans-serif',
        ],
        // font-body → Inter (body text, dense clinical documentation)
        'body': [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          'sans-serif',
        ],
      },

      // ── FONT SIZE / LINE HEIGHT / LETTER SPACING
      //    (exact DESIGN.md typography scale) ──────────────────────────────────
      fontSize: {
        // Headline scale — Plus Jakarta Sans
        'headline-xl':        ['40px', { lineHeight: '48px', letterSpacing: '-0.025em', fontWeight: '700' }],
        'headline-xl-mobile': ['30px', { lineHeight: '38px', letterSpacing: '-0.02em',  fontWeight: '700' }],
        'headline-lg':        ['32px', { lineHeight: '40px', letterSpacing: '-0.02em',  fontWeight: '600' }],
        'headline-lg-mobile': ['24px', { lineHeight: '32px', letterSpacing: '-0.015em', fontWeight: '600' }],
        'headline-md':        ['24px', { lineHeight: '32px', letterSpacing: '-0.015em', fontWeight: '600' }],
        'headline-sm':        ['20px', { lineHeight: '28px', letterSpacing: '-0.01em',  fontWeight: '600' }],
        // Body scale — Inter
        'body-lg':            ['18px', { lineHeight: '28px', fontWeight: '400' }],
        'body-md':            ['15px', { lineHeight: '24px', fontWeight: '400' }],
        'body-sm':            ['13px', { lineHeight: '20px', fontWeight: '400' }],
        // Metric display — Plus Jakarta Sans
        'metric-display':     ['36px', { lineHeight: '44px', letterSpacing: '-0.03em', fontWeight: '700' }],
        // Label scale — Plus Jakarta Sans
        'label-lg':           ['14px', { lineHeight: '20px', letterSpacing: '0.01em',  fontWeight: '600' }],
        'label-md':           ['12px', { lineHeight: '16px', letterSpacing: '0.02em',  fontWeight: '600' }],
        'label-sm':           ['11px', { lineHeight: '14px', letterSpacing: '0.03em',  fontWeight: '500' }],
      },

      // ── BOX SHADOWS (exact DESIGN.md glass elevation values) ────────────────
      boxShadow: {
        // Glass Level 1 — Frosted Panels & Cards
        'glass-1': '0 8px 32px 0 rgba(88, 86, 214, 0.06), 0 2px 8px 0 rgba(30, 31, 59, 0.03)',
        // Glass Level 2 — Interactive Elements, Modals, Flyouts
        'glass-2': '0 16px 48px -4px rgba(88, 86, 214, 0.12), 0 4px 12px 0 rgba(30, 31, 59, 0.05)',
        // Glass Level 3 — Floating Overlays
        'glass-3': '0 24px 64px -8px rgba(30, 31, 59, 0.16)',
        // Level 3 halo (used as ring/glow, not standard box-shadow)
        'glass-3-halo': '0 0 24px 2px rgba(112, 109, 242, 0.25)',
        // Primary button drop shadow (DESIGN.md: 0 8px 20px rgba(88,86,214,0.3))
        'btn-primary': '0 8px 20px rgba(88, 86, 214, 0.30)',
        // Emergency button shadow (visual depth beneath red banner)
        'btn-emergency': '0 4px 16px rgba(220, 38, 38, 0.35)',
        // Language selector active shadow (DESIGN.md: 0 4px 12px rgba(88,86,214,0.1))
        'lang-active': '0 4px 12px rgba(88, 86, 214, 0.10)',
      },

      // ── BACKDROP BLUR (exact DESIGN.md glass levels) ─────────────────────────
      // Note: Tailwind's default scale: blur-sm=4px, blur=8px, blur-md=12px,
      //       blur-lg=16px, blur-xl=24px, blur-2xl=40px, blur-3xl=64px.
      // DESIGN.md Level 1 = 20px (between blur-lg and blur-xl), Level 2 = 28px (between blur-xl and blur-2xl).
      // Adding named tokens for exact DESIGN.md values.
      backdropBlur: {
        'glass-1': '20px',   // Level 1 — Frosted Panels & Cards
        'glass-2': '28px',   // Level 2 — Interactive Elements, Modals
      },

      // ── BACKGROUND IMAGES ────────────────────────────────────────────────────
      backgroundImage: {
        // Primary button gradient (DESIGN.md: linear-gradient(135deg, #706DF2 0%, #5856D6 100%))
        'btn-primary': 'linear-gradient(135deg, #706DF2 0%, #5856D6 100%)',

        // Legacy brand gradient (kept for backward compat; components using this
        // will be migrated to bg-btn-primary in Stage 3+ when components are updated)
        'brand-gradient': 'linear-gradient(to right, #5856D6, #7C3AED)',

        // Page atmosphere (DESIGN.md Atmosphere base layer, dual radial gradients)
        // Applied to Layout body in Stage 2; defined here so the token is available.
        'page-atmosphere': [
          'radial-gradient(circle at 70% 10%, rgba(175, 196, 255, 0.45) 0%, transparent 65%)',
          'radial-gradient(circle at 20% 90%, rgba(226, 206, 255, 0.40) 0%, transparent 70%)',
        ].join(', '),

        // Kids Zone warm atmosphere (Stage 8 adaptation — amber-pearl vs violet-pearl)
        // Defined here so the CSS custom property can reference it from Stage 1 onward.
        'kids-atmosphere': [
          'radial-gradient(circle at 70% 10%, rgba(255, 213, 153, 0.40) 0%, transparent 65%)',
          'radial-gradient(circle at 20% 90%, rgba(255, 235, 180, 0.35) 0%, transparent 70%)',
        ].join(', '),
      },

      // ── SPACING (DESIGN.md scale documented here; Tailwind default 4px base
      //    already covers these — no override needed, just documentation) ───────
      // space-2xs=0.25rem(1), space-xs=0.5rem(2), space-sm=0.75rem(3),
      // space-md=1rem(4), space-lg=1.5rem(6), space-xl=2rem(8),
      // space-2xl=3rem(12), space-3xl=4rem(16)
      // gutter-mobile=1rem, gutter-desktop=1.5rem
      // margin-mobile=1.25rem, margin-desktop=2.5rem
      // All map directly to Tailwind's default spacing scale (p-4, p-6, etc.)
      // No custom spacing additions needed.

    },
  },
  plugins: [],
}
