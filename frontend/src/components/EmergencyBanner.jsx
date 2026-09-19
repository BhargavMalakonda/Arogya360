import React from 'react';

/**
 * EmergencyBanner
 *
 * Level-3 emergency surface per DESIGN.md:
 *  - Near-opaque background (ESI-1 red)
 *  - Strong red halo rim glow
 *  - High-contrast white text
 *  - Visually dominant over ALL other content when rendered
 *
 * Props / render logic — UNCHANGED from original:
 *   children:   ReactNode — caller controls inner layout
 *   className:  string    — additional classes if needed
 *
 * Trigger condition is controlled entirely by the parent (Triage.jsx).
 * This component has no show/hide logic of its own — UNCHANGED.
 */
const EmergencyBanner = ({ children, className = '' }) => {
  return (
    <div
      className={`w-full text-white ${className}`}
      style={{
        // Level 3 — near-opaque emergency surface
        background: 'rgba(185,28,28,0.97)',
        // Strong red halo to bleed into the page atmosphere
        boxShadow:
          '0 0 0 1px rgba(220,38,38,0.60), ' +
          '0 8px 40px rgba(185,28,28,0.55), ' +
          '0 2px 8px rgba(185,28,28,0.40)',
        // Subtle bottom border rim for depth separation
        borderBottom: '1px solid rgba(255,255,255,0.12)',
      }}
    >
      {children}
    </div>
  );
};

export default EmergencyBanner;
