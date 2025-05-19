Write-Host "======== Captely Enrichment System ========" -ForegroundColor Cyan
Write-Host ""

# Find the root directory
$projectRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)))
$csvDir = Join-Path -Path $projectRoot -ChildPath "backend\csv"

# Check if the directory exists and create it if not
if (-not (Test-Path $csvDir)) {
    Write-Host "CSV directory not found. Creating it..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $csvDir -Force | Out-Null
}

# Check for CSV files
$csvFiles = Get-ChildItem -Path $csvDir -Filter "*.csv" | Where-Object { $_.Name -notlike "*_enriched*" }
Write-Host "CSV files found: $($csvFiles.Count)" -ForegroundColor Yellow

# Ask about creating a sample file
Write-Host ""
$createSample = Read-Host "Do you want to create a sample CSV file for testing? (y/n)"
if ($createSample -eq 'y') {
    Write-Host "Creating sample CSV file..." -ForegroundColor Green
    & python create_sample_csv.py
    Write-Host ""
}

# Ask about running the enrichment process
$runEnrichment = Read-Host "Do you want to run the enrichment process now? (y/n)"
if ($runEnrichment -eq 'y') {
    Write-Host "Starting enrichment process..." -ForegroundColor Green
    
    $maxLeads = Read-Host "Enter max number of leads to process (leave empty for all)"
    if ([string]::IsNullOrWhiteSpace($maxLeads)) {
        & python run_enrichment.py
    } else {
        $env:MAX_LEADS = $maxLeads
        & python run_enrichment.py
        Remove-Item env:MAX_LEADS
    }
    
    Write-Host ""
    Write-Host "Enrichment process completed! Check the CSV directory for enriched files." -ForegroundColor Green
} else {
    Write-Host "Enrichment skipped." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "======== Process Complete ========" -ForegroundColor Cyan
Write-Host "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown") 