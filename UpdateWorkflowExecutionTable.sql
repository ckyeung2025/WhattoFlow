-- 更新 workflow_executions 表格欄位名稱
-- 將 InputData 重命名為 InputJson
-- 將 CompletedAt 重命名為 EndedAt

-- 檢查並重命名 InputData 欄位
IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[workflow_executions]') AND name = 'InputData')
AND NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[workflow_executions]') AND name = 'InputJson')
BEGIN
    EXEC sp_rename 'workflow_executions.InputData', 'InputJson', 'COLUMN';
    PRINT 'InputData 欄位已重命名為 InputJson';
END
ELSE
BEGIN
    PRINT 'InputData 欄位重命名跳過（可能已經重命名或不存在）';
END

-- 檢查並重命名 CompletedAt 欄位
IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[workflow_executions]') AND name = 'CompletedAt')
AND NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[workflow_executions]') AND name = 'EndedAt')
BEGIN
    EXEC sp_rename 'workflow_executions.CompletedAt', 'EndedAt', 'COLUMN';
    PRINT 'CompletedAt 欄位已重命名為 EndedAt';
END
ELSE
BEGIN
    PRINT 'CompletedAt 欄位重命名跳過（可能已經重命名或不存在）';
END

-- 顯示更新後的表格結構
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'workflow_executions'
ORDER BY ORDINAL_POSITION;

PRINT 'workflow_executions 表格欄位名稱更新完成'; 