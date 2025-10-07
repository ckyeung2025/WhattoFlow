-- 創建 WhatsAppMonitorChatMsg 表
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[WhatsAppMonitorChatMsg]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[WhatsAppMonitorChatMsg] (
        [Id] BIGINT IDENTITY(1,1) PRIMARY KEY,
        [WaId] NVARCHAR(50) NOT NULL,                    -- WhatsApp 用戶 ID
        [WorkflowInstanceId] INT NULL,                    -- 關聯的工作流程實例 ID
        [MessageId] NVARCHAR(100) NOT NULL,              -- WhatsApp 消息 ID
        [SenderType] NVARCHAR(20) NOT NULL,              -- 發送者類型: 'user' 或 'admin'
        [MessageText] NVARCHAR(MAX) NOT NULL,            -- 消息內容
        [MessageType] NVARCHAR(20) DEFAULT 'text',       -- 消息類型: 'text', 'image', 'file', 'audio'
        [Status] NVARCHAR(20) DEFAULT 'sent',            -- 消息狀態: 'sending', 'sent', 'delivered', 'read', 'failed'
        [Timestamp] DATETIME2 NOT NULL,                  -- 消息時間戳
        [CreatedAt] DATETIME2 NOT NULL DEFAULT GETDATE(), -- 創建時間
        [UpdatedAt] DATETIME2 NOT NULL DEFAULT GETDATE(), -- 更新時間
        [IsDeleted] BIT NOT NULL DEFAULT 0,              -- 軟刪除標記
        [Metadata] NVARCHAR(MAX) NULL                    -- 額外元數據 (JSON 格式)
    )
    
    -- 創建索引
    CREATE INDEX [IX_WhatsAppMonitorChatMsg_WaId] ON [dbo].[WhatsAppMonitorChatMsg] ([WaId])
    CREATE INDEX [IX_WhatsAppMonitorChatMsg_WorkflowInstanceId] ON [dbo].[WhatsAppMonitorChatMsg] ([WorkflowInstanceId])
    CREATE INDEX [IX_WhatsAppMonitorChatMsg_Timestamp] ON [dbo].[WhatsAppMonitorChatMsg] ([Timestamp])
    CREATE INDEX [IX_WhatsAppMonitorChatMsg_MessageId] ON [dbo].[WhatsAppMonitorChatMsg] ([MessageId])
    
    -- 添加外鍵約束
    ALTER TABLE [dbo].[WhatsAppMonitorChatMsg] 
    ADD CONSTRAINT [FK_WhatsAppMonitorChatMsg_WorkflowExecution] 
    FOREIGN KEY ([WorkflowInstanceId]) REFERENCES [dbo].[WorkflowExecutions] ([Id])
    
    PRINT 'WhatsAppMonitorChatMsg 表創建成功！'
END
ELSE
BEGIN
    PRINT 'WhatsAppMonitorChatMsg 表已存在'
END

-- 插入一些測試數據（可選）
IF NOT EXISTS (SELECT * FROM [dbo].[WhatsAppMonitorChatMsg] WHERE WaId = '85296366318')
BEGIN
    INSERT INTO [dbo].[WhatsAppMonitorChatMsg] (
        [WaId], [WorkflowInstanceId], [MessageId], [SenderType], [MessageText], 
        [MessageType], [Status], [Timestamp], [CreatedAt], [UpdatedAt]
    ) VALUES 
    ('85296366318', 190, 'test_msg_001', 'user', 'option_3', 'text', 'sent', 
     '2025-08-14T01:08:38.0516176+08:00', GETDATE(), GETDATE()),
    ('85296366318', 190, 'test_msg_002', 'admin', '您好！我是客服人員，有什麼可以幫助您的嗎？', 'text', 'sent', 
     GETDATE(), GETDATE(), GETDATE())
    
    PRINT '測試數據插入成功！'
END
