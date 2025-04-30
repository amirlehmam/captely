FROM python:3.12-alpine

# 1) Alpine packages for Postgres & build
RUN apk add --no-cache \
      gcc \
      musl-dev \
      postgresql-dev \
      netcat

WORKDIR /app

# 2) Install Python deps (including celery + pg8000)
COPY requirements.txt .
RUN pip install --upgrade pip setuptools wheel \
 && pip install --no-cache-dir -r requirements.txt

# 3) Copy code + entrypoint
COPY . .
COPY wait-for-db.sh /usr/local/bin/wait-for-db.sh
RUN chmod +x /usr/local/bin/wait-for-db.sh

ENTRYPOINT ["/usr/local/bin/wait-for-db.sh"]
CMD ["celery", "-A", "common.celery_app:celery_app", "worker", "--loglevel=info"]
