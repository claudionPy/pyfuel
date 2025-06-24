from sqlalchemy import Column, Integer, Numeric
from app.database import Base

class DispenserTotals(Base):
    __tablename__ = "totals"

    dispenser_id = Column(Integer, primary_key=True)
    total_side_1 = Column(Numeric(12, 2), nullable=False, default=0)
    total_side_2 = Column(Numeric(12, 2), nullable=False, default=0)
