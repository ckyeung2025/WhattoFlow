-- 診斷 SQL TEST003 數據問題
-- 檢查主鍵重複和數據分佈

PRINT '=== SQL TEST003 數據診斷 ==='

-- 1. 檢查 within_code 欄位的唯一性
PRINT '1. 檢查 within_code 欄位的唯一性...'
SELECT 
    'within_code' AS ColumnName,
    COUNT(*) AS TotalRows,
    COUNT(DISTINCT within_code) AS UniqueValues,
    COUNT(*) - COUNT(DISTINCT within_code) AS DuplicateCount
FROM [erp_awh].[dbo].[so_order_manage]

-- 2. 檢查 within_code 的值分佈
PRINT '2. 檢查 within_code 的值分佈...'
SELECT 
    within_code AS Value,
    COUNT(*) AS Count,
    MIN(id) AS MinId,
    MAX(id) AS MaxId
FROM [erp_awh].[dbo].[so_order_manage]
GROUP BY within_code
ORDER BY COUNT(*) DESC

-- 3. 檢查前 10 條記錄的詳細信息
PRINT '3. 檢查前 10 條記錄的詳細信息...'
SELECT TOP 10
    ROW_NUMBER() OVER (ORDER BY id) AS RowIndex,
    within_code,
    id,
    orderno,
    cname,
    LEN(within_code) AS KeyLength,
    CASE 
        WHEN within_code IS NULL THEN 'NULL'
        WHEN LTRIM(RTRIM(within_code)) = '' THEN 'EMPTY'
        WHEN LTRIM(RTRIM(within_code)) = '0000      ' THEN 'DEFAULT_VALUE'
        ELSE 'HAS_VALUE'
    END AS KeyStatus
FROM [erp_awh].[dbo].[so_order_manage]
ORDER BY id

-- 4. 檢查其他可能的主鍵候選欄位
PRINT '4. 檢查其他可能的主鍵候選欄位...'

-- 檢查 id 欄位
SELECT 
    'id' AS ColumnName,
    COUNT(*) AS TotalRows,
    COUNT(DISTINCT id) AS UniqueValues,
    COUNT(*) - COUNT(DISTINCT id) AS DuplicateCount
FROM [erp_awh].[dbo].[so_order_manage]

-- 檢查 orderno 欄位
SELECT 
    'orderno' AS ColumnName,
    COUNT(*) AS TotalRows,
    COUNT(DISTINCT orderno) AS UniqueValues,
    COUNT(*) - COUNT(DISTINCT orderno) AS DuplicateCount
FROM [erp_awh].[dbo].[so_order_manage]

-- 5. 檢查組合主鍵的可能性
PRINT '5. 檢查組合主鍵的可能性...'
SELECT 
    'within_code + id' AS CombinationKey,
    COUNT(*) AS TotalRows,
    COUNT(DISTINCT CONCAT(within_code, '_', id)) AS UniqueValues,
    COUNT(*) - COUNT(DISTINCT CONCAT(within_code, '_', id)) AS DuplicateCount
FROM [erp_awh].[dbo].[so_order_manage]

-- 6. 檢查 within_code 的實際值
PRINT '6. 檢查 within_code 的實際值...'
SELECT DISTINCT
    within_code AS ActualValue,
    LEN(within_code) AS Length,
    ASCII(SUBSTRING(within_code, 1, 1)) AS FirstCharASCII,
    ASCII(SUBSTRING(within_code, LEN(within_code), 1)) AS LastCharASCII
FROM [erp_awh].[dbo].[so_order_manage]
ORDER BY within_code

-- 7. 建議解決方案
PRINT '7. 建議解決方案:'
PRINT '   - 如果 within_code 確實應該有不同值，檢查數據源'
PRINT '   - 考慮使用 id 欄位作為主鍵（如果唯一）'
PRINT '   - 考慮使用組合主鍵（within_code + id）'
PRINT '   - 或者使用 ROW_NUMBER() 生成唯一標識'

PRINT '=== 診斷完成 ==='
