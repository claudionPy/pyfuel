from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base

# Sostituisci 'tuapassword' con la password corretta
DATABASE_URL = "postgresql+asyncpg://postgres:adm69252892@localhost:5432/fuel_db"

engine = create_async_engine(DATABASE_URL, echo=True)
async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
Base = declarative_base()

# Dependency per ottenere una sessione del database
async def get_session():
    async with async_session() as session:
        yield session

