/**
 * kidsProgress.js
 *
 * Local-only Healthy Hero progress utility.
 * Storage: localStorage key "kidsZoneProgress".
 * No Firestore, no Firebase, no backend, no Gemini.
 *
 * Schema (stored as JSON):
 * {
 *   "totalPoints": number,          // cumulative XP across all categories
 *   "categoryPoints": {             // per-category breakdown
 *     "game":     number,
 *     "quiz":     number,
 *     "story":    number,
 *     "activity": number
 *   },
 *   "lastUpdated": string           // ISO 8601 timestamp of last addProgress() call
 * }
 *
 * Badge levels (deterministic, derived from totalPoints):
 *   0   – 49   → Health Rookie    🌱
 *   50  – 149  → Health Explorer  🏅
 *   150 – 299  → Health Champion  ⭐
 *   300 – 499  → Healthy Hero     🦸
 *   500+       → Super Hero       🌟
 */

const STORAGE_KEY = 'kidsZoneProgress';

const VALID_CATEGORIES = ['game', 'quiz', 'story', 'activity'];

// ── Badge definitions ─────────────────────────────────────────────────────────
export const BADGE_LEVELS = [
  { minPoints: 0,   label: 'Health Rookie',    emoji: '🌱', nextAt: 50   },
  { minPoints: 50,  label: 'Health Explorer',  emoji: '🏅', nextAt: 150  },
  { minPoints: 150, label: 'Health Champion',  emoji: '⭐', nextAt: 300  },
  { minPoints: 300, label: 'Healthy Hero',     emoji: '🦸', nextAt: 500  },
  { minPoints: 500, label: 'Super Hero',       emoji: '🌟', nextAt: null }, // max rank
];

/**
 * Returns the badge entry for a given total-points value.
 * @param {number} totalPoints
 * @returns {{ minPoints, label, emoji, nextAt }}
 */
export function getBadgeForPoints(totalPoints) {
  for (let i = BADGE_LEVELS.length - 1; i >= 0; i--) {
    if (totalPoints >= BADGE_LEVELS[i].minPoints) {
      return BADGE_LEVELS[i];
    }
  }
  return BADGE_LEVELS[0];
}

/**
 * Computes what fraction (0–1) of the way the user is toward the next badge.
 * Returns 1 if they are at max rank.
 * @param {number} totalPoints
 * @returns {number}  value in [0, 1]
 */
export function getProgressFraction(totalPoints) {
  const badge = getBadgeForPoints(totalPoints);
  if (badge.nextAt === null) return 1; // max rank — full bar
  const span = badge.nextAt - badge.minPoints;
  const earned = totalPoints - badge.minPoints;
  return Math.min(1, Math.max(0, earned / span));
}

// ── Default/empty progress object ────────────────────────────────────────────
function defaultProgress() {
  return {
    totalPoints: 0,
    categoryPoints: { game: 0, quiz: 0, story: 0, activity: 0 },
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Validates and normalises a raw object parsed from localStorage.
 * Fills in any missing fields so callers never have to guard against them.
 * @param {any} raw
 * @returns {object} normalised progress object
 */
function normalise(raw) {
  if (!raw || typeof raw !== 'object') return defaultProgress();

  const totalPoints = typeof raw.totalPoints === 'number' && raw.totalPoints >= 0
    ? Math.round(raw.totalPoints)
    : 0;

  const catRaw = raw.categoryPoints && typeof raw.categoryPoints === 'object'
    ? raw.categoryPoints
    : {};
  const categoryPoints = {};
  for (const cat of VALID_CATEGORIES) {
    categoryPoints[cat] = typeof catRaw[cat] === 'number' && catRaw[cat] >= 0
      ? Math.round(catRaw[cat])
      : 0;
  }

  const lastUpdated = typeof raw.lastUpdated === 'string'
    ? raw.lastUpdated
    : new Date().toISOString();

  return { totalPoints, categoryPoints, lastUpdated };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Reads and returns the current progress from localStorage.
 * Always returns a fully-normalised object — never throws.
 * @returns {{ totalPoints: number, categoryPoints: object, lastUpdated: string }}
 */
export function getProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultProgress();
    return normalise(JSON.parse(raw));
  } catch {
    // localStorage unavailable or JSON corrupt — return safe default
    return defaultProgress();
  }
}

/**
 * Adds points to the total and to the specified category, persists to localStorage,
 * and returns the updated progress object.
 *
 * @param {number} points     — positive integer; clamped to [1, 500] per call
 * @param {string} category   — one of: 'game' | 'quiz' | 'story' | 'activity'
 * @returns {{ totalPoints: number, categoryPoints: object, lastUpdated: string }}
 */
export function addProgress(points, category) {
  const safePoints = Math.max(1, Math.min(500, Math.round(Number(points) || 0)));
  const safeCategory = VALID_CATEGORIES.includes(category) ? category : 'game';

  const current = getProgress();
  const updated = {
    totalPoints: current.totalPoints + safePoints,
    categoryPoints: {
      ...current.categoryPoints,
      [safeCategory]: (current.categoryPoints[safeCategory] || 0) + safePoints,
    },
    lastUpdated: new Date().toISOString(),
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // localStorage write failure (e.g. private mode quota) is non-fatal
  }

  return updated;
}

/**
 * Resets all progress to zero and clears localStorage.
 * Exported for future "reset" UI if approved.
 */
export function resetProgress() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // silent
  }
  return defaultProgress();
}
