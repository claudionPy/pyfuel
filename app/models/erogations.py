from sqlalchemy import Column, Integer, String, Float, DateTime
from app.database import Base
from datetime import datetime, timezone

class Erogation(Base):
    __tablename__ = "erogations"
    id = Column(Integer, primary_key=True, autoincrement=True)
    card = Column(String, nullable=True)
    company = Column(String, nullable=True)
    driver_full_name = Column(String, nullable=True)
    vehicle_id = Column(String, nullable=True)
    company_vehicle = Column(String, nullable=True)
    vehicle_total_km = Column(String, nullable=True)
    erogation_side = Column(Integer, nullable=False)
    dispensed_liters = Column(Float, nullable=True)
    dispensed_product = Column(String, nullable=True)
    erogation_timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    mode = Column(String, nullable=False)
    total_erogation_price = Column(Float, nullable=True)
