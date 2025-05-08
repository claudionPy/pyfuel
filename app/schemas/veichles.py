from pydantic import BaseModel

class VehicleBase(BaseModel):
    vehicle_id: str
    company_vehicle: str
    request_vehicle_km: bool
    vehicle_total_km: str
    plate: str

class VehicleCreate(VehicleBase):
    pass

class Vehicle(VehicleBase):
    class Config:
        from_attributes = True

