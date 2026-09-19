/**
 * CureAI.jsx  —  /cure-ai
 * ------------------------
 * Cure AI weekly check-in — Stage 4: streak + final polish.
 *
 * Streak logic (pure client-side, derived from the already-fetched checkins):
 *   A "week" is a 7-day ISO calendar bucket (Mon–Sun).
 *   Starting from the current week and walking backwards, count consecutive
 *   weeks that contain at least one check-in.
 *   - Current week with no check-in: streak = 0 (doesn't break the chain if
 *     the user hasn't checked in yet this week — we only count completed weeks
 *     plus the current week if it already has one)
 *   - Any past week with no check-in: streak stops
 *   - 3+ week gap returns streak = 0, warm greeting, no broken/negative state
 *   - Streak 0 is shown as nothing (no badge) — never shown as "0 weeks"
 *   - Streak ≥ 1 shows a small indigo badge: "2-week streak 🔥"
 *
 * Zero-check-ins empty state:
 *   - `listLoading`: two skeleton bubbles
 *   - After load, checkins.length === 0: warm greeting bubble, thread empty,
 *     input bar fully usable — clean, not broken
 *
 * Loading states:
 *   - Submitting: send button disabled, textarea disabled, "sending…" on
 *     optimistic bubble
 *   - Waiting for AI: TypingDots in the AI reply bubble
 *   - Voice transcription: "Listening…" badge + mic ring animation
 *
 * Tone pass — all UI copy uses warm/caring language, not clinical language:
 *   - "How are you feeling?" not "Enter symptoms"
 *   - "Your check-ins" not "Medical records"
 *   - Disclaimers kept minimal and warm
 *
 * BottomNav:
 *   - /cure-ai now in BottomNav between Assess and History (see BottomNav.jsx)
 *   - Dashboard nav (/dashboard/*) unchanged
 */

import React, {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { auth } from '../lib/firebase';
import { useVoiceInput } from '../hooks/useVoiceInput';

const API_BASE = import.meta.env.VITE_API_BASE_URL;

async function apiFetch(path, options = {}) {
  const token = await auth.currentUser.getIdToken();
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization:  `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
}

// ── Streak calculation ────────────────────────────────────────────────────────
/**
 * Returns the number of consecutive weeks (ending at the current week) in
 * which the user had at least one check-in.
 *
 * "Week" = ISO week (Monday-Sunday).  We walk backwards from the current week:
 *   - If the current week has a check-in, it counts (week 0 = this week).
 *   - For each prior week, if no check-in exists, the streak stops.
 *
 * This means:
 *   - Someone who checked in every week for 3 weeks including this week → 3
 *   - Someone who checked in last week but not this week yet → 1
 *     (current week is not broken; we don't penalise a week still in progress)
 *   - Someone who has never checked in → 0 (no badge shown)
 *   - Someone returning after 3 weeks away → 0, warm greeting, no badge
 */
function calcStreak(checkins) {
  if (!checkins || checkins.length === 0) return 0;

  // Get the ISO week key for an arbitrary date (YYYY-Www)
  function isoWeekKey(d) {
    const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    // Thursday in current week decides the year
    tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((tmp - yearStart) / 86400000) + 1) / 7);
    return `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
  }

  // Collect all weeks that have at least one check-in
  const weeksWithCheckin = new Set(
    checkins
      .filter(c => c.created_at)
      .map(c => isoWeekKey(new Date(c.created_at)))
  );

  const now         = new Date();
  let streak        = 0;
  let weekCursor    = new Date(now);

  // Walk backwards week by week, maximum 52 weeks
  for (let i = 0; i < 52; i++) {
    const key = isoWeekKey(weekCursor);
    if (weeksWithCheckin.has(key)) {
      streak++;
    } else if (i === 0) {
      // Current week has no check-in yet — don't break the streak,
      // just don't count it. Continue to check last week.
    } else {
      // A past week with no check-in — streak ends
      break;
    }
    // Move to previous week
    weekCursor.setDate(weekCursor.getDate() - 7);
  }

  return streak;
}

// ── Greeting logic ────────────────────────────────────────────────────────────
const GREETINGS_EMPTY = [
  "Hey! How's your week been? Anything notable you ate, felt, or noticed?",
  "Hi there! What's on your mind health-wise this week?",
  "Good to see you! Tell me how you've been feeling lately.",
];
const GREETINGS_RETURNING = [
  "Welcome back! How have things been going for you?",
  "Good to have you back — how are you doing today?",
  "Hey! Catch me up on how your week went.",
];

