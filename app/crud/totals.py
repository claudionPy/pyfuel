# totals.py
# Upsert logic for cumulative dispenser-side totals.

from sqlalchemy.dialects.postgresql import insert as pg_insert  # For ON CONFLICT upsert
from sqlalchemy.ext.asyncio import AsyncSession                 # Async DB session
from app.models.totals import DispenserTotals                   # ORM model for totals
from decimal import Decimal                                     # Precise numeric type

async def recordTotals(
    session: AsyncSession,
    dispenser_id: int,
    side: int,
    liters: Decimal
) -> None:
    """
    Increment the running total for a given dispenser's side:
      - Uses PostgreSQL INSERT … ON CONFLICT to upsert.
      - On conflict, adds `liters` to existing total_side_{side}` column.
    """
    col = getattr(DispenserTotals, f"total_side_{side}")
    stmt = pg_insert(DispenserTotals).values(
        dispenser_id=dispenser_id,
        **{f"total_side_{side}": liters}
    ).on_conflict_do_update(
        index_elements=[DispenserTotals.dispenser_id],
        set_={col: col + liters}
    )
    await session.execute(stmt)

