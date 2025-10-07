-- =============================================
-- 工作流程消息發送記錄表
-- 用於記錄所有消息發送的成功/失敗情況
-- =============================================

-- 刪除已存在的表（如果存在）
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'workflow_message_recipients')
    DROP TABLE [dbo].[workflow_message_recipients];
GO
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'workflow_message_sends')
    DROP TABLE [dbo].[workflow_message_sends];
GO

-- 1. 工作流程消息發送主表
CREATE TABLE [dbo].[workflow_message_sends] (
    [id] UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
    [workflow_execution_id] INT NOT NULL,
    [workflow_step_execution_id] INT NULL,
    [node_id] NVARCHAR(50) NOT NULL,
    [node_type] NVARCHAR(50) NOT NULL,
    [message_content] NVARCHAR(MAX) NULL,
    [template_id] NVARCHAR(50) NULL,
    [template_name] NVARCHAR(100) NULL,
    [message_type] NVARCHAR(20) NOT NULL DEFAULT 'text',
    [total_recipients] INT NOT NULL DEFAULT 0,
    [success_count] INT NOT NULL DEFAULT 0,
    [failed_count] INT NOT NULL DEFAULT 0,
    [status] NVARCHAR(20) NOT NULL DEFAULT 'Pending',
    [started_at] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    [completed_at] DATETIME2 NULL,
    [error_message] NVARCHAR(MAX) NULL,
    [company_id] UNIQUEIDENTIFIER NOT NULL,
    [created_by] NVARCHAR(50) NOT NULL,
    [created_at] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    [updated_at] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    [is_active] BIT NOT NULL DEFAULT 1,
    
    CONSTRAINT [PK_workflow_message_sends] PRIMARY KEY CLUSTERED ([id] ASC),
    CONSTRAINT [FK_workflow_message_sends_workflow_executions] 
        FOREIGN KEY ([workflow_execution_id]) 
        REFERENCES [workflow_executions]([Id]) 
        ON DELETE CASCADE,
    CONSTRAINT [FK_workflow_message_sends_companies] 
        FOREIGN KEY ([company_id]) 
        REFERENCES [Companies]([Id]) 
        ON DELETE CASCADE,
    CONSTRAINT [CK_workflow_message_sends_status] 
        CHECK ([status] IN ('Pending', 'InProgress', 'Completed', 'Failed', 'PartiallyFailed')),
    CONSTRAINT [CK_workflow_message_sends_counts] 
        CHECK ([total_recipients] >= 0 AND [success_count] >= 0 AND [failed_count] >= 0)
);

-- 2. 工作流程消息收件人明細表
CREATE TABLE [dbo].[workflow_message_recipients] (
    [id] UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
    [message_send_id] UNIQUEIDENTIFIER NOT NULL,
    [phone_number] NVARCHAR(20) NOT NULL,
    [recipient_type] NVARCHAR(20) NOT NULL,
    [recipient_id] UNIQUEIDENTIFIER NULL,
    [recipient_name] NVARCHAR(100) NULL,
    [status] NVARCHAR(20) NOT NULL DEFAULT 'Pending',
    [whatsapp_message_id] NVARCHAR(100) NULL,
    [sent_at] DATETIME2 NULL,
    [delivered_at] DATETIME2 NULL,
    [read_at] DATETIME2 NULL,
    [failed_at] DATETIME2 NULL,
    [error_code] NVARCHAR(50) NULL,
    [error_message] NVARCHAR(MAX) NULL,
    [retry_count] INT NOT NULL DEFAULT 0,
    [max_retries] INT NOT NULL DEFAULT 3,
    [company_id] UNIQUEIDENTIFIER NOT NULL,
    [created_by] NVARCHAR(50) NOT NULL,
    [created_at] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    [updated_at] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    [is_active] BIT NOT NULL DEFAULT 1,
    
    CONSTRAINT [PK_workflow_message_recipients] PRIMARY KEY CLUSTERED ([id] ASC),
    CONSTRAINT [FK_workflow_message_recipients_message_sends] 
        FOREIGN KEY ([message_send_id]) 
        REFERENCES [workflow_message_sends]([id]) 
        ON DELETE CASCADE,
    CONSTRAINT [FK_workflow_message_recipients_companies] 
        FOREIGN KEY ([company_id]) 
        REFERENCES [Companies]([Id]) 
        ON DELETE NO ACTION,
    CONSTRAINT [CK_workflow_message_recipients_status] 
        CHECK ([status] IN ('Pending', 'Sent', 'Delivered', 'Read', 'Failed', 'Retrying')),
    CONSTRAINT [CK_workflow_message_recipients_type] 
        CHECK ([recipient_type] IN ('User', 'Contact', 'Group', 'Hashtag', 'Initiator', 'PhoneNumber')),
    CONSTRAINT [CK_workflow_message_recipients_retry] 
        CHECK ([retry_count] >= 0 AND [max_retries] >= 0)
);

