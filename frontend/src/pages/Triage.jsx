import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { auth } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import MCQOptionButton from '../components/MCQOptionButton';
import EmergencyBanner from '../components/EmergencyBanner';
import ClinicalHintBox from '../components/ClinicalHintBox';
import LoadingPulse from '../components/LoadingPulse';
import FacilityList, { FACILITY_STATUS } from '../components/FacilityList';
import { findEmergencyCare } from '../lib/placesService';
import { useVoiceInput } from '../hooks/useVoiceInput';

const API_BASE = import.meta.env.VITE_API_BASE_URL;

// ── Helpers — ALL UNCHANGED ───────────────────────────────────────────────────

async function getBearerToken() {
  return auth.currentUser.getIdToken();
}

function isEducatorMode() {
  return localStorage.getItem('educatorMode') === 'true';
}

function isFinalResponse(data) {
  return data.done === true || (data.risk_level && !data.question);
}

function getGeolocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject({ code: 'UNAVAILABLE' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        if (err.code === 1) reject({ code: 'PERMISSION_DENIED' });
        else if (err.code === 3) reject({ code: 'TIMEOUT' });
        else reject({ code: 'UNAVAILABLE' });
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  });
}

// ── Inline SVG icons ──────────────────────────────────────────────────────────

const MicIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"
    className="w-5 h-5" aria-hidden="true">
    <path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z" />
    <path d="M19 10a1 1 0 0 0-2 0 5 5 0 0 1-10 0 1 1 0 0 0-2 0 7 7 0 0 0 6 6.93V19H9a1 1 0 0 0 0 2h6a1 1 0 0 0 0-2h-2v-2.07A7 7 0 0 0 19 10Z" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"
    className="w-4 h-4" aria-hidden="true">
    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ArrowLeftIcon = () => (
  <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"
    className="w-4 h-4" aria-hidden="true">
    <path d="M13 8H3M7 4L3 8l4 4" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ── Shared glass card shell ───────────────────────────────────────────────────
const GlassPanel = ({ children, className = '', style = {} }) => (
  <div
    style={{
      background: 'rgba(255,255,255,0.90)',
      backdropFilter: 'blur(28px) saturate(190%)',
      WebkitBackdropFilter: 'blur(28px) saturate(190%)',
      border: '1px solid rgba(255,255,255,0.96)',
      borderRadius: '20px',
      boxShadow: '0 12px 40px -6px rgba(88,86,214,0.12), 0 3px 10px rgba(30,31,59,0.05), inset 0 1px 1px rgba(255,255,255,0.92)',
      ...style,
    }}
    className={className}
  >
    {children}
  </div>
);

// ── Component ─────────────────────────────────────────────────────────────────

const Triage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { userProfile } = useAuth();

  // ── Follow-up context — UNCHANGED ────────────────────────────────────────
  const followupContextRef = useRef(null);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('arogya360_followup_context');
      if (raw) {
        followupContextRef.current = JSON.parse(raw);
        sessionStorage.removeItem('arogya360_followup_context');
        return;
      }
    } catch {
      // sessionStorage unavailable — fall through
    }
    if (location.state?.isFollowUp) {
      followupContextRef.current = location.state;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── State — ALL UNCHANGED ─────────────────────────────────────────────────
  const [phase, setPhase] = useState('input');
  const [symptomInput, setSymptomInput] = useState('');
  const [error, setError] = useState('');

  const { isSupported: voiceSupported, isListening, transcript, startListening, stopListening } =
    useVoiceInput(userProfile?.language_pref ?? 'en');

  const languagePref = userProfile?.language_pref ?? 'en';

  useEffect(() => {
    if (transcript) setSymptomInput(transcript);
  }, [transcript]);

  const [conversationId, setConversationId] = useState(null);
  const [candidateDiseases, setCandidateDiseases] = useState([]);
  const [history, setHistory] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [emergencyData, setEmergencyData] = useState(null);
  const [emergencyFacilityStatus, setEmergencyFacilityStatus] = useState(null);
  const [emergencyFacilities, setEmergencyFacilities] = useState([]);

  // ── Emergency facility lookup — UNCHANGED ────────────────────────────────
  const loadEmergencyFacilities = async () => {
    setEmergencyFacilityStatus(FACILITY_STATUS.LOADING);
    setEmergencyFacilities([]);
    let lat, lng;
    try {
      ({ lat, lng } = await getGeolocation());
    } catch (geoErr) {
      if (geoErr.code === 'PERMISSION_DENIED') setEmergencyFacilityStatus(FACILITY_STATUS.PERMISSION_DENIED);
      else if (geoErr.code === 'TIMEOUT') setEmergencyFacilityStatus(FACILITY_STATUS.LOCATION_TIMEOUT);
      else setEmergencyFacilityStatus(FACILITY_STATUS.LOCATION_UNAVAILABLE);
      return;
    }
    try {
      const results = await findEmergencyCare(lat, lng);
      setEmergencyFacilities(results);
      setEmergencyFacilityStatus(results.length === 0 ? FACILITY_STATUS.NO_RESULTS : FACILITY_STATUS.LOADED);
    } catch (err) {
      console.error('[Triage] findEmergencyCare error:', err);
      setEmergencyFacilityStatus(FACILITY_STATUS.API_ERROR);
    }
  };

  // ── POST /api/triage/start — UNCHANGED ───────────────────────────────────
  const handleStartAssessment = async (e) => {
    e.preventDefault();
    const symptom = symptomInput.trim();
    if (!symptom) return;
    setError('');
    setPhase('loading');
    try {
      const token = await getBearerToken();
      const res = await fetch(`${API_BASE}/api/triage/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          initial_symptom: symptom,
          language_pref: languagePref,
          ...(followupContextRef.current?.isFollowUp && {
            previous_condition_pattern: followupContextRef.current.previousConditionPattern ?? undefined,
            previous_assessment_date: followupContextRef.current.previousAssessmentDate ?? undefined,
          }),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Server error ${res.status}`);
      }
      const data = await res.json();
      if (data.emergency === true) {
        setEmergencyData(data);
        setPhase('emergency');
        loadEmergencyFacilities();
        return;
      }
      if (isFinalResponse(data)) { navigate(`/result/${data.assessment_id}`); return; }
      setConversationId(data.conversation_id);
      followupContextRef.current = null;
      setCandidateDiseases(data.candidate_diseases || []);
      setCurrentQuestion({ question: data.question, options: data.options, clinical_hint: data.clinical_hint || '' });
      setPhase('asking');
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
      setPhase('input');
    }
  };

  // ── POST /api/triage/next — UNCHANGED ────────────────────────────────────
  const handleOptionSelect = async (selectedOption) => {
    if (phase !== 'asking') return;
    const newTurn = { question: currentQuestion.question, options: currentQuestion.options, answer: selectedOption, clinical_hint: currentQuestion.clinical_hint };
    const updatedHistory = [...history, newTurn];
    setHistory(updatedHistory);
    setPhase('loading');
    setError('');
    try {
      const token = await getBearerToken();
      const res = await fetch(`${API_BASE}/api/triage/next`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          conversation_id: conversationId,
          initial_symptom: symptomInput.trim(),
          history: updatedHistory,
          candidate_diseases: candidateDiseases,
          language_pref: languagePref,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Server error ${res.status}`);
      }
      const data = await res.json();
      if (data.emergency === true) {
        setEmergencyData(data);
        setPhase('emergency');
        loadEmergencyFacilities();
        return;
      }
      if (isFinalResponse(data)) { navigate(`/result/${data.assessment_id}`); return; }
      setCurrentQuestion({ question: data.question, options: data.options, clinical_hint: data.clinical_hint || '' });
      setPhase('asking');
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
      setPhase('asking');
    }
  };

  const educatorMode = isEducatorMode();

  // Progress: matches backend MAX_QUESTIONS = 6 (triage_engine.py line 30)
  // TEMPORARY TESTING: set to 6. To restore original display value, change back to 8.
  const totalQuestions = 6;
  const currentQuestionNumber = history.length + 1;
  const progressPct = Math.round((history.length / totalQuestions) * 100);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    // Outer page container — max-w-[860px] matches Home layout
    <div className="w-full max-w-[860px] mx-auto px-4 md:px-5 pt-4 pb-28 space-y-4 page-enter">

      {/* ══════════════════════════════════════════════════════════════════════
          EMERGENCY BANNER — fixed top, renders IMMEDIATELY on emergency
          — trigger condition UNCHANGED: phase === 'emergency' && emergencyData
          ══════════════════════════════════════════════════════════════════════ */}
      {phase === 'emergency' && emergencyData && (
        <div className="fixed top-0 left-0 right-0 z-50">
          <EmergencyBanner>
            {/* Inner content — visual layout only, data from existing emergencyData */}
            <div className="max-w-[860px] mx-auto flex items-start gap-3 px-4 py-1">
              <div className="flex-shrink-0 mt-0.5">
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-red-100" aria-hidden="true">
                  <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="font-bold text-[15px] leading-tight">{emergencyData.message}</p>
                <p className="text-[13px] opacity-90 mt-0.5 leading-snug">{emergencyData.recommended_action}</p>
              </div>
            </div>
          </EmergencyBanner>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          PHASE: input — symptom entry
          ══════════════════════════════════════════════════════════════════════ */}
      {phase === 'input' && (
        <GlassPanel className="px-6 py-7 md:px-8">
          {/* Header */}
          <p className="text-[11px] font-semibold tracking-[0.14em] uppercase text-brand-indigo/70 mb-3 font-display">
            Symptom Assessment
          </p>
          <h1 className="text-[22px] md:text-[26px] font-bold text-on-surface leading-tight tracking-[-0.015em] font-display mb-2">
            What's bothering you today?
          </h1>
          <p className="text-[13px] text-on-surface-variant font-body mb-6 leading-relaxed">
            Describe what you're feeling in your own words. We'll ask a few follow-up questions to help guide you.
          </p>

          <form onSubmit={handleStartAssessment} className="space-y-4">
            <div>
              <label className="block text-[12px] font-semibold text-on-surface mb-1.5 font-display" htmlFor="symptom-input">
                Describe your symptoms
              </label>

              {/* Textarea + mic button — value/onChange UNCHANGED */}
              <div className="relative">
                <textarea
                  id="symptom-input"
                  rows={4}
                  value={symptomInput}
                  onChange={(e) => setSymptomInput(e.target.value)}
                  placeholder="e.g. I have had fever and body aches for the past two days…"
                  required
                  className={[
                    'w-full px-4 py-3 text-[14px] font-body',
                    'border border-white/60 rounded-xl',
                    'focus:outline-none focus:ring-2 focus:ring-brand-indigo/50 focus:border-brand-indigo/60',
                    'resize-none transition-colors placeholder:text-on-surface-variant/50',
                    'text-on-surface',
                    voiceSupported ? 'pr-12' : '',
                    'bg-white/60 backdrop-blur-sm',
                  ].join(' ')}
                  style={{ boxShadow: 'inset 0 1px 3px rgba(30,31,59,0.06)' }}
                />

                {/* Mic button — onClick/aria-label UNCHANGED */}
                {voiceSupported && (
                  <button
                    type="button"
                    onClick={isListening ? stopListening : startListening}
                    aria-label={isListening ? 'Stop recording' : 'Start voice input'}
                    title={isListening ? 'Tap to stop' : 'Tap to speak'}
                    className={[
                      'absolute right-2.5 bottom-2.5',
                      'w-9 h-9 rounded-full',
                      'flex items-center justify-center',
                      'transition-all duration-200',
                      'focus:outline-none focus:ring-2 focus:ring-brand-indigo/50',
                      isListening
                        ? 'bg-brand-indigo text-white shadow-[0_4px_14px_rgba(88,86,214,0.45)] animate-pulse'
                        : 'bg-white/80 border border-white/70 text-brand-indigo/70 hover:bg-brand-indigo hover:text-white hover:shadow-[0_4px_14px_rgba(88,86,214,0.35)]',
                    ].join(' ')}
                  >
                    <MicIcon />
                  </button>
                )}
              </div>

              {/* Listening indicator */}
              {isListening && (
                <p className="text-[11px] text-brand-indigo mt-1.5 flex items-center gap-1.5 font-body">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-indigo animate-ping" />
                  Listening… speak now
                </p>
              )}

              {!voiceSupported && (
                <p className="text-[11px] text-on-surface-variant/60 mt-1.5 font-body">
                  Voice unavailable — type your question instead.
                </p>
              )}
            </div>

            {error && (
              <p className="text-[13px] text-esi-emergency font-body">{error}</p>
            )}

            <button
              type="submit"
              className={[
                'w-full h-[46px]',
                'bg-[linear-gradient(135deg,#706DF2_0%,#5856D6_100%)]',
                'text-white font-semibold text-[14px] font-display',
                'rounded-xl px-6',
                'shadow-[0_6px_16px_rgba(88,86,214,0.30),inset_0_1px_1px_rgba(255,255,255,0.40)]',
                'hover:brightness-[1.05] hover:shadow-[0_8px_22px_rgba(88,86,214,0.40)]',
                'active:scale-[0.98]',
                'flex items-center justify-center gap-2',
                'transition-all duration-200',
                'focus:outline-none focus:ring-2 focus:ring-brand-indigo/50 focus:ring-offset-2',
              ].join(' ')}
            >
              Start Assessment
              <ArrowRightIcon />
            </button>
          </form>
        </GlassPanel>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          PHASE: loading
          ══════════════════════════════════════════════════════════════════════ */}
      {phase === 'loading' && (
        <GlassPanel className="px-6 py-10 flex flex-col items-center justify-center gap-4">
          <LoadingPulse />
        </GlassPanel>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          PHASE: asking MCQ questions
          ══════════════════════════════════════════════════════════════════════ */}
      {phase === 'asking' && currentQuestion && (
        <GlassPanel className="px-6 py-6 md:px-8 md:py-7">

          {/* Progress header */}
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[10px] font-semibold tracking-[0.14em] uppercase text-brand-indigo/65 font-display mb-0.5">
                Symptom Assessment
              </p>
              <p className="text-[13px] font-semibold text-on-surface font-display">
                Question {currentQuestionNumber} of {totalQuestions}
              </p>
            </div>
            <span className="text-[12px] text-on-surface-variant font-body">
              {progressPct}% complete
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-1.5 rounded-full mb-6 overflow-hidden"
            style={{ background: 'rgba(88,86,214,0.10)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progressPct}%`,
                background: 'linear-gradient(90deg, #706DF2 0%, #5856D6 100%)',
                boxShadow: '0 0 6px rgba(88,86,214,0.45)',
              }}
            />
          </div>

          {/* Question text */}
          <h2 className="text-[20px] md:text-[22px] font-bold text-on-surface leading-snug tracking-[-0.01em] font-display mb-1.5">
            {currentQuestion.question}
          </h2>
          <p className="text-[13px] text-on-surface-variant font-body mb-5 leading-relaxed">
            This helps us understand your symptoms better.
          </p>

          {/* MCQ options — onClick via handleOptionSelect UNCHANGED */}
          <div className="space-y-2.5 mb-5">
            {currentQuestion.options.map((option, idx) => (
              <MCQOptionButton
                key={idx}
                onClick={() => handleOptionSelect(option)}
              >
                {option}
              </MCQOptionButton>
            ))}
          </div>

          {/* Clinical hint */}
          {educatorMode && currentQuestion.clinical_hint && (
            <ClinicalHintBox
              clinicalHint={currentQuestion.clinical_hint}
              educatorMode={true}
              className="mt-3"
            />
          )}

          {/* Previous answers (collapsed) */}
          {history.length > 0 && (
            <details className="mt-4">
              <summary className="text-[12px] text-on-surface-variant cursor-pointer select-none hover:text-on-surface transition-colors">
                View previous answers ({history.length})
              </summary>
              <div className="mt-2 space-y-1.5">
                {history.map((turn, i) => (
                  <div key={i} className="text-[11px] text-on-surface-variant rounded-lg px-3 py-2"
                    style={{ background: 'rgba(88,86,214,0.04)', border: '1px solid rgba(88,86,214,0.08)' }}>
                    <p className="font-semibold text-on-surface">{turn.question}</p>
                    <p className="text-brand-indigo mt-0.5">→ {turn.answer}</p>
                  </div>
                ))}
              </div>
            </details>
          )}

          {error && (
            <p className="text-[13px] text-esi-emergency mt-3 font-body">{error}</p>
          )}

          {/* Back / Continue buttons */}
          <div className="flex items-center justify-between gap-3 mt-6 pt-5 border-t border-white/40">
            <button
              type="button"
              onClick={() => history.length > 0 ? setHistory(h => h.slice(0, -1)) : setPhase('input')}
              className={[
                'h-[44px] px-5 rounded-xl',
                'flex items-center gap-2',
                'text-[13px] font-semibold text-on-surface-variant font-display',
                'border border-white/60 bg-white/50',
                'hover:bg-white/80 hover:text-on-surface',
                'transition-all duration-200',
                'focus:outline-none focus:ring-2 focus:ring-brand-indigo/30',
              ].join(' ')}
            >
              <ArrowLeftIcon />
              Back
            </button>
            <button
              type="button"
              disabled
              className={[
                'h-[44px] px-6 rounded-xl',
                'flex items-center gap-2',
                'text-[13px] font-semibold text-white font-display',
                'bg-[linear-gradient(135deg,#706DF2_0%,#5856D6_100%)]',
                'shadow-[0_4px_14px_rgba(88,86,214,0.28)]',
                'opacity-40 cursor-not-allowed',
                'transition-all duration-200',
              ].join(' ')}
            >
              Continue
              <ArrowRightIcon />
            </button>
          </div>
        </GlassPanel>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          PHASE: emergency
          ══════════════════════════════════════════════════════════════════════ */}
      {phase === 'emergency' && (
        // pt-28 clears the fixed EmergencyBanner
        <div className="pt-28 space-y-4">
          <GlassPanel className="px-6 py-6">
            <p className="text-[15px] text-on-surface font-semibold font-display mb-1">
              Based on what you've described, this may require immediate attention.
            </p>
            <p className="text-[13px] text-on-surface-variant font-body">
              Please seek emergency care now or call emergency services.
            </p>
          </GlassPanel>

          {/* Emergency facility list — Module 2 §1B: populates after banner */}
          {emergencyFacilityStatus !== null && (
            <FacilityList
              facilities={emergencyFacilities}
              status={emergencyFacilityStatus}
              onRetry={loadEmergencyFacilities}
              title="Nearby Emergency Care"
            />
          )}
        </div>
      )}
    </div>
  );
};

export default Triage;
