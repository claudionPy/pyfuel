from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class ErogationBase(BaseModel):
    card: Optional[str] = None
    company: Optional[str] = None
    driver_full_name: Optional[str] = None
    vehicle_id: Optional[str] = None
    company_vehicle: Optional[str] = None
    vehicle_total_km: Optional[str] = None
    erogation_side: int
    dispensed_liters: float
    dispensed_product: str
    erogation_timestamp: datetime
    mode: str
    total_erogation_price: Optional[float] = None

class ErogationCreate(ErogationBase):
    pass

class Erogation(ErogationBase):
    class Config:
        from_attributes = True


