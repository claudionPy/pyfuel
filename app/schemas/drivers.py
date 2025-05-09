from pydantic import BaseModel
from typing import Optional

class DriverBase(BaseModel):
    card: str
    company: str
    driver_full_name: str
    request_pin: bool
    request_vehicle_id: bool
    pin: Optional[str] = None

class DriverCreate(DriverBase):
    pass

class Driver(DriverBase):
    class Config:
        from_attributes = True

