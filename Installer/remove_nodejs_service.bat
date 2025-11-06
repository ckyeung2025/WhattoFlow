@echo off
REM Node.js 服務自動移除腳本（供 MSI CustomAction 使用）
REM 這個腳本會在 MSI 卸載時自動執行

set INSTALL_DIR=%~dp0
set SERVICE_NAME=WhatoFlowNodeService

if not exist "%INSTALL_DIR%nssm.exe" (
    exit /b 0
)

REM 停止並移除服務
"%INSTALL_DIR%nssm.exe" stop %SERVICE_NAME% >nul 2>&1
"%INSTALL_DIR%nssm.exe" remove %SERVICE_NAME% confirm >nul 2>&1

exit /b 0





