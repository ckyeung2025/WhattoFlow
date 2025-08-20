# Excel 數據源集成

## 🎯 **功能概述**

WhattoFlow 系統支持從 Excel 文件導入數據到 DataSet，包括自動創建欄位定義、導入數據記錄，並支持智能數據類型檢測和轉換。

## �� **核心功能**

### **1. 支持的 Excel 格式**
- **Excel 2007+**: .xlsx 格式（推薦）
- **Excel 97-2003**: .xls 格式
- **文件大小**: 最大支持 10MB
- **工作表**: 支持多工作表選擇

### **2. 智能欄位檢測**
- **標題行解析**: 自動識別第一行作為欄位名稱
- **數據類型推斷**: 智能檢測數字、日期、布林值等類型
- **欄位屬性**: 自動設置主鍵、可搜尋、可排序等屬性
- **自定義配置**: 支持手動調整欄位屬性

### **3. 數據轉換能力**
- **日期處理**: 支持 Excel 日期序列號轉換
- **數字格式**: 自動處理小數和整數
- **文本處理**: 支持長文本和短文本
- **布林值**: 自動識別是/否、真/假等值

## �� **技術實現**

### **1. 後端處理架構**
```csharp
// 使用 DocumentFormat.OpenXml 讀取 Excel 文件
using DocumentFormat.OpenXml.Spreadsheet;
using DocumentFormat.OpenXml.Packaging;

public class ExcelDataProcessor
{
    public async Task<ProcessResult> ProcessExcelFile(string filePath, string sheetName)
    {
        using (var spreadsheetDocument = SpreadsheetDocument.Open(filePath, false))
        {
            var workbookPart = spreadsheetDocument.WorkbookPart;
            var worksheetPart = GetWorksheetPart(workbookPart, sheetName);
            var worksheet = worksheetPart.Worksheet;
            
            // 處理數據...
        }
    }
}
```

### **2. 日期轉換算法**
```csharp
private DateTime? ConvertExcelDateToSqlDate(string excelValue)
{
    if (string.IsNullOrWhiteSpace(excelValue))
        return null;

    try
    {
        // 嘗試直接解析為日期（如果已經是標準日期格式）
        if (DateTime.TryParse(excelValue, out var directDate))
        {
            return directDate;
        }

        // 嘗試解析為 Excel 日期序列號
        if (double.TryParse(excelValue, out var excelDateNumber))
        {
            if (excelDateNumber >= 1 && excelDateNumber <= 2958465)
            {
                var baseDate = new DateTime(1900, 1, 1);
                var calculatedDate = baseDate.AddDays(excelDateNumber - 1);
                
                // 修正 Excel 1900 年閏年錯誤
                if (calculatedDate >= new DateTime(1900, 3, 1))
                {
                    calculatedDate = calculatedDate.AddDays(-1);
                }
                
                return calculatedDate;
            }
        }

        return null;
    }
    catch (Exception ex)
    {
        _loggingService.LogError($"Excel 日期轉換失敗: {ex.Message}", ex);
        return null;
    }
}
```

### **3. 數據類型檢測**
```csharp
private string InferDataTypeFromSample(string value)
{
    if (string.IsNullOrWhiteSpace(value))
        return "string";

    // 檢測日期
    if (IsDateCellAdvanced(value) || IsExcelDateNumber(value))
        return "datetime";

    // 檢測數字
    if (decimal.TryParse(value, out _))
        return "decimal";

    // 檢測布林值
    if (IsBooleanValue(value))
        return "boolean";

    // 默認為字串
    return "string";
}

private bool IsExcelDateNumber(string value)
{
    if (double.TryParse(value, out var numericValue))
    {
        if (numericValue >= 1 && numericValue <= 2958465)
        {
            try
            {
                var baseDate = new DateTime(1900, 1, 1);
                var calculatedDate = baseDate.AddDays(numericValue - 1);
                
                if (calculatedDate >= new DateTime(1900, 3, 1))
                {
                    calculatedDate = calculatedDate.AddDays(-1);
                }
                
                return calculatedDate.Year >= 1900 && calculatedDate.Year <= 9999;
            }
            catch
            {
                return false;
            }
        }
    }
    return false;
}
```

## �� **使用流程**

### **1. 創建 DataSet**
1. 點擊「創建 Data Set」按鈕
2. 填寫基本資訊（名稱、描述）
3. 選擇數據源類型：**EXCEL**
4. 上傳 Excel 文件
5. 選擇工作表名稱
6. 系統自動生成欄位定義
7. 保存 DataSet

### **2. 數據同步**
1. 在 DataSet 列表中點擊「同步數據」按鈕
2. 系統自動：
   - 讀取 Excel 文件
   - 創建欄位定義（如果不存在）
   - 導入數據記錄
   - 顯示處理結果

### **3. 查看結果**
1. 點擊「查看記錄」按鈕
2. 檢查導入的數據是否正確
3. 在數據庫中驗證相關表

## �� **前端功能**

### **1. 文件上傳組件**
```jsx
<Upload
  name="file"
  accept=".xlsx,.xls"
  beforeUpload={(file) => {
    const isExcel = file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
                    file.type === 'application/vnd.ms-excel';
    if (!isExcel) {
      message.error('只能上傳 Excel 文件！');
      return false;
    }
    
    const isLt10M = file.size / 1024 / 1024 < 10;
    if (!isLt10M) {
      message.error('文件大小不能超過 10MB！');
      return false;
    }
    
    return true;
  }}
  customRequest={async ({ file, onSuccess, onError }) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/datasets-upload/excel', {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          dataSourceForm.setFieldsValue({ excelFilePath: result.filePath });
          message.success(`${file.name} 上傳成功`);
          onSuccess(result);
        } else {
          throw new Error(result.message);
        }
      } else {
        throw new Error('文件上傳失敗');
      }
    } catch (error) {
      message.error(`上傳失敗: ${error.message}`);
      onError(error);
    }
  }}
>
  <Button icon={<UploadOutlined />}>上傳 Excel 文件</Button>
</Upload>
```

### **2. 工作表選擇**
```jsx
<Form.Item name="excelSheetName" label="工作表名稱">
  <Select 
    placeholder="選擇工作表"
    onChange={(value) => handleSheetChange(value)}
    loading={sheetLoading}
  >
    {sheetNames.map(name => (
      <Select.Option key={name} value={name}>
        {name}
      </Select.Option>
    ))}
  </Select>
</Form.Item>
```

## �� **API 端點**

### **1. 文件上傳**
```
POST /api/datasets-upload/excel
Content-Type: multipart/form-data

參數:
- file: Excel 文件

響應:
{
  "success": true,
  "filePath": "uploads/excel/20241219120000_12345678-1234-1234-1234-123456789012.xlsx",
  "message": "文件上傳成功"
}
```

### **2. 工作表列表**
```
GET /api/datasets-upload/excel/sheets?filePath={filePath}

響應:
{
  "success": true,
  "sheetNames": ["Sheet1", "Sheet2", "Sheet3"]
}
```

### **3. 欄位預覽**
```
GET /api/datasets-upload/excel/preview?filePath={filePath}&sheetName={sheetName}

響應:
{
  "success": true,
  "columns": [
    {
      "columnName": "customer_id",
      "displayName": "客戶編號",
      "dataType": "string",
      "maxLength": 50,
      "isRequired": true
    }
  ]
}
```

### **4. 數據同步**
```
POST /api/datasets/{id}/sync

響應:
{
  "success": true,
  "data": {
    "totalRecords": 100,
    "processedRecords": 100,
    "errors": []
  },
  "message": "同步成功"
}
```

## ️ **數據庫結構**

### **1. 主要表結構**
```sql
-- 數據集表
CREATE TABLE DataSets (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    Name NVARCHAR(100) NOT NULL,
    Description NVARCHAR(500),
    DataSourceType NVARCHAR(50),
    CompanyId UNIQUEIDENTIFIER NOT NULL,
    Status NVARCHAR(20) DEFAULT 'Active',
    CreatedAt DATETIME DEFAULT GETDATE(),
    CreatedBy NVARCHAR(100),
    UpdatedAt DATETIME,
    UpdatedBy NVARCHAR(100)
);

-- 數據集欄位表
CREATE TABLE DataSetColumns (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    DataSetId UNIQUEIDENTIFIER NOT NULL,
    ColumnName NVARCHAR(100) NOT NULL,
    DisplayName NVARCHAR(100),
    DataType NVARCHAR(50) NOT NULL,
    MaxLength INT,
    IsRequired BIT DEFAULT 0,
    IsPrimaryKey BIT DEFAULT 0,
    IsSearchable BIT DEFAULT 1,
    IsSortable BIT DEFAULT 1,
    IsIndexed BIT DEFAULT 0,
    DefaultValue NVARCHAR(500),
    SortOrder INT DEFAULT 0
);

-- 數據記錄
CREATE TABLE DataSetRecords (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    DataSetId UNIQUEIDENTIFIER NOT NULL,
    PrimaryKeyValue NVARCHAR(500),
    Status NVARCHAR(20) DEFAULT 'Active',
    CreatedAt DATETIME DEFAULT GETDATE(),
    UpdatedAt DATETIME
);

-- 記錄值
CREATE TABLE DataSetRecordValues (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    RecordId UNIQUEIDENTIFIER NOT NULL,
    ColumnName NVARCHAR(100) NOT NULL,
    StringValue NVARCHAR(MAX),
    NumericValue DECIMAL(18,6),
    DateValue DATETIME,
    BooleanValue BIT,
    CreatedAt DATETIME DEFAULT GETDATE()
);
```

## ⚠️ **注意事項**

### **1. 文件格式**
- 支持 .xlsx 和 .xls 格式
- 文件大小限制為 10MB
- 工作表名稱預設為 "Sheet1"，可以自定義

### **2. 欄位命名**
- 系統會自動將標題轉換為欄位名稱（去除空格，轉小寫）
- 預設所有欄位為字串類型
- 第一列自動設為主鍵

### **3. 數據類型**
- 系統會自動檢測數字、日期、布林值等類型
- 支持 Excel 日期序列號轉換
- 無法識別的類型會存儲為字串

##  **故障排除**

### **1. 常見問題**
- **文件上傳失敗**: 檢查文件格式和大小
- **同步失敗**: 檢查文件路徑和工作表名稱
- **數據不完整**: 檢查 Excel 文件格式和空行空列

### **2. 日誌查看**
- 後端日誌會記錄詳細的處理過程
- 包括文件路徑、工作表名稱、處理記錄數等信息
- 錯誤時會記錄具體的異常信息

### **3. 性能優化**
- 支持大文件處理（限制 10MB）
- 批量插入數據到相關表
- 可以考慮添加轉換結果緩存

---

**最後更新**: 2025年8月20日

## 📋 **分析舊 MD 文件內容**

### 1. **EXCEL_DATE_CONVERSION_FIX.md** - 需要保留並整合
- **內容價值**: 高 - 包含重要的 Excel 日期轉換修復邏輯
- **建議**: 整合到 `docs/features/EXCEL_INTEGRATION.md`

### 2. **EXCEL_DATASOURCE_TESTING.md** - 需要保留並整合
- **內容價值**: 高 - 包含 Excel 數據源測試說明和技術實現
- **建議**: 整合到 `docs/features/EXCEL_INTEGRATION.md`

### 3. **README_DocumentConverter.md** - 需要保留並整合
- **內容價值**: 高 - 包含完整的文檔轉換功能說明
- **建議**: 整合到 `docs/features/DOCUMENT_CONVERSION.md`

### 4. **FORMIO_SETUP_SUMMARY.md** - 需要保留並整合
- **內容價值**: 中 - 包含 Form.io 設定總結
- **建議**: 整合到 `docs/features/EFORM_SYSTEM.md`

### 5. **API_MODIFICATIONS_SUMMARY.md** - 需要保留並整合
- **內容價值**: 中 - 包含 API 修改記錄
- **建議**: 整合到 `docs/technical/API_REFERENCE.md`

### 6. **UI_LOGIC_UPDATE.md** - 需要保留並整合
- **內容價值**: 中 - 包含 UI 邏輯更新
- **建議**: 整合到 `docs/features/DELIVERY_MANAGEMENT.md`

##  **建議的整合方案**

我建議創建以下新的文檔來整合這些內容：

### 1. **創建 Excel 集成文檔**

```markdown:docs/features/EXCEL_INTEGRATION.md
# Excel 數據源集成

## 🎯 **功能概述**

WhattoFlow 系統支持從 Excel 文件導入數據到 DataSet，包括自動創建欄位定義、導入數據記錄，並支持智能數據類型檢測和轉換。

##  **核心功能**

### **1. 支持的 Excel 格式**
- **Excel 2007+**: .xlsx 格式（推薦）
- **Excel 97-2003**: .xls 格式
- **文件大小**: 最大支持 10MB
- **工作表**: 支持多工作表選擇

### **2. 智能欄位檢測**
- **標題行解析**: 自動識別第一行作為欄位名稱
- **數據類型推斷**: 智能檢測數字、日期、布林值等類型
- **欄位屬性**: 自動設置主鍵、可搜尋、可排序等屬性
- **自定義配置**: 支持手動調整欄位屬性

### **3. 數據轉換能力**
- **日期處理**: 支持 Excel 日期序列號轉換
- **數字格式**: 自動處理小數和整數
- **文本處理**: 支持長文本和短文本
- **布林值**: 自動識別是/否、真/假等值

##  **技術實現**

### **1. 後端處理架構**
```csharp
// 使用 DocumentFormat.OpenXml 讀取 Excel 文件
using DocumentFormat.OpenXml.Spreadsheet;
using DocumentFormat.OpenXml.Packaging;

public class ExcelDataProcessor
{
    public async Task<ProcessResult> ProcessExcelFile(string filePath, string sheetName)
    {
        using (var spreadsheetDocument = SpreadsheetDocument.Open(filePath, false))
        {
            var workbookPart = spreadsheetDocument.WorkbookPart;
            var worksheetPart = GetWorksheetPart(workbookPart, sheetName);
            var worksheet = worksheetPart.Worksheet;
            
            // 處理數據...
        }
    }
}
```

### **2. 日期轉換算法**
```csharp
private DateTime? ConvertExcelDateToSqlDate(string excelValue)
{
    if (string.IsNullOrWhiteSpace(excelValue))
        return null;

    try
    {
        // 嘗試直接解析為日期（如果已經是標準日期格式）
        if (DateTime.TryParse(excelValue, out var directDate))
        {
            return directDate;
        }

        // 嘗試解析為 Excel 日期序列號
        if (double.TryParse(excelValue, out var excelDateNumber))
        {
            if (excelDateNumber >= 1 && excelDateNumber <= 2958465)
            {
                var baseDate = new DateTime(1900, 1, 1);
                var calculatedDate = baseDate.AddDays(excelDateNumber - 1);
                
                // 修正 Excel 1900 年閏年錯誤
                if (calculatedDate >= new DateTime(1900, 3, 1))
                {
                    calculatedDate = calculatedDate.AddDays(-1);
                }
                
                return calculatedDate;
            }
        }

        return null;
    }
    catch (Exception ex)
    {
        _loggingService.LogError($"Excel 日期轉換失敗: {ex.Message}", ex);
        return null;
    }
}
```

### **3. 數據類型檢測**
```csharp
private string InferDataTypeFromSample(string value)
{
    if (string.IsNullOrWhiteSpace(value))
        return "string";

    // 檢測日期
    if (IsDateCellAdvanced(value) || IsExcelDateNumber(value))
        return "datetime";

    // 檢測數字
    if (decimal.TryParse(value, out _))
        return "decimal";

    // 檢測布林值
    if (IsBooleanValue(value))
        return "boolean";

    // 默認為字串
    return "string";
}

private bool IsExcelDateNumber(string value)
{
    if (double.TryParse(value, out var numericValue))
    {
        if (numericValue >= 1 && numericValue <= 2958465)
        {
            try
            {
                var baseDate = new DateTime(1900, 1, 1);
                var calculatedDate = baseDate.AddDays(numericValue - 1);
                
                if (calculatedDate >= new DateTime(1900, 3, 1))
                {
                    calculatedDate = calculatedDate.AddDays(-1);
                }
                
                return calculatedDate.Year >= 1900 && calculatedDate.Year <= 9999;
            }
            catch
            {
                return false;
            }
        }
    }
    return false;
}
```

##  **使用流程**

### **1. 創建 DataSet**
1. 點擊「創建 Data Set」按鈕
2. 填寫基本資訊（名稱、描述）
3. 選擇數據源類型：**EXCEL**
4. 上傳 Excel 文件
5. 選擇工作表名稱
6. 系統自動生成欄位定義
7. 保存 DataSet

### **2. 數據同步**
1. 在 DataSet 列表中點擊「同步數據」按鈕
2. 系統自動：
   - 讀取 Excel 文件
   - 創建欄位定義（如果不存在）
   - 導入數據記錄
   - 顯示處理結果

### **3. 查看結果**
1. 點擊「查看記錄」按鈕
2. 檢查導入的數據是否正確
3. 在數據庫中驗證相關表

##  **前端功能**

### **1. 文件上傳組件**
```jsx
<Upload
  name="file"
  accept=".xlsx,.xls"
  beforeUpload={(file) => {
    const isExcel = file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
                    file.type === 'application/vnd.ms-excel';
    if (!isExcel) {
      message.error('只能上傳 Excel 文件！');
      return false;
    }
    
    const isLt10M = file.size / 1024 / 1024 < 10;
    if (!isLt10M) {
      message.error('文件大小不能超過 10MB！');
      return false;
    }
    
    return true;
  }}
  customRequest={async ({ file, onSuccess, onError }) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/datasets-upload/excel', {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          dataSourceForm.setFieldsValue({ excelFilePath: result.filePath });
          message.success(`${file.name} 上傳成功`);
          onSuccess(result);
        } else {
          throw new Error(result.message);
        }
      } else {
        throw new Error('文件上傳失敗');
      }
    } catch (error) {
      message.error(`上傳失敗: ${error.message}`);
      onError(error);
    }
  }}
