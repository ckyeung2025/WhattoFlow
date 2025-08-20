# 數據集管理功能

## 🎯 **功能概述**

數據集管理是 WhattoFlow 系統的核心功能之一，支持從多種數據源創建、管理和同步數據集。

## �� **核心功能**

### **1. 多數據源支持**
- **SQL 數據庫**: 支持預設連接和自定義連接
- **Excel 文件**: 支持 .xlsx 和 .xls 格式
- **Google Docs**: 支持 Google Sheets 集成

### **2. 智能欄位定義**
- **自動檢測**: 根據數據源自動推斷欄位類型
- **自定義配置**: 支持手動調整欄位屬性
- **數據驗證**: 內建數據驗證規則

### **3. 數據同步**
- **手動同步**: 即時數據同步
- **定時同步**: 支持定時自動同步
- **增量更新**: 只更新變更的數據

## �� **技術實現**

### **1. 後端架構**
```csharp
public class DataSetsController : ControllerBase
{
    private readonly PurpleRiceDbContext _context;
    private readonly LoggingService _loggingService;

    [HttpGet]
    public async Task<ActionResult<object>> GetDataSets(
        [FromQuery] string? search = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10)
    {
        // 實現邏輯...
    }
}
```

### **2. 前端組件**
```jsx
const DataSetManagementPage = () => {
  const [dataSets, setDataSets] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchDataSets = async (page = 1, pageSize = 10) => {
    // 實現邏輯...
  };

  return (
    <div>
      {/* UI 組件 */}
    </div>
  );
};
```

## �� **數據模型**

### **1. 主要實體**
- **DataSet**: 數據集基本信息
- **DataSetColumn**: 欄位定義
- **DataSetDataSource**: 數據源配置
- **DataSetRecord**: 數據記錄
- **DataSetRecordValue**: 記錄值

### **2. 關係圖**
```
DataSet (1) ── (N) DataSetColumn
DataSet (1) ── (N) DataSetDataSource
DataSet (1) ── (N) DataSetRecord
DataSetRecord (1) ── (N) DataSetRecordValue
```

---

**最後更新**: 2025年8月20日
**系統版本**: v2.0
