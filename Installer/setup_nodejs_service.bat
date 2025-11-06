@echo off
REM Node.js 服務自動安裝腳本（供 MSI CustomAction 使用）
REM 這個腳本會在 MSI 安裝時自動執行

set INSTALL_DIR=%~dp0
set SERVICE_NAME=WhatoFlowNodeService

REM 檢查必要檔案
if not exist "%INSTALL_DIR%nssm.exe" (
    exit /b 1
)

if not exist "%INSTALL_DIR%start-node-service.bat" (
    exit /b 1
)

REM 檢查服務是否已存在，如果存在則先移除
sc query %SERVICE_NAME% >nul 2>&1
if %errorLevel% equ 0 (
    "%INSTALL_DIR%nssm.exe" stop %SERVICE_NAME% >nul 2>&1
    "%INSTALL_DIR%nssm.exe" remove %SERVICE_NAME% confirm >nul 2>&1
)

REM 安裝服務
"%INSTALL_DIR%nssm.exe" install %SERVICE_NAME% "%INSTALL_DIR%start-node-service.bat" >nul 2>&1
if %errorLevel% neq 0 exit /b 1

REM 設定服務屬性
"%INSTALL_DIR%nssm.exe" set %SERVICE_NAME% AppDirectory "%INSTALL_DIR%" >nul 2>&1
"%INSTALL_DIR%nssm.exe" set %SERVICE_NAME% DisplayName "WhatoFlow Node.js Service" >nul 2>&1
"%INSTALL_DIR%nssm.exe" set %SERVICE_NAME% Description "WhatoFlow React 前端開發伺服器服務" >nul 2>&1
"%INSTALL_DIR%nssm.exe" set %SERVICE_NAME% Start SERVICE_AUTO_START >nul 2>&1

REM 啟動服務（失敗也不中斷安裝）
"%INSTALL_DIR%nssm.exe" start %SERVICE_NAME% >nul 2>&1

exit /b 0