>
  <Button icon={<UploadOutlined />}>上傳 Excel 文件</Button>
</Upload>
```

### **2. 工作表選擇**
```jsx
<Form.Item name="excelSheetName" label="工作表名稱">
  <Select 
    placeholder="選擇工作表"
    onChange={(value) => handleSheetChange(value)}
    loading={sheetLoading}
  >
    {sheetNames.map(name => (
      <Select.Option key={name} value={name}>
        {name}
      </Select.Option>
    ))}
  </Select>
</Form.Item>
```

##  **API 端點**

### **1. 文件上傳**
```
POST /api/datasets-upload/excel
Content-Type: multipart/form-data

參數:
- file: Excel 文件

響應:
{
  "success": true,
  "filePath": "uploads/excel/20241219120000_12345678-1234-1234-1234-123456789012.xlsx",
  "message": "文件上傳成功"
}
```

### **2. 工作表列表**
```
GET /api/datasets-upload/excel/sheets?filePath={filePath}

響應:
{
  "success": true,
  "sheetNames": ["Sheet1", "Sheet2", "Sheet3"]
}
```

### **3. 欄位預覽**
```
GET /api/datasets-upload/excel/preview?filePath={filePath}&sheetName={sheetName}

響應:
{
  "success": true,
  "columns": [
    {
      "columnName": "customer_id",
      "displayName": "客戶編號",
      "dataType": "string",
      "maxLength": 50,
      "isRequired": true
    }
  ]
}
```

### **4. 數據同步**
```
POST /api/datasets/{id}/sync

響應:
{
  "success": true,
  "data": {
    "totalRecords": 100,
    "processedRecords": 100,
    "errors": []
  },
  "message": "同步成功"
}
```

## ️ **數據庫結構**

### **1. 主要表結構**
```sql
-- 數據集表
CREATE TABLE DataSets (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    Name NVARCHAR(100) NOT NULL,
    Description NVARCHAR(500),
    DataSourceType NVARCHAR(50),
    CompanyId UNIQUEIDENTIFIER NOT NULL,
    Status NVARCHAR(20) DEFAULT 'Active',
    CreatedAt DATETIME DEFAULT GETDATE(),
    CreatedBy NVARCHAR(100),
    UpdatedAt DATETIME,
    UpdatedBy NVARCHAR(100)
);

-- 數據集欄位表
CREATE TABLE DataSetColumns (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    DataSetId UNIQUEIDENTIFIER NOT NULL,
    ColumnName NVARCHAR(100) NOT NULL,
    DisplayName NVARCHAR(100),
    DataType NVARCHAR(50) NOT NULL,
    MaxLength INT,
    IsRequired BIT DEFAULT 0,
    IsPrimaryKey BIT DEFAULT 0,
    IsSearchable BIT DEFAULT 1,
    IsSortable BIT DEFAULT 1,
    IsIndexed BIT DEFAULT 0,
    DefaultValue NVARCHAR(500),
    SortOrder INT DEFAULT 0
);

-- 數據記錄
CREATE TABLE DataSetRecords (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    DataSetId UNIQUEIDENTIFIER NOT NULL,
    PrimaryKeyValue NVARCHAR(500),
    Status NVARCHAR(20) DEFAULT 'Active',
    CreatedAt DATETIME DEFAULT GETDATE(),
    UpdatedAt DATETIME
);

-- 記錄值
CREATE TABLE DataSetRecordValues (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    RecordId UNIQUEIDENTIFIER NOT NULL,
    ColumnName NVARCHAR(100) NOT NULL,
    StringValue NVARCHAR(MAX),
    NumericValue DECIMAL(18,6),
    DateValue DATETIME,
    BooleanValue BIT,
    CreatedAt DATETIME DEFAULT GETDATE()
);
```

## ⚠️ **注意事項**

### **1. 文件格式**
- 支持 .xlsx 和 .xls 格式
- 文件大小限制為 10MB
- 工作表名稱預設為 "Sheet1"，可以自定義

### **2. 欄位命名**
- 系統會自動將標題轉換為欄位名稱（去除空格，轉小寫）
- 預設所有欄位為字串類型
- 第一列自動設為主鍵

### **3. 數據類型**
- 系統會自動檢測數字、日期、布林值等類型
- 支持 Excel 日期序列號轉換
- 無法識別的類型會存儲為字串

##  **故障排除**

### **1. 常見問題**
- **文件上傳失敗**: 檢查文件格式和大小
- **同步失敗**: 檢查文件路徑和工作表名稱
- **數據不完整**: 檢查 Excel 文件格式和空行空列

### **2. 日誌查看**
- 後端日誌會記錄詳細的處理過程
- 包括文件路徑、工作表名稱、處理記錄數等信息
- 錯誤時會記錄具體的異常信息

### **3. 性能優化**
- 支持大文件處理（限制 10MB）
- 批量插入數據到相關表
- 可以考慮添加轉換結果緩存

---

**最後更新**: 2025年8月20日

## 📋 **分析舊 MD 文件內容**

### 1. **EXCEL_DATE_CONVERSION_FIX.md** - 需要保留並整合
- **內容價值**: 高 - 包含重要的 Excel 日期轉換修復邏輯
- **建議**: 整合到 `docs/features/EXCEL_INTEGRATION.md`

### 2. **EXCEL_DATASOURCE_TESTING.md** - 需要保留並整合
- **內容價值**: 高 - 包含 Excel 數據源測試說明和技術實現
- **建議**: 整合到 `docs/features/EXCEL_INTEGRATION.md`

### 3. **README_DocumentConverter.md** - 需要保留並整合
- **內容價值**: 高 - 包含完整的文檔轉換功能說明
- **建議**: 整合到 `docs/features/DOCUMENT_CONVERSION.md`

### 4. **FORMIO_SETUP_SUMMARY.md** - 需要保留並整合
- **內容價值**: 中 - 包含 Form.io 設定總結
- **建議**: 整合到 `docs/features/EFORM_SYSTEM.md`

### 5. **API_MODIFICATIONS_SUMMARY.md** - 需要保留並整合
- **內容價值**: 中 - 包含 API 修改記錄
- **建議**: 整合到 `docs/technical/API_REFERENCE.md`

### 6. **UI_LOGIC_UPDATE.md** - 需要保留並整合
- **內容價值**: 中 - 包含 UI 邏輯更新
- **建議**: 整合到 `docs/features/DELIVERY_MANAGEMENT.md`

##  **建議的整合方案**

我建議創建以下新的文檔來整合這些內容：

### 1. **創建 Excel 集成文檔**

```markdown:docs/features/EXCEL_INTEGRATION.md
# Excel 數據源集成

## 🎯 **功能概述**

WhattoFlow 系統支持從 Excel 文件導入數據到 DataSet，包括自動創建欄位定義、導入數據記錄，並支持智能數據類型檢測和轉換。

##  **核心功能**

### **1. 支持的 Excel 格式**
- **Excel 2007+**: .xlsx 格式（推薦）
- **Excel 97-2003**: .xls 格式
- **文件大小**: 最大支持 10MB
- **工作表**: 支持多工作表選擇

### **2. 智能欄位檢測**
- **標題行解析**: 自動識別第一行作為欄位名稱
- **數據類型推斷**: 智能檢測數字、日期、布林值等類型
- **欄位屬性**: 自動設置主鍵、可搜尋、可排序等屬性
- **自定義配置**: 支持手動調整欄位屬性

### **3. 數據轉換能力**
- **日期處理**: 支持 Excel 日期序列號轉換
- **數字格式**: 自動處理小數和整數
- **文本處理**: 支持長文本和短文本
- **布林值**: 自動識別是/否、真/假等值

##  **技術實現**

### **1. 後端處理架構**
```csharp
// 使用 DocumentFormat.OpenXml 讀取 Excel 文件
using DocumentFormat.OpenXml.Spreadsheet;
using DocumentFormat.OpenXml.Packaging;

public class ExcelDataProcessor
{
    public async Task<ProcessResult> ProcessExcelFile(string filePath, string sheetName)
    {
        using (var spreadsheetDocument = SpreadsheetDocument.Open(filePath, false))
        {
            var workbookPart = spreadsheetDocument.WorkbookPart;
            var worksheetPart = GetWorksheetPart(workbookPart, sheetName);
            var worksheet = worksheetPart.Worksheet;
            
            // 處理數據...
        }
    }
}
```

### **2. 日期轉換算法**
```csharp
private DateTime? ConvertExcelDateToSqlDate(string excelValue)
{
    if (string.IsNullOrWhiteSpace(excelValue))
        return null;

    try
    {
        // 嘗試直接解析為日期（如果已經是標準日期格式）
        if (DateTime.TryParse(excelValue, out var directDate))
        {
            return directDate;
        }

        // 嘗試解析為 Excel 日期序列號
        if (double.TryParse(excelValue, out var excelDateNumber))
        {
            if (excelDateNumber >= 1 && excelDateNumber <= 2958465)
            {
                var baseDate = new DateTime(1900, 1, 1);
                var calculatedDate = baseDate.AddDays(excelDateNumber - 1);
                
                // 修正 Excel 1900 年閏年錯誤
                if (calculatedDate >= new DateTime(1900, 3, 1))
                {
                    calculatedDate = calculatedDate.AddDays(-1);
                }
                
                return calculatedDate;
            }
        }

        return null;
    }
    catch (Exception ex)
    {
        _loggingService.LogError($"Excel 日期轉換失敗: {ex.Message}", ex);
        return null;
    }
}
```

### **3. 數據類型檢測**
```csharp
private string InferDataTypeFromSample(string value)
{
    if (string.IsNullOrWhiteSpace(value))
        return "string";

    // 檢測日期
    if (IsDateCellAdvanced(value) || IsExcelDateNumber(value))
        return "datetime";

    // 檢測數字
    if (decimal.TryParse(value, out _))
        return "decimal";

    // 檢測布林值
    if (IsBooleanValue(value))
        return "boolean";

    // 默認為字串
    return "string";
}

private bool IsExcelDateNumber(string value)
{
    if (double.TryParse(value, out var numericValue))
    {
        if (numericValue >= 1 && numericValue <= 2958465)
        {
            try
            {
                var baseDate = new DateTime(1900, 1, 1);
                var calculatedDate = baseDate.AddDays(numericValue - 1);
                
                if (calculatedDate >= new DateTime(1900, 3, 1))
                {
                    calculatedDate = calculatedDate.AddDays(-1);
                }
                
                return calculatedDate.Year >= 1900 && calculatedDate.Year <= 9999;
            }
            catch
            {
                return false;
            }
        }
    }
    return false;
}
```

##  **使用流程**

### **1. 創建 DataSet**
1. 點擊「創建 Data Set」按鈕
2. 填寫基本資訊（名稱、描述）
3. 選擇數據源類型：**EXCEL**
4. 上傳 Excel 文件
5. 選擇工作表名稱
6. 系統自動生成欄位定義
7. 保存 DataSet

### **2. 數據同步**
1. 在 DataSet 列表中點擊「同步數據」按鈕
2. 系統自動：
   - 讀取 Excel 文件
   - 創建欄位定義（如果不存在）
   - 導入數據記錄
   - 顯示處理結果

### **3. 查看結果**
1. 點擊「查看記錄」按鈕
2. 檢查導入的數據是否正確
3. 在數據庫中驗證相關表

##  **前端功能**

### **1. 文件上傳組件**
```jsx
<Upload
  name="file"
  accept=".xlsx,.xls"
  beforeUpload={(file) => {
    const isExcel = file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
                    file.type === 'application/vnd.ms-excel';
    if (!isExcel) {
      message.error('只能上傳 Excel 文件！');
      return false;
    }
    
    const isLt10M = file.size / 1024 / 1024 < 10;
    if (!isLt10M) {
      message.error('文件大小不能超過 10MB！');
      return false;
    }
    
    return true;
  }}
  customRequest={async ({ file, onSuccess, onError }) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/datasets-upload/excel', {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          dataSourceForm.setFieldsValue({ excelFilePath: result.filePath });
          message.success(`${file.name} 上傳成功`);
          onSuccess(result);
        } else {
          throw new Error(result.message);
        }
      } else {
        throw new Error('文件上傳失敗');
      }
    } catch (error) {
      message.error(`上傳失敗: ${error.message}`);
      onError(error);
    }
  }}
>
  <Button icon={<UploadOutlined />}>上傳 Excel 文件</Button>
</Upload>
```

### **2. 工作表選擇**
```jsx
<Form.Item name="excelSheetName" label="工作表名稱">
  <Select 
    placeholder="選擇工作表"
    onChange={(value) => handleSheetChange(value)}
    loading={sheetLoading}
  >
    {sheetNames.map(name => (
      <Select.Option key={name} value={name}>
        {name}
      </Select.Option>
    ))}
  </Select>
</Form.Item>
```

##  **API 端點**

### **1. 文件上傳**
```
POST /api/datasets-upload/excel
Content-Type: multipart/form-data

參數:
- file: Excel 文件

響應:
{
  "success": true,
  "filePath": "uploads/excel/20241219120000_12345678-1234-1234-1234-123456789012.xlsx",
  "message": "文件上傳成功"
}
```

### **2. 工作表列表**
```
GET /api/datasets-upload/excel/sheets?filePath={filePath}

響應:
{
  "success": true,
  "sheetNames": ["Sheet1", "Sheet2", "Sheet3"]
}
```

### **3. 欄位預覽**
```
GET /api/datasets-upload/excel/preview?filePath={filePath}&sheetName={sheetName}

響應:
{
  "success": true,
  "columns": [
    {
      "columnName": "customer_id",
      "displayName": "客戶編號",
      "dataType": "string",
      "maxLength": 50,
      "isRequired": true
    }
  ]
}
```

### **4. 數據同步**
```
POST /api/datasets/{id}/sync

響應:
{
  "success": true,
  "data": {
    "totalRecords": 100,
    "processedRecords": 100,
    "errors": []
  },
  "message": "同步成功"
}
```

## ️ **數據庫結構**

### **1. 主要表結構**
```sql
-- 數據集表
CREATE TABLE DataSets (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    Name NVARCHAR(100) NOT NULL,
    Description NVARCHAR(500),
    DataSourceType NVARCHAR(50),
    CompanyId UNIQUEIDENTIFIER NOT NULL,
    Status NVARCHAR(20) DEFAULT 'Active',
    CreatedAt DATETIME DEFAULT GETDATE(),
    CreatedBy NVARCHAR(100),
    UpdatedAt DATETIME,
    UpdatedBy NVARCHAR(100)
);

-- 數據集欄位表
CREATE TABLE DataSetColumns (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    DataSetId UNIQUEIDENTIFIER NOT NULL,
    ColumnName NVARCHAR(100) NOT NULL,
    DisplayName NVARCHAR(100),
    DataType NVARCHAR(50) NOT NULL,
    MaxLength INT,
    IsRequired BIT DEFAULT 0,
    IsPrimaryKey BIT DEFAULT 0,
    IsSearchable BIT DEFAULT 1,
    IsSortable BIT DEFAULT 1,
    IsIndexed BIT DEFAULT 0,
    DefaultValue NVARCHAR(500),
    SortOrder INT DEFAULT 0
);

-- 數據記錄
CREATE TABLE DataSetRecords (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    DataSetId UNIQUEIDENTIFIER NOT NULL,
    PrimaryKeyValue NVARCHAR(500),
    Status NVARCHAR(20) DEFAULT 'Active',
    CreatedAt DATETIME DEFAULT GETDATE(),
    UpdatedAt DATETIME
);

-- 記錄值
CREATE TABLE DataSetRecordValues (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    RecordId UNIQUEIDENTIFIER NOT NULL,
    ColumnName NVARCHAR(100) NOT NULL,
    StringValue NVARCHAR(MAX),
    NumericValue DECIMAL(18,6),
    DateValue DATETIME,
    BooleanValue BIT,
    CreatedAt DATETIME DEFAULT GETDATE()
);
```

## ⚠️ **注意事項**

### **1. 文件格式**
- 支持 .xlsx 和 .xls 格式
- 文件大小限制為 10MB
- 工作表名稱預設為 "Sheet1"，可以自定義

### **2. 欄位命名**
- 系統會自動將標題轉換為欄位名稱（去除空格，轉小寫）
- 預設所有欄位為字串類型
- 第一列自動設為主鍵

### **3. 數據類型**
- 系統會自動檢測數字、日期、布林值等類型
- 支持 Excel 日期序列號轉換
- 無法識別的類型會存儲為字串

##  **故障排除**

### **1. 常見問題**
- **文件上傳失敗**: 檢查文件格式和大小
- **同步失敗**: 檢查文件路徑和工作表名稱
- **數據不完整**: 檢查 Excel 文件格式和空行空列

### **2. 日誌查看**
- 後端日誌會記錄詳細的處理過程
- 包括文件路徑、工作表名稱、處理記錄數等信息
- 錯誤時會記錄具體的異常信息

### **3. 性能優化**
- 支持大文件處理（限制 10MB）
- 批量插入數據到相關表
- 可以考慮添加轉換結果緩存

---

**最後更新**: 2025年8月20日

## 📋 **分析舊 MD 文件內容**

### 1. **EXCEL_DATE_CONVERSION_FIX.md** - 需要保留並整合
- **內容價值**: 高 - 包含重要的 Excel 日期轉換修復邏輯
- **建議**: 整合到 `docs/features/EXCEL_INTEGRATION.md`

