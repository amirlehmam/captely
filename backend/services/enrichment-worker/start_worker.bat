@echo off
REM Start the Celery worker for the enrichment service

REM Create logs and csv directories if they don't exist
if not exist logs mkdir logs
if not exist csv mkdir csv

REM Activate virtualenv if it exists
if exist .venv\Scripts\activate.bat (
    echo Activating virtual environment...
    call .venv\Scripts\activate.bat
)

REM Check if redis is installed
where redis-cli >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo WARNING: redis-cli not found. Make sure Redis is running!
) else (
    echo Checking if Redis is running...
    redis-cli ping >nul 2>&1
    if %ERRORLEVEL% NEQ 0 (
        echo WARNING: Redis does not appear to be running.
        echo Please start Redis with: docker-compose up -d redis
        pause
        exit /b 1
    )
)

REM Start the worker with specified queues
echo Starting Celery worker...
celery -A app.tasks worker ^
  -Q contact_enrichment,enrichment_batch,cascade_enrichment,db_operations ^
  -c 4 ^
  --loglevel=info ^
  --logfile=logs\worker.log ^
  --pidfile=worker.pid

REM The worker is now running in the foreground
REM To stop it, press Ctrl+C 