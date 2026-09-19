from dotenv import load_dotenv
load_dotenv()  # Must run before any module that reads os.environ

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.firebase import initialize_firebase
from app.routes.health import router as health_router
from app.routes.triage import router as triage_router
from app.routes.community import router as community_router
from app.routes.summary import router as summary_router
from app.routes.reports import router as reports_router
from app.routes.hotspots import router as hotspots_router
from app.routes.investigate import router as investigate_router
from app.routes.corrections import router as corrections_router
from app.routes.checkins import router as checkins_router

# ── Firebase ───────────────────────────────────────────────────────────────────
initialize_firebase()

# ── App ────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Arogya360 API",
    description="Preventive-healthcare triage backend",
    version="0.1.0",
)

# ── CORS ───────────────────────────────────────────────────────────────────────
# TODO: Replace "https://your-vercel-domain.vercel.app" with the real Vercel
#       deployment URL once the frontend is deployed.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://arogya360-omega.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ────────────────────────────────────────────────────────────────────
app.include_router(health_router)
app.include_router(triage_router)
app.include_router(community_router)
app.include_router(summary_router)
app.include_router(reports_router)
app.include_router(hotspots_router)
app.include_router(investigate_router)
app.include_router(corrections_router)
app.include_router(checkins_router)