### 2. **EXCEL_DATASOURCE_TESTING.md** - 需要保留並整合
- **內容價值**: 高 - 包含 Excel 數據源測試說明和技術實現
- **建議**: 整合到 `docs/features/EXCEL_INTEGRATION.md`

### 3. **README_DocumentConverter.md** - 需要保留並整合
- **內容價值**: 高 - 包含完整的文檔轉換功能說明
- **建議**: 整合到 `docs/features/DOCUMENT_CONVERSION.md`

### 4. **FORMIO_SETUP_SUMMARY.md** - 需要保留並整合
- **內容價值**: 中 - 包含 Form.io 設定總結
- **建議**: 整合到 `docs/features/EFORM_SYSTEM.md`

### 5. **API_MODIFICATIONS_SUMMARY.md** - 需要保留並整合
- **內容價值**: 中 - 包含 API 修改記錄
- **建議**: 整合到 `docs/technical/API_REFERENCE.md`

### 6. **UI_LOGIC_UPDATE.md** - 需要保留並整合
- **內容價值**: 中 - 包含 UI 邏輯更新
- **建議**: 整合到 `docs/features/DELIVERY_MANAGEMENT.md`

##  **建議的整合方案**

我建議創建以下新的文檔來整合這些內容：

### 1. **創建 Excel 集成文檔**

```markdown:docs/features/EXCEL_INTEGRATION.md
# Excel 數據源集成

## 🎯 **功能概述**

WhattoFlow 系統支持從 Excel 文件導入數據到 DataSet，包括自動創建欄位定義、導入數據記錄，並支持智能數據類型檢測和轉換。

##  **核心功能**

### **1. 支持的 Excel 格式**
- **Excel 2007+**: .xlsx 格式（推薦）
- **Excel 97-2003**: .xls 格式
- **文件大小**: 最大支持 10MB
- **工作表**: 支持多工作表選擇

### **2. 智能欄位檢測**
- **標題行解析**: 自動識別第一行作為欄位名稱
- **數據類型推斷**: 智能檢測數字、日期、布林值等類型
- **欄位屬性**: 自動設置主鍵、可搜尋、可排序等屬性
- **自定義配置**: 支持手動調整欄位屬性

### **3. 數據轉換能力**
- **日期處理**: 支持 Excel 日期序列號轉換
- **數字格式**: 自動處理小數和整數
- **文本處理**: 支持長文本和短文本
- **布林值**: 自動識別是/否、真/假等值

##  **技術實現**

### **1. 後端處理架構**
```csharp
// 使用 DocumentFormat.OpenXml 讀取 Excel 文件
using DocumentFormat.OpenXml.Spreadsheet;
using DocumentFormat.OpenXml.Packaging;

public class ExcelDataProcessor
{
    public async Task<ProcessResult> ProcessExcelFile(string filePath, string sheetName)
    {
        using (var spreadsheetDocument = SpreadsheetDocument.Open(filePath, false))
        {
            var workbookPart = spreadsheetDocument.WorkbookPart;
            var worksheetPart = GetWorksheetPart(workbookPart, sheetName);
            var worksheet = worksheetPart.Worksheet;
            
            // 處理數據...
        }
    }
}
```

### **2. 日期轉換算法**
```csharp
private DateTime? ConvertExcelDateToSqlDate(string excelValue)
{
    if (string.IsNullOrWhiteSpace(excelValue))
        return null;

    try
    {
        // 嘗試直接解析為日期（如果已經是標準日期格式）
        if (DateTime.TryParse(excelValue, out var directDate))
        {
            return directDate;
        }

        // 嘗試解析為 Excel 日期序列號
        if (double.TryParse(excelValue, out var excelDateNumber))
        {
            if (excelDateNumber >= 1 && excelDateNumber <= 2958465)
            {
                var baseDate = new DateTime(1900, 1, 1);
                var calculatedDate = baseDate.AddDays(excelDateNumber - 1);
                
                // 修正 Excel 1900 年閏年錯誤
                if (calculatedDate >= new DateTime(1900, 3, 1))
                {
                    calculatedDate = calculatedDate.AddDays(-1);
                }
                
                return calculatedDate;
            }
        }

        return null;
    }
    catch (Exception ex)
    {
        _loggingService.LogError($"Excel 日期轉換失敗: {ex.Message}", ex);
        return null;
    }
}
```

### **3. 數據類型檢測**
```csharp
private string InferDataTypeFromSample(string value)
{
    if (string.IsNullOrWhiteSpace(value))
        return "string";

    // 檢測日期
    if (IsDateCellAdvanced(value) || IsExcelDateNumber(value))
        return "datetime";

    // 檢測數字
    if (decimal.TryParse(value, out _))
        return "decimal";

    // 檢測布林值
    if (IsBooleanValue(value))
        return "boolean";

    // 默認為字串
    return "string";
}

private bool IsExcelDateNumber(string value)
{
    if (double.TryParse(value, out var numericValue))
    {
        if (numericValue >= 1 && numericValue <= 2958465)
        {
            try
            {
                var baseDate = new DateTime(1900, 1, 1);
                var calculatedDate = baseDate.AddDays(numericValue - 1);
                
                if (calculatedDate >= new DateTime(1900, 3, 1))
                {
                    calculatedDate = calculatedDate.AddDays(-1);
                }
                
                return calculatedDate.Year >= 1900 && calculatedDate.Year <= 9999;
            }
            catch
            {
                return false;
            }
        }
    }
    return false;
}
```

##  **使用流程**

### **1. 創建 DataSet**
1. 點擊「創建 Data Set」按鈕
2. 填寫基本資訊（名稱、描述）
3. 選擇數據源類型：**EXCEL**
4. 上傳 Excel 文件
5. 選擇工作表名稱
6. 系統自動生成欄位定義
7. 保存 DataSet

### **2. 數據同步**
1. 在 DataSet 列表中點擊「同步數據」按鈕
2. 系統自動：
   - 讀取 Excel 文件
   - 創建欄位定義（如果不存在）
   - 導入數據記錄
   - 顯示處理結果

### **3. 查看結果**
1. 點擊「查看記錄」按鈕
2. 檢查導入的數據是否正確
3. 在數據庫中驗證相關表

##  **前端功能**

### **1. 文件上傳組件**
```jsx
<Upload
  name="file"
  accept=".xlsx,.xls"
  beforeUpload={(file) => {
    const isExcel = file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
                    file.type === 'application/vnd.ms-excel';
    if (!isExcel) {
      message.error('只能上傳 Excel 文件！');
      return false;
    }
    
    const isLt10M = file.size / 1024 / 1024 < 10;
    if (!isLt10M) {
      message.error('文件大小不能超過 10MB！');
      return false;
    }
    
    return true;
  }}
  customRequest={async ({ file, onSuccess, onError }) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/datasets-upload/excel', {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          dataSourceForm.setFieldsValue({ excelFilePath: result.filePath });
          message.success(`${file.name} 上傳成功`);
          onSuccess(result);
        } else {
          throw new Error(result.message);
        }
      } else {
        throw new Error('文件上傳失敗');
      }
    } catch (error) {
      message.error(`上傳失敗: ${error.message}`);
      onError(error);
    }
  }}
>
  <Button icon={<UploadOutlined />}>上傳 Excel 文件</Button>
</Upload>
```

### **2. 工作表選擇**
```jsx
<Form.Item name="excelSheetName" label="工作表名稱">
  <Select 
    placeholder="選擇工作表"
    onChange={(value) => handleSheetChange(value)}
    loading={sheetLoading}
  >
    {sheetNames.map(name => (
      <Select.Option key={name} value={name}>
        {name}
      </Select.Option>
    ))}
  </Select>
</Form.Item>
```

##  **API 端點**

### **1. 文件上傳**
```
POST /api/datasets-upload/excel
Content-Type: multipart/form-data

參數:
- file: Excel 文件

響應:
{
  "success": true,
  "filePath": "uploads/excel/20241219120000_12345678-1234-1234-1234-123456789012.xlsx",
  "message": "文件上傳成功"
}
```

### **2. 工作表列表**
```
GET /api/datasets-upload/excel/sheets?filePath={filePath}

響應:
{
  "success": true,
  "sheetNames": ["Sheet1", "Sheet2", "Sheet3"]
}
```

### **3. 欄位預覽**
```
GET /api/datasets-upload/excel/preview?filePath={filePath}&sheetName={sheetName}

響應:
{
  "success": true,
  "columns": [
    {
      "columnName": "customer_id",
      "displayName": "客戶編號",
      "dataType": "string",
      "maxLength": 50,
      "isRequired": true
    }
  ]
}
```

### **4. 數據同步**
```
POST /api/datasets/{id}/sync

響應:
{
  "success": true,
  "data": {
    "totalRecords": 100,
    "processedRecords": 100,
    "errors": []
  },
  "message": "同步成功"
}
```

## ️ **數據庫結構**

### **1. 主要表結構**
```sql
-- 數據集表
CREATE TABLE DataSets (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    Name NVARCHAR(100) NOT NULL,
    Description NVARCHAR(500),
    DataSourceType NVARCHAR(50),
    CompanyId UNIQUEIDENTIFIER NOT NULL,
    Status NVARCHAR(20) DEFAULT 'Active',
    CreatedAt DATETIME DEFAULT GETDATE(),
    CreatedBy NVARCHAR(100),
    UpdatedAt DATETIME,
    UpdatedBy NVARCHAR(100)
);

-- 數據集欄位表
CREATE TABLE DataSetColumns (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    DataSetId UNIQUEIDENTIFIER NOT NULL,
    ColumnName NVARCHAR(100) NOT NULL,
    DisplayName NVARCHAR(100),
    DataType NVARCHAR(50) NOT NULL,
    MaxLength INT,
    IsRequired BIT DEFAULT 0,
    IsPrimaryKey BIT DEFAULT 0,
    IsSearchable BIT DEFAULT 1,
    IsSortable BIT DEFAULT 1,
    IsIndexed BIT DEFAULT 0,
    DefaultValue NVARCHAR(500),
    SortOrder INT DEFAULT 0
);

-- 數據記錄
CREATE TABLE DataSetRecords (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    DataSetId UNIQUEIDENTIFIER NOT NULL,
    PrimaryKeyValue NVARCHAR(500),
    Status NVARCHAR(20) DEFAULT 'Active',
    CreatedAt DATETIME DEFAULT GETDATE(),
    UpdatedAt DATETIME
);

-- 記錄值
CREATE TABLE DataSetRecordValues (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    RecordId UNIQUEIDENTIFIER NOT NULL,
    ColumnName NVARCHAR(100) NOT NULL,
    StringValue NVARCHAR(MAX),
    NumericValue DECIMAL(18,6),
    DateValue DATETIME,
    BooleanValue BIT,
    CreatedAt DATETIME DEFAULT GETDATE()
);
```

## ⚠️ **注意事項**

### **1. 文件格式**
- 支持 .xlsx 和 .xls 格式
- 文件大小限制為 10MB
- 工作表名稱預設為 "Sheet1"，可以自定義

### **2. 欄位命名**
- 系統會自動將標題轉換為欄位名稱（去除空格，轉小寫）
- 預設所有欄位為字串類型
- 第一列自動設為主鍵

### **3. 數據類型**
- 系統會自動檢測數字、日期、布林值等類型
- 支持 Excel 日期序列號轉換
- 無法識別的類型會存儲為字串

##  **故障排除**

### **1. 常見問題**
- **文件上傳失敗**: 檢查文件格式和大小
- **同步失敗**: 檢查文件路徑和工作表名稱
- **數據不完整**: 檢查 Excel 文件格式和空行空列

### **2. 日誌查看**
- 後端日誌會記錄詳細的處理過程
- 包括文件路徑、工作表名稱、處理記錄數等信息
- 錯誤時會記錄具體的異常信息

### **3. 性能優化**
- 支持大文件處理（限制 10MB）
- 批量插入數據到相關表
- 可以考慮添加轉換結果緩存

---

**最後更新**: 2025年8月20日

## 📋 **分析舊 MD 文件內容**

### 1. **EXCEL_DATE_CONVERSION_FIX.md** - 需要保留並整合
- **內容價值**: 高 - 包含重要的 Excel 日期轉換修復邏輯
- **建議**: 整合到 `docs/features/EXCEL_INTEGRATION.md`

### 2. **EXCEL_DATASOURCE_TESTING.md** - 需要保留並整合
- **內容價值**: 高 - 包含 Excel 數據源測試說明和技術實現
- **建議**: 整合到 `docs/features/EXCEL_INTEGRATION.md`

### 3. **README_DocumentConverter.md** - 需要保留並整合
- **內容價值**: 高 - 包含完整的文檔轉換功能說明
- **建議**: 整合到 `docs/features/DOCUMENT_CONVERSION.md`

### 4. **FORMIO_SETUP_SUMMARY.md** - 需要保留並整合
- **內容價值**: 中 - 包含 Form.io 設定總結
- **建議**: 整合到 `docs/features/EFORM_SYSTEM.md`

### 5. **API_MODIFICATIONS_SUMMARY.md** - 需要保留並整合
- **內容價值**: 中 - 包含 API 修改記錄
- **建議**: 整合到 `docs/technical/API_REFERENCE.md`

### 6. **UI_LOGIC_UPDATE.md** - 需要保留並整合
- **內容價值**: 中 - 包含 UI 邏輯更新
- **建議**: 整合到 `docs/features/DELIVERY_MANAGEMENT.md`

##  **建議的整合方案**

我建議創建以下新的文檔來整合這些內容：

### 1. **創建 Excel 集成文檔**

```markdown:docs/features/EXCEL_INTEGRATION.md
# Excel 數據源集成

## 🎯 **功能概述**

WhattoFlow 系統支持從 Excel 文件導入數據到 DataSet，包括自動創建欄位定義、導入數據記錄，並支持智能數據類型檢測和轉換。

##  **核心功能**

### **1. 支持的 Excel 格式**
- **Excel 2007+**: .xlsx 格式（推薦）
- **Excel 97-2003**: .xls 格式
- **文件大小**: 最大支持 10MB
- **工作表**: 支持多工作表選擇

### **2. 智能欄位檢測**
- **標題行解析**: 自動識別第一行作為欄位名稱
- **數據類型推斷**: 智能檢測數字、日期、布林值等類型
- **欄位屬性**: 自動設置主鍵、可搜尋、可排序等屬性
- **自定義配置**: 支持手動調整欄位屬性

### **3. 數據轉換能力**
- **日期處理**: 支持 Excel 日期序列號轉換
- **數字格式**: 自動處理小數和整數
- **文本處理**: 支持長文本和短文本
- **布林值**: 自動識別是/否、真/假等值

##  **技術實現**

### **1. 後端處理架構**
```csharp
// 使用 DocumentFormat.OpenXml 讀取 Excel 文件
using DocumentFormat.OpenXml.Spreadsheet;
using DocumentFormat.OpenXml.Packaging;

public class ExcelDataProcessor
{
    public async Task<ProcessResult> ProcessExcelFile(string filePath, string sheetName)
    {
        using (var spreadsheetDocument = SpreadsheetDocument.Open(filePath, false))
        {
            var workbookPart = spreadsheetDocument.WorkbookPart;
            var worksheetPart = GetWorksheetPart(workbookPart, sheetName);
            var worksheet = worksheetPart.Worksheet;
            
            // 處理數據...
        }
    }
}
```

### **2. 日期轉換算法**
```csharp
private DateTime? ConvertExcelDateToSqlDate(string excelValue)
{
    if (string.IsNullOrWhiteSpace(excelValue))
        return null;

    try
    {
        // 嘗試直接解析為日期（如果已經是標準日期格式）
        if (DateTime.TryParse(excelValue, out var directDate))
        {
            return directDate;
        }

        // 嘗試解析為 Excel 日期序列號
        if (double.TryParse(excelValue, out var excelDateNumber))
        {
            if (excelDateNumber >= 1 && excelDateNumber <= 2958465)
            {
                var baseDate = new DateTime(1900, 1, 1);
                var calculatedDate = baseDate.AddDays(excelDateNumber - 1);
                
                // 修正 Excel 1900 年閏年錯誤
                if (calculatedDate >= new DateTime(1900, 3, 1))
                {
                    calculatedDate = calculatedDate.AddDays(-1);
                }
                
                return calculatedDate;
            }
        }

        return null;
    }
    catch (Exception ex)
    {
        _loggingService.LogError($"Excel 日期轉換失敗: {ex.Message}", ex);
        return null;
    }
}
```

### **3. 數據類型檢測**
```csharp
private string InferDataTypeFromSample(string value)
{
    if (string.IsNullOrWhiteSpace(value))
        return "string";

    // 檢測日期
    if (IsDateCellAdvanced(value) || IsExcelDateNumber(value))
        return "datetime";

    // 檢測數字
    if (decimal.TryParse(value, out _))
        return "decimal";

    // 檢測布林值
    if (IsBooleanValue(value))
        return "boolean";

    // 默認為字串
    return "string";
}

private bool IsExcelDateNumber(string value)
{
    if (double.TryParse(value, out var numericValue))
    {
        if (numericValue >= 1 && numericValue <= 2958465)
        {
            try
            {
                var baseDate = new DateTime(1900, 1, 1);
                var calculatedDate = baseDate.AddDays(numericValue - 1);
                
                if (calculatedDate >= new DateTime(1900, 3, 1))
                {
                    calculatedDate = calculatedDate.AddDays(-1);
                }
                
                return calculatedDate.Year >= 1900 && calculatedDate.Year <= 9999;
            }
            catch
            {
                return false;
            }
        }
    }
    return false;
}
```

##  **使用流程**

