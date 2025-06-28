# routes.py
# Defines all JSON API endpoints for the pyfuel application.
# Mounted under the "/api" prefix in main.py.
# Provides CRUD and search operations for drivers, vehicles, erogations,
# and configuration parameters.

from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from datetime import datetime

from app.database import get_session
from app.schemas import (
    drivers as drivers_schemas,
    vehicles as vehicles_schemas,
    erogations as erogations_schemas,
)
from app.schemas.pagination import Paginated
from app.crud import (
    drivers as drivers_crud,
    vehicles as vehicles_crud,
    erogations as erogations_crud,
)
from app.models.drivers import Driver
from app.models.vehicles import Vehicle
from app.models.erogations import Erogation
from config.loader import ConfigManager
from app.schemas.config import FullConfigSchema

# Instantiate router; all paths here will be prefixed with /api
router = APIRouter(
    prefix="/api",
    tags=["drivers", "vehicles", "erogations", "parameters"]
)

# Configuration manager for station parameters
cfg_mgr = ConfigManager(config_path="src/config/config.json")


#
# DRIVER ENDPOINTS
#

@router.post("/drivers/", response_model=drivers_schemas.Driver)
async def createDriver(
    driver: drivers_schemas.DriverCreate,
    session: AsyncSession = Depends(get_session),
):
    """
    Create a new driver.
    - Expects a DriverCreate payload.
    - Returns the created Driver.
    """
    return await drivers_crud.createDriver(session, driver)


@router.get("/drivers/", response_model=Paginated[drivers_schemas.Driver])
async def listDrivers(
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
):
    """
    List drivers with pagination.
    - page: which page to return (1-based)
    - limit: items per page (max 100)
    """
    skip = (page - 1) * limit
    total = await session.scalar(select(func.count()).select_from(Driver))
    result = await session.execute(select(Driver).offset(skip).limit(limit))
    items = result.scalars().all()
    return Paginated(total=total, page=page, limit=limit, items=items)


@router.get("/drivers/{card}", response_model=drivers_schemas.Driver)
async def getDriverByCard(
    card: str,
    session: AsyncSession = Depends(get_session),
):
    """
    Retrieve a driver by RFID card ID.
    - card: the RFID string
    - Returns 404 if not found.
    """
    driver = await drivers_crud.getDriverByCard(session, card)
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    return driver


@router.put("/drivers/{card}", response_model=drivers_schemas.Driver)
async def updateDriver(
    card: str,
    driver_update: drivers_schemas.DriverCreate,
    session: AsyncSession = Depends(get_session),
):
    """
    Update an existing driver’s data.
    - card: the RFID to identify driver
    - Payload same as creation schema.
    """
    updated = await drivers_crud.updateDriver(session, card, driver_update)
    if not updated:
        raise HTTPException(status_code=404, detail="Driver not found")
    return updated


@router.delete(
    "/drivers/{card}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={404: {"description": "Driver not found"}},
)
async def deleteDriver(
    card: str,
    session: AsyncSession = Depends(get_session),
):
    """
    Delete a driver by RFID.
    - Returns 204 on success, 404 if no such driver.
    """
    deleted = await drivers_crud.deleteDriver(session, card)
    if not deleted:
        raise HTTPException(status_code=404, detail="Driver not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/drivers/search/",
    response_model=Paginated[drivers_schemas.Driver],
)
async def searchDrivers(
    card: Optional[str] = Query(None),
    company: Optional[str] = Query(None),
    driver_full_name: Optional[str] = Query(None),
    request_pin: Optional[bool] = Query(None),
    request_vehicle_id: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
):
    """
    Search drivers by optional filters:
      - card, company, driver_full_name, request_pin flag,
        request_vehicle_id flag.
    Supports pagination.
    """
    filters = {
        "card": card,
        "company": company,
        "driver_full_name": driver_full_name,
        "request_pin": request_pin,
        "request_vehicle_id": request_vehicle_id,
    }
    query = select(Driver)
    for attr, val in filters.items():
        if val is None:
            continue
        column = getattr(Driver, attr)
        if isinstance(val, bool):
            query = query.where(column == val)
        else:
            query = query.where(column.ilike(f"%{val}%"))
    total = await session.scalar(select(func.count()).select_from(query.subquery()))
    skip = (page - 1) * limit
    result = await session.execute(query.offset(skip).limit(limit))
    items = result.scalars().all()
    return Paginated(total=total, page=page, limit=limit, items=items)


