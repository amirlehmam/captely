FROM python:3.12-slim

WORKDIR /app

# 1) Install system deps for Postgres client & build tools
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      build-essential \
      libpq-dev \
 && rm -rf /var/lib/apt/lists/*

# 2) Copy and install Python deps
COPY requirements.txt .
RUN pip install sqlalchemy[asyncio] pg8000
RUN pip install --upgrade pip setuptools wheel \
 && pip install -r requirements.txt uvicorn

# 3) Copy app code
COPY . .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
