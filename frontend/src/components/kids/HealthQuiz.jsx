/**
 * HealthQuiz.jsx
 *
 * Health Quizzes module for Kids Zone.
 * Fully local and deterministic — no API calls, no Gemini, no Firestore.
 * All questions live in kidsQuizzes.js.
 *
 * Props:
 *   onBack     {function}           — return to Kids Zone hub
 *   onXpEarned {function(pts, cat)} — called via KidsZone.jsx which internally
 *                                     calls addProgress(); do NOT import
 *                                     kidsProgress.js here directly.
 *
 * Internal flow:
 *   LIST  → pick a quiz
 *   QUESTION  → answer each MCQ (feedback shown immediately)
 *   SCORE → see result + XP earned, return to list or hub
 */

import React, { useState } from 'react';
import kidsQuizzes from '../../data/kidsQuizzes';

// ── Internal phase constants ──────────────────────────────────────────────────
const PHASE = {
  LIST:     'list',
  QUESTION: 'question',
  SCORE:    'score',
};

// ── Score → star rating (out of 3) ───────────────────────────────────────────
function starsForScore(correct, total) {
  const pct = correct / total;
  if (pct === 1)    return 3;
  if (pct >= 0.6)   return 2;
  if (pct >= 0.2)   return 1;
  return 0;
}

const STAR_MESSAGES = {
  3: { emoji: '🌟🌟🌟', text: 'Perfect score! You are a Health Star!' },
  2: { emoji: '⭐⭐',   text: 'Great work! You know your health stuff!' },
  1: { emoji: '⭐',     text: 'Good try! Read the explanations and try again!' },
  0: { emoji: '💪',     text: 'Keep practising — you will get there!' },
};

// ── Shared glass card ─────────────────────────────────────────────────────────
const KidsGlassCard = ({ children, className = '', style = {} }) => (
  <div
    style={{
      background: 'rgba(255,255,255,0.88)',
      backdropFilter: 'blur(20px) saturate(170%)',
      WebkitBackdropFilter: 'blur(20px) saturate(170%)',
      border: '1px solid rgba(255,255,255,0.92)',
      borderRadius: '18px',
      boxShadow: '0 4px 18px rgba(88,86,214,0.07), 0 1px 5px rgba(30,31,59,0.04)',
      ...style,
    }}
    className={className}
  >
    {children}
  </div>
);

// ── Back / nav button ─────────────────────────────────────────────────────────
const KidsBackBtn = ({ onClick, label, children }) => (
  <button
    onClick={onClick}
    className="text-[13px] text-brand-indigo font-semibold font-display hover:text-brand-indigo/75 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-indigo/40 rounded px-1"
    aria-label={label}
  >
    {children}
  </button>
);

// ── Option button ─────────────────────────────────────────────────────────────
const OptionButton = ({ label, state, onClick, disabled }) => {
  const base =
    'w-full text-left px-4 py-3.5 rounded-2xl border-2 text-[14px] font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-indigo/50 min-h-[48px]';

  const styles = {
    idle:               'bg-white/70 border-white/60 text-on-surface hover:bg-white/90 hover:border-brand-indigo/30 active:scale-98',
    correct:            'bg-green-50 border-green-400 text-green-800',
    incorrect:          'bg-red-50 border-red-400 text-red-700 opacity-80',
    'revealed-correct': 'bg-green-50/60 border-green-300 text-green-700',
  };

  const icons = { correct: '✅ ', incorrect: '❌ ', 'revealed-correct': '✅ ', idle: '' };

  return (
    <button
      className={`${base} ${styles[state] || styles.idle}`}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={state !== 'idle'}
      style={state === 'idle' ? {
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
      } : {}}
    >
      {icons[state] || ''}{label}
    </button>
  );
};

