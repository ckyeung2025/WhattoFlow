@echo off
setlocal enabledelayedexpansion

echo ====================================
echo WhatoFlow Windows Service 安裝程式
echo （包含前端 React 建置）
echo ====================================
echo.

REM 設定變數
set SERVICE_NAME=WhatoFlowService
set SERVICE_DISPLAY_NAME=WhatoFlow Web Service
set SERVICE_DESCRIPTION=WhatoFlow 應用程式服務
set INSTALL_DIR=%~dp0..
set PUBLISH_DIR=%INSTALL_DIR%publish
set EXE_NAME=WhatoFlow.exe

REM 檢查是否以管理員權限執行
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [錯誤] 請以管理員權限執行此腳本！
    echo 右鍵點擊此檔案，選擇「以系統管理員身分執行」
    pause
    exit /b 1
)

echo [步驟 1/8] 檢查 .NET 8.0 Runtime 是否已安裝...
where dotnet >nul 2>&1
if %errorLevel% neq 0 (
    echo [錯誤] 未找到 .NET CLI，請先安裝 .NET 8.0 Runtime 或 SDK
    echo 下載連結: https://dotnet.microsoft.com/download/dotnet/8.0
    pause
    exit /b 1
)

dotnet --version | findstr /R "^8\." >nul
if %errorLevel% neq 0 (
    echo [警告] 偵測到的 .NET 版本可能不是 8.0
    echo 繼續執行...
)
echo [完成] .NET Runtime 檢查通過
echo.

