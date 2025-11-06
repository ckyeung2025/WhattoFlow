-- ================================================================
-- 檢查 waitReply 和 waitForQRCode 節點的收件人配置
-- ================================================================

USE [PurpleRice_DB]
GO

-- 查找 execution 2408 的工作流定義
DECLARE @workflowDefinitionId INT;

SELECT @workflowDefinitionId = WorkflowDefinitionId
FROM [dbo].[workflow_executions]
WHERE Id = 2408;

-- 顯示工作流定義
SELECT 
    Id,
    Name,
    Description,
    IsEnabled,
    ActivationType,
    FORMAT(CreatedAt, 'yyyy-MM-dd HH:mm:ss') AS CreatedAt
FROM [dbo].[WorkflowDefinitions]
WHERE Id = @workflowDefinitionId;

PRINT '====================================';
PRINT '工作流定義基本信息';
PRINT '====================================';
GO

-- 提取並顯示 waitReply 和 waitForQRCode 節點配置
DECLARE @workflowDefinitionId INT;
DECLARE @flowData NVARCHAR(MAX);

SELECT @workflowDefinitionId = WorkflowDefinitionId
FROM [dbo].[workflow_executions]
WHERE Id = 2408;

SELECT @flowData = FlowData
FROM [dbo].[WorkflowDefinitions]
WHERE Id = @workflowDefinitionId;

-- 顯示完整的 FlowData (包含所有節點配置)
PRINT '====================================';
PRINT 'FlowData (工作流程定義 JSON):';
PRINT '====================================';
PRINT @flowData;
GO

-- 說明：請在 FlowData JSON 中查找：
-- 1. "waitReply" 節點的 "replyType" 和 "recipientDetails"
-- 2. "waitForQRCode" 節點的 "replyType" 和 "recipientDetails"
-- 3. 檢查 "processVariables" 數組是否有值

