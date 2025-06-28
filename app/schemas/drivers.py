# drivers.py
# Pydantic schemas for Driver API requests and responses.

from pydantic import BaseModel
from typing import Optional

class DriverBase(BaseModel):
    """
    Shared fields for creating or returning a driver.
    
    Attributes:
      - card: RFID card string (primary key)
      - company: associated company name
      - driver_full_name: full name of the driver
      - request_pin: True if PIN is required
      - request_vehicle_id: True if vehicle selection required
      - pin: optional PIN code (only if request_pin=True)
    """
    card: str
    company: str
    driver_full_name: str
    request_pin: bool
    request_vehicle_id: bool
    pin: Optional[str] = None

class DriverCreate(DriverBase):
    """Schema for driver‐creation requests; identical to DriverBase."""
    pass

class Driver(DriverBase):
    """
    Schema for driver data returned by the API.
    Uses `from_attributes=True` to read ORM model attributes directly.
    """
    class Config:
        from_attributes = True

