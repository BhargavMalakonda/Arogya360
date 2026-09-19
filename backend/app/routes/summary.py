"""
summary.py
FastAPI router for the Doctor-Ready Secure Summary QR feature.

Endpoints:
  POST /api/summary/generate      — authenticated; generates/reuses a share token
  GET  /api/summary/{share_token} — unauthenticated; returns allow-listed summary

Security model:
  - The public endpoint is intentionally unauthenticated. Access is controlled
    exclusively by the unguessable share token (32 bytes / 256 bits of entropy)
    and a 72-hour expiry stored in Firestore.
  - The token is cryptographically random (secrets.token_urlsafe) and is never
    derived from assessment_id or uid.
  - The public response is constructed from an explicit allow-list of fields.
    The complete assessment document is NEVER serialised into the response.
  - PII fields (uid, pincode, district, email, name) are never returned by either
    endpoint.

Field names in this file were verified against real Firestore assessment documents
before implementation. Do NOT add fields without re-verifying them in Firestore.
"""

import logging
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

import firebase_admin.firestore
from fastapi import APIRouter, Depends, HTTPException, status
from google.cloud.firestore_v1.base_query import FieldFilter
from pydantic import BaseModel

from app.core.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/summary", tags=["summary"])

# ── Config ─────────────────────────────────────────────────────────────────────
# FRONTEND_BASE_URL is read from the environment (set in .env).
# Development default matches the Vite dev server port used by this project.
FRONTEND_BASE_URL: str = os.environ.get(
    "FRONTEND_BASE_URL", "http://localhost:5173"
).rstrip("/")

# Share link validity window
SHARE_TTL_HOURS: int = 72

# Token entropy: secrets.token_urlsafe(32) produces 43 URL-safe characters
# encoding 32 bytes (256 bits) of cryptographic randomness.
TOKEN_BYTES: int = 32


# ── Request model ──────────────────────────────────────────────────────────────

class GenerateRequest(BaseModel):
    assessment_id: str


# ── Helpers ────────────────────────────────────────────────────────────────────

def _get_db() -> Any:
    return firebase_admin.firestore.client()


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _new_expiry() -> datetime:
    return _now_utc() + timedelta(hours=SHARE_TTL_HOURS)


def _is_expired(expires_at: Any) -> bool:
    """
    Returns True when expires_at is missing, unparseable, or in the past.
    Handles both datetime objects and ISO-format strings — the Admin SDK may
    return either depending on how the field was originally written.
    """
    if expires_at is None:
        return True
    try:
        if isinstance(expires_at, datetime):
            exp = expires_at
        else:
            exp = datetime.fromisoformat(str(expires_at))
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        return _now_utc() >= exp
    except Exception:
        return True


def _build_public_summary(doc: dict[str, Any]) -> dict[str, Any]:
    """
    Constructs the doctor-facing summary from an EXPLICIT allow-list of fields.

    Every field name used here was confirmed present in real Firestore documents
    during the inspection phase. This function must never be modified to include:
      uid, pincode, district, assessment_id, share_token, share_expires_at,
      knowledge_base_version, follow_up_date, follow_up_completed, initial_symptom,
      prevention_tips, government_resources, or any auth/identity field.

    qa_history items are also allow-listed per the actual schema:
      {question, answer, clinical_hint} — exactly the keys present in production.
    Documents on assessment_version 3.0 may have no qa_history field; default to [].
    """
    raw_qa: list[dict[str, Any]] = doc.get("qa_history") or []
    qa_history: list[dict[str, str]] = [
        {
            "question":      str(item.get("question", "")),
            "answer":        str(item.get("answer", "")),
            "clinical_hint": str(item.get("clinical_hint", "")),
        }
        for item in raw_qa
        if isinstance(item, dict)
    ]

    return {
        "condition_pattern": doc.get("condition_pattern", ""),
        "risk_level":        doc.get("risk_level", ""),
        "matched_symptoms":  list(doc.get("matched_symptoms") or []),
        "symptom_category":  doc.get("symptom_category", ""),
        "qa_history":        qa_history,
        "recommendations":   list(doc.get("recommendations") or []),
        "created_at":        str(doc.get("created_at", "")),
    }


