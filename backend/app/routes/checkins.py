"""
checkins.py
FastAPI router for the Cure AI weekly check-in feature.

Endpoints:
  POST /api/checkins  — create a check-in, run red-flag check, generate AI response
  GET  /api/checkins  — list the current user's own check-ins (most recent 10)

Stage 3 AI flow (inside create_checkin):
  1. Write the check-in document to Firestore immediately so it persists
     even if the AI call fails.
  2. Red-flag check (BEFORE any LLM call):
       a. Reuse triage_engine.check_emergency() — the existing doctor-signed-off
          ESI-1 keyword list. Do NOT modify that list.
       b. Also check the CureAI-specific extended list below (suicidal ideation,
          poison ingestion, vague-but-severe language not covered by ESI keywords).
       If any red flag fires: set flagged_urgent=True, update the Firestore doc,
       and return without calling Gemini. The frontend surfaces the /triage flow.
  3. Fetch the user's own last 3–5 check-ins directly from Firestore
     (users/{uid}/checkins sub-collection — never via HTTP to self).
  4. Fetch a patient-safe community context:
       - Calls _fetch_docs / _aggregate from hotspots.py internally (Python import,
         NOT an HTTP call, NOT weakening the health_official authorization).
       - Uses the user's pincode from their Firestore profile — never client-supplied.
       - Strips ALL org-level, individual, and investigation data before injection.
       - Returns only aggregate category totals and a trend label for context.
       - Silently skips if no pincode or if the Firestore query fails.
  5. Build a system prompt + user prompt with memory and community context.
  6. Call Gemini (reusing _get_gemini_client / _call_gemini from triage_engine —
     no new Gemini initialisation, no new API key location).
  7. Update the Firestore doc with ai_response.
  8. Return the updated doc.

Security:
  - uid always from the verified Firebase token, never from the request body.
  - Community context uses the user's own stored pincode, not a client parameter.
  - The GEMINI_API_KEY stays in os.environ["GEMINI_API_KEY"] — untouched.
  - Community aggregation runs as an internal function call — the health_official-
    only /api/hotspots HTTP endpoint is NOT weakened or called.
"""

import logging
import os
import re
import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any

