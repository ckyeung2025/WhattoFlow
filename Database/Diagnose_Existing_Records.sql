-- 診斷現有記錄的主鍵格式
-- 檢查 data_set_records 表中的主鍵值

PRINT '=== 現有記錄主鍵診斷 ==='

-- 1. 檢查 data_set_records 表的記錄數
PRINT '1. 檢查 data_set_records 表的記錄數...'
SELECT 
    ds.name AS DataSetName,
    COUNT(dsr.id) AS RecordCount
FROM data_sets ds
LEFT JOIN data_set_records dsr ON ds.id = dsr.data_set_id
WHERE ds.name LIKE '%TEST003%'
GROUP BY ds.id, ds.name

-- 2. 檢查 data_set_records 表的主鍵值格式
PRINT '2. 檢查 data_set_records 表的主鍵值格式...'
SELECT TOP 10
    dsr.id AS RecordId,
    dsr.primary_key_value AS PrimaryKeyValue,
    LEN(dsr.primary_key_value) AS KeyLength,
    dsr.created_at AS CreatedAt
FROM data_sets ds
INNER JOIN data_set_records dsr ON ds.id = dsr.data_set_id
WHERE ds.name LIKE '%TEST003%'
ORDER BY dsr.created_at DESC

-- 3. 檢查 data_set_record_values 表中的主鍵欄位值
PRINT '3. 檢查 data_set_record_values 表中的主鍵欄位值...'
SELECT TOP 10
    dsr.id AS RecordId,
    dsr.primary_key_value AS StoredPrimaryKey,
    dsrv_within.column_name AS WithinCodeColumn,
    dsrv_within.string_value AS WithinCodeValue,
    dsrv_id.column_name AS IdColumn,
    dsrv_id.string_value AS IdValue,
    dsrv_id.numeric_value AS IdNumericValue
FROM data_sets ds
INNER JOIN data_set_records dsr ON ds.id = dsr.data_set_id
LEFT JOIN data_set_record_values dsrv_within ON dsr.id = dsrv_within.record_id AND dsrv_within.column_name = 'within_code'
LEFT JOIN data_set_record_values dsrv_id ON dsr.id = dsrv_id.record_id AND dsrv_id.column_name = 'id'
WHERE ds.name LIKE '%TEST003%'
ORDER BY dsr.created_at DESC

-- 4. 檢查主鍵欄位定義
PRINT '4. 檢查主鍵欄位定義...'
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

-- 5. 檢查複合主鍵的構建
PRINT '5. 檢查複合主鍵的構建...'
SELECT TOP 5
    dsr.id AS RecordId,
    dsrv_within.string_value AS WithinCode,
    dsrv_id.numeric_value AS IdValue,
    CONCAT('within_code:', dsrv_within.string_value, '|id:', dsrv_id.numeric_value) AS CompositeKey
FROM data_sets ds
INNER JOIN data_set_records dsr ON ds.id = dsr.data_set_id
LEFT JOIN data_set_record_values dsrv_within ON dsr.id = dsrv_within.record_id AND dsrv_within.column_name = 'within_code'
LEFT JOIN data_set_record_values dsrv_id ON dsr.id = dsrv_id.record_id AND dsrv_id.column_name = 'id'
WHERE ds.name LIKE '%TEST003%'
ORDER BY dsr.created_at DESC

-- 6. 提供建議
PRINT '6. 建議:'
PRINT '   - 檢查 primary_key_value 欄位是否包含複合主鍵'
PRINT '   - 檢查 data_set_record_values 表中的主鍵欄位值'
PRINT '   - 確認複合主鍵的構建格式是否一致'

PRINT '=== 診斷完成 ==='
