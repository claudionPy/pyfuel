from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.erogations import Erogation

"""async def getErogations(session: AsyncSession):
    result = await session.execute(select(Erogation))
    return result.scalars().all()"""

async def createErogation(session: AsyncSession, erogation_data):
    new_erogation = Erogation(**erogation_data.dict())
    session.add(new_erogation)
    await session.commit()
    await session.refresh(new_erogation)
    return new_erogation

async def deleteErogations(session: AsyncSession):
    result = await session.execute(delete(Erogation))
    await session.commit()
    return result.rowcount > 0

async def searchErogations(session: AsyncSession, filters: dict):
    query = select(Erogation)
    
    if filters.get('card'):
        query = query.where(Erogation.card.ilike(f"%{filters['card']}%"))
    if filters.get('vehicle_id'):
        query = query.where(Erogation.vehicle_id.ilike(f"%{filters['vehicle_id']}%"))
    if filters.get('company'):
        query = query.where(Erogation.company.ilike(f"%{filters['company']}%"))
    if filters.get('erogation_side'):
        query = query.where(Erogation.erogation_side == filters['erogation_side'])
    if filters.get('mode'):
        query = query.where(Erogation.mode.ilike(f"%{filters['mode']}%"))
    if filters.get('dispensed_product'):
        query = query.where(Erogation.dispensed_product.ilike(f"%{filters['dispensed_product']}%"))
    if filters.get('vehicle_total_km'):
        query = query.where(Erogation.vehicle_total_km == filters['vehicle_total_km'])
    if filters.get('dispensed_liters') is not None:
        query = query.where(Erogation.dispensed_liters == filters['dispensed_liters'])
    if filters.get('start_time'):
        query = query.where(Erogation.erogation_timestamp >= filters['start_time'])
    if filters.get('end_time'):
        query = query.where(Erogation.erogation_timestamp <= filters['end_time'])
    
    result = await session.execute(query)
    return result.scalars().all()
