# vehicles.py
# CRUD operations for the Vehicle model: lookup, create, update, delete, and search.

from sqlalchemy import select, delete             # SQLAlchemy query builders
from sqlalchemy.ext.asyncio import AsyncSession   # For async DB access
from fastapi import HTTPException                 # To raise HTTP errors in CRUD
from app.models.vehicles import Vehicle           # ORM model for vehicles

async def getVehicleById(session: AsyncSession, vehicle_id: str):
    """
    Retrieve a Vehicle by its unique ID.
    Returns the Vehicle or None if not found.
    """
    result = await session.execute(
        select(Vehicle).filter(Vehicle.vehicle_id == vehicle_id)
    )
    return result.scalars().first()

async def getVehicleByPlate(session: AsyncSession, plate: str):
    """
    Retrieve a Vehicle by license plate.
    Returns the Vehicle or None if not found.
    """
    result = await session.execute(
        select(Vehicle).filter(Vehicle.plate == plate)
    )
    return result.scalars().first()

async def createVehicle(session: AsyncSession, vehicle_data):
    """
    Create a new Vehicle record.
    - Ensures both vehicle_id and plate are unique:
        * Raises 400 if either is already in use.
    - Commits and returns the new Vehicle.
    """
    if await getVehicleById(session, vehicle_data.vehicle_id):
        raise HTTPException(status_code=400, detail="Veicolo con questo ID già presente")
    if await getVehicleByPlate(session, vehicle_data.plate):
        raise HTTPException(status_code=400, detail="Veicolo con questa plate già presente")

    new_vehicle = Vehicle(**vehicle_data.dict())
    session.add(new_vehicle)
    await session.commit()
    await session.refresh(new_vehicle)
    return new_vehicle

async def deleteVehicleById(session: AsyncSession, vehicle_id: str) -> bool:
    """
    Delete the Vehicle matching vehicle_id.
    Returns True if deletion occurred, False otherwise.
    """
    result = await session.execute(
        delete(Vehicle).where(Vehicle.vehicle_id == vehicle_id)
    )
    await session.commit()
    return result.rowcount > 0

async def updateVehicle(session: AsyncSession, vehicle_id: str, vehicle_data):
    """
    Update an existing Vehicle’s fields.
    - Validates existence of original record.
    - Ensures new vehicle_id or plate (if changed) remain unique.
    - Commits and returns the updated Vehicle.
    """
    vehicle = await getVehicleById(session, vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Veicolo non trovato")

    # If changing ID, ensure new one isn't used
    if vehicle_data.vehicle_id != vehicle_id and await getVehicleById(session, vehicle_data.vehicle_id):
        raise HTTPException(status_code=400, detail="Nuovo ID veicolo già in uso")
    # If changing plate, ensure new one isn't used
    if vehicle_data.plate != vehicle.plate and await getVehicleByPlate(session, vehicle_data.plate):
        raise HTTPException(status_code=400, detail="Nuova plate già in uso")

    for key, value in vehicle_data.dict().items():
        setattr(vehicle, key, value)

    await session.commit()
    await session.refresh(vehicle)
    return vehicle

async def searchVehicles(session: AsyncSession, filters: dict):
    """
    Search vehicles by optional criteria:
      - vehicle_id, company_vehicle (ILIKE)
      - exact match on vehicle_total_km and request_vehicle_km flag
      - plate (ILIKE)
    Returns a list of matching Vehicle instances.
    """
    query = select(Vehicle)
    if filters.get('vehicle_id'):
        query = query.where(Vehicle.vehicle_id.ilike(f"%{filters['vehicle_id']}%"))
    if filters.get('company_vehicle'):
        query = query.where(Vehicle.company_vehicle.ilike(f"%{filters['company_vehicle']}%"))
    if filters.get('vehicle_total_km') is not None:
        query = query.where(Vehicle.vehicle_total_km == filters['vehicle_total_km'])
    if filters.get('plate'):
        query = query.where(Vehicle.plate.ilike(f"%{filters['plate']}%"))
    if filters.get('request_vehicle_km') is not None:
        query = query.where(Vehicle.request_vehicle_km == filters['request_vehicle_km'])
    result = await session.execute(query)
    return result.scalars().all()

