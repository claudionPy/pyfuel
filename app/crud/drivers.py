from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException
from app.models.drivers import Autista

async def get_autisti_all(session: AsyncSession):
    result = await session.execute(select(Autista))
    return result.scalars().all()

async def get_autista_by_tessera(session: AsyncSession, tessera: str):
    result = await session.execute(select(Autista).filter(Autista.tessera == tessera))
    return result.scalars().first()

async def create_autista(session: AsyncSession, autista_data):
    existing = await get_autista_by_tessera(session, autista_data.tessera)
    if existing:
        raise HTTPException(status_code=400, detail="Autista con questa tessera già esistente")
    
    new_autista = Autista(**autista_data.dict())
    session.add(new_autista)
    await session.commit()
    await session.refresh(new_autista)
    return new_autista

async def delete_autista_by_tessera(session: AsyncSession, tessera: str) -> bool:
    result = await session.execute(
        delete(Autista).where(Autista.tessera == tessera)
    )
    await session.commit()
    return result.rowcount > 0

async def update_autista(session: AsyncSession, tessera: str, autista_data):
    autista = await get_autista_by_tessera(session, tessera)
    if not autista:
        raise HTTPException(status_code=404, detail="Autista non trovato")
    
    # Check if new tessera already exists (if changed)
    if autista_data.tessera != tessera:
        existing = await get_autista_by_tessera(session, autista_data.tessera)
        if existing:
            raise HTTPException(status_code=400, detail="Nuova tessera già in uso")
    
    # Update fields
    for key, value in autista_data.dict().items():
        setattr(autista, key, value)
    
    await session.commit()
    await session.refresh(autista)
    return autista

async def search_autisti(session: AsyncSession, filters: dict):
    query = select(Autista)
    
    if filters.get('tessera'):
        query = query.where(Autista.tessera.ilike(f"%{filters['tessera']}%"))
    if filters.get('nome_compagnia'):
        query = query.where(Autista.nome_compagnia.ilike(f"%{filters['nome_compagnia']}%"))
    if filters.get('nome_autista'):
        query = query.where(Autista.nome_autista.ilike(f"%{filters['nome_autista']}%"))
    if filters.get('richiedi_pin') is not None:
        query = query.where(Autista.richiedi_pin == filters['richiedi_pin'])
    if filters.get('richiedi_id_veicolo') is not None:
        query = query.where(Autista.richiedi_id_veicolo == filters['richiedi_id_veicolo'])
    
    result = await session.execute(query)
    return result.scalars().all()
