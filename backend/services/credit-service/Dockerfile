FROM python:3.11-slim

# 1) OS deps for Postgres client + netcat
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      build-essential \
      libpq-dev \
      netcat-openbsd \
      postgresql-client \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 2) Install Python deps (incl. pg8000)
COPY requirements.txt .
RUN pip install --upgrade pip setuptools wheel \
 && pip install --no-cache-dir -r requirements.txt \
 && pip install asyncpg

# 3) Copy app
COPY . .

ENTRYPOINT ["/bin/sh", "/usr/local/bin/wait-for-db.sh"]
