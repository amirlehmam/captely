@echo off
:: Captely Enrichment Tools Launcher (Batch version)
:: This batch file provides simple access to all enrichment tools

:menu
cls
echo ================= Captely Enrichment Tools =================
echo.
echo  [1] Test API Keys (Hunter and Dropcontact)
echo  [2] Setup/Update API Keys
echo  [3] Run Enrichment Process
echo  [4] Open CSV Folder
echo.
echo  [Q] Quit
echo.
echo =========================================================
echo.

set /p choice="Enter your choice: "

if "%choice%"=="1" goto test_api_keys
if "%choice%"=="2" goto setup_api_keys
if "%choice%"=="3" goto run_enrichment
if "%choice%"=="4" goto open_csv_folder
if /i "%choice%"=="q" goto end
if /i "%choice%"=="Q" goto end

echo Invalid choice. Press any key to continue...
pause >nul
goto menu

:test_api_keys
echo Testing API keys...
echo.
python test_api_keys.py
echo.
echo Press any key to return to the menu...
pause >nul
goto menu

:setup_api_keys
echo Setting up API keys...
echo.
python setup_api_keys.py
echo.
echo Press any key to return to the menu...
pause >nul
goto menu

:run_enrichment
echo Running enrichment process...
echo.
python run_enrichment.py
echo.
echo Press any key to return to the menu...
pause >nul
goto menu

:open_csv_folder
echo Opening CSV folder...
echo.
:: Determine the CSV directory path
for %%i in ("%~dp0\..\..\..\..\backend\csv") do set "csv_dir=%%~fi"

:: Create the directory if it doesn't exist
if not exist "%csv_dir%" (
    mkdir "%csv_dir%"
    echo Created CSV directory: %csv_dir%
)

:: Open the directory in File Explorer
start "" "%csv_dir%"

echo Press any key to return to the menu...
pause >nul
goto menu

:end
echo Exiting Captely Enrichment Tools...
exit /b 