### **1. 創建 DataSet**
1. 點擊「創建 Data Set」按鈕
2. 填寫基本資訊（名稱、描述）
3. 選擇數據源類型：**EXCEL**
4. 上傳 Excel 文件
5. 選擇工作表名稱
6. 系統自動生成欄位定義
7. 保存 DataSet

### **2. 數據同步**
1. 在 DataSet 列表中點擊「同步數據」按鈕
2. 系統自動：
   - 讀取 Excel 文件
   - 創建欄位定義（如果不存在）
   - 導入數據記錄
   - 顯示處理結果

### **3. 查看結果**
1. 點擊「查看記錄」按鈕
2. 檢查導入的數據是否正確
3. 在數據庫中驗證相關表

##  **前端功能**

### **1. 文件上傳組件**
```jsx
<Upload
  name="file"
  accept=".xlsx,.xls"
  beforeUpload={(file) => {
    const isExcel = file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
                    file.type === 'application/vnd.ms-excel';
    if (!isExcel) {
      message.error('只能上傳 Excel 文件！');
      return false;
    }
    
    const isLt10M = file.size / 1024 / 1024 < 10;
    if (!isLt10M) {
      message.error('文件大小不能超過 10MB！');
      return false;
    }
    
    return true;
  }}
  customRequest={async ({ file, onSuccess, onError }) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/datasets-upload/excel', {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          dataSourceForm.setFieldsValue({ excelFilePath: result.filePath });
          message.success(`${file.name} 上傳成功`);
          onSuccess(result);
        } else {
          throw new Error(result.message);
        }
      } else {
        throw new Error('文件上傳失敗');
      }
    } catch (error) {
      message.error(`上傳失敗: ${error.message}`);
      onError(error);
    }
  }}
>
  <Button icon={<UploadOutlined />}>上傳 Excel 文件</Button>
</Upload>
```

### **2. 工作表選擇**
```jsx
<Form.Item name="excelSheetName" label="工作表名稱">
  <Select 
    placeholder="選擇工作表"
    onChange={(value) => handleSheetChange(value)}
    loading={sheetLoading}
  >
    {sheetNames.map(name => (
      <Select.Option key={name} value={name}>
        {name}
      </Select.Option>
    ))}
  </Select>
</Form.Item>
```

##  **API 端點**

### **1. 文件上傳**
```
POST /api/datasets-upload/excel
Content-Type: multipart/form-data

參數:
- file: Excel 文件

響應:
{
  "success": true,
  "filePath": "uploads/excel/20241219120000_12345678-1234-1234-1234-123456789012.xlsx",
  "message": "文件上傳成功"
}
```

### **2. 工作表列表**
```
GET /api/datasets-upload/excel/sheets?filePath={filePath}

響應:
{
  "success": true,
  "sheetNames": ["Sheet1", "Sheet2", "Sheet3"]
}
```

### **3. 欄位預覽**
```
GET /api/datasets-upload/excel/preview?filePath={filePath}&sheetName={sheetName}

響應:
{
  "success": true,
  "columns": [
    {
      "columnName": "customer_id",
      "displayName": "客戶編號",
      "dataType": "string",
      "maxLength": 50,
      "isRequired": true
    }
  ]
}
```

### **4. 數據同步**
```
POST /api/datasets/{id}/sync

響應:
{
  "success": true,
  "data": {
    "totalRecords": 100,
    "processedRecords": 100,
    "errors": []
  },
  "message": "同步成功"
}
```

## ️ **數據庫結構**

### **1. 主要表結構**
```sql
-- 數據集表
CREATE TABLE DataSets (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    Name NVARCHAR(100) NOT NULL,
    Description NVARCHAR(500),
    DataSourceType NVARCHAR(50),
    CompanyId UNIQUEIDENTIFIER NOT NULL,
    Status NVARCHAR(20) DEFAULT 'Active',
    CreatedAt DATETIME DEFAULT GETDATE(),
    CreatedBy NVARCHAR(100),
    UpdatedAt DATETIME,
    UpdatedBy NVARCHAR(100)
);

-- 數據集欄位表
CREATE TABLE DataSetColumns (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    DataSetId UNIQUEIDENTIFIER NOT NULL,
    ColumnName NVARCHAR(100) NOT NULL,
    DisplayName NVARCHAR(100),
    DataType NVARCHAR(50) NOT NULL,
    MaxLength INT,
    IsRequired BIT DEFAULT 0,
    IsPrimaryKey BIT DEFAULT 0,
    IsSearchable BIT DEFAULT 1,
    IsSortable BIT DEFAULT 1,
    IsIndexed BIT DEFAULT 0,
    DefaultValue NVARCHAR(500),
    SortOrder INT DEFAULT 0
);

-- 數據記錄
CREATE TABLE DataSetRecords (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    DataSetId UNIQUEIDENTIFIER NOT NULL,
    PrimaryKeyValue NVARCHAR(500),
    Status NVARCHAR(20) DEFAULT 'Active',
    CreatedAt DATETIME DEFAULT GETDATE(),
    UpdatedAt DATETIME
);

-- 記錄值
CREATE TABLE DataSetRecordValues (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    RecordId UNIQUEIDENTIFIER NOT NULL,
    ColumnName NVARCHAR(100) NOT NULL,
    StringValue NVARCHAR(MAX),
    NumericValue DECIMAL(18,6),
    DateValue DATETIME,
    BooleanValue BIT,
    CreatedAt DATETIME DEFAULT GETDATE()
);
```

## ⚠️ **注意事項**

### **1. 文件格式**
- 支持 .xlsx 和 .xls 格式
- 文件大小限制為 10MB
- 工作表名稱預設為 "Sheet1"，可以自定義

### **2. 欄位命名**
- 系統會自動將標題轉換為欄位名稱（去除空格，轉小寫）
- 預設所有欄位為字串類型
- 第一列自動設為主鍵

### **3. 數據類型**
- 系統會自動檢測數字、日期、布林值等類型
- 支持 Excel 日期序列號轉換
- 無法識別的類型會存儲為字串

##  **故障排除**

### **1. 常見問題**
- **文件上傳失敗**: 檢查文件格式和大小
- **同步失敗**: 檢查文件路徑和工作表名稱
- **數據不完整**: 檢查 Excel 文件格式和空行空列

### **2. 日誌查看**
- 後端日誌會記錄詳細的處理過程
- 包括文件路徑、工作表名稱、處理記錄數等信息
- 錯誤時會記錄具體的異常信息

### **3. 性能優化**
- 支持大文件處理（限制 10MB）
- 批量插入數據到相關表
- 可以考慮添加轉換結果緩存

---

**最後更新**: 2025年8月20日

## 📋 **分析舊 MD 文件內容**

### 1. **EXCEL_DATE_CONVERSION_FIX.md** - 需要保留並整合
- **內容價值**: 高 - 包含重要的 Excel 日期轉換修復邏輯
- **建議**: 整合到 `docs/features/EXCEL_INTEGRATION.md`

### 2. **EXCEL_DATASOURCE_TESTING.md** - 需要保留並整合
- **內容價值**: 高 - 包含 Excel 數據源測試說明和技術實現
- **建議**: 整合到 `docs/features/EXCEL_INTEGRATION.md`

### 3. **README_DocumentConverter.md** - 需要保留並整合
- **內容價值**: 高 - 包含完整的文檔轉換功能說明
- **建議**: 整合到 `docs/features/DOCUMENT_CONVERSION.md`

### 4. **FORMIO_SETUP_SUMMARY.md** - 需要保留並整合
- **內容價值**: 中 - 包含 Form.io 設定總結
- **建議**: 整合到 `docs/features/EFORM_SYSTEM.md`

### 5. **API_MODIFICATIONS_SUMMARY.md** - 需要保留並整合
- **內容價值**: 中 - 包含 API 修改記錄
- **建議**: 整合到 `docs/technical/API_REFERENCE.md`

### 6. **UI_LOGIC_UPDATE.md** - 需要保留並整合
- **內容價值**: 中 - 包含 UI 邏輯更新
- **建議**: 整合到 `docs/features/DELIVERY_MANAGEMENT.md`

##  **建議的整合方案**

我建議創建以下新的文檔來整合這些內容：

### 1. **創建 Excel 集成文檔**

```markdown:docs/features/EXCEL_INTEGRATION.md
# Excel 數據源集成

## 🎯 **功能概述**

WhattoFlow 系統支持從 Excel 文件導入數據到 DataSet，包括自動創建欄位定義、導入數據記錄，並支持智能數據類型檢測和轉換。

##  **核心功能**

### **1. 支持的 Excel 格式**
- **Excel 2007+**: .xlsx 格式（推薦）
- **Excel 97-2003**: .xls 格式
- **文件大小**: 最大支持 10MB
- **工作表**: 支持多工作表選擇

### **2. 智能欄位檢測**
- **標題行解析**: 自動識別第一行作為欄位名稱
- **數據類型推斷**: 智能檢測數字、日期、布林值等類型
- **欄位屬性**: 自動設置主鍵、可搜尋、可排序等屬性
- **自定義配置**: 支持手動調整欄位屬性

### **3. 數據轉換能力**
- **日期處理**: 支持 Excel 日期序列號轉換
- **數字格式**: 自動處理小數和整數
- **文本處理**: 支持長文本和短文本
- **布林值**: 自動識別是/否、真/假等值

##  **技術實現**

### **1. 後端處理架構**
```csharp
// 使用 DocumentFormat.OpenXml 讀取 Excel 文件
using DocumentFormat.OpenXml.Spreadsheet;
using DocumentFormat.OpenXml.Packaging;

public class ExcelDataProcessor
{
    public async Task<ProcessResult> ProcessExcelFile(string filePath, string sheetName)
    {
        using (var spreadsheetDocument = SpreadsheetDocument.Open(filePath, false))
        {
            var workbookPart = spreadsheetDocument.WorkbookPart;
            var worksheetPart = GetWorksheetPart(workbookPart, sheetName);
            var worksheet = worksheetPart.Worksheet;
            
            // 處理數據...
        }
    }
}
```

### **2. 日期轉換算法**
```csharp
private DateTime? ConvertExcelDateToSqlDate(string excelValue)
{
    if (string.IsNullOrWhiteSpace(excelValue))
        return null;

    try
    {
        // 嘗試直接解析為日期（如果已經是標準日期格式）
        if (DateTime.TryParse(excelValue, out var directDate))
        {
            return directDate;
        }

        // 嘗試解析為 Excel 日期序列號
        if (double.TryParse(excelValue, out var excelDateNumber))
        {
            if (excelDateNumber >= 1 && excelDateNumber <= 2958465)
            {
                var baseDate = new DateTime(1900, 1, 1);
                var calculatedDate = baseDate.AddDays(excelDateNumber - 1);
                
                // 修正 Excel 1900 年閏年錯誤
                if (calculatedDate >= new DateTime(1900, 3, 1))
                {
                    calculatedDate = calculatedDate.AddDays(-1);
                }
                
                return calculatedDate;
            }
        }

        return null;
    }
    catch (Exception ex)
    {
        _loggingService.LogError($"Excel 日期轉換失敗: {ex.Message}", ex);
        return null;
    }
}
```

### **3. 數據類型檢測**
```csharp
private string InferDataTypeFromSample(string value)
{
    if (string.IsNullOrWhiteSpace(value))
        return "string";

    // 檢測日期
    if (IsDateCellAdvanced(value) || IsExcelDateNumber(value))
        return "datetime";

    // 檢測數字
    if (decimal.TryParse(value, out _))
        return "decimal";

    // 檢測布林值
    if (IsBooleanValue(value))
        return "boolean";

    // 默認為字串
    return "string";
}

private bool IsExcelDateNumber(string value)
{
    if (double.TryParse(value, out var numericValue))
    {
        if (numericValue >= 1 && numericValue <= 2958465)
        {
            try
            {
                var baseDate = new DateTime(1900, 1, 1);
                var calculatedDate = baseDate.AddDays(numericValue - 1);
                
                if (calculatedDate >= new DateTime(1900, 3, 1))
                {
                    calculatedDate = calculatedDate.AddDays(-1);
                }
                
                return calculatedDate.Year >= 1900 && calculatedDate.Year <= 9999;
            }
            catch
            {
                return false;
            }
        }
    }
    return false;
}
```

##  **使用流程**

### **1. 創建 DataSet**
1. 點擊「創建 Data Set」按鈕
2. 填寫基本資訊（名稱、描述）
3. 選擇數據源類型：**EXCEL**
4. 上傳 Excel 文件
5. 選擇工作表名稱
6. 系統自動生成欄位定義
7. 保存 DataSet

### **2. 數據同步**
1. 在 DataSet 列表中點擊「同步數據」按鈕
2. 系統自動：
   - 讀取 Excel 文件
   - 創建欄位定義（如果不存在）
   - 導入數據記錄
   - 顯示處理結果

### **3. 查看結果**
1. 點擊「查看記錄」按鈕
2. 檢查導入的數據是否正確
3. 在數據庫中驗證相關表

##  **前端功能**

### **1. 文件上傳組件**
```jsx
<Upload
  name="file"
  accept=".xlsx,.xls"
  beforeUpload={(file) => {
    const isExcel = file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
                    file.type === 'application/vnd.ms-excel';
    if (!isExcel) {
      message.error('只能上傳 Excel 文件！');
      return false;
    }
    
    const isLt10M = file.size / 1024 / 1024 < 10;
    if (!isLt10M) {
      message.error('文件大小不能超過 10MB！');
      return false;
    }
    
    return true;
  }}
  customRequest={async ({ file, onSuccess, onError }) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/datasets-upload/excel', {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          dataSourceForm.setFieldsValue({ excelFilePath: result.filePath });
          message.success(`${file.name} 上傳成功`);
          onSuccess(result);
        } else {
          throw new Error(result.message);
        }
      } else {
        throw new Error('文件上傳失敗');
      }
    } catch (error) {
      message.error(`上傳失敗: ${error.message}`);
      onError(error);
    }
  }}
>
  <Button icon={<UploadOutlined />}>上傳 Excel 文件</Button>
</Upload>
```

### **2. 工作表選擇**
```jsx
<Form.Item name="excelSheetName" label="工作表名稱">
  <Select 
    placeholder="選擇工作表"
    onChange={(value) => handleSheetChange(value)}
    loading={sheetLoading}
  >
    {sheetNames.map(name => (
      <Select.Option key={name} value={name}>
        {name}
      </Select.Option>
    ))}
  </Select>
</Form.Item>
```

##  **API 端點**

### **1. 文件上傳**
```
POST /api/datasets-upload/excel
Content-Type: multipart/form-data

參數:
- file: Excel 文件

響應:
{
  "success": true,
  "filePath": "uploads/excel/20241219120000_12345678-1234-1234-1234-123456789012.xlsx",
  "message": "文件上傳成功"
}
```

### **2. 工作表列表**
```
GET /api/datasets-upload/excel/sheets?filePath={filePath}

響應:
{
  "success": true,
  "sheetNames": ["Sheet1", "Sheet2", "Sheet3"]
}
```

### **3. 欄位預覽**
```
GET /api/datasets-upload/excel/preview?filePath={filePath}&sheetName={sheetName}

響應:
{
  "success": true,
  "columns": [
    {
      "columnName": "customer_id",
      "displayName": "客戶編號",
      "dataType": "string",
      "maxLength": 50,
      "isRequired": true
    }
  ]
}
```

### **4. 數據同步**
```
POST /api/datasets/{id}/sync

響應:
{
  "success": true,
  "data": {
    "totalRecords": 100,
    "processedRecords": 100,
    "errors": []
  },
  "message": "同步成功"
}
```

## ️ **數據庫結構**

### **1. 主要表結構**
```sql
-- 數據集表
CREATE TABLE DataSets (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    Name NVARCHAR(100) NOT NULL,
    Description NVARCHAR(500),
    DataSourceType NVARCHAR(50),
    CompanyId UNIQUEIDENTIFIER NOT NULL,
    Status NVARCHAR(20) DEFAULT 'Active',
    CreatedAt DATETIME DEFAULT GETDATE(),
    CreatedBy NVARCHAR(100),
    UpdatedAt DATETIME,
    UpdatedBy NVARCHAR(100)
);

-- 數據集欄位表
CREATE TABLE DataSetColumns (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    DataSetId UNIQUEIDENTIFIER NOT NULL,
    ColumnName NVARCHAR(100) NOT NULL,
    DisplayName NVARCHAR(100),
    DataType NVARCHAR(50) NOT NULL,
    MaxLength INT,
    IsRequired BIT DEFAULT 0,
    IsPrimaryKey BIT DEFAULT 0,
    IsSearchable BIT DEFAULT 1,
    IsSortable BIT DEFAULT 1,
    IsIndexed BIT DEFAULT 0,
    DefaultValue NVARCHAR(500),
    SortOrder INT DEFAULT 0
);

-- 數據記錄
CREATE TABLE DataSetRecords (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    DataSetId UNIQUEIDENTIFIER NOT NULL,
    PrimaryKeyValue NVARCHAR(500),
    Status NVARCHAR(20) DEFAULT 'Active',
    CreatedAt DATETIME DEFAULT GETDATE(),
    UpdatedAt DATETIME
);

