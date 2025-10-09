# Google Sheets API 設置指南

## 問題說明

Google Sheets API 需要 API Key 才能訪問，即使是公開的表格也需要身份驗證。錯誤信息：
```
Method doesn't allow unregistered callers (callers without established identity). Please use API Key or other form of API consumer identity to call this API.
```

## 解決方案

### 1. 獲取 Google Sheets API Key

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 創建新專案或選擇現有專案
3. 啟用 Google Sheets API：
   - 前往「API 和服務」→「程式庫」
   - 搜尋「Google Sheets API」
   - 點擊「啟用」
4. 創建 API Key：
   - 前往「API 和服務」→「憑證」
   - 點擊「建立憑證」→「API 金鑰」
   - 複製生成的 API Key

### 2. 設置 API Key

#### 方法 1：環境變量（推薦）
```bash
# Windows PowerShell
$env:GOOGLE_API_KEY="your_api_key_here"

# Windows CMD
set GOOGLE_API_KEY=your_api_key_here

# Linux/macOS
export GOOGLE_API_KEY="your_api_key_here"
```

#### 方法 2：在 appsettings.json 中添加
```json
{
  "GoogleApiKey": "your_api_key_here"
}
```

### 3. 測試表格權限

確保您的 Google Sheets 表格：
1. 設為「任何人都可以查看」
2. 表格 ID 正確提取
3. 工作表名稱正確

### 4. 測試連接

使用以下 URL 測試您的表格：
```
https://docs.google.com/spreadsheets/d/1Nl4gayvUk3zSf6E1-YyGuLmjwd6WqI4GJ_NkfAXRSpI/edit?usp=sharing
```

表格 ID：`1Nl4gayvUk3zSf6E1-YyGuLmjwd6WqI4GJ_NkfAXRSpI`

## 安全注意事項

1. **限制 API Key 使用**：
   - 在 Google Cloud Console 中限制 API Key 只能訪問 Google Sheets API
   - 設置 IP 地址限制（如果可能）
   - 設置使用配額限制

2. **不要將 API Key 提交到版本控制**：
   - 使用環境變量
   - 添加到 `.gitignore`
   - 不要在代碼中硬編碼

## 故障排除

### 常見錯誤

1. **403 Forbidden**：
   - 檢查 API Key 是否正確
   - 確認 Google Sheets API 已啟用
   - 檢查表格權限設置

2. **404 Not Found**：
   - 確認表格 ID 正確
   - 檢查表格是否存在且可訪問

3. **400 Bad Request**：
   - 檢查工作表名稱是否正確
   - 確認範圍格式正確

### 日誌檢查

查看應用程序日誌以獲取詳細錯誤信息：
- 日誌文件位置：`logs/GoogleSheetsService_*.log`
- 檢查連接測試結果
- 查看數據讀取過程
