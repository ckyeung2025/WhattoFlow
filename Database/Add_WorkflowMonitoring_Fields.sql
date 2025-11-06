-- =============================================
-- 工作流程監控功能 - 數據表欄位擴展
-- 支援 Time Validator（重試機制）和 Overdue（逾期通知）
-- =============================================

USE [PurpleRice];
GO

PRINT '=== 開始擴展工作流程監控相關欄位 ===';
GO

-- =============================================
-- 1. 擴展 workflow_step_executions 表
--    用於 Wait for Reply 節點的 Time Validator 重試機制
-- =============================================

PRINT '1. 擴展 workflow_step_executions 表...';
GO

-- 檢查欄位是否已存在，避免重複添加
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[workflow_step_executions]') AND name = 'last_retry_at')
BEGIN
    ALTER TABLE [dbo].[workflow_step_executions] ADD
        [last_retry_at] DATETIME2 NULL;
    PRINT '  ✓ 添加欄位: last_retry_at (上次重試時間)';
END
ELSE
    PRINT '  - 欄位已存在: last_retry_at';
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[workflow_step_executions]') AND name = 'retry_count')
BEGIN
    ALTER TABLE [dbo].[workflow_step_executions] ADD
        [retry_count] INT NOT NULL DEFAULT 0;
    PRINT '  ✓ 添加欄位: retry_count (已重試次數)';
END
ELSE
    PRINT '  - 欄位已存在: retry_count';
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[workflow_step_executions]') AND name = 'escalation_sent')
BEGIN
    ALTER TABLE [dbo].[workflow_step_executions] ADD
        [escalation_sent] BIT NOT NULL DEFAULT 0;
    PRINT '  ✓ 添加欄位: escalation_sent (是否已發送升級通知)';
END
ELSE
    PRINT '  - 欄位已存在: escalation_sent';
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[workflow_step_executions]') AND name = 'escalation_sent_at')
BEGIN
    ALTER TABLE [dbo].[workflow_step_executions] ADD
        [escalation_sent_at] DATETIME2 NULL;
    PRINT '  ✓ 添加欄位: escalation_sent_at (升級通知發送時間)';
END
ELSE
    PRINT '  - 欄位已存在: escalation_sent_at';
GO

-- 添加索引以提高查詢效能
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_workflow_step_executions_waiting_retry' AND object_id = OBJECT_ID(N'[dbo].[workflow_step_executions]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_workflow_step_executions_waiting_retry]
        ON [dbo].[workflow_step_executions] ([IsWaiting], [Status], [last_retry_at])
        INCLUDE ([retry_count], [escalation_sent]);
    PRINT '  ✓ 創建索引: IX_workflow_step_executions_waiting_retry';
END
ELSE
    PRINT '  - 索引已存在: IX_workflow_step_executions_waiting_retry';
GO

-- =============================================
-- 2. 擴展 workflow_executions 表
--    用於 Start 節點的 Overdue 逾期監控
-- =============================================

PRINT '';
PRINT '2. 擴展 workflow_executions 表...';
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[workflow_executions]') AND name = 'overdue_notified')
BEGIN
    ALTER TABLE [dbo].[workflow_executions] ADD
        [overdue_notified] BIT NOT NULL DEFAULT 0;
    PRINT '  ✓ 添加欄位: overdue_notified (是否已發送逾期通知)';
END
ELSE
    PRINT '  - 欄位已存在: overdue_notified';
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[workflow_executions]') AND name = 'overdue_notified_at')
BEGIN
    ALTER TABLE [dbo].[workflow_executions] ADD
        [overdue_notified_at] DATETIME2 NULL;
    PRINT '  ✓ 添加欄位: overdue_notified_at (逾期通知發送時間)';
END
ELSE
    PRINT '  - 欄位已存在: overdue_notified_at';
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[workflow_executions]') AND name = 'overdue_threshold_minutes')
BEGIN
    ALTER TABLE [dbo].[workflow_executions] ADD
        [overdue_threshold_minutes] INT NULL;
    PRINT '  ✓ 添加欄位: overdue_threshold_minutes (逾期閾值-分鐘)';
END
ELSE
    PRINT '  - 欄位已存在: overdue_threshold_minutes';
GO

