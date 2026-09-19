"""
investigate.py
FastAPI router for health-official investigation endpoints.

Endpoints:
  GET /api/hotspots/{pincode}/investigate  — org-level breakdown for a pincode
  GET /api/hotspots/{pincode}/reports      — individual reports for one org

Both endpoints are health_official only (require_role).
GET /api/hotspots remains the lightweight pincode-level aggregate; these
endpoints are intentionally separate because organization-level data is
more sensitive than aggregate pincode counts.

Security:
  - require_role("health_official") enforced on every handler.
  - uploader_uid is used internally for queries but is NEVER returned to
    the frontend. Only organization_name, organization_type, and report
    content fields (reported_date, category, case_count, status) are returned.
  - No patient PII is present in health_reports; nothing is added here.

Firestore indexes required (declared in firestore.indexes.json):
  health_reports: [pincode ASC, created_at ASC]
  health_reports: [pincode ASC, category ASC, created_at ASC]
  health_reports: [pincode ASC, organization_name ASC, created_at ASC]
  health_reports: [pincode ASC, organization_name ASC, category ASC, created_at ASC]

Deploy with: firebase deploy --only firestore:indexes

Aggregation strategy:
  Same in-memory approach as hotspots.py — one Firestore query, aggregate
  in Python. Acceptable at MVP scale; see hotspots.py scaling note.
"""

import logging
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any

import firebase_admin.firestore
from fastapi import APIRouter, Depends, HTTPException, Query, status
from google.cloud.firestore_v1.base_query import FieldFilter

from app.core.auth import require_role

logger = logging.getLogger(__name__)

# Router shares the /api/hotspots prefix so URLs are
# /api/hotspots/{pincode}/investigate and /api/hotspots/{pincode}/reports
router = APIRouter(prefix="/api/hotspots", tags=["investigate"])

VALID_PERIODS    = {"7d": 7, "14d": 14, "30d": 30}
VALID_CATEGORIES = {"all", "respiratory", "cardiovascular", "metabolic", "general"}
ALL_CATEGORIES   = ["respiratory", "cardiovascular", "metabolic", "general"]


# ── Helpers ────────────────────────────────────────────────────────────────────

def _db() -> Any:
    return firebase_admin.firestore.client()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _ts(val: Any) -> str | None:
    """Convert Firestore Timestamp / datetime / ISO-string to an ISO string."""
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


def _validate_period_category(period: str, category: str) -> tuple[int, str]:
    """Raise 422 if period or category is invalid; return (days, category)."""
    if period not in VALID_PERIODS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"period must be one of: {', '.join(sorted(VALID_PERIODS))}.",
        )
    if category not in VALID_CATEGORIES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"category must be one of: {', '.join(sorted(VALID_CATEGORIES))}.",
        )
    return VALID_PERIODS[period], category


def _fetch_pincode_docs(
    db: Any,
    pincode: str,
    category: str,
    since: datetime,
    until: datetime,
    organization_name: str | None = None,
) -> list[dict[str, Any]]:
    """
    Fetch health_reports for a pincode within [since, until).
    Optionally filters by category and/or organization_name.

    All report statuses are returned (active, flagged, corrected, confirmed)
    so health officials can see the full picture, including flagged reports
    awaiting contributor response.  hotspots.py keeps its own active-only
    filter for the aggregate count — that is intentionally separate.

    Each returned dict includes an "_id" key set to the Firestore document ID
    so callers can reference the document for flag/correction operations.

    Index used:
      category == "all"  → [pincode ASC, created_at ASC]
      category != "all"  → [pincode ASC, category ASC, created_at ASC]
      with org filter    → [pincode ASC, organization_name ASC, created_at ASC]
                           [pincode ASC, organization_name ASC, category ASC, created_at ASC]
    """
    coll = db.collection("health_reports")

    if organization_name:
        q = (
            coll
            .where(filter=FieldFilter("pincode",           "==", pincode))
            .where(filter=FieldFilter("organization_name", "==", organization_name))
            .where(filter=FieldFilter("created_at",        ">=", since))
            .where(filter=FieldFilter("created_at",        "<",  until))
        )
        if category != "all":
            q = q.where(filter=FieldFilter("category", "==", category))
    else:
        q = (
            coll
            .where(filter=FieldFilter("pincode",    "==", pincode))
            .where(filter=FieldFilter("created_at", ">=", since))
            .where(filter=FieldFilter("created_at", "<",  until))
        )
        if category != "all":
            q = q.where(filter=FieldFilter("category", "==", category))

    try:
        docs = q.get()
    except Exception as exc:
        logger.error(
            "investigate query failed pincode=%s category=%s org=%s: %s",
            pincode, category, organization_name, exc,
        )
        return []

    result = []
    for d in docs:
        row = d.to_dict()
        row["_id"] = d.id   # Firestore document ID — used by flag/correction UI
        result.append(row)
    return result


# ── GET /api/hotspots/{pincode}/investigate ────────────────────────────────────

