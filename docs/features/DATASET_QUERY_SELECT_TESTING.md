# DataSet Query 節點 - SELECT 操作測試指南

## 功能概述

DataSet Query 節點的 SELECT 操作已完整實施，支持以下功能：

### ✅ 已實現功能

1. **查詢外部數據源**
   - 支持 SQL 數據庫查詢
   - 支持內部 DataSet 記錄查詢
   - 自動識別數據源類型

2. **WHERE 條件設置**
   - 支持多個條件組
   - 每個條件組支持 AND/OR 關係
   - 13 種操作符：
     - equals (=)
     - notEquals (!=)
     - greaterThan (>)
     - lessThan (<)
     - greaterThanOrEqual (>=)
     - lessThanOrEqual (<=)
     - contains (LIKE %value%)
     - startsWith (LIKE value%)
     - endsWith (LIKE %value)
     - isEmpty (IS NULL OR = '')
     - isNotEmpty (IS NOT NULL AND != '')
     - in (IN (...))
     - notIn (NOT IN (...))

3. **流程變量支持**
   - WHERE 條件值支持流程變量替換
   - 格式：`${變量名}`
   - 例如：`${CustomerNo}`, `${InvoiceNo}`
   - 自動從當前工作流執行中獲取變量值

4. **欄位映射到流程變量**
   - 將查詢結果的欄位值寫入流程變量
   - 支持多個欄位映射
   - 如果查詢返回多條記錄，只映射第一條記錄的值
   - 自動處理數據類型轉換

5. **連接字符串管理**
   - 支持從 appsettings.json 讀取預設連接
   - 支持自定義連接字符串
   - 支持多個預設連接配置

---

## 測試步驟

### 前置條件

1. 確保已創建 DataSet 並配置數據源
2. 確保數據源連接正常
3. 在工作流中定義相關的流程變量

### 測試場景 1：基本 SELECT 查詢（無條件）

**配置：**
```
DataSet: 選擇一個已配置的 DataSet
操作類型: SELECT
查詢條件: （留空）
欄位映射: （留空）
```

**預期結果：**
- 返回所有記錄（最多 1000 條）
- 記錄保存到 `workflow_dataset_query_results` 表
- 步驟執行狀態為 "Completed"

---

### 測試場景 2：帶條件的 SELECT 查詢

**配置：**
```
DataSet: 客戶資料 DataSet
操作類型: SELECT
查詢條件: 
  - 條件組 1 (AND):
    - CustomerNo = '12345'
    - Status = 'Active'
```

**預期結果：**
- 只返回符合條件的記錄
- 生成正確的 WHERE 子句：`([CustomerNo] = '12345') AND ([Status] = 'Active')`
- 查詢結果正確

---

### 測試場景 3：使用流程變量的 SELECT 查詢

**前置步驟：**
1. 在工作流開始時設置流程變量：`CustomerNo = "A001"`
2. 添加 DataSet Query 節點

**配置：**
```
DataSet: 客戶資料 DataSet
操作類型: SELECT
查詢條件:
  - 條件組 1:
    - CustomerNo equals ${CustomerNo}
欄位映射: （留空）
```

**預期結果：**
- 流程變量 `${CustomerNo}` 被替換為 "A001"
- 生成的 WHERE 子句：`([CustomerNo] = 'A001')`
- 返回客戶編號為 A001 的記錄

**驗證方法：**
- 檢查日誌文件：`logs/DataSetQueryService_*.log`
- 查看 SQL 查詢日誌
- 確認流程變量替換正確

---

### 測試場景 4：欄位映射到流程變量

**前置步驟：**
1. 確保工作流定義了以下流程變量：
   - `CustomerName` (String)
   - `CustomerPhone` (String)
   - `CustomerEmail` (String)

**配置：**
```
DataSet: 客戶資料 DataSet
操作類型: SELECT
查詢條件:
  - 條件組 1:
    - CustomerNo equals ${CustomerNo}
欄位映射:
  - Name → CustomerName
  - Phone → CustomerPhone
  - Email → CustomerEmail
```

