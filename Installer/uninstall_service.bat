@echo off
setlocal

set SERVICE_NAME=WhatoFlowService

echo ====================================
echo WhatoFlow Windows Service 解除安裝
echo ====================================
echo.

REM 檢查是否以管理員權限執行
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [錯誤] 請以管理員權限執行此腳本！
    pause
    exit /b 1
)

REM 檢查服務是否存在
sc query %SERVICE_NAME% >nul 2>&1
if %errorLevel% neq 0 (
    echo [訊息] 服務不存在，無需解除安裝
    pause
    exit /b 0
)

echo [停止] 正在停止服務...
sc stop %SERVICE_NAME%
timeout /t 3 /nobreak >nul

echo [刪除] 正在刪除服務...
sc delete %SERVICE_NAME%
if %errorLevel% equ 0 (
    echo [完成] 服務已成功刪除
) else (
    echo [錯誤] 服務刪除失敗
    pause
    exit /b 1
)

echo.
echo ====================================
echo 解除安裝完成！
echo ====================================
pause

