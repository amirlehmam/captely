FROM python:3.12-slim
WORKDIR /app

COPY common ./common
COPY services/enrichment-worker/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY services/enrichment-worker ./services/enrichment-worker

# celery worker entrypoint
CMD ["celery","-A","services.enrichment-worker.tasks","worker","--loglevel=info"]
