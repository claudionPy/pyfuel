# erogations.py
# ORM model for the "erogations" table, logging each fueling transaction.

from sqlalchemy import Column, Integer, String, Numeric, DateTime
from sqlalchemy.sql import func
from app.database import Base

class Erogation(Base):
    """
    Represents a single fuel dispense record.
    
    Attributes:
      - id: primary key, unique identifier for each transaction
      - card: RFID card used (nullable for manual mode)
      - company: driver’s company (nullable)
      - driver_full_name: full name of the driver (nullable)
      - vehicle_id: vehicle identifier (nullable)
      - company_vehicle: vehicle’s company (nullable)
      - vehicle_total_km: odometer at dispense time (nullable)
      - erogation_side: pump side number (1 or 2)
      - dispensed_liters: volume dispensed, two-decimal precision
      - dispensed_product: type of fuel/product dispensed
      - erogation_timestamp: UTC timestamp, defaults to now()
      - mode: 'automatica' or 'manuale'
      - total_erogation_price: formatted string price charged
    """
    __tablename__ = "erogations"

    id = Column(Integer, primary_key=True, index=True)
    card = Column(String, nullable=True)
    company = Column(String, nullable=True)
    driver_full_name = Column(String, nullable=True)
    vehicle_id = Column(String, nullable=True)
    company_vehicle = Column(String, nullable=True)
    vehicle_total_km = Column(String, nullable=True)
    erogation_side = Column(Integer, nullable=False)
    dispensed_liters = Column(Numeric(10, 2), nullable=False)
    dispensed_product = Column(String, nullable=False)
    erogation_timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    mode = Column(String, nullable=False)
    total_erogation_price = Column(String, nullable=False)

