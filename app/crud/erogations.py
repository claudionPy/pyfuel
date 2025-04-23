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

async def search_erogazioni(session: AsyncSession, filters: dict):
    query = select(Erogazione)
    
    if filters.get('tessera'):
        query = query.where(Erogazione.tessera.ilike(f"%{filters['tessera']}%"))
    if filters.get('id_veicolo'):
        query = query.where(Erogazione.id_veicolo == filters['id_veicolo'])
    if filters.get('nome_compagnia'):
        query = query.where(Erogazione.nome_compagnia.ilike(f"%{filters['nome_compagnia']}%"))
    if filters.get('lato_erogazione'):
        query = query.where(Erogazione.lato_erogazione.ilike(f"%{filters['lato_erogazione']}%"))
    if filters.get('modalita_erogazione'):
        query = query.where(Erogazione.modalita_erogazione.ilike(f"%{filters['modalita_erogazione']}%"))
    if filters.get('prodotto_erogato'):
        query = query.where(Erogazione.prodotto_erogato.ilike(f"%{filters['prodotto_erogato']}%"))
    if filters.get('km_totali_veicolo') is not None:
        query = query.where(Erogazione.km_totali_veicolo == filters['km_totali_veicolo'])
    if filters.get('litri_erogati') is not None:
        query = query.where(Erogazione.litri_erogati == filters['litri_erogati'])
    
    result = await session.execute(query)
    return result.scalars().all()

