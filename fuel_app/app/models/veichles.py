from sqlalchemy import Column, Integer, String, Boolean, Float
from app.database import Base

class Veicolo(Base):
    __tablename__ = "veicoli"
    id_veicolo = Column(Integer, primary_key=True, index=True)
    nome_compagnia = Column(String)
    richiedi_km_veicolo = Column(Boolean)
    km_totali_veicolo = Column(Float)
    targa = Column(String, unique=True, nullable=False)