-- 記錄值
CREATE TABLE DataSetRecordValues (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    RecordId UNIQUEIDENTIFIER NOT NULL,
    ColumnName NVARCHAR(100) NOT NULL,
    StringValue NVARCHAR(MAX),
    NumericValue DECIMAL(18,6),
    DateValue DATETIME,
    BooleanValue BIT,
    CreatedAt DATETIME DEFAULT GETDATE()
);
```

## ⚠️ **注意事項**

### **1. 文件格式**
- 支持 .xlsx 和 .xls 格式
- 文件大小限制為 10MB
- 工作表名稱預設為 "Sheet1"，可以自定義

### **2. 欄位命名**
- 系統會自動將標題轉換為欄位名稱（去除空格，轉小寫）
- 預設所有欄位為字串類型
- 第一列自動設為主鍵

### **3. 數據類型**
- 系統會自動檢測數字、日期、布林值等類型
- 支持 Excel 日期序列號轉換
- 無法識別的類型會存儲為字串

##  **故障排除**

### **1. 常見問題**
- **文件上傳失敗**: 檢查文件格式和大小
- **同步失敗**: 檢查文件路徑和工作表名稱
- **數據不完整**: 檢查 Excel 文件格式和空行空列

### **2. 日誌查看**
- 後端日誌會記錄詳細的處理過程
- 包括文件路徑、工作表名稱、處理記錄數等信息
- 錯誤時會記錄具體的異常信息

### **3. 性能優化**
- 支持大文件處理（限制 10MB）
- 批量插入數據到相關表
- 可以考慮添加轉換結果緩存

---

**最後更新**: 2025年8月20日

## 📋 **分析舊 MD 文件內容**

### 1. **EXCEL_DATE_CONVERSION_FIX.md** - 需要保留並整合
- **內容價值**: 高 - 包含重要的 Excel 日期轉換修復邏輯
- **建議**: 整合到 `docs/features/EXCEL_INTEGRATION.md`

### 2. **EXCEL_DATASOURCE_TESTING.md** - 需要保留並整合
- **內容價值**: 高 - 包含 Excel 數據源測試說明和技術實現
- **建議**: 整合到 `docs/features/EXCEL_INTEGRATION.md`

### 3. **README_DocumentConverter.md** - 需要保留並整合
- **內容價值**: 高 - 包含完整的文檔轉換功能說明
- **建議**: 整合到 `docs/features/DOCUMENT_CONVERSION.md`

### 4. **FORMIO_SETUP_SUMMARY.md** - 需要保留並整合
- **內容價值**: 中 - 包含 Form.io 設定總結
- **建議**: 整合到 `docs/features/EFORM_SYSTEM.md`

### 5. **API_MODIFICATIONS_SUMMARY.md** - 需要保留並整合
- **內容價值**: 中 - 包含 API 修改記錄
- **建議**: 整合到 `docs/technical/API_REFERENCE.md`

### 6. **UI_LOGIC_UPDATE.md** - 需要保留並整合
- **內容價值**: 中 - 包含 UI 邏輯更新
- **建議**: 整合到 `docs/features/DELIVERY_MANAGEMENT.md`

##  **建議的整合方案**

我建議創建以下新的文檔來整合這些內容：

### 1. **創建 Excel 集成文檔**

```markdown:docs/features/EXCEL_INTEGRATION.md
# Excel 數據源集成

## 🎯 **功能概述**

WhattoFlow 系統支持從 Excel 文件導入數據到 DataSet，包括自動創建欄位定義、導入數據記錄，並支持智能數據類型檢測和轉換。

##  **核心功能**

### **1. 支持的 Excel 格式**
- **Excel 2007+**: .xlsx 格式（推薦）
- **Excel 97-2003**: .xls 格式
- **文件大小**: 最大支持 10MB
- **工作表**: 支持多工作表選擇

### **2. 智能欄位檢測**
- **標題行解析**: 自動識別第一行作為欄位名稱
- **數據類型推斷**: 智能檢測數字、日期、布林值等類型
- **欄位屬性**: 自動設置主鍵、可搜尋、可排序等屬性
- **自定義配置**: 支持手動調整欄位屬性

### **3. 數據轉換能力**
- **日期處理**: 支持 Excel 日期序列號轉換
- **數字格式**: 自動處理小數和整數
- **文本處理**: 支持長文本和短文本
- **布林值**: 自動識別是/否、真/假等值

##  **技術實現**

### **1. 後端處理架構**
```csharp
// 使用 DocumentFormat.OpenXml 讀取 Excel 文件
using DocumentFormat.OpenXml.Spreadsheet;
using DocumentFormat.OpenXml.Packaging;

public class ExcelDataProcessor
{
    public async Task<ProcessResult> ProcessExcelFile(string filePath, string sheetName)
    {
        using (var spreadsheetDocument = SpreadsheetDocument.Open(filePath, false))
        {
            var workbookPart = spreadsheetDocument.WorkbookPart;
            var worksheetPart = GetWorksheetPart(workbookPart, sheetName);
            var worksheet = worksheetPart.Worksheet;
            
            // 處理數據...
        }
    }
}
```

### **2. 日期轉換算法**
```csharp
private DateTime? ConvertExcelDateToSqlDate(string excelValue)
{
    if (string.IsNullOrWhiteSpace(excelValue))
        return null;

    try
    {
        // 嘗試直接解析為日期（如果已經是標準日期格式）
        if (DateTime.TryParse(excelValue, out var directDate))
        {
            return directDate;
        }

        // 嘗試解析為 Excel 日期序列號
        if (double.TryParse(excelValue, out var excelDateNumber))
        {
            if (excelDateNumber >= 1 && excelDateNumber <= 2958465)
            {
                var baseDate = new DateTime(1900, 1, 1);
                var calculatedDate = baseDate.AddDays(excelDateNumber - 1);
                
                // 修正 Excel 1900 年閏年錯誤
                if (calculatedDate >= new DateTime(1900, 3, 1))
                {
                    calculatedDate = calculatedDate.AddDays(-1);
                }
                
                return calculatedDate;
            }
        }

        return null;
    }
    catch (Exception ex)
    {
        _loggingService.LogError($"Excel 日期轉換失敗: {ex.Message}", ex);
        return null;
    }
}
```

### **3. 數據類型檢測**
```csharp
private string InferDataTypeFromSample(string value)
{
    if (string.IsNullOrWhiteSpace(value))
        return "string";

    // 檢測日期
    if (IsDateCellAdvanced(value) || IsExcelDateNumber(value))
        return "datetime";

    // 檢測數字
    if (decimal.TryParse(value, out _))
        return "decimal";

    // 檢測布林值
    if (IsBooleanValue(value))
        return "boolean";

    // 默認為字串
    return "string";
}

private bool IsExcelDateNumber(string value)
{
    if (double.TryParse(value, out var numericValue))
    {
        if (numericValue >= 1 && numericValue <= 2958465)
        {
            try
            {
                var baseDate = new DateTime(1900, 1, 1);
                var calculatedDate = baseDate.AddDays(numericValue - 1);
                
                if (calculatedDate >= new DateTime(1900, 3, 1))
                {
                    calculatedDate = calculatedDate.AddDays(-1);
                }
                
                return calculatedDate.Year >= 1900 && calculatedDate.Year <= 9999;
            }
            catch
            {
                return false;
            }
        }
    }
    return false;
}
```

##  **使用流程**

### **1. 創建 DataSet**
1. 點擊「創建 Data Set」按鈕
2. 填寫基本資訊（名稱、描述）
3. 選擇數據源類型：**EXCEL**
4. 上傳 Excel 文件
5. 選擇工作表名稱
6. 系統自動生成欄位定義
7. 保存 DataSet

### **2. 數據同步**
1. 在 DataSet 列表中點擊「同步數據」按鈕
2. 系統自動：
   - 讀取 Excel 文件
   - 創建欄位定義（如果不存在）
   - 導入數據記錄
   - 顯示處理結果

### **3. 查看結果**
1. 點擊「查看記錄」按鈕
2. 檢查導入的數據是否正確
3. 在數據庫中驗證相關表

##  **前端功能**

### **1. 文件上傳組件**
```jsx
<Upload
  name="file"
  accept=".xlsx,.xls"
  beforeUpload={(file) => {
    const isExcel = file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
                    file.type === 'application/vnd.ms-excel';
    if (!isExcel) {
      message.error('只能上傳 Excel 文件！');
      return false;
    }
    
    const isLt10M = file.size / 1024 / 1024 < 10;
    if (!isLt10M) {
      message.error('文件大小不能超過 10MB！');
      return false;
    }
    
    return true;
  }}
  customRequest={async ({ file, onSuccess, onError }) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/datasets-upload/excel', {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          dataSourceForm.setFieldsValue({ excelFilePath: result.filePath });
          message.success(`${file.name} 上傳成功`);
          onSuccess(result);
        } else {
          throw new Error(result.message);
        }
      } else {
        throw new Error('文件上傳失敗');
      }
    } catch (error) {
      message.error(`上傳失敗: ${error.message}`);
      onError(error);
    }
  }}
>
  <Button icon={<UploadOutlined />}>上傳 Excel 文件</Button>
</Upload>
```

### **2. 工作表選擇**
```jsx
<Form.Item name="excelSheetName" label="工作表名稱">
  <Select 
    placeholder="選擇工作表"
    onChange={(value) => handleSheetChange(value)}
    loading={sheetLoading}
  >
    {sheetNames.map(name => (
      <Select.Option key={name} value={name}>
        {name}
      </Select.Option>
    ))}
  </Select>
</Form.Item>
```

##  **API 端點**

### **1. 文件上傳**
```
POST /api/datasets-upload/excel
Content-Type: multipart/form-data

參數:
- file: Excel 文件

響應:
{
  "success": true,
  "filePath": "uploads/excel/20241219120000_12345678-1234-1234-1234-123456789012.xlsx",
  "message": "文件上傳成功"
}
```

### **2. 工作表列表**
```
GET /api/datasets-upload/excel/sheets?filePath={filePath}

響應:
{
  "success": true,
  "sheetNames": ["Sheet1", "Sheet2", "Sheet3"]
}
```

### **3. 欄位預覽**
```
GET /api/datasets-upload/excel/preview?filePath={filePath}&sheetName={sheetName}

響應:
{
  "success": true,
  "columns": [
    {
      "columnName": "customer_id",
      "displayName": "客戶編號",
      "dataType": "string",
      "maxLength": 50,
      "isRequired": true
    }
  ]
}
```

### **4. 數據同步**
```
POST /api/datasets/{id}/sync

響應:
{
  "success": true,
  "data": {
    "totalRecords": 100,
    "processedRecords": 100,
    "errors": []
  },
  "message": "同步成功"
}
```

## ️ **數據庫結構**

### **1. 主要表結構**
```sql
-- 數據集表
CREATE TABLE DataSets (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    Name NVARCHAR(100) NOT NULL,
    Description NVARCHAR(500),
    DataSourceType NVARCHAR(50),
    CompanyId UNIQUEIDENTIFIER NOT NULL,
    Status NVARCHAR(20) DEFAULT 'Active',
    CreatedAt DATETIME DEFAULT GETDATE(),
    CreatedBy NVARCHAR(100),
    UpdatedAt DATETIME,
    UpdatedBy NVARCHAR(100)
);

-- 數據集欄位表
CREATE TABLE DataSetColumns (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    DataSetId UNIQUEIDENTIFIER NOT NULL,
    ColumnName NVARCHAR(100) NOT NULL,
    DisplayName NVARCHAR(100),
    DataType NVARCHAR(50) NOT NULL,
    MaxLength INT,
    IsRequired BIT DEFAULT 0,
    IsPrimaryKey BIT DEFAULT 0,
    IsSearchable BIT DEFAULT 1,
    IsSortable BIT DEFAULT 1,
    IsIndexed BIT DEFAULT 0,
    DefaultValue NVARCHAR(500),
    SortOrder INT DEFAULT 0
);

-- 數據記錄
CREATE TABLE DataSetRecords (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    DataSetId UNIQUEIDENTIFIER NOT NULL,
    PrimaryKeyValue NVARCHAR(500),
    Status NVARCHAR(20) DEFAULT 'Active',
    CreatedAt DATETIME DEFAULT GETDATE(),
    UpdatedAt DATETIME
);

-- 記錄值
CREATE TABLE DataSetRecordValues (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    RecordId UNIQUEIDENTIFIER NOT NULL,
    ColumnName NVARCHAR(100) NOT NULL,
    StringValue NVARCHAR(MAX),
    NumericValue DECIMAL(18,6),
    DateValue DATETIME,
    BooleanValue BIT,
    CreatedAt DATETIME DEFAULT GETDATE()
);
```

## ⚠️ **注意事項**

### **1. 文件格式**
- 支持 .xlsx 和 .xls 格式
- 文件大小限制為 10MB
- 工作表名稱預設為 "Sheet1"，可以自定義

### **2. 欄位命名**
- 系統會自動將標題轉換為欄位名稱（去除空格，轉小寫）
- 預設所有欄位為字串類型
- 第一列自動設為主鍵

### **3. 數據類型**
- 系統會自動檢測數字、日期、布林值等類型
- 支持 Excel 日期序列號轉換
- 無法識別的類型會存儲為字串

##  **故障排除**

### **1. 常見問題**
- **文件上傳失敗**: 檢查文件格式和大小
- **同步失敗**: 檢查文件路徑和工作表名稱
- **數據不完整**: 檢查 Excel 文件格式和空行空列

### **2. 日誌查看**
- 後端日誌會記錄詳細的處理過程
- 包括文件路徑、工作表名稱、處理記錄數等信息
- 錯誤時會記錄具體的異常信息

### **3. 性能優化**
- 支持大文件處理（限制 10MB）
- 批量插入數據到相關表
- 可以考慮添加轉換結果緩存

---

**最後更新**: 2025年8月20日

## 📋 **分析舊 MD 文件內容**

### 1. **EXCEL_DATE_CONVERSION_FIX.md** - 需要保留並整合
- **內容價值**: 高 - 包含重要的 Excel 日期轉換修復邏輯
- **建議**: 整合到 `docs/features/EXCEL_INTEGRATION.md`

### 2. **EXCEL_DATASOURCE_TESTING.md** - 需要保留並整合
- **內容價值**: 高 - 包含 Excel 數據源測試說明和技術實現
- **建議**: 整合到 `docs/features/EXCEL_INTEGRATION.md`

### 3. **README_DocumentConverter.md** - 需要保留並整合
- **內容價值**: 高 - 包含完整的文檔轉換功能說明
- **建議**: 整合到 `docs/features/DOCUMENT_CONVERSION.md`

### 4. **FORMIO_SETUP_SUMMARY.md** - 需要保留並整合
- **內容價值**: 中 - 包含 Form.io 設定總結
- **建議**: 整合到 `docs/features/EFORM_SYSTEM.md`

### 5. **API_MODIFICATIONS_SUMMARY.md** - 需要保留並整合
- **內容價值**: 中 - 包含 API 修改記錄
- **建議**: 整合到 `docs/technical/API_REFERENCE.md`

### 6. **UI_LOGIC_UPDATE.md** - 需要保留並整合
- **內容價值**: 中 - 包含 UI 邏輯更新
- **建議**: 整合到 `docs/features/DELIVERY_MANAGEMENT.md`

##  **建議的整合方案**

我建議創建以下新的文檔來整合這些內容：

### 1. **創建 Excel 集成文檔**

```markdown:docs/features/EXCEL_INTEGRATION.md
# Excel 數據源集成

## 🎯 **功能概述**

WhattoFlow 系統支持從 Excel 文件導入數據到 DataSet，包括自動創建欄位定義、導入數據記錄，並支持智能數據類型檢測和轉換。

##  **核心功能**

### **1. 支持的 Excel 格式**
- **Excel 2007+**: .xlsx 格式（推薦）
- **Excel 97-2003**: .xls 格式
- **文件大小**: 最大支持 10MB
- **工作表**: 支持多工作表選擇

### **2. 智能欄位檢測**
- **標題行解析**: 自動識別第一行作為欄位名稱
- **數據類型推斷**: 智能檢測數字、日期、布林值等類型
- **欄位屬性**: 自動設置主鍵、可搜尋、可排序等屬性
- **自定義配置**: 支持手動調整欄位屬性

### **3. 數據轉換能力**
- **日期處理**: 支持 Excel 日期序列號轉換
- **數字格式**: 自動處理小數和整數
- **文本處理**: 支持長文本和短文本
- **布林值**: 自動識別是/否、真/假等值

##  **技術實現**

### **1. 後端處理架構**
```csharp
// 使用 DocumentFormat.OpenXml 讀取 Excel 文件
using DocumentFormat.OpenXml.Spreadsheet;
using DocumentFormat.OpenXml.Packaging;

public class ExcelDataProcessor
{
    public async Task<ProcessResult> ProcessExcelFile(string filePath, string sheetName)
    {
        using (var spreadsheetDocument = SpreadsheetDocument.Open(filePath, false))
        {
            var workbookPart = spreadsheetDocument.WorkbookPart;
            var worksheetPart = GetWorksheetPart(workbookPart, sheetName);
            var worksheet = worksheetPart.Worksheet;
            
            // 處理數據...
        }
    }
}
```

### **2. 日期轉換算法**
```csharp
private DateTime? ConvertExcelDateToSqlDate(string excelValue)
{
    if (string.IsNullOrWhiteSpace(excelValue))
        return null;

    try
    {
        // 嘗試直接解析為日期（如果已經是標準日期格式）
        if (DateTime.TryParse(excelValue, out var directDate))
        {
            return directDate;
        }

        // 嘗試解析為 Excel 日期序列號
        if (double.TryParse(excelValue, out var excelDateNumber))
        {
            if (excelDateNumber >= 1 && excelDateNumber <= 2958465)
            {
                var baseDate = new DateTime(1900, 1, 1);
                var calculatedDate = baseDate.AddDays(excelDateNumber - 1);
                
                // 修正 Excel 1900 年閏年錯誤
                if (calculatedDate >= new DateTime(1900, 3, 1))
                {
                    calculatedDate = calculatedDate.AddDays(-1);
                }
                
                return calculatedDate;
            }
        }

        return null;
    }
    catch (Exception ex)
    {
        _loggingService.LogError($"Excel 日期轉換失敗: {ex.Message}", ex);
        return null;
    }
}
```

### **3. 數據類型檢測**
```csharp
private string InferDataTypeFromSample(string value)
{
    if (string.IsNullOrWhiteSpace(value))
        return "string";

    // 檢測日期
    if (IsDateCellAdvanced(value) || IsExcelDateNumber(value))
        return "datetime";

    // 檢測數字
    if (decimal.TryParse(value, out _))
        return "decimal";

    // 檢測布林值
    if (IsBooleanValue(value))
        return "boolean";

    // 默認為字串
    return "string";
}

