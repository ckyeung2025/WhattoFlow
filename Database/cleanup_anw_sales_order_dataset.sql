-- 清理 ANW Sales Order 數據集的舊記錄
-- 用於解決欄位名稱標準化不一致的問題

USE PurpleRice;
GO

DECLARE @DataSetId UNIQUEIDENTIFIER = '110C7D54-87A7-462B-8A7D-5EAC6EE78E8E';
DECLARE @DataSetName NVARCHAR(200) = 'ANW Sales Order';

PRINT '開始清理數據集: ' + @DataSetName;
PRINT '數據集ID: ' + CAST(@DataSetId AS NVARCHAR(50));

-- 檢查數據集是否存在
IF NOT EXISTS (SELECT 1 FROM data_sets WHERE id = @DataSetId)
BEGIN
    PRINT '錯誤：找不到數據集 ' + @DataSetName;
    RETURN;
END

-- 顯示清理前的統計
DECLARE @RecordCount INT;
DECLARE @ValueCount INT;

SELECT @RecordCount = COUNT(*) FROM data_set_records WHERE data_set_id = @DataSetId;
SELECT @ValueCount = COUNT(*) FROM data_set_record_values drv 
    INNER JOIN data_set_records dr ON drv.record_id = dr.id 
    WHERE dr.data_set_id = @DataSetId;

PRINT '清理前統計：';
PRINT '  記錄數: ' + CAST(@RecordCount AS NVARCHAR(10));
PRINT '  欄位值數: ' + CAST(@ValueCount AS NVARCHAR(10));

-- 開始清理
PRINT '開始清理數據...';

-- 刪除欄位值
DELETE drv 
FROM data_set_record_values drv 
INNER JOIN data_set_records dr ON drv.record_id = dr.id 
WHERE dr.data_set_id = @DataSetId;

PRINT '已刪除所有欄位值';

-- 刪除記錄
DELETE FROM data_set_records WHERE data_set_id = @DataSetId;

PRINT '已刪除所有記錄';

-- 重置數據集狀態
UPDATE data_sets 
SET 
    sync_status = 'Idle',
    sync_started_at = NULL,
    sync_completed_at = NULL,
    sync_error_message = NULL,
    sync_started_by = NULL,
    total_records_to_sync = 0,
    records_processed = 0,
    records_inserted = 0,
    records_updated = 0,
    records_deleted = 0,
    records_skipped = 0,
    last_data_sync_time = NULL
WHERE id = @DataSetId;

PRINT '已重置數據集狀態';

-- 顯示清理後的統計
SELECT @RecordCount = COUNT(*) FROM data_set_records WHERE data_set_id = @DataSetId;
SELECT @ValueCount = COUNT(*) FROM data_set_record_values drv 
    INNER JOIN data_set_records dr ON drv.record_id = dr.id 
    WHERE dr.data_set_id = @DataSetId;

PRINT '清理後統計：';
PRINT '  記錄數: ' + CAST(@RecordCount AS NVARCHAR(10));
PRINT '  欄位值數: ' + CAST(@ValueCount AS NVARCHAR(10));

PRINT '清理完成！現在可以重新同步數據集。';
