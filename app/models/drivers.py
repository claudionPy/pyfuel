# drivers.py
# SQLAlchemy ORM model for the "drivers" table, representing authorized drivers.

from sqlalchemy import Column, String, Boolean
from app.database import Base

class Driver(Base):
    """
    Represents a driver who can authorize fuel dispensing.
    
    Attributes:
      - card (String, PK): RFID card identifier, unique per driver.
      - company (String): Name of the company or organization.
      - driver_full_name (String): Full name for display and record-keeping.
      - request_pin (Boolean): If True, require the driver to enter a PIN.
      - request_vehicle_id (Boolean): If True, require the driver to select/enter a vehicle.
      - pin (String): The driver's PIN code (used only if request_pin is True).
    """
    __tablename__ = "drivers"

    # Primary key: the RFID card string
    card = Column(String, primary_key=True, index=True)
    # Company affiliation (optional)
    company = Column(String, nullable=True)
    # Driver's full name (optional)
    driver_full_name = Column(String, nullable=True)
    # Flag indicating whether to prompt for a PIN
    request_pin = Column(Boolean, default=False)
    # Flag indicating whether to prompt for a vehicle ID
    request_vehicle_id = Column(Boolean, default=False)
    # PIN code for the driver (nullable if request_pin is False)
    pin = Column(String, nullable=True)

