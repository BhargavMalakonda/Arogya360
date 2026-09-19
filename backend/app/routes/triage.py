"""
triage.py
FastAPI router for the Arogya360 triage AI endpoints.

Endpoints:
  POST /api/triage/start   — submit initial symptom, get first MCQ
  POST /api/triage/next    — submit answer, get next MCQ or trigger final assessment
  POST /api/triage/finish  — explicitly trigger final assessment (question budget consumed)
"""

import logging
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
import firebase_admin.firestore

from app.core.auth import get_current_user
from app.core.triage_engine import (
    MAX_QUESTIONS,
    build_final_assessment,
    check_emergency,
    generate_next_question,
    match_candidate_diseases,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/triage", tags=["triage"])


# ── Request / Response models ─────────────────────────────────────────────────

class StartRequest(BaseModel):
    initial_symptom: str = Field(..., min_length=2, max_length=500)
    language_pref: str = Field(default="en", pattern="^(en|hi|te)$")
    # Optional follow-up context — present only when the user navigates here
    # from FollowUpBanner after "No Change" or "Feeling Worse". Both fields
    # default to None; existing callers that omit them are unaffected.
    previous_condition_pattern: str | None = Field(default=None, max_length=200)
    previous_assessment_date: str | None = Field(default=None, max_length=50)


class HistoryTurn(BaseModel):
    question: str
    options: list[str]
    answer: str
    clinical_hint: str = ""


class NextRequest(BaseModel):
    conversation_id: str
    initial_symptom: str
    history: list[HistoryTurn]
    candidate_diseases: list[str]
    language_pref: str = Field(default="en", pattern="^(en|hi|te)$")


class FinishRequest(BaseModel):
    conversation_id: str
    initial_symptom: str
    history: list[HistoryTurn]
    candidate_diseases: list[str]
    language_pref: str = Field(default="en", pattern="^(en|hi|te)$")


# ── Helper: fetch user profile from Firestore ─────────────────────────────────

def _get_user_profile(uid: str) -> dict[str, Any]:
    """
    Fetches users/{uid} from Firestore using the Admin SDK.
    Returns the document data dict (may be empty if profile not yet set).

    If height_cm and weight_kg are both present and valid, derives a
    'bmi_category' key (Underweight / Normal / Overweight / Obese) in-memory.
    BMI is never stored in Firestore — it is derived per request so it never
    goes stale as the user's body changes.
    """
    profile: dict[str, Any] = {}
    try:
        db = firebase_admin.firestore.client()
        doc = db.collection("users").document(uid).get()
        if doc.exists:
            profile = doc.to_dict()
    except Exception as exc:
        logger.error("Failed to fetch user profile for uid %s: %s", uid, exc)

    # Derive bmi_category if both anthropometric fields are present
    try:
        h = profile.get("height_cm")
        w = profile.get("weight_kg")
        if h and w and float(h) > 0 and float(w) > 0:
            hm = float(h) / 100.0
            bmi = float(w) / (hm * hm)
            if bmi < 18.5:
                profile["bmi_category"] = "Underweight"
            elif bmi < 25.0:
                profile["bmi_category"] = "Normal"
            elif bmi < 30.0:
                profile["bmi_category"] = "Overweight"
            else:
                profile["bmi_category"] = "Obese"
    except Exception as exc:
        logger.warning("BMI derivation failed for uid %s: %s", uid, exc)
        # Non-fatal — omit bmi_category rather than crashing

    return profile


# ── Helper: write assessment to Firestore ─────────────────────────────────────

def _write_assessment(assessment_id: str, data: dict[str, Any]) -> None:
    """
    Writes the final assessment document to assessments/{assessment_id}.
    Raises on failure so the caller can surface the error.
    """
    db = firebase_admin.firestore.client()
    db.collection("assessments").document(assessment_id).set(data)
    logger.info("Assessment written to Firestore: %s", assessment_id)


# ── POST /api/triage/start ────────────────────────────────────────────────────

@router.post("/start")
async def triage_start(
    body: StartRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Step 1: Receive the patient's free-text initial symptom.
    - Runs emergency pre-check first (ESI-1 short-circuit)
    - Matches candidate diseases from disease_dictionary
    - Asks Gemini for the first bounded MCQ
    Returns: {conversation_id, candidate_diseases, question, options, clinical_hint}
    OR:      {emergency: true, risk_level: "ESI-1", ...} if emergency keyword matched
    """
    symptom = body.initial_symptom.strip()

    # 1. Emergency check — bypasses everything else
    emergency = check_emergency(symptom)
    if emergency:
        return emergency

    # 2. Disease-dictionary keyword match
    candidates = match_candidate_diseases(symptom)

    # 3. Fetch user profile (needed for bmi_category context)
    uid = current_user["uid"]
    profile = _get_user_profile(uid)
    bmi_category = profile.get("bmi_category")

    # 4. Generate first question
    first_question = generate_next_question(
        initial_symptom=symptom,
        candidate_diseases=candidates,
        history=[],
        language_pref=body.language_pref,
        previous_condition_pattern=body.previous_condition_pattern,
        previous_assessment_date=body.previous_assessment_date,
        bmi_category=bmi_category,
    )

    conversation_id = str(uuid.uuid4())

    return {
        "conversation_id": conversation_id,
        "candidate_diseases": candidates,
        **first_question,  # question, options, clinical_hint
    }


# ── POST /api/triage/next ─────────────────────────────────────────────────────

@router.post("/next")
async def triage_next(
    body: NextRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Step 2–N: Receive the current answer + full running history.
    - If history length >= MAX_QUESTIONS: trigger final assessment (same as /finish)
    - Otherwise: run emergency check on the latest answer, then ask next MCQ
    Returns: {question, options, clinical_hint, done: false}
    OR the full assessment document if done: true
    """
    uid = current_user["uid"]
    history_dicts = [t.model_dump() for t in body.history]

    # Re-run emergency check on latest answer text (patient may volunteer ESI-1 keywords
    # in any free-text field — the MCQ answer is a selected option so low risk, but
    # applying the check on the full symptom string is belt-and-suspenders safety)
    latest_answer = body.history[-1].answer if body.history else ""
    emergency = check_emergency(body.initial_symptom + " " + latest_answer)
    if emergency:
        return emergency

    # Fetch bmi_category once — used by both the next-question path and final assessment
    profile = _get_user_profile(uid)
    bmi_category = profile.get("bmi_category")

    # Budget exhausted → produce final assessment
    if len(body.history) >= MAX_QUESTIONS:
        return await _produce_final_assessment(
            uid=uid,
            initial_symptom=body.initial_symptom,
            history=history_dicts,
            candidate_diseases=body.candidate_diseases,
            conversation_id=body.conversation_id,
            language_pref=body.language_pref,
            bmi_category=bmi_category,
        )

    # Still within budget → next question
    next_q = generate_next_question(
        initial_symptom=body.initial_symptom,
        candidate_diseases=body.candidate_diseases,
        history=history_dicts,
        language_pref=body.language_pref,
        bmi_category=bmi_category,
    )

    return {
        "conversation_id": body.conversation_id,
        "candidate_diseases": body.candidate_diseases,
        "done": False,
        **next_q,
    }


# ── POST /api/triage/finish ───────────────────────────────────────────────────

@router.post("/finish")
async def triage_finish(
    body: FinishRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Explicit final assessment trigger (frontend calls this when it decides the
    conversation is complete, e.g. after TARGET_QUESTIONS answered).
    Returns the full assessment document and writes it to Firestore.
    """
    uid = current_user["uid"]
    history_dicts = [t.model_dump() for t in body.history]

    # Emergency check — scan initial_symptom + ALL history answers concatenated.
    # /finish bypasses the incremental /next checks, so this is the only place
    # to catch emergency keywords that appeared at any point in the conversation.
    # Uses the same check_emergency function and returns the same ESI-1 response
    # structure as /start and /next — no separate format.
    all_answers = " ".join(t.answer for t in body.history)
    emergency = check_emergency(body.initial_symptom + " " + all_answers)
    if emergency:
        return emergency

    profile = _get_user_profile(uid)
    bmi_category = profile.get("bmi_category")

    return await _produce_final_assessment(
        uid=uid,
        initial_symptom=body.initial_symptom,
        history=history_dicts,
        candidate_diseases=body.candidate_diseases,
        conversation_id=body.conversation_id,
        language_pref=body.language_pref,
        bmi_category=bmi_category,
    )


# ── Shared final-assessment logic ─────────────────────────────────────────────

async def _produce_final_assessment(
    *,
    uid: str,
    initial_symptom: str,
    history: list[dict[str, Any]],
    candidate_diseases: list[str],
    conversation_id: str,
    language_pref: str = "en",
    bmi_category: str | None = None,
) -> dict[str, Any]:
    """
    Builds the final assessment document, writes it to Firestore, returns it.
    """
    assessment_id = str(uuid.uuid4())

    # Fetch pincode / district from user's Firestore profile
    profile = _get_user_profile(uid)
    pincode = profile.get("pincode", "")
    district = profile.get("district", "")

    assessment = build_final_assessment(
        uid=uid,
        initial_symptom=initial_symptom,
        candidate_diseases=candidate_diseases,
        history=history,
        pincode=pincode,
        district=district,
        assessment_id=assessment_id,
        language_pref=language_pref,
        bmi_category=bmi_category,
    )

    # Write to Firestore — raise 500 if this fails (assessment must be persisted)
    try:
        _write_assessment(assessment_id, assessment)
    except Exception as exc:
        logger.error("Firestore write failed for assessment %s: %s", assessment_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to persist assessment. Please try again.",
        )

    return {"done": True, **assessment}
