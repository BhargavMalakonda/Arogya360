"""
reports.py
FastAPI router for contributor health-report submissions.

Endpoints:
  POST /api/reports   — create a submission (idempotent via client_report_id)
  GET  /api/reports   — list the calling contributor's own submissions

Security model:
  - Both endpoints require role="contributor" (via require_role).
  - uploader_uid, uploader_name, organization_name, organization_type are ALL
    derived server-side from the authenticated token + Firestore user profile.
    Any values the client might send for these fields are silently ignored.
  - The idempotency check is scoped to (client_report_id, uploader_uid) so
    one contributor cannot collide with another's client_report_id.

Idempotency:
  - Client generates a UUID (client_report_id) before sending.
  - On POST, the backend queries health_reports for an existing document with
    the same (client_report_id, uploader_uid).
  - If found: return the existing document (HTTP 200) — no duplicate insert.
  - If not found: create and return the new document (HTTP 201).
  - Stage 3 offline sync retries depend on this contract — do not change the
    idempotency logic without updating the sync layer.

Firestore index requirements (declared in firestore.indexes.json):
  health_reports: [uploader_uid ASC, client_report_id ASC]   — idempotency check
  health_reports: [uploader_uid ASC, created_at DESC]         — list endpoint
"""

import logging
import re
from datetime import datetime, timezone
from typing import Any, Literal

import firebase_admin.firestore
from fastapi import APIRouter, Depends, HTTPException, status
from google.cloud.firestore_v1.base_query import FieldFilter
from pydantic import BaseModel, Field, field_validator

from app.core.auth import require_role

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/reports", tags=["reports"])

# ── Constants ──────────────────────────────────────────────────────────────────
VALID_CATEGORIES = {"respiratory", "cardiovascular", "metabolic", "general"}
PINCODE_RE = re.compile(r"^\d{6}$")


# ── Request model ──────────────────────────────────────────────────────────────

class CreateReportRequest(BaseModel):
    """
    Fields accepted from the client.

    uploader_uid / uploader_name / organization_name / organization_type are
    intentionally absent — they are always derived server-side.
    """
    client_report_id: str = Field(
        ...,
        min_length=1,
        max_length=128,
        description="Client-generated UUID; used for idempotency.",
    )
    pincode: str = Field(..., description="6-digit Indian pincode.")
    category: str = Field(..., description="respiratory|cardiovascular|metabolic|general")
    esi_level: int = Field(..., ge=1, le=5, description="ESI level 1–5 (contributor-selected).")
    reported_date: str = Field(
        ...,
        description="ISO-8601 date string, e.g. '2026-09-17'.",
    )
    mode: Literal["individual", "bulk"] = Field(
        ...,
        description="UI mode — both normalise into case_count.",
    )
    case_count: int = Field(..., ge=1, description="Must be >= 1.")

    @field_validator("pincode")
    @classmethod
    def validate_pincode(cls, v: str) -> str:
        if not PINCODE_RE.match(v):
            raise ValueError("pincode must be exactly 6 digits.")
        return v

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        if v not in VALID_CATEGORIES:
            raise ValueError(
                f"category must be one of: {', '.join(sorted(VALID_CATEGORIES))}."
            )
        return v

    @field_validator("reported_date")
    @classmethod
    def validate_reported_date(cls, v: str) -> str:
        try:
            datetime.fromisoformat(v)
        except ValueError:
            raise ValueError("reported_date must be a valid ISO-8601 date string.")
        return v


# ── Helpers ────────────────────────────────────────────────────────────────────

def _db() -> Any:
    return firebase_admin.firestore.client()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _get_user_profile(uid: str) -> dict[str, str]:
    """
    Fetches name, organization_name, organization_type from users/{uid}.
    These fields were written by the demo-account setup script and must
    never be sourced from client-supplied request data.
    Returns safe fallbacks if the profile is absent (should not happen in
    production after onboarding, but guards against partial setup).
    """
    try:
        doc = _db().collection("users").document(uid).get()
        if doc.exists:
            data = doc.to_dict()
            return {
                "name":              data.get("name", ""),
                "organization_name": data.get("organization_name", ""),
                "organization_type": data.get("organization_type", ""),
            }
    except Exception as exc:
        logger.error("Failed to fetch user profile for uid=%s: %s", uid, exc)
    return {"name": "", "organization_name": "", "organization_type": ""}


