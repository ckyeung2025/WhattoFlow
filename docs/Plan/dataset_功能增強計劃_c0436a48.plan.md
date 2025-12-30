---
name: DataSet 功能增強計劃
overview: 實施三個主要功能（按優先順序）：1) 在記錄查看介面新增刪除記錄功能 2) 實現雙向同步（從 Google Docs 開始） 3) 新增 Excel 導出功能（支持篩選或全部數據，後台異步生成）
todos:
  - id: delete-records-ui
    content: 在 DataSetManagementPage.js 的記錄查看介面添加刪除記錄功能（UI + API 調用）
    status: pending
  - id: delete-records-api
    content: 在 DataSetsController.cs 實現 DELETE /api/datasets/{datasetId}/records/{recordId} API
    status: pending
  - id: export-queue-table
    content: 創建 dataset_export_queue 表的數據庫遷移腳本
    status: pending
  - id: export-queue-model
    content: 創建 DataSetExportQueue Model 類和 DbContext 配置
    status: pending
    dependencies:
      - export-queue-table
  - id: export-service
    content: 創建 DataSetExportService.cs 實現 Excel 生成邏輯
    status: pending
    dependencies:
      - export-queue-model
  - id: export-api
    content: 在 DataSetsController.cs 實現導出相關 API（創建任務、查詢狀態、下載文件）
    status: pending
    dependencies:
      - export-service
  - id: export-ui
    content: 在 DataSetManagementPage.js 實現導出 UI（按鈕、任務列表、狀態顯示）
    status: pending
    dependencies:
      - export-api
  - id: google-sheets-write
    content: 在 GoogleSheetsService.cs 實現寫入方法（WriteSheetDataAsync, UpdateSheetDataAsync）
    status: pending
  - id: google-sheets-scopes
    content: 更新 Google Sheets 認證 Scopes 支持寫入權限
    status: pending
  - id: bidirectional-sync
    content: 在 DataSetsController.cs 實現 SyncToGoogleDocs 方法和雙向同步邏輯
    status: pending
    dependencies:
      - google-sheets-write
      - google-sheets-scopes
---

# DataSet 功能增強計劃

## 當前狀態

### 已實現功能
1. **單向同步**：從外部數據源（SQL、Excel、Google Docs）讀取數據到內部 DataSet
   - `SyncFromSql`: 執行 SQL 查詢並寫入 `data_set_records` 表
   - `SyncFromExcel`: 讀取 Excel 文件並寫入內部表
   - `SyncFromGoogleDocs`: 從 Google Sheets 讀取數據並寫入內部表
   - 所有同步方法最終都調用 `ProcessIncrementalSync` 進行增量同步（新增/更新/刪除）

2. **數據結構**：
   - `data_sets`: 數據集定義表
   - `data_set_columns`: 欄位定義表
   - `data_set_records`: 記錄表（EAV 模式的主表）
   - `data_set_record_values`: 記錄值表（EAV 模式的值表）

3. **Google Sheets 服務**：
   - `GoogleSheetsService` 目前只有讀取功能（`ReadSheetDataAsync`）
   - 使用 Google Sheets API v4
   - 支持 API Key 和 Service Account 認證
   - 當前 Scopes 為 `spreadsheets.readonly`（只讀）

4. **記錄查看介面**：
   - 在 `DataSetManagementPage.js` 的 Drawer 中顯示記錄
   - 支持分頁、搜索、排序
   - 目前沒有刪除記錄的 UI 功能

### 未實現功能
1. **雙向同步**：無法將內部 DataSet 的更新寫回外部數據源
2. **記錄刪除 UI**：無法在介面中刪除單條記錄
3. **Excel 導出**：沒有導出功能
4. **Google Sheets 寫入**：`GoogleSheetsService` 沒有寫入方法

## 實施計劃

### 任務 1: 記錄刪除功能

**文件**: `src/pages/DataSetManagementPage.js`

**實施步驟**:
1. 在記錄表格的 actions 列添加刪除按鈕
2. 實現 `handleDeleteRecord` 函數，調用後端 API
3. 添加確認對話框（使用 `Popconfirm`）
4. 刪除成功後刷新記錄列表

**後端 API**:
- 新增 `DELETE /api/datasets/{datasetId}/records/{recordId}` 端點
- 在 `DataSetsController.cs` 中實現 `DeleteDataSetRecord` 方法
- 刪除記錄時同時刪除相關的 `data_set_record_values` 記錄

### 任務 2: Excel 導出功能（第三優先級）

#### 2.1 數據庫設計

**新表**: `dataset_export_queue`

```sql
CREATE TABLE dataset_export_queue (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    data_set_id UNIQUEIDENTIFIER NOT NULL,
    company_id UNIQUEIDENTIFIER NOT NULL,
    export_type NVARCHAR(50) NOT NULL, -- 'filtered' or 'all'
    filter_conditions NVARCHAR(MAX) NULL, -- JSON 格式的篩選條件
    status NVARCHAR(50) NOT NULL, -- 'Pending', 'Processing', 'Completed', 'Failed'
    file_path NVARCHAR(500) NULL, -- 生成的文件路徑
    total_records INT NULL, -- 總記錄數
    processed_records INT NULL, -- 已處理記錄數
    error_message NVARCHAR(MAX) NULL,
    created_by NVARCHAR(100) NULL,
    created_at DATETIME2 DEFAULT GETDATE(),
    started_at DATETIME2 NULL,
    completed_at DATETIME2 NULL
);

CREATE INDEX IX_DatasetExportQueue_DataSetId ON dataset_export_queue(data_set_id);
CREATE INDEX IX_DatasetExportQueue_Status ON dataset_export_queue(status);
CREATE INDEX IX_DatasetExportQueue_CompanyId ON dataset_export_queue(company_id);
```

