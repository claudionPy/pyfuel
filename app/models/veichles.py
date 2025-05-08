from sqlalchemy import Column, String, Boolean
from app.database import Base

class Vehicle(Base):
    __tablename__ = "vehicles"
    vehicle_id = Column(String, primary_key=True)
    company_vehicle = Column(String)
    request_vehicle_km = Column(Boolean)
    vehicle_total_km = Column(String)
    plate = Column(String, unique=True, nullable=False)