function pickGreeting(checkins) {
  if (!checkins || checkins.length === 0) {
    return GREETINGS_EMPTY[Math.floor(Math.random() * GREETINGS_EMPTY.length)];
  }
  const latest = checkins[0]?.created_at;
  if (!latest) return GREETINGS_EMPTY[0];
  const daysSince = (Date.now() - new Date(latest).getTime()) / 86400000;
  // 7+ days (including 3+ week gap) → warm returning greeting, no guilt
  if (daysSince >= 7) {
    return GREETINGS_RETURNING[Math.floor(Math.random() * GREETINGS_RETURNING.length)];
  }
  return null; // recent user: no greeting needed, thread speaks for itself
}

function formatTime(isoStr) {
  if (!isoStr) return '';
  try {
    return new Date(isoStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

function formatDay(isoStr) {
  if (!isoStr) return '';
  try {
    const d   = new Date(isoStr);
    const now = new Date();
    const yest = new Date(now); yest.setDate(now.getDate() - 1);
    if (d.toDateString() === now.toDateString())  return 'Today';
    if (d.toDateString() === yest.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return ''; }
}

// ── Icons ─────────────────────────────────────────────────────────────────────
const IconMic = ({ active }) => (
  <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" aria-hidden="true">
    <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"
      fill={active ? '#5856D6' : 'currentColor'} stroke="none"/>
    <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 19v3M8 22h8"
      stroke={active ? '#5856D6' : 'currentColor'} strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const IconSend = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5" aria-hidden="true">
    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
  </svg>
);

// ── Typing dots ───────────────────────────────────────────────────────────────
const TypingDots = () => (
  <span className="inline-flex items-center gap-1" aria-label="Cure AI is thinking">
    {[0, 1, 2].map(i => (
      <span key={i} className="w-1.5 h-1.5 rounded-full bg-brand-indigo/50"
        style={{ animation: `cureai-bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
    ))}
    <style>{`
      @keyframes cureai-bounce {
        0%, 80%, 100% { transform: translateY(0); }
        40%           { transform: translateY(-5px); }
      }
    `}</style>
  </span>
);

// ── Date separator ────────────────────────────────────────────────────────────
const DateSep = ({ label }) => (
  <div className="flex items-center gap-3 my-3 px-2">
    <div className="flex-1 h-px" style={{ background: 'rgba(88,86,214,0.10)' }}/>
    <span className="text-[11px] text-on-surface-variant/50 font-body flex-shrink-0">{label}</span>
    <div className="flex-1 h-px" style={{ background: 'rgba(88,86,214,0.10)' }}/>
  </div>
);

// ── AI avatar ─────────────────────────────────────────────────────────────────
const CureAvatar = ({ size = 7 }) => (
  <div
    className={`w-${size} h-${size} rounded-full flex items-center justify-center text-white font-bold flex-shrink-0`}
    style={{ background: 'linear-gradient(135deg,#706DF2,#5856D6)', fontSize: size > 7 ? 15 : 11 }}
    aria-hidden="true"
  >C</div>
);

// ── Component ─────────────────────────────────────────────────────────────────
const CureAI = () => {
  const { userProfile } = useAuth();
  const navigate        = useNavigate();
  const langPref        = userProfile?.language_pref || 'en';

  const [checkins,    setCheckins]    = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError,   setListError]   = useState('');
  const [greeting,    setGreeting]    = useState(null);

  const [text,       setText]       = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sendError,  setSendError]  = useState('');

  const threadEndRef = useRef(null);

  const { isSupported: voiceSupported, isListening, transcript, startListening, stopListening }
    = useVoiceInput(langPref);

  useEffect(() => { if (transcript) setText(transcript); }, [transcript]);

  // ── Derived: streak ────────────────────────────────────────────────────────
  const streak = useMemo(() => calcStreak(checkins), [checkins]);

  // ── Load ───────────────────────────────────────────────────────────────────
  const loadCheckins = useCallback(async () => {
    setListLoading(true);
    setListError('');
    try {
      const res  = await apiFetch('/api/checkins');
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      const sorted = [...(data.checkins || [])].reverse(); // chronological
      setCheckins(sorted);
      setGreeting(pickGreeting(data.checkins || [])); // newest-first for gap calc
    } catch (err) {
      console.error('[CureAI] load:', err.message);
      setListError("Couldn't load your check-ins right now. Try again in a moment.");
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => { loadCheckins(); }, [loadCheckins]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [checkins, listLoading]);

  // ── Send ───────────────────────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || submitting) return;
    if (isListening) stopListening();

    setSendError('');
    setSubmitting(true);

    const optId = `_opt_${Date.now()}`;
    const optimistic = {
      id: optId, text: trimmed, created_at: new Date().toISOString(),
      ai_response: null, flagged_urgent: false, _pending: true,
    };
    setCheckins(prev => [...prev, optimistic]);
    setText('');

    try {
      const res = await apiFetch('/api/checkins', {
        method: 'POST',
        body:   JSON.stringify({ text: trimmed }),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const created = await res.json();
      setCheckins(prev => prev.map(c => c.id === optId ? { ...created, _pending: false } : c));
    } catch (err) {
      console.error('[CureAI] send:', err.message);
      setCheckins(prev => prev.filter(c => c.id !== optId));
      setText(trimmed);
      setSendError("Couldn't send right now. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [text, submitting, isListening, stopListening]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleMicToggle = () => {
    if (isListening) { stopListening(); } else { setText(''); startListening(); }
  };

  // ── Thread items with day separators ──────────────────────────────────────
  const threadItems = useMemo(() => {
    const items = [];
    let lastDay = null;
    for (const c of checkins) {
      const day = formatDay(c.created_at);
      if (day && day !== lastDay) {
        items.push({ type: 'datesep', label: day, key: `sep_${c.id}` });
        lastDay = day;
      }
      items.push({ type: 'checkin', data: c, key: c.id });
    }
    return items;
  }, [checkins]);

  // Bubble base style — AI bubbles (left)
  const aiBubble = {
    background:    'rgba(255,255,255,0.88)',
    backdropFilter:'blur(16px)',
    border:        '1px solid rgba(255,255,255,0.90)',
    boxShadow:     '0 2px 12px rgba(88,86,214,0.07)',
    color:         '#1e1f3b',
  };

  return (
    <div className="w-full max-w-[680px] mx-auto flex flex-col"
      style={{ height: 'calc(100vh - 160px)', minHeight: 400 }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-4 md:px-0 pt-4 pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <CureAvatar size={10} />
            <div>
              <h1 className="text-[17px] font-bold text-on-surface font-display leading-tight">
                Cure AI
              </h1>
              <p className="text-[12px] text-on-surface-variant font-body">
                Your weekly check-in
              </p>
            </div>
          </div>

          {/* Streak badge — only shown when streak ≥ 1 */}
          {streak >= 1 && (
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full flex-shrink-0"
              style={{
                background: 'rgba(88,86,214,0.09)',
                border:     '1px solid rgba(88,86,214,0.18)',
              }}
              title={`You've checked in every week for ${streak} week${streak !== 1 ? 's' : ''} in a row!`}
              aria-label={`${streak}-week streak`}
            >
              <span className="text-[13px]" aria-hidden="true">🔥</span>
              <span className="text-[12px] font-bold text-brand-indigo font-display">
                {streak}-week streak
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Thread ──────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 md:px-0 pb-4 space-y-1"
        style={{ scrollbarWidth: 'thin' }}
        aria-live="polite" aria-label="Check-in conversation">

        {/* Loading — two skeleton bubbles */}
        {listLoading && (
          <div className="space-y-3 pt-4">
            {[1, 2].map(i => (
              <div key={i} className="flex justify-end">
                <div className="h-12 w-48 rounded-2xl animate-pulse"
                  style={{ background: 'rgba(88,86,214,0.10)' }}/>
              </div>
            ))}
          </div>
        )}

        {/* Load error */}
        {listError && (
          <div className="mt-4 px-4 py-3 rounded-xl text-[13px] text-esi-emergency font-body"
            style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.18)' }}
            role="alert">{listError}</div>
        )}

        {/* First-time empty state + returning greeting — clean, warm, never broken */}
        {!listLoading && !listError && greeting && (
          <div className="flex items-end gap-2 mt-2">
            <CureAvatar size={7} />
            <div className="max-w-[78%] px-4 py-3 rounded-2xl rounded-bl-sm text-[14px] font-body leading-relaxed"
              style={aiBubble}>
              {greeting}
            </div>
          </div>
        )}

        {/* Thread */}
        {!listLoading && !listError && threadItems.map(item => {
          if (item.type === 'datesep') return <DateSep key={item.key} label={item.label}/>;
          const c = item.data;
          return (
            <div key={item.key} className="space-y-1">
              {/* User bubble — right */}
              <div className="flex justify-end">
                <div className="flex flex-col items-end gap-1 max-w-[80%]">
                  <div className="px-4 py-3 rounded-2xl rounded-br-sm text-[14px] font-body leading-relaxed"
                    style={{
                      background: 'linear-gradient(135deg,#706DF2,#5856D6)',
                      color: '#fff',
                      boxShadow: '0 2px 10px rgba(88,86,214,0.28)',
                      opacity: c._pending ? 0.75 : 1,
                    }}>
                    {c.text}
                  </div>
                  <span className="text-[10px] text-on-surface-variant/45 font-body pr-1">
                    {formatTime(c.created_at)}{c._pending && ' · sending…'}
                  </span>
                </div>
              </div>

              {/* Urgent — redirects to triage */}
              {c.flagged_urgent && (
                <div className="flex justify-end pr-1">
                  <button
                    type="button"
                    onClick={() => navigate('/triage')}
                    className="text-[12px] font-semibold flex items-center gap-1 underline underline-offset-2"
                    style={{ color: '#B91C1C', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    <svg viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3" aria-hidden="true">
                      <path fillRule="evenodd" d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0114.082 15H1.918a1.75 1.75 0 01-1.543-2.575L6.457 1.047zM9 11a1 1 0 11-2 0 1 1 0 012 0zm-.25-5.25a.75.75 0 00-1.5 0v2.5a.75.75 0 001.5 0v-2.5z" clipRule="evenodd"/>
                    </svg>
                    This sounds urgent — tap to check symptoms
                  </button>
                </div>
              )}

              {/* AI bubble — left */}
              {!c.flagged_urgent && (
                <div className="flex items-end gap-2 mt-1">
                  <CureAvatar size={7} />
                  <div className="max-w-[78%] px-4 py-3 rounded-2xl rounded-bl-sm text-[14px] font-body leading-relaxed"
                    style={aiBubble}>
                    {c.ai_response
                      ? c.ai_response
                      : c._pending
                        ? <span className="text-on-surface-variant/40 text-[13px]">Sending…</span>
                        : <TypingDots />
                    }
                  </div>
                </div>
              )}
            </div>
          );
        })}

        <div ref={threadEndRef}/>
      </div>

      {/* ── Input bar ───────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-4 md:px-0 pb-4 pt-2 relative"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>

        {sendError && (
          <p className="text-[12px] text-esi-emergency font-body mb-2 pl-1" role="alert">
            {sendError}
          </p>
        )}

        {/* Voice listening badge — floats above the input bar */}
        {isListening && (
          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1 rounded-full text-[11px] font-semibold text-brand-indigo bg-white shadow-md border border-brand-indigo/20 whitespace-nowrap pointer-events-none z-10">
            Listening…
          </span>
        )}

        <div className="flex items-end gap-2 rounded-2xl px-3 py-2"
          style={{
            background:           'rgba(255,255,255,0.88)',
            backdropFilter:       'blur(22px) saturate(175%)',
            WebkitBackdropFilter: 'blur(22px) saturate(175%)',
            border:               '1.5px solid rgba(88,86,214,0.18)',
            boxShadow:            '0 4px 20px rgba(88,86,214,0.10)',
          }}>

          {/* Text area — always usable, voice is an addition */}
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isListening ? 'Listening…' : 'How are you feeling?'}
            maxLength={4000}
            rows={1}
            disabled={submitting}
            aria-label="Check-in message"
            className={[
              'flex-1 resize-none overflow-hidden bg-transparent',
              'text-[14px] text-on-surface font-body leading-relaxed',
              'focus:outline-none placeholder:text-on-surface-variant/40',
              'disabled:opacity-60 py-1.5',
            ].join(' ')}
            style={{ maxHeight: 120, minHeight: 28 }}
            ref={el => {
              if (el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 120) + 'px'; }
            }}
          />

          {/* Mic button — hidden entirely when SpeechRecognition unavailable */}
          {voiceSupported && (
            <button
              type="button"
              onClick={handleMicToggle}
              disabled={submitting}
              aria-label={isListening ? 'Stop listening' : 'Start voice input'}
              aria-pressed={isListening}
              className={[
                'relative flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center',
                'transition-colors duration-150',
                'focus:outline-none focus:ring-2 focus:ring-brand-indigo/40 disabled:opacity-50',
                isListening
                  ? 'bg-brand-indigo/15 text-brand-indigo'
                  : 'text-on-surface-variant/55 hover:text-brand-indigo',
              ].join(' ')}
            >
              <IconMic active={isListening}/>
              {isListening && (
                <span className="absolute inset-0 rounded-full border-2 border-brand-indigo/40 animate-ping" aria-hidden="true"/>
              )}
            </button>
          )}

          {/* Send button — disabled while submitting or text empty */}
          <button
            type="button"
            onClick={handleSend}
            disabled={submitting || !text.trim()}
            aria-label="Send check-in"
            className={[
              'flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-white',
              'bg-[linear-gradient(135deg,#706DF2,#5856D6)]',
              'shadow-[0_2px_10px_rgba(88,86,214,0.35)]',
              'hover:brightness-110 active:scale-[0.94] transition-all duration-150',
              'disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none',
              'focus:outline-none focus:ring-2 focus:ring-brand-indigo/50',
            ].join(' ')}
          >
            <IconSend/>
          </button>
        </div>

        {/* Char counter — only near limit */}
        {text.length > 3500 && (
          <p className="text-[10px] text-on-surface-variant/45 font-body text-right mt-1 pr-1">
            {text.length}/4000
          </p>
        )}

        <p className="text-[10px] text-on-surface-variant/35 text-center font-body mt-2 leading-relaxed">
          For personal tracking only — not medical advice. If something feels urgent, seek care.
        </p>
      </div>
    </div>
  );
};

export default CureAI;
