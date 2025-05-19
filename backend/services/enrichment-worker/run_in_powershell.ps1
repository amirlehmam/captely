# Captely Enrichment PowerShell Script
# This script provides a robust way to run the enrichment process on Windows

# Set error action preference to continue despite errors
$ErrorActionPreference = "Continue"

# Function to show a colored message
function Write-ColoredMessage {
    param (
        [Parameter(Mandatory=$true)]
        [string]$Message,
        
        [Parameter(Mandatory=$false)]
        [string]$ForegroundColor = "White"
    )
    
    Write-Host $Message -ForegroundColor $ForegroundColor
}

# Function to load environment variables from .env file
function Load-EnvFile {
    param (
        [Parameter(Mandatory=$true)]
        [string]$EnvFilePath
    )

    if (Test-Path $EnvFilePath) {
        Write-ColoredMessage "Loading API keys from .env file..." -ForegroundColor Green
        
        $content = Get-Content $EnvFilePath
        foreach ($line in $content) {
            if ($line.Trim() -and !$line.StartsWith("#")) {
                $key, $value = $line.Split("=", 2)
                if ($key -and $value) {
                    [Environment]::SetEnvironmentVariable($key.Trim(), $value.Trim(), "Process")
                    Write-ColoredMessage "  Loaded key: $($key.Trim())" -ForegroundColor Gray
                }
            }
        }
    }
}

# Header
Write-ColoredMessage "======== Captely Enrichment System ========" -ForegroundColor Cyan
Write-ColoredMessage ""

# Find paths
$scriptDir = $PSScriptRoot
$projectRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $scriptDir))
$csvDir = Join-Path -Path $projectRoot -ChildPath "backend\csv"

# Load API keys from .env file if it exists
$envFile = Join-Path -Path $scriptDir -ChildPath ".env"
if (Test-Path $envFile) {
    Load-EnvFile -EnvFilePath $envFile
} else {
    $setApiKeysFile = Join-Path -Path $scriptDir -ChildPath "set_api_keys.bat"
    if (Test-Path $setApiKeysFile) {
        Write-ColoredMessage "API keys file found. These will be loaded when running enrichment." -ForegroundColor Green
    } else {
        Write-ColoredMessage "No API keys configuration found. You might want to run setup_api_keys.py first." -ForegroundColor Yellow
    }
}

# Make sure Python is available
try {
    $pythonVersion = python --version
    Write-ColoredMessage "Using Python: $pythonVersion" -ForegroundColor Green
} catch {
    Write-ColoredMessage "ERROR: Python not found in PATH. Please install Python or add it to your PATH." -ForegroundColor Red
    Write-ColoredMessage "Press any key to exit..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# Check for required modules
try {
    python -c "import requests; print('Requests module found')"
} catch {
    Write-ColoredMessage "Installing required modules..." -ForegroundColor Yellow
    python -m pip install requests pandas
}

# Check if the CSV directory exists and create it if not
if (-not (Test-Path $csvDir)) {
    Write-ColoredMessage "CSV directory not found. Creating it..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $csvDir -Force | Out-Null
}

# Check for CSV files
$csvFiles = Get-ChildItem -Path $csvDir -Filter "*.csv" | Where-Object { $_.Name -notlike "*_enriched*" }
Write-ColoredMessage "CSV files found: $($csvFiles.Count)" -ForegroundColor Yellow

if ($csvFiles.Count -eq 0) {
    Write-ColoredMessage "No CSV files found to process. Please put CSV files in: $csvDir" -ForegroundColor Yellow
    $createSample = Read-Host "Do you want to create a sample CSV file for testing? (y/n)"
    if ($createSample -eq 'y') {
        Write-ColoredMessage "Creating sample CSV file..." -ForegroundColor Green
        python (Join-Path -Path $scriptDir -ChildPath "create_sample_csv.py")
        Write-ColoredMessage ""
        
        # Refresh the file list
        $csvFiles = Get-ChildItem -Path $csvDir -Filter "*.csv" | Where-Object { $_.Name -notlike "*_enriched*" }
        Write-ColoredMessage "CSV files found: $($csvFiles.Count)" -ForegroundColor Yellow
    }
}

# List available CSV files
if ($csvFiles.Count -gt 0) {
    Write-ColoredMessage "Available CSV files:" -ForegroundColor Cyan
    foreach ($file in $csvFiles) {
        Write-ColoredMessage "  - $($file.Name) ($('{0:N0}' -f $file.Length) bytes)" -ForegroundColor White
    }
    Write-ColoredMessage ""
}

# Ask about running the enrichment process
$runEnrichment = Read-Host "Do you want to run the enrichment process now? (y/n)"
if ($runEnrichment -eq 'y') {
    Write-ColoredMessage "Starting enrichment process..." -ForegroundColor Green
    
    $maxLeads = Read-Host "Enter max number of leads to process per file (leave empty for all)"
    
    # Create log directory if it doesn't exist
    $logDir = Join-Path -Path $scriptDir -ChildPath "logs"
    if (-not (Test-Path $logDir)) {
        New-Item -ItemType Directory -Path $logDir -Force | Out-Null
    }
    
    # Generate timestamp for log file
    $timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $logFile = Join-Path -Path $logDir -ChildPath "enrichment_$timestamp.log"
    
    # Execute the Python script with logging
    try {
        if ([string]::IsNullOrWhiteSpace($maxLeads)) {
            Write-ColoredMessage "Running enrichment on all leads. This may take a while..." -ForegroundColor Yellow
            Start-Process -FilePath "python" -ArgumentList "run_enrichment.py" -NoNewWindow -Wait
        } else {
            Write-ColoredMessage "Running enrichment with limit of $maxLeads leads per file..." -ForegroundColor Yellow
            $env:MAX_LEADS = $maxLeads
            Start-Process -FilePath "python" -ArgumentList "run_enrichment.py" -NoNewWindow -Wait
            Remove-Item env:MAX_LEADS
        }
        
        Write-ColoredMessage ""
        Write-ColoredMessage "Enrichment process completed! Check the CSV directory for enriched files." -ForegroundColor Green
        
        # List enriched files
        $enrichedFiles = Get-ChildItem -Path $csvDir -Filter "*_enriched.csv" 
        if ($enrichedFiles.Count -gt 0) {
            Write-ColoredMessage "Enriched CSV files:" -ForegroundColor Cyan
            foreach ($file in $enrichedFiles) {
                Write-ColoredMessage "  - $($file.Name) ($('{0:N0}' -f $file.Length) bytes)" -ForegroundColor White
            }
        }
    } catch {
        Write-ColoredMessage "Error running enrichment process: $_" -ForegroundColor Red
    }
} else {
    Write-ColoredMessage "Enrichment skipped." -ForegroundColor Yellow
}

Write-ColoredMessage ""
Write-ColoredMessage "======== Process Complete ========" -ForegroundColor Cyan
Write-ColoredMessage "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown") 