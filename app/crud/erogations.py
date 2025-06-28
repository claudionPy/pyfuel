# erogations.py
# CRUD operations for the Erogation model: create, delete all, and search.

from sqlalchemy import select, delete            # Build SELECT and DELETE statements
from sqlalchemy.ext.asyncio import AsyncSession  # Async DB session
from app.models.erogations import Erogation      # ORM model for erogations

async def createErogation(session: AsyncSession, erogation_data):
    """
    Insert a new Erogation record.
    - erogation_data: Pydantic schema with dispense details
    - Commits and returns the created ORM instance.
    """
    new_erogation = Erogation(**erogation_data.dict())
    session.add(new_erogation)
    await session.commit()
    await session.refresh(new_erogation)
    return new_erogation

async def deleteErogations(session: AsyncSession):
    """
    Remove all Erogation records.
    - Returns True if any rows were deleted, False otherwise.
    """
    result = await session.execute(delete(Erogation))
    await session.commit()
    return result.rowcount > 0

async def searchErogations(session: AsyncSession, filters: dict):
    """
    Find erogations matching optional filters:
      - text fields (card, company, mode, product) use case-insensitive LIKE
      - numeric equality for side and liters
      - timestamp range via 'start_time'/'end_time' keys
    Returns a list of matching Erogation instances.
    """
    query = select(Erogation)
    if filters.get('card'):
        query = query.where(Erogation.card.ilike(f"%{filters['card']}%"))
    if filters.get('vehicle_id'):
        query = query.where(Erogation.vehicle_id.ilike(f"%{filters['vehicle_id']}%"))
    if filters.get('company'):
        query = query.where(Erogation.company.ilike(f"%{filters['company']}%"))
    if filters.get('erogation_side') is not None:
        query = query.where(Erogation.erogation_side == filters['erogation_side'])
    if filters.get('mode'):
        query = query.where(Erogation.mode.ilike(f"%{filters['mode']}%"))
    if filters.get('dispensed_product'):
        query = query.where(Erogation.dispensed_product.ilike(f"%{filters['dispensed_product']}%"))
    if filters.get('vehicle_total_km') is not None:
        query = query.where(Erogation.vehicle_total_km == filters['vehicle_total_km'])
    if filters.get('dispensed_liters') is not None:
        query = query.where(Erogation.dispensed_liters == filters['dispensed_liters'])
    if filters.get('start_time'):
        query = query.where(Erogation.erogation_timestamp >= filters['start_time'])
    if filters.get('end_time'):
        query = query.where(Erogation.erogation_timestamp <= filters['end_time'])
    result = await session.execute(query)
    return result.scalars().all()

