# services/auth-service/Dockerfile
FROM python:3.12-slim

# 1) Install OS-level build deps for asyncpg
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      build-essential \
      gcc \
      libpq-dev \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 2) Copy & install Python deps
COPY requirements.txt .
RUN pip install --upgrade pip setuptools wheel gunicorn uvicorn \
 && pip install -r requirements.txt

# 3) Copy app code
COPY . .

# CMD is provided by docker-compose (uvicorn app.main:app …)
