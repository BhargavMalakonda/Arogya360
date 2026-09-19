"""
prevention.py
Shared loader for backend/app/data/prevention_kb.json.

Extracted from triage_engine.py so that both triage_engine.py and
community.py can call get_prevention_kb() without either importing
from the other.

The cache is a true module-level singleton: whichever module calls
get_prevention_kb() first triggers the single file read; all subsequent
calls (from any module) return the cached dict.

KB keys confirmed: respiratory | metabolic | cardiovascular | general
Source attribution: WHO / ICMR / MoHFW — generic lifestyle guidance only.
"""

import json
import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).parent.parent / "data"

_prevention_kb: dict[str, Any] | None = None


def get_prevention_kb() -> dict[str, Any]:
    """
    Lazy-loads prevention_kb.json on first call and caches the result.
    Thread-safety note: in CPython the GIL makes this safe for concurrent
    first-calls; the worst case is two reads of the same small JSON file.
    """
    global _prevention_kb
    if _prevention_kb is None:
        path = DATA_DIR / "prevention_kb.json"
        with open(path, "r", encoding="utf-8") as f:
            _prevention_kb = json.load(f)
        logger.debug("prevention_kb.json loaded (%d categories)", len(_prevention_kb))
    return _prevention_kb
