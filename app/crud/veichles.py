from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException
from app.models.veichles import Vehicle

"""async def getAllVehicles(session: AsyncSession):
    result = await session.execute(select(Vehicle))
    return result.scalars().all()"""

async def getVehicleById(session: AsyncSession, vehicle_id: str):
    result = await session.execute(select(Vehicle).filter(Vehicle.vehicle_id == vehicle_id))
    return result.scalars().first()

async def getVehicleByPlate(session: AsyncSession, plate: str):
    result = await session.execute(select(Vehicle).filter(Vehicle.plate == plate))
    return result.scalars().first()

async def createVehicle(session: AsyncSession, vehicle_data):
    existing_by_id = await getVehicleById(session, vehicle_data.vehicle_id)
    if existing_by_id:
        raise HTTPException(status_code=400, detail="Veicolo con questo ID già presente")
    
    existing_by_plate = await getVehicleByPlate(session, vehicle_data.plate)
    if existing_by_plate:
        raise HTTPException(status_code=400, detail="Veicolo con questa plate già presente")
    
    new_vehicle = Vehicle(**vehicle_data.dict())
    session.add(new_vehicle)
    await session.commit()
    await session.refresh(new_vehicle)
    return new_vehicle

async def deleteVehicleById(session: AsyncSession, vehicle_id: str) -> bool:
    result = await session.execute(
        delete(Vehicle).where(Vehicle.vehicle_id == vehicle_id)
    )
    await session.commit()
    return result.rowcount > 0

async def updateVehicle(session: AsyncSession, vehicle_id: str, vehicle_data):
    vehicle = await getVehicleById(session, vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Veicolo non trovato")
    
    if vehicle_data.vehicle_id != vehicle_id:
        existing = await getVehicleById(session, vehicle_data.vehicle_id)
        if existing:
            raise HTTPException(status_code=400, detail="Nuovo ID veicolo già in uso")
    
    if vehicle_data.plate != vehicle.plate:
        existing = await getVehicleByPlate(session, vehicle_data.plate)
        if existing:
            raise HTTPException(status_code=400, detail="Nuova plate già in uso")
    
    for key, value in vehicle_data.dict().items():
        setattr(vehicle, key, value)
    
    await session.commit()
    await session.refresh(vehicle)
    return vehicle
    
async def searchVehicles(session: AsyncSession, filters: dict):
    query = select(Vehicle)
    
    if filters.get('vehicle_id'):
        query = query.where(Vehicle.vehicle_id.ilike(f"%{filters['vehicle_id']}%"))
    if filters.get('company_vehicle'):
        query = query.where(Vehicle.company_vehicle.ilike(f"%{filters['company_vehicle']}%"))
    if filters.get('vehicle_total_km'):
        query = query.where(Vehicle.vehicle_total_km == filters['vehicle_total_km'])
    if filters.get('plate'):
        query = query.where(Vehicle.plate.ilike(f"%{filters['plate']}%"))
    if filters.get('request_vehicle_km'):
        query = query.where(Vehicle.request_vehicle_km == filters['request_vehicle_km'])
    
    result = await session.execute(query)
    return result.scalars().all()