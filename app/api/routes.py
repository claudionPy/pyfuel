from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
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

router = APIRouter()
cfg_mgr = ConfigManager(config_path="config/config.json")

@router.post("/drivers/", response_model=drivers_schemas.Driver)
async def createDriver(
    driver: drivers_schemas.DriverCreate,
    session: AsyncSession = Depends(get_session),
):
    return await drivers_crud.createDriver(session, driver)

@router.get(
    "/drivers/",
    response_model=Paginated[drivers_schemas.Driver],
)
async def listDrivers(
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
):
    skip = (page - 1) * limit
    total = await session.scalar(select(func.count()).select_from(Driver))
    result = await session.execute(
        select(Driver).offset(skip).limit(limit)
    )
    items = result.scalars().all()
    return Paginated(total=total, page=page, limit=limit, items=items)

@router.get("/drivers/{card}", response_model=drivers_schemas.Driver)
async def getDriverByCard(
    card: str,
    session: AsyncSession = Depends(get_session),
):
    driver = await drivers_crud.getDriverByCard(session, card)
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    return driver

@router.put("/drivers/{card}", response_model=drivers_schemas.Driver)
async def updateDriver(
    card: str,
    driver: drivers_schemas.Driver,
    session: AsyncSession = Depends(get_session),
):
    return await drivers_crud.updateDriver(session, card, driver)

@router.delete(
    "/drivers/{card}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    responses={404: {"description": "Driver not found"}},
)
async def deleteDriver(
    card: str,
    session: AsyncSession = Depends(get_session)) -> None:
    deleted = await drivers_crud.deleteDriverByCard(session, card)
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

@router.post("/vehicles/", response_model=vehicles_schemas.Vehicle)
async def createVehicle(
    vehicle: vehicles_schemas.VehicleCreate,
    session: AsyncSession = Depends(get_session),
):
    return await vehicles_crud.createVehicle(session, vehicle)

@router.get(
    "/vehicles/",
    response_model=Paginated[vehicles_schemas.Vehicle],
)
async def listVehicles(
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
):
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
    vehicle = await vehicles_crud.getVehicleById(session, vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return vehicle

@router.get("/vehicles/plate/{plate}", response_model=vehicles_schemas.Vehicle)
async def getVehicleByPlate(
    plate: str,
    session: AsyncSession = Depends(get_session),
):
    vehicle = await vehicles_crud.getVehicleByPlate(session, plate)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return vehicle

@router.put("/vehicles/{vehicle_id}", response_model=vehicles_schemas.Vehicle)
async def updateVehicle(
    vehicle_id: str,
    vehicle: vehicles_schemas.Vehicle,
    session: AsyncSession = Depends(get_session),
):
    return await vehicles_crud.updateVehicle(session, vehicle_id, vehicle)

@router.delete(
    "/vehicles/{vehicle_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    responses={404: {"description": "Vehicle not found"}},
)
async def deleteVehicle(
    vehicle_id: str,
    session: AsyncSession = Depends(get_session),
) -> None:
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
        if isinstance(val, (bool, int, float)):
            query = query.where(column == val)
        else:
            query = query.where(column.ilike(f"%{val}%"))
    total = await session.scalar(select(func.count()).select_from(query.subquery()))
    skip = (page - 1) * limit
    result = await session.execute(query.offset(skip).limit(limit))
    items = result.scalars().all()
    return Paginated(total=total, page=page, limit=limit, items=items)

@router.post("/erogations/", response_model=erogations_schemas.Erogation)
async def createErogation(
    erogation: erogations_schemas.ErogationCreate,
    session: AsyncSession = Depends(get_session),
):
    return await erogations_crud.createErogation(session, erogation)

@router.get(
    "/erogations/",
    response_model=Paginated[erogations_schemas.Erogation],
)
async def listErogations(
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
):
    skip = (page - 1) * limit
    total = await session.scalar(select(func.count()).select_from(Erogation))
    stmt = (
        select(Erogation)
        .order_by(Erogation.erogation_timestamp.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await session.execute(stmt)
    items = result.scalars().all()
    return Paginated(total=total, page=page, limit=limit, items=items)

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
    start_time: Optional[datetime] = Query(
        None,
        alias="start_time",
        description="Start time in ISO-8601 format, e.g. 2025-04-26T10:50"
    ),
    end_time: Optional[datetime] = Query(
        None,
        alias="end_time",
        description="End time in ISO-8601 format, e.g. 2025-04-26T10:52"
    ),
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
):
    query = select(Erogation)

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

    query = query.order_by(Erogation.erogation_timestamp.desc())
    total = await session.scalar(select(func.count()).select_from(query.subquery()))
    skip = (page - 1) * limit
    stmt = query.offset(skip).limit(limit)
    result = await session.execute(stmt)
    items = result.scalars().all()

    return Paginated(total=total, page=page, limit=limit, items=items)

@router.delete(
    "/erogations/",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    responses={404: {"description": "No erogations found"}},
)
async def deleteErogations(
    session: AsyncSession = Depends(get_session),
) -> None:
    deleted = await erogations_crud.deleteErogations(session)
    if not deleted:
        raise HTTPException(status_code=404, detail="No erogations found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@router.get("/parameters/", response_model=FullConfigSchema)
def readParameters():
    return cfg_mgr.load_config()

@router.put("/parameters/", response_model=FullConfigSchema)
def updateParameters(new_cfg: FullConfigSchema):
    if not cfg_mgr.save_config(new_cfg.model_dump()):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save configuration"
        )
    return cfg_mgr.current_config

@router.post("/parameters/reset", status_code=status.HTTP_204_NO_CONTENT)
def resetParameters():
    cfg_mgr.save_config(cfg_mgr.default_config)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
