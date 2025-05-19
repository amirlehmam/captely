@echo off
echo ======== Captely Enrichment System ========
echo.

REM Check if there are CSV files
python -c "import os; csv_dir=os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../../backend/csv')); print('CSV files found: ' + str(len([f for f in os.listdir(csv_dir) if f.endswith('.csv') and not f.endswith('_enriched.csv')]) if os.path.exists(csv_dir) else 0))"

echo.
set /p create="Do you want to create a sample CSV file for testing? (y/n): "
if /i "%create%"=="y" (
    echo Creating sample CSV file...
    python create_sample_csv.py
    echo.
)

set /p run="Do you want to run the enrichment process now? (y/n): "
if /i "%run%"=="y" (
    echo Starting enrichment process...
    python run_enrichment.py
    echo.
    echo Enrichment completed! Check the CSV directory for the enriched files.
) else (
    echo Enrichment skipped.
)

echo.
echo ======== Process Complete ========
pause 