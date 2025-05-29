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

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Create directories for logs and CSV files
RUN mkdir -p /app/logs /app/csv

# Copy application files
COPY app/ /app/app/
COPY common/ /app/common/
COPY wait-for-db.sh /app/

# Make wait script executable
RUN chmod +x /app/wait-for-db.sh

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONPATH=/app

# Default command
CMD ["celery", "-A", "app.tasks", "worker", "-l", "info"]
