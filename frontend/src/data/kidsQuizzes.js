/**
 * kidsQuizzes.js
 *
 * Fully local, static quiz data for the Health Quizzes module.
 * No API calls, no Gemini, no Firestore.
 *
 * Each quiz has:
 *   id           {string}   — unique identifier
 *   title        {string}   — display name
 *   emoji        {string}   — decorative emoji
 *   description  {string}   — short teaser shown on the quiz list card
 *   ageRange     {string}   — suggested age range
 *   color        {string}   — Tailwind classes for the list card background/border
 *   xpReward     {number}   — XP awarded per correct answer (total = xpReward × questions)
 *   questions    {Array}    — see structure below
 *
 * Each question has:
 *   q            {string}   — question text (simple, kid-friendly language)
 *   options      {string[]} — exactly 4 answer options
 *   correct      {number}   — 0-based index of the correct option
 *   explanation  {string}   — brief, encouraging explanation shown after answering
 */

const kidsQuizzes = [
  // ── Quiz 1: Hygiene Basics ─────────────────────────────────────────────────
  {
    id: 'hygiene-basics',
    title: 'Hygiene Basics',
    emoji: '🪥',
    description: 'How clean are your habits? Test your hygiene knowledge!',
    ageRange: '5–10',
    color: 'bg-yellow-100 border-yellow-300',
    xpReward: 2,
    questions: [
      {
        q: 'How many seconds should you wash your hands to get rid of germs?',
        options: ['5 seconds', '10 seconds', '20 seconds', '1 minute'],
        correct: 2,
        explanation: 'Washing for 20 seconds (sing Happy Birthday twice!) removes most germs. Great job! 🧼',
      },
      {
        q: 'When is the MOST important time to wash your hands?',
        options: [
          'Before eating food',
          'After watching TV',
          'After playing video games',
          'Before going to sleep',
        ],
        correct: 0,
        explanation: 'Washing hands before eating stops germs from getting into your tummy! 🍽️',
      },
      {
        q: 'How often should you brush your teeth?',
        options: ['Once a week', 'Once a day', 'Twice a day', 'Only when they hurt'],
        correct: 2,
        explanation: 'Brush morning and night to keep teeth strong and cavities away! 😁',
      },
      {
        q: 'What should you do when you sneeze or cough?',
        options: [
          'Sneeze into your hands',
          'Sneeze into your elbow or a tissue',
          'Hold your breath',
          'Run outside',
        ],
        correct: 1,
        explanation: 'Sneezing into your elbow or a tissue traps germs and keeps others safe! 🤧',
      },
      {
        q: 'Why is it important to keep your nails short and clean?',
        options: [
          'So they look nice',
          'Germs can hide under dirty nails',
          'Short nails are stronger',
          'It helps you run faster',
        ],
        correct: 1,
        explanation: 'Germs love to hide under long dirty nails — trimming them helps keep you healthy! ✂️',
      },
    ],
  },

  // ── Quiz 2: Food Facts ────────────────────────────────────────────────────
  {
    id: 'food-facts',
    title: 'Food Facts',
    emoji: '🍎',
    description: 'Which foods keep you strong? Find out now!',
    ageRange: '6–12',
    color: 'bg-orange-100 border-orange-300',
    xpReward: 2,
    questions: [
      {
        q: 'Which of these gives your body the most energy to play?',
        options: ['Chips and soda', 'Rice, roti or bread', 'Candy', 'Ice cream'],
        correct: 1,
        explanation: 'Rice, roti and bread give you long-lasting energy to run and play! 🏃',
      },
      {
        q: 'Which colour of fruits and vegetables should you try to eat?',
        options: [
          'Only green ones',
          'Only red ones',
          'As many different colours as possible',
          'Colour does not matter',
        ],
        correct: 2,
        explanation: 'Eating a rainbow of colours means getting lots of different vitamins and minerals! 🌈',
      },
      {
        q: 'What does vitamin C (found in oranges and lemons) help your body do?',
        options: [
          'Run faster',
          'Fight off colds and infections',
          'Sleep better',
          'See in the dark',
        ],
        correct: 1,
        explanation: 'Vitamin C helps your body fight germs — so eat those oranges! 🍊',
      },
      {
        q: 'How many glasses of water should a child drink every day?',
        options: ['1–2 glasses', '3–4 glasses', '6–8 glasses', '12 glasses'],
        correct: 2,
        explanation: 'About 6–8 glasses keeps your body hydrated and your brain working well! 💧',
      },
      {
        q: 'Which food helps build strong bones and teeth?',
        options: ['Chocolate', 'Milk and dairy foods', 'Soft drinks', 'Biscuits'],
        correct: 1,
        explanation: 'Milk, curd and paneer are rich in calcium — the secret to strong bones! 🦷',
      },
    ],
  },

  // ── Quiz 3: Sleep Smart ───────────────────────────────────────────────────
  {
    id: 'sleep-smart',
    title: 'Sleep Smart',
    emoji: '😴',
    description: 'Why is sleep so important? Take the quiz!',
    ageRange: '5–10',
    color: 'bg-indigo-100 border-indigo-300',
    xpReward: 2,
    questions: [
      {
        q: 'How many hours of sleep do most kids aged 6–12 need each night?',
        options: ['4–5 hours', '6–7 hours', '9–11 hours', '14 hours'],
        correct: 2,
        explanation: 'Kids need 9–11 hours so their bodies and brains can grow and recharge! 🌙',
      },
      {
        q: 'What happens to your body while you are sleeping?',
        options: [
          'Nothing — it completely shuts down',
          'Your body grows, heals, and stores memories',
          'Your heart stops beating',
          'You use more energy than when awake',
        ],
        correct: 1,
        explanation: 'Amazing things happen while you sleep — your body repairs itself and your brain saves new things you learned! 🧠',
      },
      {
        q: 'Which of these habits helps you fall asleep faster?',
        options: [
          'Playing on a phone or tablet in bed',
          'Drinking cola before bed',
          'Reading a book or listening to calm music',
          'Eating a big meal just before sleeping',
        ],
        correct: 2,
        explanation: 'Calm activities like reading signal to your brain that it is time to rest! 📚',
      },
      {
        q: 'What might happen if you do not sleep enough nights in a row?',
        options: [
          'You become stronger',
          'You feel grumpy, tired and find it hard to concentrate',
          'You need less food',
          'Your eyesight gets better',
        ],
        correct: 1,
        explanation: 'Missing sleep makes it hard to think, learn, and stay in a good mood. Sweet dreams matter! 😊',
      },
      {
        q: 'What is the best time for children to go to bed on a school night?',
        options: ['Midnight', 'After 10 pm', 'Between 8 pm and 9 pm', 'Whenever they feel like it'],
        correct: 2,
        explanation: 'Going to bed around 8–9 pm gives your body the full sleep it needs to be ready for the next day! 🛏️',
      },
    ],
  },

  // ── Quiz 4: Know Your Body ────────────────────────────────────────────────
  {
    id: 'body-parts',
    title: 'Know Your Body',
    emoji: '🫀',
    description: 'Learn what each part of your body does!',
    ageRange: '7–12',
    color: 'bg-pink-100 border-pink-300',
    xpReward: 2,
    questions: [
      {
        q: 'What does your heart do?',
        options: [
          'Digest your food',
          'Help you breathe',
          'Pump blood all around your body',
          'Filter water in your blood',
        ],
        correct: 2,
        explanation: 'Your heart is like a pump that sends blood — carrying oxygen and nutrients — to every part of your body! ❤️',
      },
      {
        q: 'Which organ cleans your blood and removes waste?',
        options: ['Stomach', 'Kidneys', 'Lungs', 'Brain'],
        correct: 1,
        explanation: 'Your kidneys filter blood and turn waste into urine — they work incredibly hard every day! 💪',
      },
      {
        q: 'What do your lungs do?',
        options: [
          'Pump blood',
          'Break down food',
          'Breathe in oxygen and breathe out carbon dioxide',
          'Store energy',
        ],
        correct: 2,
        explanation: 'Every breath in brings oxygen your cells need, and every breath out removes carbon dioxide. Breathe easy! 🫁',
      },
      {
        q: 'Which part of your body controls everything — your thinking, feelings, and movement?',
        options: ['Heart', 'Stomach', 'Brain', 'Bones'],
        correct: 2,
        explanation: 'Your brain is the control centre of your whole body — it never fully switches off! 🧠',
      },
      {
        q: 'What is the main job of your skeleton (bones)?',
        options: [
          'To make you look tall',
          'To give your body shape, protect organs, and let you move',
          'To digest food',
          'To keep you warm',
        ],
        correct: 1,
        explanation: 'Your 206 bones give your body its shape, protect your heart and brain, and help you run and play! 🦴',
      },
    ],
  },
];

export default kidsQuizzes;
