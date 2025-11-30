# 數據集管理功能

## 🎯 **功能概述**

數據集管理是 WhattoFlow 系統的核心功能之一，支持從多種數據源創建、管理和同步數據集。數據集可以作為工作流中的數據中轉站，實現數據查詢、更新和映射功能。

## 🚀 **核心功能**

### **1. 多數據源支持**
- **SQL 數據庫**: 支持預設連接和自定義連接
  - 直接連接 SQL Server 數據庫
  - 執行 SQL 查詢
  - 參數化查詢支持
- **Excel 文件**: 支持 .xlsx 和 .xls 格式
  - 文件上傳功能
  - 自動欄位檢測
  - 數據驗證
- **Google Sheets**: 支持 Google Sheets 集成
  - Google API 認證
  - 實時數據同步
  - 協作編輯支持

### **2. 智能欄位定義**
- **自動檢測**: 根據數據源自動推斷欄位類型
- **自定義配置**: 支持手動調整欄位屬性
- **數據驗證**: 內建數據驗證規則
- **欄位映射**: 支持欄位名稱映射

### **3. 數據同步**
- **手動同步**: 即時數據同步
- **定時同步**: 支持定時自動同步
- **增量更新**: 只更新變更的數據
- **同步狀態**: 實時查看同步狀態和歷史

### **4. 數據查詢和操作**
- **SELECT 查詢**: 查詢數據集記錄
- **INSERT 操作**: 插入新記錄
- **UPDATE 操作**: 更新現有記錄
- **DELETE 操作**: 刪除記錄
- **條件查詢**: 支持複雜的查詢條件

## 🏗️ **技術實現**

### **1. 後端架構**
```csharp
public class DataSetsController : ControllerBase
{
    private readonly PurpleRiceDbContext _context;
    private readonly LoggingService _loggingService;
    private readonly IGoogleSheetsService _googleSheetsService;

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

## 🗄️ **數據模型**

### **1. 主要實體**
- **DataSet**: 數據集基本信息
  - 數據集名稱、描述
  - 數據源類型（SQL, Excel, Google Sheets）
  - 同步配置
- **DataSetColumn**: 欄位定義
  - 欄位名稱、類型
  - 顯示名稱
  - 驗證規則
- **DataSetDataSource**: 數據源配置
  - SQL 連接字符串
  - Excel 文件路徑
  - Google Sheets ID
- **DataSetRecord**: 數據記錄
  - 記錄唯一標識
  - 關聯的數據集
- **DataSetRecordValue**: 記錄值
  - 欄位值存儲
  - 支持多種數據類型（string, int, decimal, datetime, boolean, json）

### **2. 關係圖**
```
DataSet (1) ── (N) DataSetColumn
DataSet (1) ── (N) DataSetDataSource
DataSet (1) ── (N) DataSetRecord
DataSetRecord (1) ── (N) DataSetRecordValue
```

## 💻 **API 接口**

### **數據集管理**

```http
# 獲取數據集列表
GET /api/datasets?search=&page=1&pageSize=10
Authorization: Bearer {token}

# 獲取數據集詳情
GET /api/datasets/{id}
Authorization: Bearer {token}

# 創建數據集
POST /api/datasets
Content-Type: application/json
Authorization: Bearer {token}

{
  "name": "客戶數據集",
  "description": "客戶基本信息",
  "dataSourceType": "SQL",
  "connectionString": "..."
}

# 更新數據集
PUT /api/datasets/{id}
Content-Type: application/json
Authorization: Bearer {token}

# 刪除數據集
DELETE /api/datasets/{id}
Authorization: Bearer {token}
```

### **數據同步**

```http
# 手動同步數據集
POST /api/datasets/{id}/sync
Authorization: Bearer {token}

# 獲取同步狀態
GET /api/datasets/{id}/sync-status
Authorization: Bearer {token}
```

### **數據操作**

```http
# 查詢數據集記錄
POST /api/datasets/{id}/query
Content-Type: application/json
Authorization: Bearer {token}

{
  "conditions": [
    {
      "field": "customer_id",
      "operator": "equals",
      "value": "123"
    }
  ]
}

# 插入記錄
POST /api/datasets/{id}/insert
Content-Type: application/json
Authorization: Bearer {token}

# 更新記錄
PUT /api/datasets/{id}/update
Content-Type: application/json
Authorization: Bearer {token}

# 刪除記錄
DELETE /api/datasets/{id}/delete
Content-Type: application/json
Authorization: Bearer {token}
```

## 🔍 **使用場景**

### **1. SQL 數據庫數據集**
- 連接 ERP 系統數據庫
- 查詢客戶、訂單、產品等信息
- 在工作流中使用數據集查詢
- 實時數據訪問

### **2. Excel 數據集**
- 上傳 Excel 文件
- 自動檢測欄位類型
- 定期同步更新
- 離線數據管理

### **3. Google Sheets 數據集**
- 連接 Google Sheets
- 實時同步數據
- 協作編輯支持
- 版本控制

## 🚀 **最佳實踐**

### **1. 數據源選擇**
- **SQL 數據庫**: 適合大量數據和實時查詢
- **Excel 文件**: 適合小量數據和離線使用
- **Google Sheets**: 適合協作和實時更新

### **2. 欄位定義**
- 使用清晰的欄位名稱
- 設置適當的數據類型
- 配置驗證規則
- 設置顯示名稱

### **3. 數據同步**
- 定期同步保持數據最新
- 監控同步狀態
- 處理同步錯誤
- 記錄同步歷史

### **4. 性能優化**
- 合理設置查詢條件
- 使用索引優化查詢
- 避免全表掃描
- 限制查詢結果數量

## 🔗 **工作流集成**

數據集可以與工作流節點集成使用：

- **DataSet Query/Update 節點**: 在工作流中查詢和更新數據集
- **流程變量映射**: 將數據集查詢結果映射到流程變量
- **條件判斷**: 使用數據集數據進行條件判斷

詳細說明請參考 [DataSet 工作流集成](DATASET_WORKFLOW_INTEGRATION.md) 文檔。

---

**文檔版本**: 1.0.0  
**最後更新**: 2025年1月  
**維護者**: 開發團隊
