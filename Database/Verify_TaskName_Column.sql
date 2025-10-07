-- 驗證 workflow_step_executions 表的結構
USE [PurpleRice_DB]
GO

-- 查看 workflow_step_executions 表的所有列
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    CHARACTER_MAXIMUM_LENGTH,
    IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'workflow_step_executions'
ORDER BY ORDINAL_POSITION;

-- 檢查 TaskName 列是否存在
IF EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'[dbo].[workflow_step_executions]') 
    AND name = 'TaskName'
)
BEGIN
    PRINT '✅ TaskName 列已存在';
END
ELSE
BEGIN
    PRINT '❌ TaskName 列不存在！請執行 Add_TaskName_To_WorkflowStepExecutions.sql';
END
GO

-- 查看最近的記錄，檢查 TaskName 字段的值
SELECT TOP 5
    Id,
    WorkflowExecutionId,
    StepIndex,
    StepType,
    TaskName,  -- 這個字段應該存在
    Status,
    StartedAt
FROM [dbo].[workflow_step_executions]
ORDER BY Id DESC;
GO

