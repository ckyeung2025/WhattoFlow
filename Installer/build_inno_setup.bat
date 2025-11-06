@echo off
REM Build script for Inno Setup installer
setlocal enabledelayedexpansion

echo ====================================
echo WhatoFlow Inno Setup Build Script
echo ====================================
echo.

set "SCRIPT_DIR=%~dp0"
set "INSTALLER_DIR=%SCRIPT_DIR%"
cd /d "%INSTALLER_DIR%"
cd ..
set "PROJECT_DIR=%CD%"
set "PUBLISH_DIR=%INSTALLER_DIR%publish"

REM Step 1: Check .NET SDK
echo [Step 1/7] Checking .NET SDK...
where dotnet >nul 2>&1
if errorlevel 1 (
    echo [ERROR] .NET SDK not found
    echo [ERROR] Please ensure .NET SDK is installed and in PATH
    pause
    exit /b 1
)
echo [OK] .NET SDK found
echo.

REM Step 2: Check Node.js
echo [Step 2/7] Checking Node.js...
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found
    echo [ERROR] Please ensure Node.js is installed and in PATH
    pause
    exit /b 1
)
where npm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm not found
    echo [ERROR] Please ensure Node.js is installed and in PATH
    pause
    exit /b 1
)
echo [OK] Node.js found
echo.

REM Step 3: Check Inno Setup
echo [Step 3/7] Checking Inno Setup...
REM Hardcoded path for testing
set "INNO_SETUP_PATH=C:\GIT\WhattoFlow\Installer\Inno Setup 6\ISCC.exe"

if not exist "!INNO_SETUP_PATH!" (
    echo [ERROR] Inno Setup not found at: !INNO_SETUP_PATH!
    pause
    exit /b 1
)

echo [OK] Inno Setup found
echo.

REM Step 4: Clean previous publish
echo [Step 4/7] Cleaning previous publish directory...
if exist "%PUBLISH_DIR%" (
    rmdir /s /q "%PUBLISH_DIR%" 2>nul
)
mkdir "%PUBLISH_DIR%" 2>nul
echo [OK] Cleaned publish directory
echo.

REM Step 5: Publish .NET application
echo [Step 5/7] Publishing .NET application...
cd /d "%PROJECT_DIR%"
dotnet publish -c Release -o "%PUBLISH_DIR%" --self-contained false
if errorlevel 1 (
    echo [ERROR] .NET publish failed
    pause
    exit /b 1
)
echo [OK] .NET application published
echo.

REM Step 6: Build React frontend
echo [Step 6/7] Building React frontend...
if exist "%PROJECT_DIR%\build" (
    rmdir /s /q "%PROJECT_DIR%\build" 2>nul
)
cd /d "%PROJECT_DIR%"
call npm install
if errorlevel 1 (
    echo [ERROR] npm install failed
    pause
    exit /b 1
)
call npm run build
if errorlevel 1 (
    echo [ERROR] React build failed
    pause
    exit /b 1
)

REM Copy frontend build to publish directory
if exist "%PROJECT_DIR%\build" (
    xcopy /E /I /Y "%PROJECT_DIR%\build\*" "%PUBLISH_DIR%\wwwroot\" >nul
    echo [OK] Frontend copied to publish directory
) else (
    echo [WARN] Build directory not found
)

REM Step 7: Sync version from .csproj to .iss
echo [Step 7/8] Syncing version from PurpleRice.csproj to WhatoFlow.Setup.iss...
set "CSPROJ_FILE=%PROJECT_DIR%\PurpleRice.csproj"
set "ISS_FILE=%INSTALLER_DIR%\WhatoFlow.Setup.iss"
set /a RAND_VAL2=%RANDOM%
set "TEMP_PS1=%TEMP%\sync_version_%RAND_VAL2%.ps1"

REM Create temporary PowerShell script file
(
echo $csproj = [xml](Get-Content '%CSPROJ_FILE%'^);
echo $versionNode = $csproj.SelectSingleNode('//Project/PropertyGroup/Version'^);
echo if ($versionNode -eq $null^) {
echo     Write-Host '[ERROR] Version not found in PurpleRice.csproj';
echo     exit 1;
echo }
echo $version = $versionNode.InnerText.Trim(^);
echo Write-Host "[INFO] Found version: $version";
echo $issContent = Get-Content '%ISS_FILE%' -Raw;
echo $issContent = $issContent -replace '#define MyAppVersion "[^"]*"', "#define MyAppVersion `"$version`"";
echo Set-Content '%ISS_FILE%' -Value $issContent -NoNewline -Encoding UTF8;
echo Write-Host "[OK] Updated WhatoFlow.Setup.iss with version: $version";
) > "%TEMP_PS1%"

REM Execute PowerShell script
powershell -NoProfile -ExecutionPolicy Bypass -File "%TEMP_PS1%"

REM Clean up temporary script
del "%TEMP_PS1%" >nul 2>&1

if errorlevel 1 (
    echo [ERROR] Version sync failed
    pause
    exit /b 1
)
echo.

REM Step 8: Build Inno Setup installer
echo [Step 8/8] Building Inno Setup installer...
cd /d "%INSTALLER_DIR%"
call "!INNO_SETUP_PATH!" "WhatoFlow.Setup.iss"
if errorlevel 1 (
    echo [ERROR] Inno Setup build failed
    pause
    exit /b 1
)

REM Get version for final message
for /f "tokens=*" %%v in ('powershell -NoProfile -ExecutionPolicy Bypass -Command "(Select-Xml -Path '%CSPROJ_FILE%' -XPath '//Project/PropertyGroup/Version').Node.InnerText.Trim()"') do set "VERSION=%%v"

echo.
echo ====================================
echo Build Complete!
echo ====================================
echo.
echo Installer location: %INSTALLER_DIR%bin\WhatoFlow-Setup-%VERSION%.exe
echo.
pause
