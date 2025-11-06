-- 更新 data_set_data_sources 表，移除 AutoUpdate 和 UpdateIntervalMinutes 欄位
-- 執行日期: 2025-01-22
-- 說明: 將自動更新設定統一到 DataSet 層級，移除 DataSource 層級的重複設定

USE PurpleRice;
GO

-- 檢查表結構
PRINT '檢查 data_set_data_sources 表當前結構...';
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'data_set_data_sources'
ORDER BY ORDINAL_POSITION;
GO

-- 檢查是否有數據依賴這些欄位
PRINT '檢查 AutoUpdate 欄位的數據分布...';
SELECT 
    AutoUpdate,
    COUNT(*) as Count
FROM data_set_data_sources 
GROUP BY AutoUpdate;
GO

PRINT '檢查 UpdateIntervalMinutes 欄位的數據分布...';
SELECT 
    UpdateIntervalMinutes,
    COUNT(*) as Count
FROM data_set_data_sources 
GROUP BY UpdateIntervalMinutes;
GO

-- 備份重要數據（如果需要）
PRINT '備份 AutoUpdate 設定到臨時表...';
IF OBJECT_ID('tempdb..#AutoUpdateBackup') IS NOT NULL
    DROP TABLE #AutoUpdateBackup;

SELECT 
    Id,
    DataSetId,
    AutoUpdate,
    UpdateIntervalMinutes,
    GETDATE() as BackupDate
INTO #AutoUpdateBackup
FROM data_set_data_sources 
WHERE AutoUpdate = 1 OR UpdateIntervalMinutes IS NOT NULL;
GO

-- 顯示備份的數據
PRINT '備份的數據:';
SELECT * FROM #AutoUpdateBackup;
GO

-- 移除 AutoUpdate 欄位
PRINT '移除 AutoUpdate 欄位...';
IF EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'data_set_data_sources' 
    AND COLUMN_NAME = 'AutoUpdate'
)
BEGIN
    ALTER TABLE data_set_data_sources DROP COLUMN AutoUpdate;
    PRINT 'AutoUpdate 欄位已移除';
END
ELSE
BEGIN
    PRINT 'AutoUpdate 欄位不存在，跳過移除';
END
GO

-- 移除 UpdateIntervalMinutes 欄位
PRINT '移除 UpdateIntervalMinutes 欄位...';
IF EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'data_set_data_sources' 
    AND COLUMN_NAME = 'UpdateIntervalMinutes'
)
BEGIN
    ALTER TABLE data_set_data_sources DROP COLUMN UpdateIntervalMinutes;
    PRINT 'UpdateIntervalMinutes 欄位已移除';
END
ELSE
BEGIN
    PRINT 'UpdateIntervalMinutes 欄位不存在，跳過移除';
END
GO

-- 檢查更新後的表結構
PRINT '檢查更新後的 data_set_data_sources 表結構...';
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'data_set_data_sources'
ORDER BY ORDINAL_POSITION;
GO

-- 驗證更新結果
PRINT '驗證更新結果...';
SELECT 
    COUNT(*) as TotalRecords,
    COUNT(LastUpdateTime) as RecordsWithLastUpdateTime
FROM data_set_data_sources;
GO

-- 清理臨時表
DROP TABLE #AutoUpdateBackup;
GO

PRINT 'data_set_data_sources 表更新完成！';
PRINT 'AutoUpdate 和 UpdateIntervalMinutes 欄位已移除';
PRINT '現在自動更新設定統一使用 DataSet 層級的 isScheduled 和 updateIntervalMinutes';
GO
