# claude.md — Arogya360 Frontend Directives

You are building the frontend for Arogya360, a preventive-healthcare self-triage web app
for underserved communities (Problem Statement 2). This is a HACKATHON MVP. Do not
over-engineer. Do not add features beyond what is explicitly specified below.

## Stack (non-negotiable)
- React + Vite + Tailwind CSS. No Next.js, no CRA, no other framework.
- react-router-dom for routing. No other routing library.
- Firebase JS SDK (Auth + Firestore) called directly from the client — never proxy
  Firebase Auth or Firestore reads/writes through the backend.
- Google Maps: use the **Maps JavaScript API + Places Library** loaded via script tag
  or `@googlemaps/js-api-loader`. NEVER call the Places REST API directly from fetch/axios
  in the browser — this exposes the API key to abuse and has caused deployment breakage
  on this team before. If you find yourself constructing a raw
  `https://maps.googleapis.com/maps/api/place/...` URL, stop — that's the wrong pattern.
- NO localization library (no react-i18next, no i18next, no FormatJS). Static UI strings
  use a hard-coded JS dictionary object (see Section 5). AI-generated medical content is
  already translated server-side based on `userProfile.language_pref` — the frontend
  just renders whatever language string the backend/Firestore already contains.
- NO UI component library (no MUI, no Chakra, no shadcn). Build the components listed in
  Section 4 yourself with Tailwind utility classes only.

## Visual Style — READ CAREFULLY, THIS IS WHERE MOST AGENTS OVERSHOOT
You have been shown reference screenshots of a product called "AuraMed." Those screenshots
are a STYLE REFERENCE ONLY. Take from them:
- Glassmorphism cards: soft translucent white/light backgrounds, backdrop-blur, subtle
  border, rounded-2xl corners, soft drop shadows
- Gradient primary buttons (indigo/purple gradient, white text, rounded-xl, slight glow
  on hover)
- Clean sans-serif typography, generous whitespace, pill-shaped badges/tags
- The overall "premium clinical SaaS" polish and spacing rhythm

Do NOT take from them:
- Any feature: no differential diagnosis lists, no "AI Confidence %" displays, no
  Rx/formulary/prescription UI, no live tele-consultation/video, no EMR/ABDM/FHIR
  badges, no "diagnostic reasoning chain" drawer. None of these exist in this app's
  scope. If a screen you're asked to build resembles one of these, stop and flag it —
  it is out of scope for Problem Statement 2.
- The "Institutional/Clinician" framing, login copy, or persona (this app's users are
  community members and health volunteers, not credentialed doctors logging into an
  enterprise EMR). Rewrite all copy for a warm, plain-language, patient-facing tone.

## Theme Tokens (put these in tailwind.config.js, do not deviate)
- Overall brand/UI accents: indigo/purple gradient family (glassmorphism aesthetic above)
- RISK BADGES ARE LOCKED AND SEPARATE FROM THE BRAND THEME — always use these exact
  colors regardless of overall theme, because color-coded medical risk must stay
  conventional:
  - ESI-1 / ESI-2 → Emergency red `#DC2626`
  - ESI-3 → Warning orange/amber `#F59E0B`
  - ESI-4 / ESI-5 → Success green `#16A34A`
- Background: `#F8FAFC` (or a very light glassmorphism gradient backdrop — your call,
  but keep it light, not the dark navy of the AuraMed reference)

## Module 3 Constraints — implement exactly
### Auth & Startup Flow
- Firebase Auth: email/password ONLY. No phone OTP, no Google/social login, no email
  verification links.
- On write to `users/{uid}` after signup, use exactly this schema:
  `{ uid, email, name, district, pincode, language_pref, created_at }`
- Implement a global AuthContext exposing: `{ user, userProfile, loading, logout(), refreshProfile() }`
- Strict startup sequence: Firebase Auth initializes → AuthContext loads user →
  fetch `users/{uid}` from Firestore → store in context → THEN evaluate redirect:
  - not logged in → `/auth`
  - logged in, no profile doc → `/onboarding`
  - logged in, profile exists → `/home`

### Routes (implement exactly these, no more, no less)
- `/` — redirect logic only, per startup flow above
- `/auth` — public, login/signup toggle
- `/onboarding` — protected, captures name/pincode/district/language
- `/home` — protected, dashboard
- `/triage` — protected, MCQ triage flow
- `/result/:assessmentId` — protected, final result
- `/history` — protected, list view
- `/history/:assessmentId` — protected, read-only detail view
All protected routes redirect unauthenticated users to `/auth`.

### Navigation
- Top bar: logo, language toggle (EN/HI/TE), Educator Mode toggle (persisted to
  `localStorage.setItem("educatorMode", ...)`, default `false`), logout/profile
- Bottom nav (mobile-first): Home, Triage (Assess), History

## Reusable Components (build these exactly, reuse everywhere — no ad-hoc duplicates)
- `CardContainer` — glassmorphism card wrapper (see Visual Style). All content blocks
  use this, never a bare `<div>` with one-off styling.
- `PrimaryButton` — gradient fill, used for the main CTA on any screen
- `SecondaryButton` — outlined/ghost variant
- `EmergencyBanner` — full-width red banner, used ONLY for ESI-1/ESI-2 alerts, appears
  above all other content when active
- `MCQOptionButton` — full-width clickable option button for the triage chat, used for
  every Gemini-returned option; never render a raw text input during the MCQ phase
- `ClinicalHintBox` — stylized info box, renders ONLY when Educator Mode is `true`,
  shows the `clinical_hint` field from the triage question payload

## Backend Communication Rule (do not violate)
- The frontend NEVER calls the Gemini API directly and NEVER holds a Gemini key.
- All triage/AI calls go: Frontend → `fetch(VITE_API_BASE_URL + '/api/triage/...')` with
  header `Authorization: Bearer <firebase-id-token>` (get the token via
  `await auth.currentUser.getIdToken()`) → FastAPI backend does the rest.
- Firestore reads/writes (history, community insights, follow-ups, user profile) go
  directly from the client via the Firebase SDK — do not route these through the backend.

## i18n (Tiny Dictionary Pattern)
Use exactly this pattern for static shell strings — do not install a library:
\`\`\`js
const staticLabels = {
  en: { home: "Home", triage: "Assess", history: "History" },
  hi: { home: "होम", triage: "जांच", history: "इतिहास" },
  te: { home: "హోమ్", triage: "పరీక్ష", history: "చరిత్ర" }
};
\`\`\`
Extend this object as new static strings are needed. Get real Hindi/Telugu translations
from the Doctor/team before finalizing — do not invent medical terminology.

## What NOT to build
- No Rx/prescription/formulary UI
- No live video/telemedicine
- No "AI Confidence %" or differential-diagnosis-list UI
- No EMR/ABDM/FHIR compliance badges or copy
- No open-text chat input during the MCQ phase (only during the very first symptom entry)
- No separate `followups` collection reads — follow-up state lives inside `assessments`