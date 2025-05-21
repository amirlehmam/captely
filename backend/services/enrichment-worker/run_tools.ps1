# Captely Enrichment Tools Launcher
# This script provides quick access to all enrichment tools

function Show-Menu {
    Clear-Host
    Write-Host "================= Captely Enrichment Tools =================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host " [1] Test API Keys (Hunter and Dropcontact)" -ForegroundColor Green
    Write-Host " [2] Setup/Update API Keys" -ForegroundColor Green
    Write-Host " [3] Run Enrichment Process" -ForegroundColor Green
    Write-Host " [4] Open CSV Folder" -ForegroundColor Green
    Write-Host ""
    Write-Host " [Q] Quit" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "=========================================================" -ForegroundColor Cyan
}

function Test-ApiKeys {
    Write-Host "Testing API keys..." -ForegroundColor Cyan
    
    try {
        # Run the test_api_keys.py script
        python test_api_keys.py
    }
    catch {
        Write-Host "Error running API key test: $_" -ForegroundColor Red
    }
    
    Write-Host "`nPress any key to return to the menu..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

function Setup-ApiKeys {
    Write-Host "Setting up API keys..." -ForegroundColor Cyan
    
    try {
        # Run the setup_api_keys.py script
        python setup_api_keys.py
    }
    catch {
        Write-Host "Error running API key setup: $_" -ForegroundColor Red
    }
    
    Write-Host "`nPress any key to return to the menu..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

function Run-Enrichment {
    Write-Host "Running the enrichment process..." -ForegroundColor Cyan
    
    try {
        # Run the enrichment directly using Python instead of calling the PowerShell script
        python run_enrichment.py
    }
    catch {
        Write-Host "Error running enrichment process: $_" -ForegroundColor Red
    }
    
    Write-Host "`nPress any key to return to the menu..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

function Open-CsvFolder {
    Write-Host "Opening CSV folder..." -ForegroundColor Cyan
    
    $scriptDir = $PSScriptRoot
    $csvDir = Join-Path -Path $scriptDir -ChildPath "csv"
    
    # Create the directory if it doesn't exist
    if (-not (Test-Path $csvDir)) {
        New-Item -ItemType Directory -Path $csvDir -Force | Out-Null
        Write-Host "Created CSV directory: $csvDir" -ForegroundColor Yellow
    }
    
    # Open the directory in File Explorer
    try {
        Start-Process $csvDir
    }
    catch {
        Write-Host "Error opening CSV folder: $_" -ForegroundColor Red
    }
    
    Write-Host "`nPress any key to return to the menu..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
}

# Main loop
$choice = ""
while ($choice -ne "Q") {
    Show-Menu
    $choice = Read-Host "Enter your choice"
    $choice = $choice.ToUpper()
    
    switch ($choice) {
        "1" { Test-ApiKeys }
        "2" { Setup-ApiKeys }
        "3" { Run-Enrichment }
        "4" { Open-CsvFolder }
        "Q" { 
            Write-Host "Exiting Captely Enrichment Tools..." -ForegroundColor Yellow
            exit 
        }
        default { 
            Write-Host "Invalid choice. Press any key to continue..." -ForegroundColor Red
            $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        }
    }
} 