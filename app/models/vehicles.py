# vehicles.py
# ORM model for the "vehicles" table, representing fleet vehicles.

from sqlalchemy import Column, String, Boolean
from app.database import Base

class Vehicle(Base):
    """
    Represents a vehicle eligible for dispensing fuel.
    
    Attributes:
      - vehicle_id: primary key, unique identifier
      - plate: license plate, must be unique
      - company_vehicle: affiliated company name (nullable)
      - vehicle_total_km: latest odometer reading as string (default "0")
      - request_vehicle_km: if True, prompt operator for km entry on auth
    """
    __tablename__ = "vehicles"

    vehicle_id = Column(String, primary_key=True, index=True)
    plate = Column(String, unique=True, nullable=False)
    company_vehicle = Column(String, nullable=True)
    vehicle_total_km = Column(String, default="0", nullable=False)
    request_vehicle_km = Column(Boolean, default=False, nullable=False)

