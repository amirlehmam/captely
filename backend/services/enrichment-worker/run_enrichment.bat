@echo off
echo ======== Captely Enrichment System ========
echo.
echo Starting PowerShell launcher...
echo.

:: Run the PowerShell script without execution policy restrictions
powershell -ExecutionPolicy Bypass -File "%~dp0\run_in_powershell.ps1"

:: If PowerShell fails for some reason, fall back to direct Python execution
if %ERRORLEVEL% NEQ 0 (
    echo PowerShell execution failed, trying direct Python execution...
    echo.
    
    set /p run="Do you want to run the enrichment process? (y/n): "
    if /i "%run%"=="y" (
        set /p max="Enter max number of leads to process (leave empty for all): "
        
        if defined max (
            set MAX_LEADS=%max%
            python "%~dp0\run_enrichment.py"
            set MAX_LEADS=
        ) else (
            python "%~dp0\run_enrichment.py"
        )
    )
)

echo.
if %ERRORLEVEL% NEQ 0 (
    echo Process completed with errors. Check log for details.
) else (
    echo Process completed successfully!
)
echo.
echo Press any key to exit...
pause > nul 