**預期結果：**
- 查詢執行成功
- 流程變量被正確更新：
  - `CustomerName` = 查詢結果的 Name 欄位值
  - `CustomerPhone` = 查詢結果的 Phone 欄位值
  - `CustomerEmail` = 查詢結果的 Email 欄位值
- 在 `process_variable_values` 表中可以看到這些變量
- SourceType 為 "DataSetQuery"

**驗證方法：**
```sql
-- 查詢流程變量值
SELECT * FROM process_variable_values 
WHERE workflow_execution_id = [執行ID] 
  AND source_type = 'DataSetQuery'
ORDER BY set_at DESC;

-- 查詢映射記錄
SELECT * FROM workflow_dataset_query_records
WHERE query_result_id = [查詢結果ID];
```

---

### 測試場景 5：複雜條件查詢（多個條件組）

**配置：**
```
DataSet: 訂單資料 DataSet
操作類型: SELECT
查詢條件:
  - 條件組 1 (AND):
    - OrderDate greaterThanOrEqual '2024-01-01'
    - OrderDate lessThan '2024-12-31'
  - 條件組 2 (OR):
    - Status equals 'Pending'
    - Status equals 'Processing'
```

**預期結果：**
- 生成的 WHERE 子句：
  ```sql
  ([OrderDate] >= '2024-01-01' AND [OrderDate] < '2024-12-31') 
  AND 
  ([Status] = 'Pending' OR [Status] = 'Processing')
  ```
- 返回符合條件的訂單

---

### 測試場景 6：數字類型條件

**配置：**
```
DataSet: 產品資料 DataSet
操作類型: SELECT
查詢條件:
  - 條件組 1:
    - Price greaterThan 100
    - Stock lessThanOrEqual 50
```

**預期結果：**
- 數字條件不加引號
- 生成的 WHERE 子句：`([Price] > 100 AND [Stock] <= 50)`
- 查詢正確執行

---

### 測試場景 7：完整流程測試

**工作流設計：**
```
1. Start 節點
2. Wait for QR Code 節點 (掃描客戶編號 QR Code)
   - 將掃描結果保存到流程變量 ${CustomerNo}
3. DataSet Query 節點 (查詢客戶資料)
   - 條件: CustomerNo = ${CustomerNo}
   - 映射: Name → ${CustomerName}, Phone → ${CustomerPhone}
4. Send WhatsApp 節點
   - 訊息: "您好 ${CustomerName}，您的電話是 ${CustomerPhone}"
5. End 節點
```

**測試步驟：**
1. 啟動工作流
2. 掃描客戶編號 QR Code（例如 "A001"）
3. 系統自動查詢客戶資料
4. 系統發送包含客戶姓名和電話的 WhatsApp 訊息

**預期結果：**
- 整個流程順利執行
- 客戶資料正確查詢
- WhatsApp 訊息包含正確的客戶資訊

---

## 日誌檢查

### 關鍵日誌位置

1. **DataSetQueryService 日誌**
   - 路徑: `logs/DataSetQueryService_*.log`
   - 包含：查詢執行、條件生成、欄位映射等詳細信息

2. **WorkflowEngine 日誌**
   - 路徑: `logs/WorkflowEngine_*.log`
   - 包含：節點執行、流程變量處理等信息

### 關鍵日誌內容

```log
# 查詢開始
開始執行 SELECT 查詢: 客戶資料 (ID: ...)
查詢條件組數量: 1
欄位映射數量: 3

# 條件生成
生成條件: [CustomerNo] = 'A001'
條件組: ([CustomerNo] = 'A001')
最終 WHERE 子句: ([CustomerNo] = 'A001')

# 查詢執行
使用外部數據源查詢: Database
執行數據庫查詢: SELECT TOP 1000 ... WHERE ([CustomerNo] = 'A001')
外部數據庫查詢成功，找到 1 條記錄

# 欄位映射
使用第一條記錄進行欄位映射（共 1 條記錄）
映射欄位: Name → CustomerName = 張三
映射欄位: Phone → CustomerPhone = 0912345678
映射欄位: Email → CustomerEmail = zhang@example.com

# 完成
欄位映射處理完成，共創建 1 條記錄關聯，寫入 3 個流程變量
DataSet 查詢執行完成，結果 ID: ...
```

