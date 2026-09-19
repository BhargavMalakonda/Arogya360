from fastapi import APIRouter, Depends

from app.core.auth import get_current_user

router = APIRouter()


@router.get("/api/health")
async def health_check():
    """Public liveness probe — no auth required."""
    return {"status": "ok"}


@router.get("/api/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    """
    Protected smoke-test endpoint.
    Verifies the full auth chain: Firebase token → decoded UID returned.
    """
    return {"uid": current_user["uid"]}
