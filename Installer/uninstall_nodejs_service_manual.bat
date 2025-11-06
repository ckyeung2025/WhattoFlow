@echo off
REM 手動解除安裝 Node.js 服務的腳本

set INSTALL_DIR=%~dp0
set SERVICE_NAME=WhatoFlowNodeService

echo [解除安裝 Node.js 服務] 正在移除服務...

if not exist "%INSTALL_DIR%nssm.exe" (
    echo [錯誤] 找不到 nssm.exe
    pause
    exit /b 1
)

REM 停止並移除服務
"%INSTALL_DIR%nssm.exe" stop %SERVICE_NAME%
"%INSTALL_DIR%nssm.exe" remove %SERVICE_NAME% confirm

if %errorLevel% equ 0 (
    echo [完成] Node.js 服務已移除
) else (
    echo [警告] 服務可能不存在或已經移除
)

pause





