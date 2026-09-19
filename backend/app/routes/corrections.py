"""
corrections.py
FastAPI router for the flag → correction workflow.

Endpoints:
  POST /api/corrections/flag     — health_official only; flags a report
  POST /api/corrections/respond  — contributor only;   responds to a flag

Status transition map:
  active   → flagged   (health official calls /flag)
  flagged  → corrected (contributor calls /respond with response="corrected")
  flagged  → confirmed (contributor calls /respond with response="confirmed")

Other transitions are rejected:
  - Cannot flag a report that is not "active"
  - Cannot respond to a report that is not "flagged"
  - Contributor cannot respond to a report they do not own (uploader_uid check)
  - Health official cannot modify case_count directly — flagging is a request only

Security:
  - /flag   requires role="health_official"
  - /respond requires role="contributor"
  - /respond enforces uploader_uid == current_user["uid"] at the document level
  - These checks are independent of (and in addition to) Firestore security rules,
    because the Admin SDK bypasses client-side rules

New Firestore collections:
  health_report_flags/{flagId}:
    report_id, flagged_by_uid, reason, message, created_at

  health_report_corrections/{correctionId}:
    report_id, flag_id, contributor_response, corrected_case_count, responded_at,
    uploader_uid  (stored for Firestore rule ownership checks)

No Firestore indexes are required for these endpoints:
  - /flag looks up a single document by ID (no composite query)
  - /respond looks up a single document by ID (no composite query)
"""

import logging
from datetime import datetime, timezone
from typing import Any, Literal

import firebase_admin.firestore
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator

from app.core.auth import require_role

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/corrections", tags=["corrections"])


# ── Helpers ────────────────────────────────────────────────────────────────────

def _db() -> Any:
    return firebase_admin.firestore.client()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _get_report(db: Any, report_id: str) -> tuple[Any, dict[str, Any]]:
    """
    Fetch a health_reports document by ID.
    Raises HTTP 404 if not found.
    Returns (doc_ref, doc_dict).
    """
    ref  = db.collection("health_reports").document(report_id)
    snap = ref.get()
    if not snap.exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found.",
        )
    return ref, snap.to_dict()


# ── Request models ─────────────────────────────────────────────────────────────

class FlagRequest(BaseModel):
    report_id: str = Field(..., min_length=1, max_length=128)
    reason:    str = Field(..., min_length=1, max_length=200,
                           description="Short reason code / label.")
    message:   str = Field(..., min_length=1, max_length=1000,
                           description="Human-readable message for the contributor.")


class RespondRequest(BaseModel):
    report_id:        str = Field(..., min_length=1, max_length=128)
    response:         Literal["corrected", "confirmed"]
    new_case_count:   int | None = Field(
        default=None,
        ge=1,
        description="Required when response='corrected'. Must be >= 1.",
    )

    @field_validator("new_case_count", mode="after")
    @classmethod
    def validate_count_for_corrected(cls, v, info):
        if info.data.get("response") == "corrected" and v is None:
            raise ValueError(
                "new_case_count is required when response is 'corrected'."
            )
        if info.data.get("response") == "confirmed" and v is not None:
            raise ValueError(
                "new_case_count must not be provided when response is 'confirmed'."
            )
        return v


# ── POST /api/corrections/flag ─────────────────────────────────────────────────

@router.post("/flag", status_code=status.HTTP_201_CREATED)
async def flag_report(
    body: FlagRequest,
    current_user: dict = Depends(require_role("health_official")),
) -> dict[str, Any]:
    """
    Health official flags a health_report for contributor review.

    - Only reports with status="active" can be flagged.
    - Does NOT modify case_count or any other report data field.
    - Creates a health_report_flags document.
    - Updates health_reports.status to "flagged".
    - Returns the flag document id.

    Status transition: active → flagged
    """
    db  = _db()
    uid = current_user["uid"]

    ref, doc = _get_report(db, body.report_id)

    current_status = doc.get("status", "")
    if current_status != "active":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Only active reports can be flagged. "
                f"This report has status '{current_status}'."
            ),
        )

    now = _now()

    # Create health_report_flags document
    flag_ref = db.collection("health_report_flags").document()
    flag_ref.set({
        "report_id":      body.report_id,
        "flagged_by_uid": uid,
        "reason":         body.reason,
        "message":        body.message,
        "created_at":     now,
    })

    # Update health_reports.status only — do NOT touch case_count or other fields
    ref.update({
        "status":     "flagged",
        "updated_at": now,
    })

    logger.info(
        "Report %s flagged by health_official uid=%s  flag_id=%s",
        body.report_id, uid, flag_ref.id,
    )

    return {
        "flag_id":   flag_ref.id,
        "report_id": body.report_id,
        "status":    "flagged",
    }