-- =============================================
-- 索引
-- =============================================

-- 主表索引
CREATE NONCLUSTERED INDEX [IX_workflow_message_sends_workflow_execution_id] 
    ON [dbo].[workflow_message_sends] ([workflow_execution_id] ASC);

CREATE NONCLUSTERED INDEX [IX_workflow_message_sends_company_id] 
    ON [dbo].[workflow_message_sends] ([company_id] ASC);

CREATE NONCLUSTERED INDEX [IX_workflow_message_sends_status] 
    ON [dbo].[workflow_message_sends] ([status] ASC);

CREATE NONCLUSTERED INDEX [IX_workflow_message_sends_started_at] 
    ON [dbo].[workflow_message_sends] ([started_at] DESC);

CREATE NONCLUSTERED INDEX [IX_workflow_message_sends_node_type] 
    ON [dbo].[workflow_message_sends] ([node_type] ASC);

-- 明細表索引
CREATE NONCLUSTERED INDEX [IX_workflow_message_recipients_message_send_id] 
    ON [dbo].[workflow_message_recipients] ([message_send_id] ASC);

CREATE NONCLUSTERED INDEX [IX_workflow_message_recipients_phone_number] 
    ON [dbo].[workflow_message_recipients] ([phone_number] ASC);

CREATE NONCLUSTERED INDEX [IX_workflow_message_recipients_status] 
    ON [dbo].[workflow_message_recipients] ([status] ASC);

CREATE NONCLUSTERED INDEX [IX_workflow_message_recipients_company_id] 
    ON [dbo].[workflow_message_recipients] ([company_id] ASC);

CREATE NONCLUSTERED INDEX [IX_workflow_message_recipients_whatsapp_message_id] 
    ON [dbo].[workflow_message_recipients] ([whatsapp_message_id] ASC);

-- =============================================
-- 觸發器
-- =============================================

-- 刪除已存在的觸發器
GO
IF EXISTS (SELECT * FROM sys.triggers WHERE name = 'TR_workflow_message_sends_updated_at')
    DROP TRIGGER [TR_workflow_message_sends_updated_at];
GO
IF EXISTS (SELECT * FROM sys.triggers WHERE name = 'TR_workflow_message_recipients_updated_at')
    DROP TRIGGER [TR_workflow_message_recipients_updated_at];
GO

-- 觸發器已移除，UpdatedAt 字段由應用程序手動設置

-- =============================================
-- 視圖
-- =============================================

-- 刪除已存在的視圖
GO
IF EXISTS (SELECT * FROM sys.views WHERE name = 'v_workflow_message_sends_stats')
    DROP VIEW [dbo].[v_workflow_message_sends_stats];
GO
IF EXISTS (SELECT * FROM sys.views WHERE name = 'v_workflow_message_recipients_details')
    DROP VIEW [dbo].[v_workflow_message_recipients_details];
GO

-- 發送記錄統計視圖
GO
CREATE VIEW [dbo].[v_workflow_message_sends_stats] AS
SELECT 
    s.[id],
    s.[workflow_execution_id],
    s.[node_type],
    s.[message_content],
    s.[total_recipients],
    s.[success_count],
    s.[failed_count],
    s.[status],
    s.[started_at],
    s.[completed_at],
    s.[company_id],
    s.[created_by],
    s.[created_at],
    s.[updated_at],
    CASE 
        WHEN s.[total_recipients] = 0 THEN 0
        ELSE CAST(s.[success_count] AS FLOAT) / s.[total_recipients] * 100
    END AS [success_rate],
    CASE 
        WHEN s.[completed_at] IS NOT NULL AND s.[started_at] IS NOT NULL 
        THEN DATEDIFF(SECOND, s.[started_at], s.[completed_at])
        ELSE NULL
    END AS [duration_seconds]
