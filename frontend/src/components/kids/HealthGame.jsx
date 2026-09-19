/**
 * HealthGame.jsx
 *
 * Health Games module for Kids Zone.
 * Fully local — no API calls, no Gemini, no Firestore, no drag-and-drop.
 *
 * Two game types, routed by activeGameConfig.gameType:
 *   "sort"        — Food Sort, Germ Buster: one item at a time, tap positive/negative bucket
 *   "ordered-tap" — Handwash Hero: all steps shown shuffled, tap them in correct order
 *
 * Isolation contract:
 *   Sort state  (itemIndex, answer, correctCount, roundItems) is only written
 *   by sort handlers and reset to defaults when an ordered-tap game starts.
 *   Handwash state (hwShuffledSteps, hwDoneIds, hwNextExpected, hwErrorId) is only
 *   written by handwash handlers and reset to defaults when a sort game starts.
 *   Neither set interferes with the other.
 *
 * Props:
 *   onBack     {function}           — return to Kids Zone hub
 *   onXpEarned {function(pts, cat)} — KidsZone handles addProgress() internally
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import kidsGames, { foodSortGame, germBusterGame, handwashHeroGame, breatheWithBubblesGame } from '../../data/kidsGames';

// ── Shared glass card for Kids ────────────────────────────────────────────────
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

// ── Kids gradient button ──────────────────────────────────────────────────────
const KidsBtn = ({ onClick, children, className = '', disabled = false }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={[
      'w-full h-[50px] flex items-center justify-center rounded-2xl',
      'text-[14px] font-bold text-white font-display',
      'bg-[linear-gradient(135deg,#706DF2_0%,#5856D6_100%)]',
      'shadow-[0_4px_16px_rgba(88,86,214,0.32)]',
      'hover:brightness-[1.05] active:scale-[0.98]',
      'transition-all duration-200',
      'focus:outline-none focus:ring-2 focus:ring-brand-indigo/50',
      'disabled:opacity-50 disabled:cursor-not-allowed',
      className,
    ].join(' ')}
  >
    {children}
  </button>
);

// ── Outlined kids button ──────────────────────────────────────────────────────
const KidsOutlineBtn = ({ onClick, children }) => (
  <button
    onClick={onClick}
    className="w-full h-[48px] flex items-center justify-center rounded-2xl border-2 border-brand-indigo/40 text-brand-indigo text-[14px] font-bold font-display hover:bg-brand-indigo/5 active:scale-[0.98] transition-all focus:outline-none focus:ring-2 focus:ring-brand-indigo/40"
  >
    {children}
  </button>
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

const GAME_CONFIGS = {
  [germBusterGame.id]:         germBusterGame,
  [handwashHeroGame.id]:       handwashHeroGame,
  [breatheWithBubblesGame.id]: breatheWithBubblesGame,
};

const PHASE = { LIST: 'list', PLAYING: 'playing', SCORE: 'score' };

function starsForScore(correct, total) {
  const pct = correct / total;
  if (pct === 1)  return 3;
  if (pct >= 0.7) return 2;
  if (pct >= 0.4) return 1;
  return 0;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const HealthGame = ({ onBack, onXpEarned }) => {
  const [phase, setPhase]                       = useState(PHASE.LIST);
  const [activeGameConfig, setActiveGameConfig] = useState(null);

  // ── Sort-game state ───────────────────────────────────────────────────────
  const [itemIndex, setItemIndex]       = useState(0);
  const [answer, setAnswer]             = useState(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [roundItems, setRoundItems]     = useState([]);

  // ── Handwash Hero state ───────────────────────────────────────────────────
  const [hwShuffledSteps, setHwShuffledSteps] = useState([]);
  const [hwDoneIds, setHwDoneIds]             = useState(new Set());
  const [hwNextExpected, setHwNextExpected]   = useState(0);
  const [hwErrorId, setHwErrorId]             = useState(null);
  const errorTimerRef = useRef(null);

  useEffect(() => () => { if (errorTimerRef.current) clearTimeout(errorTimerRef.current); }, []);

  // ── Breathe with Bubbles state ────────────────────────────────────────────
  // breathePhase: 'idle' | 'inhale' | 'hold' | 'exhale' | 'done'
  const [breathePhase, setBreathePhase]   = useState('idle');
  const [breatheCycle, setBreatheCycle]   = useState(0);
  const [breatheDone, setBreatheDone]     = useState(false);
  // Bubble size drives the CSS transition (grows on inhale, shrinks on exhale)
  const [bubbleSize, setBubbleSize]       = useState(80);   // px
  const breatheTimerRef = useRef(null);

  const clearBreatheTimer = () => {
    if (breatheTimerRef.current) { clearTimeout(breatheTimerRef.current); breatheTimerRef.current = null; }
  };

  // Cancel breathing timer on unmount so it can't fire after the component is gone
  useEffect(() => () => clearBreatheTimer(), []);

  // Derived sort values
  const currentItem = roundItems[itemIndex] ?? null;
  const totalItems  = roundItems.length;
  const isAnswered  = answer !== null;

  // ── startGame ─────────────────────────────────────────────────────────────
  const startGame = useCallback((gameConfig) => {
    setActiveGameConfig(gameConfig);
    clearBreatheTimer();
    if (gameConfig.gameType === 'sort') {
      setRoundItems(shuffle(gameConfig.items));
      setItemIndex(0); setAnswer(null); setCorrectCount(0);
      setHwShuffledSteps([]); setHwDoneIds(new Set()); setHwNextExpected(0); setHwErrorId(null);
      setBreathePhase('idle'); setBreatheCycle(0); setBreatheDone(false); setBubbleSize(80);
    } else if (gameConfig.gameType === 'ordered-tap') {
      setHwShuffledSteps(shuffle(gameConfig.steps));
      setHwDoneIds(new Set()); setHwNextExpected(0); setHwErrorId(null);
      setRoundItems([]); setItemIndex(0); setAnswer(null); setCorrectCount(0);
      setBreathePhase('idle'); setBreatheCycle(0); setBreatheDone(false); setBubbleSize(80);
    } else if (gameConfig.gameType === 'breathe') {
      setBreathePhase('idle'); setBreatheCycle(0); setBreatheDone(false); setBubbleSize(80);
      setRoundItems([]); setItemIndex(0); setAnswer(null); setCorrectCount(0);
      setHwShuffledSteps([]); setHwDoneIds(new Set()); setHwNextExpected(0); setHwErrorId(null);
    }
    setPhase(PHASE.PLAYING);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleListTap = (entry) => { const cfg = GAME_CONFIGS[entry.id]; if (cfg) startGame(cfg); };

  const returnToList = () => {
    setPhase(PHASE.LIST); setActiveGameConfig(null);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    setHwErrorId(null);
    clearBreatheTimer();
    setBreathePhase('idle');
  };

  // ── Sort handlers ─────────────────────────────────────────────────────────
  const handleSortTap = (tapValue) => {
    if (isAnswered || !currentItem || !activeGameConfig) return;
    setAnswer(tapValue);
    if (tapValue === currentItem[activeGameConfig.correctnessField]) setCorrectCount(c => c + 1);
  };

  const handleSortNext = () => {
    const next = itemIndex + 1;
    if (next < totalItems) { setItemIndex(next); setAnswer(null); }
    else {
      const xp = correctCount * (activeGameConfig.xpPerCorrect ?? 2);
      if (xp > 0 && typeof onXpEarned === 'function') onXpEarned(xp, 'game');
      setPhase(PHASE.SCORE);
    }
  };

  const sortCorrectAnswer = currentItem && activeGameConfig?.gameType === 'sort'
    ? currentItem[activeGameConfig.correctnessField] : null;
  const sortWasCorrect  = isAnswered && answer === sortCorrectAnswer;
  const sortFeedbackBg  = !isAnswered ? '' : sortWasCorrect ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300';
  const sortFeedbackText = !isAnswered ? ''
    : sortWasCorrect ? 'Correct! 🎉'
    : `Oops! That was ${sortCorrectAnswer ? activeGameConfig.sortLabels.positive.label : activeGameConfig.sortLabels.negative.label}`;

  // ── Handwash handler ──────────────────────────────────────────────────────
  const handleHwTap = (step) => {
    if (hwDoneIds.has(step.id) || hwErrorId) return;
    if (step.correctOrder === hwNextExpected) {
      const newDone = new Set(hwDoneIds);
      newDone.add(step.id);
      setHwDoneIds(newDone);
      const newNext = hwNextExpected + 1;
      setHwNextExpected(newNext);
      if (newNext === activeGameConfig.steps.length) {
        if (typeof onXpEarned === 'function') onXpEarned(activeGameConfig.xpReward ?? 10, 'game');
        setPhase(PHASE.SCORE);
      }
    } else {
      setHwErrorId(step.id);
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      errorTimerRef.current = setTimeout(() => setHwErrorId(null), 600);
    }
  };

  // ── Breathe exercise driver ───────────────────────────────────────────────
  // Runs a single inhale→hold→exhale cycle, then schedules the next or finishes.
  // All timers held in breatheTimerRef so they can be cancelled cleanly on nav.
  const runBreatheCycle = useCallback((cycleIndex, config) => {
    const { totalCycles, inhaleDuration, holdDuration, exhaleDuration, gapDuration, xpReward } = config;

    // INHALE — bubble grows
    setBreathePhase('inhale');
    setBubbleSize(200);

    breatheTimerRef.current = setTimeout(() => {
      // HOLD
      setBreathePhase('hold');

      breatheTimerRef.current = setTimeout(() => {
        // EXHALE — bubble shrinks
        setBreathePhase('exhale');
        setBubbleSize(80);

        breatheTimerRef.current = setTimeout(() => {
          const nextCycle = cycleIndex + 1;
          setBreatheCycle(nextCycle);

          if (nextCycle < totalCycles) {
            // Gap before next cycle
            breatheTimerRef.current = setTimeout(() => {
              runBreatheCycle(nextCycle, config);
            }, gapDuration);
          } else {
            // All cycles done
            setBreathePhase('done');
            setBreatheDone(true);
            if (typeof onXpEarned === 'function') onXpEarned(xpReward ?? 5, 'game');
          }
        }, exhaleDuration);
      }, holdDuration);
    }, inhaleDuration);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onXpEarned]);

  // ── PHASE: LIST ───────────────────────────────────────────────────────────
  if (phase === PHASE.LIST) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <KidsBackBtn onClick={onBack} label="Back to Kids Zone">← Back</KidsBackBtn>
          <h2 className="text-[18px] font-bold text-on-surface font-display">🎮 Health Games</h2>
        </div>
        <p className="text-[13px] text-on-surface-variant font-body">Play fun games that teach you healthy habits!</p>
        <div className="grid grid-cols-2 gap-3">
          {kidsGames.map((game) => (
            <button
              key={game.id}
              onClick={game.implemented ? () => handleListTap(game) : undefined}
              disabled={!game.implemented}
              className={`flex flex-col items-start gap-2 p-4 rounded-2xl border-2 ${game.color} text-left transition-transform focus:outline-none focus:ring-2 focus:ring-brand-indigo/50 ${game.implemented ? 'active:scale-95 cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}
              aria-label={game.implemented ? `Play ${game.title}` : `${game.title} — coming soon`}
            >
              <span className="text-[28px]" aria-hidden="true">{game.emoji}</span>
              <span className="text-[13px] font-bold text-on-surface leading-tight">{game.title}</span>
              <span className="text-[11px] text-on-surface-variant leading-snug">{game.description}</span>
              <span className="text-[11px] text-on-surface-variant/55">Ages {game.ageRange}</span>
              {!game.implemented && <span className="text-[11px] font-semibold text-on-surface-variant/50">🚧 Coming soon</span>}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── PHASE: PLAYING — sort ─────────────────────────────────────────────────
  if (phase === PHASE.PLAYING && activeGameConfig?.gameType === 'sort' && currentItem) {
    const { sortLabels, promptText } = activeGameConfig;
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <KidsBackBtn onClick={returnToList} label="Back to game list">← Games</KidsBackBtn>
          <span className="text-[12px] text-on-surface-variant font-body">{activeGameConfig.emoji} {activeGameConfig.title}</span>
        </div>

        <div>
          <div className="w-full rounded-full h-2.5 overflow-hidden" style={{ background: 'rgba(88,86,214,0.10)' }}
            role="progressbar" aria-valuenow={itemIndex + 1} aria-valuemin={1} aria-valuemax={totalItems}
            aria-label={`Item ${itemIndex + 1} of ${totalItems}`}>
            <div className="h-full rounded-full transition-all duration-300"
              style={{ width: `${((itemIndex + (isAnswered ? 1 : 0)) / totalItems) * 100}%`, background: 'linear-gradient(90deg,#706DF2,#5856D6)' }} />
          </div>
          <p className="text-[11px] text-on-surface-variant mt-0.5 text-right font-body">{itemIndex + 1} / {totalItems}</p>
        </div>

        <KidsGlassCard
          className="p-6 text-center transition-colors duration-200"
          style={isAnswered ? {
            background: sortWasCorrect ? 'rgba(240,253,244,0.92)' : 'rgba(254,242,242,0.92)',
            border: sortWasCorrect ? '1.5px solid rgba(22,163,74,0.30)' : '1.5px solid rgba(220,38,38,0.25)',
          } : {}}
        >
          <p className="text-[64px] leading-none mb-3 select-none" aria-hidden="true"
            style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.12))' }}>{currentItem.emoji}</p>
          <p className="text-[18px] font-extrabold text-on-surface font-display">{currentItem.name}</p>
          {isAnswered && (
            <div className="mt-3 space-y-2">
              <p className={`text-[13px] font-bold ${sortWasCorrect ? 'text-green-700' : 'text-red-600'}`}>{sortFeedbackText}</p>
              <p className="text-[12px] text-on-surface-variant leading-snug">{currentItem.funFact}</p>
            </div>
          )}
          {!isAnswered && <p className="text-[13px] text-on-surface-variant mt-2 font-body">{promptText}</p>}
        </KidsGlassCard>

        {!isAnswered && (
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => handleSortTap(true)}
              className="flex flex-col items-center gap-1.5 py-4 px-3 rounded-2xl border-2 bg-green-50 border-green-300 text-green-800 font-bold text-[13px] active:scale-95 transition-transform focus:outline-none focus:ring-2 focus:ring-green-400 min-h-[80px]"
              aria-label={sortLabels.positive.label}>
              <span className="text-[28px]" aria-hidden="true">{sortLabels.positive.emoji}</span>
              {sortLabels.positive.label}
            </button>
            <button onClick={() => handleSortTap(false)}
              className="flex flex-col items-center gap-1.5 py-4 px-3 rounded-2xl border-2 bg-red-50 border-red-300 text-red-700 font-bold text-[13px] active:scale-95 transition-transform focus:outline-none focus:ring-2 focus:ring-red-400 min-h-[80px]"
              aria-label={sortLabels.negative.label}>
              <span className="text-[28px]" aria-hidden="true">{sortLabels.negative.emoji}</span>
              <span className="text-center leading-tight">{sortLabels.negative.label}</span>
            </button>
          </div>
        )}

        {isAnswered && <KidsBtn onClick={handleSortNext}>{itemIndex + 1 < totalItems ? 'Next →' : 'See My Score 🎉'}</KidsBtn>}
        <p className="text-[11px] text-center text-on-surface-variant/55 font-body">✅ {correctCount} correct so far</p>
      </div>
    );
  }

  // ── PHASE: PLAYING — ordered-tap (Handwash Hero) ──────────────────────────
  if (phase === PHASE.PLAYING && activeGameConfig?.gameType === 'ordered-tap') {
    const totalSteps = activeGameConfig.steps.length;
    const doneCount  = hwDoneIds.size;
    const nextStep   = activeGameConfig.steps.find(s => s.correctOrder === hwNextExpected);

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <KidsBackBtn onClick={returnToList} label="Back to game list">← Games</KidsBackBtn>
          <span className="text-[12px] text-on-surface-variant font-body">{activeGameConfig.emoji} {activeGameConfig.title}</span>
        </div>

        <div>
          <div className="w-full rounded-full h-2.5 overflow-hidden" style={{ background: 'rgba(59,130,246,0.12)' }}
            role="progressbar" aria-valuenow={doneCount} aria-valuemin={0} aria-valuemax={totalSteps}
            aria-label={`${doneCount} of ${totalSteps} steps done`}>
            <div className="h-full rounded-full transition-all duration-300"
              style={{ width: `${(doneCount / totalSteps) * 100}%`, background: 'linear-gradient(90deg,#60A5FA,#38BDF8)' }} />
          </div>
          <p className="text-[11px] text-on-surface-variant mt-0.5 text-right font-body">{doneCount} / {totalSteps} steps</p>
        </div>

        {nextStep && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
            style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.20)' }}>
            <span className="text-[16px]" aria-hidden="true">👉</span>
            <p className="text-[12px] text-blue-700 font-semibold font-display">
              Next: tap <span className="font-bold">"{nextStep.label}"</span>
            </p>
          </div>
        )}

        <div className="space-y-2">
          {hwShuffledSteps.map((step) => {
            const isDone  = hwDoneIds.has(step.id);
            const isError = hwErrorId === step.id;
            return (
              <button
                key={step.id}
                onClick={() => handleHwTap(step)}
                disabled={isDone}
                className={[
                  'w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl border-2 text-left transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-brand-indigo/50 min-h-[60px]',
                  isDone  ? 'bg-green-50 border-green-300 text-green-800 cursor-default' : '',
                  isError ? 'bg-red-50 border-red-400 text-red-700 animate-pulse' : '',
                  !isDone && !isError ? 'bg-white/70 border-white/60 text-on-surface active:scale-95 cursor-pointer hover:bg-blue-50 hover:border-blue-300' : '',
                ].join(' ')}
                aria-label={isDone ? `${step.label} — done` : step.label}
                aria-pressed={isDone}
              >
                <div className={`flex-shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center text-[11px] font-bold transition-all
                  ${isDone ? 'bg-green-500 border-green-500 text-white' : isError ? 'bg-red-100 border-red-400 text-red-600' : 'bg-white border-on-surface-variant/30 text-on-surface-variant'}`}
                  aria-hidden="true">
                  {isDone ? (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="white" className="w-4 h-4">
                      <path fillRule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clipRule="evenodd" />
                    </svg>
                  ) : isError ? '✗' : (step.correctOrder + 1)}
                </div>
                <span className="text-[22px] flex-shrink-0" aria-hidden="true">{step.emoji}</span>
                <span className={`text-[13px] font-semibold flex-1 ${isDone ? 'line-through decoration-green-400' : ''}`}>{step.label}</span>
                {isError && <span className="text-[11px] text-red-600 font-semibold flex-shrink-0">Try again!</span>}
              </button>
            );
          })}
        </div>

        <p className="text-[11px] text-center text-on-surface-variant/55 font-body">Tap the steps in the correct order 👆</p>
      </div>
    );
  }

  // ── PHASE: PLAYING — breathe ─────────────────────────────────────────────
  if (phase === PHASE.PLAYING && activeGameConfig?.gameType === 'breathe') {
    const { totalCycles, title, emoji } = activeGameConfig;
    const isIdle = breathePhase === 'idle';
    const isDone = breathePhase === 'done';

    const cueText = {
      idle:    'Press Start when you are ready…',
      inhale:  'Breathe in… 🌬️',
      hold:    'Hold… ✨',
      exhale:  'Breathe out… 😌',
      done:    'Well done! You feel calmer now. 🌟',
    }[breathePhase] ?? '';

    const bubbleColour = breathePhase === 'exhale'
      ? 'rgba(147,197,253,0.55)'
      : breathePhase === 'done'
      ? 'rgba(134,239,172,0.55)'
      : 'rgba(196,181,253,0.55)';
    const bubbleBorder = breathePhase === 'exhale'
      ? 'rgba(59,130,246,0.35)'
      : breathePhase === 'done'
      ? 'rgba(22,163,74,0.35)'
      : 'rgba(139,92,246,0.35)';

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <KidsBackBtn onClick={returnToList} label="Back to game list">← Games</KidsBackBtn>
          <span className="text-[12px] text-on-surface-variant font-body">{emoji} {title}</span>
        </div>

        {!isIdle && (
          <p className="text-[11px] text-center text-on-surface-variant font-body">
            Cycle {Math.min(breatheCycle + 1, totalCycles)} of {totalCycles}
          </p>
        )}

        <div className="flex flex-col items-center justify-center py-4 gap-6">
          <div
            className="rounded-full border-4 transition-all"
            style={{
              width: `${bubbleSize}px`,
              height: `${bubbleSize}px`,
              maxWidth: '200px',
              maxHeight: '200px',
              background: bubbleColour,
              borderColor: bubbleBorder,
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              boxShadow: `0 0 40px ${bubbleColour}`,
              transitionDuration: breathePhase === 'inhale'
                ? `${activeGameConfig.inhaleDuration}ms`
                : breathePhase === 'exhale'
                ? `${activeGameConfig.exhaleDuration}ms`
                : '300ms',
              transitionTimingFunction: 'ease-in-out',
            }}
            aria-hidden="true"
          />
          <p className={`text-[16px] font-bold text-center transition-opacity duration-500 font-display ${isIdle ? 'text-on-surface-variant' : 'text-brand-purple'}`}
            aria-live="polite" aria-atomic="true">
            {cueText}
          </p>
        </div>

        {isIdle && <KidsBtn onClick={() => runBreatheCycle(0, activeGameConfig)}>Start Breathing 🫧</KidsBtn>}

        {isDone && (
          <div className="space-y-2">
            <KidsBtn onClick={() => startGame(activeGameConfig)}>Do It Again 🔄</KidsBtn>
            <KidsOutlineBtn onClick={returnToList}>Choose Another Game</KidsOutlineBtn>
            <button onClick={onBack} className="w-full py-2.5 text-[13px] text-on-surface-variant font-body hover:text-on-surface transition-colors">Back to Kids Zone</button>
          </div>
        )}

        {!isIdle && !isDone && (
          <p className="text-[11px] text-center text-on-surface-variant/55 font-body">Follow the bubble with your breath 🫧</p>
        )}
      </div>
    );
  }

  // ── PHASE: SCORE — sort games ─────────────────────────────────────────────
  if (phase === PHASE.SCORE && activeGameConfig?.gameType === 'sort') {
    const stars    = starsForScore(correctCount, totalItems);
    const msg      = activeGameConfig.scoreMessages[stars];
    const xpEarned = correctCount * (activeGameConfig.xpPerCorrect ?? 2);
    return (
      <div className="space-y-4">
        <KidsGlassCard className="p-6 text-center space-y-4">
          <p className="text-[36px]" aria-label={`${stars} stars`}>{msg.stars}</p>
          <h3 className="text-[18px] font-extrabold text-on-surface font-display">{msg.text}</h3>
          <div className="flex items-center justify-center gap-6 py-2">
            <div className="text-center">
              <p className="text-[28px] font-extrabold text-brand-indigo leading-none font-display">{correctCount}</p>
              <p className="text-[11px] text-on-surface-variant font-body">Correct</p>
            </div>
            <div className="text-on-surface-variant/25 text-[22px]">/</div>
            <div className="text-center">
              <p className="text-[28px] font-extrabold text-on-surface-variant/50 leading-none font-display">{totalItems}</p>
              <p className="text-[11px] text-on-surface-variant font-body">Total</p>
            </div>
          </div>
          {xpEarned > 0
            ? <div className="rounded-xl px-4 py-2" style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.30)' }}><p className="text-[13px] font-bold text-amber-700">+{xpEarned} XP earned! 🌟</p></div>
            : <div className="rounded-xl px-4 py-2" style={{ background: 'rgba(100,116,139,0.08)', border: '1px solid rgba(100,116,139,0.15)' }}><p className="text-[13px] text-on-surface-variant font-body">Get more correct next time to earn XP!</p></div>
          }
        </KidsGlassCard>
        <div className="space-y-2">
          <KidsBtn onClick={() => startGame(activeGameConfig)}>Play Again 🔄</KidsBtn>
          <KidsOutlineBtn onClick={returnToList}>Choose Another Game</KidsOutlineBtn>
          <button onClick={onBack} className="w-full py-2.5 text-[13px] text-on-surface-variant font-body hover:text-on-surface transition-colors">Back to Kids Zone</button>
        </div>
      </div>
    );
  }

  // ── PHASE: SCORE — Handwash Hero ──────────────────────────────────────────
  if (phase === PHASE.SCORE && activeGameConfig?.gameType === 'ordered-tap') {
    const xpEarned = activeGameConfig.xpReward ?? 10;
    return (
      <div className="space-y-4">
        <KidsGlassCard className="p-6 text-center space-y-4">
          <p className="text-[44px]" aria-hidden="true">🧼🌟</p>
          <h3 className="text-[18px] font-extrabold text-on-surface font-display">You are a Handwash Hero!</h3>
          <p className="text-[13px] text-on-surface-variant leading-snug font-body">
            You put all {activeGameConfig.steps.length} steps in the right order.<br />
            Now you know how to wash your hands perfectly! 🙌
          </p>
          <div className="rounded-xl px-4 py-2" style={{ background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.30)' }}>
            <p className="text-[13px] font-bold text-amber-700">+{xpEarned} XP earned! 🌟</p>
          </div>
        </KidsGlassCard>
        <div className="space-y-2">
          <KidsBtn onClick={() => startGame(activeGameConfig)}>Play Again 🔄</KidsBtn>
          <KidsOutlineBtn onClick={returnToList}>Choose Another Game</KidsOutlineBtn>
          <button onClick={onBack} className="w-full py-2.5 text-[13px] text-on-surface-variant font-body hover:text-on-surface transition-colors">Back to Kids Zone</button>
        </div>
      </div>
    );
  }

  return null;
};

export default HealthGame;