echo [步驟 2/8] 檢查 Node.js 是否已安裝...
where node >nul 2>&1
if %errorLevel% neq 0 (
    echo [錯誤] 未找到 Node.js，請先安裝 Node.js 18 或更高版本
    echo 下載連結: https://nodejs.org/
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node --version') do set NODE_VERSION=%%v
echo [完成] Node.js 版本: %NODE_VERSION%
echo.

echo [步驟 3/8] 安裝前端依賴套件...
cd /d "%INSTALL_DIR%"
if not exist "%INSTALL_DIR%node_modules" (
    echo [執行] npm install...
    call npm install
    if %errorLevel% neq 0 (
        echo [錯誤] npm install 失敗
        pause
        exit /b 1
    )
    echo [完成] 前端依賴安裝成功
) else (
    echo [略過] node_modules 已存在，跳過安裝
)
echo.

echo [步驟 4/8] 建置前端 React 應用程式...
echo [執行] npm run build...
cd /d "%INSTALL_DIR%"
call npm run build
if %errorLevel% neq 0 (
    echo [錯誤] 前端建置失敗
    pause
    exit /b 1
)
echo [完成] 前端建置成功
echo.

echo [步驟 5/8] 檢查服務是否已存在...
sc query %SERVICE_NAME% >nul 2>&1
if %errorLevel% equ 0 (
    echo [發現] 服務已存在，正在停止並刪除舊服務...
    sc stop %SERVICE_NAME% >nul 2>&1
    timeout /t 3 /nobreak >nul
    sc delete %SERVICE_NAME%
    if %errorLevel% neq 0 (
        echo [錯誤] 無法刪除舊服務，請手動處理
        pause
        exit /b 1
    )
    echo [完成] 舊服務已刪除
) else (
    echo [完成] 服務不存在，將建立新服務
)
echo.

echo [步驟 6/8] 發佈應用程式...
if exist "%PUBLISH_DIR%" (
    echo [清理] 刪除舊的發佈目錄...
    rmdir /s /q "%PUBLISH_DIR%"
)

cd /d "%INSTALL_DIR%"
dotnet publish PurpleRice.csproj -c Release -o "%PUBLISH_DIR%" --self-contained false
if %errorLevel% neq 0 (
    echo [錯誤] 發佈失敗
    pause
    exit /b 1
)
echo [完成] 應用程式發佈成功
echo.

REM 複製前端建置結果到發佈目錄的 wwwroot
echo [步驟 7/8] 複製前端建置檔案到發佈目錄...
if exist "%INSTALL_DIR%build" (
    if exist "%PUBLISH_DIR%\wwwroot" (
        echo [清理] 刪除舊的 wwwroot 目錄...
        rmdir /s /q "%PUBLISH_DIR%\wwwroot"
    )
    echo [複製] 複製 build 目錄到 wwwroot...
    xcopy /E /I /Y "%INSTALL_DIR%build\*" "%PUBLISH_DIR%\wwwroot\" >nul
    if %errorLevel% equ 0 (
        echo [完成] 前端檔案複製成功
    ) else (
        echo [警告] 前端檔案複製時出現問題，繼續執行...
    )
) else (
    echo [警告] 未找到 build 目錄，請確認前端建置是否成功
)
echo.

REM 建立必要的目錄
echo [步驟 8/8] 建立必要的目錄結構...
if not exist "%PUBLISH_DIR%\logs" mkdir "%PUBLISH_DIR%\logs"
if not exist "%PUBLISH_DIR%\Uploads" mkdir "%PUBLISH_DIR%\Uploads"
if not exist "%PUBLISH_DIR%\Uploads\Customer" mkdir "%PUBLISH_DIR%\Uploads\Customer"
if not exist "%PUBLISH_DIR%\Uploads\FormsFiles" mkdir "%PUBLISH_DIR%\Uploads\FormsFiles"
if not exist "%PUBLISH_DIR%\Uploads\FormsFiles\Documents" mkdir "%PUBLISH_DIR%\Uploads\FormsFiles\Documents"
if not exist "%PUBLISH_DIR%\Uploads\avatars" mkdir "%PUBLISH_DIR%\Uploads\avatars"
if not exist "%PUBLISH_DIR%\Uploads\company_logo" mkdir "%PUBLISH_DIR%\Uploads\company_logo"
if not exist "%PUBLISH_DIR%\Uploads\excel" mkdir "%PUBLISH_DIR%\Uploads\excel"
if not exist "%PUBLISH_DIR%\Uploads\Whatsapp_Images" mkdir "%PUBLISH_DIR%\Uploads\Whatsapp_Images"
echo [完成] 目錄結構建立完成
echo.

REM 註冊 Windows Service
echo [註冊] 註冊 Windows Service...
sc create %SERVICE_NAME% ^
    binPath="%PUBLISH_DIR%\%EXE_NAME%" ^
    DisplayName="%SERVICE_DISPLAY_NAME%" ^
    Description="%SERVICE_DESCRIPTION%" ^
    start=auto

if %errorLevel% neq 0 (
    echo [錯誤] 服務註冊失敗
    pause
    exit /b 1
)
echo [完成] 服務註冊成功
echo.

REM 設定服務描述
sc description %SERVICE_NAME% "%SERVICE_DESCRIPTION%"

REM 啟動服務
echo [啟動] 啟動服務...
sc start %SERVICE_NAME%
if %errorLevel% neq 0 (
    echo [錯誤] 服務啟動失敗，請檢查日誌
    echo 您可以使用以下命令檢查服務狀態：
    echo   sc query %SERVICE_NAME%
    pause
    exit /b 1
)

timeout /t 2 /nobreak >nul
sc query %SERVICE_NAME% | findstr /C:"RUNNING" >nul
if %errorLevel% equ 0 (
    echo [完成] 服務啟動成功！
) else (
    echo [警告] 服務可能未正常啟動，請檢查狀態
)
echo.

echo ====================================
echo 安裝完成！
echo ====================================
echo 服務名稱: %SERVICE_NAME%
echo 服務路徑: %PUBLISH_DIR%
echo 執行檔: %EXE_NAME%
echo.
echo 常用命令：
echo   查詢狀態: sc query %SERVICE_NAME%
echo   停止服務: sc stop %SERVICE_NAME%
echo   啟動服務: sc start %SERVICE_NAME%
echo   刪除服務: sc delete %SERVICE_NAME%
echo.
echo 前端檔案位置: %PUBLISH_DIR%\wwwroot
echo.
pause

