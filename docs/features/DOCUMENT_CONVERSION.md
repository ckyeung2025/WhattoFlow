# 文檔轉換功能

## 🎯 **功能概述**

WhattoFlow 系統支持使用 LibreOffice 將各種文檔格式轉換為 HTML，包括 Word、Excel、PowerPoint、PDF、RTF 和純文本文件。

## 📁 **支持的文件格式**

| 格式 | 擴展名 | 說明 |
|------|---------|------|
| **Word 文檔** | .doc, .docx | Microsoft Word 文檔 |
| **Excel 表格** | .xls, .xlsx | Microsoft Excel 表格 |
| **PowerPoint 簡報** | .ppt, .pptx | Microsoft PowerPoint 簡報 |
| **PDF 文件** | .pdf | Adobe PDF 文檔 |
| **RTF 文檔** | .rtf | Rich Text Format 文檔 |
| **純文本文件** | .txt | 純文本文件 |

## �� **功能特點**

### **1. 自動格式檢測**
系統會自動檢測上傳文件的格式，並使用適當的轉換方法。

### **2. 高質量轉換**
使用 LibreOffice 進行轉換，確保：
- 保持原始格式
- 正確處理表格
- 保留圖片
- 支持複雜排版

### **3. 響應式 HTML**
轉換後的 HTML 包含響應式樣式，在不同設備上都能良好顯示。

### **4. 錯誤處理**
- 詳細的錯誤日誌
- 友好的錯誤提示
- 自動重試機制

### **5. 文件管理**
- 自動生成唯一文件名
- 分類存儲
- 支持大文件（最大 50MB）

## �� **技術實現**

### **1. 核心服務**
```csharp
public class DocumentConverterService
{
    private readonly IWebHostEnvironment _environment;
    private readonly ILogger<DocumentConverterService> _logger;
    private readonly string _libreOfficePath;

    public DocumentConverterService(IWebHostEnvironment environment, ILogger<DocumentConverterService> logger)
    {
        _environment = environment;
        _logger = logger;
        _libreOfficePath = FindLibreOfficePath();
    }

    public async Task<string> ConvertToHtmlAsync(string filePath)
    {
        try
        {
            var outputPath = Path.Combine(_environment.WebRootPath, "temp", Guid.NewGuid().ToString());
            Directory.CreateDirectory(outputPath);

            var processInfo = new ProcessStartInfo
            {
                FileName = _libreOfficePath,
                Arguments = $"--headless --convert-to html --outdir \"{outputPath}\" \"{filePath}\"",
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                CreateNoWindow = true
            };

            using var process = Process.Start(processInfo);
            await process.WaitForExitAsync();

            var htmlFiles = Directory.GetFiles(outputPath, "*.html");
            if (htmlFiles.Length > 0)
            {
                var htmlContent = await File.ReadAllTextAsync(htmlFiles[0]);
                return PostProcessHtml(htmlContent);
            }

            throw new Exception("轉換後未找到 HTML 文件");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "文檔轉換失敗: {FilePath}", filePath);
            throw;
        }
    }
}
```

### **2. 智能安裝檢測**
```csharp
private string FindLibreOfficePath()
{
    // 檢查常見安裝路徑
    var possiblePaths = new[]
    {
        @"C:\Program Files\LibreOffice\program\soffice.exe",
        @"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
        "/usr/bin/soffice",
        "/usr/local/bin/soffice",
        "/Applications/LibreOffice.app/Contents/MacOS/soffice"
    };

    foreach (var path in possiblePaths)
    {
        if (File.Exists(path))
            return path;
    }

    // 從 PATH 環境變量查找
    var pathVariable = Environment.GetEnvironmentVariable("PATH");
    if (!string.IsNullOrEmpty(pathVariable))
    {
        var paths = pathVariable.Split(Path.PathSeparator);
        foreach (var path in paths)
        {
            var sofficePath = Path.Combine(path, "soffice");
            if (File.Exists(sofficePath) || File.Exists(sofficePath + ".exe"))
                return sofficePath;
        }
    }

    throw new Exception("未找到 LibreOffice 安裝，請先安裝 LibreOffice");
}
```

### **3. HTML 後處理**
```csharp
private string PostProcessHtml(string html)
{
    // 添加響應式樣式
    var responsiveStyles = @"
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            table { border-collapse: collapse; width: 100%; margin: 10px 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            img { max-width: 100%; height: auto; }
            @media (max-width: 768px) {
                body { margin: 10px; }
                table { font-size: 14px; }
                th, td { padding: 4px; }
            }
        </style>";

    // 插入樣式到 head 標籤
    if (html.Contains("<head>"))
    {
        html = html.Replace("<head>", "<head>" + responsiveStyles);
    }
    else
    {
        html = html.Replace("<html>", "<html><head>" + responsiveStyles + "</head>");
    }

    return html;
}
```

## �� **API 端點**

