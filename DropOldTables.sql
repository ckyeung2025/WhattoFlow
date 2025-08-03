-- 刪除舊的 WorkflowExecutions 和 WorkflowStepExecutions 表（如果存在）
-- 注意：這會刪除所有相關數據，請確保已備份重要數據

-- 先刪除外鍵約束（如果存在）
IF EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_WorkflowStepExecutions_WorkflowExecutions')
BEGIN
    ALTER TABLE [dbo].[WorkflowStepExecutions] DROP CONSTRAINT [FK_WorkflowStepExecutions_WorkflowExecutions]
END

IF EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_WorkflowExecutions_WorkflowDefinitions')
BEGIN
    ALTER TABLE [dbo].[WorkflowExecutions] DROP CONSTRAINT [FK_WorkflowExecutions_WorkflowDefinitions]
END

-- 刪除舊的 WorkflowStepExecutions 表（如果存在）
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'WorkflowStepExecutions' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    DROP TABLE [dbo].[WorkflowStepExecutions]
    PRINT '已刪除舊的 WorkflowStepExecutions 表'
END
ELSE
BEGIN
    PRINT 'WorkflowStepExecutions 表不存在'
END

-- 刪除舊的 WorkflowExecutions 表（如果存在）
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'WorkflowExecutions' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    DROP TABLE [dbo].[WorkflowExecutions]
    PRINT '已刪除舊的 WorkflowExecutions 表'
END
ELSE
BEGIN
    PRINT 'WorkflowExecutions 表不存在'
END

-- 檢查新表是否已創建
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'workflow_executions' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    PRINT '新的 workflow_executions 表已存在'
END
ELSE
BEGIN
    PRINT '警告：新的 workflow_executions 表不存在'
END

IF EXISTS (SELECT * FROM sys.tables WHERE name = 'workflow_step_executions' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    PRINT '新的 workflow_step_executions 表已存在'
END
ELSE
BEGIN
    PRINT '警告：新的 workflow_step_executions 表不存在'
END