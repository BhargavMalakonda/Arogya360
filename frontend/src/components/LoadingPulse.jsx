import React, { useEffect, useState } from 'react';

// Rotating messages shown beneath the animation.
// Cycle every 3 seconds so a 9-second Gemini wait never feels frozen.
const MESSAGES = [
  'Analyzing your symptoms\u2026',
  'Thinking through your answer\u2026',
  'Consulting clinical guidelines\u2026',
  'Almost there\u2026',
];

const LoadingPulse = () => {
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setMsgIndex((prev) => (prev + 1) % MESSAGES.length);
    }, 3000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-10 select-none">
      {/*
        SVG ECG-style pulse line.
        The polyline traces a stylised heartbeat waveform.
        stroke-dasharray + stroke-dashoffset animation draws it left-to-right
        continuously, giving the impression of a live signal scrolling across.
        Uses the brand indigo/purple gradient via a <linearGradient> def — NOT
        the esi-* risk colours, which are reserved exclusively for risk results.
      */}
      <svg
        viewBox="0 0 300 60"
        xmlns="http://www.w3.org/2000/svg"
        className="w-64 h-14"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="pulseGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#4F46E5" />   {/* brand-indigo */}
            <stop offset="100%" stopColor="#7C3AED" />  {/* brand-purple */}
          </linearGradient>
        </defs>

        {/*
          Waveform path:
          flat baseline → small notch → sharp QRS spike up → dip below →
          return to baseline → flat → repeat softer bump
          Total width 300 units so the dasharray animation cycles cleanly.
        */}
        <polyline
          points="
            0,30
            40,30
            50,30
            55,22
            60,30
            65,30
            75,5
            82,50
            88,30
            95,30
            108,30
            115,24
            120,30
            130,30
            160,30
            170,30
            175,20
            180,30
            190,30
            210,30
            220,10
            228,48
            234,30
            245,30
            260,30
            268,23
            273,30
            300,30
          "
          fill="none"
          stroke="url(#pulseGradient)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            strokeDasharray: 600,
            strokeDashoffset: 600,
            animation: 'pulseDraw 2s ease-in-out infinite',
          }}
        />

        {/* Fade-out mask on the right edge so the tail disappears smoothly */}
        <defs>
          <linearGradient id="fadeRight" x1="70%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="white" stopOpacity="0" />
            <stop offset="100%" stopColor="white" stopOpacity="1" />
          </linearGradient>
          <mask id="fadeMask">
            <rect width="300" height="60" fill="white" />
            <rect width="300" height="60" fill="url(#fadeRight)" />
          </mask>
        </defs>
        {/* Apply mask via a transparent overlay — no fill, just clips the stroke */}
        <rect
          width="300"
          height="60"
          fill="transparent"
          mask="url(#fadeMask)"
          style={{ pointerEvents: 'none' }}
        />
      </svg>

      {/* Rotating status text */}
      <p
        key={msgIndex}
        className="mt-3 text-sm text-gray-500 animate-pulse transition-all duration-500"
      >
        {MESSAGES[msgIndex]}
      </p>

      {/*
        Keyframe definition injected once into the document head via a <style> tag.
        Using inline style tag is the safest approach without a CSS-in-JS lib or
        a separate .css file — Tailwind doesn't support arbitrary keyframes without
        the JIT arbitrary value syntax, and we don't want to touch tailwind.config.js
        for a single component animation.
      */}
      <style>{`
        @keyframes pulseDraw {
          0%   { stroke-dashoffset: 600; opacity: 0.3; }
          20%  { opacity: 1; }
          80%  { opacity: 1; }
          100% { stroke-dashoffset: 0; opacity: 0.3; }
        }
        /* Reduced-motion: freeze the line mid-draw, keep it visible */
        @media (prefers-reduced-motion: reduce) {
          @keyframes pulseDraw {
            0%, 100% { stroke-dashoffset: 300; opacity: 0.8; }
          }
        }
      `}</style>
    </div>
  );
};

export default LoadingPulse;
