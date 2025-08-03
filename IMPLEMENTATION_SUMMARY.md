# LibreOffice 文檔轉換功能實現總結

## 🎯 實現目標

成功實現了使用 LibreOffice 將各種文檔格式轉換為 HTML 的功能，支持：
- **Word 文檔** (.doc, .docx)
- **Excel 表格** (.xls, .xlsx)  
- **PowerPoint 簡報** (.ppt, .pptx)
- **PDF 文件** (.pdf)
- **RTF 文檔** (.rtf)
- **純文本文件** (.txt)

## 📁 新增文件

### 1. 核心服務
- **`Services/DocumentConverterService.cs`** - LibreOffice 轉換服務
  - 自動檢測 LibreOffice 安裝路徑
  - 支持多種文檔格式轉換
  - 包含詳細的錯誤處理和日誌記錄
  - 提供 HTML 後處理功能

### 2. 安裝腳本
- **`InstallLibreOffice.ps1`** - LibreOffice 自動安裝腳本
  - 支持 winget 自動安裝
  - 備用手動下載安裝
  - 自動測試安裝結果

### 3. 文檔說明
- **`README_DocumentConverter.md`** - 詳細使用說明
- **`IMPLEMENTATION_SUMMARY.md`** - 本總結文檔

### 4. 測試文件
- **`test_upload.html`** - 前端測試頁面
- **`test_document.txt`** - 測試文檔

## 🔧 修改的文件

### 1. 控制器更新
- **`Controllers/FormsUploadController.cs`**
  - 添加 `DocumentConverterService` 依賴注入
  - 新增 `/api/FormsUpload/document` 端點
  - 支持多種文檔格式上傳
  - 保留原有的 `/api/FormsUpload/word` 端點（重定向到新端點）

### 2. 依賴注入配置
- **`Program.cs`**
  - 註冊 `DocumentConverterService` 服務

## 🚀 功能特點

### 1. 智能安裝檢測
```csharp
private string FindLibreOfficePath()
{
    // 檢查常見安裝路徑
    // 支持 Windows/Linux/macOS
    // 自動從 PATH 環境變量查找
}
```

### 2. 高質量轉換
- 使用 LibreOffice 命令行工具
- 支持複雜文檔格式
- 保持原始排版和樣式
- 正確處理表格和圖片

### 3. 響應式 HTML 輸出
```csharp
private string AddResponsiveStyles(string html)
{
    // 添加響應式 CSS 樣式
    // 支持移動設備顯示
    // 優化打印效果
}
```

### 4. 詳細錯誤處理
- 完整的異常捕獲
- 詳細的日誌記錄
- 友好的錯誤提示
- 自動重試機制

## 📊 支持的格式對比

| 格式 | LibreOffice | 原 OpenXML | 備註 |
|------|-------------|------------|------|
| .doc/.docx | ✅ | ✅ | LibreOffice 質量更高 |
| .xls/.xlsx | ✅ | ❌ | 新增支持 |
| .ppt/.pptx | ✅ | ❌ | 新增支持 |
| .pdf | ✅ | ❌ | 新增支持 |
| .rtf | ✅ | ❌ | 新增支持 |
| .txt | ✅ | ❌ | 新增支持 |

## 🔄 API 端點

### 新的通用端點
```
POST /api/FormsUpload/document
```

**支持的文件類型**:
- `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (.docx)
- `application/msword` (.doc)
- `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (.xlsx)
- `application/vnd.ms-excel` (.xls)
- `application/pdf` (.pdf)
- `application/vnd.openxmlformats-officedocument.presentationml.presentation` (.pptx)
- `application/vnd.ms-powerpoint` (.ppt)
- `application/rtf` (.rtf)
- `text/plain` (.txt)

### 響應格式
```json
{
    "success": true,
    "formId": "12345678-1234-1234-1234-123456789012",
    "htmlContent": "<html>...</html>",
    "formName": "我的文檔",
    "sourceFilePath": "Documents/20231201120000_12345678-1234-1234-1234-123456789012.docx",
    "message": "文檔已成功轉換並創建表單"
}
```

## 🛠️ 安裝和使用

### 1. 安裝 LibreOffice
```powershell
# 自動安裝（推薦）
.\InstallLibreOffice.ps1

# 手動安裝
winget install TheDocumentFoundation.LibreOffice
```

### 2. 測試轉換功能
```bash
# 啟動應用程序
dotnet run

# 訪問測試頁面
http://localhost:5000/test_upload.html
```

### 3. 使用 API
```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);

fetch('/api/FormsUpload/document', {
    method: 'POST',
    body: formData
})
.then(response => response.json())
.then(data => {
    console.log('轉換成功:', data);
});
```

## 📈 性能優化

### 1. 並發處理
- 支持多個文件同時轉換
- 建議限制並發數量避免資源競爭

### 2. 文件管理
- 自動生成唯一文件名
- 分類存儲（Documents/ 目錄）
- 支持大文件（最大 50MB）

### 3. 緩存機制
- 可以考慮添加轉換結果緩存
- 避免重複轉換相同文件

## 🔒 安全考慮

### 1. 文件驗證
- 檢查文件類型
- 驗證文件大小
- 掃描惡意內容

### 2. 路徑安全
- 使用安全的文件路徑
- 避免路徑遍歷攻擊

### 3. 權限控制
- 限制上傳權限
- 控制文件訪問

## 🎉 優勢總結

### 相比原 OpenXML 方案
1. **更多格式支持** - 從僅支持 Word 擴展到 6 種格式
2. **更高轉換質量** - LibreOffice 專業級轉換引擎
3. **更好的兼容性** - 支持各種文檔版本和格式
4. **更強的穩定性** - 成熟的開源解決方案

### 相比其他商業方案
1. **免費開源** - 無需支付授權費用
2. **本地部署** - 數據安全，無需網絡依賴
3. **完全控制** - 可自定義轉換選項
4. **社區支持** - 活躍的開發社區

## 🚀 未來擴展

### 1. 更多格式支持
- OpenDocument 格式 (.odt, .ods, .odp)
- 更多圖片格式
- 壓縮文件 (.zip, .rar)

### 2. 轉換選項
- 自定義輸出格式
- 樣式模板
- 批量轉換

### 3. 雲端集成
- Google Docs API
- Microsoft Office 365 API
- 其他雲端服務

## 📞 技術支持

如果遇到問題：
1. 檢查 LibreOffice 安裝：`soffice --version`
2. 查看應用程序日誌
3. 確認文件格式支持
4. 運行安裝腳本：`.\InstallLibreOffice.ps1`

---

**實現完成！** 🎉 現在您的系統支持使用 LibreOffice 將各種文檔格式忠實轉換為 HTML，包括 Word、Excel、PowerPoint、PDF、RTF 和純文本文件。 