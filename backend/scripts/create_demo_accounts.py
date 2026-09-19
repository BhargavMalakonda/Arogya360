"""
create_demo_accounts.py
=======================
One-time setup script for Health Dashboard demo accounts.

Run from the backend/ directory:

    python scripts/create_demo_accounts.py

The script is IDEMPOTENT — safe to re-run at any time:
  - If an account already exists it is reused (no duplicate, no error).
  - Custom claims are always (re-)written so any drift is corrected.
  - Firestore profile: dashboard fields (role, organization_name,
    organization_type) are always updated; created_at is written ONLY
    on the initial creation run and is never overwritten on re-runs.

Accounts created:
  a) redcross@ngo.com / demo1234
       role: contributor
       organization_name: "Red Cross"
       organization_type: "ngo"

  b) admin@argya360.com / demo1234
       role: health_official
       organization_name: "Government Health Department"
       organization_type: "government"

Firebase Admin SDK credentials are read from the same environment variables
used by app/core/firebase.py (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL,
FIREBASE_PRIVATE_KEY).  python-dotenv loads them from backend/.env
automatically when the script is run from the backend/ directory.

Passwords are used ONLY for Firebase Auth account creation.
They are NOT written to Firestore, NOT logged, and NOT stored anywhere
beyond the Firebase Authentication service itself.
"""

import os
import sys
import logging
from datetime import datetime, timezone

# ── Load .env — same pattern as app/main.py ───────────────────────────────────
from dotenv import load_dotenv
load_dotenv()  # reads backend/.env when cwd is backend/

# ── Firebase Admin SDK ────────────────────────────────────────────────────────
import firebase_admin
from firebase_admin import credentials, auth as fb_auth, firestore as fb_firestore

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s  %(message)s",
)
logger = logging.getLogger(__name__)

# ── Demo account definitions ──────────────────────────────────────────────────
# Passwords are defined here solely to pass to create_user().
# They are never logged, never written to Firestore, and never returned.
DEMO_ACCOUNTS = [
    {
        "email":             "redcross@ngo.com",
        "password":          "demo1234",
        "display_name":      "Red Cross Demo",
        "role":              "contributor",
        "organization_name": "Red Cross",
        "organization_type": "ngo",
    },
    {
        "email":             "admin@argya360.com",
        "password":          "demo1234",
        "display_name":      "Health Official Demo",
        "role":              "health_official",
        "organization_name": "Government Health Department",
        "organization_type": "government",
    },
]


def _init_firebase() -> None:
    """
    Initialize the Firebase Admin SDK using the exact same credential pattern
    as app/core/firebase.py.  No-op if already initialized.
    """
    if firebase_admin._apps:
        return

    private_key = os.environ["FIREBASE_PRIVATE_KEY"].replace("\\n", "\n")

    cred = credentials.Certificate({
        "type":              "service_account",
        "project_id":        os.environ["FIREBASE_PROJECT_ID"],
        "private_key_email": os.environ["FIREBASE_CLIENT_EMAIL"],
        "private_key":       private_key,
        "client_email":      os.environ["FIREBASE_CLIENT_EMAIL"],
        "token_uri":         "https://oauth2.googleapis.com/token",
        "auth_uri":          "https://accounts.google.com/o/oauth2/auth",
    })

    firebase_admin.initialize_app(cred, {
        "projectId": os.environ["FIREBASE_PROJECT_ID"],
    })
    logger.info(
        "Firebase Admin SDK initialized (project: %s)",
        os.environ["FIREBASE_PROJECT_ID"],
    )


def _get_or_create_user(email: str, password: str, display_name: str) -> tuple[str, bool]:
    """
    Returns (uid, created) where `created` is True on first creation,
    False if the account already existed.

    Never raises on 'email already exists' — that is the idempotent path.
    The password is passed ONLY to create_user(); it is not stored or logged.
    """
    try:
        user = fb_auth.get_user_by_email(email)
        logger.info("Account already exists: %s  (uid: %s)", email, user.uid)
        return user.uid, False
    except fb_auth.UserNotFoundError:
        pass

    user = fb_auth.create_user(
        email=email,
        password=password,
        display_name=display_name,
        email_verified=True,   # demo accounts — skip email verification flow
    )
    logger.info("Created new account: %s  (uid: %s)", email, user.uid)
    return user.uid, True


def _set_custom_claims(uid: str, role: str) -> None:
    """
    Writes the `role` custom claim to the Firebase Auth token.

    Always overwrites to correct any drift on re-runs.

    The claim is readable in:
      - backend:          decoded_token.get("role")  via require_role()
      - Firestore rules:  request.auth.token.role

    NOTE: custom claims only appear in newly-issued ID tokens.  Users who are
    already signed in must call getIdToken(true) (force-refresh) or sign out
    and back in before the new claim is visible in their token.
    """
    fb_auth.set_custom_user_claims(uid, {"role": role})
    logger.info("  custom claim set → role=%s", role)


