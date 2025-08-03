-- 設置 WorkflowDefinitions 表的 company_id 支持
USE [PurpleRice];

PRINT '開始設置 WorkflowDefinitions 表的 company_id 支持...';

-- 1. 確保默認公司存在
IF NOT EXISTS (SELECT * FROM [dbo].[companies] WHERE [id] = '00000000-0000-0000-0000-000000000001')
BEGIN
    INSERT INTO [dbo].[companies] (
        [id], 
        [name], 
        [email], 
        [address], 
        [phone], 
        [website], 
        [created_at], 
        [updated_at]
    ) VALUES (
        '00000000-0000-0000-0000-000000000001',
        '默認公司',
        'default@company.com',
        '默認地址',
        '0000000000',
        'https://default-company.com',
        GETDATE(),
        GETDATE()
    );
    PRINT '已創建默認公司';
END
ELSE
BEGIN
    PRINT '默認公司已存在';
END

-- 2. 檢查 WorkflowDefinitions 表是否存在
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES 
               WHERE TABLE_NAME = 'WorkflowDefinitions' 
               AND TABLE_SCHEMA = 'dbo')
BEGIN
    PRINT '錯誤：WorkflowDefinitions 表不存在！';
    RETURN;
END

-- 3. 添加 company_id 列
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_NAME = 'WorkflowDefinitions' 
               AND COLUMN_NAME = 'company_id')
BEGIN
    ALTER TABLE [dbo].[WorkflowDefinitions] 
    ADD [company_id] UNIQUEIDENTIFIER NULL;
    
    PRINT '已添加 company_id 列到 WorkflowDefinitions 表';
END
ELSE
BEGIN
    PRINT 'company_id 列已存在於 WorkflowDefinitions 表';
END

-- 4. 為現有記錄設置默認的 company_id
UPDATE [dbo].[WorkflowDefinitions] 
SET [company_id] = '00000000-0000-0000-0000-000000000001'
WHERE [company_id] IS NULL;

PRINT '已為現有記錄設置默認 company_id';

-- 5. 將 company_id 設為非空
ALTER TABLE [dbo].[WorkflowDefinitions] 
ALTER COLUMN [company_id] UNIQUEIDENTIFIER NOT NULL;

PRINT '已將 company_id 設為非空';

-- 6. 添加外鍵約束
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

-- 7. 添加索引以提高查詢性能
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

-- 8. 驗證設置
SELECT 
    COUNT(*) as TotalWorkflows,
    COUNT(CASE WHEN company_id IS NOT NULL THEN 1 END) as WorkflowsWithCompanyId,
    COUNT(DISTINCT company_id) as UniqueCompanies
FROM [dbo].[WorkflowDefinitions];

PRINT 'WorkflowDefinitions 表的 company_id 設置完成！';
PRINT '請重新啟動應用程序以測試修復。';