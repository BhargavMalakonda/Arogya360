import os
import firebase_admin
from firebase_admin import credentials

def initialize_firebase() -> None:
    """
    Initialize the Firebase Admin SDK once.
    Reads credentials from environment variables.
    FIREBASE_PRIVATE_KEY stores literal \\n sequences — these are replaced
    with real newline characters before building the credentials dict.
    """
    if firebase_admin._apps:
        # Already initialized — skip.
        return

    private_key = os.environ["FIREBASE_PRIVATE_KEY"].replace("\\n", "\n")

    cred = credentials.Certificate({
        "type": "service_account",
        "project_id": os.environ["FIREBASE_PROJECT_ID"],
        "private_key_email": os.environ["FIREBASE_CLIENT_EMAIL"],
        "private_key": private_key,
        # These fields are required by the SDK schema even though
        # Admin SDK token verification only uses the three above.
        "client_email": os.environ["FIREBASE_CLIENT_EMAIL"],
        "token_uri": "https://oauth2.googleapis.com/token",
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    })

    firebase_admin.initialize_app(cred, {
        "projectId": os.environ["FIREBASE_PROJECT_ID"],
    })
