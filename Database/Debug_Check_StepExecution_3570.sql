-- ================================================================
-- 調試：檢查 stepExecutionId 3570 的消息發送記錄
-- ================================================================

USE [PurpleRice_DB]
GO

-- 查看步驟執行記錄
SELECT 
    Id,
    WorkflowExecutionId,
    StepIndex,
    StepType,
    TaskName,
    Status,
    IsWaiting,
    FORMAT(StartedAt, 'yyyy-MM-dd HH:mm:ss') AS StartedAt,
    FORMAT(EndedAt, 'yyyy-MM-dd HH:mm:ss') AS EndedAt
FROM [dbo].[workflow_step_executions]
WHERE Id = 3570;

PRINT '====================================';
PRINT '上面是步驟執行記錄';
PRINT '====================================';
GO

-- 查看該步驟是否有對應的消息發送記錄
SELECT 
    id,
    workflow_execution_id,
    workflow_step_execution_id,
    node_id,
    node_type,
    message_type,
    message_content,
    total_recipients,
    status,
    FORMAT(created_at, 'yyyy-MM-dd HH:mm:ss') AS created_at
FROM [dbo].[workflow_message_sends]
WHERE workflow_step_execution_id = 3570;

PRINT '====================================';
PRINT '上面是消息發送記錄（根據 workflow_step_execution_id）';
PRINT '====================================';
GO

-- 如果沒有找到，查看同一 execution 的所有消息發送記錄
DECLARE @executionId INT;

SELECT @executionId = WorkflowExecutionId
FROM [dbo].[workflow_step_executions]
WHERE Id = 3570;

SELECT 
    id,
    workflow_execution_id,
    workflow_step_execution_id,
    node_id,
    node_type,
    message_type,
    message_content,
    total_recipients,
    status,
    FORMAT(created_at, 'yyyy-MM-dd HH:mm:ss') AS created_at
FROM [dbo].[workflow_message_sends]
WHERE workflow_execution_id = @executionId
ORDER BY created_at;

PRINT '====================================';
PRINT '上面是同一 execution 的所有消息發送記錄';
PRINT '====================================';
GO

