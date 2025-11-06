# Windows Service 註冊說明

## 服務資訊

### 服務 1: WhatoFlow Web Service (.NET 後端)

- **服務名稱**: `WhatoFlowService`
- **顯示名稱**: `WhatoFlow Web Service`
- **描述**: `WhatoFlow 應用程式服務 - 提供 Web API 和前端介面`
- **啟動類型**: 自動啟動
- **執行帳戶**: LocalSystem
- **執行檔**: `WhatoFlow.exe`

### 服務 2: WhatoFlow Node.js Service (React 前端)

- **服務名稱**: `WhatoFlowNodeService`
- **顯示名稱**: `WhatoFlow Node.js Service`
- **描述**: `WhatoFlow React 前端開發伺服器服務`
- **啟動類型**: 自動啟動
- **執行命令**: `npm start`
- **使用工具**: NSSM (Non-Sucking Service Manager)

## 安裝說明

### 自動安裝（透過 MSI）

**注意**：目前 Node.js 服務的自動註冊已暫時禁用（因 WiX CustomAction 限制）。請使用以下手動方式註冊：

#### 方式 1: 使用手動安裝腳本（推薦）

MSI 安裝完成後，執行以下腳本：

```batch
cd "C:\Program Files\WhatoFlow"
.\install_nodejs_service_manual.bat
```

這個腳本會：
- 自動檢查並安裝 Node.js 服務
- 設定所有服務屬性
- 啟動服務

解除安裝時執行：
```batch
cd "C:\Program Files\WhatoFlow"
.\uninstall_nodejs_service_manual.bat
```

### 手動安裝（如果需要）

#### 手動安裝 WhatoFlow Web Service (.NET)

如果需要在 MSI 安裝之外手動註冊 .NET 服務，可以使用以下指令：

```batch
sc create WhatoFlowService binPath= "C:\Program Files\WhatoFlow\WhatoFlow.exe" start= auto DisplayName= "WhatoFlow Web Service"
sc description WhatoFlowService "WhatoFlow 應用程式服務 - 提供 Web API 和前端介面"
sc start WhatoFlowService
```

#### 手動安裝 WhatoFlow Node.js Service

如果需要在 MSI 安裝之外手動註冊 Node.js 服務，可以使用 NSSM：

```batch
cd "C:\Program Files\WhatoFlow"
nssm.exe install WhatoFlowNodeService "cmd.exe" /c "cd /d \"C:\Program Files\WhatoFlow\" && npm start"
nssm.exe set WhatoFlowNodeService AppDirectory "C:\Program Files\WhatoFlow"
nssm.exe set WhatoFlowNodeService DisplayName "WhatoFlow Node.js Service"
nssm.exe set WhatoFlowNodeService Description "WhatoFlow React 前端開發伺服器服務"
nssm.exe set WhatoFlowNodeService Start SERVICE_AUTO_START
nssm.exe start WhatoFlowNodeService
```

### 手動解除安裝

#### 解除安裝 WhatoFlow Web Service

```batch
sc stop WhatoFlowService
sc delete WhatoFlowService
```

#### 解除安裝 WhatoFlow Node.js Service

```batch
cd "C:\Program Files\WhatoFlow"
nssm.exe stop WhatoFlowNodeService
nssm.exe remove WhatoFlowNodeService confirm
```

## 服務架構說明

### 選項 A: 生產環境（推薦）

在生產環境中，React 前端通常編譯為靜態檔案：
- React 應用程式在建置時編譯為靜態檔案（HTML、CSS、JavaScript）
- 這些靜態檔案存放在 `wwwroot` 目錄中
- ASP.NET Core 應用程式（`WhatoFlowService`）會自動提供這些靜態檔案
- **只需要 `WhatoFlowService` 一個服務**

### 選項 B: 開發/測試環境

在開發或測試環境中，可能需要單獨的 Node.js 服務：
- 運行 `npm start` 啟動 React 開發伺服器（提供熱重載等功能）
- **需要兩個服務**：
  1. `WhatoFlowService` - .NET 後端 API
  2. `WhatoFlowNodeService` - React 前端開發伺服器

**注意**：如果您的生產環境使用編譯後的靜態檔案，則不需要 Node.js 服務。MSI 安裝程式會同時註冊兩個服務，您可以根據實際需求啟用或禁用其中一個。

## 服務管理

### 啟動服務

```batch
REM 啟動 .NET 服務
net start WhatoFlowService

REM 啟動 Node.js 服務（如果啟用）
net start WhatoFlowNodeService
```

### 停止服務

```batch
REM 停止 .NET 服務
net stop WhatoFlowService

REM 停止 Node.js 服務（如果啟用）
net stop WhatoFlowNodeService
```

### 查看服務狀態

```batch
REM 查看 .NET 服務狀態
sc query WhatoFlowService

REM 查看 Node.js 服務狀態
sc query WhatoFlowNodeService
```

### 使用 NSSM 管理 Node.js 服務

```batch
REM 查看 Node.js 服務詳細資訊
"C:\Program Files\WhatoFlow\nssm.exe" status WhatoFlowNodeService

REM 重啟 Node.js 服務
"C:\Program Files\WhatoFlow\nssm.exe" restart WhatoFlowNodeService

REM 查看 Node.js 服務日誌
"C:\Program Files\WhatoFlow\nssm.exe" get WhatoFlowNodeService AppStdout
```

## 日誌檔案

服務執行日誌存放在：
```
C:\Program Files\WhatoFlow\logs\
```

## 故障排除

1. **服務無法啟動**
   - 檢查日誌檔案：`C:\Program Files\WhatoFlow\logs\`
   - 確認 `appsettings.json` 配置正確
   - 確認資料庫連線字串正確
   - 確認連接埠未被占用

2. **服務無法訪問**
   - 檢查防火牆設定
   - 確認應用程式監聽的連接埠
   - 檢查 Windows 事件檢視器

3. **前端無法載入**
   - 確認 `wwwroot` 目錄存在且包含檔案
   - 檢查瀏覽器開發者工具的主控台錯誤
   - 確認 `appsettings.json` 中的前端路由設定正確

