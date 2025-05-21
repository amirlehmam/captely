#!/bin/bash
# Start the Celery worker for the enrichment service

# Create logs directory if it doesn't exist
mkdir -p logs
mkdir -p csv

# Activate virtualenv if it exists
if [ -d ".venv" ]; then
  echo "Activating virtual environment..."
  source .venv/bin/activate
fi

# Check if broker is running
echo "Checking if Redis is running..."
redis-cli ping > /dev/null 2>&1
if [ $? -ne 0 ]; then
  echo "⚠️ Redis does not appear to be running."
  echo "Please start Redis with: docker-compose up -d redis"
  exit 1
fi

# Load environment variables if .env exists
if [ -f ".env" ]; then
  echo "Loading environment variables from .env..."
  export $(grep -v '^#' .env | xargs)
fi

# Start the worker with specified queues
echo "Starting Celery worker..."
celery -A app.tasks worker \
  -Q contact_enrichment,enrichment_batch,cascade_enrichment,db_operations \
  -c 4 \
  --loglevel=info \
  --logfile=logs/worker.log \
  --pidfile=worker.pid

# The worker is now running in the foreground
# To stop it, press Ctrl+C 