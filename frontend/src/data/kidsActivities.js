/**
 * kidsActivities.js
 *
 * Fully local, static data for the Health Activities daily checklist.
 * No API calls, no Gemini, no Firestore.
 *
 * Each activity:
 *   id          {string}  — stable unique key (also used as localStorage map key)
 *   label       {string}  — short display title
 *   emoji       {string}  — decorative emoji shown on the checklist row
 *   description {string}  — one-line encouragement shown below the label
 *   xpReward    {number}  — XP awarded the FIRST time this item is checked today
 *                           (unchecking and re-checking does NOT re-award XP)
 */

const kidsActivities = [
  {
    id: 'drink-water',
    label: 'Drink 6 glasses of water',
    emoji: '💧',
    description: 'Stay hydrated — water keeps your brain sharp!',
    xpReward: 3,
  },
  {
    id: 'brush-teeth',
    label: 'Brush teeth twice today',
    emoji: '🪥',
    description: 'Morning and night keeps cavities away!',
    xpReward: 3,
  },
  {
    id: 'eat-fruit',
    label: 'Eat a fruit or vegetable',
    emoji: '🍎',
    description: 'One piece of nature\'s goodness every day!',
    xpReward: 3,
  },
  {
    id: 'play-outside',
    label: '10 minutes of active play',
    emoji: '🏃',
    description: 'Run, jump, skip — move your body for 10 minutes!',
    xpReward: 4,
  },
  {
    id: 'wash-hands',
    label: 'Wash hands before eating',
    emoji: '🧼',
    description: 'Clean hands stop germs from getting into your tummy!',
    xpReward: 2,
  },
];

export default kidsActivities;
