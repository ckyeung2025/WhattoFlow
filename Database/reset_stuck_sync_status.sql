-- 重置卡住的同步狀態
-- 將所有 "Running" 狀態的數據集重置為 "Idle"

-- 1. 檢查當前卡住的同步狀態
SELECT 
    id,
    name,
    sync_status,
    sync_started_at,
    sync_completed_at,
    sync_started_by,
    sync_error_message,
    total_records_to_sync,
    records_processed,
    records_inserted,
    records_updated,
    records_deleted,
    records_skipped
FROM data_sets 
WHERE sync_status = 'Running'
ORDER BY sync_started_at;

-- 2. 重置所有卡住的同步狀態
UPDATE data_sets 
SET 
    sync_status = 'Idle',
    sync_started_at = NULL,
    sync_completed_at = NULL,
    sync_started_by = NULL,
    sync_error_message = NULL,
    total_records_to_sync = 0,
    records_processed = 0,
    records_inserted = 0,
    records_updated = 0,
    records_deleted = 0,
    records_skipped = 0
WHERE sync_status = 'Running';

-- 3. 驗證更新結果
SELECT 
    id,
    name,
    sync_status,
    sync_started_at,
    sync_completed_at,
    sync_started_by,
    sync_error_message,
    total_records_to_sync,
    records_processed,
    records_inserted,
    records_updated,
    records_deleted,
    records_skipped
FROM data_sets 
WHERE sync_status = 'Idle'
ORDER BY name;

-- 4. 顯示受影響的記錄數
SELECT COUNT(*) as affected_records
FROM data_sets 
WHERE sync_status = 'Idle';

PRINT '同步狀態重置完成！所有卡住的同步已重置為 Idle 狀態。';
