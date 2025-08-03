-- 建立 eFormApprovals 表
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[eFormApprovals]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[eFormApprovals] (
        [Id] INT IDENTITY(1,1) NOT NULL,
        [EFormInstanceId] UNIQUEIDENTIFIER NOT NULL,
        [Action] NVARCHAR(20) NOT NULL,
        [ApprovedBy] NVARCHAR(255) NOT NULL,
        [ApprovalNote] NVARCHAR(500) NULL,
        [ApprovedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [PK_eFormApprovals] PRIMARY KEY CLUSTERED ([Id] ASC)
    )
END
GO

-- 建立外鍵約束
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE object_id = OBJECT_ID(N'[dbo].[FK_eFormApprovals_EFormInstances]') AND parent_object_id = OBJECT_ID(N'[dbo].[eFormApprovals]'))
BEGIN
    ALTER TABLE [dbo].[eFormApprovals] 
    ADD CONSTRAINT [FK_eFormApprovals_EFormInstances] 
    FOREIGN KEY([EFormInstanceId]) 
    REFERENCES [dbo].[eFormInstances] ([Id]) 
    ON DELETE CASCADE
END
GO

-- 建立索引
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[eFormApprovals]') AND name = N'IX_eFormApprovals_EFormInstanceId')
BEGIN
    CREATE NONCLUSTERED INDEX [IX_eFormApprovals_EFormInstanceId] ON [dbo].[eFormApprovals]
    (
        [EFormInstanceId] ASC
    )
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID(N'[dbo].[eFormApprovals]') AND name = N'IX_eFormApprovals_ApprovedAt')
BEGIN
    CREATE NONCLUSTERED INDEX [IX_eFormApprovals_ApprovedAt] ON [dbo].[eFormApprovals]
    (
        [ApprovedAt] ASC
    )
END
GO

PRINT 'eFormApprovals 表建立完成' 