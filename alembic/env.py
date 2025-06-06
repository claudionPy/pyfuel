# alembic/env.py (excerpt)

import os
import asyncio
from logging.config import fileConfig
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine
from alembic import context

# this is the Alembic Config object
config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# ─── Make sure you import every module that defines a table ───
# Adjust the import paths to match your project layout exactly.
#
# If your models live in, say, app/models/*.py, then you might write:
#
import app.models.drivers
import app.models.vehicles
import app.models.erogations
import app.models.totals
#
# By importing these before grabbing Base.metadata, we ensure that
# Base.metadata.reflects all four tables.

# Now import the Base that all those models subclass:
from app.database import Base
target_metadata = Base.metadata
# ───────────────────────────────────────────────────────────────

def get_url():
    # however you fetch your URL—either from alembic.ini or from env vars
    return os.environ["DB_URL"]

def run_migrations_offline():
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()

def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()

async def run_migrations_online():
    connectable: AsyncEngine = create_async_engine(
        get_url(),
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()

if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
