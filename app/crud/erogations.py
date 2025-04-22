from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.erogations import Erogazione
from typing import Optional

async def get_erogazioni(session: AsyncSession):
    result = await session.execute(select(Erogazione))
    return result.scalars().all()

async def create_erogazione(session: AsyncSession, erogazione_data):
    new_erogazione = Erogazione(**erogazione_data.dict())
    session.add(new_erogazione)
    await session.commit()
    await session.refresh(new_erogazione)
    return new_erogazione

async def delete_erogazioni(session: AsyncSession):
    result = await session.execute(delete(Erogazione))
    await session.commit()
    return result.rowcount > 0