FROM [dbo].[workflow_message_sends] s
WHERE s.[is_active] = 1;
GO

-- 收件人詳細視圖
GO
CREATE VIEW [dbo].[v_workflow_message_recipients_details] AS
SELECT 
    r.[id],
    r.[message_send_id],
    r.[phone_number],
    r.[recipient_type],
    r.[recipient_id],
    r.[recipient_name],
    r.[status],
    r.[whatsapp_message_id],
    r.[sent_at],
    r.[delivered_at],
    r.[read_at],
    r.[error_message],
    r.[retry_count],
    r.[max_retries],
    r.[company_id],
    r.[created_by],
    r.[created_at],
    r.[updated_at],
    s.[workflow_execution_id],
    s.[node_type],
    s.[message_content],
    s.[status] AS [send_status]
FROM [dbo].[workflow_message_recipients] r
INNER JOIN [dbo].[workflow_message_sends] s ON r.[message_send_id] = s.[id]
WHERE r.[is_active] = 1 AND s.[is_active] = 1;
GO

-- =============================================
-- 存儲過程
-- =============================================

-- 刪除已存在的存儲過程
GO
IF EXISTS (SELECT * FROM sys.objects WHERE type = 'P' AND name = 'sp_create_workflow_message_send')
    DROP PROCEDURE [dbo].[sp_create_workflow_message_send];
GO
IF EXISTS (SELECT * FROM sys.objects WHERE type = 'P' AND name = 'sp_add_message_recipient')
    DROP PROCEDURE [dbo].[sp_add_message_recipient];
GO
IF EXISTS (SELECT * FROM sys.objects WHERE type = 'P' AND name = 'sp_add_message_recipients_batch')
    DROP PROCEDURE [dbo].[sp_add_message_recipients_batch];
GO
IF EXISTS (SELECT * FROM sys.objects WHERE type = 'P' AND name = 'sp_update_message_send_status')
    DROP PROCEDURE [dbo].[sp_update_message_send_status];
GO
IF EXISTS (SELECT * FROM sys.objects WHERE type = 'P' AND name = 'sp_update_recipient_status')
    DROP PROCEDURE [dbo].[sp_update_recipient_status];
GO
IF EXISTS (SELECT * FROM sys.objects WHERE type = 'P' AND name = 'sp_update_recipients_status_batch')
    DROP PROCEDURE [dbo].[sp_update_recipients_status_batch];
GO
IF EXISTS (SELECT * FROM sys.objects WHERE type = 'P' AND name = 'sp_get_message_send_statistics')
    DROP PROCEDURE [dbo].[sp_get_message_send_statistics];
GO

-- 創建發送記錄
GO
CREATE PROCEDURE [dbo].[sp_create_workflow_message_send]
    @workflow_execution_id INT,
    @node_id NVARCHAR(50),
    @node_type NVARCHAR(50),
    @message_content NVARCHAR(MAX) = NULL,
    @template_id NVARCHAR(50) = NULL,
    @template_name NVARCHAR(100) = NULL,
    @company_id UNIQUEIDENTIFIER,
    @created_by NVARCHAR(50),
    @message_send_id UNIQUEIDENTIFIER OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    
    SET @message_send_id = NEWID();
    
    INSERT INTO [dbo].[workflow_message_sends] (
        [id],
        [workflow_execution_id],
        [node_id],
        [node_type],
        [message_content],
        [template_id],
        [template_name],
        [company_id],
        [created_by]
    )
    VALUES (
        @message_send_id,
        @workflow_execution_id,
        @node_id,
        @node_type,
        @message_content,
        @template_id,
        @template_name,
        @company_id,
        @created_by
    );
END;
GO

