from pydantic import BaseModel
from typing import Optional

class AutistaBase(BaseModel):
    tessera: str
    nome_compagnia: str
    nome_autista: str
    richiedi_pin: bool
    richiedi_id_veicolo: bool
    pin: Optional[str] = None

class AutistaCreate(AutistaBase):
    pass

class Autista(AutistaBase):
    class Config:
        orm_mode = True

