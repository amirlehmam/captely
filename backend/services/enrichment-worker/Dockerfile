FROM python:3.11-slim

WORKDIR /app

# 🎯 SPEED OPTIMIZATION: Install system dependencies for maximum performance
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    postgresql-client \
    curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user to fix Celery security warning
RUN groupadd -r celeryuser && useradd -r -g celeryuser celeryuser

# Install dependencies
COPY requirements.txt .

# 🎯 SPEED OPTIMIZATION: Use pip cache and parallel installation
RUN pip install --no-cache-dir --upgrade pip setuptools wheel && \
    pip install --no-cache-dir -r requirements.txt

# Create directories for logs and CSV files and give ownership to celeryuser
RUN mkdir -p /app/logs /app/csv && \
    chown -R celeryuser:celeryuser /app/logs /app/csv

# Copy application files
COPY app/ /app/app/
COPY common/ /app/common/
COPY enrichment/ /app/enrichment/

# Give celeryuser ownership of all app files
RUN chown -R celeryuser:celeryuser /app

# 🎯 SPEED OPTIMIZATION: Set Python for maximum performance
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONPATH=/app
ENV PYTHONHASHSEED=1

# 🎯 SPEED OPTIMIZATION: Enable Python optimizations
ENV PYTHONOPTIMIZE=2

# 🎯 SPEED OPTIMIZATION: Celery configuration for maximum performance
ENV CELERY_BROKER_CONNECTION_RETRY_ON_STARTUP=True
ENV CELERY_WORKER_PREFETCH_MULTIPLIER=4
ENV CELERY_TASK_ACKS_LATE=True
ENV CELERY_WORKER_MAX_TASKS_PER_CHILD=1000

# 🎯 SPEED OPTIMIZATION: HTTP client settings for faster API calls
ENV HTTPX_TIMEOUT=15
ENV HTTPX_MAX_CONNECTIONS=50
ENV HTTPX_MAX_KEEPALIVE=25

# Switch to non-root user
USER celeryuser

# 🎯 SPEED OPTIMIZATION: Use optimized Celery command with concurrency
CMD ["celery", "-A", "app.tasks", "worker", "-l", "info", "--concurrency=8", "--pool=threads", "--max-tasks-per-child=500"]
