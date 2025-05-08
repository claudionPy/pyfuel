from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException
from app.models.drivers import Driver

"""async def getAllDrivers(session: AsyncSession):
    result = await session.execute(select(Driver))
    return result.scalars().all()"""

async def getDriverByCard(session: AsyncSession, card: str):
    result = await session.execute(select(Driver).filter(Driver.card == card))
    return result.scalars().first()

async def createDriver(session: AsyncSession, driver_data):
    existing = await getDriverByCard(session, driver_data.card)
    if existing:
        raise HTTPException(status_code=400, detail="Autista con questa card già esistente")
    
    new_driver = Driver(**driver_data.dict())
    session.add(new_driver)
    await session.commit()
    await session.refresh(new_driver)
    return new_driver

async def deleteDriverByCard(session: AsyncSession, card: str) -> bool:
    result = await session.execute(
        delete(Driver).where(Driver.card == card)
    )
    await session.commit()
    return result.rowcount > 0

async def updateDriver(session: AsyncSession, card: str, driver_data):
    driver = await getDriverByCard(session, card)
    if not driver:
        raise HTTPException(status_code=404, detail="Autista non trovato")
    
    if driver_data.card != card:
        existing = await getDriverByCard(session, driver_data.card)
        if existing:
            raise HTTPException(status_code=400, detail="Nuova card già in uso")
    
    for key, value in driver_data.dict().items():
        setattr(driver, key, value)
    
    await session.commit()
    await session.refresh(driver)
    return driver

async def searchDrivers(session: AsyncSession, filters: dict):
    query = select(Driver)
    
    if filters.get('card'):
        query = query.where(Driver.card.ilike(f"%{filters['card']}%"))
    if filters.get('company'):
        query = query.where(Driver.company.ilike(f"%{filters['company']}%"))
    if filters.get('driver_full_name'):
        query = query.where(Driver.driver_full_name.ilike(f"%{filters['driver_full_name']}%"))
    if filters.get('request_pin') is not None:
        query = query.where(Driver.request_pin == filters['request_pin'])
    if filters.get('request_vehicle_id') is not None:
        query = query.where(Driver.request_vehicle_id == filters['request_vehicle_id'])
    
    result = await session.execute(query)
    return result.scalars().all()
