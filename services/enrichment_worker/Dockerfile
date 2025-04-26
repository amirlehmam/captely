# services/enrichment-worker/Dockerfile
FROM python:3.12-slim
WORKDIR /app

COPY common ./common
COPY services/enrichment_worker/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY services/enrichment_worker ./services/enrichment_worker

CMD ["celery","-A","services.enrichment_worker.tasks","worker","--loglevel=info"]