# ── POST /api/summary/generate ─────────────────────────────────────────────────

@router.post("/generate")
async def generate_share_link(
    body: GenerateRequest,
    current_user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """
    Authenticated endpoint. The requesting user must own the assessment.

    1. Read the assessment by assessment_id.
    2. Verify uid ownership — return 403 if mismatch.
    3. Reuse existing token if share_token exists and share_expires_at is in the
       future.
    4. Otherwise generate a new cryptographically random token (256 bits) and a
       new 72-hour expiry.
    5. Write ONLY share_token + share_expires_at to the document (additive update,
       never overwrites clinical or personal fields).
    6. Return {share_token, share_url, expires_at}.
    """
    uid = current_user["uid"]
    db  = _get_db()

    # 1. Read the assessment document by its ID
    ref  = db.collection("assessments").document(body.assessment_id)
    snap = ref.get()

    if not snap.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assessment not found.",
        )

    doc = snap.to_dict()

    # 2. Ownership check — must be the authenticated user's own assessment
    if doc.get("uid") != uid:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to share this assessment.",
        )

    # 3. Reuse existing token if still valid
    existing_token  = doc.get("share_token")
    existing_expiry = doc.get("share_expires_at")

    if existing_token and not _is_expired(existing_expiry):
        token      = existing_token
        expires_at = existing_expiry
        logger.info(
            "Reusing existing share token for assessment %s", body.assessment_id
        )
    else:
        # 4. Generate a new cryptographically random, URL-safe token.
        #    secrets.token_urlsafe(32) uses os.urandom internally — never derived
        #    from assessment_id, uid, or any deterministic input.
        token      = secrets.token_urlsafe(TOKEN_BYTES)
        expires_at = _new_expiry()

        # 5. Update only the two token fields — all other document fields unchanged.
        #    Pass expires_at as a native datetime so the Admin SDK stores it as a
        #    Firestore Timestamp, not an ISO string.
        ref.update({
            "share_token":      token,
            "share_expires_at": expires_at,   # datetime → Firestore Timestamp
        })
        logger.info(
            "New share token generated for assessment %s", body.assessment_id
        )

    # 6. Return share info — never return uid, assessment contents, or PII
    return {
        "share_token": token,
        "share_url":   f"{FRONTEND_BASE_URL}/summary/{token}",
        "expires_at":  str(expires_at),
    }


# ── GET /api/summary/{share_token} ────────────────────────────────────────────

@router.get("/{share_token}")
async def get_public_summary(share_token: str) -> dict[str, Any]:
    """
    Unauthenticated public endpoint. MUST NOT use get_current_user.

    This endpoint has NO Firebase Auth dependency by design — the doctor does not
    need an Arogya360 account. Access control is provided entirely by:
      - the unguessable share token (256 bits of cryptographic entropy)
      - a 72-hour expiry stored server-side in Firestore

    Returns an allow-listed summary. The full assessment document is never
    serialised. Fields excluded from the response:
      uid, pincode, district, assessment_id, share_token, share_expires_at,
      knowledge_base_version, follow_up_date, follow_up_completed,
      initial_symptom, prevention_tips, government_resources.

    HTTP 404 — token not found in any assessment document
    HTTP 410 — token found but expired (or expiry field missing/invalid)
    HTTP 200 — valid token, returns allow-listed summary
    """
    db = _get_db()

    # Query assessments by share_token.
    # NOTE: This requires a single-field Firestore index on
    # assessments.share_token (ASCENDING). See index requirement in task report.
    results = (
        db.collection("assessments")
        .where(filter=FieldFilter("share_token", "==", share_token))
        .limit(1)
        .get()
    )

    if not results:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Summary not found.",
        )

    doc = results[0].to_dict()

    # Expiry check — HTTP 410 Gone is the correct status for an expired resource
    if _is_expired(doc.get("share_expires_at")):
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="This summary link has expired.",
        )

    # Return ONLY the allow-listed fields — never the raw document
    return _build_public_summary(doc)