-- 添加收件人
GO
CREATE PROCEDURE [dbo].[sp_add_message_recipient]
    @message_send_id UNIQUEIDENTIFIER,
    @phone_number NVARCHAR(20),
    @recipient_type NVARCHAR(20),
    @recipient_id UNIQUEIDENTIFIER = NULL,
    @recipient_name NVARCHAR(100) = NULL,
    @company_id UNIQUEIDENTIFIER,
    @created_by NVARCHAR(50),
    @recipient_id_out UNIQUEIDENTIFIER OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    
    SET @recipient_id_out = NEWID();
    
    INSERT INTO [dbo].[workflow_message_recipients] (
        [id],
        [message_send_id],
        [phone_number],
        [recipient_type],
        [recipient_id],
        [recipient_name],
        [company_id],
        [created_by]
    )
    VALUES (
        @recipient_id_out,
        @message_send_id,
        @phone_number,
        @recipient_type,
        @recipient_id,
        @recipient_name,
        @company_id,
        @created_by
    );
    
    -- 更新主表的收件人總數
    UPDATE [dbo].[workflow_message_sends]
    SET [total_recipients] = [total_recipients] + 1
    WHERE [id] = @message_send_id;
END;
GO

-- 批量添加收件人 (效能優化)
GO
CREATE PROCEDURE [dbo].[sp_add_message_recipients_batch]
    @message_send_id UNIQUEIDENTIFIER,
    @recipients NVARCHAR(MAX), -- JSON 格式的收件人數據
    @company_id UNIQUEIDENTIFIER,
    @created_by NVARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    
    -- 解析 JSON 並批量插入
    INSERT INTO [dbo].[workflow_message_recipients] (
        [id],
        [message_send_id],
        [phone_number],
        [recipient_type],
        [recipient_id],
        [recipient_name],
        [company_id],
        [created_by]
    )
    SELECT 
        NEWID(),
        @message_send_id,
        JSON_VALUE(value, '$.phone_number'),
        JSON_VALUE(value, '$.recipient_type'),
        CASE 
            WHEN JSON_VALUE(value, '$.recipient_id') IS NOT NULL 
            THEN CAST(JSON_VALUE(value, '$.recipient_id') AS UNIQUEIDENTIFIER)
            ELSE NULL
        END,
        JSON_VALUE(value, '$.recipient_name'),
        @company_id,
        @created_by
    FROM OPENJSON(@recipients);
    
    -- 更新主表的收件人總數
    UPDATE [dbo].[workflow_message_sends]
    SET [total_recipients] = (
        SELECT COUNT(*) 
        FROM [dbo].[workflow_message_recipients] 
        WHERE [message_send_id] = @message_send_id
    )
    WHERE [id] = @message_send_id;
END;
GO

-- 更新發送狀態
GO
CREATE PROCEDURE [dbo].[sp_update_message_send_status]
    @message_send_id UNIQUEIDENTIFIER,
    @status NVARCHAR(20),
    @error_message NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    UPDATE [dbo].[workflow_message_sends]
    SET 
        [status] = @status,
        [error_message] = @error_message,
        [completed_at] = CASE WHEN @status IN ('Completed', 'Failed', 'PartiallyFailed') THEN GETUTCDATE() ELSE [completed_at] END
    WHERE [id] = @message_send_id;
    
    -- 更新統計數據
    UPDATE [dbo].[workflow_message_sends]
    SET 
        [success_count] = (
            SELECT COUNT(*) 
            FROM [dbo].[workflow_message_recipients] 
            WHERE [message_send_id] = @message_send_id 
            AND [status] = 'Sent'
        ),
        [failed_count] = (
            SELECT COUNT(*) 
            FROM [dbo].[workflow_message_recipients] 
            WHERE [message_send_id] = @message_send_id 
            AND [status] = 'Failed'
        )
    WHERE [id] = @message_send_id;
END;
GO

