from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class ErogazioneBase(BaseModel):
    tessera: str
    nome_compagnia: str
    nome_autista: str
    id_veicolo: Optional[int] = None
    nome_compagnia_veicolo: Optional[str] = None
    km_totali_veicolo: Optional[float] = None
    litri_erogati: float
    prodotto_erogato: str
    timestamp_erogazione: datetime

class ErogazioneCreate(ErogazioneBase):
    pass

class Erogazione(ErogazioneBase):
    class Config:
        orm_mode = True

