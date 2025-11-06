-- =============================================
-- 流程變量系統數據表創建腳本 (修正版)
-- 創建時間: 2025-08-31
-- 版本: 2.1.0
-- =============================================

USE [PurpleRice]
GO

-- =============================================
-- 1. 創建流程變量定義表
-- =============================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='process_variable_definitions' AND xtype='U')
BEGIN
    CREATE TABLE [dbo].[process_variable_definitions](
        [id] [uniqueidentifier] NOT NULL DEFAULT (NEWID()),
        [workflow_definition_id] [int] NOT NULL,
        [variable_name] [nvarchar](100) NOT NULL,
        [display_name] [nvarchar](200) NULL,
        [data_type] [nvarchar](50) NOT NULL,
        [description] [nvarchar](500) NULL,
        [is_required] [bit] NOT NULL DEFAULT 0,
        [default_value] [nvarchar](500) NULL,
        [validation_rules] [nvarchar](1000) NULL,
        [json_schema] [nvarchar](max) NULL,
        [created_at] [datetime2](7) NOT NULL DEFAULT (GETUTCDATE()),
        [updated_at] [datetime2](7) NULL,
        [created_by] [nvarchar](100) NOT NULL,
        [updated_by] [nvarchar](100) NULL,
        
        CONSTRAINT [PK_process_variable_definitions] PRIMARY KEY CLUSTERED ([id] ASC)
    )
    
    PRINT '表 process_variable_definitions 創建成功'
END
ELSE
BEGIN
    PRINT '表 process_variable_definitions 已存在'
END
GO

-- =============================================
-- 2. 創建流程變量值表
-- =============================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='process_variable_values' AND xtype='U')
BEGIN
    CREATE TABLE [dbo].[process_variable_values](
        [id] [uniqueidentifier] NOT NULL DEFAULT (NEWID()),
        [workflow_execution_id] [int] NOT NULL,
        [variable_name] [nvarchar](100) NOT NULL,
        [data_type] [nvarchar](50) NOT NULL,
        [string_value] [nvarchar](500) NULL,
        [numeric_value] [decimal](18, 4) NULL,
        [date_value] [datetime2](7) NULL,
        [boolean_value] [bit] NULL,
        [text_value] [nvarchar](max) NULL,
        [json_value] [nvarchar](max) NULL,
        [set_at] [datetime2](7) NOT NULL DEFAULT (GETUTCDATE()),
        [set_by] [nvarchar](100) NULL,
        [source_type] [nvarchar](50) NULL,
        [source_reference] [nvarchar](500) NULL,
        
        CONSTRAINT [PK_process_variable_values] PRIMARY KEY CLUSTERED ([id] ASC)
    )
    
    PRINT '表 process_variable_values 創建成功'
END
ELSE
BEGIN
    PRINT '表 process_variable_values 已存在'
END
GO

-- =============================================
-- 3. 創建索引
-- =============================================

-- 流程變量定義表索引
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_process_variable_definitions_workflow_definition_id')
BEGIN
    CREATE NONCLUSTERED INDEX [IX_process_variable_definitions_workflow_definition_id] 
    ON [dbo].[process_variable_definitions] ([workflow_definition_id] ASC)
    PRINT '索引 IX_process_variable_definitions_workflow_definition_id 創建成功'
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_process_variable_definitions_variable_name')
BEGIN
    CREATE NONCLUSTERED INDEX [IX_process_variable_definitions_variable_name] 
    ON [dbo].[process_variable_definitions] ([variable_name] ASC)
    PRINT '索引 IX_process_variable_definitions_variable_name 創建成功'
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_process_variable_definitions_data_type')
BEGIN
    CREATE NONCLUSTERED INDEX [IX_process_variable_definitions_data_type] 
    ON [dbo].[process_variable_definitions] ([data_type] ASC)
    PRINT '索引 IX_process_variable_definitions_data_type 創建成功'
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_process_variable_definitions_workflow_variable_unique')
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX [IX_process_variable_definitions_workflow_variable_unique] 
    ON [dbo].[process_variable_definitions] ([workflow_definition_id] ASC, [variable_name] ASC)
    PRINT '唯一索引 IX_process_variable_definitions_workflow_variable_unique 創建成功'
END

