from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException
from app.models.veichles import Veicolo

async def get_veicolo_by_id(session: AsyncSession, id_veicolo: int):
    result = await session.execute(select(Veicolo).filter(Veicolo.id_veicolo == id_veicolo))
    return result.scalars().first()

async def get_veicolo_by_targa(session: AsyncSession, targa: str):
    result = await session.execute(select(Veicolo).filter(Veicolo.targa == targa))
    return result.scalars().first()

async def create_veicolo(session: AsyncSession, veicolo_data):
    existing_by_id = await get_veicolo_by_id(session, veicolo_data.id_veicolo)
    if existing_by_id:
        raise HTTPException(status_code=400, detail="Veicolo con questo ID già presente")
    
    existing_by_targa = await get_veicolo_by_targa(session, veicolo_data.targa)
    if existing_by_targa:
        raise HTTPException(status_code=400, detail="Veicolo con questa targa già presente")
    
    new_veicolo = Veicolo(**veicolo_data.dict())
    session.add(new_veicolo)
    await session.commit()
    await session.refresh(new_veicolo)
    return new_veicolo
