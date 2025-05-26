@echo off
REM Run enrichment script for LinkedIn Sales Navigator data
echo Captely LinkedIn Enrichment Tool
echo ==============================

REM Check if a file was provided
if "%~1"=="" (
    echo Error: No CSV file specified.
    echo Usage: run_enrichment.bat path\to\your\file.csv [user_id]
    exit /b 1
)

REM Set user ID (default to "admin" if not provided)
set USER_ID=admin
if not "%~2"=="" set USER_ID=%~2

REM Activate virtual environment if it exists
if exist "..\..\..\.venv\Scripts\activate.bat" (
    call "..\..\..\.venv\Scripts\activate.bat"
) else (
    echo Warning: Virtual environment not found. Using system Python.
)

REM Run the Python script
python run_enrichment.py --file "%~1" --user "%USER_ID%"

REM Deactivate virtual environment if it was activated
if exist "..\..\..\.venv\Scripts\activate.bat" (
    call deactivate
) 