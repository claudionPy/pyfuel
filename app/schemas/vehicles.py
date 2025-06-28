# vehicles.py
# Pydantic schemas for Vehicle API requests and responses.

from pydantic import BaseModel

class VehicleBase(BaseModel):
    """
    Shared fields for creating or returning a vehicle.
    
    Attributes:
      - vehicle_id: unique ID for the vehicle (primary key)
      - company_vehicle: name of the owning company
      - request_vehicle_km: True if odometer prompt is required
      - vehicle_total_km: latest odometer reading as string
      - plate: license plate string
    """
    vehicle_id: str
    company_vehicle: str
    request_vehicle_km: bool
    vehicle_total_km: str
    plate: str

class VehicleCreate(VehicleBase):
    """Schema for vehicle‐creation requests; same fields as VehicleBase."""
    pass

class Vehicle(VehicleBase):
    """
    Schema for vehicle data returned by the API.
    Reads directly from ORM model attributes.
    """
    class Config:
        from_attributes = True

