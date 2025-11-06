@echo off
REM Script to uninstall Windows Services for WhatoFlow
REM This script is called by Inno Setup during uninstallation

setlocal enabledelayedexpansion

set INSTALL_DIR=%~dp0
REM Remove trailing backslash if present
set INSTALL_DIR=%INSTALL_DIR:~0,-1%

echo ====================================
echo Uninstalling WhatoFlow Windows Services
echo ====================================
echo.

REM Stop and uninstall service
echo [INFO] Stopping service...
sc.exe stop "WhatoFlowService" >nul 2>&1
timeout /t 2 /nobreak >nul

echo [1/1] Uninstalling .NET Backend Service...
sc.exe query "WhatoFlowService" >nul 2>&1
if %errorLevel% equ 0 (
    sc.exe delete "WhatoFlowService" >nul 2>&1
    if !errorLevel! equ 0 (
        echo [OK] .NET Backend Service uninstalled
    ) else (
        echo [WARN] Failed to uninstall .NET Backend Service
    )
) else (
    echo [WARN] .NET Backend Service not found
)

:end
echo.
echo ====================================
echo Service Uninstallation Complete
echo ====================================


