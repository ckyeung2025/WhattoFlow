@echo off
REM 手動安裝 Node.js 服務的腳本
REM 可以在 MSI 安裝後執行此腳本來註冊 Node.js 服務
REM 支援靜默模式：如果環境變數 SILENT=1，則不顯示 pause

set INSTALL_DIR=%~dp0
set SERVICE_NAME=WhatoFlowNodeService

echo [安裝 Node.js 服務] 正在註冊服務...
echo 安裝目錄: %INSTALL_DIR%
echo 服務名稱: %SERVICE_NAME%

if not exist "%INSTALL_DIR%nssm.exe" (
    echo [錯誤] 找不到 nssm.exe
    echo 請確認 NSSM 已正確安裝
    if not "%SILENT%"=="1" pause
    exit /b 1
)

if not exist "%INSTALL_DIR%start-node-service.bat" (
    echo [錯誤] 找不到 start-node-service.bat
    if not "%SILENT%"=="1" pause
    exit /b 1
)

REM 檢查服務是否已存在
sc query %SERVICE_NAME% >nul 2>&1
if %errorLevel% equ 0 (
    echo [資訊] 服務已存在，正在移除舊服務...
    "%INSTALL_DIR%nssm.exe" stop %SERVICE_NAME%
    "%INSTALL_DIR%nssm.exe" remove %SERVICE_NAME% confirm
)

REM 安裝服務
echo [執行] 正在安裝服務...
"%INSTALL_DIR%nssm.exe" install %SERVICE_NAME% "%INSTALL_DIR%start-node-service.bat"

if %errorLevel% neq 0 (
    echo [錯誤] 服務安裝失敗
    pause
    exit /b 1
)

REM 設定服務屬性
echo [設定] 正在設定服務屬性...
"%INSTALL_DIR%nssm.exe" set %SERVICE_NAME% AppDirectory "%INSTALL_DIR%"
"%INSTALL_DIR%nssm.exe" set %SERVICE_NAME% DisplayName "WhatoFlow Node.js Service"
"%INSTALL_DIR%nssm.exe" set %SERVICE_NAME% Description "WhatoFlow React 前端開發伺服器服務"
"%INSTALL_DIR%nssm.exe" set %SERVICE_NAME% Start SERVICE_AUTO_START

REM 啟動服務
echo [啟動] 正在啟動服務...
"%INSTALL_DIR%nssm.exe" start %SERVICE_NAME%

if %errorLevel% equ 0 (
    echo [完成] Node.js 服務安裝成功！
) else (
    echo [警告] 服務安裝成功，但啟動失敗
    echo 請檢查 Node.js 和 npm 是否已正確安裝
)

if not "%SILENT%"=="1" pause


