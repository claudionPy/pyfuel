from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from app.database import Base
from datetime import datetime, timezone

class Erogazione(Base):
    __tablename__ = "erogazioni"
    id = Column(Integer, primary_key=True, autoincrement=True)
    tessera = Column(String, nullable=True)
    nome_compagnia = Column(String, nullable=True)
    nome_autista = Column(String, nullable=True)
    id_veicolo = Column(String, nullable=True)
    nome_compagnia_veicolo = Column(String, nullable=True)
    km_totali_veicolo = Column(String, nullable=True)
    lato_erogazione = Column(Integer, nullable=False)
    litri_erogati = Column(Float, nullable=True)
    prodotto_erogato = Column(String, nullable=True)
    timestamp_erogazione = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    modalita_erogazione = Column(String, nullable=False)
    prezzo_totale_erogazione = Column(Float, nullable=True)
