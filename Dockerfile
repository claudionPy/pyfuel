# 1) Use a slim Python base
FROM python:3.9-slim

# 2) Install system packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential gcc libpq-dev libffi-dev python3-dev curl \
    && rm -rf /var/lib/apt/lists/*

# 3) Install Python deps as root
COPY requirements.txt .
RUN python3 -m pip install --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# 4) Create app user AFTER installing
RUN adduser --disabled-password --gecos "" appuser
USER appuser
WORKDIR /home/appuser/app

# 5) Copy the project
COPY --chown=appuser:appuser . .

# 6) Entrypoint
RUN chmod +x ./entrypoint.sh
ENTRYPOINT ["./entrypoint.sh"]
