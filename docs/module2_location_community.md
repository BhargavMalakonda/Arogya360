MODULE 2: LOCATION, HISTORY & COMMUNITY DATA (FINAL SPECIFICATION v3.0)
Role Definition: You are a Senior Frontend and Firebase Developer. You are tasked with implementing the "Location, History, and Community Data" module for a healthcare triage application. Follow these technical constraints, schemas, queries, and UI states exactly.
1. Facility Discovery Flows
You must implement two distinct location-based searches using the Google Places API (Nearby Search) based on the user's HTML5 geolocation.
A. Standard "Find Care Now" Flow:
•	Target: General nearby healthcare facilities (clinics, primary care).
•	Cost Control Rule: Limit Nearby Search results to a maximum of 10 facilities to prevent unnecessary API costs.
•	Distance: Use the Haversine formula to calculate straight-line distance if the API omits it.
B. Emergency Engine Flow (Pre-LLM Bypass):
•	Target: Nearby hospitals capable of handling emergency referrals.
•	Cost Control Rule: Limit results to exactly 5 facilities.
•	Unblocking Rule: Do NOT wait for the Google Places API to return results before showing the red flag warning. Show the alert immediately, then populate the 5 hospitals once loaded.
C. The Adapter Pattern (Strict Rule): All Google Places responses must be transformed through a placesAdapter() utility before reaching UI components. UI components must NEVER consume Google-specific field names. They must only consume this internal contract:
JSON
{
  "id": "google-place-id",
  "name": "District Hospital",
  "address": "Main Road, Srikakulam",
  "latitude": 18.2969,
  "longitude": 83.8978,
  "open_now": true,
  "distance_km": 2.4
}
2. Locality Capture & Schemas
Locality (pincode) is the primary key for our Community Insights. Ask for pincode and district exactly ONCE during user onboarding. When a triage is completed, snapshot it into the assessments document.
Required Schemas:
JSON
// users/{uid}
{
  "uid": "firebase-auth-uid",
  "name": "User name",
  "district": "Srikakulam",
  "pincode": "532001",
  "created_at": "timestamp"
}

// assessments/{assessment_id}
{
  "assessment_id": "uuid",
  "uid": "firebase-auth-uid",
  "initial_symptom": "Fever and cough",
  "condition_pattern": "Pneumonia", 
  "matched_symptoms": ["persistent cough", "high fever"],
  "risk_level": "ESI-3",
  "symptom_category": "respiratory",
  "recommendations": ["Visit a PHC within 24-48 hours"],
  "prevention_tips": ["Ensure proper ventilation"],
  "follow_up_date": "timestamp",
  "pincode": "532001",
  "district": "Srikakulam",
  "knowledge_base_version": "1.0",
  "assessment_version": "3.0",
  "created_at": "timestamp"
}
Medicolegal Safeguard: condition_pattern is stored for individual assessment review ONLY. Community aggregation must NEVER use condition_pattern. Only symptom_category is allowed.
3. Community Insights (Firestore Aggregation)
Display local symptom trends based on the user's pincode. Do not download documents; use the Firebase V9 getCountFromServer() function.
•	Privacy Suppression Rule: If count_last_7_days is less than 3, do not display the exact count. Display the fallback string: "Limited community activity data available" to prevent accidental identification in small communities.
•	The Trend Rule (v1 Prototype): Do not calculate or display "trends" (e.g., stable, up, down) since we lack historical comparison data. Display the raw count only.
•	Display Contract:
JSON
{
  "symptom_category": "respiratory",
  "count_last_7_days": 8,
  "display_label": "Respiratory Symptoms"
}
•	CRITICAL - Firestore Index Required:
o	Collection: assessments
o	Fields: pincode (Ascending) + symptom_category (Ascending) + created_at (Descending).
4. Assessment History
Provide a read-only, reverse-chronological list of the user's past triage sessions.
•	Query: Fetch documents from assessments where uid == currentUser.uid, ordered by created_at descending, limit 20.
•	Firestore Security Rule (Mandatory): Assessment history queries must only return documents belonging to the authenticated user. Implement this exact rule in firestore.rules:
JavaScript
match /assessments/{assessmentId} {
  allow read: if request.auth != null 
               && resource.data.uid == request.auth.uid;
               
  allow write: if request.auth != null;
}
•	CRITICAL - Firestore Index Required:
o	Collection: assessments
o	Fields: uid (Ascending) + created_at (Descending).
5. Required UI/UX States
To ensure a robust demo, frontend components must explicitly handle and render the following states:
Find Care Now / Emergency Lookup:
•	Loading
•	Permission Denied (Geolocation)
•	Location Timeout
•	Location Unavailable
•	Facilities Loaded
•	No Facilities Found
•	Places API Error (with retry button)
Assessment History:
•	Loading
•	No Assessments (Empty State)
•	History Loaded
•	Firestore Error
•	Unauthenticated User (Redirect to login)

1. Fix Firestore Write Rule
Current:
allow write: if request.auth != null;
This is too broad.
Any authenticated user could theoretically write any assessment document.
Safer:
match /assessments/{assessmentId} {
  allow read: if request.auth != null
               && resource.data.uid == request.auth.uid;

  allow create: if request.auth != null
                 && request.resource.data.uid == request.auth.uid;

  allow update, delete: if false;
}
Since your history is read-only and assessments are written only once after completion.
________________________________________
2. Add History Detail View Fields
Currently Module 4 only describes query.
Add:
Assessment Detail View must display:

• Initial Symptom
• Risk Level
• Symptom Category
• Matched Symptoms
• Recommendations
• Prevention Tips
• Follow Up Date
• Knowledge Base Version
• Assessment Version
Otherwise developers may show only partial data.
________________________________________
3. Add Required Firebase Composite Indexes Section
Instead of scattering indexes, create one section.
## Firestore Composite Indexes

1. Community Insights

Collection: assessments

pincode ASC
symptom_category ASC
created_at DESC

2. Assessment History

Collection: assessments

uid ASC
created_at DESC
Makes deployment easier.

