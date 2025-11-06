@echo off
REM 下載 NSSM (Non-Sucking Service Manager) 用於註冊 Node.js 服務
REM NSSM 是一個工具，可以將任何可執行檔案註冊為 Windows Service

set NSSM_VERSION=2.24
set NSSM_URL=https://nssm.cc/release/nssm-%NSSM_VERSION%.zip
set DOWNLOAD_DIR=%~dp0
set NSSM_ZIP=%DOWNLOAD_DIR%nssm-%NSSM_VERSION%.zip
set NSSM_DIR=%DOWNLOAD_DIR%nssm-%NSSM_VERSION%

echo [下載 NSSM] 準備下載 NSSM %NSSM_VERSION%...
echo 來源: %NSSM_URL%
echo.

REM 檢查是否已存在
if exist "%DOWNLOAD_DIR%nssm.exe" (
    echo [完成] NSSM 已存在: %DOWNLOAD_DIR%nssm.exe
    goto :end
)

REM 檢查是否已下載 ZIP
if exist "%NSSM_ZIP%" (
    echo [發現] NSSM ZIP 已存在，正在解壓...
    goto :extract
)

REM 下載 NSSM
echo [下載] 正在下載 NSSM...
powershell -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%NSSM_URL%' -OutFile '%NSSM_ZIP%'}"

if %errorLevel% neq 0 (
    echo [錯誤] NSSM 下載失敗
    echo 請手動下載 NSSM 並解壓到 Installer 目錄
    echo 下載網址: %NSSM_URL%
    echo 解壓後將 win64\nssm.exe 複製到 Installer\nssm.exe
    pause
    exit /b 1
)

echo [完成] NSSM 下載成功

:extract
REM 解壓 NSSM
echo [解壓] 正在解壓 NSSM...
powershell -Command "Expand-Archive -Path '%NSSM_ZIP%' -DestinationPath '%DOWNLOAD_DIR%' -Force"

REM 複製 nssm.exe 到 Installer 目錄
if exist "%NSSM_DIR%\win64\nssm.exe" (
    copy /Y "%NSSM_DIR%\win64\nssm.exe" "%DOWNLOAD_DIR%nssm.exe" >nul
    echo [完成] NSSM 已複製到: %DOWNLOAD_DIR%nssm.exe
) else if exist "%NSSM_DIR%\win32\nssm.exe" (
    copy /Y "%NSSM_DIR%\win32\nssm.exe" "%DOWNLOAD_DIR%nssm.exe" >nul
    echo [完成] NSSM 已複製到: %DOWNLOAD_DIR%nssm.exe
) else (
    echo [錯誤] 找不到 nssm.exe
    echo 請檢查解壓後的目錄結構
    pause
    exit /b 1
)

REM 清理臨時檔案
if exist "%NSSM_DIR%" rmdir /s /q "%NSSM_DIR%" 2>nul
if exist "%NSSM_ZIP%" del /q "%NSSM_ZIP%" 2>nul

:end
echo.
echo [完成] NSSM 準備就緒
echo.





