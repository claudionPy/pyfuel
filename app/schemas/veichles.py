from pydantic import BaseModel

class VeicoloBase(BaseModel):
    id_veicolo: str
    nome_compagnia: str
    richiedi_km_veicolo: bool
    km_totali_veicolo: str
    targa: str

class VeicoloCreate(VeicoloBase):
    pass

class Veicolo(VeicoloBase):
    class Config:
        from_attributes = True