import firebase_admin.firestore
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.core.auth import get_current_user
# Reuse the existing Gemini singleton and call wrapper — no new initialisation
from app.core.triage_engine import (
    _call_gemini,
    _get_gemini_client,          # noqa: F401 — imported to ensure client is warm
    GEMINI_MODEL,
    GEMINI_TIMEOUT_SECONDS,
    check_emergency,             # existing doctor-signed-off ESI-1 keyword check
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/checkins", tags=["checkins"])

MAX_CHECKINS       = 10   # GET endpoint limit
MEMORY_CHECKINS    = 5    # how many prior check-ins to inject into the AI prompt
COMMUNITY_DAYS     = 7    # look-back window for community context
COMMUNITY_ESI      = 2    # ESI level used for community hotspot context
AI_TIMEOUT_SECONDS = 25   # slightly longer than triage to allow warmer response

# ── CureAI-specific red-flag extensions ──────────────────────────────────────
# Supplements (never replaces) triage_engine.EMERGENCY_KEYWORDS.
# Covers patterns relevant to a wellness check-in context that may not appear
# in the clinical triage keyword list.
CURE_AI_URGENT_PATTERNS: list[str] = [
    # Suicidal ideation / self-harm
    "want to die",
    "kill myself",
    "end my life",
    "don't want to live",
    "hurt myself",
    "self harm",
    "self-harm",
    # Poisoning / toxic ingestion
    "swallowed",
    "ingested poison",
    "ate something toxic",
    "took too many",
    "overdose",
    # Vague-but-severe language
    "can't move",
    "cannot move",
    "paralysed",
    "paralyzed",
    "collapsing",
    "passed out",
    "fainted",
    "seizure",
]

# ── System instruction — stable across all check-ins ─────────────────────────
_CURE_AI_SYSTEM_INSTRUCTION = (
    "You are Cure, a warm and caring health companion for Arogya360, a preventive "
    "healthcare app used in India. Your role is like a knowledgeable, protective "
    "parent — calm, reassuring, never alarmist, but honest when something deserves "
    "attention.\n\n"
    "Rules you must follow without exception:\n"
    "- Keep your reply to 2–4 sentences maximum. This is a quick check-in reply, "
    "not a consultation.\n"
    "- NEVER state a diagnosis with certainty. Use phrases like 'could be', 'worth "
    "keeping an eye on', 'consider seeing a doctor if'.\n"
    "- If referencing community health data, frame it as general local awareness "
    "(e.g. 'there has been a small uptick in stomach bugs reported nearby this "
    "week'), never as a claim about the user's specific condition.\n"
    "- Respond in a conversational, warm tone. No bullet points, no clinical "
    "language, no alarming language.\n"
    "- You are responding to a routine wellness check-in. Emergency cases have "
    "already been filtered out before reaching you — never add alarming emergency "
    "language or override the safety layer.\n"
    "- Never suggest the user ignore symptoms that worsen.\n"
    "- Do NOT mention medication names, dosages, or specific medical tests.\n"
    "- If the user's message is entirely positive or routine, respond warmly and "
    "encouragingly in 1–2 sentences.\n"
    "- Output ONLY valid JSON with this exact structure, no markdown, no prose:\n"
    '{"response": "<your 2-4 sentence reply>"}'
)


# ── Helpers ────────────────────────────────────────────────────────────────────

def _db() -> Any:
    return firebase_admin.firestore.client()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _ts(val: Any) -> str | None:
    if val is None:
        return None
    if isinstance(val, datetime):
        dt = val if val.tzinfo else val.replace(tzinfo=timezone.utc)
        return dt.isoformat()
    if hasattr(val, "ToDatetime"):
        return val.ToDatetime(tzinfo=timezone.utc).isoformat()
    if hasattr(val, "timestamp"):
        return datetime.fromtimestamp(val.timestamp(), tz=timezone.utc).isoformat()
    try:
        return datetime.fromisoformat(str(val)).isoformat()
    except (ValueError, TypeError):
        return str(val)


def _get_user_pincode(db: Any, uid: str) -> str | None:
    try:
        snap = db.collection("users").document(uid).get()
        if snap.exists:
            return snap.to_dict().get("pincode") or None
    except Exception as exc:
        logger.warning("Could not fetch pincode for uid=%s: %s", uid, exc)
    return None


def _doc_to_response(doc_id: str, data: dict[str, Any]) -> dict[str, Any]:
    return {
        "id":             doc_id,
        "text":           data.get("text", ""),
        "created_at":     _ts(data.get("created_at")),
        "ai_response":    data.get("ai_response"),
        "flagged_urgent": bool(data.get("flagged_urgent", False)),
        "pincode":        data.get("pincode"),
    }


# ── Red-flag check ────────────────────────────────────────────────────────────

def _is_urgent(text: str) -> bool:
    """
    Returns True if the text triggers either:
      a) the existing triage_engine.check_emergency() ESI-1 keyword list, or
      b) the CureAI-specific extended urgent patterns above.

    check_emergency() is the doctor-signed-off canonical list and is never
    modified here. The CureAI list is additive only.
    """
    # Primary check — reuse existing triage keyword engine
    if check_emergency(text) is not None:
        return True
    # Secondary check — CureAI-specific extensions
    lower = text.lower()
    for pattern in CURE_AI_URGENT_PATTERNS:
        if pattern in lower:
            logger.warning("CureAI urgent pattern matched: '%s'", pattern)
            return True
    return False


# ── Memory: fetch prior check-ins ────────────────────────────────────────────

def _get_recent_checkins(db: Any, uid: str, limit: int = MEMORY_CHECKINS) -> list[str]:
    """
    Fetches the user's own most-recent check-in texts directly from Firestore.
    Returns a list of plain text strings, newest-first.
    Never accepts a UID from the client — always uses the server-verified uid.
    Never calls the HTTP /api/checkins endpoint.
    """
    try:
        docs = (
            db.collection("users")
            .document(uid)
            .collection("checkins")
            .order_by("created_at", direction="DESCENDING")
            .limit(limit)
            .get()
        )
        return [d.to_dict().get("text", "") for d in docs if d.to_dict().get("text")]
    except Exception as exc:
        logger.warning("Could not fetch prior check-ins for uid=%s: %s", uid, exc)
        return []


# ── Community context: patient-safe aggregate ─────────────────────────────────

def _get_community_context(db: Any, pincode: str) -> str | None:
    """
    Produces a minimal, patient-safe community health summary string for
    injection into the AI prompt.

    Uses _fetch_docs and _aggregate from hotspots.py internally (Python import,
    never HTTP). The health_official /api/hotspots endpoint authorization is
    NOT weakened — this is a server-side function call, not a request.

    Strips ALL forbidden fields:
      organization_name, organization_type, uploader_uid, report_id,
      individual reports, organization_count, investigation data, flags,
      corrections, health-official-only information.

    Returns None if pincode is absent, query fails, or no data exists.
    Returns a plain-language string like:
      "Community health data nearby (last 7 days): respiratory: 12 cases, general: 5 cases."
    """
    try:
        from google.cloud.firestore_v1.base_query import FieldFilter

        now   = _now()
        since = now - timedelta(days=COMMUNITY_DAYS)
        until = now

        coll = db.collection("health_reports")
        q = (
            coll
            .where(filter=FieldFilter("pincode",    "==", pincode))
            .where(filter=FieldFilter("esi_level",  "==", COMMUNITY_ESI))
            .where(filter=FieldFilter("created_at", ">=", since))
            .where(filter=FieldFilter("created_at", "<",  until))
        )
        docs = q.get()

        # Aggregate by category in-memory — discard everything else
        category_totals: dict[str, int] = defaultdict(int)
        for d in docs:
            data = d.to_dict()
            if data.get("status") != "active":
                continue
            cat   = data.get("category", "general")
            count = int(data.get("case_count") or 0)
            category_totals[cat] += count

        if not category_totals:
            return None

        # Build a plain-language summary — no org names, no individual data
        parts = [f"{cat}: {n} cases" for cat, n in sorted(
            category_totals.items(), key=lambda x: -x[1]
        )]
        return f"Community health data nearby (last {COMMUNITY_DAYS} days): {', '.join(parts)}."

    except Exception as exc:
        logger.warning("Community context fetch failed for pincode=%s: %s", pincode, exc)
        return None


# ── AI response generation ────────────────────────────────────────────────────

def _generate_ai_response(
    current_text: str,
    prior_checkins: list[str],
    community_context: str | None,
) -> str | None:
    """
    Calls Gemini to produce a 2-4 sentence warm reply to the user's check-in.

    Returns the response string, or None if Gemini fails (caller leaves
    ai_response as None rather than crashing).

    Uses _call_gemini from triage_engine — same Gemini client, no duplication.
    """
    if os.environ.get("DEMO_MODE", "false").lower() == "true":
        logger.info("DEMO_MODE active — skipping Gemini for check-in")
        return "Thanks for checking in! Keep taking care of yourself this week."

    # Memory block — previous check-ins give Cure conversational continuity
    if prior_checkins:
        memory_lines = "\n".join(
            f"- {t}" for t in prior_checkins[:MEMORY_CHECKINS]
        )
        memory_block = f"Their recent check-ins for context (most recent first):\n{memory_lines}"
    else:
        memory_block = "Their recent check-ins for context:\n- [No previous check-ins]"

    # Community block — stripped of all sensitive data
    if community_context:
        community_block = f"Community health context (aggregate data, user's area):\n{community_context}"
    else:
        community_block = "Community health context:\n[No community data available for this area]"

    user_prompt = (
        f"The user's check-in today:\n\"{current_text}\"\n\n"
        f"{memory_block}\n\n"
        f"{community_block}\n\n"
        "Reply warmly in 2–4 sentences."
    )

    try:
        raw = _call_gemini(user_prompt, system_instruction=_CURE_AI_SYSTEM_INSTRUCTION)
        # Parse the JSON response
        raw = raw.strip()
        raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.IGNORECASE)
        raw = re.sub(r"\s*```$", "", raw)
        import json
        parsed = json.loads(raw)
        response = parsed.get("response", "").strip()
        if not response:
            raise ValueError("Empty response field in Gemini output")
        return response
    except Exception as exc:
        logger.error("Gemini check-in response failed: %s", exc)
        return None


