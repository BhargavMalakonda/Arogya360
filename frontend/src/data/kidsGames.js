/**
 * kidsGames.js
 *
 * Fully local, static game data for the Health Games module.
 * No API calls, no Gemini, no Firestore.
 *
 * Two game types:
 *
 * 1. "sort"  — one item shown at a time, player taps positive/negative bucket.
 *    Config fields: correctnessField, promptText, sortLabels, scoreMessages, xpPerCorrect, items[]
 *
 * 2. "ordered-tap" — all steps shown at once (shuffled), player taps in correct order.
 *    Correct tap → step moves to "done" list. Wrong-order tap → red flash, no penalty.
 *    Config fields: steps[], xpReward (flat, awarded on full completion)
 *    Each step: { id, label, emoji, correctOrder }
 *      correctOrder {number} — 0-based index of where this step belongs in the sequence
 */

// ── Game 1: Healthy Food Sort (type: sort) ────────────────────────────────────
export const foodSortGame = {
  id: 'food-sort',
  gameType: 'sort',
  title: 'Healthy Food Sort',
  emoji: '🥦',
  description: 'Sort each food into Healthy or Unhealthy. How many can you get right?',
  ageRange: '5–12',
  xpPerCorrect: 2,
  correctnessField: 'isHealthy',
  promptText: 'Is this food healthy?',
  sortLabels: {
    positive: { emoji: '✅', label: 'Healthy' },
    negative: { emoji: '❌', label: 'Unhealthy' },
  },
  scoreMessages: {
    3: { stars: '🌟🌟🌟', text: 'Perfect! You are a Healthy Food Expert!' },
    2: { stars: '⭐⭐',   text: 'Great job! You know your healthy foods!' },
    1: { stars: '⭐',     text: 'Nice try! Read the fun facts and play again!' },
    0: { stars: '💪',     text: 'Keep practising — you will get there!' },
  },
  items: [
    { emoji: '🍎', name: 'Apple',          isHealthy: true,  funFact: 'Apples are full of vitamins and keep your teeth clean! 🦷' },
    { emoji: '🥦', name: 'Broccoli',       isHealthy: true,  funFact: 'Broccoli is packed with vitamins that help your body fight germs! 💪' },
    { emoji: '🍫', name: 'Chocolate Bar',  isHealthy: false, funFact: 'Chocolate bars have lots of sugar. A little is okay, but too much harms your teeth! 🍬' },
    { emoji: '🥕', name: 'Carrot',         isHealthy: true,  funFact: 'Carrots help your eyes see better — even in dim light! 👀' },
    { emoji: '🥤', name: 'Fizzy Drink',    isHealthy: false, funFact: 'Fizzy drinks are full of sugar and can harm your teeth and tummy. Water is better! 💧' },
    { emoji: '🍌', name: 'Banana',         isHealthy: true,  funFact: 'Bananas give you quick energy and are great before exercise! 🏃' },
    { emoji: '🍟', name: 'Fries',          isHealthy: false, funFact: 'Fries have lots of oil and salt. A small portion now and then is fine, but not every day! 🧂' },
    { emoji: '🥛', name: 'Glass of Milk',  isHealthy: true,  funFact: 'Milk is full of calcium that builds strong bones and teeth! 🦴' },
    { emoji: '🍭', name: 'Lollipop',       isHealthy: false, funFact: 'Lollipops are all sugar — they are a treat, not everyday food! 😬' },
    { emoji: '🥚', name: 'Boiled Egg',     isHealthy: true,  funFact: 'Eggs are full of protein that helps your muscles grow and repair! 🥊' },
    { emoji: '🍕', name: 'Pizza Slice',    isHealthy: false, funFact: 'Pizza can have lots of fat and salt. Homemade pizza with veggies is much healthier! 🫑' },
    { emoji: '💧', name: 'Glass of Water', isHealthy: true,  funFact: 'Water keeps every part of your body working — aim for 6–8 glasses a day! 🚿' },
  ],
};

