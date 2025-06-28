# erogations.py
# Pydantic schemas for Erogation API requests and responses.

from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class ErogationBase(BaseModel):
    """
    Shared fields for posting or returning an erogation.
    
    Attributes:
      - card: RFID card used (None for manual)
      - company: driver’s company (optional)
      - driver_full_name: name (optional)
      - vehicle_id: ID of the vehicle (optional)
      - company_vehicle: vehicle’s company (optional)
      - vehicle_total_km: odometer reading at dispense (optional)
      - erogation_side: pump side number (1 or 2)
      - dispensed_liters: liters dispensed (float)
      - dispensed_product: product name
      - erogation_timestamp: timestamp of dispense
      - mode: 'automatica' or 'manuale'
      - total_erogation_price: price charged (optional)
    """
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
    """Schema for creating a new erogation; inherits all fields."""
    pass

class Erogation(ErogationBase):
    """
    Schema for erogation data returned by the API.
    Reads from ORM model attributes.
    """
    class Config:
        from_attributes = True

