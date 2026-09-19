/**
 * kidsStories.js
 *
 * Fully local, static story data for the Health Stories module.
 * No API calls, no Gemini, no Firestore.
 *
 * Each story has:
 *   id          {string}   — unique identifier
 *   title       {string}   — display title
 *   emoji       {string}   — cover emoji shown on the list card
 *   description {string}   — one-line teaser shown on the list card
 *   ageRange    {string}   — suggested age range
 *   moral       {string}   — the healthy-habit takeaway shown at the end
 *   color       {string}   — Tailwind classes for the list card
 *   xpReward    {number}   — XP awarded for finishing the story
 *   pages       {Array}    — ordered array of { text, emoji } page objects
 *
 * Content rule: everyday healthy habits only.
 * No medical/diagnostic content, no symptom descriptions.
 */

const kidsStories = [
  // ── Story 1: Raju Washes His Hands ────────────────────────────────────────
  {
    id: 'raju-handwash',
    title: "Raju Washes His Hands",
    emoji: '👦',
    description: 'Raju learns why washing hands before eating keeps tummy bugs away.',
    ageRange: '4–8',
    moral: '🧼 Clean hands mean a healthy you!',
    color: 'bg-cyan-100 border-cyan-300',
    xpReward: 5,
    pages: [
      {
        emoji: '🌞',
        text: 'Raju ran in from the garden, cheeks rosy and tummy rumbling.\n\n"Lunchtime!" called Mummy. "Wash your hands first, Raju!"',
      },
      {
        emoji: '🤔',
        text: '"But Mummy," said Raju, "my hands LOOK clean. I can\'t see any dirt!"\n\nMummy smiled. "Germs are invisible, Raju. You can\'t see them, but they are there."',
      },
      {
        emoji: '🧼',
        text: 'Mummy helped Raju turn on the tap.\n\n"Wet your hands. Put soap. Scrub for twenty seconds — sing Happy Birthday twice!"\n\nRaju scrubbed between his fingers, under his nails, and around his wrists.',
      },
      {
        emoji: '🚿',
        text: '"Now rinse all the soap off," said Mummy.\n\nRaju watched the soapy bubbles disappear down the drain, taking all the invisible germs with them.',
      },
      {
        emoji: '🍽️',
        text: 'Raju dried his hands and sat down to eat.\n\n"That felt good!" he said.\n\nMummy gave him a big hug. "Clean hands keep tummy bugs away. You are a Handwash Hero now, Raju!"',
      },
    ],
  },

  // ── Story 2: Priya and the Rainbow Plate ──────────────────────────────────
  {
    id: 'priya-veggies',
    title: "Priya and the Rainbow Plate",
    emoji: '👧',
    description: 'Priya discovers that eating colourful vegetables gives you superpowers.',
    ageRange: '5–9',
    moral: '🌈 Eat the rainbow every day!',
    color: 'bg-lime-100 border-lime-300',
    xpReward: 5,
    pages: [
      {
        emoji: '😒',
        text: 'Priya pushed the carrot and spinach to the side of her plate.\n\n"I don\'t want vegetables," she said. "They are boring and they taste yucky."',
      },
      {
        emoji: '🌈',
        text: 'Grandma sat beside her with a big smile.\n\n"Did you know," said Grandma, "that every colour of vegetable gives you a different superpower?"',
      },
      {
        emoji: '🥕',
        text: '"Orange carrots help your EYES see better — even in the dark!" said Grandma.\n\nPriya\'s eyes went wide. "Like a cat?"\n\n"Exactly like a cat," Grandma laughed.',
      },
      {
        emoji: '🥬',
        text: '"Dark green spinach builds STRONG MUSCLES," Grandma continued.\n\n"Like a superhero?" asked Priya.\n\n"Stronger than a superhero," said Grandma.',
      },
      {
        emoji: '🍽️',
        text: 'Priya took a big bite of carrot. Then a bite of spinach.\n\n"I am getting superpowers!" she announced.\n\nGrandma winked. "Eat the rainbow every day and you will be unstoppable, Priya!"',
      },
    ],
  },

  // ── Story 3: Arjun's Sleepy Adventure ────────────────────────────────────
  {
    id: 'arjun-sleep',
    title: "Arjun's Sleepy Adventure",
    emoji: '🌙',
    description: 'Arjun stays up too late and learns what happens when we skip sleep.',
    ageRange: '5–10',
    moral: '😴 Good sleep helps you grow strong.',
    color: 'bg-violet-100 border-violet-300',
    xpReward: 5,
    pages: [
      {
        emoji: '🎮',
        text: 'Arjun was playing his favourite game when Daddy said, "Bedtime, Arjun!"\n\n"Just five more minutes," begged Arjun. Five minutes turned into one more hour.',
      },
      {
        emoji: '😴',
        text: 'The next morning Arjun could barely open his eyes.\n\nHis head felt heavy. His legs felt like they were made of stones.',
      },
      {
        emoji: '📚',
        text: 'At school, Arjun could not remember his teacher\'s story. He yawned so many times his jaw ached.\n\n"Are you all right, Arjun?" asked his teacher.',
      },
      {
        emoji: '⭐',
        text: 'That evening, Daddy explained: "When you sleep, your brain saves everything you learned, and your body grows a tiny bit taller."\n\n"So sleep is like charging my body?" said Arjun.\n\n"Exactly," smiled Daddy.',
      },
      {
        emoji: '🛏️',
        text: 'Arjun put his game away early that night.\n\nHe closed his eyes, and in moments he was dreaming the best adventure of his life.\n\nHe woke up the next day full of energy — and one tiny bit taller!',
      },
    ],
  },

  // ── Story 4: Meera Drinks Up ──────────────────────────────────────────────
  {
    id: 'meera-water',
    title: "Meera Drinks Up",
    emoji: '💧',
    description: 'Meera goes on a hot day adventure and discovers why water is magical.',
    ageRange: '4–8',
    moral: '💧 Water is your body\'s best friend!',
    color: 'bg-sky-100 border-sky-300',
    xpReward: 5,
    pages: [
      {
        emoji: '☀️',
        text: 'It was the hottest day of summer. Meera was running races with her friends in the garden.\n\nAfter a while, she felt dizzy and her mouth was very dry.',
      },
      {
        emoji: '😵',
        text: '"Meera, sit down," said her friend Tara. "Your face is all red!"\n\nMeera felt tired and a little headachey. She did not understand why.',
      },
      {
        emoji: '💧',
        text: 'Meera\'s aunt brought a big glass of cool water.\n\n"Drink slowly," she said gently.\n\nMeera drank. Then drank some more. Slowly, the dizzy feeling began to fade.',
      },
      {
        emoji: '🌊',
        text: '"Your body is about sixty percent water," said Auntie. "When you run and sweat, your body loses water. You need to top it up regularly — especially on hot days!"',
      },
      {
        emoji: '🏃',
        text: 'Meera filled up her water bottle and carried it with her for the rest of the day.\n\nEvery thirty minutes she took a few sips.\n\nShe finished all her races feeling strong and happy.\n\n"Water really IS magic!" she told Tara.',
      },
    ],
  },
];

export default kidsStories;
