# main.py
# Entry point for the FastAPI web service:
# - Defines application lifespan (startup/shutdown) behavior
# - Configures CORS, static file serving, and API routing

from fastapi import FastAPI                   # Core FastAPI application class
from contextlib import asynccontextmanager     # Decorator to define async startup/shutdown events
from fastapi.middleware.cors import CORSMiddleware  # Middleware to enable Cross-Origin Resource Sharing
from fastapi.staticfiles import StaticFiles    # Serve static files (e.g., dashboard UI)
from app.database import engine, Base          # Async SQLAlchemy engine and Base metadata :contentReference[oaicite:0]{index=0}
from app.api.routes import router as api_router  # Import all API route definitions :contentReference[oaicite:1]{index=1}

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan context manager:
      - On startup: create all database tables if they don't exist
      - On shutdown: (no special teardown needed here)
    """
    # Establish a connection and run metadata.create_all within a transaction
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    # (Optional teardown logic could go here)

# Instantiate the FastAPI app with metadata and lifecycle
app = FastAPI(
    title="pyfuel API",
    description="pyfuel API for managing drivers, vehicles, erogations, parameters and more",
    lifespan=lifespan
)

# When accessing the api root, redirect to /dashboard
@app.get("/", include_in_schema=False)
async def root():
    return RedirectResponse(url="/dashboard")
# Serve the dashboard UI from the 'dashboard' directory at /dashboard
app.mount(
    "/dashboard",
    StaticFiles(directory="dashboard", html=True),
    name="dashboard"
)

# Enable CORS for all origins, methods, and headers
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8000" # dev
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register the main API router (endpoints under /api/**, etc.)
app.include_router(api_router)

