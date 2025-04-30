FROM python:3.12-alpine

WORKDIR /app

# add this before pip install
RUN apk add --no-cache \
      gcc \
      musl-dev \
      postgresql-dev

COPY requirements.txt .

# now this will find pg_config and build psycopg2
RUN pip install sqlalchemy[asyncio] pg8000
RUN pip install --no-cache-dir -r requirements.txt celery

COPY . .
