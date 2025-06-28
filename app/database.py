# database.py
# Sets up the asynchronous SQLAlchemy engine, session factory, and declarative base
# for the application’s database access.

import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base

# Read the database URL from the environment.
# Raises an error if not set to avoid silent misconfiguration.
DATABASE_URL = os.getenv("DB_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is not set")

# Create an async engine with echo enabled for SQL logging.
engine = create_async_engine(
    DATABASE_URL,
    echo=True  # Log all SQL statements for debugging
)

# Configure a session factory for AsyncSession.
# expire_on_commit=False prevents attributes from expiring after commit,
# allowing access to objects after the transaction completes.
async_session = sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)

# Declarative base class for ORM models.
Base = declarative_base()

async def get_session():
    """
    Dependency generator for FastAPI routes:
      - Yields a database session
      - Ensures session is closed after use
    Usage in FastAPI:
        async def endpoint(session: AsyncSession = Depends(get_session)):
            ...
    """
    async with async_session() as session:
        yield session

