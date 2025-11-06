@echo off
REM WhatoFlow 安裝完成後的自動配置腳本
REM 此腳本會在 MSI 安裝完成後自動執行，註冊 Node.js 服務

echo ====================================
echo WhatoFlow Installation Complete
echo ====================================
echo.
echo This script will configure the Node.js service.
echo.

set INSTALL_DIR=%~dp0
set SERVICE_NAME=WhatoFlowNodeService

echo Checking prerequisites...

REM Check if NSSM exists
if not exist "%INSTALL_DIR%nssm.exe" (
    echo [ERROR] nssm.exe not found at: %INSTALL_DIR%nssm.exe
    echo Please ensure the installation completed successfully.
    pause
    exit /b 1
)

REM Check if start script exists
if not exist "%INSTALL_DIR%start-node-service.bat" (
    echo [ERROR] start-node-service.bat not found
    echo Please ensure the installation completed successfully.
    pause
    exit /b 1
)

echo [OK] Prerequisites check passed
echo.

REM Check if service already exists
sc query %SERVICE_NAME% >nul 2>&1
if %errorLevel% equ 0 (
    echo Service %SERVICE_NAME% already exists.
    echo Do you want to reconfigure it? (Y/N)
    set /p RECONFIGURE=
    if /i not "%RECONFIGURE%"=="Y" (
        echo Skipping service installation.
        goto :start_service
    )
    echo Stopping existing service...
    "%INSTALL_DIR%nssm.exe" stop %SERVICE_NAME%
    timeout /t 2 /nobreak >nul
    echo Removing existing service...
    "%INSTALL_DIR%nssm.exe" remove %SERVICE_NAME% confirm
    timeout /t 1 /nobreak >nul
)

echo.
echo Installing Node.js service...
echo Using script: %INSTALL_DIR%install_nodejs_service_manual.bat

REM Execute the manual installation script
call "%INSTALL_DIR%install_nodejs_service_manual.bat"

if %errorLevel% equ 0 (
    echo.
    echo ====================================
    echo Service installation completed successfully!
    echo ====================================
) else (
    echo.
    echo [ERROR] Service installation failed
    echo Please check the error messages above.
    pause
    exit /b 1
)

:start_service
echo.
echo Checking service status...
sc query %SERVICE_NAME% | findstr "STATE" | findstr "RUNNING" >nul
if %errorLevel% neq 0 (
    echo Starting service...
    net start %SERVICE_NAME%
    if %errorLevel% equ 0 (
        echo [OK] Service started successfully
    ) else (
        echo [WARN] Service start failed, but service is installed
        echo You can start it manually later using: net start %SERVICE_NAME%
    )
) else (
    echo [OK] Service is already running
)

echo.
echo ====================================
echo Installation Complete!
echo ====================================
echo.
echo Services installed:
echo   - WhatoFlowService (.NET Backend) - Auto-started
echo   - WhatoFlowNodeService (Node.js Frontend) - Auto-started
echo.
pause




