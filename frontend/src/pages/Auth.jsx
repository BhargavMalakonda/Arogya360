/**
 * Auth.jsx — Arogya360 Authentication Page
 *
 * Layout:
 *   • Full-viewport background: approved image (auth reference.png) via CSS cover
 *   • Fixed header  : "Arogya360" wordmark (text only) + language selector
 *   • Floating card : ONE auth form at a time (Sign In or Sign Up)
 *   • Fixed footer  : branding left, links right — all clickable with modals
 *
 * Authentication:
 *   • isLogin boolean  → Sign In / Sign Up (original mechanism, unchanged)
 *   • Firebase email/password (signInWithEmailAndPassword,
 *     createUserWithEmailAndPassword, sendPasswordResetEmail)
 *   • No new providers added
 *
 * DO NOT modify AuthContext, firebase.js, or any backend file.
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { auth } from '../lib/firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';

// ─── Background image import ─────────────────────────────────────────────────
import bgImage from '../assets/ui-reference/auth-reference.png';

// ═══════════════════════════════════════════════════════════════════════════════
// SVG ICONS  (all inline, no external dep)
// ═══════════════════════════════════════════════════════════════════════════════

const IcGlobe = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10"/>
    <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>
);
const IcChevron = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="6 9 12 15 18 9"/>
  </svg>
);
const IcMail = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="4" width="20" height="16" rx="2"/>
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
  </svg>
);
const IcLock = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="11" width="18" height="11" rx="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);
const IcUser = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="8" r="4"/>
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
  </svg>
);
const IcEye = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);
const IcEyeOff = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);
const IcArrow = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14M12 5l7 7-7 7"/>
  </svg>
);
const IcX = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18"/>
    <line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

// Google "G" — official 4-colour
const GoogleLogo = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);
// Microsoft — official 4-square
const MicrosoftLogo = () => (
  <svg width="15" height="15" viewBox="0 0 21 21" aria-hidden="true">
    <rect x="1"  y="1"  width="9" height="9" fill="#F25022"/>
    <rect x="11" y="1"  width="9" height="9" fill="#7FBA00"/>
    <rect x="1"  y="11" width="9" height="9" fill="#00A4EF"/>
    <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
  </svg>
);

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL — lightweight in-page dialog (no external deps, no routes)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * EDITABLE MODAL CONTENT
 * Replace the placeholder strings below to update the legal / contact text.
 * Each key maps to { title, body } rendered inside the modal.
 */
