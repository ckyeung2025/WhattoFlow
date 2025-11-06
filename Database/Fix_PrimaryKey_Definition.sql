-- 修復 DataSet 主鍵欄位定義
-- 將 id 欄位標記為主鍵

PRINT '=== 修復主鍵欄位定義 ==='

-- 1. 檢查當前主鍵欄位定義
PRINT '1. 檢查當前主鍵欄位定義...'
SELECT 
    ds.name AS DataSetName,
    dsc.column_name AS ColumnName,
    dsc.data_type AS DataType,
    dsc.is_primary_key AS IsPrimaryKey,
    dsc.sort_order AS SortOrder
FROM data_sets ds
INNER JOIN data_set_columns dsc ON ds.id = dsc.data_set_id
WHERE ds.name LIKE '%TEST003%'
ORDER BY dsc.is_primary_key DESC, dsc.sort_order

-- 2. 更新 id 欄位為主鍵
PRINT '2. 更新 id 欄位為主鍵...'
UPDATE dsc
SET is_primary_key = 1
FROM data_set_columns dsc
INNER JOIN data_sets ds ON dsc.data_set_id = ds.id
WHERE ds.name LIKE '%TEST003%'
    AND dsc.column_name = 'id'

-- 3. 確認更新結果
PRINT '3. 確認更新結果...'
SELECT 
    ds.name AS DataSetName,
    dsc.column_name AS ColumnName,
    dsc.data_type AS DataType,
    dsc.is_primary_key AS IsPrimaryKey,
    dsc.sort_order AS SortOrder
FROM data_sets ds
INNER JOIN data_set_columns dsc ON ds.id = dsc.data_set_id
WHERE ds.name LIKE '%TEST003%'
ORDER BY dsc.is_primary_key DESC, dsc.sort_order

-- 4. 檢查現有記錄的主鍵值
PRINT '4. 檢查現有記錄的主鍵值...'
SELECT TOP 5
    dsr.id AS RecordId,
    dsr.primary_key_value AS StoredPrimaryKey,
    dsrv_id.numeric_value AS IdValue,
    dsrv_within.string_value AS WithinCodeValue
FROM data_sets ds
INNER JOIN data_set_records dsr ON ds.id = dsr.data_set_id
LEFT JOIN data_set_record_values dsrv_id ON dsr.id = dsrv_id.record_id AND dsrv_id.column_name = 'id'
LEFT JOIN data_set_record_values dsrv_within ON dsr.id = dsrv_within.record_id AND dsrv_within.column_name = 'within_code'
WHERE ds.name LIKE '%TEST003%'
ORDER BY dsr.created_at DESC

PRINT '=== 修復完成 ==='
PRINT '建議：'
PRINT '1. 重新執行同步，應該會看到複合主鍵檢測'
PRINT '2. 檢查日誌中的主鍵格式是否正確'
PRINT '3. 確認刪除檢測是否正常工作'
