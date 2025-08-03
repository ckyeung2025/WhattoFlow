-- 檢查並新增等待相關欄位到 workflow_executions 表
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'workflow_executions' AND COLUMN_NAME = 'IsWaiting')
BEGIN
    ALTER TABLE [dbo].[workflow_executions] ADD [IsWaiting] BIT NOT NULL DEFAULT 0;
END

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'workflow_executions' AND COLUMN_NAME = 'WaitingSince')
BEGIN
    ALTER TABLE [dbo].[workflow_executions] ADD [WaitingSince] DATETIME2 NULL;
END

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'workflow_executions' AND COLUMN_NAME = 'LastUserActivity')
BEGIN
    ALTER TABLE [dbo].[workflow_executions] ADD [LastUserActivity] DATETIME2 NULL;
END

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'workflow_executions' AND COLUMN_NAME = 'CurrentWaitingStep')
BEGIN
    ALTER TABLE [dbo].[workflow_executions] ADD [CurrentWaitingStep] INT NULL;
END

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'workflow_executions' AND COLUMN_NAME = 'WaitingForUser')
BEGIN
    ALTER TABLE [dbo].[workflow_executions] ADD [WaitingForUser] NVARCHAR(50) NULL;
END

-- 檢查並新增等待相關欄位到 workflow_step_executions 表
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'workflow_step_executions' AND COLUMN_NAME = 'IsWaiting')
BEGIN
    ALTER TABLE [dbo].[workflow_step_executions] ADD [IsWaiting] BIT NOT NULL DEFAULT 0;
END

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'workflow_step_executions' AND COLUMN_NAME = 'WaitingForUser')
BEGIN
    ALTER TABLE [dbo].[workflow_step_executions] ADD [WaitingForUser] NVARCHAR(50) NULL;
END

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'workflow_step_executions' AND COLUMN_NAME = 'ValidationConfig')
BEGIN
    ALTER TABLE [dbo].[workflow_step_executions] ADD [ValidationConfig] NVARCHAR(MAX) NULL;
END

-- 檢查並新增 user_sessions 表（如果不存在）
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'user_sessions')
BEGIN
    CREATE TABLE [dbo].[user_sessions] (
        [id] INT IDENTITY(1,1) PRIMARY KEY,
        [user_wa_id] NVARCHAR(50) NOT NULL,
        [current_workflow_execution_id] INT NULL,
        [session_start_time] DATETIME2 NOT NULL,
        [last_activity_time] DATETIME2 NOT NULL,
        [status] NVARCHAR(20) NOT NULL DEFAULT 'Active',
        [created_at] DATETIME2 NOT NULL DEFAULT GETDATE(),
        [updated_at] DATETIME2 NOT NULL DEFAULT GETDATE()
    );
    
    -- 添加外鍵約束
    ALTER TABLE [dbo].[user_sessions] 
    ADD CONSTRAINT [FK_user_sessions_workflow_executions] 
    FOREIGN KEY ([current_workflow_execution_id]) 
    REFERENCES [dbo].[workflow_executions]([Id]);
END

-- 檢查並新增 message_validations 表（如果不存在）
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'message_validations')
BEGIN
    CREATE TABLE [dbo].[message_validations] (
        [id] INT IDENTITY(1,1) PRIMARY KEY,
        [workflow_execution_id] INT NOT NULL,
        [step_index] INT NOT NULL,
        [user_wa_id] NVARCHAR(50) NOT NULL,
        [user_message] NVARCHAR(MAX) NOT NULL,
        [is_valid] BIT NOT NULL,
        [error_message] NVARCHAR(500) NULL,
        [validator_type] NVARCHAR(50) NULL,
        [processed_data] NVARCHAR(MAX) NULL,
        [created_at] DATETIME2 NOT NULL DEFAULT GETDATE()
    );
    
    -- 添加外鍵約束
    ALTER TABLE [dbo].[message_validations] 
    ADD CONSTRAINT [FK_message_validations_workflow_executions] 
    FOREIGN KEY ([workflow_execution_id]) 
    REFERENCES [dbo].[workflow_executions]([Id]);
END

-- 為新增的欄位添加註釋
IF NOT EXISTS (SELECT * FROM sys.extended_properties WHERE name = 'MS_Description' AND major_id = OBJECT_ID('workflow_executions') AND minor_id = (SELECT column_id FROM sys.columns WHERE object_id = OBJECT_ID('workflow_executions') AND name = 'IsWaiting'))
BEGIN
    EXEC sp_addextendedproperty 
        @name = N'MS_Description', 
        @value = N'是否正在等待用戶回覆', 
        @level0type = N'SCHEMA', @level0name = N'dbo', 
        @level1type = N'TABLE', @level1name = N'workflow_executions', 
        @level2type = N'COLUMN', @level2name = N'IsWaiting';
END

PRINT '所有等待相關欄位已成功添加或確認存在'; 