// ── Main component ────────────────────────────────────────────────────────────
const HealthQuiz = ({ onBack, onXpEarned }) => {
  const [phase, setPhase]             = useState(PHASE.LIST);
  const [activeQuiz, setActiveQuiz]   = useState(null);   // full quiz object
  const [qIndex, setQIndex]           = useState(0);       // current question index
  const [selected, setSelected]       = useState(null);    // index of chosen option
  const [correctCount, setCorrectCount] = useState(0);
  const [showExplanation, setShowExplanation] = useState(false);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const currentQuestion = activeQuiz?.questions[qIndex] ?? null;
  const totalQuestions  = activeQuiz?.questions.length ?? 0;
  const isAnswered      = selected !== null;

  const startQuiz = (quiz) => {
    setActiveQuiz(quiz);
    setQIndex(0);
    setSelected(null);
    setCorrectCount(0);
    setShowExplanation(false);
    setPhase(PHASE.QUESTION);
  };

  const handleOptionClick = (idx) => {
    if (isAnswered) return; // already answered this question
    setSelected(idx);
    setShowExplanation(true);
    if (idx === currentQuestion.correct) {
      setCorrectCount((c) => c + 1);
    }
  };

  const handleNext = () => {
    const nextIndex = qIndex + 1;
    if (nextIndex < totalQuestions) {
      setQIndex(nextIndex);
      setSelected(null);
      setShowExplanation(false);
    } else {
      // Quiz finished — award XP via the prop (KidsZone handles addProgress internally)
      const xpEarned = (correctCount + (selected === currentQuestion.correct ? 0 : 0)) // count already updated
        * (activeQuiz.xpReward ?? 2);

      // Re-derive final correct count including this last answer
      const finalCorrect = correctCount; // state already updated in handleOptionClick
      const finalXp = finalCorrect * (activeQuiz.xpReward ?? 2);

      if (finalXp > 0 && typeof onXpEarned === 'function') {
        onXpEarned(finalXp, 'quiz');
      }

      setPhase(PHASE.SCORE);
    }
  };

  const handleReturnToList = () => {
    setPhase(PHASE.LIST);
    setActiveQuiz(null);
  };

  // ── Option state helper ───────────────────────────────────────────────────
  const optionState = (idx) => {
    if (!isAnswered) return 'idle';
    if (idx === currentQuestion.correct) {
      return selected === idx ? 'correct' : 'revealed-correct';
    }
    if (idx === selected) return 'incorrect';
    return 'idle';
  };

  // ── PHASE: LIST ───────────────────────────────────────────────────────────
  if (phase === PHASE.LIST) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <KidsBackBtn onClick={onBack} label="Back to Kids Zone">← Back</KidsBackBtn>
          <h2 className="text-[18px] font-bold text-on-surface font-display">🧠 Health Quizzes</h2>
        </div>

        <p className="text-[13px] text-on-surface-variant font-body">
          Test what you know about staying healthy!
        </p>

        <div className="space-y-3">
          {kidsQuizzes.map((quiz) => (
            <button
              key={quiz.id}
              onClick={() => startQuiz(quiz)}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 ${quiz.color} text-left transition-transform active:scale-95 focus:outline-none focus:ring-2 focus:ring-brand-indigo/50`}
              aria-label={`Start quiz: ${quiz.title}`}
            >
              <span className="text-3xl flex-shrink-0" aria-hidden="true">{quiz.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-bold text-on-surface">{quiz.title}</p>
                <p className="text-[12px] text-on-surface-variant mt-0.5 leading-snug">{quiz.description}</p>
                <p className="text-[11px] text-on-surface-variant/60 mt-1">
                  {quiz.questions.length} questions · Ages {quiz.ageRange} · Up to {quiz.questions.length * quiz.xpReward} XP
                </p>
              </div>
              <span className="text-on-surface-variant/40 text-lg flex-shrink-0" aria-hidden="true">›</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── PHASE: QUESTION ───────────────────────────────────────────────────────
  if (phase === PHASE.QUESTION && currentQuestion) {
    return (
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <KidsBackBtn onClick={handleReturnToList} label="Back to quiz list">← Quizzes</KidsBackBtn>
          <span className="text-[12px] text-on-surface-variant font-body">
            {activeQuiz.emoji} {activeQuiz.title}
          </span>
        </div>

        {/* Progress dots */}
        <div className="flex items-center gap-1.5 justify-center" aria-label={`Question ${qIndex + 1} of ${totalQuestions}`}>
          {activeQuiz.questions.map((_, i) => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all duration-300 ${
                i < qIndex
                  ? 'w-4 bg-green-400'
                  : i === qIndex
                  ? 'w-6 bg-brand-indigo'
                  : 'w-4 bg-white/40'
              }`}
            />
          ))}
        </div>

        {/* Question card */}
        <KidsGlassCard className="p-5">
          <p className="text-[10px] font-bold text-brand-indigo uppercase tracking-[0.14em] mb-2 font-display">
            Question {qIndex + 1} of {totalQuestions}
          </p>
          <p className="text-[15px] font-bold text-on-surface leading-snug font-display">
            {currentQuestion.q}
          </p>
        </KidsGlassCard>

        {/* Options */}
        <div className="space-y-2">
          {currentQuestion.options.map((opt, idx) => (
            <OptionButton
              key={idx}
              label={opt}
              state={optionState(idx)}
              onClick={() => handleOptionClick(idx)}
              disabled={isAnswered}
            />
          ))}
        </div>

        {/* Explanation */}
        {showExplanation && (
          <KidsGlassCard
            className="p-4"
            style={{
              background: selected === currentQuestion.correct
                ? 'rgba(240,253,244,0.92)' : 'rgba(255,251,235,0.92)',
              border: selected === currentQuestion.correct
                ? '1.5px solid rgba(22,163,74,0.30)' : '1.5px solid rgba(245,158,11,0.30)',
            }}
          >
            <p className="text-[13px] font-medium text-on-surface leading-snug">
              {currentQuestion.explanation}
            </p>
          </KidsGlassCard>
        )}

        {/* Next button */}
        {isAnswered && (
          <button
            onClick={handleNext}
            className={[
              'w-full h-[50px] flex items-center justify-center',
              'rounded-2xl px-6',
              'text-[14px] font-bold text-white font-display',
              'bg-[linear-gradient(135deg,#706DF2_0%,#5856D6_100%)]',
              'shadow-[0_4px_16px_rgba(88,86,214,0.32)]',
              'hover:brightness-[1.05] active:scale-[0.98]',
              'transition-all duration-200',
              'focus:outline-none focus:ring-2 focus:ring-brand-indigo/50',
            ].join(' ')}
          >
            {qIndex + 1 < totalQuestions ? 'Next Question →' : 'See My Score 🎉'}
          </button>
        )}
      </div>
    );
  }

  // ── PHASE: SCORE ──────────────────────────────────────────────────────────
  if (phase === PHASE.SCORE) {
    const stars = starsForScore(correctCount, totalQuestions);
    const starMsg = STAR_MESSAGES[stars];
    const xpEarned = correctCount * (activeQuiz.xpReward ?? 2);

    return (
      <div className="space-y-4">
        <KidsGlassCard className="p-6 text-center space-y-3">
          <p className="text-[40px]" aria-label={`${stars} stars`}>{starMsg.emoji}</p>
          <h3 className="text-[18px] font-extrabold text-on-surface font-display">{starMsg.text}</h3>

          <div className="flex items-center justify-center gap-6 py-2">
            <div className="text-center">
              <p className="text-[30px] font-extrabold text-brand-indigo leading-none font-display">{correctCount}</p>
              <p className="text-[11px] text-on-surface-variant font-body">Correct</p>
            </div>
            <div className="text-on-surface-variant/30 text-[24px]">/</div>
            <div className="text-center">
              <p className="text-[30px] font-extrabold text-on-surface-variant/50 leading-none font-display">{totalQuestions}</p>
              <p className="text-[11px] text-on-surface-variant font-body">Total</p>
            </div>
          </div>

          {xpEarned > 0 ? (
            <div className="px-4 py-2 rounded-xl" style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.30)' }}>
              <p className="text-[13px] font-bold text-amber-700">+{xpEarned} XP earned! 🌟</p>
            </div>
          ) : (
            <div className="px-4 py-2 rounded-xl" style={{ background: 'rgba(100,116,139,0.08)', border: '1px solid rgba(100,116,139,0.15)' }}>
              <p className="text-[13px] text-on-surface-variant font-body">Answer questions correctly next time to earn XP!</p>
            </div>
          )}
        </KidsGlassCard>

        <div className="space-y-2">
          <button onClick={() => startQuiz(activeQuiz)}
            className="w-full h-[50px] flex items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#706DF2_0%,#5856D6_100%)] text-white text-[14px] font-bold font-display shadow-[0_4px_16px_rgba(88,86,214,0.32)] hover:brightness-[1.05] active:scale-[0.98] transition-all focus:outline-none focus:ring-2 focus:ring-brand-indigo/50">
            Try Again 🔄
          </button>
          <button onClick={handleReturnToList}
            className="w-full h-[50px] flex items-center justify-center rounded-2xl border-2 border-brand-indigo/40 text-brand-indigo text-[14px] font-bold font-display hover:bg-brand-indigo/5 active:scale-[0.98] transition-all focus:outline-none focus:ring-2 focus:ring-brand-indigo/40">
            Choose Another Quiz
          </button>
          <button onClick={onBack}
            className="w-full py-2.5 text-[13px] text-on-surface-variant font-body hover:text-on-surface transition-colors">
            Back to Kids Zone
          </button>
        </div>
      </div>
    );
  }

  return null;
};

export default HealthQuiz;
