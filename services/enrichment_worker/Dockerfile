FROM python:3.12-slim

# 1) put your code under /app
WORKDIR /app

# 2) copy requirements and install
COPY enrichment_worker/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 3) copy your worker code
COPY enrichment_worker enrichment_worker
# if you have a common/ or config/ shared folder, copy that too:
COPY common common

# 4) default command
#    celery will look for `celery_app` in
#    the module `enrichment_worker.app.tasks`
CMD ["celery", "-A", "enrichment_worker.app.tasks", "worker", "--loglevel=info"]
