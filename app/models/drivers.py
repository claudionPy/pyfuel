from sqlalchemy import Column, String, Boolean
from app.database import Base

class Driver(Base):
    __tablename__ = "drivers"
    card = Column(String, primary_key=True, index=True)
    company = Column(String)
    driver_full_name = Column(String)
    request_pin = Column(Boolean)
    request_vehicle_id = Column(Boolean)
    pin = Column(String)

