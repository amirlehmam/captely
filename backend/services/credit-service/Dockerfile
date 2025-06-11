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

# Start FastAPI with uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