private bool IsExcelDateNumber(string value)
{
    if (double.TryParse(value, out var numericValue))
    {
        if (numericValue >= 1 && numericValue <= 2958465)
        {
            try
            {
                var baseDate = new DateTime(1900, 1, 1);
                var calculatedDate = baseDate.AddDays(numericValue - 1);
                
                if (calculatedDate >= new DateTime(1900, 3, 1))
                {
                    calculatedDate = calculatedDate.AddDays(-1);
                }
                
                return calculatedDate.Year >= 1900 && calculatedDate.Year <= 9999;
            }
            catch
            {
                return false;
            }
        }
    }
    return false;
}
```

##  **使用流程**

### **1. 創建 DataSet**
1. 點擊「創建 Data Set」按鈕
2. 填寫基本資訊（名稱、描述）
3. 選擇數據源類型：**EXCEL**
4. 上傳 Excel 文件
5. 選擇工作表名稱
6. 系統自動生成欄位定義
7. 保存 DataSet

### **2. 數據同步**
1. 在 DataSet 列表中點擊「同步數據」按鈕
2. 系統自動：
   - 讀取 Excel 文件
   - 創建欄位定義（如果不存在）
   - 導入數據記錄
   - 顯示處理結果

### **3. 查看結果**
1. 點擊「查看記錄」按鈕
2. 檢查導入的數據是否正確
3. 在數據庫中驗證相關表

##  **前端功能**

### **1. 文件上傳組件**
```jsx
<Upload
  name="file"
  accept=".xlsx,.xls"
  beforeUpload={(file) => {
    const isExcel = file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
                    file.type === 'application/vnd.ms-excel';
    if (!isExcel) {
      message.error('只能上傳 Excel 文件！');
      return false;
    }
    
    const isLt10M = file.size / 1024 / 1024 < 10;
    if (!isLt10M) {
      message.error('文件大小不能超過 10MB！');
      return false;
    }
    
    return true;
  }}
  customRequest={async ({ file, onSuccess, onError }) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/datasets-upload/excel', {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          dataSourceForm.setFieldsValue({ excelFilePath: result.filePath });
          message.success(`${file.name} 上傳成功`);
          onSuccess(result);
        } else {
          throw new Error(result.message);
        }
      } else {
        throw new Error('文件上傳失敗');
      }
    } catch (error) {
      message.error(`上傳失敗: ${error.message}`);
      onError(error);
    }
  }}
>
  <Button icon={<UploadOutlined />}>上傳 Excel 文件</Button>
</Upload>
```

### **2. 工作表選擇**
```jsx
<Form.Item name="excelSheetName" label="工作表名稱">
  <Select 
    placeholder="選擇工作表"
    onChange={(value) => handleSheetChange(value)}
    loading={sheetLoading}
  >
    {sheetNames.map(name => (
      <Select.Option key={name} value={name}>
        {name}
      </Select.Option>
    ))}
  </Select>
</Form.Item>
```

##  **API 端點**

### **1. 文件上傳**
```
POST /api/datasets-upload/excel
Content-Type: multipart/form-data

參數:
- file: Excel 文件

響應:
{
  "success": true,
  "filePath": "uploads/excel/20241219120000_12345678-1234-1234-1234-123456789012.xlsx",
  "message": "文件上傳成功"
}
```

### **2. 工作表列表**
```
GET /api/datasets-upload/excel/sheets?filePath={filePath}

響應:
{
  "success": true,
  "sheetNames": ["Sheet1", "Sheet2", "Sheet3"]
}
```

### **3. 欄位預覽**
```
GET /api/datasets-upload/excel/preview?filePath={filePath}&sheetName={sheetName}

響應:
{
  "success": true,
  "columns": [
    {
      "columnName": "customer_id",
      "displayName": "客戶編號",
      "dataType": "string",
      "maxLength": 50,
      "isRequired": true
    }
  ]
}
```

### **4. 數據同步**
```
POST /api/datasets/{id}/sync

響應:
{
  "success": true,
  "data": {
    "totalRecords": 100,
    "processedRecords": 100,
    "errors": []
  },
  "message": "同步成功"
}
```

## ️ **數據庫結構**

### **1. 主要表結構**
```sql
-- 數據集表
CREATE TABLE DataSets (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    Name NVARCHAR(100) NOT NULL,
    Description NVARCHAR(500),
    DataSourceType NVARCHAR(50),
    CompanyId UNIQUEIDENTIFIER NOT NULL,
    Status NVARCHAR(20) DEFAULT 'Active',
    CreatedAt DATETIME DEFAULT GETDATE(),
    CreatedBy NVARCHAR(100),
    UpdatedAt DATETIME,
    UpdatedBy NVARCHAR(100)
);

-- 數據集欄位表
CREATE TABLE DataSetColumns (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    DataSetId UNIQUEIDENTIFIER NOT NULL,
    ColumnName NVARCHAR(100) NOT NULL,
    DisplayName NVARCHAR(100),
    DataType NVARCHAR(50) NOT NULL,
    MaxLength INT,
    IsRequired BIT DEFAULT 0,
    IsPrimaryKey BIT DEFAULT 0,
    IsSearchable BIT DEFAULT 1,
    IsSortable BIT DEFAULT 1,
    IsIndexed BIT DEFAULT 0,
    DefaultValue NVARCHAR(500),
    SortOrder INT DEFAULT 0
);

-- 數據記錄
CREATE TABLE DataSetRecords (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    DataSetId UNIQUEIDENTIFIER NOT NULL,
    PrimaryKeyValue NVARCHAR(500),
    Status NVARCHAR(20) DEFAULT 'Active',
    CreatedAt DATETIME DEFAULT GETDATE(),
    UpdatedAt DATETIME
);

-- 記錄值
CREATE TABLE DataSetRecordValues (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    RecordId UNIQUEIDENTIFIER NOT NULL,
    ColumnName NVARCHAR(100) NOT NULL,
    StringValue NVARCHAR(MAX),
    NumericValue DECIMAL(18,6),
    DateValue DATETIME,
    BooleanValue BIT,
    CreatedAt DATETIME DEFAULT GETDATE()
);
```

## ⚠️ **注意事項**

### **1. 文件格式**
- 支持 .xlsx 和 .xls 格式
- 文件大小限制為 10MB
- 工作表名稱預設為 "Sheet1"，可以自定義

### **2. 欄位命名**
- 系統會自動將標題轉換為欄位名稱（去除空格，轉小寫）
- 預設所有欄位為字串類型
- 第一列自動設為主鍵

### **3. 數據類型**
- 系統會自動檢測數字、日期、布林值等類型
- 支持 Excel 日期序列號轉換
- 無法識別的類型會存儲為字串

##  **故障排除**

### **1. 常見問題**
- **文件上傳失敗**: 檢查文件格式和大小
- **同步失敗**: 檢查文件路徑和工作表名稱
- **數據不完整**: 檢查 Excel 文件格式和空行空列

### **2. 日誌查看**
- 後端日誌會記錄詳細的處理過程
- 包括文件路徑、工作表名稱、處理記錄數等信息
- 錯誤時會記錄具體的異常信息

### **3. 性能優化**
- 支持大文件處理（限制 10MB）
- 批量插入數據到相關表
- 可以考慮添加轉換結果緩存

---

**最後更新**: 2025年8月20日

## 📋 **分析舊 MD 文件內容**

### 1. **EXCEL_DATE_CONVERSION_FIX.md** - 需要保留並整合
- **內容價值**: 高 - 包含重要的 Excel 日期轉換修復邏輯
- **建議**: 整合到 `docs/features/EXCEL_INTEGRATION.md`

### 2. **EXCEL_DATASOURCE_TESTING.md** - 需要保留並整合
- **內容價值**: 高 - 包含 Excel 數據源測試說明和技術實現
- **建議**: 整合到 `docs/features/EXCEL_INTEGRATION.md`

### 3. **README_DocumentConverter.md** - 需要保留並整合
- **內容價值**: 高 - 包含完整的文檔轉換功能說明
- **建議**: 整合到 `docs/features/DOCUMENT_CONVERSION.md`

### 4. **FORMIO_SETUP_SUMMARY.md** - 需要保留並整合
- **內容價值**: 中 - 包含 Form.io 設定總結
- **建議**: 整合到 `docs/features/EFORM_SYSTEM.md`

### 5. **API_MODIFICATIONS_SUMMARY.md** - 需要保留並整合
- **內容價值**: 中 - 包含 API 修改記錄
- **建議**: 整合到 `docs/technical/API_REFERENCE.md`

### 6. **UI_LOGIC_UPDATE.md** - 需要保留並整合
- **內容價值**: 中 - 包含 UI 邏輯更新
- **建議**: 整合到 `docs/features/DELIVERY_MANAGEMENT.md`

##  **建議的整合方案**

我建議創建以下新的文檔來整合這些內容：

### 1. **創建 Excel 集成文檔**

```markdown:docs/features/EXCEL_INTEGRATION.md
# Excel 數據源集成

## 🎯 **功能概述**

WhattoFlow 系統支持從 Excel 文件導入數據到 DataSet，包括自動創建欄位定義、導入數據記錄，並支持智能數據類型檢測和轉換。

##  **核心功能**

### **1. 支持的 Excel 格式**
- **Excel 2007+**: .xlsx 格式（推薦）
- **Excel 97-2003**: .xls 格式
- **文件大小**: 最大支持 10MB
- **工作表**: 支持多工作表選擇

### **2. 智能欄位檢測**
- **標題行解析**: 自動識別第一行作為欄位名稱
- **數據類型推斷**: 智能檢測數字、日期、布林值等類型
- **欄位屬性**: 自動設置主鍵、可搜尋、可排序等屬性
- **自定義配置**: 支持手動調整欄位屬性

### **3. 數據轉換能力**
- **日期處理**: 支持 Excel 日期序列號轉換
- **數字格式**: 自動處理小數和整數
- **文本處理**: 支持長文本和短文本
- **布林值**: 自動識別是/否、真/假等值

##  **技術實現**

### **1. 後端處理架構**
```csharp
// 使用 DocumentFormat.OpenXml 讀取 Excel 文件
using DocumentFormat.OpenXml.Spreadsheet;
using DocumentFormat.OpenXml.Packaging;

public class ExcelDataProcessor
{
    public async Task<ProcessResult> ProcessExcelFile(string filePath, string sheetName)
    {
        using (var spreadsheetDocument = SpreadsheetDocument.Open(filePath, false))
        {
            var workbookPart = spreadsheetDocument.WorkbookPart;
            var worksheetPart = GetWorksheetPart(workbookPart, sheetName);
            var worksheet = worksheetPart.Worksheet;
            
            // 處理數據...
        }
    }
}
```

### **2. 日期轉換算法**
```csharp
private DateTime? ConvertExcelDateToSqlDate(string excelValue)
{
    if (string.IsNullOrWhiteSpace(excelValue))
        return null;

    try
    {
        // 嘗試直接解析為日期（如果已經是標準日期格式）
        if (DateTime.TryParse(excelValue, out var directDate))
        {
            return directDate;
        }

        // 嘗試解析為 Excel 日期序列號
        if (double.TryParse(excelValue, out var excelDateNumber))
        {
            if (excelDateNumber >= 1 && excelDateNumber <= 2958465)
            {
                var baseDate = new DateTime(1900, 1, 1);
                var calculatedDate = baseDate.AddDays(excelDateNumber - 1);
                
                // 修正 Excel 1900 年閏年錯誤
                if (calculatedDate >= new DateTime(1900, 3, 1))
                {
                    calculatedDate = calculatedDate.AddDays(-1);
                }
                
                return calculatedDate;
            }
        }

        return null;
    }
    catch (Exception ex)
    {
        _loggingService.LogError($"Excel 日期轉換失敗: {ex.Message}", ex);
        return null;
    }
}
```

### **3. 數據類型檢測**
```csharp
private string InferDataTypeFromSample(string value)
{
    if (string.IsNullOrWhiteSpace(value))
        return "string";

    // 檢測日期
    if (IsDateCellAdvanced(value) || IsExcelDateNumber(value))
        return "datetime";

    // 檢測數字
    if (decimal.TryParse(value, out _))
        return "decimal";

    // 檢測布林值
    if (IsBooleanValue(value))
        return "boolean";

    // 默認為字串
    return "string";
}

private bool IsExcelDateNumber(string value)
{
    if (double.TryParse(value, out var numericValue))
    {
        if (numericValue >= 1 && numericValue <= 2958465)
        {
            try
            {
                var baseDate = new DateTime(1900, 1, 1);
                var calculatedDate = baseDate.AddDays(numericValue - 1);
                
                if (calculatedDate >= new DateTime(1900, 3, 1))
                {
                    calculatedDate = calculatedDate.AddDays(-1);
                }
                
                return calculatedDate.Year >= 1900 && calculatedDate.Year <= 9999;
            }
            catch
            {
                return false;
            }
        }
    }
    return false;
}
```

##  **使用流程**

### **1. 創建 DataSet**
1. 點擊「創建 Data Set」按鈕
2. 填寫基本資訊（名稱、描述）
3. 選擇數據源類型：**EXCEL**
4. 上傳 Excel 文件
5. 選擇工作表名稱
6. 系統自動生成欄位定義
7. 保存 DataSet

### **2. 數據同步**
1. 在 DataSet 列表中點擊「同步數據」按鈕
2. 系統自動：
   - 讀取 Excel 文件
   - 創建欄位定義（如果不存在）
   - 導入數據記錄
   - 顯示處理結果

### **3. 查看結果**
1. 點擊「查看記錄」按鈕
2. 檢查導入的數據是否正確
3. 在數據庫中驗證相關表

##  **前端功能**

### **1. 文件上傳組件**
```jsx
<Upload
  name="file"
  accept=".xlsx,.xls"
  beforeUpload={(file) => {
    const isExcel = file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
                    file.type === 'application/vnd.ms-excel';
    if (!isExcel) {
      message.error('只能上傳 Excel 文件！');
      return false;
    }
    
    const isLt10M = file.size / 1024 / 1024 < 10;
    if (!isLt10M) {
      message.error('文件大小不能超過 10MB！');
      return false;
    }
    
    return true;
  }}
  customRequest={async ({ file, onSuccess, onError }) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/datasets-upload/excel', {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          dataSourceForm.setFieldsValue({ excelFilePath: result.filePath });
          message.success(`${file.name} 上傳成功`);
          onSuccess(result);
        } else {
          throw new Error(result.message);
        }
      } else {
        throw new Error('文件上傳失敗');
      }
    } catch (error) {
      message.error(`上傳失敗: ${error.message}`);
      onError(error);
    }
  }}
>
  <Button icon={<UploadOutlined />}>上傳 Excel 文件</Button>
</Upload>
```

### **2. 工作表選擇**
```jsx
<Form.Item name="excelSheetName" label="工作表名稱">
  <Select 
    placeholder="選擇工作表"
    onChange={(value) => handleSheetChange(value)}
    loading={sheetLoading}
  >
    {sheetNames.map(name => (
      <Select.Option key={name} value={name}>
        {name}
      </Select.Option>
    ))}
  </Select>
</Form.Item>
```

##  **API 端點**

### **1. 文件上傳**
```
POST /api/datasets-upload/excel
Content-Type: multipart/form-data

參數:
- file: Excel 文件

響應:
{
  "success": true,
  "filePath": "uploads/excel/20241219120000_12345678-1234-1234-1234-123456789012.xlsx",
  "message": "文件上傳成功"
}
```

### **2. 工作表列表**
```
GET /api/datasets-upload/excel/sheets?filePath={filePath}

響應:
{
  "success": true,
  "sheetNames": ["Sheet1", "Sheet2", "Sheet3"]
}
```

### **3. 欄位預覽**
```
GET /api/datasets-upload/excel/preview?filePath={filePath}&sheetName={sheetName}

響應:
{
  "success": true,
  "columns": [
    {
      "columnName": "customer_id",
      "displayName": "客戶編號",
      "dataType": "string",
      "maxLength": 50,
      "isRequired": true
    }
  ]
}
```

### **4. 數據同步**
```
POST /api/datasets/{id}/sync

響應:
{
  "success": true,
  "data": {
    "totalRecords": 100,
    "processedRecords": 100,
    "errors": []
  },
  "message": "同步成功"
}
```

## ️ **數據庫結構**

