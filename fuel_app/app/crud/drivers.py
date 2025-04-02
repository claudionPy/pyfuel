from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException
from app.models.drivers import Autista

async def get_autista(session: AsyncSession, tessera: str):
    result = await session.execute(select(Autista).filter(Autista.tessera == tessera))
    return result.scalars().first()

async def create_autista(session: AsyncSession, autista_data):
    existing = await get_autista(session, autista_data.tessera)
    if existing:
        raise HTTPException(status_code=400, detail="Autista con questa tessera già esistente")
    
    new_autista = Autista(**autista_data.dict())
    session.add(new_autista)
    await session.commit()
    await session.refresh(new_autista)
    return new_autista

