from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_session
from app.schemas import drivers as autisti_schemas, veichles as veicoli_schemas, erogations as erogazioni_schemas
from app.crud import drivers as autisti_crud, veichles as veicoli_crud, erogations as erogazioni_crud

router = APIRouter()

# Endpoint per creare un nuovo autista
@router.post("/autisti/", response_model=autisti_schemas.Autista)
async def create_autista(autista: autisti_schemas.AutistaCreate, session: AsyncSession = Depends(get_session)):
    new_autista = await autisti_crud.create_autista(session, autista)
    return new_autista

# Endpoint per creare un nuovo veicolo
@router.post("/veicoli/", response_model=veicoli_schemas.Veicolo)
async def create_veicolo(veicolo: veicoli_schemas.VeicoloCreate, session: AsyncSession = Depends(get_session)):
    new_veicolo = await veicoli_crud.create_veicolo(session, veicolo)
    return new_veicolo

# Endpoint per registrare una nuova erogazione
@router.post("/erogazioni/", response_model=erogazioni_schemas.Erogazione)
async def create_erogazione(erogazione: erogazioni_schemas.ErogazioneCreate, session: AsyncSession = Depends(get_session)):
    new_erogazione = await erogazioni_crud.create_erogazione(session, erogazione)
    return new_erogazione