#
# VEHICLE ENDPOINTS
#

@router.post("/vehicles/", response_model=vehicles_schemas.Vehicle)
async def createVehicle(
    vehicle: vehicles_schemas.VehicleCreate,
    session: AsyncSession = Depends(get_session),
):
    """
    Create a new vehicle.
    - Expects a VehicleCreate payload.
    """
    return await vehicles_crud.createVehicle(session, vehicle)


@router.get("/vehicles/", response_model=Paginated[vehicles_schemas.Vehicle])
async def listVehicles(
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
):
    """
    List vehicles with pagination.
    """
    skip = (page - 1) * limit
    total = await session.scalar(select(func.count()).select_from(Vehicle))
    result = await session.execute(select(Vehicle).offset(skip).limit(limit))
    items = result.scalars().all()
    return Paginated(total=total, page=page, limit=limit, items=items)


@router.get("/vehicles/{vehicle_id}", response_model=vehicles_schemas.Vehicle)
async def getVehicleById(
    vehicle_id: str,
    session: AsyncSession = Depends(get_session),
):
    """
    Retrieve a vehicle by its ID.
    - Returns 404 if not found.
    """
    vehicle = await vehicles_crud.getVehicleById(session, vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return vehicle


@router.get("/vehicles/plate/{plate}", response_model=vehicles_schemas.Vehicle)
async def getVehicleByPlate(
    plate: str,
    session: AsyncSession = Depends(get_session),
):
    """
    Retrieve a vehicle by its license plate.
    """
    vehicle = await vehicles_crud.getVehicleByPlate(session, plate)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return vehicle


@router.put("/vehicles/{vehicle_id}", response_model=vehicles_schemas.Vehicle)
async def updateVehicle(
    vehicle_id: str,
    vehicle_update: vehicles_schemas.VehicleCreate,
    session: AsyncSession = Depends(get_session),
):
    """
    Update an existing vehicle’s data.
    """
    updated = await vehicles_crud.updateVehicle(session, vehicle_id, vehicle_update)
    if not updated:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return updated


@router.delete(
    "/vehicles/{vehicle_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={404: {"description": "Vehicle not found"}},
)
async def deleteVehicle(
    vehicle_id: str,
    session: AsyncSession = Depends(get_session),
):
    """
    Delete a vehicle by ID.
    """
    deleted = await vehicles_crud.deleteVehicleById(session, vehicle_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/vehicles/search/",
    response_model=Paginated[vehicles_schemas.Vehicle],
)
async def searchVehicles(
    vehicle_id: Optional[str] = Query(None),
    company_vehicle: Optional[str] = Query(None),
    vehicle_total_km: Optional[str] = Query(None),
    plate: Optional[str] = Query(None),
    request_vehicle_km: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
):
    """
    Search vehicles by optional filters:
      - vehicle_id, company_vehicle, vehicle_total_km, plate,
        request_vehicle_km flag.
    """
    filters = {
        "vehicle_id": vehicle_id,
        "company_vehicle": company_vehicle,
        "vehicle_total_km": vehicle_total_km,
        "plate": plate,
        "request_vehicle_km": request_vehicle_km,
    }
    query = select(Vehicle)
    for attr, val in filters.items():
        if val is None:
            continue
        column = getattr(Vehicle, attr)
        if isinstance(val, bool):
            query = query.where(column == val)
        else:
            query = query.where(column.ilike(f"%{val}%"))
    total = await session.scalar(select(func.count()).select_from(query.subquery()))
    skip = (page - 1) * limit
    stmt = query.offset(skip).limit(limit)
    result = await session.execute(stmt)
    items = result.scalars().all()
    return Paginated(total=total, page=page, limit=limit, items=items)


#
# EROGATION ENDPOINTS
#

@router.post("/erogations/", response_model=erogations_schemas.Erogation)
async def createErogation(
    erogation: erogations_schemas.ErogationCreate,
    session: AsyncSession = Depends(get_session),
):
    """
    Record a new fuel dispense (erogation).
    """
    return await erogations_crud.createErogation(session, erogation)


@router.get("/erogations/", response_model=List[erogations_schemas.Erogation])
async def listErogations(
    session: AsyncSession = Depends(get_session),
):
    """
    List all erogations (no pagination).
    """
    result = await session.execute(select(Erogation))
    return result.scalars().all()


@router.get(
    "/erogations/search/",
    response_model=Paginated[erogations_schemas.Erogation],
)
async def searchErogazioni(
    card: Optional[str] = Query(None),
    vehicle_id: Optional[str] = Query(None),
    company: Optional[str] = Query(None),
    erogation_side: Optional[int] = Query(None),
    mode: Optional[str] = Query(None),
    dispensed_product: Optional[str] = Query(None),
    vehicle_total_km: Optional[str] = Query(None),
    dispensed_liters: Optional[float] = Query(None),
    start_time: Optional[datetime] = Query(None, alias="start_time"),
    end_time: Optional[datetime] = Query(None, alias="end_time"),
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
):
    """
    Search erogations by filters including time range.
    """
    filters = {
        "card": card,
        "vehicle_id": vehicle_id,
        "company": company,
        "erogation_side": erogation_side,
        "mode": mode,
        "dispensed_product": dispensed_product,
        "vehicle_total_km": vehicle_total_km,
        "dispensed_liters": dispensed_liters,
    }
    query = select(Erogation)
    for attr, val in filters.items():
        if val is None:
            continue
        column = getattr(Erogation, attr)
        if isinstance(val, (int, float)):
            query = query.where(column == val)
        else:
            query = query.where(column.ilike(f"%{val}%"))
    if start_time:
        query = query.where(Erogation.erogation_timestamp >= start_time)
    if end_time:
        query = query.where(Erogation.erogation_timestamp <= end_time)
    total = await session.scalar(select(func.count()).select_from(query.subquery()))
    skip = (page - 1) * limit
    stmt = query.offset(skip).limit(limit)
    result = await session.execute(stmt)
    items = result.scalars().all()
    return Paginated(total=total, page=page, limit=limit, items=items)


@router.get("/erogations/{erogation_id}", response_model=erogations_schemas.Erogation)
async def getErogationById(
    erogation_id: int,
    session: AsyncSession = Depends(get_session),
):
    """
    Retrieve a single erogation by its database ID.
    """
    er = await erogations_crud.getErogationById(session, erogation_id)
    if not er:
        raise HTTPException(status_code=404, detail="Erogation not found")
    return er


@router.delete(
    "/erogations/",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={404: {"description": "No erogations found"}},
)
async def deleteErogations(
    session: AsyncSession = Depends(get_session),
):
    """
    Delete all erogation records.
    - Returns 204 if any were deleted, 404 if none existed.
    """
    deleted = await erogations_crud.deleteErogations(session)
    if not deleted:
        raise HTTPException(status_code=404, detail="No erogations found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


#
# CONFIGURATION PARAMETERS ENDPOINTS
#

@router.get("/parameters/", response_model=FullConfigSchema)
def readParameters():
    """
    Return the full station configuration.
    """
    return cfg_mgr.load_config()


@router.put("/parameters/", response_model=FullConfigSchema)
def updateParameters(new_cfg: FullConfigSchema):
    """
    Overwrite station configuration with provided schema.
    """
    if not cfg_mgr.save_config(new_cfg.model_dump()):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save configuration"
        )
    return cfg_mgr.current_config


@router.post("/parameters/reset", status_code=status.HTTP_204_NO_CONTENT)
def resetParameters():
    """
    Reset station configuration to defaults.
    """
    cfg_mgr.save_config(cfg_mgr.default_config)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