# ── Request model ──────────────────────────────────────────────────────────────

class CreateCheckinRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=4000)


# ── POST /api/checkins ─────────────────────────────────────────────────────────

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_checkin(
    body: CreateCheckinRequest,
    current_user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """
    Create a new check-in, run the red-flag safety check, generate an AI response.

    Flow:
      1. Write the doc to Firestore immediately (persists even if AI fails).
      2. Red-flag check — if urgent: flag the doc, return without calling Gemini.
      3. Fetch memory (last 3-5 check-ins from Firestore directly).
      4. Fetch patient-safe community context (internal aggregation, not HTTP).
      5. Generate AI response via Gemini (reusing triage_engine client).
      6. Update the Firestore doc with ai_response (or leave null on AI failure).
      7. Return the final doc.

    uid always from the verified Firebase token, never from the request body.
    """
    uid = current_user["uid"]
    db  = _db()
    now = _now()

    pincode = _get_user_pincode(db, uid)

    # ── Step 1: Write the doc immediately ────────────────────────────────────
    doc_data: dict[str, Any] = {
        "text":           body.text,
        "created_at":     now,
        "ai_response":    None,
        "flagged_urgent": False,
        "pincode":        pincode,
    }
    ref = db.collection("users").document(uid).collection("checkins").document()
    ref.set(doc_data)
    logger.info("Check-in created uid=%s doc=%s", uid, ref.id)

    # ── Step 2: Red-flag safety check ────────────────────────────────────────
    # Run BEFORE any LLM call. If urgent, skip AI entirely.
    if _is_urgent(body.text):
        logger.warning("Urgent check-in flagged uid=%s doc=%s", uid, ref.id)
        ref.update({"flagged_urgent": True})
        doc_data["flagged_urgent"] = True
        # Return immediately — the frontend surfaces the /triage emergency flow
        return _doc_to_response(ref.id, doc_data)

    # ── Step 3: Memory — last N check-ins (direct Firestore, not HTTP) ───────
    # Skip the current doc (it's newest but has no useful history yet).
    prior_checkins = _get_recent_checkins(db, uid, limit=MEMORY_CHECKINS + 1)
    # Drop the first entry if it matches the text we just wrote
    if prior_checkins and prior_checkins[0] == body.text:
        prior_checkins = prior_checkins[1:]
    prior_checkins = prior_checkins[:MEMORY_CHECKINS]

    # ── Step 4: Patient-safe community context ────────────────────────────────
    community_context: str | None = None
    if pincode:
        community_context = _get_community_context(db, pincode)

    # ── Step 5: Generate AI response ─────────────────────────────────────────
    ai_response = _generate_ai_response(body.text, prior_checkins, community_context)

    # ── Step 6: Update Firestore doc ──────────────────────────────────────────
    if ai_response:
        ref.update({"ai_response": ai_response})
        doc_data["ai_response"] = ai_response

    # ── Step 7: Return ─────────────────────────────────────────────────────────
    return _doc_to_response(ref.id, doc_data)


# ── GET /api/checkins ──────────────────────────────────────────────────────────

@router.get("")
async def list_checkins(
    current_user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """
    Returns the current user's own check-ins, newest first, up to the last 10.
    Structurally scoped to users/{uid}/checkins — cannot return another user's data.
    """
    uid = current_user["uid"]
    db  = _db()

    try:
        docs = (
            db.collection("users")
            .document(uid)
            .collection("checkins")
            .order_by("created_at", direction="DESCENDING")
            .limit(MAX_CHECKINS)
            .get()
        )
    except Exception as exc:
        logger.error("list_checkins failed uid=%s: %s", uid, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve check-ins.",
        )

    return {
        "checkins": [_doc_to_response(d.id, d.to_dict()) for d in docs],
        "count":    len(docs),
    }
