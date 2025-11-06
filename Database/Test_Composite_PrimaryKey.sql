-- 測試複合主鍵處理
-- 驗證 within_code + id 的組合唯一性

PRINT '=== 複合主鍵測試 ==='

-- 1. 檢查複合主鍵的唯一性
PRINT '1. 檢查複合主鍵 (within_code + id) 的唯一性...'
SELECT 
    'within_code + id' AS CompositeKey,
    COUNT(*) AS TotalRows,
    COUNT(DISTINCT CONCAT(within_code, '|', id)) AS UniqueValues,
    COUNT(*) - COUNT(DISTINCT CONCAT(within_code, '|', id)) AS DuplicateCount
FROM [erp_awh].[dbo].[so_order_manage]

-- 2. 檢查複合主鍵的值分佈
PRINT '2. 檢查複合主鍵的值分佈...'
SELECT TOP 10
    CONCAT(within_code, '|', id) AS CompositeKey,
    within_code,
    id,
    COUNT(*) AS Count
FROM [erp_awh].[dbo].[so_order_manage]
GROUP BY within_code, id
ORDER BY COUNT(*) DESC

-- 3. 檢查前 10 條記錄的複合主鍵
PRINT '3. 檢查前 10 條記錄的複合主鍵...'
SELECT TOP 10
    ROW_NUMBER() OVER (ORDER BY id) AS RowIndex,
    within_code,
    id,
    CONCAT(within_code, '|', id) AS CompositeKey,
    cname,
    orderno
FROM [erp_awh].[dbo].[so_order_manage]
ORDER BY id

-- 4. 檢查 within_code 的值分佈
PRINT '4. 檢查 within_code 的值分佈...'
SELECT 
    within_code,
    COUNT(*) AS Count,
    MIN(id) AS MinId,
    MAX(id) AS MaxId,
    COUNT(DISTINCT id) AS UniqueIds
FROM [erp_awh].[dbo].[so_order_manage]
GROUP BY within_code
ORDER BY COUNT(*) DESC

-- 5. 檢查 id 欄位的唯一性
PRINT '5. 檢查 id 欄位的唯一性...'
SELECT 
    'id' AS ColumnName,
    COUNT(*) AS TotalRows,
    COUNT(DISTINCT id) AS UniqueValues,
    COUNT(*) - COUNT(DISTINCT id) AS DuplicateCount
FROM [erp_awh].[dbo].[so_order_manage]

-- 6. 檢查重複的複合主鍵（如果有的話）
PRINT '6. 檢查重複的複合主鍵...'
SELECT 
    CONCAT(within_code, '|', id) AS CompositeKey,
    COUNT(*) AS DuplicateCount
FROM [erp_awh].[dbo].[so_order_manage]
GROUP BY within_code, id
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC

-- 7. 提供建議
PRINT '7. 建議:'
PRINT '   - 如果複合主鍵 (within_code + id) 是唯一的，應該能正確處理 500 條記錄'
PRINT '   - 如果 within_code 相同但 id 不同，每條記錄都會有唯一標識'
PRINT '   - 現在應該能正確檢測到需要刪除的記錄'

PRINT '=== 測試完成 ==='
