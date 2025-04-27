from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from datetime import datetime

from app.database import get_session
from app.schemas import (
    drivers as autisti_schemas,
    veichles as veicoli_schemas,
    erogations as erogazioni_schemas,
)
from app.schemas.pagination import Paginated
from app.crud import (
    drivers as autisti_crud,
    veichles as veicoli_crud,
    erogations as erogazioni_crud,
)
from app.models.drivers import Autista
from app.models.veichles import Veicolo
from app.models.erogations import Erogazione

router = APIRouter()

# ——— AUTISTI ———

@router.post("/autisti/", response_model=autisti_schemas.Autista)
async def create_autista(
    autista: autisti_schemas.AutistaCreate,
    session: AsyncSession = Depends(get_session),
):
    return await autisti_crud.create_autista(session, autista)

@router.get(
    "/autisti/",
    response_model=Paginated[autisti_schemas.Autista],
)
async def list_autisti(
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
):
    skip = (page - 1) * limit
    total = await session.scalar(select(func.count()).select_from(Autista))
    result = await session.execute(
        select(Autista).offset(skip).limit(limit)
    )
    items = result.scalars().all()
    return Paginated(total=total, page=page, limit=limit, items=items)

@router.get("/autisti/{tessera}", response_model=autisti_schemas.Autista)
async def get_autista_by_tessera(
    tessera: str,
    session: AsyncSession = Depends(get_session),
):
    autista = await autisti_crud.get_autista(session, tessera)
    if not autista:
        raise HTTPException(status_code=404, detail="Autista non trovato")
    return autista

@router.put("/autisti/{tessera}", response_model=autisti_schemas.Autista)
async def update_autista(
    tessera: str,
    autista: autisti_schemas.Autista,
    session: AsyncSession = Depends(get_session),
):
    return await autisti_crud.update_autista(session, tessera, autista)

@router.delete(
    "/autisti/{tessera}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    responses={404: {"description": "Autista non trovato"}},
)
async def delete_driver(
    tessera: str,
    session: AsyncSession = Depends(get_session),
) -> None:
    deleted = await autisti_crud.delete_autista_by_tessera(session, tessera)
    if not deleted:
        raise HTTPException(status_code=404, detail="Autista non trovato")
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@router.get(
    "/autisti/search/",
    response_model=Paginated[autisti_schemas.Autista],
)
async def search_autisti(
    tessera: Optional[str] = Query(None),
    nome_compagnia: Optional[str] = Query(None),
    nome_autista: Optional[str] = Query(None),
    richiedi_pin: Optional[bool] = Query(None),
    richiedi_id_veicolo: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
):
    filters = {
        "tessera": tessera,
        "nome_compagnia": nome_compagnia,
        "nome_autista": nome_autista,
        "richiedi_pin": richiedi_pin,
        "richiedi_id_veicolo": richiedi_id_veicolo,
    }
    query = select(Autista)
    for attr, val in filters.items():
        if val is None:
            continue
        column = getattr(Autista, attr)
        if isinstance(val, bool):
            query = query.where(column == val)
        else:
            query = query.where(column.ilike(f"%{val}%"))

    total = await session.scalar(select(func.count()).select_from(query.subquery()))
    skip = (page - 1) * limit
    result = await session.execute(query.offset(skip).limit(limit))
    items = result.scalars().all()
    return Paginated(total=total, page=page, limit=limit, items=items)


# ——— VEICOLI ———

@router.post("/veicoli/", response_model=veicoli_schemas.Veicolo)
async def create_veicolo(
    veicolo: veicoli_schemas.VeicoloCreate,
    session: AsyncSession = Depends(get_session),
):
    return await veicoli_crud.create_veicolo(session, veicolo)

@router.get(
    "/veicoli/",
    response_model=Paginated[veicoli_schemas.Veicolo],
)
async def list_veicoli(
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
):
    skip = (page - 1) * limit
    total = await session.scalar(select(func.count()).select_from(Veicolo))
    result = await session.execute(select(Veicolo).offset(skip).limit(limit))
    items = result.scalars().all()
    return Paginated(total=total, page=page, limit=limit, items=items)

@router.get("/veicoli/{id_veicolo}", response_model=veicoli_schemas.Veicolo)
async def get_veicolo(
    id_veicolo: str,
    session: AsyncSession = Depends(get_session),
):
    veicolo = await veicoli_crud.get_veicolo_by_id(session, id_veicolo)
    if not veicolo:
        raise HTTPException(status_code=404, detail="Veicolo non trovato")
    return veicolo

@router.get("/veicoli/targa/{targa}", response_model=veicoli_schemas.Veicolo)
async def get_veicolo_by_targa(
    targa: str,
    session: AsyncSession = Depends(get_session),
):
    veicolo = await veicoli_crud.get_veicolo_by_targa(session, targa)
    if not veicolo:
        raise HTTPException(status_code=404, detail="Veicolo non trovato")
    return veicolo

@router.put("/veicoli/{id_veicolo}", response_model=veicoli_schemas.Veicolo)
async def update_veicolo(
    id_veicolo: str,
    veicolo: veicoli_schemas.Veicolo,
    session: AsyncSession = Depends(get_session),
):
    return await veicoli_crud.update_veicolo(session, id_veicolo, veicolo)

