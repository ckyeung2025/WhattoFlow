-- =====================================================
-- 修復現有數據集的主鍵配置
-- 創建日期: 2025-01-23
-- 描述: 將現有數據集的 row_number 欄位設置為主鍵
-- =====================================================

USE [PurpleRice];
GO

PRINT '--- 開始修復現有數據集的主鍵配置 ---';

-- =====================================================
-- 步驟 1: 檢查當前主鍵配置
-- =====================================================
PRINT '1. 檢查當前主鍵配置：';

SELECT 
    ds.name AS dataset_name,
    ds.data_source_type,
    dc.column_name,
    dc.is_primary_key,
    dc.display_name,
    dc.data_type
FROM data_sets ds
LEFT JOIN data_set_columns dc ON ds.id = dc.data_set_id
WHERE dc.column_name = 'row_number'
ORDER BY ds.name;
GO

-- =====================================================
-- 步驟 2: 更新 row_number 欄位為主鍵
-- =====================================================
PRINT '2. 更新 row_number 欄位為主鍵...';

UPDATE data_set_columns
SET is_primary_key = 1
WHERE column_name = 'row_number' 
  AND is_primary_key = 0;

-- 檢查更新結果
DECLARE @UpdatedCount INT;
SELECT @UpdatedCount = @@ROWCOUNT;
PRINT '已更新 ' + CAST(@UpdatedCount AS VARCHAR(10)) + ' 個 row_number 欄位為主鍵';
GO

-- =====================================================
-- 步驟 3: 檢查更新後的配置
-- =====================================================
PRINT '3. 檢查更新後的配置：';

SELECT 
    ds.name AS dataset_name,
    ds.data_source_type,
    dc.column_name,
    dc.is_primary_key,
    dc.display_name,
    dc.data_type,
    ds.total_records
FROM data_sets ds
LEFT JOIN data_set_columns dc ON ds.id = dc.data_set_id
WHERE dc.column_name = 'row_number'
ORDER BY ds.name;
GO

-- =====================================================
-- 步驟 4: 檢查沒有主鍵的數據集
-- =====================================================
PRINT '4. 檢查沒有主鍵的數據集：';

SELECT 
    ds.name AS dataset_name,
    ds.data_source_type,
    ds.total_records,
    COUNT(dc.id) AS column_count,
    SUM(CASE WHEN dc.is_primary_key = 1 THEN 1 ELSE 0 END) AS primary_key_count
FROM data_sets ds
LEFT JOIN data_set_columns dc ON ds.id = dc.data_set_id
GROUP BY ds.id, ds.name, ds.data_source_type, ds.total_records
HAVING SUM(CASE WHEN dc.is_primary_key = 1 THEN 1 ELSE 0 END) = 0
ORDER BY ds.name;
GO

-- =====================================================
-- 步驟 5: 為沒有主鍵的數據集創建 row_number 欄位
-- =====================================================
PRINT '5. 為沒有主鍵的數據集創建 row_number 欄位...';

-- 找出沒有主鍵的數據集
WITH DatasetsWithoutPK AS (
    SELECT 
        ds.id AS dataset_id,
        ds.name AS dataset_name,
        ds.data_source_type
    FROM data_sets ds
    LEFT JOIN data_set_columns dc ON ds.id = dc.data_set_id
    GROUP BY ds.id, ds.name, ds.data_source_type
    HAVING SUM(CASE WHEN dc.is_primary_key = 1 THEN 1 ELSE 0 END) = 0
)
INSERT INTO data_set_columns (
    id,
    data_set_id,
    column_name,
    display_name,
    data_type,
    max_length,
    is_required,
    is_primary_key,
    is_searchable,
    is_sortable,
    is_indexed,
    default_value,
    sort_order
)
SELECT 
    NEWID() AS id,
    dataset_id,
    'row_number' AS column_name,
    'Row Number' AS display_name,
    'int' AS data_type,
    NULL AS max_length,
    1 AS is_required,
    1 AS is_primary_key,
    0 AS is_searchable,
    1 AS is_sortable,
    1 AS is_indexed,
    NULL AS default_value,
    -1 AS sort_order
FROM DatasetsWithoutPK;

-- 檢查創建結果
DECLARE @CreatedCount INT;
SELECT @CreatedCount = @@ROWCOUNT;
PRINT '已為 ' + CAST(@CreatedCount AS VARCHAR(10)) + ' 個數據集創建 row_number 主鍵欄位';
GO

-- =====================================================
-- 步驟 6: 最終驗證
-- =====================================================
PRINT '6. 最終驗證：';

SELECT 
    ds.name AS dataset_name,
    ds.data_source_type,
    ds.total_records,
    COUNT(dc.id) AS total_columns,
    SUM(CASE WHEN dc.is_primary_key = 1 THEN 1 ELSE 0 END) AS primary_key_columns,
    STRING_AGG(
        CASE WHEN dc.is_primary_key = 1 THEN dc.column_name END, 
        ', '
    ) AS primary_key_names
FROM data_sets ds
LEFT JOIN data_set_columns dc ON ds.id = dc.data_set_id
GROUP BY ds.id, ds.name, ds.data_source_type, ds.total_records
ORDER BY ds.name;
GO

PRINT '--- 主鍵配置修復完成 ---';
PRINT '修復摘要：';
PRINT '- 已更新現有 row_number 欄位為主鍵';
PRINT '- 已為沒有主鍵的數據集創建 row_number 主鍵欄位';
PRINT '- 所有數據集現在都有主鍵配置';
PRINT '- 增量同步現在應該正常工作';
