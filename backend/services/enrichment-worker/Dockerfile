FROM python:3.11-slim

WORKDIR /app

# Install PostgreSQL dependencies for psycopg2
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    postgresql-client \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user to fix Celery security warning
RUN groupadd -r celeryuser && useradd -r -g celeryuser celeryuser

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Create directories for logs and CSV files
RUN mkdir -p /app/logs /app/csv

# Copy application files
COPY app/ /app/app/
COPY common/ /app/common/
COPY enrichment/ /app/enrichment/
COPY wait-for-db.sh /app/

# Make wait script executable and change ownership
RUN chmod +x /app/wait-for-db.sh && \
    chown -R celeryuser:celeryuser /app

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONPATH=/app

# FIXED: Add Celery configuration to fix deprecation warnings
ENV CELERY_BROKER_CONNECTION_RETRY_ON_STARTUP=True

# Switch to non-root user
USER celeryuser

# Default command
CMD ["celery", "-A", "app.tasks", "worker", "-l", "info"]
