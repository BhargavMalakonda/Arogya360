from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import firebase_admin.auth

# HTTPBearer extracts the token from "Authorization: Bearer <token>".
# auto_error=False lets us return a cleaner 401 instead of the default 403.
_bearer_scheme = HTTPBearer(auto_error=False)

# Allowed role values — used by require_role() for validation messaging.
ALLOWED_ROLES = frozenset({"contributor", "health_official"})


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
) -> dict:
    """
    FastAPI dependency that verifies a Firebase ID token.

    Returns the decoded token dict (includes 'uid') on success.
    Raises HTTP 401 if the header is missing, malformed, or the token is
    invalid / expired.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header missing or malformed.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    try:
        decoded_token: dict = firebase_admin.auth.verify_id_token(token)
    except firebase_admin.auth.ExpiredIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except firebase_admin.auth.InvalidIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return decoded_token


def require_role(*roles: str):
    """
    FastAPI dependency factory that enforces one or more role values.

    Usage — single role:
        @router.get("/endpoint")
        async def handler(user=Depends(require_role("contributor"))):
            ...

    Usage — multiple accepted roles:
        @router.get("/endpoint")
        async def handler(user=Depends(require_role("contributor", "health_official"))):
            ...

    The `role` claim is set on the Firebase Auth token via
    firebase_admin.auth.set_custom_user_claims().  It arrives in the decoded
    token dict returned by get_current_user() and is readable in Firestore
    security rules as request.auth.token.role.

    Raises:
        HTTP 401 — token missing / invalid (delegated to get_current_user)
        HTTP 403 — authenticated but role claim absent or not in `roles`
    """
    required = frozenset(roles)

    async def _dependency(
        current_user: dict = Depends(get_current_user),
    ) -> dict:
        user_role: str | None = current_user.get("role")
        if user_role not in required:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Access denied. Required role: "
                    f"{' or '.join(sorted(required))}."
                ),
            )
        return current_user

    return _dependency
