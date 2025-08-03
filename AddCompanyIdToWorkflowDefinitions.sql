-- 添加 company_id 列到 WorkflowDefinitions 表
USE [PurpleRice];

-- 檢查列是否已存在
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_NAME = 'WorkflowDefinitions' 
               AND COLUMN_NAME = 'company_id')
BEGIN
    -- 添加 company_id 列
    ALTER TABLE [dbo].[WorkflowDefinitions] 
    ADD [company_id] UNIQUEIDENTIFIER NULL;
    
    PRINT '已添加 company_id 列到 WorkflowDefinitions 表';
END
ELSE
BEGIN
    PRINT 'company_id 列已存在於 WorkflowDefinitions 表';
END

-- 為現有記錄設置默認的 company_id（使用默認公司）
UPDATE [dbo].[WorkflowDefinitions] 
SET [company_id] = '00000000-0000-0000-0000-000000000001'
WHERE [company_id] IS NULL;

-- 將 company_id 設為非空
ALTER TABLE [dbo].[WorkflowDefinitions] 
ALTER COLUMN [company_id] UNIQUEIDENTIFIER NOT NULL;

-- 添加外鍵約束
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS 
               WHERE CONSTRAINT_NAME = 'FK_WorkflowDefinitions_Companies')
BEGIN
    ALTER TABLE [dbo].[WorkflowDefinitions] 
    ADD CONSTRAINT [FK_WorkflowDefinitions_Companies] 
    FOREIGN KEY ([company_id]) REFERENCES [dbo].[companies] ([id]);
    
    PRINT '已添加外鍵約束 FK_WorkflowDefinitions_Companies';
END
ELSE
BEGIN
    PRINT '外鍵約束 FK_WorkflowDefinitions_Companies 已存在';
END

-- 添加索引以提高查詢性能
IF NOT EXISTS (SELECT * FROM sys.indexes 
               WHERE name = 'IX_WorkflowDefinitions_CompanyId')
BEGIN
    CREATE INDEX [IX_WorkflowDefinitions_CompanyId] 
    ON [dbo].[WorkflowDefinitions] ([company_id]);
    
    PRINT '已添加索引 IX_WorkflowDefinitions_CompanyId';
END
ELSE
BEGIN
    PRINT '索引 IX_WorkflowDefinitions_CompanyId 已存在';
END

PRINT 'WorkflowDefinitions 表的 company_id 列設置完成';