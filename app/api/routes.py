from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_session
from app.schemas import drivers as autisti_schemas, veichles as veicoli_schemas, erogations as erogazioni_schemas
from app.crud import drivers as autisti_crud, veichles as veicoli_crud, erogations as erogazioni_crud
from typing import List, Optional, Any

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

@router.get("/autisti/", response_model=List[autisti_schemas.Autista])
async def get_autisti_all(session: AsyncSession = Depends(get_session)):
    autisti = await autisti_crud.get_autisti_all(session)
    if not autisti:
        raise HTTPException(status_code=404, detail="Nessun autista trovato")
    return autisti

@router.get("/veicoli/", response_model=List[veicoli_schemas.Veicolo])
async def get_veicoli_all(session: AsyncSession = Depends(get_session)):
    # Ottieni tutte le erogazioni senza filtri
    veicoli = await veicoli_crud.get_veicoli_all(session)
    if not veicoli:
        raise HTTPException(status_code=404, detail="Nessuna veicolo trovato")
    return veicoli
# Endpoint per ottenere un autista tramite tessera
@router.get("/autisti/{tessera}", response_model=autisti_schemas.Autista)
async def get_autista_by_tessera(tessera: str, session: AsyncSession = Depends(get_session)):
    autista = await autisti_crud.get_autista(session, tessera)
    if not autista:
        raise HTTPException(status_code=404, detail="Autista non trovato")
    return autista

# Endpoint per ottenere un veicolo tramite targa
@router.get("/veicoli/targa/{targa}", response_model=veicoli_schemas.Veicolo)
async def get_veicolo_by_targa(targa: str, session: AsyncSession = Depends(get_session)):
    veicolo = await veicoli_crud.get_veicolo_by_targa(session, targa)
    if not veicolo:
        raise HTTPException(status_code=404, detail="Veicolo non trovato")
    return veicolo

    # Endpoint per ottenere un veicolo tramite ID
@router.get("/veicoli/{id_veicolo}", response_model=veicoli_schemas.Veicolo)
async def get_veicolo(id_veicolo: int, session: AsyncSession = Depends(get_session)):
    veicolo = await veicoli_crud.get_veicolo_by_id(session, id_veicolo)
    if not veicolo:
        raise HTTPException(status_code=404, detail="Veicolo non trovato")
    return veicolo

# Endpoint per ottenere una lista di erogazioni filtrate per tessera o veicolo
@router.get("/erogazioni/", response_model=List[erogazioni_schemas.Erogazione])
async def get_erogazioni(session: AsyncSession = Depends(get_session)):
    # Ottieni tutte le erogazioni senza filtri
    erogazioni = await erogazioni_crud.get_erogazioni(session)
    if not erogazioni:
        raise HTTPException(status_code=404, detail="Nessuna erogazione trovata")
    return erogazioni

@router.delete(
    "/veicoli/{id_veicolo}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    responses={404: {"description": "Veicolo non trovato"}}
)
async def delete_vehicle(
    id_veicolo: int,
    session: AsyncSession = Depends(get_session)
) -> Any:
    deleted = await veicoli_crud.delete_veicolo_by_id(session, id_veicolo)
    if not deleted:
        raise HTTPException(status_code=404, detail="Veicolo non trovato")

@router.delete(
    "/autisti/{tessera}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    responses={404: {"description": "Autista non trovato"}}
)
async def delete_driver(
    tessera: str,
    session: AsyncSession = Depends(get_session)
) -> Any:
    deleted = await autisti_crud.delete_autista_by_tessera(session, tessera)
    if not deleted:
        raise HTTPException(status_code=404, detail="Autista non trovato")

@router.delete(
    "/erogazioni/",
    status_code=status.HTTP_204_NO_CONTENT, 
    response_model=None,
    responses={404: {"description": "Nessuna erogazione trovata"}}
)
async def delete_erogations(session: AsyncSession = Depends(get_session)):
    deleted = await erogazioni_crud.delete_erogazioni(session)
    if not deleted:
        raise HTTPException(status_code=404, detail="Nessun erogazione trovata")

