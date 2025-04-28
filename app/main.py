from fastapi import FastAPI
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.api.routes import router as api_router

app = FastAPI(title="db communication api")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],      # o origins se vuoi limitarli
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Eventi di avvio e spegnimento
@asynccontextmanager
async def lifespan():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

app.include_router(api_router)
