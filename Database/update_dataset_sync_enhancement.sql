-- =====================================================
-- DataSet 同步優化功能數據庫更新腳本
-- 創建日期: 2025-01-22
-- 描述: 為 DataSet 同步功能添加進度追蹤、狀態管理和批次處理支持
-- 注意: 此腳本分為多個批次執行，避免欄位引用錯誤
-- =====================================================

USE [PurpleRice];
GO

PRINT '--- 開始更新 DataSet 同步功能 ---';

-- =====================================================
-- 批次 1: 檢查當前表結構
-- =====================================================
PRINT '1. 檢查 data_sets 表的當前欄位：';
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'data_sets' AND TABLE_SCHEMA = 'dbo'
ORDER BY ORDINAL_POSITION;
GO

-- =====================================================
-- 批次 2: 添加同步狀態相關欄位
-- =====================================================
PRINT '2. 添加同步狀態相關欄位...';

-- 同步狀態
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'data_sets' AND COLUMN_NAME = 'sync_status')
BEGIN
    ALTER TABLE dbo.data_sets 
    ADD sync_status NVARCHAR(20) DEFAULT 'Idle';
    PRINT '已添加 sync_status 欄位';
END
ELSE
BEGIN
    PRINT 'sync_status 欄位已存在';
END

-- 同步開始時間
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'data_sets' AND COLUMN_NAME = 'sync_started_at')
BEGIN
    ALTER TABLE dbo.data_sets 
    ADD sync_started_at DATETIME2;
    PRINT '已添加 sync_started_at 欄位';
END
ELSE
BEGIN
    PRINT 'sync_started_at 欄位已存在';
END

-- 同步完成時間
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'data_sets' AND COLUMN_NAME = 'sync_completed_at')
BEGIN
    ALTER TABLE dbo.data_sets 
    ADD sync_completed_at DATETIME2;
    PRINT '已添加 sync_completed_at 欄位';
END
ELSE
BEGIN
    PRINT 'sync_completed_at 欄位已存在';
END

-- 同步錯誤訊息
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'data_sets' AND COLUMN_NAME = 'sync_error_message')
BEGIN
    ALTER TABLE dbo.data_sets 
    ADD sync_error_message NVARCHAR(MAX);
    PRINT '已添加 sync_error_message 欄位';
END
ELSE
BEGIN
    PRINT 'sync_error_message 欄位已存在';
END

-- 同步啟動者
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'data_sets' AND COLUMN_NAME = 'sync_started_by')
BEGIN
    ALTER TABLE dbo.data_sets 
    ADD sync_started_by NVARCHAR(50);
    PRINT '已添加 sync_started_by 欄位';
END
ELSE
BEGIN
    PRINT 'sync_started_by 欄位已存在';
END
GO

-- =====================================================
-- 批次 3: 添加進度追蹤欄位
-- =====================================================
PRINT '3. 添加進度追蹤欄位...';

-- 總記錄數
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'data_sets' AND COLUMN_NAME = 'total_records_to_sync')
BEGIN
    ALTER TABLE dbo.data_sets 
    ADD total_records_to_sync INT DEFAULT 0;
    PRINT '已添加 total_records_to_sync 欄位';
END
ELSE
BEGIN
    PRINT 'total_records_to_sync 欄位已存在';
END

-- 已處理記錄數
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'data_sets' AND COLUMN_NAME = 'records_processed')
BEGIN
    ALTER TABLE dbo.data_sets 
    ADD records_processed INT DEFAULT 0;
    PRINT '已添加 records_processed 欄位';
END
ELSE
BEGIN
    PRINT 'records_processed 欄位已存在';
END

-- 新增記錄數
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'data_sets' AND COLUMN_NAME = 'records_inserted')
BEGIN
    ALTER TABLE dbo.data_sets 
    ADD records_inserted INT DEFAULT 0;
    PRINT '已添加 records_inserted 欄位';
END
ELSE
BEGIN
    PRINT 'records_inserted 欄位已存在';
END

-- 更新記錄數
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'data_sets' AND COLUMN_NAME = 'records_updated')
BEGIN
    ALTER TABLE dbo.data_sets 
    ADD records_updated INT DEFAULT 0;
    PRINT '已添加 records_updated 欄位';
END
ELSE
BEGIN
    PRINT 'records_updated 欄位已存在';
