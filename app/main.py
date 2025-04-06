from fastapi import FastAPI
from app.database import engine, Base
from app.api.routes import router as api_router

app = FastAPI(title="db communication api")

@app.on_event("startup")
async def on_startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

app.include_router(api_router)