const MODAL_CONTENT = {
  terms: {
    title: 'Terms of Service',
    body: (
      <div className="space-y-3 text-[13px] text-on-surface-variant leading-relaxed">
        <p className="font-semibold text-on-surface">Last updated: [PLACEHOLDER_DATE]</p>
        <p>
          Welcome to Arogya360. By accessing or using our services you agree to be
          bound by these Terms of Service. Please read them carefully.
        </p>
        <h3 className="font-semibold text-on-surface mt-4">1. Acceptance of Terms</h3>
        <p>[PLACEHOLDER — describe acceptance of terms, eligibility, and user responsibilities.]</p>
        <h3 className="font-semibold text-on-surface">2. Use of Services</h3>
        <p>[PLACEHOLDER — describe permitted and prohibited uses of the Arogya360 platform.]</p>
        <h3 className="font-semibold text-on-surface">3. Health Information Disclaimer</h3>
        <p>[PLACEHOLDER — clarify that Arogya360 provides health guidance only and is not a substitute for professional medical advice.]</p>
        <h3 className="font-semibold text-on-surface">4. Account Responsibilities</h3>
        <p>[PLACEHOLDER — describe account security, credential responsibilities, and account termination.]</p>
        <h3 className="font-semibold text-on-surface">5. Intellectual Property</h3>
        <p>[PLACEHOLDER — describe ownership of content, trademarks, and restrictions on copying.]</p>
        <h3 className="font-semibold text-on-surface">6. Limitation of Liability</h3>
        <p>[PLACEHOLDER — describe liability limitations and disclaimers.]</p>
        <h3 className="font-semibold text-on-surface">7. Governing Law</h3>
        <p>[PLACEHOLDER — specify applicable jurisdiction and governing law, e.g. laws of India.]</p>
        <h3 className="font-semibold text-on-surface">8. Contact</h3>
        <p>[PLACEHOLDER — provide contact details for legal/terms queries.]</p>
      </div>
    ),
  },
  privacy: {
    title: 'Privacy Policy',
    body: (
      <div className="space-y-3 text-[13px] text-on-surface-variant leading-relaxed">
        <p className="font-semibold text-on-surface">Last updated: [PLACEHOLDER_DATE]</p>
        <p>
          Arogya360 is committed to protecting your personal information. This Privacy
          Policy explains how we collect, use, and safeguard your data.
        </p>
        <h3 className="font-semibold text-on-surface mt-4">1. Information We Collect</h3>
        <p>[PLACEHOLDER — list types of data collected: name, email, health inputs, location, device info, etc.]</p>
        <h3 className="font-semibold text-on-surface">2. How We Use Your Information</h3>
        <p>[PLACEHOLDER — describe purposes: providing health guidance, improving the service, communicating updates, etc.]</p>
        <h3 className="font-semibold text-on-surface">3. Data Storage and Security</h3>
        <p>[PLACEHOLDER — describe Firebase/Firestore storage, encryption at rest and in transit, access controls.]</p>
        <h3 className="font-semibold text-on-surface">4. Sharing of Information</h3>
        <p>[PLACEHOLDER — describe any third-party sharing: AI providers, analytics, health authorities.]</p>
        <h3 className="font-semibold text-on-surface">5. Your Rights</h3>
        <p>[PLACEHOLDER — describe user rights: access, correction, deletion, portability under applicable law.]</p>
        <h3 className="font-semibold text-on-surface">6. Cookies and Tracking</h3>
        <p>[PLACEHOLDER — describe use of cookies, local storage, and analytics tools.]</p>
        <h3 className="font-semibold text-on-surface">7. Children's Privacy</h3>
        <p>[PLACEHOLDER — describe policies regarding users under 18.]</p>
        <h3 className="font-semibold text-on-surface">8. Contact</h3>
        <p>[PLACEHOLDER — provide contact details for privacy queries.]</p>
      </div>
    ),
  },
  help: {
    title: 'Help & Support',
    body: (
      <div className="space-y-4 text-[13px] text-on-surface-variant leading-relaxed">
        <p>Find answers to common questions about Arogya360 below.</p>

        <div>
          <p className="font-semibold text-on-surface">How do I sign up?</p>
          <p>[PLACEHOLDER — describe the sign-up process step by step.]</p>
        </div>
        <div>
          <p className="font-semibold text-on-surface">I forgot my password. What do I do?</p>
          <p>Click <strong>Forgot password?</strong> on the Sign In screen and enter your registered email address. You will receive a reset link shortly.</p>
        </div>
        <div>
          <p className="font-semibold text-on-surface">How does the AI triage work?</p>
          <p>[PLACEHOLDER — explain the AI symptom triage engine in plain language.]</p>
        </div>
        <div>
          <p className="font-semibold text-on-surface">Is my health data safe?</p>
          <p>[PLACEHOLDER — brief reassurance about data security, referencing the Privacy Policy.]</p>
        </div>
        <div>
          <p className="font-semibold text-on-surface">How do I delete my account?</p>
          <p>[PLACEHOLDER — describe the account deletion process.]</p>
        </div>
        <div>
          <p className="font-semibold text-on-surface">Still need help?</p>
          <p>
            Email us at{' '}
            <span className="text-brand-indigo font-medium">[PLACEHOLDER_SUPPORT_EMAIL]</span>
          </p>
        </div>
      </div>
    ),
  },
  contact: {
    title: 'Contact Arogya360',
    body: (
      <div className="space-y-4 text-[13px] text-on-surface-variant leading-relaxed">
        <p>We'd love to hear from you. Reach us through any of the channels below.</p>

        <div className="bg-surface-container-low rounded-xl p-4 space-y-3">
          <div>
            <p className="font-semibold text-on-surface text-[12px] uppercase tracking-wide mb-0.5">Email</p>
            <p className="text-brand-indigo">[PLACEHOLDER_EMAIL]</p>
          </div>
          <div>
            <p className="font-semibold text-on-surface text-[12px] uppercase tracking-wide mb-0.5">Phone</p>
            <p>[PLACEHOLDER_PHONE]</p>
          </div>
          <div>
            <p className="font-semibold text-on-surface text-[12px] uppercase tracking-wide mb-0.5">Address</p>
            <p>[PLACEHOLDER_ADDRESS]</p>
          </div>
          <div>
            <p className="font-semibold text-on-surface text-[12px] uppercase tracking-wide mb-0.5">Support Hours</p>
            <p>[PLACEHOLDER_HOURS]</p>
          </div>
        </div>

        <p className="text-[12px]">
          For urgent health concerns, please contact your local healthcare provider or
          emergency services immediately.
        </p>
      </div>
    ),
  },
};

