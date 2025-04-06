from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class ErogazioneBase(BaseModel):
    tessera: Optional[str] = None
    nome_compagnia: Optional[str] = None
    nome_autista: Optional[str] = None
    id_veicolo: Optional[int] = None
    nome_compagnia_veicolo: Optional[str] = None
    km_totali_veicolo: Optional[float] = None
    litri_erogati: float
    prodotto_erogato: str
    timestamp_erogazione: datetime
    modalita_erogazione: str
    prezzo_totale_erogazione: Optional[float] = None

class ErogazioneCreate(ErogazioneBase):
    pass

class Erogazione(ErogazioneBase):
    class Config:
        from_attributes = True


