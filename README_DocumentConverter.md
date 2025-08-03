# 文檔轉換功能說明

## 概述

本系統現在支持使用 LibreOffice 將各種文檔格式轉換為 HTML，包括：

- **Word 文檔**: `.doc`, `.docx`
- **Excel 表格**: `.xls`, `.xlsx`
- **PowerPoint 簡報**: `.ppt`, `.pptx`
- **PDF 文件**: `.pdf`
- **RTF 文檔**: `.rtf`
- **純文本文件**: `.txt`

## 安裝 LibreOffice

### Windows 用戶

1. **自動安裝**（推薦）：
   ```powershell
   .\InstallLibreOffice.ps1
   ```

2. **手動安裝**：
   - 訪問 [LibreOffice 官網](https://www.libreoffice.org/download/download/)
   - 下載並安裝 LibreOffice
   - 確保將 LibreOffice 添加到系統 PATH

### Linux 用戶

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install libreoffice

# CentOS/RHEL
sudo yum install libreoffice
```

### macOS 用戶

```bash
# 使用 Homebrew
brew install --cask libreoffice

# 或從官網下載安裝包
```

## API 端點

### 上傳文檔

**端點**: `POST /api/FormsUpload/document`

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

**請求示例**:
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

**響應示例**:
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

### 上傳圖片

**端點**: `POST /api/FormsUpload/image`

**支持的文件類型**:
- `image/jpeg`
- `image/png`
- `image/gif`
- `image/bmp`
- `image/webp`
- `image/tiff`

## 功能特點

### 1. 自動格式檢測
系統會自動檢測上傳文件的格式，並使用適當的轉換方法。

### 2. 高質量轉換
使用 LibreOffice 進行轉換，確保：
- 保持原始格式
- 正確處理表格
- 保留圖片
- 支持複雜排版

### 3. 響應式 HTML
轉換後的 HTML 包含響應式樣式，在不同設備上都能良好顯示。

### 4. 錯誤處理
- 詳細的錯誤日誌
- 友好的錯誤提示
- 自動重試機制

### 5. 文件管理
- 自動生成唯一文件名
- 分類存儲
- 支持大文件（最大 50MB）

## 配置選項

### 自定義轉換選項

在 `Services/DocumentConverterService.cs` 中可以調整：

```csharp
// 修改支持的文件格式
public bool IsSupportedFormat(string filePath)
{
    var supportedFormats = new[]
    {
        ".doc", ".docx", ".odt", ".rtf", ".txt",
        ".xls", ".xlsx", ".ods",
        ".ppt", ".pptx", ".odp",
        ".pdf"
    };
    // ...
}

// 自定義 HTML 後處理
private string PostProcessHtml(string html)
{
    // 添加自定義樣式
    // 處理圖片路徑
    // 清理 HTML
    return html;
}
```

### 調整文件大小限制

在 `Controllers/FormsUploadController.cs` 中：

```csharp
// 檢查文件大小 (限制為 50MB)
if (file.Length > 50 * 1024 * 1024)
{
    return BadRequest(new { error = "文件大小不能超過 50MB" });
}
```

## 故障排除

### 常見問題

1. **LibreOffice 未找到**
   - 確保已正確安裝 LibreOffice
   - 檢查系統 PATH 設置
   - 運行安裝腳本：`.\InstallLibreOffice.ps1`

2. **轉換失敗**
   - 檢查文件格式是否支持
   - 查看應用程序日誌
   - 確保文件未損壞

3. **轉換結果不理想**
   - 檢查原始文件格式
   - 嘗試使用不同格式的文件
   - 查看轉換日誌

### 日誌查看

轉換過程的詳細日誌會輸出到控制台，包括：
- 文件上傳狀態
- LibreOffice 命令執行
- 轉換結果
- 錯誤信息

## 性能優化

### 1. 並發處理
系統支持多個文件同時轉換，但建議限制並發數量以避免資源競爭。

### 2. 緩存機制
可以考慮添加轉換結果緩存，避免重複轉換相同文件。

### 3. 異步處理
對於大文件，可以考慮使用後台任務進行轉換。

## 安全考慮

1. **文件驗證**
   - 檢查文件類型
   - 驗證文件大小
   - 掃描惡意內容

2. **路徑安全**
   - 使用安全的文件路徑
   - 避免路徑遍歷攻擊

3. **權限控制**
   - 限制上傳權限
   - 控制文件訪問

## 未來改進

1. **更多格式支持**
   - OpenDocument 格式
   - 更多圖片格式
   - 壓縮文件

2. **轉換選項**
   - 自定義輸出格式
   - 樣式模板
   - 批量轉換

3. **雲端集成**
   - Google Docs API
   - Microsoft Office 365 API
   - 其他雲端服務

## 聯繫支持

如果遇到問題，請：
1. 查看應用程序日誌
2. 檢查 LibreOffice 安裝
3. 確認文件格式支持
4. 聯繫開發團隊 