---

## 數據庫表檢查

### 1. 查詢結果表

```sql
SELECT TOP 10 * 
FROM workflow_dataset_query_results
ORDER BY created_at DESC;
```

欄位說明：
- `workflow_execution_id`: 工作流執行 ID
- `step_execution_id`: 步驟執行 ID
- `data_set_id`: DataSet ID
- `operation_type`: 操作類型 (SELECT)
- `query_conditions`: 查詢條件 JSON
- `query_result`: 查詢結果 JSON
- `mapped_fields`: 映射欄位配置 JSON
- `status`: 執行狀態
- `total_records`: 總記錄數
- `records_processed`: 處理記錄數

### 2. 查詢記錄關聯表

```sql
SELECT * 
FROM workflow_dataset_query_records
WHERE query_result_id = '...'
ORDER BY created_at;
```

欄位說明：
- `query_result_id`: 查詢結果 ID
- `data_set_record_id`: DataSet 記錄 ID
- `mapped_variable_name`: 映射的流程變量名稱
- `mapped_variable_value`: 映射的值

### 3. 流程變量表

```sql
SELECT * 
FROM process_variable_values
WHERE workflow_execution_id = [執行ID]
  AND source_type = 'DataSetQuery'
ORDER BY set_at DESC;
```

---

## 常見問題排查

### 問題 1: 查詢沒有返回結果

**檢查項：**
1. 確認 WHERE 條件是否正確
2. 檢查流程變量值是否正確替換
3. 查看日誌中的 SQL 語句
4. 手動執行 SQL 確認數據是否存在

### 問題 2: 流程變量沒有被替換

**檢查項：**
1. 確認流程變量在查詢節點執行前已設置
2. 檢查變量名稱是否正確（區分大小寫）
3. 查看 `process_variable_values` 表確認變量存在
4. 檢查日誌中的 "處理前查詢條件" 和 "處理後查詢條件"

### 問題 3: 欄位映射失敗

**檢查項：**
1. 確認查詢返回的欄位名稱與映射配置一致
2. 檢查欄位名稱大小寫
3. 確認流程變量已定義
4. 查看日誌中的映射信息

### 問題 4: 連接數據庫失敗

**檢查項：**
1. 確認 `appsettings.json` 中的連接字符串正確
2. 檢查數據庫服務器是否可訪問
3. 確認數據庫用戶名密碼正確
4. 查看日誌中的連接錯誤信息

---

## 性能建議

1. **限制查詢結果數量**
   - 當前默認最多返回 1000 條記錄
   - 建議使用精確的 WHERE 條件減少返回記錄數

2. **索引優化**
   - 為常用查詢欄位添加索引
   - 特別是用於 WHERE 條件的欄位

3. **避免複雜查詢**
   - 盡量使用簡單的條件
   - 複雜的數據處理應在後端完成

---

## 下一步開發

- [ ] INSERT 操作實施
- [ ] UPDATE 操作實施  
- [ ] DELETE 操作實施
- [ ] 支持多條記錄的欄位映射（數組模式）
- [ ] 查詢結果分頁支持
- [ ] Excel 數據源查詢支持
- [ ] 查詢結果緩存機制

---

## 相關文件

- 後端服務: `Services/DataSetQueryService.cs`
- 工作流引擎: `Services/WorkflowEngine.cs`
- 前端組件: `src/components/WorkflowDesigner/components/NodePropertyDrawer.js`
- DTO 定義: `Models/DTOs/DataSetQueryRequest.cs`

---

**最後更新**: 2025-09-30
**版本**: 1.0
**狀態**: ✅ SELECT 操作已完整實施並可測試
