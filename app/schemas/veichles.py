from pydantic import BaseModel

class VeicoloBase(BaseModel):
    id_veicolo: int
    nome_compagnia: str
    richiedi_km_veicolo: bool
    km_totali_veicolo: float
    targa: str

class VeicoloCreate(VeicoloBase):
    pass

class Veicolo(VeicoloBase):
    class Config:
        from_attributes = True