// ── Game 2: Germ Buster (type: sort) ─────────────────────────────────────────
export const germBusterGame = {
  id: 'germ-buster',
  gameType: 'sort',
  title: 'Germ Buster',
  emoji: '🦠',
  description: 'Is this action safe or germy? Spot the germs and stay healthy!',
  ageRange: '6–12',
  xpPerCorrect: 2,
  correctnessField: 'isSafe',
  promptText: 'Is this action safe or germy?',
  sortLabels: {
    positive: { emoji: '✅', label: 'Safe!' },
    negative: { emoji: '🦠', label: 'Germy — wash hands!' },
  },
  scoreMessages: {
    3: { stars: '🌟🌟🌟', text: 'Amazing! You are a true Germ Buster!' },
    2: { stars: '⭐⭐',   text: 'Great work! You spotted most germs!' },
    1: { stars: '⭐',     text: 'Good try! Read the facts and have another go!' },
    0: { stars: '💪',     text: 'Germs are sneaky — keep practising!' },
  },
  items: [
    { emoji: '🙌', name: 'Washed hands with soap',                           isSafe: true,  funFact: 'Washing with soap for 20 seconds removes almost all germs. You are a hygiene hero! 🧼' },
    { emoji: '🤧', name: 'Sneezed into hands then touched food',             isSafe: false, funFact: 'Sneezing into your hands leaves thousands of germs behind! Always sneeze into your elbow. 🫷' },
    { emoji: '🚪', name: 'Touched a doorknob then rubbed eyes',             isSafe: false, funFact: 'Doorknobs can carry germs from hundreds of hands. Avoid touching your face and wash hands often! 👁️' },
    { emoji: '🍽️', name: 'Washed hands before eating',                      isSafe: true,  funFact: 'Clean hands before meals stop germs from getting into your tummy — great habit! 🙌' },
    { emoji: '🐾', name: 'Played with a pet then touched mouth',            isSafe: false, funFact: 'Pets carry germs on their fur and paws. Wash your hands after playing with animals! 🐶' },
    { emoji: '🌿', name: 'Played in mud without washing after',             isSafe: false, funFact: 'Soil can contain bacteria. Wash your hands thoroughly after playing outside! 🌱' },
    { emoji: '🧻', name: 'Used a tissue when blowing nose',                  isSafe: true,  funFact: 'Tissues catch germs and stop them spreading. Throw the tissue away and wash hands after! 🤝' },
    { emoji: '🥗', name: 'Ate with clean, washed hands',                    isSafe: true,  funFact: 'Eating with clean hands is one of the simplest ways to stay healthy. Well done! ✅' },
    { emoji: '🤝', name: 'Shook hands with someone coughing, then ate',     isSafe: false, funFact: 'Germs from coughs pass easily through handshakes. Always wash hands before eating! 🧼' },
    { emoji: '🪥', name: 'Brushed teeth before bed',                         isSafe: true,  funFact: 'Brushing at night removes food and bacteria that could cause cavities overnight. Keep it up! 🦷' },
    { emoji: '🚰', name: 'Rinsed hands with just water, no soap',           isSafe: false, funFact: "Water alone doesn't remove all germs — you need soap to break them down! Always use soap. 🧴" },
    { emoji: '🍎', name: 'Washed fruit before eating it',                    isSafe: true,  funFact: 'Rinsing fruit removes dirt and surface bacteria. A quick rinse = a safer snack! 💧' },
  ],
};

// ── Game 3: Handwash Hero (type: ordered-tap) ─────────────────────────────────
// All steps are shown at once (shuffled). Player taps them in the correct order.
// Correct tap → step moves to "done" column with a checkmark.
// Wrong-order tap → gentle red flash for 600ms, no penalty, player retries.
// XP: flat 10 XP on full completion (avoids partial-XP edge cases).
//
// correctOrder: 0-based index of where the step belongs in the sequence.
// The engine tracks hwNextExpected (0..steps.length-1) and only accepts a tap
// if step.correctOrder === hwNextExpected.
export const handwashHeroGame = {
  id: 'handwash',
  gameType: 'ordered-tap',
  title: 'Handwash Hero',
  emoji: '🧼',
  description: 'Tap the handwashing steps in the right order. Can you do it perfectly?',
  ageRange: '4–10',
  xpReward: 10,   // flat XP awarded on successful completion
  steps: [
    { id: 'wet',     emoji: '🚰', label: 'Wet your hands',             correctOrder: 0 },
    { id: 'soap',    emoji: '🧴', label: 'Apply soap',                 correctOrder: 1 },
    { id: 'scrub',   emoji: '👏', label: 'Scrub for 20 seconds',       correctOrder: 2 },
    { id: 'between', emoji: '🤲', label: 'Clean between fingers',      correctOrder: 3 },
    { id: 'rinse',   emoji: '💧', label: 'Rinse under clean water',    correctOrder: 4 },
    { id: 'dry',     emoji: '🧺', label: 'Dry with a clean towel',     correctOrder: 5 },
  ],
};

// ── Game 4: Breathe with Bubbles (type: breathe) ─────────────────────────────
// No right/wrong answers — a calming guided breathing exercise.
// The bubble grows on inhale (4s), holds (1s), shrinks on exhale (4s).
// Repeats for `totalCycles` cycles. XP awarded flat on completion.
export const breatheWithBubblesGame = {
  id: 'breathe',
  gameType: 'breathe',
  title: 'Breathe with Bubbles',
  emoji: '🫧',
  description: 'Follow the bubble — breathe in and out to feel calm and focused.',
  ageRange: '4–8',
  totalCycles: 3,   // number of full inhale+exhale cycles
  xpReward: 5,      // flat XP on completion (lower — no skill/correctness involved)
  inhaleDuration: 4000,   // ms
  holdDuration:   1000,   // ms between inhale and exhale
  exhaleDuration: 4000,   // ms
  gapDuration:     600,   // ms pause between cycles
};

// ── Game catalogue ────────────────────────────────────────────────────────────
const kidsGames = [
  {
    id: foodSortGame.id,
    title: foodSortGame.title,
    emoji: foodSortGame.emoji,
    description: foodSortGame.description,
    ageRange: foodSortGame.ageRange,
    color: 'bg-green-100 border-green-300',
    implemented: true,
  },
  {
    id: germBusterGame.id,
    title: germBusterGame.title,
    emoji: germBusterGame.emoji,
    description: germBusterGame.description,
    ageRange: germBusterGame.ageRange,
    color: 'bg-red-100 border-red-300',
    implemented: true,
  },
  {
    id: handwashHeroGame.id,
    title: handwashHeroGame.title,
    emoji: handwashHeroGame.emoji,
    description: handwashHeroGame.description,
    ageRange: handwashHeroGame.ageRange,
    color: 'bg-blue-100 border-blue-300',
    implemented: true,
  },
  {
    id: breatheWithBubblesGame.id,
    title: breatheWithBubblesGame.title,
    emoji: breatheWithBubblesGame.emoji,
    description: breatheWithBubblesGame.description,
    ageRange: breatheWithBubblesGame.ageRange,
    color: 'bg-purple-100 border-purple-300',
    implemented: true,
  },
];

export default kidsGames;
