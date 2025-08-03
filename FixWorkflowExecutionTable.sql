-- 修復 workflow_executions 表格結構
-- 添加缺少的欄位並重命名現有欄位

-- 1. 添加 ErrorMessage 欄位
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[workflow_executions]') AND name = 'ErrorMessage')
BEGIN
    ALTER TABLE [dbo].[workflow_executions] ADD [ErrorMessage] NVARCHAR(MAX) NULL;
    PRINT '已添加 ErrorMessage 欄位';
END

-- 2. 重命名 InputJson 為 InputData
IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[workflow_executions]') AND name = 'InputJson')
    AND NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[workflow_executions]') AND name = 'InputData')
BEGIN
    EXEC sp_rename 'workflow_executions.InputJson', 'InputData', 'COLUMN';
    PRINT '已重命名 InputJson 為 InputData';
END

-- 3. 重命名 EndedAt 為 CompletedAt
IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[workflow_executions]') AND name = 'EndedAt')
    AND NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[workflow_executions]') AND name = 'CompletedAt')
BEGIN
    EXEC sp_rename 'workflow_executions.EndedAt', 'CompletedAt', 'COLUMN';
    PRINT '已重命名 EndedAt 為 CompletedAt';
END

-- 4. 驗證表格結構
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'workflow_executions' 
ORDER BY ORDINAL_POSITION;

PRINT 'workflow_executions 表格結構修復完成'; 