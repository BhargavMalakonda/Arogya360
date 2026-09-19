CONVERSATIONAL AI ENGINE: MASTER IMPLEMENTATION SPECIFICATION (FINAL)
Role Definition: You are a Senior Backend and AI Architect. You are tasked with implementing the core "Conversational AI Engine" for a preventive healthcare triage application. Adhere strictly to the architectural constraints, state management rules, data structures, and deterministic logic defined below. Do not deviate, invent new features, or hallucinate external APIs.
1. Core Pipeline Architecture & Execution Flow
The system must follow this exact execution flow:
1.	User Symptom Input (Frontend text/UI)
2.	Emergency Engine (Hard-coded pre-LLM bypass)
3.	Hybrid Candidate Detection (Backend intercept & dictionary lookup)
4.	Targeted Question Engine (Gemini AI generates dynamic MCQs)
5.	LLM Pattern Extraction (Gemini outputs extracted symptoms & condition pattern)
6.	Risk Pattern Detection (Backend executes deterministic ESI scoring)
7.	Preventive Action Plan & Resources (Backend enriches response from local JSON)
8.	Community Health Insight (Dynamic Pincode Aggregation via DB query tracking symptoms, not diseases)
9.	Nearest PHC / Clinic (Google Maps Places API triggered on frontend)
2. State Management & Database (Hybrid Approach)
Do NOT read or write to the database during the active chat session.
•	Client-Side Memory: Append messages to a local array (messages[]) and pass the entire history in each Gemini API call.
•	Final Write: Once the triage is complete, perform a single write to Cloud Firestore.
•	Firestore Schema: Only two collections are required:
o	users: uid, name, email, language_pref, district, created_at.
o	assessments: assessment_id, uid, initial_symptom, condition_pattern, matched_symptoms, risk_level, symptom_category, red_flags, recommendations, prevention_tips, follow_up_date, created_at, pincode, knowledge_base_version, assessment_version.
•	Community Stats (Crucial Safety Rule): Compute stats dynamically by querying the assessments collection by pincode and symptom_category. Do NOT compute or display stats by condition_pattern. The UI must display symptom trends (e.g., "Respiratory ↑"), not disease diagnoses.
3. The Emergency Engine (Pre-LLM Filter)
Before sending input to Gemini, check for hard-coded red flags.
•	Red Flags: Severe breathlessness, blue lips, unconsciousness, confusion, coughing blood, severe chest pain, unable to speak normally.
•	Action: If a red flag is detected, immediately halt the AI pipeline. Display an emergency alert, use the Google Places API to show the 5 nearest Emergency Departments, and render a "Call Emergency" button. (Note: Asthma's most severe symptoms trigger here, so they never reach the AI).
4. Hybrid Candidate Detection (Backend Gatekeeper)
•	Backend Dictionary: Implement this exact JSON map in the backend:
JSON
{
  "fever": ["Dengue", "Malaria", "Viral Fever", "Pneumonia"],
  "cough": ["Tuberculosis", "Pneumonia", "Asthma"],
  "thirst": ["Diabetes"],
  "urination": ["Diabetes"],
  "headache": ["Hypertension", "Dengue", "Viral Fever"],
  "dizziness": ["Hypertension", "Diabetes", "Anaemia"],
  "breathlessness": ["Asthma", "Pneumonia", "Tuberculosis"],
  "chest_tightness": ["Asthma", "Pneumonia"],
  "body_pain": ["Dengue", "Malaria", "Viral Fever"],
  "fatigue": ["Diabetes", "Tuberculosis", "Anaemia", "Malaria"]
}
•	Dynamic Prompt Injection: When the backend detects a keyword, it dynamically appends the matched array to the Gemini System Prompt:
"The user has reported symptoms matching the following candidate conditions: [INSERT ARRAY]. You are strictly forbidden from investigating diseases outside of this list. Your follow-up questions must differentiate between these specific candidates."
5. JSON Contracts (The Core Data Flow)
A. The Ongoing Chat Schema (Dynamic MCQs): While asking questions (Maximum 6 questions), Gemini must output:
JSON
{
  "status": "in_progress",
  "phase": "history",
  "question": "How long have you had the fever?",
  "type": "single_select",
  "options": ["<24 hours", "1-3 days", "4-7 days", ">7 days"],
  "clinical_hint": "Fever duration helps differentiate acute viral infections from chronic conditions like TB or Malaria."
}
B. The LLM Final Assessment Schema (Hand-off to Backend): Once questioning is complete, Gemini does NOT score risk. It only outputs the extracted data:
JSON
{
  "status": "complete",
  "condition_pattern": "Tuberculosis",
  "symptom_category": "respiratory",
  "matched_symptoms": [
    "cough > 2 weeks",
    "night sweats",
    "weight loss"
  ]
}
C. The Backend Enriched Schema (Final output to UI): The Node.js backend takes Schema B, calculates the ESI, injects the schemes/prevention tips, and sends this to the frontend:
JSON
{
  "assessment_version": "3.0",
  "knowledge_base_version": "1.0",
  "risk_level": "ESI-3",
  "condition_pattern": "Tuberculosis",
  "symptom_category": "respiratory",
  "matched_symptoms": ["cough > 2 weeks", "night sweats", "weight loss"],
  "recommendation": "Visit PHC for sputum testing within 24-48 hours",
  "prevention_tips": ["Ensure proper ventilation", "Avoid sharing personal items"],
  "government_scheme": "National Tuberculosis Elimination Programme (NTEP)",
  "community_alert_flag": true 
}
6. Deterministic ESI Risk Scoring (BACKEND LOGIC)
Implement a backend function calculateESI(conditionPattern, matchedSymptoms) using this strict rule table. The LLM is completely isolated from this calculation.
•	Tuberculosis (TB):
o	ESI-4: Cough > 2 weeks (isolated).
o	ESI-3: Cough > 2 weeks + (Night sweats OR Weight loss OR Fever).
o	ESI-2: TB signs + Extreme weakness/mild breathlessness.
•	Diabetes:
o	ESI-4: Frequent urination OR Excessive thirst.
o	ESI-3: Urination + Thirst + (Weight loss OR Blurred vision).
o	ESI-2: Diabetes signs + Severe vomiting/confusion/rapid breathing.
•	Hypertension:
o	ESI-4: Mild headache OR Dizziness.
o	ESI-3: Known high BP + Persistent headache/dizziness.
o	ESI-2: Severe headache + Vision changes OR Chest pain.
•	Dengue:
o	ESI-4: Mild fever + Body aches.
o	ESI-3: High fever + Severe joint pain + Pain behind eyes.
o	ESI-2: Dengue signs + Persistent vomiting/abdominal pain/bleeding.
•	Malaria:
o	ESI-4: Intermittent fever.
o	ESI-3: Fever + Severe chills + Profuse sweating.
o	ESI-2: Malaria signs + Jaundice/extreme weakness/little urine.
•	Pneumonia:
o	ESI-4: Mild cough + Low-grade fever.
o	ESI-3: Persistent cough with phlegm + High fever + Chest discomfort.
o	ESI-2: Pneumonia signs + Difficulty breathing at rest.
•	Asthma:
o	ESI-4: Occasional cough/mild wheeze.
o	ESI-3: Persistent wheezing + Chest tightness + Mild breathlessness.
o	(Note: ESI-2/ESI-1 Asthma handled by Emergency Engine).
7. Backend Injections (Data Integrity)
•	Government Schemes: Store locally in /backend/data/schemes.json. The backend dynamically maps the condition_pattern to the scheme (e.g., NTEP for TB, NP-NCD for Diabetes).
•	Prevention Tips: The backend maps the condition_pattern to a verified, hard-coded database (sourced from WHO/ICMR) and injects the array into the final response.
8. Digital Outreach & Export (NO EXTERNAL APIS)
Remove all Twilio/SMS API Integrations. Do not build backend messaging infrastructure.
•	Share to WhatsApp/SMS: Implement a client-side button utilizing the native navigator.share() Web API to pass the prevention_tips directly to the user's local messaging apps.
•	Download Summary: Implement a "Download PDF" button using client-side libraries (like html2pdf.js or jspdf) to export the final triage screen.

