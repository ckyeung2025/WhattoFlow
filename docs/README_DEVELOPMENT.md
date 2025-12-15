# 開發環境說明

## 啟動開發服務器

### 後端 (.NET)
```cmd
dotnet run
```
- 端口：從 `appsettings.json` 的 `Ports.DotNet` 讀取（預設: 64213）
- 配置位置：`Program.cs` 中自動讀取

### 前端 (React)
```cmd
npm start
```
- 端口：從 `appsettings.json` 的 `Ports.NodeJs` 讀取（預設: 3000）
- 配置方式：`package.json` 的 `start` 腳本會先執行 `read-port-from-config.js`

## 端口配置

所有端口配置統一在 `appsettings.json` 中：

```json
{
  "Ports": {
    "DotNet": 64213,
    "NodeJs": 3000
  }
}
```

### 修改端口

1. **修改 .NET 端口**：
   - 編輯 `appsettings.json` 中的 `Ports.DotNet`
   - 重啟 `dotnet run`

2. **修改 Node.js 端口**：
   - 編輯 `appsettings.json` 中的 `Ports.NodeJs`
   - 重啟 `npm start`

### 使用環境變量（備選方案）

如果不想修改 `appsettings.json`，也可以通過環境變量：

**Windows (CMD)**:
```cmd
set PORT=3001 && npm start
```

**Windows (PowerShell)**:
```powershell
$env:PORT=3001; npm start
```

**Linux/Mac**:
```bash
PORT=3001 npm start
```

注意：環境變量會優先於 `appsettings.json` 配置。

## 代理配置

React 開發服務器會自動代理 API 請求到 .NET 後端：
- 代理地址：從 `appsettings.json` 的 `Ports.DotNet` 讀取
- 配置文件：`src/setupProxy.js`

## 測試不同端口

### 場景 1：使用 appsettings.json（推薦）
```json
{
  "Ports": {
    "DotNet": 5000,
    "NodeJs": 3001
  }
}
```
然後重啟服務。

### 場景 2：臨時測試不同端口
```cmd
REM .NET 使用環境變量
set ASPNETCORE_URLS=http://localhost:5000 && dotnet run

REM Node.js 使用環境變量
set PORT=3001 && npm start
```

## 常見問題

**Q: 修改了 appsettings.json 但端口沒變？**
A: 需要重啟服務。Node.js 在啟動時讀取配置。

**Q: 如何確認當前使用的端口？**
A: 
- .NET: 查看啟動日誌，會顯示監聽的 URL
- Node.js: 查看啟動日誌，會顯示 "Local: http://localhost:XXXX"

**Q: 端口被占用怎麼辦？**
A: 
1. 修改 `appsettings.json` 中的端口號
2. 或者通過環境變量覆蓋：
   ```cmd
   set PORT=3001 && npm start
   ```