### **1. 上傳文檔**
```
POST /api/FormsUpload/document
Content-Type: multipart/form-data

參數:
- file: 文檔文件

響應:
{
    "success": true,
    "formId": "12345678-1234-1234-1234-123456789012",
    "htmlContent": "<html>...</html>",
    "formName": "我的文檔",
    "sourceFilePath": "Documents/20231201120000_12345678-1234-1234-1234-123456789012.docx",
    "message": "文檔已成功轉換並創建表單"
}
```

### **2. 上傳圖片**
```
POST /api/FormsUpload/image
Content-Type: multipart/form-data

參數:
- file: 圖片文件

支持的文件類型:
- image/jpeg, image/png, image/gif
- image/bmp, image/webp, image/tiff
```

## ️ **安裝和配置**

### **1. 安裝 LibreOffice**

#### **Windows 用戶**
```powershell
# 自動安裝（推薦）
.\InstallLibreOffice.ps1

# 手動安裝
winget install TheDocumentFoundation.LibreOffice
```

#### **Linux 用戶**
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install libreoffice

# CentOS/RHEL
sudo yum install libreoffice
```

#### **macOS 用戶**
```bash
# 使用 Homebrew
brew install --cask libreoffice

# 或從官網下載安裝包
```

### **2. 測試轉換功能**
```bash
# 啟動應用程序
dotnet run

# 訪問測試頁面
http://localhost:5000/test_upload.html
```

### **3. 使用 API**
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

## ⚙️ **配置選項**

### **1. 自定義轉換選項**
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
    
    var extension = Path.GetExtension(filePath).ToLowerInvariant();
    return supportedFormats.Contains(extension);
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

### **2. 調整文件大小限制**
```csharp
// 檢查文件大小 (限制為 50MB)
if (file.Length > 50 * 1024 * 1024)
{
    return BadRequest(new { error = "文件大小不能超過 50MB" });
}
```

##  **故障排除**

### **1. 常見問題**

#### **LibreOffice 未找到**
- 確保已正確安裝 LibreOffice
- 檢查系統 PATH 設置
- 運行安裝腳本：`.\InstallLibreOffice.ps1`

#### **轉換失敗**
- 檢查文件格式是否支持
- 查看應用程序日誌
- 確保文件未損壞

#### **轉換結果不理想**
- 檢查原始文件格式
- 嘗試使用不同格式的文件
- 查看轉換日誌

### **2. 日誌查看**
轉換過程的詳細日誌會輸出到控制台，包括：
- 文件上傳狀態
- LibreOffice 命令執行
- 轉換結果
- 錯誤信息

##  **性能優化**

### **1. 並發處理**
系統支持多個文件同時轉換，但建議限制並發數量以避免資源競爭。

### **2. 緩存機制**
可以考慮添加轉換結果緩存，避免重複轉換相同文件。

### **3. 異步處理**
對於大文件，可以考慮使用後台任務進行轉換。

##  **安全考慮**

### **1. 文件驗證**
- 檢查文件類型
- 驗證文件大小
- 掃描惡意內容

### **2. 路徑安全**
- 使用安全的文件路徑
- 避免路徑遍歷攻擊

### **3. 權限控制**
- 限制上傳權限
- 控制文件訪問

##  **未來改進**

### **1. 更多格式支持**
- OpenDocument 格式 (.odt, .ods, .odp)
- 更多圖片格式
- 壓縮文件 (.zip, .rar)

### **2. 轉換選項**
- 自定義輸出格式
- 樣式模板
- 批量轉換

### **3. 雲端集成**
- Google Docs API
- Microsoft Office 365 API
- 其他雲端服務

---

**最後更新**: 2025年8月20日
**系統版本**: v2.0

## ️ **建議的清理操作**

基於以上分析，我建議：

### **保留並整合的文件**
1. ✅ **EXCEL_DATE_CONVERSION_FIX.md** → 整合到 `docs/features/EXCEL_INTEGRATION.md`
2. ✅ **EXCEL_DATASOURCE_TESTING.md** → 整合到 `docs/features/EXCEL_INTEGRATION.md`
3. ✅ **README_DocumentConverter.md** → 整合到 `docs/features/DOCUMENT_CONVERSION.md`
4. ✅ **FORMIO_SETUP_SUMMARY.md** → 整合到 `docs/features/EFORM_SYSTEM.md`
5. ✅ **API_MODIFICATIONS_SUMMARY.md** → 整合到 `docs/technical/API_REFERENCE.md`
6. ✅ **UI_LOGIC_UPDATE.md** → 整合到 `docs/features/DELIVERY_MANAGEMENT.md`

### **可以刪除的文件**
- 所有舊的 MD 文件在整合完成後都可以刪除

##  **下一步行動**

您希望我：
1. **立即創建整合後的文檔**？
2. **先檢查現有文檔結構**？
3. **還是您有其他優先級**？

這樣可以確保所有有價值的信息都被保留，同時建立一個清晰的、組織良好的文檔系統。
