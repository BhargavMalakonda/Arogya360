"""
hotspots.py
FastAPI router for the health-official hotspot aggregation endpoint.

Endpoint:
  GET /api/hotspots  — health_official only (require_role)

Query parameters:
  period    "7d" | "14d" | "30d"              default "7d"
  category  "all" | "respiratory" | "cardiovascular" | "metabolic" | "general"
                                               default "all"
  esi_level "1" | "2" | "3" | "4" | "5"       default "1"

Security:
  Requires role="health_official" in the Firebase ID token custom claims.
  Returns aggregated pincode-level data only — no individual submission details,
  no uploader_uid, no uploader_name, no personal identifiers.

Aggregation strategy (MVP):
  1. One Firestore query per time window (current + previous) using
     esi_level + created_at range filters.
  2. Python in-memory aggregation over the result set.

  ⚠ SCALING NOTE: This is O(N_docs) in memory.  At high submission volume
  (>50 k docs) this will be slow and may hit Cloud Run memory limits.
  Future mitigation options:
    - Firestore native aggregation (COUNT/SUM — now GA)
    - Pre-aggregated counter shards per (pincode, esi_level, category, date)
    - BigQuery export + materialised view
  For MVP (hundreds to low thousands of docs) this approach is correct.

Trend calculation:
  - current window  = [now - period, now)
  - previous window = [now - 2*period, now - period)
  - trend_percent   = round((current_sum - prev_sum) / prev_sum * 100)
  - previous_sum == 0 → trend_percent: null, trend_label: "New activity"

ESI level is a FILTER, not a weight or severity indicator for this endpoint.
It narrows which reports are counted; it does NOT imply higher ESI = worse
outbreak.  No ESI-level weighting or averaging is performed anywhere.

Firestore index required (declared in firestore.indexes.json):
  health_reports: [esi_level ASC, created_at ASC]
  If category != "all":
  health_reports: [esi_level ASC, category ASC, created_at ASC]
  (Both indexes are added in firestore.indexes.json to cover both paths.)
"""

import logging
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any

import firebase_admin.firestore
from fastapi import APIRouter, Depends, Query
from google.cloud.firestore_v1.base_query import FieldFilter

from app.core.auth import require_role

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/hotspots", tags=["hotspots"])

# ── Constants ──────────────────────────────────────────────────────────────────
VALID_PERIODS   = {"7d": 7, "14d": 14, "30d": 30}
VALID_CATEGORIES = {"all", "respiratory", "cardiovascular", "metabolic", "general"}
VALID_ESI_LEVELS = {1, 2, 3, 4, 5}

ALL_CATEGORIES = ["respiratory", "cardiovascular", "metabolic", "general"]


# ── Helpers ────────────────────────────────────────────────────────────────────

def _db() -> Any:
    return firebase_admin.firestore.client()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _to_dt(val: Any) -> datetime | None:
    """
    Convert a Firestore Timestamp, datetime, or ISO string to a UTC datetime.
    Returns None if the value cannot be converted.
    """
    if val is None:
        return None
    if isinstance(val, datetime):
        return val if val.tzinfo else val.replace(tzinfo=timezone.utc)
    # Firestore Timestamp object from Admin SDK
    if hasattr(val, "ToDatetime"):
        return val.ToDatetime(tzinfo=timezone.utc)
    # google.cloud.firestore_v1.base_document.DatetimeWithNanoseconds
    if hasattr(val, "timestamp"):
        return datetime.fromtimestamp(val.timestamp(), tz=timezone.utc)
    # ISO string fallback
    try:
        dt = datetime.fromisoformat(str(val))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except (ValueError, TypeError):
        return None


def _fetch_docs(
    db: Any,
    esi_level: int,
    category: str,
    since: datetime,
    until: datetime,
) -> list[dict[str, Any]]:
    """
    Fetch all health_reports documents that match:
      esi_level == esi_level
      created_at >= since
      created_at < until
      category == category  (skipped when category == "all")
      status == "active"    (filtered in-memory — keeps indexes simple)

    The Admin SDK synchronous .get() is used here, matching the pattern in
    community.py and reports.py.

    Returns a list of raw document dicts.

    ⚠ SCALING NOTE: fetches every matching document — see module docstring.
    """
    coll = db.collection("health_reports")

    q = (
        coll
        .where(filter=FieldFilter("esi_level", "==", esi_level))
        .where(filter=FieldFilter("created_at", ">=", since))
        .where(filter=FieldFilter("created_at", "<",  until))
    )

    if category != "all":
        q = q.where(filter=FieldFilter("category", "==", category))

    try:
        docs = q.get()
    except Exception as exc:
        logger.error(
            "hotspots query failed (esi=%d category=%s since=%s until=%s): %s",
            esi_level, category, since.isoformat(), until.isoformat(), exc,
        )
        return []

    return [
        d.to_dict()
        for d in docs
        if d.to_dict().get("status") == "active"
    ]