-- 流程變量值表索引
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_process_variable_values_workflow_execution_id')
BEGIN
    CREATE NONCLUSTERED INDEX [IX_process_variable_values_workflow_execution_id] 
    ON [dbo].[process_variable_values] ([workflow_execution_id] ASC)
    PRINT '索引 IX_process_variable_values_workflow_execution_id 創建成功'
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_process_variable_values_variable_name')
BEGIN
    CREATE NONCLUSTERED INDEX [IX_process_variable_values_variable_name] 
    ON [dbo].[process_variable_values] ([variable_name] ASC)
    PRINT '索引 IX_process_variable_values_variable_name 創建成功'
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_process_variable_values_set_at')
BEGIN
    CREATE NONCLUSTERED INDEX [IX_process_variable_values_set_at] 
    ON [dbo].[process_variable_values] ([set_at] ASC)
    PRINT '索引 IX_process_variable_values_set_at 創建成功'
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_process_variable_values_source_type')
BEGIN
    CREATE NONCLUSTERED INDEX [IX_process_variable_values_source_type] 
    ON [dbo].[process_variable_values] ([source_type] ASC)
    PRINT '索引 IX_process_variable_values_source_type 創建成功'
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_process_variable_values_execution_variable')
BEGIN
    CREATE NONCLUSTERED INDEX [IX_process_variable_values_execution_variable] 
    ON [dbo].[process_variable_values] ([workflow_execution_id] ASC, [variable_name] ASC)
    PRINT '索引 IX_process_variable_values_execution_variable 創建成功'
END

-- =============================================
-- 4. 創建外鍵約束
-- =============================================

-- 流程變量定義表外鍵
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_process_variable_definitions_workflow_definitions')
BEGIN
    ALTER TABLE [dbo].[process_variable_definitions]
    ADD CONSTRAINT [FK_process_variable_definitions_workflow_definitions]
    FOREIGN KEY ([workflow_definition_id]) 
    REFERENCES [dbo].[WorkflowDefinitions] ([Id])
    ON DELETE CASCADE
    PRINT '外鍵 FK_process_variable_definitions_workflow_definitions 創建成功'
END

-- 流程變量值表外鍵
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_process_variable_values_workflow_executions')
BEGIN
    ALTER TABLE [dbo].[process_variable_values]
    ADD CONSTRAINT [FK_process_variable_values_workflow_executions]
    FOREIGN KEY ([workflow_execution_id]) 
    REFERENCES [dbo].[workflow_executions] ([Id])
    ON DELETE CASCADE
    PRINT '外鍵 FK_process_variable_values_workflow_executions 創建成功'
END

-- =============================================
-- 5. 創建檢查約束
-- =============================================

-- 數據類型檢查約束
IF NOT EXISTS (SELECT * FROM sys.check_constraints WHERE name = 'CK_process_variable_definitions_data_type')
BEGIN
    ALTER TABLE [dbo].[process_variable_definitions]
    ADD CONSTRAINT [CK_process_variable_definitions_data_type]
    CHECK ([data_type] IN ('string', 'int', 'decimal', 'datetime', 'boolean', 'text', 'json'))
    PRINT '檢查約束 CK_process_variable_definitions_data_type 創建成功'
END

IF NOT EXISTS (SELECT * FROM sys.check_constraints WHERE name = 'CK_process_variable_values_data_type')
BEGIN
    ALTER TABLE [dbo].[process_variable_values]
    ADD CONSTRAINT [CK_process_variable_values_data_type]
    CHECK ([data_type] IN ('string', 'int', 'decimal', 'datetime', 'boolean', 'text', 'json'))
    PRINT '檢查約束 CK_process_variable_values_data_type 創建成功'
END

-- =============================================
-- 6. 創建觸發器（可選）
-- =============================================

