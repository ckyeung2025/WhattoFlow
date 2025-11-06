-- ================================================================
-- 檢查 execution 2408 的完整消息發送記錄
-- ================================================================

USE [PurpleRice_DB]
GO

-- 查看 execution 2408 的基本信息
SELECT 
    Id,
    WorkflowDefinitionId,
    Status,
    CurrentStep,
    FORMAT(StartedAt, 'yyyy-MM-dd HH:mm:ss') AS StartedAt,
    FORMAT(EndedAt, 'yyyy-MM-dd HH:mm:ss') AS EndedAt
FROM [dbo].[workflow_executions]
WHERE Id = 2408;

PRINT '====================================';
PRINT '上面是 execution 2408 的基本信息';
PRINT '====================================';
GO

-- 查看 execution 2408 的所有消息發送記錄
SELECT 
    id,
    workflow_execution_id,
    workflow_step_execution_id,
    node_id,
    node_type,
    message_content,
    total_recipients,
    success_count,
    failed_count,
    status,
    FORMAT(created_at, 'yyyy-MM-dd HH:mm:ss') AS created_at
FROM [dbo].[workflow_message_sends]
WHERE workflow_execution_id = 2408
ORDER BY created_at;

PRINT '====================================';
PRINT '上面是 execution 2408 的所有消息發送記錄';
PRINT '====================================';
GO

-- 查看每個消息發送記錄的收件人明細
DECLARE @messageSendIds TABLE (id UNIQUEIDENTIFIER);

INSERT INTO @messageSendIds
SELECT id
FROM [dbo].[workflow_message_sends]
WHERE workflow_execution_id = 2408;

SELECT 
    mr.id AS recipient_id,
    mr.message_send_id,
    mr.recipient_name,
    mr.phone_number,
    mr.recipient_type,
    mr.status,
    mr.whatsapp_message_id,
    FORMAT(mr.created_at, 'yyyy-MM-dd HH:mm:ss') AS created_at,
    FORMAT(mr.updated_at, 'yyyy-MM-dd HH:mm:ss') AS updated_at,
    FORMAT(mr.sent_at, 'yyyy-MM-dd HH:mm:ss') AS sent_at
FROM [dbo].[workflow_message_recipients] mr
WHERE mr.message_send_id IN (SELECT id FROM @messageSendIds)
ORDER BY mr.created_at;

PRINT '====================================';
PRINT '上面是 execution 2408 的所有收件人記錄';
PRINT '====================================';
GO