/** Lightweight modal overlay */
const InfoModal = ({ modalKey, onClose }) => {
  const content = MODAL_CONTENT[modalKey];
  if (!content) return null;

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(24, 25, 52, 0.55)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={content.title}
    >
      {/* Panel — stop propagation so clicking inside doesn't close */}
      <div
        className="relative w-full max-w-lg max-h-[80vh] flex flex-col bg-white rounded-3xl shadow-[0_24px_64px_rgba(30,31,59,0.22)] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/30 flex-shrink-0">
          <h2 className="text-[16px] font-bold text-on-surface font-display">{content.title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-outline hover:text-on-surface transition-colors focus:outline-none focus:ring-2 focus:ring-brand-indigo rounded-lg p-1"
            aria-label="Close"
          >
            <IcX />
          </button>
        </div>
        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {content.body}
        </div>
        {/* Footer */}
        <div className="px-6 py-4 border-t border-outline-variant/30 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="
              w-full py-2.5 text-sm font-semibold text-white rounded-xl
              bg-gradient-to-r from-[#706DF2] to-[#5856D6]
              hover:opacity-90 transition-opacity
              focus:outline-none focus:ring-2 focus:ring-brand-indigo focus:ring-offset-1
            "
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED FORM PRIMITIVES
// ═══════════════════════════════════════════════════════════════════════════════

const AuthInput = ({
  id, label, type = 'text', value, onChange, placeholder,
  required, minLength, autoComplete,
  leadingIcon, showToggle = false, showPw = false, onToggle,
}) => (
  <div>
    <label htmlFor={id} className="block text-[11px] font-semibold text-on-surface mb-1 tracking-wide">
      {label}
    </label>
    <div className="relative flex items-center">
      <span className="absolute left-3 text-outline/70 pointer-events-none flex items-center">
        {leadingIcon}
      </span>
      <input
        id={id}
        type={showToggle ? (showPw ? 'text' : 'password') : type}
        value={value}
        onChange={onChange}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className="
          w-full pl-8 pr-8 py-2 text-[13px]
          bg-white/70 border border-outline-variant/60 rounded-xl
          text-on-surface placeholder:text-outline/60
          focus:outline-none focus:ring-2 focus:ring-brand-indigo/25 focus:border-brand-indigo/50
          transition-all duration-150
        "
      />
      {showToggle && (
        <button
          type="button"
          onClick={onToggle}
          tabIndex={-1}
          className="absolute right-3 text-outline/70 hover:text-on-surface-variant transition-colors focus:outline-none"
          aria-label={showPw ? 'Hide password' : 'Show password'}
        >
          {showPw ? <IcEyeOff /> : <IcEye />}
        </button>
      )}
    </div>
  </div>
);

const Divider = ({ text }) => (
  <div className="flex items-center gap-2 my-2.5">
    <div className="flex-1 h-px bg-outline-variant/35" />
    <span className="text-[10px] text-outline/70 whitespace-nowrap">{text}</span>
    <div className="flex-1 h-px bg-outline-variant/35" />
  </div>
);

const SocialRow = () => (
  <div className="flex gap-2">
    {[{ icon: <GoogleLogo />, label: 'Google' }, { icon: <MicrosoftLogo />, label: 'Microsoft' }].map(({ icon, label }) => (
      <button
        key={label}
        type="button"
        disabled
        title={`${label} Sign-In — coming soon`}
        className="
          flex-1 flex items-center justify-center gap-1.5 py-2
          text-[12px] font-medium bg-white/80 border border-outline-variant/60 rounded-xl
          text-on-surface opacity-55 cursor-not-allowed transition-all duration-150
        "
      >
        {icon}<span>{label}</span>
      </button>
    ))}
  </div>
);

const Spinner = () => (
  <svg className="animate-spin h-3.5 w-3.5 mr-1" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
  </svg>
);

const SubmitBtn = ({ loading, label }) => (
  <button
    type="submit"
    disabled={loading}
    className="
      w-full flex items-center justify-center gap-2
      py-2.5 text-[13px] font-semibold text-white rounded-xl
      bg-gradient-to-r from-[#706DF2] to-[#5856D6]
      shadow-[0_4px_14px_rgba(88,86,214,0.30)]
      hover:shadow-[0_6px_18px_rgba(88,86,214,0.40)] hover:opacity-95
      active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed
      transition-all duration-150
      focus:outline-none focus:ring-2 focus:ring-brand-indigo focus:ring-offset-1
    "
  >
    {loading ? <><Spinner />Processing…</> : <>{label} <IcArrow /></>}
  </button>
);

// Segmented Sign In / Sign Up tab inside the card
const TabSwitch = ({ active, onChange }) => (
  <div className="flex rounded-xl border border-outline-variant/50 overflow-hidden mb-4 bg-white/40">
    {[['signin','Sign In'],['signup','Sign Up']].map(([val, label]) => (
      <button
        key={val}
        type="button"
        onClick={() => onChange(val)}
        className={`
          flex-1 py-2 text-[12px] font-semibold transition-all duration-150
          focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-indigo
          ${active === val
            ? 'bg-brand-indigo text-white'
            : 'bg-transparent text-outline hover:text-on-surface hover:bg-white/50'}
        `}
      >
        {label}
      </button>
    ))}
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN AUTH COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

const Auth = () => {
  const { user } = useAuth();
  const navigate  = useNavigate();

  // ── Page state ──────────────────────────────────────────────────────────
  const [isLogin,   setIsLogin]   = useState(true);   // true=SignIn, false=SignUp
  const [modal,     setModal]     = useState(null);   // 'terms'|'privacy'|'help'|'contact'|null
  const [lang,      setLang]      = useState('English');
  const [langOpen,  setLangOpen]  = useState(false);
  const LANGUAGES = ['English', 'हिन्दी', 'తెలుగు'];

  // ── Sign In state ───────────────────────────────────────────────────────
  const [siEmail,    setSiEmail]    = useState('');
  const [siPassword, setSiPassword] = useState('');
  const [siShowPw,   setSiShowPw]   = useState(false);
  const [siError,    setSiError]    = useState('');
  const [siLoading,  setSiLoading]  = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotMsg,  setForgotMsg]  = useState('');

  // ── Sign Up state ───────────────────────────────────────────────────────
  const [suName,    setSuName]    = useState('');
  const [suEmail,   setSuEmail]   = useState('');
  const [suPass,    setSuPass]    = useState('');
  const [suConfirm, setSuConfirm] = useState('');
  const [suShowPw,  setSuShowPw]  = useState(false);
  const [suShowCPw, setSuShowCPw] = useState(false);
  const [suTerms,   setSuTerms]   = useState(false);
  const [suError,   setSuError]   = useState('');
  const [suLoading, setSuLoading] = useState(false);

  // Redirect when already authenticated
  useEffect(() => { if (user) navigate('/'); }, [user, navigate]);

  // ── Tab helpers ─────────────────────────────────────────────────────────
  const goToSignIn = () => {
    setIsLogin(true);
    setSiError(''); setSuError('');
    setForgotMsg(''); setForgotSent(false);
  };
  const goToSignUp = () => {
    setIsLogin(false);
    setSiError(''); setSuError('');
    setForgotMsg(''); setForgotSent(false);
  };
  const handleTab = (val) => val === 'signin' ? goToSignIn() : goToSignUp();

  // ── Forgot password ─────────────────────────────────────────────────────
  const handleForgot = async () => {
    if (!siEmail) { setSiError('Enter your email above first.'); return; }
    setSiError('');
    setSiLoading(true);
    try {
      await sendPasswordResetEmail(auth, siEmail);
      setForgotSent(true);
      setForgotMsg('Reset email sent — check your inbox.');
    } catch {
      setSiError('Could not send reset email. Check the address and try again.');
    } finally {
      setSiLoading(false);
    }
  };

  // ── Sign In submit ──────────────────────────────────────────────────────
  const handleSignIn = async (e) => {
    e.preventDefault();
    setSiError('');
    setSiLoading(true);
    try {
      await signInWithEmailAndPassword(auth, siEmail, siPassword);
    } catch (err) {
      if (['auth/wrong-password','auth/user-not-found','auth/invalid-credential'].includes(err.code)) {
        setSiError('Invalid email or password.');
      } else {
        setSiError(err.message);
      }
    } finally {
      setSiLoading(false);
    }
  };

  // ── Sign Up submit ──────────────────────────────────────────────────────
  const handleSignUp = async (e) => {
    e.preventDefault();
    setSuError('');
    if (suPass !== suConfirm) { setSuError('Passwords do not match.');                                    return; }
    if (!suTerms)             { setSuError('Please agree to the Terms of Service and Privacy Policy.');  return; }
    setSuLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, suEmail, suPass);
    } catch (err) {
      if (err.code === 'auth/email-already-in-use') setSuError('An account with this email already exists.');
      else setSuError(err.message);
    } finally {
      setSuLoading(false);
    }
  };

  // ───────────────────────────────────────────────────────────────────────
  // RENDER
  // ───────────────────────────────────────────────────────────────────────
  return (
    <>
      {/*
       * PAGE SHELL
       * ─────────────────────────────────────────────────────────────────
       * Uses 100dvh (dynamic viewport height) so the value tracks the
       * ACTUAL available viewport — including at any Chrome zoom level.
       * overflow:hidden on the root prevents any document-level scroll.
       *
       * Three rigid flex children:
       *   header   → flex: 0 0 auto   (never grows/shrinks)
       *   main     → flex: 1 1 0      (takes all remaining space)
       *   footer   → flex: 0 0 auto   (never grows/shrinks)
       *
       * The background image is applied ONLY to <main>, not the root,
       * so it never leaks behind the header or footer and always fills
       * exactly the space between them.
       */}
      {/*
       * PAGE SHELL
       * ─────────────────────────────────────────────────────────────────
       * Background covers the ENTIRE viewport including where header/footer
       * appear — they are now overlaid as absolute/fixed layers, not flex
       * children. This makes the background seamless top-to-bottom.
       *
       * The wordmark floats at top-left (absolute).
       * The glass footer sits at the bottom (absolute).
       * Main fills everything between them.
       */}
      <div
        style={{
          position: 'relative',
          width: '100vw',
          height: '100dvh',
          minHeight: 0,
          overflow: 'hidden',
          /* Background covers the full viewport */
          backgroundImage: `url(${bgImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundColor: '#edeeff',
        }}
      >

        {/* ── Floating wordmark — top-left, no header bar ─────────────── */}
        <div
          style={{
            position: 'absolute',
            top: '24px',
            left: '52px',
            zIndex: 40,
            display: 'flex',
            alignItems: 'baseline',
            gap: '1px',
            userSelect: 'none',
          }}
        >
          <span className="font-display" style={{ fontSize: '22px', fontWeight: 800, color: '#1a1a4e', lineHeight: 1, letterSpacing: '-0.02em' }}>
            Arogya
          </span>
          <span className="font-display" style={{ fontSize: '22px', fontWeight: 800, color: '#5856D6', lineHeight: 1, letterSpacing: '-0.02em' }}>
            360
          </span>
        </div>

        {/* ════════════════════════════════════════════════════════════════
            MAIN — fills entire viewport, pads away from wordmark & footer
            ════════════════════════════════════════════════════════════════ */}
        <main
          style={{
            position: 'absolute',
            inset: 0,
            /* top padding clears the floating wordmark (~24px + 22px + 12px buffer) */
            paddingTop: '62px',
            /* bottom padding clears the glass footer (~36px + 4px buffer) */
            paddingBottom: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '62px 16px 44px',
            overflowY: 'auto',
            overflowX: 'hidden',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            zIndex: 10,
          }}
        >
          <style>{`main::-webkit-scrollbar{display:none}`}</style>

          {/* Inner centering wrapper — 3-column layout at desktop:
              LEFT HERO | AUTH CARD | RIGHT FEATURES
              Collapses to single column on narrow viewports. */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              maxWidth: '1200px',
              gap: '0',
            }}
          >
          {/* Subtle scrim */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute', inset: 0,
              background: 'rgba(235,236,255,0.06)',
              pointerEvents: 'none',
            }}
          />

          {/* ── LEFT HERO ──────────────────────────────────────────────
               Positioned to the left of the auth card.
               Hidden on narrow viewports (< lg).
               Never overlaps the card — flex gap provides clearance.    */}
          <div
            className="hidden lg:flex"
            style={{
              flex: '1 1 0',
              minWidth: 0,
              maxWidth: '300px',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'flex-start',
              padding: '0 8px 0 0px',
              position: 'relative',
              zIndex: 20,
              userSelect: 'none',
            }}
          >
            {/* Overline */}
            <p style={{
              fontSize: '9px',
              fontWeight: 700,
              letterSpacing: '0.16em',
              color: 'rgba(70,69,84,0.75)',
              textTransform: 'uppercase',
              lineHeight: 1.4,
              marginBottom: '10px',
            }}>
              HEALTHIER COMMUNITIES<br />STRONGER TOMORROWS
            </p>

            {/* Main heading — Small Steps / Brighter Tomorrows */}
            <div style={{ marginBottom: '12px', lineHeight: 1.249 }}>
              <span style={{
                display: 'block',
                fontFamily: 'var(--font-heading, "Plus Jakarta Sans", sans-serif)',
                fontSize: 'clamp(28px, 2.8vw, 38px)',
                fontWeight: 800,
                color: '#181934',
                letterSpacing: '-0.025em',
              }}>Small</span>
              <span style={{
                display: 'block',
                fontFamily: 'var(--font-heading, "Plus Jakarta Sans", sans-serif)',
                fontSize: 'clamp(28px, 2.8vw, 38px)',
                fontWeight: 800,
                color: '#181934',
                letterSpacing: '-0.025em',
              }}>Steps</span>
              <span style={{
                display: 'block',
                fontFamily: 'var(--font-heading, "Plus Jakarta Sans", sans-serif)',
                fontSize: 'clamp(28px, 2.8vw, 38px)',
                fontWeight: 800,
                letterSpacing: '-0.025em',
                background: 'linear-gradient(135deg, #706DF2 0%, #5856D6 55%, #7C3AED 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>Brighter</span>
              <span style={{
                display: 'block',
                fontFamily: 'var(--font-heading, "Plus Jakarta Sans", sans-serif)',
                fontSize: 'clamp(28px, 2.8vw, 38px)',
                fontWeight: 800,
                letterSpacing: '-0.024em',
                background: 'linear-gradient(135deg, #706DF2 0%, #5856D6 55%, #7C3AED 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>Tomorrows</span>
            </div>

            {/* Accent rule */}
            <div style={{
              width: '28px', height: '3px',
              borderRadius: '99px',
              background: '#5856D6',
              opacity: 0.5,
              marginBottom: '12px',
            }} />

            {/* Subtitle */}
            <p style={{
              fontSize: '13px',
              color: 'rgba(70,69,84,0.85)',
              lineHeight: 1.65,
              maxWidth: '200px',
            }}>
              Preventive care and accessible healthcare for every community<br />across India.
            </p>
          </div>

          {/*
           * FLOATING AUTH CARD
           * ────────────────────────────────────────────────────────────
           * max-h uses a CSS calc against 100% of the main area minus
           * the card's own vertical padding (24px top + 24px bottom).
           * overflow-y: auto inside the card lets Sign Up scroll
           * internally if the viewport is very short — no page scroll.
           */}
          {/*
           * AUTH CARD
           * ─────────────────────────────────────────────────────────────
           * height: auto  — the card grows to fit its natural content.
           * flexShrink: 0 — the card never compresses inside main's flex.
           * No maxHeight constraint — the card determines its own height.
           * The card is centered in <main> by the parent flex centering.
           */}
          <div
            style={{
              position: 'relative',
              zIndex: 20,
              flexShrink: 0,          /* never compress */
              width: '100%',
              maxWidth: '356px',
              height: 'auto',         /* natural content height */
              background: 'rgba(255,255,255,0.84)',
              backdropFilter: 'blur(24px) saturate(200%)',
              WebkitBackdropFilter: 'blur(24px) saturate(200%)',
              border: '1px solid rgba(255,255,255,0.92)',
              borderRadius: '24px',
              boxShadow: '0 24px 64px rgba(30,31,59,0.17), 0 6px 20px rgba(88,86,214,0.11)',
              padding: '22px 26px 20px',
            }}
          >
            {/* Single flat div — no flex, no overflow-y, no inner shrink */}
            <div>

            {/* Card brand (text only inside card — separate from header wordmark) */}
            <div className="flex flex-col items-center mb-4">
              <div className="flex items-baseline gap-0.5 mb-0.5">

              </div>
              <p className="text-[10px] text-outline"></p>
            </div>

            {/* ── SIGN IN ─────────────────────────────────────────────── */}
            {isLogin ? (
              <>
                <div className="text-center mb-3.5">
                  <h2 className="text-[19px] font-bold text-on-surface font-display leading-tight">
                    Welcome Back 👋
                  </h2>
                  <p className="text-[11px] text-outline mt-1">
                    Sign in to continue your health journey
                  </p>
                </div>

                <TabSwitch active="signin" onChange={handleTab} />

                <form onSubmit={handleSignIn} className="space-y-3" noValidate>
                  <AuthInput
                    id="si-email" label="Email" type="email"
                    value={siEmail} onChange={e => setSiEmail(e.target.value)}
                    placeholder="you@example.com" required autoComplete="email"
                    leadingIcon={<IcMail />}
                  />
                  <AuthInput
                    id="si-pass" label="Password" type="password"
                    value={siPassword} onChange={e => setSiPassword(e.target.value)}
                    placeholder="Enter your password" required minLength={6}
                    autoComplete="current-password"
                    leadingIcon={<IcLock />}
                    showToggle showPw={siShowPw} onToggle={() => setSiShowPw(v => !v)}
                  />

                  <div className="flex justify-end -mt-1">
                    <button
                      type="button"
                      onClick={handleForgot}
                      disabled={siLoading || forgotSent}
                      className="text-[11px] text-brand-indigo font-medium hover:underline focus:outline-none disabled:opacity-50"
                    >
                      {forgotSent ? 'Reset email sent ✓' : 'Forgot password?'}
                    </button>
                  </div>

                  {siError   && <p className="text-[11px] text-esi-emergency bg-error-container rounded-lg px-3 py-1.5" role="alert">{siError}</p>}
                  {forgotMsg && <p className="text-[11px] text-emerald-700 bg-emerald-50 rounded-lg px-3 py-1.5" role="status">{forgotMsg}</p>}

                  <SubmitBtn loading={siLoading} label="Sign In" />
                </form>

                <Divider text="or continue with" />
                <SocialRow />

                <p className="text-center text-[11px] text-outline mt-3">
                  New to Arogya360?{' '}
                  <button type="button" onClick={goToSignUp}
                    className="text-brand-indigo font-semibold hover:underline focus:outline-none">
                    Create an account
                  </button>
                </p>
              </>

            ) : (
            /* ── SIGN UP ──────────────────────────────────────────────── */
              <>
                <div className="text-center mb-3.5">
                  <h2 className="text-[19px] font-bold text-on-surface font-display leading-tight">
                    Create Your Account
                  </h2>
                  <p className="text-[11px] text-outline mt-1">
                    Take the first step towards a healthier you.
                  </p>
                </div>

                <TabSwitch active="signup" onChange={handleTab} />

                <form onSubmit={handleSignUp} className="space-y-2.5" noValidate>
                  <AuthInput
                    id="su-name" label="Full Name" type="text"
                    value={suName} onChange={e => setSuName(e.target.value)}
                    placeholder="Enter your full name" required autoComplete="name"
                    leadingIcon={<IcUser />}
                  />
                  <AuthInput
                    id="su-email" label="Email" type="email"
                    value={suEmail} onChange={e => setSuEmail(e.target.value)}
                    placeholder="you@example.com" required autoComplete="email"
                    leadingIcon={<IcMail />}
                  />
                  <AuthInput
                    id="su-pass" label="Password" type="password"
                    value={suPass} onChange={e => setSuPass(e.target.value)}
                    placeholder="Create a password" required minLength={6}
                    autoComplete="new-password"
                    leadingIcon={<IcLock />}
                    showToggle showPw={suShowPw} onToggle={() => setSuShowPw(v => !v)}
                  />
                  <AuthInput
                    id="su-confirm" label="Confirm Password" type="password"
                    value={suConfirm} onChange={e => setSuConfirm(e.target.value)}
                    placeholder="Confirm your password" required minLength={6}
                    autoComplete="new-password"
                    leadingIcon={<IcLock />}
                    showToggle showPw={suShowCPw} onToggle={() => setSuShowCPw(v => !v)}
                  />

                  {/* Terms — both links open the modal */}
                  <label className="flex items-start gap-2 cursor-pointer select-none pt-0.5">
                    <input
                      type="checkbox"
                      checked={suTerms}
                      onChange={e => setSuTerms(e.target.checked)}
                      className="mt-0.5 w-3.5 h-3.5 rounded flex-shrink-0 accent-brand-indigo cursor-pointer"
                    />
                    <span className="text-[11px] text-on-surface-variant leading-relaxed">
                      I agree to the{' '}
                      <button
                        type="button"
                        onClick={e => { e.preventDefault(); setModal('terms'); }}
                        className="text-brand-indigo font-medium hover:underline focus:outline-none"
                      >
                        Terms of Service
                      </button>
                      {' '}and{' '}
                      <button
                        type="button"
                        onClick={e => { e.preventDefault(); setModal('privacy'); }}
                        className="text-brand-indigo font-medium hover:underline focus:outline-none"
                      >
                        Privacy Policy
                      </button>
                    </span>
                  </label>

                  {suError && <p className="text-[11px] text-esi-emergency bg-error-container rounded-lg px-3 py-1.5" role="alert">{suError}</p>}

                  <SubmitBtn loading={suLoading} label="Create Account" />
                </form>

                <Divider text="or sign up with" />
                <SocialRow />

                <p className="text-center text-[11px] text-outline mt-3">
                  Already have an account?{' '}
                  <button type="button" onClick={goToSignIn}
                    className="text-brand-indigo font-semibold hover:underline focus:outline-none">
                    Sign in
                  </button>
                </p>
              </>
            )}
            </div>{/* end inner flat div */}
          </div>{/* end floating card */}

          {/* ── RIGHT FEATURE COLUMN ───────────────────────────────────
               Positioned to the right of the auth card.
               Hidden on narrow viewports (< lg).                        */}
          <div
            className="hidden lg:flex"
            style={{
              flex: '1 1 0',
              minWidth: 0,
              maxWidth: '230px',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: '20px',
              padding: '0 20px 0 24px',
              position: 'relative',
              zIndex: 20,
            }}
          >
            {[
              {
                bg: '#EEF0FF',
                color: '#5856D6',
                title: 'Private & Secure',
                desc: 'Your data stays confidential',
                icon: (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    <path d="m9 12 2 2 4-4"/>
                  </svg>
                ),
              },
              {
                bg: '#E8FAF0',
                color: '#16A34A',
                title: 'Quick & Easy',
                desc: 'Get started in minutes',
                icon: (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                  </svg>
                ),
              },
              {
                bg: '#EEF0FF',
                color: '#5856D6',
                title: 'For Healthier Communities',
                desc: 'Be part of a stronger India',
                icon: (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                ),
              },
              {
                bg: '#FEF0F0',
                color: '#E5484D',
                title: 'Small Steps, Big Impact',
                desc: 'Better health for a brighter tomorrow',
                icon: (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                  </svg>
                ),
              },
            ].map(f => (
              <div key={f.title} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                {/* Icon container */}
                <div style={{
                  flexShrink: 0,
                  width: '36px', height: '36px',
                  borderRadius: '12px',
                  background: f.bg,
                  color: f.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {f.icon}
                </div>
                {/* Text */}
                <div>
                  <p style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    color: '#181934',
                    lineHeight: 1.3,
                    marginBottom: '2px',
                  }}>{f.title}</p>
                  <p style={{
                    fontSize: '11px',
                    color: 'rgba(70,69,84,0.80)',
                    lineHeight: 1.5,
                  }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          </div>{/* end inner centering wrapper */}
        </main>

        {/* ════════════════════════════════════════════════════════════════
            GLASS FOOTER — absolute at bottom, background shows through.
            ════════════════════════════════════════════════════════════════ */}
        <footer
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 30,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '4px 0',
            padding: '8px 52px',
            /* Glass: translucent white-lavender, background visible through */
            background: 'rgba(240,241,255,0.45)',
            backdropFilter: 'blur(14px) saturate(160%)',
            WebkitBackdropFilter: 'blur(14px) saturate(160%)',
            borderTop: '1px solid rgba(255,255,255,0.55)',
          }}
        >
          {/* Left */}
          <div className="flex items-center flex-wrap gap-x-2.5 gap-y-0.5 text-[11px] text-outline">
            <span className="font-bold text-[12px] text-on-surface">Arogya360</span>
            <span className="text-outline-variant" aria-hidden="true">|</span>
            <span>Built for People</span>
            <span className="text-outline-variant" aria-hidden="true">|</span>
            <span>Powered by AI</span>
            <span className="text-outline-variant" aria-hidden="true">|</span>
            <span>A Healthier Tomorrow</span>
          </div>
          {/* Right — all four open modals */}
          <div className="flex items-center gap-x-2.5 text-[11px] text-outline">
            {[
              ['Help',    'help'],
              ['Privacy', 'privacy'],
              ['Terms',   'terms'],
              ['Contact', 'contact'],
            ].map(([label, key], i, arr) => (
              <React.Fragment key={key}>
                <button
                  type="button"
                  onClick={() => setModal(key)}
                  className="hover:text-brand-indigo transition-colors focus:outline-none focus:underline"
                >
                  {label}
                </button>
                {i < arr.length - 1 && <span className="text-outline-variant" aria-hidden="true">|</span>}
              </React.Fragment>
            ))}
          </div>
        </footer>

      </div>{/* end page shell */}

      {/* ── Modal — rendered outside overflow:hidden shell so it can cover everything ── */}
      {modal && <InfoModal modalKey={modal} onClose={() => setModal(null)} />}
    </>
  );
};

export default Auth;