def _aggregate(docs: list[dict[str, Any]]) -> dict[str, dict]:
    """
    Groups documents by pincode and aggregates:
      - total case_count
      - per-category case_count breakdown
      - distinct organization_name values (for organization_count)

    Returns a dict keyed by pincode.
    """
    # pincode → {
    #   "total": int,
    #   "categories": {cat: int},
    #   "orgs": set[str],
    # }
    agg: dict[str, dict[str, Any]] = {}

    for doc in docs:
        pin = doc.get("pincode", "")
        if not pin:
            continue

        cat   = doc.get("category", "general")
        count = int(doc.get("case_count") or 0)
        org   = doc.get("organization_name", "")

        if pin not in agg:
            agg[pin] = {
                "total":      0,
                "categories": defaultdict(int),
                "orgs":       set(),
            }

        agg[pin]["total"] += count
        agg[pin]["categories"][cat] += count
        if org:
            agg[pin]["orgs"].add(org)

    return agg


# ── GET /api/hotspots ──────────────────────────────────────────────────────────

@router.get("")
async def get_hotspots(
    period:    str = Query(default="7d",  description="7d | 14d | 30d"),
    category:  str = Query(default="all", description="all | respiratory | cardiovascular | metabolic | general"),
    esi_level: str = Query(default="1",   description="1 | 2 | 3 | 4 | 5"),
    current_user: dict = Depends(require_role("health_official")),
) -> dict[str, Any]:
    """
    Returns aggregated hotspot data for the health official dashboard.

    ESI level is a FILTER — it narrows which reports are counted.
    It does NOT represent a severity weight or outbreak severity score.

    Trend is calculated by comparing the current window to the equivalent
    prior window of the same duration.  trend_percent: null means no prior
    activity was recorded, not that the situation improved.

    Response:
    {
      "hotspots": [
        {
          "pincode":            "603203",
          "esi_level":          1,
          "case_count":         47,
          "trend_percent":      32,       // null if no prior data
          "trend_label":        "+32%",   // "New activity" if no prior data
          "categories": {
            "respiratory": 31,
            "general": 9,
            "cardiovascular": 5,
            "metabolic": 2
          },
          "organization_count": 3
        }
      ],
      "meta": {
        "period":    "7d",
        "category":  "all",
        "esi_level": 1,
        "generated_at": "<ISO timestamp>"
      }
    }
    """
    # ── Validate params ───────────────────────────────────────────────────────
    if period not in VALID_PERIODS:
        from fastapi import HTTPException, status as http_status
        raise HTTPException(
            status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"period must be one of: {', '.join(sorted(VALID_PERIODS))}.",
        )
    if category not in VALID_CATEGORIES:
        from fastapi import HTTPException, status as http_status
        raise HTTPException(
            status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"category must be one of: {', '.join(sorted(VALID_CATEGORIES))}.",
        )
    try:
        esi_int = int(esi_level)
        if esi_int not in VALID_ESI_LEVELS:
            raise ValueError
    except ValueError:
        from fastapi import HTTPException, status as http_status
        raise HTTPException(
            status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="esi_level must be 1, 2, 3, 4, or 5.",
        )

    days = VALID_PERIODS[period]
    now  = _now()

    # ── Time windows ──────────────────────────────────────────────────────────
    current_start  = now - timedelta(days=days)
    current_end    = now                          # exclusive upper bound
    previous_start = now - timedelta(days=2 * days)
    previous_end   = current_start               # exclusive upper bound

    db = _db()

    # ── Fetch both windows ────────────────────────────────────────────────────
    current_docs  = _fetch_docs(db, esi_int, category, current_start,  current_end)
    previous_docs = _fetch_docs(db, esi_int, category, previous_start, previous_end)

    # ── Aggregate ─────────────────────────────────────────────────────────────
    current_agg  = _aggregate(current_docs)
    previous_agg = _aggregate(previous_docs)

    # ── Build hotspot rows ────────────────────────────────────────────────────
    # Include pincodes that appear in the current window.
    # Pincodes that only appear in the previous window are not included
    # (they have zero current activity — not a hotspot).
    hotspots: list[dict[str, Any]] = []

    for pin, curr in sorted(
        current_agg.items(),
        key=lambda kv: kv[1]["total"],
        reverse=True,
    ):
        current_total  = curr["total"]
        previous_total = previous_agg.get(pin, {}).get("total", 0)

        # Trend calculation
        if previous_total == 0:
            trend_percent = None
            trend_label   = "New activity"
        else:
            raw_pct = round((current_total - previous_total) / previous_total * 100)
            trend_percent = raw_pct
            trend_label   = f"+{raw_pct}%" if raw_pct >= 0 else f"{raw_pct}%"

        # Category breakdown — include all four categories with 0 for absent ones
        categories = {
            cat: int(curr["categories"].get(cat, 0))
            for cat in ALL_CATEGORIES
        }

        hotspots.append({
            "pincode":            pin,
            "esi_level":          esi_int,
            "case_count":         current_total,
            "trend_percent":      trend_percent,
            "trend_label":        trend_label,
            "categories":         categories,
            "organization_count": len(curr["orgs"]),
        })

    return {
        "hotspots": hotspots,
        "meta": {
            "period":       period,
            "category":     category,
            "esi_level":    esi_int,
            "generated_at": now.isoformat(),
        },
    }
