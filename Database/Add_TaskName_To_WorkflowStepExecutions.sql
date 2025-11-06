-- 添加 TaskName 列到 workflow_step_executions 表
-- 用於存儲用戶自定義的任務名稱

USE [PurpleRice_DB]
GO

-- 檢查列是否已存在
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'[dbo].[workflow_step_executions]') 
    AND name = 'TaskName'
)
BEGIN
    -- 添加 TaskName 列
    ALTER TABLE [dbo].[workflow_step_executions]
    ADD [TaskName] NVARCHAR(500) NULL;
    
    PRINT 'TaskName 列已成功添加到 workflow_step_executions 表';
END
ELSE
BEGIN
    PRINT 'TaskName 列已存在於 workflow_step_executions 表，跳過添加';
END
GO