-- 添加索引以提高查詢效能
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_workflow_executions_overdue' AND object_id = OBJECT_ID(N'[dbo].[workflow_executions]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_workflow_executions_overdue]
        ON [dbo].[workflow_executions] ([Status], [overdue_notified], [StartedAt])
        INCLUDE ([overdue_threshold_minutes]);
    PRINT '  ✓ 創建索引: IX_workflow_executions_overdue';
END
ELSE
    PRINT '  - 索引已存在: IX_workflow_executions_overdue';
GO

-- =============================================
-- 3. 擴展 workflow_message_sends 表
--    用於區分訊息發送原因和追蹤來源
-- =============================================

PRINT '';
PRINT '3. 擴展 workflow_message_sends 表...';
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[workflow_message_sends]') AND name = 'send_reason')
BEGIN
    ALTER TABLE [dbo].[workflow_message_sends] ADD
        [send_reason] NVARCHAR(50) NOT NULL DEFAULT 'normal';
    PRINT '  ✓ 添加欄位: send_reason (發送原因)';
END
ELSE
    PRINT '  - 欄位已存在: send_reason';
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[workflow_message_sends]') AND name = 'related_step_execution_id')
BEGIN
    ALTER TABLE [dbo].[workflow_message_sends] ADD
        [related_step_execution_id] INT NULL;
    PRINT '  ✓ 添加欄位: related_step_execution_id (關聯的步驟執行ID)';
END
ELSE
    PRINT '  - 欄位已存在: related_step_execution_id';
GO

-- 添加約束檢查 send_reason 的有效值
IF NOT EXISTS (SELECT * FROM sys.check_constraints WHERE name = 'CK_workflow_message_sends_send_reason' AND parent_object_id = OBJECT_ID(N'[dbo].[workflow_message_sends]'))
BEGIN
    ALTER TABLE [dbo].[workflow_message_sends]
        ADD CONSTRAINT [CK_workflow_message_sends_send_reason]
        CHECK ([send_reason] IN ('normal', 'retry', 'escalation', 'overdue'));
    PRINT '  ✓ 添加約束: CK_workflow_message_sends_send_reason';
END
ELSE
    PRINT '  - 約束已存在: CK_workflow_message_sends_send_reason';
GO

-- 添加索引以提高查詢效能
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_workflow_message_sends_send_reason' AND object_id = OBJECT_ID(N'[dbo].[workflow_message_sends]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_workflow_message_sends_send_reason]
        ON [dbo].[workflow_message_sends] ([send_reason], [created_at] DESC);
    PRINT '  ✓ 創建索引: IX_workflow_message_sends_send_reason';
END
ELSE
    PRINT '  - 索引已存在: IX_workflow_message_sends_send_reason';
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_workflow_message_sends_related_step' AND object_id = OBJECT_ID(N'[dbo].[workflow_message_sends]'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_workflow_message_sends_related_step]
        ON [dbo].[workflow_message_sends] ([related_step_execution_id])
        WHERE [related_step_execution_id] IS NOT NULL;
    PRINT '  ✓ 創建索引: IX_workflow_message_sends_related_step';
END
ELSE
    PRINT '  - 索引已存在: IX_workflow_message_sends_related_step';
GO

-- =============================================
-- 4. 創建監控查詢視圖（方便統計和查詢）
-- =============================================

PRINT '';
PRINT '4. 創建監控查詢視圖...';
GO

-- 重試監控視圖
IF EXISTS (SELECT * FROM sys.views WHERE name = 'v_workflow_retry_monitoring')
    DROP VIEW [dbo].[v_workflow_retry_monitoring];
GO

CREATE VIEW [dbo].[v_workflow_retry_monitoring] AS
SELECT 
    wse.[Id] AS StepExecutionId,
    wse.[WorkflowExecutionId],
    wse.[StepIndex],
    wse.[TaskName],
    wse.[Status],
    wse.[IsWaiting],
    wse.[StartedAt],
    wse.[last_retry_at] AS LastRetryAt,
    wse.[retry_count] AS RetryCount,
    wse.[escalation_sent] AS EscalationSent,
    wse.[escalation_sent_at] AS EscalationSentAt,
    wse.[ValidationConfig],
    we.[WorkflowDefinitionId],
    we.[InitiatedBy],
    wd.[Name] AS WorkflowName,
    DATEDIFF(MINUTE, ISNULL(wse.[last_retry_at], wse.[StartedAt]), GETUTCDATE()) AS MinutesSinceLastActivity
