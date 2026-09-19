/**
 * DoctorSummaryPanel.jsx
 *
 * Self-contained panel that handles the full "Generate Doctor Summary"
 * flow for both Result.jsx and HistoryDetail.jsx.
 *
 * Props:
 *   assessmentId  — string  — Firestore document ID of the assessment
 *
 * Auth pattern:
 *   auth.currentUser.getIdToken() — matches the existing pattern in Triage.jsx
 *
 * Privacy:
 *   The QR code encodes ONLY the share_url returned by the backend.
 *   No patient name, UID, email, district, pincode, symptoms, or assessment
 *   data is encoded into the QR or logged to console.
 *
 * The component makes no assumptions about what the share_url looks like;
 * it renders exactly what the backend returns.
 */

import React, { useState, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { auth } from '../lib/firebase';
import SecondaryButton from './SecondaryButton';

const API_BASE = import.meta.env.VITE_API_BASE_URL;

// ── Icons ─────────────────────────────────────────────────────────────────────
const IconQR = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5" aria-hidden="true">
    <path fillRule="evenodd" d="M3 3h5v5H3V3zm1 1v3h3V4H4zm7-1h5v5h-5V3zm1 1v3h3V4h-3zM3 11h5v5H3v-5zm1 1v3h3v-3H4zm9 0h1v1h-1v-1zm0 2h1v1h-1v-1zm2-2h1v1h-1v-1zm0 2h1v1h-1v-1zm-2 2h1v1h-1v-1zm2 0h1v1h-1v-1zM5 5h1v1H5V5zm8 0h1v1h-1V5zM5 13h1v1H5v-1z" clipRule="evenodd"/>
  </svg>
);

const IconCopy = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true">
    <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"/>
    <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"/>
  </svg>
);

const IconCheck = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true">
    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
  </svg>
);

const IconLock = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true">
    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
  </svg>
);

// ── Glass card — matches existing style in Result.jsx ─────────────────────────
const glassStyle = {
  background: 'rgba(255,255,255,0.86)',
  backdropFilter: 'blur(22px) saturate(175%)',
  WebkitBackdropFilter: 'blur(22px) saturate(175%)',
  border: '1px solid rgba(255,255,255,0.92)',
  borderRadius: '20px',
  boxShadow: '0 6px 28px rgba(88,86,214,0.07), 0 2px 8px rgba(30,31,59,0.04)',
};