END

-- 刪除記錄數
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'data_sets' AND COLUMN_NAME = 'records_deleted')
BEGIN
    ALTER TABLE dbo.data_sets 
    ADD records_deleted INT DEFAULT 0;
    PRINT '已添加 records_deleted 欄位';
END
ELSE
BEGIN
    PRINT 'records_deleted 欄位已存在';
END

-- 跳過記錄數
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'data_sets' AND COLUMN_NAME = 'records_skipped')
BEGIN
    ALTER TABLE dbo.data_sets 
    ADD records_skipped INT DEFAULT 0;
    PRINT '已添加 records_skipped 欄位';
END
ELSE
BEGIN
    PRINT 'records_skipped 欄位已存在';
END
GO

-- =====================================================
-- 批次 4: 添加批次處理設定欄位
-- =====================================================
PRINT '4. 添加批次處理設定欄位...';

-- 批次大小
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'data_sets' AND COLUMN_NAME = 'batch_size')
BEGIN
    ALTER TABLE dbo.data_sets 
    ADD batch_size INT DEFAULT 1000;
    PRINT '已添加 batch_size 欄位';
END
ELSE
BEGIN
    PRINT 'batch_size 欄位已存在';
END

-- 最大同步時間（分鐘）
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'data_sets' AND COLUMN_NAME = 'max_sync_duration_minutes')
BEGIN
    ALTER TABLE dbo.data_sets 
    ADD max_sync_duration_minutes INT DEFAULT 60;
    PRINT '已添加 max_sync_duration_minutes 欄位';
END
ELSE
BEGIN
    PRINT 'max_sync_duration_minutes 欄位已存在';
END

-- 是否允許重疊同步
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'data_sets' AND COLUMN_NAME = 'allow_overlap')
BEGIN
    ALTER TABLE dbo.data_sets 
    ADD allow_overlap BIT DEFAULT 0;
    PRINT '已添加 allow_overlap 欄位';
END
ELSE
BEGIN
    PRINT 'allow_overlap 欄位已存在';
END
GO

-- =====================================================
-- 批次 5: 添加檢查約束
-- =====================================================
PRINT '5. 添加檢查約束...';

-- 同步狀態檢查約束
IF NOT EXISTS (SELECT * FROM sys.check_constraints WHERE name = 'CK_data_sets_sync_status')
BEGIN
    ALTER TABLE dbo.data_sets 
    ADD CONSTRAINT CK_data_sets_sync_status 
    CHECK (sync_status IN ('Idle', 'Running', 'Completed', 'Failed', 'Paused'));
    PRINT '已添加 sync_status 檢查約束';
END
ELSE
BEGIN
    PRINT 'sync_status 檢查約束已存在';
END

-- 批次大小檢查約束
IF NOT EXISTS (SELECT * FROM sys.check_constraints WHERE name = 'CK_data_sets_batch_size')
BEGIN
    ALTER TABLE dbo.data_sets 
    ADD CONSTRAINT CK_data_sets_batch_size 
    CHECK (batch_size > 0 AND batch_size <= 10000);
    PRINT '已添加 batch_size 檢查約束';
END
ELSE
BEGIN
    PRINT 'batch_size 檢查約束已存在';
END

-- 最大同步時間檢查約束
IF NOT EXISTS (SELECT * FROM sys.check_constraints WHERE name = 'CK_data_sets_max_sync_duration')
BEGIN
    ALTER TABLE dbo.data_sets 
    ADD CONSTRAINT CK_data_sets_max_sync_duration 
    CHECK (max_sync_duration_minutes > 0 AND max_sync_duration_minutes <= 1440);
    PRINT '已添加 max_sync_duration_minutes 檢查約束';
END
ELSE
BEGIN
    PRINT 'max_sync_duration_minutes 檢查約束已存在';
END
GO

-- =====================================================
-- 批次 6: 添加索引
-- =====================================================
PRINT '6. 添加索引...';

-- 同步狀態索引
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_data_sets_sync_status')
BEGIN
    CREATE INDEX IX_data_sets_sync_status ON dbo.data_sets(sync_status);
    PRINT '已添加 sync_status 索引';
END
ELSE
BEGIN
    PRINT 'sync_status 索引已存在';
END

