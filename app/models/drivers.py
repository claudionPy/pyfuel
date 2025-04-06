from sqlalchemy import Column, String, Boolean
from app.database import Base

class Autista(Base):
    __tablename__ = "autisti"
    tessera = Column(String, primary_key=True, index=True)
    nome_compagnia = Column(String)
    nome_autista = Column(String)
    richiedi_pin = Column(Boolean)
    richiedi_id_veicolo = Column(Boolean)
    pin = Column(String)