# Endpoint per aggiornare un autista
@router.put("/autisti/{tessera}", response_model=autisti_schemas.Autista)
async def update_autista(
    tessera: str, 
    autista: autisti_schemas.Autista, 
    session: AsyncSession = Depends(get_session)
):
    updated_autista = await autisti_crud.update_autista(session, tessera, autista)
    return updated_autista

# Endpoint per aggiornare un veicolo
@router.put("/veicoli/{id_veicolo}", response_model=veicoli_schemas.Veicolo)
async def update_veicolo(
    id_veicolo: int, 
    veicolo: veicoli_schemas.Veicolo, 
    session: AsyncSession = Depends(get_session)
):
    updated_veicolo = await veicoli_crud.update_veicolo(session, id_veicolo, veicolo)
    return updated_veicolo

@router.get("/autisti/search/", response_model=List[autisti_schemas.Autista])
async def search_autisti(
    tessera: Optional[str] = Query(None),
    nome_compagnia: Optional[str] = Query(None),
    nome_autista: Optional[str] = Query(None),
    richiedi_pin: Optional[bool] = Query(None),
    richiedi_id_veicolo: Optional[bool] = Query(None),
    session: AsyncSession = Depends(get_session)
):
    filters = {
        'tessera': tessera,
        'nome_compagnia': nome_compagnia,
        'nome_autista': nome_autista,
        'richiedi_pin': richiedi_pin,
        'richiedi_id_veicolo': richiedi_id_veicolo
    }
    autisti = await autisti_crud.search_autisti(session, filters)
    if not autisti:
        raise HTTPException(status_code=404, detail="Nessun autista trovato")
    return autisti

@router.get("/veicoli/search/", response_model=List[veicoli_schemas.Veicolo])
async def search_veicoli(
    id_veicolo: Optional[int] = Query(None),
    nome_compagnia: Optional[str] = Query(None),
    targa: Optional[str] = Query(None),
    richiedi_km_veicolo: Optional[bool] = Query(None),
    session: AsyncSession = Depends(get_session)
):
    filters = {
        'id_veicolo': id_veicolo,
        'nome_compagnia': nome_compagnia,
        'targa': targa,
        'richiedi_km_veicolo': richiedi_km_veicolo
    }
    veicoli = await veicoli_crud.search_veicoli(session, filters)
    if not veicoli:
        raise HTTPException(status_code=404, detail="Nessun veicolo trovato")
    return veicoli

@router.get("/erogazioni/search/", response_model=List[erogazioni_schemas.Erogazione])
async def search_erogazioni(
    tessera: Optional[str] = Query(None),
    id_veicolo: Optional[int] = Query(None),
    nome_compagnia: Optional[str] = Query(None),
    lato_erogazione: Optional[str] = Query(None),
    modalita_erogazione: Optional[str] = Query(None),
    prodotto_erogato: Optional[str] = Query(None),
    km_totali_veicolo: Optional[float] = Query(None),
    litri_erogati: Optional[float]      = Query(None),
    session: AsyncSession = Depends(get_session)
):
    filters = {
        'tessera': tessera,
        'id_veicolo': id_veicolo,
        'nome_compagnia': nome_compagnia,
        'lato_erogazione': lato_erogazione,
        'modalita_erogazione': modalita_erogazione,
        'prodotto_erogato': prodotto_erogato,
        'km_totali_veicolo': km_totali_veicolo,
        'litri_erogati': litri_erogati
    }
    erogazioni = await erogazioni_crud.search_erogazioni(session, filters)
    if not erogazioni:
        raise HTTPException(status_code=404, detail="Nessuna erogazione trovata")
    return erogazioni
    return erogazioni