FROM [dbo].[workflow_step_executions] wse
INNER JOIN [dbo].[workflow_executions] we ON wse.[WorkflowExecutionId] = we.[Id]
INNER JOIN [dbo].[WorkflowDefinitions] wd ON we.[WorkflowDefinitionId] = wd.[Id]
WHERE wse.[IsWaiting] = 1 
  AND wse.[Status] = 'WaitingForReply'
  AND wse.[ValidationConfig] IS NOT NULL;
GO

PRINT '  ✓ 創建視圖: v_workflow_retry_monitoring';
GO

-- 逾期監控視圖
IF EXISTS (SELECT * FROM sys.views WHERE name = 'v_workflow_overdue_monitoring')
    DROP VIEW [dbo].[v_workflow_overdue_monitoring];
GO

CREATE VIEW [dbo].[v_workflow_overdue_monitoring] AS
SELECT 
    we.[Id] AS WorkflowExecutionId,
    we.[WorkflowDefinitionId],
    we.[Status],
    we.[StartedAt],
    we.[overdue_notified] AS OverdueNotified,
    we.[overdue_notified_at] AS OverdueNotifiedAt,
    we.[overdue_threshold_minutes] AS OverdueThresholdMinutes,
    we.[InitiatedBy],
    wd.[Name] AS WorkflowName,
    wd.[Json] AS NodesJson,
    DATEDIFF(MINUTE, we.[StartedAt], GETUTCDATE()) AS MinutesSinceStart,
    CASE 
        WHEN we.[overdue_threshold_minutes] IS NOT NULL 
        THEN DATEDIFF(MINUTE, we.[StartedAt], GETUTCDATE()) - we.[overdue_threshold_minutes]
        ELSE NULL
    END AS MinutesOverdue
FROM [dbo].[workflow_executions] we
INNER JOIN [dbo].[WorkflowDefinitions] wd ON we.[WorkflowDefinitionId] = wd.[Id]
WHERE we.[Status] = 'Running'
  AND we.[overdue_notified] = 0;
GO

PRINT '  ✓ 創建視圖: v_workflow_overdue_monitoring';
GO

-- =============================================
-- 5. 創建輔助存儲過程
-- =============================================

PRINT '';
PRINT '5. 創建輔助存儲過程...';
GO

-- 更新步驟重試信息
IF EXISTS (SELECT * FROM sys.objects WHERE type = 'P' AND name = 'sp_update_step_retry_info')
    DROP PROCEDURE [dbo].[sp_update_step_retry_info];
GO

CREATE PROCEDURE [dbo].[sp_update_step_retry_info]
    @step_execution_id INT,
    @increment_retry_count BIT = 1,
    @mark_escalation_sent BIT = 0
AS
BEGIN
    SET NOCOUNT ON;
    
    IF @increment_retry_count = 1
    BEGIN
        UPDATE [dbo].[workflow_step_executions]
        SET 
            [retry_count] = [retry_count] + 1,
            [last_retry_at] = GETUTCDATE()
        WHERE [Id] = @step_execution_id;
        
        PRINT '重試計數已更新';
    END
    
    IF @mark_escalation_sent = 1
    BEGIN
        UPDATE [dbo].[workflow_step_executions]
        SET 
            [escalation_sent] = 1,
            [escalation_sent_at] = GETUTCDATE()
        WHERE [Id] = @step_execution_id;
        
        PRINT '升級通知已標記';
    END
END;
GO

PRINT '  ✓ 創建存儲過程: sp_update_step_retry_info';
GO

-- 更新工作流逾期信息
IF EXISTS (SELECT * FROM sys.objects WHERE type = 'P' AND name = 'sp_update_workflow_overdue_info')
    DROP PROCEDURE [dbo].[sp_update_workflow_overdue_info];
GO

CREATE PROCEDURE [dbo].[sp_update_workflow_overdue_info]
    @workflow_execution_id INT,
    @overdue_threshold_minutes INT
