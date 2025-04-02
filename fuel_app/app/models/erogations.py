from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from app.database import Base
from sqlalchemy.sql import func
from datetime import datetime

class Erogazione(Base):
    __tablename__ = "erogazioni"
    id = Column(Integer, primary_key=True, autoincrement=True)
    tessera = Column(String, ForeignKey("autisti.tessera"))
    nome_compagnia = Column(String)
    nome_autista = Column(String)
    id_veicolo = Column(Integer, ForeignKey("veicoli.id_veicolo"), nullable=True)
    nome_compagnia_veicolo = Column(String, nullable=True)
    km_totali_veicolo = Column(Float, nullable=True)
    litri_erogati = Column(Float, nullable=True)
    prodotto_erogato = Column(String, nullable=True)
    timestamp_erogazione = Column(DateTime(timezone=True), default=lambda: datetime.now()
)