def _doc_to_response(doc_id: str, data: dict[str, Any]) -> dict[str, Any]:
    """
    Serialises a health_reports Firestore document to a JSON-safe dict.
    Only the allowed response fields are included — internal fields like
    uploader_uid are present (the contributor is the owner and may need
    them for future sync) but raw Firestore Timestamp objects are converted.
    """
    def _ts(val: Any) -> str | None:
        if val is None:
            return None
        if hasattr(val, "isoformat"):
            return val.isoformat()
        if hasattr(val, "ToDatetime"):          # Firestore Timestamp
            return val.ToDatetime(tzinfo=timezone.utc).isoformat()
        return str(val)

    return {
        "id":                doc_id,
        "client_report_id":  data.get("client_report_id", ""),
        "pincode":           data.get("pincode", ""),
        "category":          data.get("category", ""),
        "esi_level":         data.get("esi_level"),
        "case_count":        data.get("case_count"),
        "reported_date":     data.get("reported_date", ""),
        "mode":              data.get("mode", ""),
        "uploader_uid":      data.get("uploader_uid", ""),
        "uploader_name":     data.get("uploader_name", ""),
        "organization_name": data.get("organization_name", ""),
        "organization_type": data.get("organization_type", ""),
        "status":            data.get("status", "active"),
        "created_at":        _ts(data.get("created_at")),
        "updated_at":        _ts(data.get("updated_at")),
    }


# ── POST /api/reports ──────────────────────────────────────────────────────────

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_report(
    body: CreateReportRequest,
    current_user: dict = Depends(require_role("contributor")),
) -> dict[str, Any]:
    """
    Create a health-report submission.

    Idempotent: if a document with the same (client_report_id, uploader_uid)
    already exists, it is returned as-is (HTTP 200) without a duplicate insert.

    Security:
      uploader_uid         — always taken from the authenticated token.
      uploader_name        — always fetched from Firestore users/{uid}.
      organization_name    — always fetched from Firestore users/{uid}.
      organization_type    — always fetched from Firestore users/{uid}.
      Any of these fields in the request body are silently ignored.
    """
    uid = current_user["uid"]
    db  = _db()

    # ── Idempotency check ─────────────────────────────────────────────────────
    # Scoped to (client_report_id, uploader_uid) — prevents cross-user collisions.
    # Requires composite index: health_reports [uploader_uid ASC, client_report_id ASC]
    existing = (
        db.collection("health_reports")
        .where(filter=FieldFilter("uploader_uid", "==", uid))
        .where(filter=FieldFilter("client_report_id", "==", body.client_report_id))
        .limit(1)
        .get()
    )
    if existing:
        doc = existing[0]
        logger.info(
            "Idempotent return for client_report_id=%s uid=%s",
            body.client_report_id, uid,
        )
        # Return 200 (not 201) for an already-existing document.
        # FastAPI doesn't support per-return status overrides cleanly with dict
        # returns, so we use a JSONResponse here.
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content=_doc_to_response(doc.id, doc.to_dict()),
        )

    # ── Server-side fields — never from client input ──────────────────────────
    profile = _get_user_profile(uid)
    now     = _now()

    doc_data: dict[str, Any] = {
        "client_report_id":  body.client_report_id,
        "pincode":           body.pincode,
        "category":          body.category,
        "esi_level":         body.esi_level,
        "case_count":        body.case_count,
        "reported_date":     body.reported_date,
        "mode":              body.mode,
        # ── Server-enforced fields ──────────────────────────────────────────
        "uploader_uid":      uid,
        "uploader_name":     profile["name"],
        "organization_name": profile["organization_name"],
        "organization_type": profile["organization_type"],
        "status":            "active",
        "created_at":        now,
        "updated_at":        now,
    }

    # Firestore auto-generates the document ID.
    ref = db.collection("health_reports").document()
    ref.set(doc_data)

    logger.info(
        "health_reports/%s created by uid=%s client_report_id=%s",
        ref.id, uid, body.client_report_id,
    )
    return _doc_to_response(ref.id, doc_data)


# ── GET /api/reports ───────────────────────────────────────────────────────────

@router.get("")
async def list_reports(
    current_user: dict = Depends(require_role("contributor")),
) -> dict[str, Any]:
    """
    Returns the calling contributor's own submissions, newest first.

    The query is scoped to uploader_uid == current user's uid at the Firestore
    query level — not filtered after the fact — so it is compatible with the
    Firestore security rules which enforce the same ownership constraint.

    Requires composite index: health_reports [uploader_uid ASC, created_at DESC]
    """
    uid = current_user["uid"]
    db  = _db()

    try:
        docs = (
            db.collection("health_reports")
            .where(filter=FieldFilter("uploader_uid", "==", uid))
            .order_by("created_at", direction="DESCENDING")
            .get()
        )
    except Exception as exc:
        logger.error("list_reports query failed for uid=%s: %s", uid, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve submissions.",
        )

    return {
        "reports": [_doc_to_response(d.id, d.to_dict()) for d in docs],
        "count":   len(docs),
    }
