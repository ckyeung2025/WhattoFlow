# Node.js 端口配置說明

## 配置流程

Node.js 應用通過以下方式讀取 `appsettings.json` 中的 `Ports.NodeJs` 配置：

### 1. **read-port-from-config.js** （項目根目錄）
- **位置**：`read-port-from-config.js`
- **功能**：讀取 `appsettings.json` 中的 `Ports.NodeJs` 配置
- **工作方式**：
  ```javascript
  const config = JSON.parse(fs.readFileSync('appsettings.json', 'utf8'));
  const nodePort = config.Ports?.NodeJs || 3000;
  process.env.PORT = nodePort.toString(); // 設置環境變量
  ```

### 2. **start-node-service.bat** （服務啟動腳本）
- **位置**：`Installer/publish/start-node-service.bat`
- **功能**：在啟動 npm 之前先讀取配置
- **執行順序**：
  1. 執行 `node read-port-from-config.js` → 設置 `PORT` 環境變量
  2. 執行 `npm start` → React 應用會自動使用 `PORT` 環境變量

### 3. **React Scripts 自動使用 PORT**
- `react-scripts start` 會自動讀取 `PORT` 環境變量
- 如果沒有設置，預設使用 3000

## 文件關係

```
項目根目錄/
├── appsettings.json          # 包含 Ports.NodeJs 配置
├── read-port-from-config.js  # 讀取配置並設置 PORT 環境變量
└── src/
    └── setupProxy.js         # 代理配置（也需要動態端口）
```

```
Installer/publish/
├── appsettings.json           # 安裝時會更新 Ports.NodeJs
├── read-port-from-config.js  # 從項目根目錄複製
└── start-node-service.bat    # Windows Service 啟動腳本
```

## 安裝後的執行流程

1. Windows Service 啟動 `start-node-service.bat`
2. `start-node-service.bat` 執行 `node read-port-from-config.js`
3. `read-port-from-config.js` 讀取 `appsettings.json` 中的 `Ports.NodeJs`
4. 設置 `process.env.PORT = 配置的端口`
5. 執行 `npm start`
6. `react-scripts start` 使用 `PORT` 環境變量啟動服務器

## 注意事項

- `read-port-from-config.js` 必須與 `appsettings.json` 在同一目錄或父目錄
- `setupProxy.js` 中的端口（64213）也需要動態讀取，但目前硬編碼
- 在開發環境中，可以直接使用 `npm start`（會使用預設端口 3000）




