# API 修改總結

## 修改概述
根據需求，對 QR Scan API 和 DeliveryReceipt API 進行了以下修改：

### 1. 資料庫修改
- 在 `delivery_receipt` 表中添加了 `uploaded_by` 欄位 (NVARCHAR(20))
- 用於區分記錄是由哪個 API 上傳的

### 2. 模型修改
- **DeliveryReceipt.cs**: 添加了 `uploaded_by` 屬性
- **UnconfirmedDeliveryDto.cs**: 添加了 `UploadedBy` 屬性

### 3. API 修改

#### QrScanController (/api/QrScan/scan)
**修改前**: 只掃描 QR Code 並返回訂單資訊
**修改後**: 
- 掃描 QR Code 成功後，自動寫入 `delivery_receipt` 表
- 設置 `uploaded_by = 'DeliveryMan'`
- 儲存原始圖片和生成 PDF
- 返回完整的記錄資訊

#### DeliveryReceiptController (/api/DeliveryReceipt/upload)
**修改前**: 總是新增記錄
**修改後**:
- 檢查是否已存在相同 QR code 的記錄
- 如果存在：更新 `upload_date = now` 和 `uploaded_by = 'Customer'`
- 如果不存在：新增記錄並設置 `uploaded_by = 'Customer'`

### 4. Service 修改
- **DeliveryService.cs**: 在所有查詢方法中添加了 `UploadedBy` 欄位的映射

## 執行步驟

### 1. 執行資料庫腳本
```sql
-- 執行 add_uploaded_by_column.sql
USE ANWChatBot;

-- 檢查欄位是否已存在
IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'delivery_receipt' 
    AND COLUMN_NAME = 'uploaded_by'
)
BEGIN
    -- 添加 uploaded_by 欄位
    ALTER TABLE delivery_receipt 
    ADD uploaded_by NVARCHAR(20) NULL;
    
    PRINT 'uploaded_by 欄位已成功添加到 delivery_receipt 表';
END
ELSE
BEGIN
    PRINT 'uploaded_by 欄位已存在於 delivery_receipt 表';
END
```

### 2. 重新編譯並啟動 API
```bash
dotnet build
dotnet run
```

## API 行為說明

### /api/QrScan/scan (POST)
- **用途**: 送貨員掃描 QR Code
- **行為**: 掃描成功後自動寫入記錄
- **uploaded_by**: "DeliveryMan"
- **返回**: 完整的記錄資訊，包含 receiptId

### /api/DeliveryReceipt/upload (POST)
- **用途**: 客戶上傳簽收單據
- **行為**: 
  - 如果 QR code 已存在：更新現有記錄
  - 如果 QR code 不存在：新增記錄
- **uploaded_by**: "Customer"
- **返回**: 包含 isUpdate 標誌的完整記錄資訊

## 前端顯示
- 前端表格現在會顯示 `UploadedBy` 欄位
- 可以區分記錄是由送貨員掃描還是客戶上傳
- 支援搜尋和篩選功能 

# eFormDefinitions 資料表 DDL

```sql
CREATE TABLE eFormDefinitions (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    company_id UNIQUEIDENTIFIER NOT NULL,
    name NVARCHAR(100) NOT NULL,
    description NVARCHAR(255),
    html_code NVARCHAR(MAX) NOT NULL, -- 儲存整個 HTML+JS
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME,
    created_user_id UNIQUEIDENTIFIER NOT NULL, -- 建立者
    updated_user_id UNIQUEIDENTIFIER -- 最後更新者
);
```

- company_id：對應公司
- html_code：可放完整 HTML+JS
- created_user_id：建立者 user id
- updated_user_id：最後更新者 user id
- 你可依需求加上 workflow_id、狀態等欄位 