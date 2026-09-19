MODULE 4: INFRASTRUCTURE, VOICE, FOLLOW-UP & DEPLOYMENT (FINAL SPECIFICATION v6.0)
Role Definition: You are the Senior Infrastructure, Reliability & Interaction Lead. You are tasked with implementing the deployment pipeline, voice interaction layer, follow-up continuity engine, and backend security for a preventive healthcare triage application. Adhere strictly to the architectural constraints, updated schemas, unified naming conventions, and environment configurations below.

1. Day 0 Deployment & Environment Strategy
You must deploy the application skeleton before writing feature code to catch host-breaking surprises immediately.

Frontend Deployment (Vercel): Deploy the React + Vite + Tailwind app to Vercel.

Build Command: npm run build

Output Directory: dist

SPA Routing Config (Required): Create a vercel.json file in the root of the frontend project to prevent 404 errors on page refresh:

JSON
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
Backend Deployment (Render/Railway): Deploy the FastAPI Python backend.

Secrets Management (Strict Contract): Maintain a shared .env.example file. Use the exact variables below. Never expose the Gemini API key or Firebase Admin keys in the frontend.

Required Frontend Variables (.env.local):

Plaintext
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_API_BASE_URL=
VITE_GOOGLE_MAPS_API_KEY= 
# CRITICAL: You must restrict VITE_GOOGLE_MAPS_API_KEY in the Google Cloud Console to HTTP Referrers only (e.g., your Vercel domain).
Required Backend Variables (.env):

Plaintext
GEMINI_API_KEY=
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
DEMO_MODE=false
2. API Routing Architecture (Strict Flow)
To ensure security, prevent secret leakage, and prevent unnecessary backend bottlenecks, operations must follow these exact data paths:

Database, Auth, & Maps (Direct via Client SDK):

Frontend (React) ➔ Firebase Auth

Frontend (React) ➔ Firestore (Protected by Security Rules)

Frontend (React) ➔ Google Places API (Using VITE_GOOGLE_MAPS_API_KEY restricted by HTTP Referrer).

AI Operations (Secure Orchestration):

Frontend (React) ➔ Backend (FastAPI) ➔ External API (Gemini)

The frontend must never call the Gemini API directly. The frontend sends the user request + Firebase ID Token to FastAPI. The backend verifies the token, constructs the prompt, calls Gemini, and returns the structured JSON.

3. Backend Security & CORS Configuration
Authentication Flow: The React frontend must send the user's Firebase ID token in the Authorization: Bearer <token> header for all FastAPI requests.

Backend Verification: The FastAPI endpoints must use the Firebase Admin SDK to decode and verify the ID token (auth.verify_id_token()). Reject missing or invalid tokens with a 401 Unauthorized HTTP status.

FastAPI CORS Configuration (Mandatory): To prevent cross-origin failures between Vercel and your backend host, implement this exact middleware in your FastAPI entry point:

Python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://your-vercel-domain.vercel.app" # Replace with actual Vercel domain
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
4. The Follow-Up Engine (Single Source of Truth)
Do NOT create a separate followups collection. We are unifying follow-up tracking into the existing assessments collection to minimize database reads and simplify the architecture.

Schema Update: Ensure every completed document in the assessments collection uses a native Firestore Timestamp to avoid timezone bugs:

JSON
{
  "follow_up_date": "Firestore Timestamp",
  "follow_up_completed": false
}
Dashboard Reminder Query: On the user's dashboard, run this exact query to find pending follow-ups:

JavaScript
import { collection, query, where, getDocs } from "firebase/firestore";

const q = query(
  collection(db, "assessments"),
  where("uid", "==", currentUser.uid),
  where("follow_up_completed", "==", false),
  where("follow_up_date", "<=", todayTimestamp)
);
CRITICAL - Firestore Index Required:
This query will fail without a composite index. Add this exact entry to your firestore.indexes.json file to deploy the index automatically:

JSON
{
  "indexes": [
    {
      "collectionGroup": "assessments",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "uid",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "follow_up_completed",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "follow_up_date",
          "order": "ASCENDING"
        }
      ]
    }
  ]
}
UI & State Management: Render a high-visibility "Due Today" banner on the dashboard. Provide a "Mark as Complete" button that updates follow_up_completed to true in Firestore, removing the banner.

5. Voice AI Layer (Zero-Infrastructure)
You must use browser-native capabilities to avoid external API key management and latency.

Speech-to-Text: Implement a React hook using the Web Speech API (window.SpeechRecognition || window.webkitSpeechRecognition).

Support language configuration mapped exactly to the Module 3 user preferences: English (en-IN), Hindi (hi-IN), and Telugu (te-IN).

Strict Fallback: If the API is unsupported (e.g., Safari), the microphone is denied, or a network error occurs, gracefully fallback to standard text input with the message: "Voice unavailable — type your question instead."

6. Firestore Security Rules (Unified uid Standard)
Never deploy open Firestore rules. Use the exact rules below.
CRITICAL: We have standardized on the field name uid (NOT userId) across all collections to prevent rule evaluation failures. users documents are protected against accidental deletion.

JavaScript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() { return request.auth != null; }
    
    match /users/{uid} {
      allow read, create, update: if signedIn() && request.auth.uid == uid;
      allow delete: if false; // Protect against accidental demo profile deletion
    }
    
    match /assessments/{id} {
      // Must use .uid to match the document schema
      allow create: if signedIn() && request.resource.data.uid == request.auth.uid;
      allow read, update, delete: if signedIn() && resource.data.uid == request.auth.uid;
    }
    
    match /{document=**} {
      allow read, write: if false; // Deny all other access
    }
  }
}
7. Demo Reliability & Fallback Playbook
Implement the DEMO_MODE environment flag. If external services fail during the live pitch, the app must degrade gracefully.

Gemini Failure: If the Gemini API times out or fails, the FastAPI backend must catch the exception and return a deterministic, hard-coded fallback JSON response so the UI does not crash.

Maps Failure: If Google Places fails on the frontend, fall back to rendering a local seeded JSON list of healthcare facilities.

Your Module 2 specification says:
Google Places API (Nearby Search)
The old Places API and the new Places API have different frontend capabilities and restrictions.
For a hackathon, I would avoid:
Frontend
   ↓
Google Places REST API
because:
•	API key exposure risk 
•	quota abuse risk 
•	CORS surprises 
•	Google changes APIs frequently 
A safer approach is:
Frontend
   ↓
Maps JavaScript SDK
   ↓
Places Library
or
Frontend
   ↓
FastAPI
   ↓
Places API
Since Module 2 already assumed frontend integration, keep it as frontend, but add:
Use Google Maps JavaScript SDK + Places Library.
Do not directly call raw Places REST endpoints from the browser.
That removes a whole category of deployment bugs.

