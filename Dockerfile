# ---------- Dockerfile ----------

# 1) Use a slim Python base
FROM python:3.9-slim

# 2) Install system packages needed for asyncpg (Postgres driver)
USER root
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
        gcc libpq-dev curl \
 && rm -rf /var/lib/apt/lists/*

# 3) Create a non-root user
RUN adduser --disabled-password --gecos "" appuser
USER appuser
WORKDIR /home/appuser/app

# 4) Copy and install Python dependencies
COPY --chown=appuser:appuser requirements.txt .
RUN python3 -m pip install --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# 5) Copy the rest of your application (including app/ and alembic/)
COPY --chown=appuser:appuser . .

# 6) Ensure entrypoint.sh is executable
RUN chmod +x ./entrypoint.sh

# 7) Expose port 8000 for Uvicorn
EXPOSE 8000

# 8) Default entrypoint
ENTRYPOINT ["./entrypoint.sh"]
# ----------------------------------