// ── Format the expires_at string into a readable local time ──────────────────
function formatExpiry(expiresAt) {
  if (!expiresAt) return null;
  try {
    const d = new Date(expiresAt);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return null;
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
const DoctorSummaryPanel = ({ assessmentId }) => {
  const [state, setState] = useState('idle'); // idle | loading | success | error
  const [errorMsg, setErrorMsg] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [copied, setCopied] = useState(false);

  const handleGenerate = useCallback(async () => {
    if (!assessmentId) return;
    setState('loading');
    setErrorMsg('');

    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch(`${API_BASE}/api/summary/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ assessment_id: assessmentId }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        // Do not log token or full response; log only status code
        console.error('[DoctorSummaryPanel] generate failed, status:', res.status);
        const msg =
          res.status === 403
            ? 'You do not have permission to share this assessment.'
            : res.status === 404
            ? 'Assessment not found.'
            : 'Failed to generate summary. Please try again.';
        setErrorMsg(msg);
        setState('error');
        return;
      }

      const data = await res.json();
      // Only destructure the three expected fields — share_token is not needed
      const { share_url, expires_at } = data;
      setShareUrl(share_url || '');
      setExpiresAt(expires_at || '');
      setState('success');
    } catch (err) {
      console.error('[DoctorSummaryPanel] network error');
      setErrorMsg('Unable to reach the server. Please check your connection and try again.');
      setState('error');
    }
  }, [assessmentId]);

  const handleCopy = useCallback(async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback: select the input text so the user can copy manually
    }
  }, [shareUrl]);

  const expiryFormatted = formatExpiry(expiresAt);

  // ── Idle state: just the trigger button ───────────────────────────────────
  if (state === 'idle') {
    return (
      <SecondaryButton onClick={handleGenerate} className="w-full flex items-center justify-center gap-2">
        <IconQR />
        Generate Doctor Summary
      </SecondaryButton>
    );
  }

  // ── Loading state ─────────────────────────────────────────────────────────
  if (state === 'loading') {
    return (
      <div style={glassStyle} className="px-6 py-5 flex items-center gap-4">
        <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(88,86,214,0.09)', border: '1.5px solid rgba(88,86,214,0.20)' }}>
          <div className="w-5 h-5 rounded-full border-2 border-brand-indigo/30 border-t-brand-indigo animate-spin" />
        </div>
        <div>
          <p className="text-[14px] font-semibold text-on-surface font-display leading-tight">
            Generating Private Doctor Summary…
          </p>
          <p className="text-[12px] text-on-surface-variant font-body mt-0.5">
            This usually takes a moment.
          </p>
        </div>
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────────
  if (state === 'error') {
    return (
      <div style={glassStyle} className="px-6 py-5 space-y-3">
        <p className="text-[13px] text-esi-emergency font-body leading-relaxed">{errorMsg}</p>
        <SecondaryButton onClick={handleGenerate} className="w-full flex items-center justify-center gap-2">
          <IconQR />
          Try Again
        </SecondaryButton>
      </div>
    );
  }

  // ── Success state: QR + URL + Copy ───────────────────────────────────────
  return (
    <div style={glassStyle} className="px-6 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-brand-indigo"
          style={{ background: 'rgba(88,86,214,0.09)', border: '1.5px solid rgba(88,86,214,0.20)' }}>
          <IconQR />
        </div>
        <div>
          <h3 className="text-[15px] font-bold text-on-surface font-display leading-tight">
            Private Doctor Summary
          </h3>
          <p className="text-[12px] text-on-surface-variant font-body mt-0.5">
            Share with your doctor by scanning or sending the link.
          </p>
        </div>
      </div>

      {/* QR code — encodes only share_url, no patient data */}
      <div className="flex justify-center">
        <div
          className="p-3 rounded-2xl"
          style={{
            background: '#ffffff',
            border: '1.5px solid rgba(88,86,214,0.18)',
            boxShadow: '0 2px 12px rgba(88,86,214,0.09)',
            display: 'inline-block',
          }}
          aria-label="QR code for doctor summary link"
        >
          <QRCodeSVG
            value={shareUrl}
            size={180}
            level="M"
            marginSize={0}
            style={{ display: 'block' }}
          />
        </div>
      </div>

      {/* Selectable URL */}
      <div>
        <p className="text-[11px] font-semibold tracking-[0.10em] uppercase text-on-surface-variant/60 font-display mb-1.5">
          Share Link
        </p>
        <div
          className="flex items-center gap-2 rounded-xl px-3 py-2.5"
          style={{
            background: 'rgba(88,86,214,0.05)',
            border: '1px solid rgba(88,86,214,0.16)',
          }}
        >
          <p
            className="flex-1 text-[12px] font-body text-brand-indigo break-all select-all leading-relaxed"
            aria-label="Doctor summary URL, select to copy"
          >
            {shareUrl}
          </p>
        </div>
      </div>

      {/* Copy button */}
      <button
        type="button"
        onClick={handleCopy}
        className={[
          'w-full h-[44px] flex items-center justify-center gap-2',
          'rounded-xl text-[13px] font-semibold font-display',
          'border transition-all duration-150',
          copied
            ? 'border-esi-success/60 text-esi-success bg-esi-success/5'
            : 'border-brand-indigo/70 text-brand-indigo bg-transparent hover:bg-brand-indigo/10',
          'focus:outline-none focus:ring-2 focus:ring-brand-indigo focus:ring-offset-1',
          'active:scale-[0.98]',
        ].join(' ')}
        aria-live="polite"
      >
        {copied ? <IconCheck /> : <IconCopy />}
        {copied ? 'Copied!' : 'Copy Link'}
      </button>

      {/* Privacy notice + expiry */}
      <div
        className="rounded-xl px-4 py-3 space-y-1"
        style={{
          background: 'rgba(88,86,214,0.04)',
          border: '1px solid rgba(88,86,214,0.10)',
        }}
      >
        <div className="flex items-start gap-2">
          <IconLock />
          <p className="text-[12px] text-on-surface-variant font-body leading-relaxed">
            This link is view-only and expires in 72 hours. It does not reveal your name
            or location.
          </p>
        </div>
        {expiryFormatted && (
          <p className="text-[11px] text-on-surface-variant/55 font-body pl-6">
            Expires: {expiryFormatted}
          </p>
        )}
      </div>

      {/* Regenerate / dismiss */}
      <button
        type="button"
        onClick={() => setState('idle')}
        className="w-full text-[12px] text-on-surface-variant/55 font-body hover:text-on-surface-variant transition-colors focus:outline-none focus:underline"
      >
        Generate a new link
      </button>
    </div>
  );
};

export default DoctorSummaryPanel;
