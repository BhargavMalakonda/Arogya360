"""
community.py
FastAPI router for community aggregate insights.

Design notes:
  - Protected by get_current_user (Firebase ID token required — not open to anonymous)
  - Pincode is read from the authenticated user's own Firestore profile via the Admin
    SDK, NOT from a query parameter. This prevents any signed-in user from probing
    community data for pincodes they don't live in (low individual sensitivity, but
    combining counts across all Indian pincodes could expose disease prevalence maps).
  - Uses firebase_admin.firestore directly (Admin SDK bypasses client security rules),
    so firestore.rules does NOT need to be weakened to allow cross-user list queries.
  - Returns only integer counts — never document field values or individual UIDs.
  - Applies Module 2 §3 privacy suppression: categories with count < 3 are omitted
    entirely from the response (frontend shows fallback string).
  - Does NOT compute or return trend data — Module 2 v1 explicitly forbids this.

Endpoint:
  GET /api/community/insights
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
import firebase_admin.firestore

from app.core.auth import get_current_user
from app.core.prevention import get_prevention_kb

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/community", tags=["community"])

# ── Module 2 §3 constants ─────────────────────────────────────────────────────
SYMPTOM_CATEGORIES = ["respiratory", "metabolic", "cardiovascular", "general"]
CATEGORY_LABELS = {
    "respiratory":    "Respiratory Symptoms",
    "metabolic":      "Metabolic Symptoms",
    "cardiovascular": "Cardiovascular Symptoms",
    "general":        "General / Viral Symptoms",
}
PRIVACY_THRESHOLD = 3   # counts below this are suppressed
LOOKBACK_DAYS = 7


def _get_user_pincode(uid: str) -> str | None:
    """
    Fetches the authenticated user's pincode from users/{uid} via Admin SDK.
    Returns None if the profile doesn't exist or has no pincode.
    """
    try:
        db = firebase_admin.firestore.client()
        doc = db.collection("users").document(uid).get()
        if doc.exists:
            return doc.to_dict().get("pincode") or None
    except Exception as exc:
        logger.error("Failed to fetch profile for uid %s: %s", uid, exc)
    return None


def _count_assessments(
    db: Any,
    pincode: str,
    category: str,
    since: datetime,
) -> int:
    """
    Returns the count of assessments matching pincode + symptom_category + created_at >= since.
    Uses the Admin SDK aggregation query (COUNT).
    Composite index required: assessments (pincode ASC, symptom_category ASC, created_at DESC).
    """
    from google.cloud.firestore_v1.field_path import FieldPath  # noqa: F401
    from google.cloud.firestore_v1.base_query import FieldFilter

    coll = db.collection("assessments")
    q = (
        coll
        .where(filter=FieldFilter("pincode", "==", pincode))
        .where(filter=FieldFilter("symptom_category", "==", category))
        .where(filter=FieldFilter("created_at", ">=", since))
    )
    agg = q.count()
    result = agg.get()
    # result is QueryResultsList[List[AggregationResult]]
    # result[0] is the first (and only) row; result[0][0] is the count AggregationResult
    if result and result[0]:
        return int(result[0][0].value)
    return 0


@router.get("/insights")
async def get_community_insights(
    current_user: dict = Depends(get_current_user),
):
    """
    Returns aggregated symptom-category counts for the authenticated user's pincode.

    Pincode is read from the user's own profile — NOT from a query parameter — to
    prevent probing of other pincodes. Module 2 privacy suppression is applied:
    categories with fewer than 3 assessments in the last 7 days are omitted.

    Returns:
      {
        "pincode": "500001",
        "insights": [
          {"symptom_category": "respiratory", "count_last_7_days": 8,
           "display_label": "Respiratory Symptoms"},
          ...
        ]
      }
    """
    uid = current_user["uid"]

    # ── Read pincode from authenticated user's own profile ────────────────────
    pincode = _get_user_pincode(uid)
    if not pincode:
        # User hasn't completed onboarding — return empty insights, not an error
        return {"pincode": None, "insights": []}

    # ── Run count queries for all categories in parallel (synchronous Admin SDK) ─
    since = datetime.now(timezone.utc) - timedelta(days=LOOKBACK_DAYS)
    db = firebase_admin.firestore.client()

    insights: list[dict[str, Any]] = []
    for category in SYMPTOM_CATEGORIES:
        try:
            count = _count_assessments(db, pincode, category, since)
        except Exception as exc:
            logger.error(
                "Count query failed for pincode=%s category=%s: %s",
                pincode, category, exc,
            )
            # One failed category shouldn't kill the whole response — skip it
            continue

        # Module 2 §3 privacy suppression: omit categories with count < PRIVACY_THRESHOLD
        if count < PRIVACY_THRESHOLD:
            continue

        display_label = CATEGORY_LABELS[category]

        # ── Prevention tips — reuse shared KB loader (same cache as triage_engine) ──
        # Mirror the exact fallback pattern from triage_engine.build_final_assessment:
        #   prevention_kb.get(symptom_category, prevention_kb.get("general", []))
        # Slice to first 3 tips per the community endpoint contract.
        prevention_kb = get_prevention_kb()
        tips: list[str] = prevention_kb.get(category, prevention_kb.get("general", []))

        # Framing: uses display_label already present on the row.
        # Wording deliberately avoids "cure", "prevent infection", "guaranteed",
        # "eliminate your risk", or any claim of prophylaxis.
        framing = (
            f"{display_label} are trending in your area this week. "
            f"These general steps can help support your wellbeing."
        )

        insights.append({
            "symptom_category": category,
            "count_last_7_days": count,
            "display_label": display_label,
            "prevention_tips": tips[:3],
            "prevention_framing": framing,
        })

    return {"pincode": pincode, "insights": insights}