-- 更新收件人狀態
GO
CREATE PROCEDURE [dbo].[sp_update_recipient_status]
    @recipient_id UNIQUEIDENTIFIER,
    @status NVARCHAR(20),
    @whatsapp_message_id NVARCHAR(100) = NULL,
    @sent_at DATETIME2 = NULL,
    @delivered_at DATETIME2 = NULL,
    @read_at DATETIME2 = NULL,
    @error_message NVARCHAR(MAX) = NULL,
    @retry_count INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    UPDATE [dbo].[workflow_message_recipients]
    SET 
        [status] = @status,
        [whatsapp_message_id] = ISNULL(@whatsapp_message_id, [whatsapp_message_id]),
        [sent_at] = ISNULL(@sent_at, [sent_at]),
        [delivered_at] = ISNULL(@delivered_at, [delivered_at]),
        [read_at] = ISNULL(@read_at, [read_at]),
        [error_message] = ISNULL(@error_message, [error_message]),
        [retry_count] = ISNULL(@retry_count, [retry_count])
    WHERE [id] = @recipient_id;
END;
GO

-- 批量更新收件人狀態 (效能優化)
GO
CREATE PROCEDURE [dbo].[sp_update_recipients_status_batch]
    @message_send_id UNIQUEIDENTIFIER,
    @status NVARCHAR(20),
    @whatsapp_message_ids NVARCHAR(MAX) = NULL -- JSON 格式: [{"recipient_id": "guid", "whatsapp_message_id": "wamid.xxx"}]
AS
BEGIN
    SET NOCOUNT ON;
    
    -- 批量更新狀態
    UPDATE [dbo].[workflow_message_recipients]
    SET 
        [status] = @status,
        [whatsapp_message_id] = CASE 
            WHEN @whatsapp_message_ids IS NOT NULL 
            THEN JSON_VALUE(@whatsapp_message_ids, CONCAT('$[', 
                (SELECT COUNT(*) FROM [dbo].[workflow_message_recipients] r2 
                 WHERE r2.[message_send_id] = @message_send_id 
                 AND r2.[id] <= r.[id]), '].whatsapp_message_id'))
            ELSE [whatsapp_message_id]
        END,
        [sent_at] = CASE WHEN @status = 'Sent' THEN GETUTCDATE() ELSE [sent_at] END,
        [delivered_at] = CASE WHEN @status = 'Delivered' THEN GETUTCDATE() ELSE [delivered_at] END,
        [read_at] = CASE WHEN @status = 'Read' THEN GETUTCDATE() ELSE [read_at] END
    FROM [dbo].[workflow_message_recipients] r
    WHERE r.[message_send_id] = @message_send_id;
    
    -- 更新主表統計
    EXEC [dbo].[sp_update_message_send_status] @message_send_id, @status;
END;
GO

-- 獲取發送統計
GO
CREATE PROCEDURE [dbo].[sp_get_message_send_statistics]
    @workflow_execution_id INT = NULL,
    @company_id UNIQUEIDENTIFIER,
    @start_date DATETIME2 = NULL,
    @end_date DATETIME2 = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT 
        COUNT(*) AS [total_sends],
        SUM([total_recipients]) AS [total_recipients],
        SUM([success_count]) AS [total_success],
        SUM([failed_count]) AS [total_failed],
        CASE 
            WHEN SUM([total_recipients]) = 0 THEN 0
            ELSE CAST(SUM([success_count]) AS FLOAT) / SUM([total_recipients]) * 100
        END AS [success_rate],
        AVG(CASE 
            WHEN [completed_at] IS NOT NULL AND [started_at] IS NOT NULL 
            THEN DATEDIFF(SECOND, [started_at], [completed_at])
            ELSE NULL
        END) AS [avg_duration_seconds]
    FROM [dbo].[workflow_message_sends]
    WHERE [company_id] = @company_id
    AND [is_active] = 1
    AND (@workflow_execution_id IS NULL OR [workflow_execution_id] = @workflow_execution_id)
    AND (@start_date IS NULL OR [started_at] >= @start_date)
    AND (@end_date IS NULL OR [started_at] <= @end_date);
END;
GO

-- =============================================
-- 完成
-- =============================================

PRINT '工作流程消息發送記錄表創建完成！';
PRINT '包含以下對象：';
PRINT '- workflow_message_sends (主表)';
PRINT '- workflow_message_recipients (明細表)';
PRINT '- 相關索引';
PRINT '- 更新時間觸發器';
PRINT '- 統計視圖';
PRINT '- 高效能存儲過程 (包含批量操作)';
