# services/auth-service/Dockerfile
FROM python:3.12-slim

# 1) Install OS-level build deps for asyncpg
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      build-essential \
      gcc \
      libpq-dev \
      netcat \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 2) Copy & install Python deps
COPY requirements.txt .
RUN pip install sqlalchemy[asyncio] pg8000
RUN pip install --upgrade pip setuptools wheel gunicorn uvicorn \
 && pip install -r requirements.txt

# 3) Copy in app code + wait script
COPY . .

# 4) Add a small entrypoint script that waits for Postgres
COPY wait-for-db.sh /usr/local/bin/wait-for-db.sh
RUN chmod +x /usr/local/bin/wait-for-db.sh

ENTRYPOINT ["/usr/local/bin/wait-for-db.sh"]