# ── POST /api/corrections/respond ─────────────────────────────────────────────

@router.post("/respond", status_code=status.HTTP_200_OK)
async def respond_to_flag(
    body: RespondRequest,
    current_user: dict = Depends(require_role("contributor")),
) -> dict[str, Any]:
    """
    Contributor responds to a flag on one of their own reports.

    Ownership check:
      - report.uploader_uid MUST equal the calling user's uid.
      - A contributor cannot respond to a flag on someone else's report.

    Status check:
      - report.status MUST be "flagged".
      - Cannot respond to an active, corrected, or confirmed report.

    response="corrected":
      - new_case_count is required
      - Updates health_reports.case_count to the new value
      - Sets health_reports.status = "corrected"
      - Creates health_report_corrections document

    response="confirmed":
      - new_case_count must NOT be supplied
      - Leaves health_reports.case_count unchanged
      - Sets health_reports.status = "confirmed"
      - Creates health_report_corrections document

    Status transitions:
      flagged → corrected  (response="corrected")
      flagged → confirmed  (response="confirmed")
    """
    db  = _db()
    uid = current_user["uid"]

    ref, doc = _get_report(db, body.report_id)

    # ── Ownership check ───────────────────────────────────────────────────────
    if doc.get("uploader_uid") != uid:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only respond to flags on your own reports.",
        )

    # ── Status check ──────────────────────────────────────────────────────────
    current_status = doc.get("status", "")
    if current_status != "flagged":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Only flagged reports can receive a correction response. "
                f"This report has status '{current_status}'."
            ),
        )

    now = _now()

    # ── Find the active flag document for this report ─────────────────────────
    # A report may have only one active flag (once it's been flagged it's no
    # longer "active", so it can't be flagged again). We look for the most
    # recent flag to associate with this correction.
    from google.cloud.firestore_v1.base_query import FieldFilter
    flag_docs = (
        db.collection("health_report_flags")
        .where(filter=FieldFilter("report_id", "==", body.report_id))
        .order_by("created_at", direction="DESCENDING")
        .limit(1)
        .get()
    )
    flag_id = flag_docs[0].id if flag_docs else None

    # ── Build correction document ─────────────────────────────────────────────
    correction_data: dict[str, Any] = {
        "report_id":             body.report_id,
        "flag_id":               flag_id,
        "contributor_response":  body.response,
        "corrected_case_count":  body.new_case_count,  # None when "confirmed"
        "uploader_uid":          uid,                  # for Firestore rule checks
        "responded_at":          now,
    }
    correction_ref = db.collection("health_report_corrections").document()
    correction_ref.set(correction_data)

    # ── Update health_reports ─────────────────────────────────────────────────
    update_fields: dict[str, Any] = {
        "status":     body.response,   # "corrected" or "confirmed"
        "updated_at": now,
    }
    if body.response == "corrected":
        update_fields["case_count"] = body.new_case_count

    ref.update(update_fields)

    logger.info(
        "Report %s responded to by contributor uid=%s  response=%s  correction_id=%s",
        body.report_id, uid, body.response, correction_ref.id,
    )

    return {
        "correction_id": correction_ref.id,
        "report_id":     body.report_id,
        "response":      body.response,
        "status":        body.response,
        "case_count":    body.new_case_count if body.response == "corrected"
                         else doc.get("case_count"),
    }