-- 同步開始時間索引
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_data_sets_sync_started_at')
BEGIN
    CREATE INDEX IX_data_sets_sync_started_at ON dbo.data_sets(sync_started_at);
    PRINT '已添加 sync_started_at 索引';
END
ELSE
BEGIN
    PRINT 'sync_started_at 索引已存在';
END

-- 公司ID和同步狀態複合索引
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_data_sets_company_sync_status')
BEGIN
    CREATE INDEX IX_data_sets_company_sync_status ON dbo.data_sets(company_id, sync_status);
    PRINT '已添加 company_id + sync_status 複合索引';
END
ELSE
BEGIN
    PRINT 'company_id + sync_status 複合索引已存在';
END
GO

-- =====================================================
-- 批次 7: 更新現有數據的預設值
-- =====================================================
PRINT '7. 更新現有數據的預設值...';

-- 將現有數據的同步狀態設為 Idle
UPDATE dbo.data_sets 
SET sync_status = 'Idle'
WHERE sync_status IS NULL;

-- 將現有數據的批次大小設為 1000
UPDATE dbo.data_sets 
SET batch_size = 1000
WHERE batch_size IS NULL;

-- 將現有數據的最大同步時間設為 60 分鐘
UPDATE dbo.data_sets 
SET max_sync_duration_minutes = 60
WHERE max_sync_duration_minutes IS NULL;

-- 將現有數據的允許重疊設為 0（不允許）
UPDATE dbo.data_sets 
SET allow_overlap = 0
WHERE allow_overlap IS NULL;

PRINT '已更新現有數據的預設值';
GO

-- =====================================================
-- 批次 8: 驗證更新結果
-- =====================================================
PRINT '8. 驗證更新結果...';

-- 檢查新添加的欄位
SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE, COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'data_sets' AND TABLE_SCHEMA = 'dbo'
AND COLUMN_NAME IN (
    'sync_status', 'sync_started_at', 'sync_completed_at', 'sync_error_message', 'sync_started_by',
    'total_records_to_sync', 'records_processed', 'records_inserted', 'records_updated', 
    'records_deleted', 'records_skipped', 'batch_size', 'max_sync_duration_minutes', 'allow_overlap'
)
ORDER BY COLUMN_NAME;

-- 檢查索引
SELECT i.name AS index_name, i.type_desc, c.name AS column_name
FROM sys.indexes i
INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
WHERE i.object_id = OBJECT_ID('dbo.data_sets')
AND i.name LIKE 'IX_data_sets%'
ORDER BY i.name, ic.key_ordinal;

-- 檢查約束
SELECT cc.name AS constraint_name, cc.definition
FROM sys.check_constraints cc
WHERE cc.parent_object_id = OBJECT_ID('dbo.data_sets')
AND cc.name LIKE 'CK_data_sets%'
ORDER BY cc.name;
GO

-- =====================================================
-- 批次 9: 生成統計報告
-- =====================================================
PRINT '9. 生成統計報告...';

SELECT 
    'data_sets' AS table_name,
    COUNT(*) AS total_records,
    SUM(CASE WHEN sync_status = 'Idle' THEN 1 ELSE 0 END) AS idle_count,
    SUM(CASE WHEN sync_status = 'Running' THEN 1 ELSE 0 END) AS running_count,
    SUM(CASE WHEN sync_status = 'Completed' THEN 1 ELSE 0 END) AS completed_count,
    SUM(CASE WHEN sync_status = 'Failed' THEN 1 ELSE 0 END) AS failed_count,
    SUM(CASE WHEN sync_status = 'Paused' THEN 1 ELSE 0 END) AS paused_count,
    AVG(CAST(total_records AS FLOAT)) AS avg_total_records,
    AVG(CAST(batch_size AS FLOAT)) AS avg_batch_size,
    AVG(CAST(max_sync_duration_minutes AS FLOAT)) AS avg_max_duration_minutes
FROM dbo.data_sets;
GO

PRINT '--- DataSet 同步功能更新完成 ---';
PRINT '更新摘要：';
PRINT '- 添加了 13 個新欄位用於同步狀態和進度追蹤';
PRINT '- 添加了 3 個檢查約束確保數據完整性';
PRINT '- 添加了 3 個索引提升查詢性能';
PRINT '- 更新了現有數據的預設值';
PRINT '- 所有更改已完成並驗證';
