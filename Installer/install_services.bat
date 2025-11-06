@echo off
REM Script to install Windows Services for WhatoFlow
REM This script is called by Inno Setup after installation

setlocal enabledelayedexpansion

set INSTALL_DIR=%~dp0
set DOTNET_PORT=%1

if "%DOTNET_PORT%"=="" set DOTNET_PORT=64213

REM Remove trailing backslash if present
set INSTALL_DIR=%INSTALL_DIR:~0,-1%

REM Create logs directory if it doesn't exist
if not exist "%INSTALL_DIR%\logs" (
    mkdir "%INSTALL_DIR%\logs"
)

REM Uninstall existing service if it exists
echo [PREP] Checking for existing service...
sc.exe stop "WhatoFlowService" >nul 2>&1
sc.exe query "WhatoFlowService" >nul 2>&1
if %errorLevel% equ 0 (
    sc.exe delete "WhatoFlowService" >nul 2>&1
    timeout /t 2 >nul
)

REM Check if WhatoFlow.exe exists
if not exist "%INSTALL_DIR%\WhatoFlow.exe" (
    echo [ERROR] WhatoFlow.exe not found at %INSTALL_DIR%\WhatoFlow.exe
    echo [INFO] Cannot install .NET Backend Service without WhatoFlow.exe
    exit /b 1
)

echo [1/1] Installing .NET Backend Service using native Windows Service...
REM Install .NET service using sc.exe (native Windows Service)
REM .NET 8.0 applications with UseWindowsService() support native service installation
REM Note: sc.exe syntax requires special handling of spaces and quotes
REM The binPath parameter must be properly escaped

REM Remove any existing service first
sc.exe stop "WhatoFlowService" >nul 2>&1
sc.exe query "WhatoFlowService" >nul 2>&1
if %errorLevel% equ 0 (
    sc.exe delete "WhatoFlowService" >nul 2>&1
    timeout /t 1 /nobreak >nul
)

REM Create service - sc.exe requires special syntax for paths with spaces
REM Use a temporary variable to properly escape the path
set "SERVICE_BINPATH=%INSTALL_DIR%\WhatoFlow.exe"
REM Create the service (binPath= must have space after =, path in quotes if it contains spaces)
sc.exe create "WhatoFlowService" binPath= "%SERVICE_BINPATH%" start= auto DisplayName= "WhatoFlow Web Service"
if %errorLevel% equ 0 (
    echo [OK] .NET Backend Service installed successfully
    REM Configure service description
    sc.exe description "WhatoFlowService" "WhatoFlow Backend Web Service"
    REM Set service working directory (important for logs and file paths)
    REM Note: sc.exe doesn't support setting working directory directly, but we can use AppContext.BaseDirectory in code
    REM The application will use AppContext.BaseDirectory which points to the executable directory
    echo [OK] .NET Backend Service configured
    echo [INFO] Service working directory will be set by application code to: %INSTALL_DIR%
    echo [INFO] Service will use application logging (appsettings.json) with logs in: %INSTALL_DIR%\logs
) else (
    echo [ERROR] Failed to install .NET Backend Service
    echo [DEBUG] Attempted command: sc.exe create "WhatoFlowService" binPath= "\"%INSTALL_DIR%\WhatoFlow.exe\"" start= auto DisplayName= "WhatoFlow Web Service"
    REM Show the error details
    sc.exe query "WhatoFlowService" 2>&1
    exit /b 1
)

echo.
echo [SUCCESS] Service Installation Complete
echo.
echo Service installed:
echo   - WhatoFlowService (.NET Backend - includes frontend static files)
echo.
echo Service will start automatically on system boot.
echo To manually start service, use Windows Services Manager or run:
echo   net start WhatoFlowService
echo.
echo Note: Frontend static files are served by .NET backend on port %DOTNET_PORT%
echo       No separate Node.js service is needed.
echo.


