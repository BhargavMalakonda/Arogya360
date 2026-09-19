MODULE 3: FRONTEND SHELL, AUTH & MULTILINGUAL (FINAL SPECIFICATION v3.0)
Role Definition: You are a Senior Frontend Engineer and UI/UX Architect. You are tasked with implementing the App Shell, Authentication, and Shared Component Library for a preventive healthcare triage application. Adhere strictly to the architectural constraints, rapid-prototyping mindset, state management rules, and component contracts defined below. Do not over-engineer authentication or localization.
1. Authentication & Onboarding
Implement a frictionless email/password authentication flow using Firebase Auth.
•	Excluded Features: Do NOT implement Phone OTP, Google/Social OAuth, or Email Verification link flows.
•	Firestore User Schema: Write captured onboarding data to Firestore users/{uid} matching this exact schema:
JSON
{
  "uid": "firebase-auth-uid",
  "email": "user@example.com",
  "name": "User name",
  "district": "Srikakulam",
  "pincode": "532001",
  "language_pref": "en",
  "created_at": "timestamp"
}
•	Global Auth Context: Implement a React Context (or Zustand store) to manage session state globally so screens do not repeatedly query Firestore. The context must expose:
JavaScript
{
  user,           // Firebase Auth user object
  userProfile,    // Firestore user document (name, district, pincode, language_pref)
  loading,        // Auth initialization state
  logout(),       // Sign out function
  refreshProfile()// Re-fetch Firestore doc if updated
}
•	Application Startup Flow (Strict Initialization): To remove all routing ambiguity, the app must follow this exact loading sequence on launch:
1.	Firebase Auth initializes.
2.	AuthContext loads current user.
3.	Fetch users/{uid} from Firestore.
4.	Store userProfile in global context.
5.	Evaluate Redirects:
	Not logged in -> Redirect to /auth
	Logged in, but missing profile -> Redirect to /onboarding
	Logged in, profile exists -> Redirect to /home
2. Multilingual Strategy (AI + Tiny Dictionary)
•	Supported Languages: English (en), Hindi (hi), Telugu (te).
•	The Hackathon i18n Rule: Do NOT install localization libraries like react-i18next.
•	AI Dynamic Localization (Core): Pass userProfile.language_pref to the backend for the AI triage. The backend will instruct Gemini to translate all dynamic medical output (questions, options, prevention tips).
•	Static UI Localization (Tiny Dictionary): For app shell buttons (e.g., "Home", "History", "Logout"), use a simple, hard-coded local JavaScript dictionary object.
JavaScript
const staticLabels = {
  en: { home: "Home", triage: "Assess", history: "History" },
  hi: { home: "होम", triage: "जांच", history: "इतिहास" },
  te: { home: "హోమ్", triage: "పరీక్ష", history: "చరిత్ర" }
};
3. Global App Shell & Routing
Design a mobile-first responsive layout.
•	Route Structure & Protection: Implement these exact routes. Protected routes MUST redirect to /auth if the user is unauthenticated.
o	/ (Root redirects based on App Startup Flow)
o	/auth (Public - Login/Signup)
o	/onboarding (Protected - Profile capture)
o	Protected Routes:
	/home (Dashboard)
	/triage (Start new AI assessment)
	/result/:assessmentId (Final output screen)
	/history (List view)
	/history/:assessmentId (Read-only detail view)
•	Navigation: Top Bar (App Logo, Language Toggle, Logout/Profile). Bottom Navigation (Home, Triage, History).
•	Educator Mode: Place a global toggle in the Top Bar. It MUST persist in localStorage (localStorage.setItem("educatorMode", "true")). Default is false.
4. Shared UI Theme & Component Library (Design Contract)
All developers must use these specific theme values and components so the app looks unified.
•	Theme Colors:
o	Brand Primary: #2563EB
o	Success: #16A34A
o	Warning: #F59E0B
o	Emergency: #DC2626
o	Background: #F8FAFC
•	Risk Badge Mapping (ESI):
o	ESI-1 & ESI-2 -> Emergency (Red)
o	ESI-3 -> Warning (Orange/Yellow)
o	ESI-4 & ESI-5 -> Success (Green)
•	Core Components to Build:
o	CardContainer: White background, rounded corners, subtle shadow, padding.
o	PrimaryButton & SecondaryButton (solid brand vs. outlined).
o	EmergencyBanner: Full-width red banner for ESI-1/ESI-2 warnings.
o	MCQOptionButton: Full-width clickable button for AI chat choices.
o	ClinicalHintBox: A stylized alert box (rendered only if Educator Mode is true).
5. The 4 "Golden-Path" Wireframes
Build the layout shapes for these core screens:
Screen 1: Authentication & Onboarding (/auth, /onboarding)
•	Email/Password inputs, Login/Signup toggle.
•	Post-signup Onboarding Modal: Inputs for Name, Pincode, and Language dropdown.
Screen 2: Home Dashboard (/home)
•	Greeting: "Hello, [Name]"
•	Hero CTA: Huge PrimaryButton -> "Start Symptom Assessment".
•	Community Insight Section: CardContainer displaying local symptom counts.
•	Find Care Now Section: Embedded list showing nearby Google Places facilities.
Screen 3: AI Triage Flow (/triage)
•	Chat-style UI, but strictly multiple-choice (no open text input box after the initial complaint).
•	Renders Gemini's question as a chat bubble.
•	Renders Gemini's options array as MCQOptionButtons.
•	Renders ClinicalHintBox dynamically if Educator Mode is active.
Screen 4: Final Assessment & Result (/result/:assessmentId)
•	Top Section: Risk Level Badge (color-coded).
•	Matched Symptoms List.
•	Action Plan (CardContainer with recommended next steps).
•	Prevention & Schemes (CardContainer with localized tips and injected Government Scheme).
•	Export Options: SecondaryButton ("Download PDF") and PrimaryButton ("Share via WhatsApp" utilizing navigator.share()).