### **1. 主要表結構**
```sql
-- 數據集表
CREATE TABLE DataSets (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    Name NVARCHAR(100) NOT NULL,
    Description NVARCHAR(500),
    DataSourceType NVARCHAR(50),
    CompanyId UNIQUEIDENTIFIER NOT NULL,
    Status NVARCHAR(20) DEFAULT 'Active',
    CreatedAt DATETIME DEFAULT GETDATE(),
    CreatedBy NVARCHAR(100),
    UpdatedAt DATETIME,
    UpdatedBy NVARCHAR(100)
);

-- 數據集欄位表
CREATE TABLE DataSetColumns (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    DataSetId UNIQUEIDENTIFIER NOT NULL,
    ColumnName NVARCHAR(100) NOT NULL,
    DisplayName NVARCHAR(100),
    DataType NVARCHAR(50) NOT NULL,
    MaxLength INT,
    IsRequired BIT DEFAULT 0,
    IsPrimaryKey BIT DEFAULT 0,
    IsSearchable BIT DEFAULT 1,
    IsSortable BIT DEFAULT 1,
    IsIndexed BIT DEFAULT 0,
    DefaultValue NVARCHAR(500),
    SortOrder INT DEFAULT 0
);

-- 數據記錄
CREATE TABLE DataSetRecords (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    DataSetId UNIQUEIDENTIFIER NOT NULL,
    PrimaryKeyValue NVARCHAR(500),
    Status NVARCHAR(20) DEFAULT 'Active',
    CreatedAt DATETIME DEFAULT GETDATE(),
    UpdatedAt DATETIME
);

-- 記錄值
CREATE TABLE DataSetRecordValues (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    RecordId UNIQUEIDENTIFIER NOT NULL,
    ColumnName NVARCHAR(100) NOT NULL,
    StringValue NVARCHAR(MAX),
    NumericValue DECIMAL(18,6),
    DateValue DATETIME,
    BooleanValue BIT,
    CreatedAt DATETIME DEFAULT GETDATE()
);
```

## ⚠️ **注意事項**

### **1. 文件格式**
- 支持 .xlsx 和 .xls 格式
- 文件大小限制為 10MB
- 工作表名稱預設為 "Sheet1"，可以自定義

### **2. 欄位命名**
- 系統會自動將標題轉換為欄位名稱（去除空格，轉小寫）
- 預設所有欄位為字串類型
- 第一列自動設為主鍵

### **3. 數據類型**
- 系統會自動檢測數字、日期、布林值等類型
- 支持 Excel 日期序列號轉換
- 無法識別的類型會存儲為字串

##  **故障排除**

### **1. 常見問題**
- **文件上傳失敗**: 檢查文件格式和大小
- **同步失敗**: 檢查文件路徑和工作表名稱
- **數據不完整**: 檢查 Excel 文件格式和空行空列

### **2. 日誌查看**
- 後端日誌會記錄詳細的處理過程
- 包括文件路徑、工作表名稱、處理記錄數等信息
- 錯誤時會記錄具體的異常信息

### **3. 性能優化**
- 支持大文件處理（限制 10MB）
- 批量插入數據到相關表
- 可以考慮添加轉換結果緩存

---

**最後更新**: 2025年8月20日

## 📋 **分析舊 MD 文件內容**

### 1. **EXCEL_DATE_CONVERSION_FIX.md** - 需要保留並整合
- **內容價值**: 高 - 包含重要的 Excel 日期轉換修復邏輯
- **建議**: 整合到 `docs/features/EXCEL_INTEGRATION.md`

### 2. **EXCEL_DATASOURCE_TESTING.md** - 需要保留並整合
- **內容價值**: 高 - 包含 Excel 數據源測試說明和技術實現
- **建議**: 整合到 `docs/features/EXCEL_INTEGRATION.md`

### 3. **README_DocumentConverter.md** - 需要保留並整合
- **內容價值**: 高 - 包含完整的文檔轉換功能說明
- **建議**: 整合到 `docs/features/DOCUMENT_CONVERSION.md`

### 4. **FORMIO_SETUP_SUMMARY.md** - 需要保留並整合
- **內容價值**: 中 - 包含 Form.io 設定總結
- **建議**: 整合到 `docs/features/EFORM_SYSTEM.md`

### 5. **API_MODIFICATIONS_SUMMARY.md** - 需要保留並整合
- **內容價值**: 中 - 包含 API 修改記錄
- **建議**: 整合到 `docs/technical/API_REFERENCE.md`

### 6. **UI_LOGIC_UPDATE.md** - 需要保留並整合
- **內容價值**: 中 - 包含 UI 邏輯更新
- **建議**: 整合到 `docs/features/DELIVERY_MANAGEMENT.md`

##  **建議的整合方案**

我建議創建以下新的文檔來整合這些內容：

### 1. **創建 Excel 集成文檔**

```markdown:docs/features/EXCEL_INTEGRATION.md
# Excel 數據源集成

## 🎯 **功能概述**

WhattoFlow 系統支持從 Excel 文件導入數據到 DataSet，包括自動創建欄位定義、導入數據記錄，並支持智能數據類型檢測和轉換。

##  **核心功能**

### **1. 支持的 Excel 格式**
- **Excel 2007+**: .xlsx 格式（推薦）
- **Excel 97-2003**: .xls 格式
- **文件大小**: 最大支持 10MB
- **工作表**: 支持多工作表選擇

### **2. 智能欄位檢測**
- **標題行解析**: 自動識別第一行作為欄位名稱
- **數據類型推斷**: 智能檢測數字、日期、布林值等類型
- **欄位屬性**: 自動設置主鍵、可搜尋、可排序等屬性
- **自定義配置**: 支持手動調整欄位屬性

### **3. 數據轉換能力**
- **日期處理**: 支持 Excel 日期序列號轉換
- **數字格式**: 自動處理小數和整數
- **文本處理**: 支持長文本和短文本
- **布林值**: 自動識別是/否、真/假等值

##  **技術實現**

### **1. 後端處理架構**
```csharp
// 使用 DocumentFormat.OpenXml 讀取 Excel 文件
using DocumentFormat.OpenXml.Spreadsheet;
using DocumentFormat.OpenXml.Packaging;

public class ExcelDataProcessor
{
    public async Task<ProcessResult> ProcessExcelFile(string filePath, string sheetName)
    {
        using (var spreadsheetDocument = SpreadsheetDocument.Open(filePath, false))
        {
            var workbookPart = spreadsheetDocument.WorkbookPart;
            var worksheetPart = GetWorksheetPart(workbookPart, sheetName);
            var worksheet = worksheetPart.Worksheet;
            
            // 處理數據...
        }
    }
}
```

### **2. 日期轉換算法**
```csharp
private DateTime? ConvertExcelDateToSqlDate(string excelValue)
{
    if (string.IsNullOrWhiteSpace(excelValue))
        return null;

    try
    {
        // 嘗試直接解析為日期（如果已經是標準日期格式）
        if (DateTime.TryParse(excelValue, out var directDate))
        {
            return directDate;
        }

        // 嘗試解析為 Excel 日期序列號
        if (double.TryParse(excelValue, out var excelDateNumber))
        {
            if (excelDateNumber >= 1 && excelDateNumber <= 2958465)
            {
                var baseDate = new DateTime(1900, 1, 1);
                var calculatedDate = baseDate.AddDays(excelDateNumber - 1);
                
                // 修正 Excel 1900 年閏年錯誤
                if (calculatedDate >= new DateTime(1900, 3, 1))
                {
                    calculatedDate = calculatedDate.AddDays(-1);
                }
                
                return calculatedDate;
            }
        }

        return null;
    }
    catch (Exception ex)
    {
        _loggingService.LogError($"Excel 日期轉換失敗: {ex.Message}", ex);
        return null;
    }
}
```

### **3. 數據類型檢測**
```csharp
private string InferDataTypeFromSample(string value)
{
    if (string.IsNullOrWhiteSpace(value))
        return "string";

    // 檢測日期
    if (IsDateCellAdvanced(value) || IsExcelDateNumber(value))
        return "datetime";

    // 檢測數字
    if (decimal.TryParse(value, out _))
        return "decimal";

    // 檢測布林值
    if (IsBooleanValue(value))
        return "boolean";

    // 默認為字串
    return "string";
}

private bool IsExcelDateNumber(string value)
{
    if (double.TryParse(value, out var numericValue))
    {
        if (numericValue >= 1 && numericValue <= 2958465)
        {
            try
            {
                var baseDate = new DateTime(1900, 1, 1);
                var calculatedDate = baseDate.AddDays(numericValue - 1);
                
                if (calculatedDate >= new DateTime(1900, 3, 1))
                {
                    calculatedDate = calculatedDate.AddDays(-1);
                }
                
                return calculatedDate.Year >= 1900 && calculatedDate.Year <= 9999;
            }
            catch
            {
                return false;
            }
        }
    }
    return false;
}
```

##  **使用流程**

### **1. 創建 DataSet**
1. 點擊「創建 Data Set」按鈕
2. 填寫基本資訊（名稱、描述）
3. 選擇數據源類型：**EXCEL**
4. 上傳 Excel 文件
5. 選擇工作表名稱
6. 系統自動生成欄位定義
7. 保存 DataSet

### **2. 數據同步**
1. 在 DataSet 列表中點擊「同步數據」按鈕
2. 系統自動：
   - 讀取 Excel 文件
   - 創建欄位定義（如果不存在）
   - 導入數據記錄
   - 顯示處理結果

### **3. 查看結果**
1. 點擊「查看記錄」按鈕
2. 檢查導入的數據是否正確
3. 在數據庫中驗證相關表

##  **前端功能**

### **1. 文件上傳組件**
```jsx
<Upload
  name="file"
  accept=".xlsx,.xls"
  beforeUpload={(file) => {
    const isExcel = file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
                    file.type === 'application/vnd.ms-excel';
    if (!isExcel) {
      message.error('只能上傳 Excel 文件！');
      return false;
    }
    
    const isLt10M = file.size / 1024 / 1024 < 10;
    if (!isLt10M) {
      message.error('文件大小不能超過 10MB！');
      return false;
    }
    
    return true;
  }}
  customRequest={async ({ file, onSuccess, onError }) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/datasets-upload/excel', {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          dataSourceForm.setFieldsValue({ excelFilePath: result.filePath });
          message.success(`${file.name} 上傳成功`);
          onSuccess(result);
        } else {
          throw new Error(result.message);
        }
      } else {
        throw new Error('文件上傳失敗');
      }
    } catch (error) {
      message.error(`上傳失敗: ${error.message}`);
      onError(error);
    }
  }}
>
  <Button icon={<UploadOutlined />}>上傳 Excel 文件</Button>
</Upload>
```

### **2. 工作表選擇**
```jsx
<Form.Item name="excelSheetName" label="工作表名稱">
  <Select 
    placeholder="選擇工作表"
    onChange={(value) => handleSheetChange(value)}
    loading={sheetLoading}
  >
    {sheetNames.map(name => (
      <Select.Option key={name} value={name}>
        {name}
      </Select.Option>
    ))}
  </Select>
</Form.Item>
```

##  **API 端點**

### **1. 文件上傳**
```
POST /api/datasets-upload/excel
Content-Type: multipart/form-data

參數:
- file: Excel 文件

響應:
{
  "success": true,
  "filePath": "uploads/excel/20241219120000_12345678-1234-1234-1234-123456789012.xlsx",
  "message": "文件上傳成功"
}
```

### **2. 工作表列表**
```
GET /api/datasets-upload/excel/sheets?filePath={filePath}

響應:
{
  "success": true,
  "sheetNames": ["Sheet1", "Sheet2", "Sheet3"]
}
```

### **3. 欄位預覽**
```
GET /api/datasets-upload/excel/preview?filePath={filePath}&sheetName={sheetName}

響應:
{
  "success": true,
  "columns": [
    {
      "columnName": "customer_id",
      "displayName": "客戶編號",
      "dataType": "string",
      "maxLength": 50,
      "isRequired": true
    }
  ]
}
```

### **4. 數據同步**
```
POST /api/datasets/{id}/sync

響應:
{
  "success": true,
  "data": {
    "totalRecords": 100,
    "processedRecords": 100,
    "errors": []
  },
  "message": "同步成功"
}
```

## ️ **數據庫結構**

### **1. 主要表結構**
```sql
-- 數據集表
CREATE TABLE DataSets (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    Name NVARCHAR(100) NOT NULL,
    Description NVARCHAR(500),
    DataSourceType NVARCHAR(50),
    CompanyId UNIQUEIDENTIFIER NOT NULL,
    Status NVARCHAR(20) DEFAULT 'Active',
    CreatedAt DATETIME DEFAULT GETDATE(),
    CreatedBy NVARCHAR(100),
    UpdatedAt DATETIME,
    UpdatedBy NVARCHAR(100)
);

-- 數據集欄位表
CREATE TABLE DataSetColumns (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    DataSetId UNIQUEIDENTIFIER NOT NULL,
    ColumnName NVARCHAR(100) NOT NULL,
    DisplayName NVARCHAR(100),
    DataType NVARCHAR(50) NOT NULL,
    MaxLength INT,
    IsRequired BIT DEFAULT 0,
    IsPrimaryKey BIT DEFAULT 0,
    IsSearchable BIT DEFAULT 1,
    IsSortable BIT DEFAULT 1,
    IsIndexed BIT DEFAULT 0,
    DefaultValue NVARCHAR(500),
    SortOrder INT DEFAULT 0
);

-- 數據記錄
CREATE TABLE DataSetRecords (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    DataSetId UNIQUEIDENTIFIER NOT NULL,
    PrimaryKeyValue NVARCHAR(500),
    Status NVARCHAR(20) DEFAULT 'Active',
    CreatedAt DATETIME DEFAULT GETDATE(),
    UpdatedAt DATETIME
);

-- 記錄值
CREATE TABLE DataSetRecordValues (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    RecordId UNIQUEIDENTIFIER NOT NULL,
    ColumnName NVARCHAR(100) NOT NULL,
    StringValue NVARCHAR(MAX),
    NumericValue DECIMAL(18,6),
    DateValue DATETIME,
    BooleanValue BIT,
    CreatedAt DATETIME DEFAULT GETDATE()
);
```

## ⚠️ **注意事項**

### **1. 文件格式**
- 支持 .xlsx 和 .xls 格式
- 文件大小限制為 10MB
- 工作表名稱預設為 "Sheet1"，可以自定義

### **2. 欄位命名**
- 系統會自動將標題轉換為欄位名稱（去除空格，轉小寫）
- 預設所有欄位為字串類型
- 第一列自動設為主鍵

### **3. 數據類型**
- 系統會自動檢測數字、日期、布林值等類型
- 支持 Excel 日期序列號轉換
- 無法識別的類型會存儲為字串

##  **故障排除**

### **1. 常見問題**
- **文件上傳失敗**: 檢查文件格式和大小
- **同步失敗**: 檢查文件路徑和工作表名稱
- **數據不完整**: 檢查 Excel 文件格式和空行空列

### **2. 日誌查看**
- 後端日誌會記錄詳細的處理過程
- 包括文件路徑、工作表名稱、處理記錄數等信息
- 錯誤時會記錄具體的異常信息

### **3. 性能優化**
- 支持大文件處理（限制 10MB）
- 批量插入數據到相關表
- 可以考慮添加轉換結果緩存

---

**最後更新**: 2025年8月20日

## 📋 **分析舊 MD 文件內容**

### 1. **EXCEL_DATE_CONVERSION_FIX.md** - 需要保留並整合
- **內容價值**: 高 - 包含重要的 Excel 日期轉換修復邏輯
- **建議**: 整合到 `docs/features/EXCEL_INTEGRATION.md`

### 2. **EXCEL_DATASOURCE_TESTING.md** - 需要保留並整合
- **內容價值**: 高 - 包含 Excel 數據源測試說明和技術實現
- **建議**: 整合到 `docs/features/EXCEL_INTEGRATION.md`

### 3. **README_DocumentConverter.md** - 需要保留並整合
- **內容價值**: 高 - 包含完整的文檔轉換功能說明
- **建議**: 整合到 `docs/features/DOCUMENT_CONVERSION.md`

### 4. **FORMIO_SETUP_SUMMARY.md** - 需要保留並整合
- **內容價值**: 中 - 包含 Form.io 設定總結
- **建議**: 整合到 `docs/features/EFORM_SYSTEM.md`

### 5. **API_MODIFICATIONS_SUMMARY.md** - 需要保留並整合
- **內容價值**: 中 - 包含 API 修改記錄
- **建議**: 整合到 `docs/technical/API_REFERENCE.md`

### 6. **UI_LOGIC_UPDATE.md** - 需要保留並整合
- **內容價值**: 中 - 包含 UI 邏輯更新
- **建議**: 整合到 `docs/features/DELIVERY_MANAGEMENT.md`

##  **建議的整合方案**

我建議創建以下新的文檔來整合這些內容：

### 1. **創建 Excel 集成文檔**

```markdown:docs/features/EXCEL_INTEGRATION.md
# Excel 數據源集成

## 🎯 **功能概述**

WhattoFlow 系統支持從 Excel 文件導入數據到 DataSet，包括自動創建欄位定義、導入數據記錄，並支持智能數據類型檢測和轉換。

##  **核心功能**

### **1. 支持的 Excel 格式**
- **Excel 2007+**: .xlsx 格式（推薦）
- **Excel 97-2003**: .xls 格式
- **文件大小**: 最大支持 10MB
- **工作表**: 支持多工作表選擇

### **2. 智能欄位檢測**
- **標題行解析**: 自動識別第一行作為欄位名稱
- **數據類型推斷**: 智能檢測數字、日期、布林值等類型
- **欄位屬性**: 自動設置主鍵、可搜尋、可排序等屬性
- **自定義配置**: 支持手動調整欄位屬性

### **3. 數據轉換能力**
- **日期處理**: 支持 Excel 日期序列號轉換
- **數字格式**: 自動處理小數和整數
- **文本處理**: 支持長文本和短文本
- **布林值**: 自動識別是/否、真/假等值

##  **技術實現**

### **1. 後端處理架構**
```csharp
// 使用 DocumentFormat.OpenXml 讀取 Excel 文件
using DocumentFormat.OpenXml.Spreadsheet;
using DocumentFormat.OpenXml.Packaging;

public class ExcelDataProcessor
{
    public async Task<ProcessResult> ProcessExcelFile(string filePath, string sheetName)
    {
        using (var spreadsheetDocument = SpreadsheetDocument.Open(filePath, false))
        {
            var workbookPart = spreadsheetDocument.WorkbookPart;
            var worksheetPart = GetWorksheetPart(workbookPart, sheetName);
            var worksheet = worksheetPart.Worksheet;
            
            // 處理數據...
        }
    }
}
```

