# services/auth-service/Dockerfile
FROM python:3.12-slim

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
 && pip install jinja2 asyncpg

# 3) Copy common module - we'll use a volume mount instead
# COPY ../common /app/common

# 4) Copy app
COPY . /app

# 5) Set PYTHONPATH
ENV PYTHONPATH=/app:/app/common

# 6) (Optional) wait-for-db then launch
COPY wait-for-db.sh /usr/local/bin/wait-for-db.sh
RUN chmod +x /usr/local/bin/wait-for-db.sh

ENTRYPOINT ["/bin/sh", "/usr/local/bin/wait-for-db.sh"]
