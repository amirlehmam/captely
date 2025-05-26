# PowerShell script to run LinkedIn Sales Navigator enrichment
param(
    [Parameter(Mandatory=$true)]
    [string]$FilePath,
    
    [Parameter(Mandatory=$false)]
    [string]$UserId = "admin"
)

Write-Host "Captely LinkedIn Enrichment Tool" -ForegroundColor Cyan
Write-Host "==============================" -ForegroundColor Cyan

# Check if file exists
if (-not (Test-Path $FilePath)) {
    Write-Host "Error: File $FilePath does not exist." -ForegroundColor Red
    exit 1
}

# Check if file is a CSV
if (-not $FilePath.ToLower().EndsWith(".csv")) {
    Write-Host "Error: File must be a CSV file." -ForegroundColor Red
    exit 1
}

# Activate virtual environment if it exists
$VenvPath = "..\..\..\..\.venv\Scripts\Activate.ps1"
if (Test-Path $VenvPath) {
    Write-Host "Activating virtual environment..." -ForegroundColor Gray
    & $VenvPath
} else {
    Write-Host "Warning: Virtual environment not found. Using system Python." -ForegroundColor Yellow
}

# Run the Python script
Write-Host "Starting enrichment process for $FilePath..." -ForegroundColor Green
python run_enrichment.py --file $FilePath --user $UserId

# Check result
if ($LASTEXITCODE -eq 0) {
    Write-Host "Enrichment job submitted successfully." -ForegroundColor Green
    Write-Host "You can monitor progress at http://localhost:5555" -ForegroundColor Cyan
} else {
    Write-Host "Enrichment job failed with exit code $LASTEXITCODE" -ForegroundColor Red
}

# Deactivate virtual environment if it was activated
if (Test-Path $VenvPath) {
    deactivate
} 