#### 2.2 後端實現

**文件**: `Controllers/DataSetsController.cs`

1. **創建導出任務**:
   - `POST /api/datasets/{id}/export` - 創建導出任務
   - 接收參數：`exportType` ('filtered' | 'all'), `filterConditions` (可選)
   - 創建 `dataset_export_queue` 記錄，狀態為 'Pending'
   - 返回任務 ID

2. **後台處理服務**:
   - 創建 `Services/DataSetExportService.cs`
   - 實現異步 Excel 生成邏輯
   - 使用 `DocumentFormat.OpenXml` 生成 Excel 文件
   - 根據欄位定義生成表頭
   - 支持篩選條件查詢數據
   - 更新任務狀態和進度

3. **查詢任務狀態**:
   - `GET /api/datasets/{id}/export-queue` - 獲取導出任務列表
   - `GET /api/datasets/export-queue/{queueId}` - 獲取單個任務狀態
   - `GET /api/datasets/export-queue/{queueId}/download` - 下載生成的文件

#### 2.3 前端實現

**文件**: `src/pages/DataSetManagementPage.js`

1. **導出按鈕**:
   - 在記錄查看 Drawer 的 extra 區域添加「導出 Excel」按鈕
   - 點擊後顯示 Modal，選擇導出類型（當前篩選/全部數據）

2. **導出任務管理介面**:
   - 新增 Drawer 顯示導出任務列表
   - 顯示任務狀態、進度、創建時間等
   - 支持下載已完成的文件
   - 支持取消進行中的任務

3. **狀態輪詢**:
   - 使用 `setInterval` 定期查詢任務狀態
   - 任務完成後自動顯示下載按鈕

### 任務 3: 雙向同步（Google Docs）（第二優先級）

#### 3.1 Google Sheets 寫入功能

**文件**: `Services/GoogleSheetsService.cs`

1. **擴展接口**:
   ```csharp
   Task<bool> WriteSheetDataAsync(Guid companyId, string spreadsheetId, string sheetName, List<List<object>> data, int startRow = 1);
   Task<bool> UpdateSheetDataAsync(Guid companyId, string spreadsheetId, string sheetName, Dictionary<int, Dictionary<int, object>> updates);
   Task<bool> ClearSheetRangeAsync(Guid companyId, string spreadsheetId, string sheetName, string range);
   ```

2. **更新 Scopes**:
   - 將 `spreadsheets.readonly` 改為 `https://www.googleapis.com/auth/spreadsheets`
   - 確保 Service Account 配置包含寫入權限

3. **實現寫入方法**:
   - 使用 `Spreadsheets.Values.Update` API
   - 支持批量寫入
   - 處理錯誤和重試邏輯

#### 3.2 雙向同步邏輯

**文件**: `Controllers/DataSetsController.cs`

1. **新增同步方向參數**:
   - 在 `SyncDataSet` 方法中添加 `syncDirection` 參數 ('inbound' | 'outbound' | 'bidirectional')
   - 默認為 'inbound'（保持向後兼容）

2. **實現 `SyncToGoogleDocs` 方法**:
   - 讀取內部 `data_set_records` 和 `data_set_record_values`
   - 根據欄位定義構建數據行
   - 調用 `GoogleSheetsService.WriteSheetDataAsync` 寫入 Google Sheets
   - 處理主鍵映射（內部主鍵值 → Google Sheets 行號）

3. **增量寫入策略**:
   - 讀取 Google Sheets 現有數據
   - 比較內部數據和外部數據
   - 只寫入新增/更新的記錄
   - 處理刪除（標記或實際刪除）

4. **衝突處理**:
   - 檢測外部數據是否被修改
   - 提供衝突解決策略（覆蓋/跳過/合併）

#### 3.3 數據映射

**關鍵挑戰**:
- 內部使用 GUID 作為記錄 ID，Google Sheets 使用行號
- 需要維護主鍵值到行號的映射關係
- 處理欄位順序和名稱對應

**解決方案**:
- 使用 `primary_key_value` 作為映射鍵
- 在 Google Sheets 第一列存儲主鍵值（隱藏列或標記列）
- 同步時根據主鍵值查找對應行號

## 實施順序（已調整）

1. **任務 1**（記錄刪除）- 最簡單，優先實施
   - 前端 UI 添加刪除按鈕
   - 後端實現刪除 API
   - 測試單條和批量刪除

2. **任務 3**（雙向同步）- 中等複雜度，第二優先
   - 擴展 GoogleSheetsService 支持寫入
   - 實現 SyncToGoogleDocs 方法
   - 處理數據映射和衝突解決

3. **任務 2**（Excel 導出）- 需要設計隊列表，最後實施
   - 創建 dataset_export_queue 表
   - 實現後台 Excel 生成服務
   - 前端導出 UI 和任務管理

## 技術要點

### Excel 生成
- 使用 `DocumentFormat.OpenXml` 庫（項目已使用）
- 支持大文件分批處理
- 文件存儲在 `Uploads/exports/` 目錄

### Google Sheets API
- 需要更新認證 Scopes
- 注意 API 配額限制
- 實現批量操作以提高效率

### 錯誤處理
- 所有異步操作都需要完善的錯誤處理
- 記錄詳細的日誌
- 提供用戶友好的錯誤信息

## 數據庫遷移

需要創建新的遷移腳本：
- `dataset_export_queue` 表
- 相關索引

## 測試要點

1. **刪除記錄**：單條刪除、批量刪