-- 流程變量定義表更新時間觸發器
IF NOT EXISTS (SELECT * FROM sys.triggers WHERE name = 'TR_process_variable_definitions_updated_at')
BEGIN
    EXEC('
    CREATE TRIGGER [TR_process_variable_definitions_updated_at]
    ON [dbo].[process_variable_definitions]
    AFTER UPDATE
    AS
    BEGIN
        SET NOCOUNT ON;
        UPDATE [dbo].[process_variable_definitions]
        SET [updated_at] = GETUTCDATE()
        FROM [dbo].[process_variable_definitions] pvd
        INNER JOIN inserted i ON pvd.[id] = i.[id]
    END
    ')
    PRINT '觸發器 TR_process_variable_definitions_updated_at 創建成功'
END

-- =============================================
-- 7. 插入示例數據（可選）
-- =============================================

-- 檢查是否有工作流定義存在
IF EXISTS (SELECT 1 FROM [dbo].[WorkflowDefinitions] WHERE [Id] = 1)
BEGIN
    -- 插入示例流程變量定義
    IF NOT EXISTS (SELECT 1 FROM [dbo].[process_variable_definitions] WHERE [workflow_definition_id] = 1 AND [variable_name] = 'customer_name')
    BEGIN
        INSERT INTO [dbo].[process_variable_definitions] (
            [workflow_definition_id], [variable_name], [display_name], [data_type], 
            [description], [is_required], [created_by]
        ) VALUES (
            1, 'customer_name', '客戶名稱', 'string', 
            '客戶的完整名稱', 1, 'system'
        )
        PRINT '示例數據：customer_name 變量定義插入成功'
    END

    IF NOT EXISTS (SELECT 1 FROM [dbo].[process_variable_definitions] WHERE [workflow_definition_id] = 1 AND [variable_name] = 'order_amount')
    BEGIN
        INSERT INTO [dbo].[process_variable_definitions] (
            [workflow_definition_id], [variable_name], [display_name], [data_type], 
            [description], [is_required], [created_by]
        ) VALUES (
            1, 'order_amount', '訂單金額', 'decimal', 
            '訂單的總金額', 1, 'system'
        )
        PRINT '示例數據：order_amount 變量定義插入成功'
    END

    IF NOT EXISTS (SELECT 1 FROM [dbo].[process_variable_definitions] WHERE [workflow_definition_id] = 1 AND [variable_name] = 'order_date')
    BEGIN
        INSERT INTO [dbo].[process_variable_definitions] (
            [workflow_definition_id], [variable_name], [display_name], [data_type], 
            [description], [is_required], [created_by]
        ) VALUES (
            1, 'order_date', '訂單日期', 'datetime', 
            '訂單創建日期', 0, 'system'
        )
        PRINT '示例數據：order_date 變量定義插入成功'
    END
END

-- =============================================
-- 8. 創建視圖（可選）
-- =============================================

-- 流程變量完整信息視圖
IF NOT EXISTS (SELECT * FROM sys.views WHERE name = 'VW_ProcessVariableInfo')
BEGIN
    EXEC('
    CREATE VIEW [dbo].[VW_ProcessVariableInfo] AS
    SELECT 
        pvd.[id] AS [definition_id],
        pvd.[workflow_definition_id],
        pvd.[variable_name],
        pvd.[display_name],
        pvd.[data_type],
        pvd.[description],
        pvd.[is_required],
        pvd.[default_value],
        pvd.[validation_rules],
        pvd.[json_schema],
        pvd.[created_at] AS [definition_created_at],
        pvd.[created_by] AS [definition_created_by],
        pvv.[id] AS [value_id],
        pvv.[workflow_execution_id],
        pvv.[string_value],
        pvv.[numeric_value],
        pvv.[date_value],
        pvv.[boolean_value],
        pvv.[text_value],
        pvv.[json_value],
        pvv.[set_at],
        pvv.[set_by],
        pvv.[source_type],
        pvv.[source_reference]
    FROM [dbo].[process_variable_definitions] pvd
    LEFT JOIN [dbo].[process_variable_values] pvv 
        ON pvd.[variable_name] = pvv.[variable_name]
        AND pvd.[workflow_definition_id] = (
            SELECT [workflow_definition_id] 
            FROM [dbo].[workflow_executions] 
            WHERE [Id] = pvv.[workflow_execution_id]
        )
    ')
    PRINT '視圖 VW_ProcessVariableInfo 創建成功'
END

-- =============================================
-- 腳本執行完成
-- =============================================
PRINT '============================================='
PRINT '流程變量系統數據表創建完成'
PRINT '創建時間: ' + CONVERT(VARCHAR(19), GETDATE(), 120)
PRINT '版本: 2.1.0'
PRINT '============================================='
