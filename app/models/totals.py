# totals.py
# ORM model for "dispenser_totals", tracking cumulative fuel dispensed per side.

from sqlalchemy import Column, Integer, Numeric
from app.database import Base

class DispenserTotals(Base):
    """
    Holds running totals for each dispenser side.
    
    Attributes:
      - dispenser_id: primary key, identifies the dispenser unit
      - total_side_1: cumulative liters dispensed on side 1
      - total_side_2: cumulative liters dispensed on side 2
    """
    __tablename__ = "dispenser_totals"

    dispenser_id = Column(Integer, primary_key=True)
    total_side_1 = Column(Numeric(14, 2), default=0, nullable=False)
    total_side_2 = Column(Numeric(14, 2), default=0, nullable=False)