### **2. 日期轉換算法**
```csharp
private DateTime? ConvertExcelDateToSqlDate(string excelValue)
{
    if (string.IsNullOrWhiteSpace(excelValue))
        return null;

    try
    {
        // 嘗試直接解析為日期（如果已經是標準日期格式）
        if (DateTime.TryParse(excelValue, out var directDate))
        {
            return directDate;
        }

        // 嘗試解析為 Excel 日期序列號
        if (double.TryParse(excelValue, out var excelDateNumber))
        {
            if (excelDateNumber >= 1 && excelDateNumber <= 2958465)
            {
                var baseDate = new DateTime(1900, 1, 1);
                var calculatedDate = baseDate.AddDays(excelDateNumber - 1);
                
                // 修正 Excel 1900 年閏年錯誤
                if (calculatedDate >= new DateTime(1900, 3, 1))
                {
                    calculatedDate = calculatedDate.AddDays(-1);
                }
                
                return calculatedDate;
            }
        }

        return null;
    }
    catch (Exception ex)
    {
        _loggingService.LogError($"Excel 日期轉換失敗: {ex.Message}", ex);
        return null;
    }
}
```

### **3. 數據類型檢測**
```csharp
private string InferDataTypeFromSample(string value)
{
    if (string.IsNullOrWhiteSpace(value))
        return "string";

    // 檢測日期
    if (IsDateCellAdvanced(value) || IsExcelDateNumber(value))
        return "datetime";

    // 檢測數字
    if (decimal.TryParse(value, out _))
        return "decimal";

    // 檢測布林值
    if (IsBooleanValue(value))
        return "boolean";

    // 默認為字串
    return "string";
}

private bool IsExcelDateNumber(string value)
{
    if (double.TryParse(value, out var numericValue))
    {
        if (numericValue >= 1 && numericValue <= 2958465)
        {
            try
            {
                var baseDate = new DateTime(1900, 1, 1);
                var calculatedDate = baseDate.AddDays(numericValue - 1);
                
                if (calculatedDate >= new DateTime(1900, 3, 1))
                {
                    calculatedDate = calculatedDate.AddDays(-1);
                }
                
                return calculatedDate.Year >= 1900 && calculatedDate.Year <= 9999;
            }
            catch
            {
                return false;
            }
        }
    }
    return false;
}
```

##  **使用流程**

### **1. 創建 DataSet**
1. 點擊「創建 Data Set」按鈕
2. 填寫基本資訊（名稱、描述）
3. 選擇數據源類型：**EXCEL**
4. 上傳 Excel 文件
5. 選擇工作表名稱
6. 系統自動生成欄位定義
7. 保存 DataSet

### **2. 數據同步**
1. 在 DataSet 列表中點擊「同步數據」按鈕
2. 系統自動：
   - 讀取 Excel 文件
   - 創建欄位定義（如果不存在）
   - 導入數據記錄
   - 顯示處理結果

### **3. 查看結果**
1. 點擊「查看記錄」按鈕
2. 檢查導入的數據是否正確
3. 在數據庫中驗證相關表

##  **前端功能**

### **1. 文件上傳組件**
```jsx
<Upload
  name="file"
  accept=".xlsx,.xls"
  beforeUpload={(file) => {
    const isExcel = file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
                    file.type === 'application/vnd.ms-excel';
    if (!isExcel) {
      message.error('只能上傳 Excel 文件！');
      return false;
    }
    
    const isLt10M = file.size / 1024 / 1024 < 10;
    if (!isLt10M) {
      message.error('文件大小不能超過 10MB！');
      return false;
    }
    
    return true;
  }}
  customRequest={async ({ file, onSuccess, onError }) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/datasets-upload/excel', {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          dataSourceForm.setFieldsValue({ excelFilePath: result.filePath });
          message.success(`${file.name} 上傳成功`);
          onSuccess(result);
        } else {
          throw new Error(result.message);
        }
      } else {
        throw new Error('文件上傳失敗');
      }
    } catch (error) {
      message.error(`上傳失敗: ${error.message}`);
      onError(error);
    }
  }}
>
  <Button icon={<UploadOutlined />}>上傳 Excel 文件</Button>
</Upload>
```

### **2. 工作表選擇**
```jsx
<Form.Item name="excelSheetName" label="工作表名稱">
  <Select 
    placeholder="選擇工作表"
    onChange={(value) => handleSheetChange(value)}
    loading={sheetLoading}
  >
    {sheetNames.map(name => (
      <Select.Option key={name} value={name}>
        {name}
      </Select.Option>
    ))}
  </Select>
</Form.Item>
```

##  **API 端點**

### **1. 文件上傳**
```
POST /api/datasets-upload/excel
Content-Type: multipart/form-data

參數:
- file: Excel 文件

響應:
{
  "success": true,
  "filePath": "uploads/excel/20241219120000_12345678-1234-1234-1234-123456789012.xlsx",
  "message": "文件上傳成功"
}
```

### **2. 工作表列表**
```
GET /api/datasets-upload/excel/sheets?filePath={filePath}

響應:
{
  "success": true,
  "sheetNames": ["Sheet1", "Sheet2", "Sheet3"]
}
```

### **3. 欄位預覽**
```
GET /api/datasets-upload/excel/preview?filePath={filePath}&sheetName={sheetName}

響應:
{
  "success": true,
  "columns": [
    {
      "columnName": "customer_id",
      "displayName": "客戶編號",
      "dataType": "string",
      "maxLength": 50,
      "isRequired": true
    }
  ]
}
```

### **4. 數據同步**
```
POST /api/datasets/{id}/sync

響應:
{
  "success": true,
  "data": {
    "totalRecords": 100,
    "processedRecords": 100,
    "errors": []
  },
  "message": "同步成功"
}
```

## ️ **數據庫結構**

### **1. 主要表結構**
```sql
-- 數據集表
CREATE TABLE DataSets (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    Name NVARCHAR(100) NOT NULL,
    Description NVARCHAR(500),
    DataSourceType NVARCHAR(50),
    CompanyId UNIQUEIDENTIFIER NOT NULL,
    Status NVARCHAR(20) DEFAULT 'Active',
    CreatedAt DATETIME DEFAULT GETDATE(),
    CreatedBy NVARCHAR(100),
    UpdatedAt DATETIME,
    UpdatedBy NVARCHAR(100)
);

-- 數據集欄位表
CREATE TABLE DataSetColumns (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    DataSetId UNIQUEIDENTIFIER NOT NULL,
    ColumnName NVARCHAR(100) NOT NULL,
    DisplayName NVARCHAR(100),
    DataType NVARCHAR(50) NOT NULL,
    MaxLength INT,
    IsRequired BIT DEFAULT 0,
    IsPrimaryKey BIT DEFAULT 0,
    IsSearchable BIT DEFAULT 1,
    IsSortable BIT DEFAULT 1,
    IsIndexed BIT DEFAULT 0,
    DefaultValue NVARCHAR(500),
    SortOrder INT DEFAULT 0
);

-- 數據記錄
CREATE TABLE DataSetRecords (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    DataSetId UNIQUEIDENTIFIER NOT NULL,
    PrimaryKeyValue NVARCHAR(500),
    Status NVARCHAR(20) DEFAULT 'Active',
    CreatedAt DATETIME DEFAULT GETDATE(),
    UpdatedAt DATETIME
);

-- 記錄值
CREATE TABLE DataSetRecordValues (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    RecordId UNIQUEIDENTIFIER NOT NULL,
    ColumnName NVARCHAR(100) NOT NULL,
    StringValue NVARCHAR(MAX),
    NumericValue DECIMAL(18,6),
    DateValue DATETIME,
    BooleanValue BIT,
    CreatedAt DATETIME DEFAULT GETDATE()
);
```

## ⚠️ **注意事項**

### **1. 文件格式**
- 支持 .xlsx 和 .xls 格式
- 文件大小限制為 10MB
- 工作表名稱預設為 "Sheet1"，可以自定義

### **2. 欄位命名**
- 系統會自動將標題轉換為欄位名稱（去除空格，轉小寫）
- 預設所有欄位為字串類型
- 第一列自動設為主鍵

### **3. 數據類型**
- 系統會自動檢測數字、日期、布林值等類型
- 支持 Excel 日期序列號轉換
- 無法識別的類型會存儲為字串

##  **故障排除**

### **1. 常見問題**
- **文件上傳失敗**: 檢查文件格式和大小
- **同步失敗**: 檢查文件路徑和工作表名稱
- **數據不完整**: 檢查 Excel 文件格式和空行空列

### **2. 日誌查看**
- 後端日誌會記錄詳細的處理過程
- 包括文件路徑、工作表名稱、處理記錄數等信息
- 錯誤時會記錄具體的異常信息

### **3. 性能優化**
- 支持大文件處理（限制 10MB）
- 批量插入數據到相關表
- 可以考慮添加轉換結果緩存

---

**最後更新**: 2025年8月20日

## 📋 **分析舊 MD 文件內容**

### 1. **EXCEL_DATE_CONVERSION_FIX.md** - 需要保留並整合
- **內容價值**: 高 - 包含重要的 Excel 日期轉換修復邏輯
- **建議**: 整合到 `docs/features/EXCEL_INTEGRATION.md`

### 2. **EXCEL_DATASOURCE_TESTING.md** - 需要保留並整合
- **內容價值**: 高 - 包含 Excel 數據源測試說明和技術實現
- **建議**: 整合到 `docs/features/EXCEL_INTEGRATION.md`

### 3. **README_DocumentConverter.md** - 需要保留並整合
- **內容價值**: 高 - 包含完整的文檔轉換功能說明
- **建議**: 整合到 `docs/features/DOCUMENT_CONVERSION.md`

### 4. **FORMIO_SETUP_SUMMARY.md** - 需要保留並整合
- **內容價值**: 中 - 包含 Form.io 設定總結
- **建議**: 整合到 `docs/features/EFORM_SYSTEM.md`

### 5. **API_MODIFICATIONS_SUMMARY.md** - 需要保留並整合
- **內容價值**: 中 - 包含 API 修改記錄
- **建議**: 整合到 `docs/technical/API_REFERENCE.md`

### 6. **UI_LOGIC_UPDATE.md** - 需要保留並整合
- **內容價值**: 中 - 包含 UI 邏輯更新
- **建議**: 整合到 `docs/features/DELIVERY_MANAGEMENT.md`

##  **建議的整合方案**

我建議創建以下新的文檔來整合這些內容：

### 1. **創建 Excel 集成文檔**

```markdown:docs/features/EXCEL_INTEGRATION.md
# Excel 數據源集成

## 🎯 **功能概述**

WhattoFlow 系統支持從 Excel 文件導入數據到 DataSet，包括自動創建欄位定義、導入數據記錄，並支持智能數據類型檢測和轉換。

##  **核心功能**

### **1. 支持的 Excel 格式**
- **Excel 2007+**: .xlsx 格式（推薦）
- **Excel 97-2003**: .xls 格式
- **文件大小**: 最大支持 10MB
- **工作表**: 支持多工作表選擇

### **2. 智能欄位檢測**
- **標題行解析**: 自動識別第一行作為欄位名稱
- **數據類型推斷**: 智能檢測數字、日期、布林值等類型
- **欄位屬性**: 自動設置主鍵、可搜尋、可排序等屬性
- **自定義配置**: 支持手動調整欄位屬性

### **3. 數據轉換能力**
- **日期處理**: 支持 Excel 日期序列號轉換
- **數字格式**: 自動處理小數和整數
- **文本處理**: 支持長文本和短文本
- **布林值**: 自動識別是/否、真/假等值

##  **技術實現**

### **1. 後端處理架構**
```csharp
// 使用 DocumentFormat.OpenXml 讀取 Excel 文件
using DocumentFormat.OpenXml.Spreadsheet;
using DocumentFormat.OpenXml.Packaging;

public class ExcelDataProcessor
{
    public async Task<ProcessResult> ProcessExcelFile(string filePath, string sheetName)
    {
        using (var spreadsheetDocument = SpreadsheetDocument.Open(filePath, false))
        {
            var workbookPart = spreadsheetDocument.WorkbookPart;
            var worksheetPart = GetWorksheetPart(workbookPart, sheetName);
            var worksheet = worksheetPart.Worksheet;
            
            // 處理數據...
        }
    }
}
```

### **2. 日期轉換算法**
```csharp
private DateTime? ConvertExcelDateToSqlDate(string excelValue)
{
    if (string.IsNullOrWhiteSpace(excelValue))
        return null;

    try
    {
        // 嘗試直接解析為日期（如果已經是標準日期格式）
        if (DateTime.TryParse(excelValue, out var directDate))
        {
            return directDate;
        }

        // 嘗試解析為 Excel 日期序列號
        if (double.TryParse(excelValue, out var excelDateNumber))
        {
            if (excelDateNumber >= 1 && excelDateNumber <= 2958465)
            {
                var baseDate = new DateTime(1900, 1, 1);
                var calculatedDate = baseDate.AddDays(excelDateNumber - 1);
                
                // 修正 Excel 1900 年閏年錯誤
                if (calculatedDate >= new DateTime(1900, 3, 1))
                {
                    calculatedDate = calculatedDate.AddDays(-1);
                }
                
                return calculatedDate;
            }
        }

        return null;
    }
    catch (Exception ex)
    {
        _loggingService.LogError($"Excel 日期轉換失敗: {ex.Message}", ex);
        return null;
    }
}
```

### **3. 數據類型檢測**
```csharp
private string InferDataTypeFromSample(string value)
{
    if (string.IsNullOrWhiteSpace(value))
        return "string";

    // 檢測日期
    if (IsDateCellAdvanced(value) || IsExcelDateNumber(value))
        return "datetime";

    // 檢測數字
    if (decimal.TryParse(value, out _))
        return "decimal";

    // 檢測布林值
    if (IsBooleanValue(value))
        return "boolean";

    // 默認為字串
    return "string";
}

private bool IsExcelDateNumber(string value)
{
    if (double.TryParse(value, out var numericValue))
    {
        if (numericValue >= 1 && numericValue <= 2958465)
        {
            try
            {
                var baseDate = new DateTime(1900, 1, 1);
                var calculatedDate = baseDate.AddDays(numericValue - 1);
                
                if (calculatedDate >= new DateTime(1900, 3, 1))
                {
                    calculatedDate = calculatedDate.AddDays(-1);
                }
                
                return calculatedDate.Year >= 1900 && calculatedDate.Year <= 9999;
            }
            catch
            {
                return false;
            }
        }
    }
    return false;
}
```

##  **使用流程**

### **1. 創建 DataSet**
1. 點擊「創建 Data Set」按鈕
2. 填寫基本資訊（名稱、描述）
3. 選擇數據源類型：**EXCEL**
4. 上傳 Excel 文件
5. 選擇工作表名稱
6. 系統自動生成欄位定義
7. 保存 DataSet

### **2. 數據同步**
1. 在 DataSet 列表中點擊「同步數據」按鈕
2. 系統自動：
   - 讀取 Excel 文件
   - 創建欄位定義（如果不存在）
   - 導入數據記錄
   - 顯示處理結果

### **3. 查看結果**
1. 點擊「查看記錄」按鈕
2. 檢查導入的數據是否正確
3. 在數據庫中驗證相關表

##  **前端功能**

### **1. 文件上傳組件**
```jsx
<Upload
  name="file"
  accept=".xlsx,.xls"
  beforeUpload={(file) => {
    const isExcel = file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
                    file.type === 'application/vnd.ms-excel';
    if (!isExcel) {
      message.error('只能上傳 Excel 文件！');
      return false;
    }
    
    const isLt10M = file.size / 1024 / 1024 < 10;
    if (!isLt10M) {
      message.error('文件大小不能超過 10MB！');
      return false;
    }
    
    return true;
  }}
  customRequest={async ({ file, onSuccess, onError }) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/datasets-upload/excel', {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          dataSourceForm.setFieldsValue({ excelFilePath: result.filePath });
          message.success(`${file.name} 上傳成功`);
          onSuccess(result);
        } else {
          throw new Error(result.message);
        }
      } else {
        throw new Error('文件上傳失敗');
      }
    } catch (error) {
      message.error(`上傳失敗: ${error.message}`);
      onError(error);
    }
  }}
>
  <Button icon={<UploadOutlined />}>上傳 Excel 文件</Button>
</Upload>
```

### **2. 工作表選擇**
```jsx
<Form.Item name="excelSheetName" label="工作表名稱">
  <Select 
    placeholder="選擇工作表"
    onChange={(value) => handleSheetChange(value)}
    loading={sheetLoading}
  >
    {sheetNames.map(name => (
      <Select.Option key={name} value={name}>
        {name}
      </Select.Option>
    ))}
  </Select>
</Form.Item>
```

##  **API 端點**

### **1. 文件上傳**
```
POST /api/datasets-upload/excel
Content-Type: multipart/form-data

參數:
- file: Excel 文件

響應:
{
  "success": true,
  "filePath": "uploads/excel/20241219120000_12345678-1234-1234-1234-123456789012.xlsx",
  "message": "文件上傳成功"
}
```

### **2. 工作表列表**
```
GET /api/datasets-upload/excel/sheets?filePath={filePath}

響應:
{
  "success": true,
  "sheetNames": ["Sheet1", "Sheet2", "Sheet3"]
}
```

### **3. 欄位預覽**
```
GET /api/datasets-upload/excel/preview?filePath={filePath}&sheetName={sheetName}

響應:
{
 