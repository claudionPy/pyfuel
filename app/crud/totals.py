from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.totals import DispenserTotals
from decimal import Decimal

async def recordTotals(
    session: AsyncSession,
    dispenser_id: int,
    side: int,
    liters: Decimal  # ora Decimal
) -> None:
    col = getattr(DispenserTotals, f"total_side_{side}")
    stmt = pg_insert(DispenserTotals).values(
        dispenser_id=dispenser_id,
        **{f"total_side_{side}": liters}
    ).on_conflict_do_update(
        index_elements=[DispenserTotals.dispenser_id],
        set_={col: col + liters}
    )
    await session.execute(stmt)