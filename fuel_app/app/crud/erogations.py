from sqlalchemy.ext.asyncio import AsyncSession
from app.models.erogations import Erogazione

async def create_erogazione(session: AsyncSession, erogazione_data):
    new_erogazione = Erogazione(**erogazione_data.dict())
    session.add(new_erogazione)
    await session.commit()
    await session.refresh(new_erogazione)
    return new_erogazione