@router.get("/{pincode}/investigate")
async def investigate_pincode(
    pincode:  str,
    period:   str = Query(default="7d",  description="7d | 14d | 30d"),
    category: str = Query(default="all", description="all | respiratory | cardiovascular | metabolic | general"),
    current_user: dict = Depends(require_role("health_official")),
) -> dict[str, Any]:
    """
    Returns the organization-level breakdown for a specific pincode.

    This is intentionally separate from GET /api/hotspots (pincode-level
    aggregate) because organization identity is more sensitive than aggregate
    counts.  Health officials only.

    uploader_uid is used for Firestore queries but is NOT returned.
    No patient PII is present in health_reports or returned here.

    Response:
    {
      "pincode": "603203",
      "period":  "7d",
      "category": "all",
      "organizations": [
        {
          "organization_name": "Red Cross NGO",
          "organization_type": "ngo",
          "case_count": 12,
          "report_count": 2,
          "categories": {
            "respiratory": 8,
            "cardiovascular": 0,
            "metabolic": 0,
            "general": 4
          }
        }
      ]
    }
    """
    days, category = _validate_period_category(period, category)
    now   = _now()
    since = now - timedelta(days=days)
    until = now

    docs = _fetch_pincode_docs(_db(), pincode, category, since, until)

    if not docs:
        return {
            "pincode":       pincode,
            "period":        period,
            "category":      category,
            "organizations": [],
        }

    # Aggregate by organization
    # org_name → { "org_type": str, "case_count": int, "report_count": int,
    #               "categories": {cat: int} }
    agg: dict[str, dict[str, Any]] = {}

    for doc in docs:
        org_name = doc.get("organization_name", "")
        org_type = doc.get("organization_type", "")
        cat      = doc.get("category", "general")
        count    = int(doc.get("case_count") or 0)

        if org_name not in agg:
            agg[org_name] = {
                "organization_type": org_type,
                "case_count":        0,
                "report_count":      0,
                "categories":        defaultdict(int),
            }

        agg[org_name]["case_count"]  += count
        agg[org_name]["report_count"] += 1
        agg[org_name]["categories"][cat] += count

    # Build response — sorted by case_count descending
    organizations = sorted(
        [
            {
                "organization_name": name,
                "organization_type": data["organization_type"],
                "case_count":        data["case_count"],
                "report_count":      data["report_count"],
                "categories": {
                    cat: int(data["categories"].get(cat, 0))
                    for cat in ALL_CATEGORIES
                },
            }
            for name, data in agg.items()
        ],
        key=lambda x: x["case_count"],
        reverse=True,
    )

    return {
        "pincode":       pincode,
        "period":        period,
        "category":      category,
        "organizations": organizations,
    }


# ── GET /api/hotspots/{pincode}/reports ───────────────────────────────────────

@router.get("/{pincode}/reports")
async def get_org_reports(
    pincode:           str,
    organization_name: str  = Query(...,       description="Organization name to fetch reports for."),
    period:            str  = Query("7d",      description="7d | 14d | 30d"),
    category:          str  = Query("all",     description="all | respiratory | cardiovascular | metabolic | general"),
    current_user: dict = Depends(require_role("health_official")),
) -> dict[str, Any]:
    """
    Returns individual health_reports documents submitted by a specific
    organization for a given pincode.  Health officials only.

    Filtering is done server-side — the browser never receives all
    health_reports documents to filter client-side.

    Fields returned per report:
      reported_date, category, case_count, status, created_at
    Fields intentionally NOT returned:
      uploader_uid, uploader_name, client_report_id, mode

    Response:
    {
      "pincode":           "603203",
      "organization_name": "Red Cross NGO",
      "period":            "7d",
      "category":          "all",
      "reports": [
        {
          "reported_date": "2026-09-15",
          "category":      "respiratory",
          "case_count":    5,
          "status":        "active",
          "created_at":    "2026-09-15T10:23:00+00:00"
        }
      ]
    }
    """
    if not organization_name or not organization_name.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="organization_name query parameter is required.",
        )

    days, category = _validate_period_category(period, category)
    now   = _now()
    since = now - timedelta(days=days)
    until = now

    docs = _fetch_pincode_docs(
        _db(), pincode, category, since, until,
        organization_name=organization_name.strip(),
    )

    # Return only the allowed display fields — no uploader_uid, no client IDs.
    # "id" is the Firestore document ID, exposed so the health official UI can
    # reference it when flagging a specific report for correction.
    reports = sorted(
        [
            {
                "id":            doc.get("_id", ""),
                "reported_date": doc.get("reported_date", ""),
                "category":      doc.get("category", ""),
                "case_count":    int(doc.get("case_count") or 0),
                "status":        doc.get("status", "active"),
                "created_at":    _ts(doc.get("created_at")),
            }
            for doc in docs
        ],
        key=lambda r: r.get("created_at") or "",
        reverse=True,
    )

    return {
        "pincode":           pincode,
        "organization_name": organization_name.strip(),
        "period":            period,
        "category":          category,
        "reports":           reports,
        "report_count":      len(reports),
    }
