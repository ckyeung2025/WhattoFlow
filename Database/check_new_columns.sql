-- 檢查 data_sets 表是否有新欄位
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'data_sets' AND TABLE_SCHEMA = 'dbo'
AND COLUMN_NAME IN (
    'sync_status', 'sync_started_at', 'sync_completed_at', 'sync_error_message', 'sync_started_by',
    'total_records_to_sync', 'records_processed', 'records_inserted', 'records_updated', 
    'records_deleted', 'records_skipped', 'batch_size', 'max_sync_duration_minutes', 'allow_overlap'
)
ORDER BY COLUMN_NAME;