@router.delete(
    "/veicoli/{id_veicolo}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    responses={404: {"description": "Veicolo non trovato"}},
)
async def delete_vehicle(
    id_veicolo: str,
    session: AsyncSession = Depends(get_session),
) -> None:
    deleted = await veicoli_crud.delete_veicolo_by_id(session, id_veicolo)
    if not deleted:
        raise HTTPException(status_code=404, detail="Veicolo non trovato")
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@router.get(
    "/veicoli/search/",
    response_model=Paginated[veicoli_schemas.Veicolo],
)
async def search_veicoli(
    id_veicolo: Optional[str] = Query(None),
    nome_compagnia: Optional[str] = Query(None),
    km_totali_veicolo: Optional[str] = Query(None),
    targa: Optional[str] = Query(None),
    richiedi_km_veicolo: Optional[bool] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
):
    filters = {
        "id_veicolo": id_veicolo,
        "nome_compagnia": nome_compagnia,
        "km_totali_veicolo": km_totali_veicolo,
        "targa": targa,
        "richiedi_km_veicolo": richiedi_km_veicolo,
    }
    query = select(Veicolo)
    for attr, val in filters.items():
        if val is None:
            continue
        column = getattr(Veicolo, attr)
        if isinstance(val, (bool, int, float)):
            query = query.where(column == val)
        else:
            query = query.where(column.ilike(f"%{val}%"))
    total = await session.scalar(select(func.count()).select_from(query.subquery()))
    skip = (page - 1) * limit
    result = await session.execute(query.offset(skip).limit(limit))
    items = result.scalars().all()
    return Paginated(total=total, page=page, limit=limit, items=items)


# ——— EROGAZIONI ———

@router.post("/erogazioni/", response_model=erogazioni_schemas.Erogazione)
async def create_erogazione(
    erogazione: erogazioni_schemas.ErogazioneCreate,
    session: AsyncSession = Depends(get_session),
):
    return await erogazioni_crud.create_erogazione(session, erogazione)

@router.get(
    "/erogazioni/",
    response_model=Paginated[erogazioni_schemas.Erogazione],
)
async def list_erogazioni(
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
):
    skip = (page - 1) * limit
    total = await session.scalar(select(func.count()).select_from(Erogazione))
    stmt = (
        select(Erogazione)
        .order_by(Erogazione.timestamp_erogazione.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await session.execute(stmt)
    items = result.scalars().all()
    return Paginated(total=total, page=page, limit=limit, items=items)

@router.get(
    "/erogazioni/search/",
    response_model=Paginated[erogazioni_schemas.Erogazione],
)
async def search_erogazioni(
    tessera: Optional[str]            = Query(None),
    id_veicolo: Optional[int]         = Query(None),
    nome_compagnia: Optional[str]     = Query(None),
    lato_erogazione: Optional[int]    = Query(None),
    modalita_erogazione: Optional[str]= Query(None),
    prodotto_erogato: Optional[str]   = Query(None),
    km_totali_veicolo: Optional[str]  = Query(None),
    litri_erogati: Optional[float]    = Query(None),
    start_time: Optional[datetime]    = Query(
        None,
        alias="start_time",
        description="Start time in ISO-8601 format, e.g. 2025-04-26T10:50"
    ),
    end_time: Optional[datetime]      = Query(
        None,
        alias="end_time",
        description="End time in ISO-8601 format, e.g. 2025-04-26T10:52"
    ),
    page: int                         = Query(1, ge=1),
    limit: int                        = Query(25, ge=1, le=100),
    session: AsyncSession             = Depends(get_session),
):
    # Build the base query
    query = select(Erogazione)

    # Apply simple filters
    filters = {
        "tessera": tessera,
        "id_veicolo": id_veicolo,
        "nome_compagnia": nome_compagnia,
        "lato_erogazione": lato_erogazione,
        "modalita_erogazione": modalita_erogazione,
        "prodotto_erogato": prodotto_erogato,
        "km_totali_veicolo": km_totali_veicolo,
        "litri_erogati": litri_erogati,
    }
    for attr, val in filters.items():
        if val is None:
            continue
        column = getattr(Erogazione, attr)
        if isinstance(val, (int, float)):
            query = query.where(column == val)
        else:
            query = query.where(column.ilike(f"%{val}%"))

    # Apply datetime filters (now true datetime objects)
    if start_time:
        query = query.where(Erogazione.timestamp_erogazione >= start_time)
    if end_time:
        query = query.where(Erogazione.timestamp_erogazione <= end_time)

    # Order and paginate
    query = query.order_by(Erogazione.timestamp_erogazione.desc())
    total = await session.scalar(select(func.count()).select_from(query.subquery()))
    skip = (page - 1) * limit
    stmt = query.offset(skip).limit(limit)
    result = await session.execute(stmt)
    items = result.scalars().all()

    return Paginated(total=total, page=page, limit=limit, items=items)

@router.delete(
    "/erogazioni/",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    responses={404: {"description": "Nessuna erogazione trovata"}},
)
async def delete_erogations(
    session: AsyncSession = Depends(get_session),
) -> None:
    deleted = await erogazioni_crud.delete_erogazioni(session)
    if not deleted:
        raise HTTPException(status_code=404, detail="Nessuna erogazione trovata")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