def _upsert_firestore_profile(
    db,
    uid: str,
    email: str,
    display_name: str,
    role: str,
    organization_name: str,
    organization_type: str,
    is_new_account: bool,
) -> None:
    """
    Writes / updates the users/{uid} Firestore document.

    Field strategy:
      - On first creation (is_new_account=True):  write ALL fields including
        created_at, using set() with merge=True so a pre-existing document
        (edge case) is not completely overwritten.
      - On re-run (is_new_account=False): use update() to touch ONLY the
        dashboard-specific fields.  created_at is deliberately excluded so it
        is never overwritten by a re-run.

    Follows the field set established by Onboarding.jsx (uid, email, name,
    created_at) plus the three new dashboard fields (role, organization_name,
    organization_type).  Passwords are NOT included in any Firestore write.
    """
    ref = db.collection("users").document(uid)

    dashboard_fields = {
        "role":              role,
        "organization_name": organization_name,
        "organization_type": organization_type,
    }

    if is_new_account:
        # Full initial write — created_at set once, never overwritten.
        ref.set(
            {
                "uid":        uid,
                "email":      email,
                "name":       display_name,
                "created_at": datetime.now(timezone.utc).isoformat(),
                **dashboard_fields,
            },
            merge=True,  # safe even if doc somehow already exists
        )
    else:
        # Subsequent run — update only dashboard fields; leave created_at intact.
        ref.update(dashboard_fields)

    logger.info(
        "  Firestore users/%s → role=%s  org_name=%s  org_type=%s",
        uid, role, organization_name, organization_type,
    )


def main() -> None:
    _init_firebase()
    db = fb_firestore.client()

    errors: list[str] = []

    for account in DEMO_ACCOUNTS:
        email = account["email"]
        logger.info("─── Processing: %s", email)
        try:
            uid, is_new = _get_or_create_user(
                email=email,
                password=account["password"],
                display_name=account["display_name"],
            )
            _set_custom_claims(uid, role=account["role"])
            _upsert_firestore_profile(
                db=db,
                uid=uid,
                email=email,
                display_name=account["display_name"],
                role=account["role"],
                organization_name=account["organization_name"],
                organization_type=account["organization_type"],
                is_new_account=is_new,
            )
            logger.info("  ✓ Done: %s", email)
        except Exception as exc:
            logger.error("  ✗ Failed for %s: %s", email, exc)
            errors.append(f"{email}: {exc}")

    if errors:
        logger.error(
            "\n%d account(s) failed:\n  %s",
            len(errors),
            "\n  ".join(errors),
        )
        sys.exit(1)

    logger.info("\nAll demo accounts are ready.")
    logger.info(
        "\n"
        "── Verification steps ──────────────────────────────────────────────\n"
        "\n"
        "1. Firebase Console → Authentication → Users\n"
        "   Search for each email.  Click the user row.\n"
        "   Under 'Custom claims' you should see:\n"
        '     redcross@ngo.com   →  {"role":"contributor"}\n'
        '     admin@argya360.com →  {"role":"health_official"}\n'
        "\n"
        "2. Firebase Console → Firestore Database → users collection\n"
        "   Open each document (keyed by uid).\n"
        "   Confirm fields: role, organization_name, organization_type\n"
        "   are present and correct.\n"
        "\n"
        "3. App-side token verification (matches this codebase):\n"
        "   a) Start the Vite dev server:  npm run dev\n"
        "   b) Log in as a demo account at /auth\n"
        "   c) In browser DevTools console run:\n"
        "        (await import('/src/lib/firebase.js')).auth.currentUser\n"
        "          .getIdTokenResult(true)        // true = force refresh\n"
        "          .then(r => console.log(r.claims))\n"
        "      The claims object should contain  role: 'contributor'\n"
        "      or  role: 'health_official'.\n"
        "   d) Alternatively, call the backend health endpoint with a fresh\n"
        "      token to confirm the backend sees the claim:\n"
        "        const token = await (await import('/src/lib/firebase.js'))\n"
        "          .auth.currentUser.getIdToken(true)\n"
        "        await fetch('http://localhost:8000/api/health',\n"
        "          {headers:{Authorization:`Bearer ${token}`}})\n"
        "          .then(r=>r.json()).then(console.log)\n"
        "\n"
        "   NOTE: custom claims are embedded in the ID token only after a\n"
        "   force-refresh (getIdToken(true)) or a fresh sign-in.\n"
        "   A token obtained before set_custom_user_claims() was called will\n"
        "   NOT contain the role claim until it is refreshed.\n"
        "───────────────────────────────────────────────────────────────────"
    )


if __name__ == "__main__":
    main()
