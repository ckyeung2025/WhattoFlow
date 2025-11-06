-- 測試增量同步功能的 SQL 腳本
-- 用於驗證新增、更新、刪除檢測是否正常工作

PRINT '=== 增量同步功能測試 ==='

-- 1. 檢查現有數據
PRINT '1. 檢查現有 DataSet 記錄...'
SELECT 
    ds.name AS DataSetName,
    COUNT(dsr.id) AS RecordCount,
    MAX(dsr.created_at) AS LastCreated,
    MAX(dsr.updated_at) AS LastUpdated
FROM data_sets ds
LEFT JOIN data_set_records dsr ON ds.id = dsr.data_set_id
GROUP BY ds.id, ds.name
ORDER BY ds.name

-- 2. 檢查主鍵欄位定義
PRINT '2. 檢查主鍵欄位定義...'
SELECT 
    ds.name AS DataSetName,
    dsc.column_name AS PrimaryKeyColumn,
    dsc.data_type AS DataType,
    dsc.is_primary_key AS IsPrimaryKey
FROM data_sets ds
INNER JOIN data_set_columns dsc ON ds.id = dsc.data_set_id
WHERE dsc.is_primary_key = 1
ORDER BY ds.name, dsc.sort_order

-- 3. 檢查記錄值分佈
PRINT '3. 檢查記錄值分佈...'
SELECT 
    ds.name AS DataSetName,
    dsc.column_name AS ColumnName,
    COUNT(dsrv.id) AS ValueCount,
    COUNT(CASE WHEN dsrv.string_value IS NOT NULL THEN 1 END) AS StringValues,
    COUNT(CASE WHEN dsrv.numeric_value IS NOT NULL THEN 1 END) AS NumericValues,
    COUNT(CASE WHEN dsrv.date_value IS NOT NULL THEN 1 END) AS DateValues,
    COUNT(CASE WHEN dsrv.boolean_value IS NOT NULL THEN 1 END) AS BooleanValues
FROM data_sets ds
INNER JOIN data_set_records dsr ON ds.id = dsr.data_set_id
INNER JOIN data_set_record_values dsrv ON dsr.id = dsrv.record_id
INNER JOIN data_set_columns dsc ON ds.id = dsc.data_set_id AND dsrv.column_name = dsc.column_name
GROUP BY ds.name, dsc.column_name
ORDER BY ds.name, dsc.column_name

-- 4. 檢查重複主鍵
PRINT '4. 檢查重複主鍵...'
SELECT 
    ds.name AS DataSetName,
    dsr.primary_key_value AS PrimaryKeyValue,
    COUNT(*) AS DuplicateCount
FROM data_sets ds
INNER JOIN data_set_records dsr ON ds.id = dsr.data_set_id
GROUP BY ds.name, dsr.primary_key_value
HAVING COUNT(*) > 1
ORDER BY ds.name, COUNT(*) DESC

-- 5. 檢查空主鍵
PRINT '5. 檢查空主鍵...'
SELECT 
    ds.name AS DataSetName,
    COUNT(*) AS EmptyPrimaryKeyCount
FROM data_sets ds
INNER JOIN data_set_records dsr ON ds.id = dsr.data_set_id
WHERE dsr.primary_key_value IS NULL OR LTRIM(RTRIM(dsr.primary_key_value)) = ''
GROUP BY ds.name
ORDER BY ds.name

-- 6. 提供測試建議
PRINT '6. 測試建議:'
PRINT '   - 確保每個 DataSet 都有正確的主鍵欄位定義'
PRINT '   - 檢查是否有重複或空的主鍵值'
PRINT '   - 執行同步後比較記錄數量的變化'
PRINT '   - 檢查日誌中的同步統計信息'

PRINT '=== 測試完成 ==='
