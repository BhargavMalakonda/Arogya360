/**
 * LottieAnimation.jsx
 *
 * Abstraction layer for animated illustrations in Kids Zone.
 *
 * CURRENT STATE: lottie-react is NOT installed.
 * All animations render as CSS-animated emoji fallbacks (Tailwind animate-*).
 *
 * FUTURE STATE: When lottie-react is approved and installed, set
 * LOTTIE_AVAILABLE = true below and add the import. No other file in the
 * codebase needs to change — callers always use this component by `animationKey`,
 * never by importing Lottie directly.
 *
 * Props:
 *   animationKey  {string}  — logical name for the animation (see ANIMATION_MAP)
 *   size          {string}  — Tailwind w/h classes, e.g. "w-20 h-20" (default)
 *   loop          {boolean} — whether the animation loops (default: true)
 *   className     {string}  — extra classes on the wrapper div
 *
 * Adding a new animation:
 *   1. Add an entry to ANIMATION_MAP below with { fallbackEmoji, animStyle, lottieData }
 *   2. Drop the .json file into frontend/src/assets/kids/ and import it into lottieData
 *   3. No consumer component changes needed
 */

import React from 'react';

// ── Toggle this to true once `npm install lottie-react` has been approved ─────
const LOTTIE_AVAILABLE = false;

// ── Animation registry ────────────────────────────────────────────────────────
// animStyle: Tailwind animation class applied to the emoji when Lottie is absent
// lottieData: import the .json here when LOTTIE_AVAILABLE becomes true
const ANIMATION_MAP = {
  hero: {
    fallbackEmoji: '🧒',
    animStyle:     'animate-bounce',
    lottieData:    null,   // replace with: import heroAnim from '../../assets/kids/hero.json'
  },
  star: {
    fallbackEmoji: '⭐',
    animStyle:     'animate-spin',
    lottieData:    null,
  },
  celebrate: {
    fallbackEmoji: '🎉',
    animStyle:     'animate-bounce',
    lottieData:    null,
  },
  heart: {
    fallbackEmoji: '❤️',
    animStyle:     'animate-pulse',
    lottieData:    null,
  },
  sleep: {
    fallbackEmoji: '😴',
    animStyle:     'animate-pulse',
    lottieData:    null,
  },
  run: {
    fallbackEmoji: '🏃',
    animStyle:     'animate-bounce',
    lottieData:    null,
  },
  water: {
    fallbackEmoji: '💧',
    animStyle:     'animate-bounce',
    lottieData:    null,
  },
  food: {
    fallbackEmoji: '🥗',
    animStyle:     'animate-pulse',
    lottieData:    null,
  },
};

// Fallback for unknown animationKey
const DEFAULT_ANIMATION = {
  fallbackEmoji: '🌈',
  animStyle:     'animate-pulse',
  lottieData:    null,
};

// ── Component ─────────────────────────────────────────────────────────────────
const LottieAnimation = ({
  animationKey = 'hero',
  size         = 'w-20 h-20',
  loop         = true,        // reserved — used by Lottie when enabled; ignored for CSS fallback
  className    = '',
}) => {
  const entry = ANIMATION_MAP[animationKey] ?? DEFAULT_ANIMATION;

  // ── Lottie path (future) ──────────────────────────────────────────────────
  // When LOTTIE_AVAILABLE becomes true and entry.lottieData is populated:
  //
  //   import Lottie from 'lottie-react';
  //   return (
  //     <div className={`${size} ${className}`}>
  //       <Lottie animationData={entry.lottieData} loop={loop} />
  //     </div>
  //   );
  //
  // That is the ENTIRE diff needed in this file. No consumer changes.

  if (LOTTIE_AVAILABLE && entry.lottieData) {
    // Placeholder branch — never reached until LOTTIE_AVAILABLE = true
    // Kept so the code structure is valid and the swap is a one-line uncommment.
    return (
      <div className={`${size} flex items-center justify-center ${className}`}>
        <span className="text-5xl">{entry.fallbackEmoji}</span>
      </div>
    );
  }

  // ── CSS-animated emoji fallback (current active path) ─────────────────────
  return (
    <div
      className={`${size} flex items-center justify-center select-none rounded-full ${className}`}
      role="img"
      aria-label={`${entry.fallbackEmoji} animation`}
      style={{
        background: 'rgba(255,255,255,0.55)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        border: '1.5px solid rgba(255,255,255,0.70)',
        boxShadow: '0 4px 16px rgba(88,86,214,0.10)',
      }}
    >
      <span
        className={`text-5xl leading-none ${entry.animStyle}`}
        aria-hidden="true"
        style={
          entry.animStyle === 'animate-spin'
            ? { animationDuration: '3s' }
            : undefined
        }
      >
        {entry.fallbackEmoji}
      </span>
    </div>
  );
};

export default LottieAnimation;
