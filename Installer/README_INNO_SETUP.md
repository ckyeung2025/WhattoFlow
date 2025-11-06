# WhatoFlow Inno Setup 安裝包說明

## 概述

本項目使用 **Inno Setup** 來創建 WhatoFlow 的安裝程序，提供完整的圖形化安裝界面。

## 功能特性

✅ **自定義安裝目錄選擇** - 用戶可以選擇安裝位置  
✅ **.NET 後端端口配置** - 可在安裝時設置後端端口（預設: 64213）  
✅ **Node.js 前端端口配置** - 可在安裝時設置前端端口（預設: 3000）  
✅ **數據庫連接字符串配置** - 可在安裝時設置主數據庫連接  
✅ **自動註冊 Windows 服務** - 自動安裝 .NET 和 Node.js 服務  
✅ **完整卸載支持** - 自動清理服務和文件  

## 系統要求

### 開發環境
- Windows 10/11 或 Windows Server 2019+
- .NET 8.0 SDK
- Node.js 18+
- Inno Setup 6+ ([下載連結](https://jrsoftware.org/isdl.php))

### 目標系統
- Windows 10/11 或 Windows Server 2019+
- .NET 8.0 Runtime
- Node.js 18+
- SQL Server 2019+

## 安裝 Inno Setup

1. 下載 Inno Setup 6: https://jrsoftware.org/isdl.php
2. 安裝到預設位置：`C:\Program Files (x86)\Inno Setup 6\`
3. 或者安裝到：`C:\Program Files\Inno Setup 6\`

## 建置安裝包

運行建置腳本：

```cmd
cd C:\GIT\WhattoFlow\Installer
build_inno_setup.bat
```

建置過程會：
1. 檢查 .NET SDK
2. 檢查 Node.js
3. 檢查 Inno Setup
4. 清理舊的發佈文件
5. 發佈 .NET 應用
6. 建置 React 前端
7. 下載 NSSM（如果需要）
8. 建置 Inno Setup 安裝包

建置完成後，安裝包位於：
```
Installer\bin\WhatoFlow-Setup-1.0.0.exe
```

## 安裝流程

當用戶運行安裝包時，會看到以下步驟：

1. **歡迎頁面** - 歡迎信息
2. **安裝目錄選擇** - 選擇安裝位置（預設: `C:\Program Files\WhatoFlow`）
3. **後端端口配置** - 輸入 .NET 後端端口（預設: 64213）
4. **前端端口配置** - 輸入 React 前端端口（預設: 3000）
5. **數據庫連接配置** - 輸入主數據庫連接字符串
6. **確認安裝** - 確認安裝信息
7. **安裝進度** - 複製文件
8. **完成** - 安裝完成，可選擇啟動服務

## 配置文件更新

安裝程序會自動更新以下文件：

### appsettings.json
- 更新 `ConnectionStrings.PurpleRice` 為用戶輸入的連接字符串

### package.json
- 更新 `proxy` 設置為用戶輸入的 .NET 端口

## Windows 服務

安裝程序會自動註冊兩個 Windows 服務：

1. **WhatoFlowService** - .NET 後端服務
   - 服務名稱: `WhatoFlowService`
   - 可執行文件: `WhatoFlow.exe`
   - 啟動類型: 自動

2. **WhatoFlowFrontendService** - Node.js 前端服務
   - 服務名稱: `WhatoFlowFrontendService`
   - 使用 NSSM 管理
   - 啟動類型: 自動
   - 端口通過環境變量設置

## 手動啟動服務

如果服務沒有自動啟動，可以手動啟動：

```cmd
net start WhatoFlowService
net start WhatoFlowFrontendService
```

## 卸載

通過 Windows 控制面板卸載，或者運行：

```cmd
%INSTALL_DIR%\unins000.exe
```

卸載過程會：
1. 停止所有服務
2. 卸載服務
3. 刪除所有文件
4. 清理註冊表

## 自定義配置

### 修改應用程序信息

編輯 `WhatoFlow.Setup.iss`：

```pascal
#define MyAppName "WhatoFlow"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Starchy Solution"
```

### 修改預設端口

編輯 `WhatoFlow.Setup.iss` 中的 `InitializeWizard` 函數：

```pascal
DotNetPortPage.Values[0] := '64213';  // 修改為你的預設端口
NodePortPage.Values[0] := '3000';    // 修改為你的預設端口
```

### 修改預設數據庫連接

編輯 `WhatoFlow.Setup.iss` 中的 `InitializeWizard` 函數：

```pascal
DatabaseConnPage.Values[0] := '你的預設連接字符串';
```

## 故障排除

### 建置失敗：Inno Setup not found
- 確保 Inno Setup 已安裝
- 檢查安裝路徑是否正確
- 可以手動修改 `build_inno_setup.bat` 中的路徑

### 服務安裝失敗
- 確保以管理員權限運行安裝程序
- 檢查 NSSM 是否正確下載
- 查看 `install_services.bat` 的輸出信息

### 端口已被占用
- 選擇其他端口
- 檢查防火牆設置
- 確保之前的服務已停止

## 技術細節

### 腳本結構
- `WhatoFlow.Setup.iss` - Inno Setup 主腳本
- `build_inno_setup.bat` - 建置腳本
- `install_services.bat` - 服務安裝腳本（由安裝程序調用）
- `uninstall_services.bat` - 服務卸載腳本（由卸載程序調用）

### 配置文件修改
安裝程序使用 Pascal 腳本直接修改 JSON 文件，確保：
- 正確的 JSON 格式
- 保留其他配置不變
- 正確的字符串轉義

## 參考資料

- [Inno Setup 官方文檔](https://jrsoftware.org/ishelp/)
- [Inno Setup 腳本參考](https://jrsoftware.org/ishelp/index.php)
- [Pascal 腳本文檔](https://jrsoftware.org/ishelp/index.php?topic=scripting)




