from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException
from app.models.veichles import Veicolo

async def get_veicoli_all(session: AsyncSession):
    result = await session.execute(select(Veicolo))
    return result.scalars().all()

async def get_veicolo_by_id(session: AsyncSession, id_veicolo: str):
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

async def delete_veicolo_by_id(session: AsyncSession, id_veicolo: str) -> bool:
    result = await session.execute(
        delete(Veicolo).where(Veicolo.id_veicolo == id_veicolo)
    )
    await session.commit()
    return result.rowcount > 0

async def update_veicolo(session: AsyncSession, id_veicolo: str, veicolo_data):
    veicolo = await get_veicolo_by_id(session, id_veicolo)
    if not veicolo:
        raise HTTPException(status_code=404, detail="Veicolo non trovato")
    
    # Check if new ID already exists (if changed)
    if veicolo_data.id_veicolo != id_veicolo:
        existing = await get_veicolo_by_id(session, veicolo_data.id_veicolo)
        if existing:
            raise HTTPException(status_code=400, detail="Nuovo ID veicolo già in uso")
    
    # Check if new plate already exists (if changed)
    if veicolo_data.targa != veicolo.targa:
        existing = await get_veicolo_by_targa(session, veicolo_data.targa)
        if existing:
            raise HTTPException(status_code=400, detail="Nuova targa già in uso")
    
    # Update fields
    for key, value in veicolo_data.dict().items():
        setattr(veicolo, key, value)
    
    await session.commit()
    await session.refresh(veicolo)
    return veicolo
    
async def search_veicoli(session: AsyncSession, filters: dict):
    query = select(Veicolo)
    
    if filters.get('id_veicolo'):
        query = query.where(Veicolo.id_veicolo.ilike(f"%{filters['id_veicolo']}%"))
    if filters.get('nome_compagnia'):
        query = query.where(Veicolo.nome_compagnia.ilike(f"%{filters['nome_compagnia']}%"))
    if filters.get('km_totali_veicolo'):
        query = query.where(Veicolo.km_totali_veicolo == filters['km_totali_veicolo'])
    if filters.get('targa'):
        query = query.where(Veicolo.targa.ilike(f"%{filters['targa']}%"))
    if filters.get('richiedi_km_veicolo'):
        query = query.where(Veicolo.richiedi_km_veicolo == filters['richiedi_km_veicolo'])
    
    result = await session.execute(query)
    return result.scalars().all()