AS
BEGIN
    SET NOCOUNT ON;
    
    UPDATE [dbo].[workflow_executions]
    SET 
        [overdue_notified] = 1,
        [overdue_notified_at] = GETUTCDATE(),
        [overdue_threshold_minutes] = @overdue_threshold_minutes
    WHERE [Id] = @workflow_execution_id;
    
    PRINT '逾期通知已標記';
END;
GO

PRINT '  ✓ 創建存儲過程: sp_update_workflow_overdue_info';
GO

-- =============================================
-- 6. 數據驗證查詢
-- =============================================

PRINT '';
PRINT '=== 數據驗證 ===';
GO

-- 檢查 workflow_step_executions 表結構
PRINT '';
PRINT 'workflow_step_executions 新增欄位：';
SELECT 
    COLUMN_NAME AS '欄位名稱',
    DATA_TYPE AS '數據類型',
    IS_NULLABLE AS '可為空',
    COLUMN_DEFAULT AS '默認值'
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'workflow_step_executions'
  AND COLUMN_NAME IN ('last_retry_at', 'retry_count', 'escalation_sent', 'escalation_sent_at')
ORDER BY ORDINAL_POSITION;
GO

-- 檢查 workflow_executions 表結構
PRINT '';
PRINT 'workflow_executions 新增欄位：';
SELECT 
    COLUMN_NAME AS '欄位名稱',
    DATA_TYPE AS '數據類型',
    IS_NULLABLE AS '可為空',
    COLUMN_DEFAULT AS '默認值'
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'workflow_executions'
  AND COLUMN_NAME IN ('overdue_notified', 'overdue_notified_at', 'overdue_threshold_minutes')
ORDER BY ORDINAL_POSITION;
GO

-- 檢查 workflow_message_sends 表結構
PRINT '';
PRINT 'workflow_message_sends 新增欄位：';
SELECT 
    COLUMN_NAME AS '欄位名稱',
    DATA_TYPE AS '數據類型',
    IS_NULLABLE AS '可為空',
    COLUMN_DEFAULT AS '默認值'
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'workflow_message_sends'
  AND COLUMN_NAME IN ('send_reason', 'related_step_execution_id')
ORDER BY ORDINAL_POSITION;
GO

-- 統計現有數據
PRINT '';
PRINT '=== 現有數據統計 ===';
GO

SELECT 
    COUNT(*) AS '等待中的步驟總數',
    SUM(CASE WHEN [retry_count] > 0 THEN 1 ELSE 0 END) AS '已重試過的步驟',
    SUM(CASE WHEN [escalation_sent] = 1 THEN 1 ELSE 0 END) AS '已發送升級通知的步驟'
FROM [dbo].[workflow_step_executions]
WHERE [IsWaiting] = 1;
GO

SELECT 
    COUNT(*) AS '運行中的流程總數',
    SUM(CASE WHEN [overdue_notified] = 1 THEN 1 ELSE 0 END) AS '已發送逾期通知的流程'
FROM [dbo].[workflow_executions]
WHERE [Status] = 'Running';
GO

-- =============================================
-- 完成
-- =============================================

PRINT '';
PRINT '=== 數據表擴展完成！===';
PRINT '';
PRINT '已擴展的表：';
PRINT '  1. workflow_step_executions - 添加 4 個欄位（重試機制）';
PRINT '  2. workflow_executions - 添加 3 個欄位（逾期監控）';
PRINT '  3. workflow_message_sends - 添加 2 個欄位（發送追蹤）';
PRINT '';
PRINT '已創建的索引：';
PRINT '  1. IX_workflow_step_executions_waiting_retry';
PRINT '  2. IX_workflow_executions_overdue';
PRINT '  3. IX_workflow_message_sends_send_reason';
PRINT '  4. IX_workflow_message_sends_related_step';
PRINT '';
PRINT '已創建的視圖：';
PRINT '  1. v_workflow_retry_monitoring - 重試監控視圖';
PRINT '  2. v_workflow_overdue_monitoring - 逾期監控視圖';
PRINT '';
PRINT '已創建的存儲過程：';
PRINT '  1. sp_update_step_retry_info - 更新步驟重試信息';
PRINT '  2. sp_update_workflow_overdue_info - 更新流程逾期信息';
PRINT '';
PRINT '✅ 所有擴展已完成！可以開始開發 Scheduler Service。';
GO

