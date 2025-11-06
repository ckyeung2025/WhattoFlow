-- =============================================
-- 創建角色介面權限管理系統（支持多租戶）
-- 文件名: Database/Create_Roles_Interface_System.sql
-- 日期: 2025-01-XX
-- 說明: 創建 roles_interface 表並插入默認權限數據
--       支持多租戶，每個公司可以有自己的權限配置
-- =============================================

USE [PurpleRice]
GO

-- =============================================
-- 1. 創建 roles_interface 表（支持多租戶）
-- =============================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='roles_interface' AND xtype='U')
BEGIN
    CREATE TABLE [dbo].[roles_interface](
        [id] [uniqueidentifier] NOT NULL DEFAULT (NEWID()),
        [role_id] [uniqueidentifier] NOT NULL,
        [company_id] [uniqueidentifier] NULL,  -- NULL 表示系統默認權限，具體值表示公司自定義權限
        [interface_key] [nvarchar](100) NOT NULL,
        [created_at] [datetime2](7) NOT NULL DEFAULT (GETUTCDATE()),
        [updated_at] [datetime2](7) NULL,
        [is_active] [bit] NOT NULL DEFAULT 1,
        
        CONSTRAINT [PK_roles_interface] PRIMARY KEY CLUSTERED ([id] ASC),
        CONSTRAINT [FK_roles_interface_roles] FOREIGN KEY ([role_id]) 
            REFERENCES [dbo].[roles]([id]) ON DELETE CASCADE,
        CONSTRAINT [FK_roles_interface_companies] FOREIGN KEY ([company_id]) 
            REFERENCES [dbo].[companies]([id]) ON DELETE CASCADE,
        CONSTRAINT [UQ_roles_interface_role_company_interface] UNIQUE ([role_id], [company_id], [interface_key])
    )
    
    PRINT '✅ 表 roles_interface 創建成功'
END
ELSE
BEGIN
    PRINT '⚠️ 表 roles_interface 已存在，檢查是否需要添加 company_id 欄位...'
    
    -- 如果表已存在但沒有 company_id 欄位，則添加
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('roles_interface') AND name = 'company_id')
    BEGIN
        ALTER TABLE [dbo].[roles_interface] ADD [company_id] [uniqueidentifier] NULL;
        
        -- 添加外鍵約束
        IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_roles_interface_companies')
        BEGIN
            ALTER TABLE [dbo].[roles_interface] 
            ADD CONSTRAINT [FK_roles_interface_companies] 
            FOREIGN KEY ([company_id]) REFERENCES [dbo].[companies]([id]) ON DELETE CASCADE;
        END
        
        -- 刪除舊的唯一約束（如果存在）
        IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'UQ_roles_interface_role_interface')
        BEGIN
            ALTER TABLE [dbo].[roles_interface] 
            DROP CONSTRAINT [UQ_roles_interface_role_interface];
        END
        
        -- 添加新的唯一約束（包含 company_id）
        IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'UQ_roles_interface_role_company_interface')
        BEGIN
            ALTER TABLE [dbo].[roles_interface] 
            ADD CONSTRAINT [UQ_roles_interface_role_company_interface] 
            UNIQUE ([role_id], [company_id], [interface_key]);
        END
        
        PRINT '✅ 已添加 company_id 欄位和相關約束'
    END
    ELSE
    BEGIN
        PRINT '⚠️ company_id 欄位已存在'
    END
END
GO

-- 創建索引
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_roles_interface_role_id')
BEGIN
    CREATE INDEX [IX_roles_interface_role_id] ON [dbo].[roles_interface] ([role_id]);
    PRINT '✅ 創建索引 IX_roles_interface_role_id'
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_roles_interface_company_id')
BEGIN
    CREATE INDEX [IX_roles_interface_company_id] ON [dbo].[roles_interface] ([company_id]);
    PRINT '✅ 創建索引 IX_roles_interface_company_id'
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_roles_interface_interface_key')
BEGIN
    CREATE INDEX [IX_roles_interface_interface_key] ON [dbo].[roles_interface] ([interface_key]);
    PRINT '✅ 創建索引 IX_roles_interface_interface_key'
END
GO

-- 創建複合索引（常用查詢）
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_roles_interface_role_company')
BEGIN
    CREATE INDEX [IX_roles_interface_role_company] ON [dbo].[roles_interface] ([role_id], [company_id]);
    PRINT '✅ 創建複合索引 IX_roles_interface_role_company'
END
GO

-- =============================================
-- 2. 插入系統默認權限數據（company_id = NULL）
-- =============================================
PRINT '開始插入系統默認權限數據...';

-- 先檢查並獲取實際的角色 ID（因為可能已經存在）
DECLARE @ApproverRoleId UNIQUEIDENTIFIER;
DECLARE @DesignerRoleId UNIQUEIDENTIFIER;
DECLARE @CompanyAdminRoleId UNIQUEIDENTIFIER;
DECLARE @TenantAdminRoleId UNIQUEIDENTIFIER;

SELECT @ApproverRoleId = [id] FROM [dbo].[roles] WHERE [name] = 'Approver' AND [is_system_role] = 1;
SELECT @DesignerRoleId = [id] FROM [dbo].[roles] WHERE [name] = 'Designer' AND [is_system_role] = 1;
SELECT @CompanyAdminRoleId = [id] FROM [dbo].[roles] WHERE [name] = 'Company_Admin' AND [is_system_role] = 1;
SELECT @TenantAdminRoleId = [id] FROM [dbo].[roles] WHERE [name] = 'Tenant_Admin' AND [is_system_role] = 1;

-- 如果角色 ID 不存在，使用提供的 ID
IF @ApproverRoleId IS NULL
    SET @ApproverRoleId = '7EEE340F-2A4C-4B90-93D3-076DABC8ECF6';
IF @DesignerRoleId IS NULL
    SET @DesignerRoleId = 'D455CF45-3A70-438B-B80D-F9BE4F8DEC74';
IF @CompanyAdminRoleId IS NULL
    SET @CompanyAdminRoleId = '1A18A1CA-7733-4945-8731-ECBA1FAF2318';
IF @TenantAdminRoleId IS NULL
    SET @TenantAdminRoleId = 'DC71D188-7684-4967-9F22-0B5C5C524E7C';

-- 清空現有的系統默認數據（company_id IS NULL）- 可選，根據需要調整
-- DELETE FROM [dbo].[roles_interface] WHERE [company_id] IS NULL;

-- Approver - 系統默認權限（適用於所有公司）
IF NOT EXISTS (SELECT 1 FROM [dbo].[roles_interface] WHERE [role_id] = @ApproverRoleId AND [company_id] IS NULL AND [interface_key] = 'dashboard')
BEGIN
    INSERT INTO [dbo].[roles_interface] ([role_id], [company_id], [interface_key], [created_at], [updated_at], [is_active])
    VALUES (@ApproverRoleId, NULL, 'dashboard', GETUTCDATE(), GETUTCDATE(), 1);
END

IF NOT EXISTS (SELECT 1 FROM [dbo].[roles_interface] WHERE [role_id] = @ApproverRoleId AND [company_id] IS NULL AND [interface_key] = 'application')
BEGIN
    INSERT INTO [dbo].[roles_interface] ([role_id], [company_id], [interface_key], [created_at], [updated_at], [is_active])
    VALUES (@ApproverRoleId, NULL, 'application', GETUTCDATE(), GETUTCDATE(), 1);
END

-- Designer - 系統默認權限
IF NOT EXISTS (SELECT 1 FROM [dbo].[roles_interface] WHERE [role_id] = @DesignerRoleId AND [company_id] IS NULL AND [interface_key] = 'dashboard')
BEGIN
    INSERT INTO [dbo].[roles_interface] ([role_id], [company_id], [interface_key], [created_at], [updated_at], [is_active])
    VALUES (@DesignerRoleId, NULL, 'dashboard', GETUTCDATE(), GETUTCDATE(), 1);
END

IF NOT EXISTS (SELECT 1 FROM [dbo].[roles_interface] WHERE [role_id] = @DesignerRoleId AND [company_id] IS NULL AND [interface_key] = 'application')
BEGIN
    INSERT INTO [dbo].[roles_interface] ([role_id], [company_id], [interface_key], [created_at], [updated_at], [is_active])
    VALUES (@DesignerRoleId, NULL, 'application', GETUTCDATE(), GETUTCDATE(), 1);
END

IF NOT EXISTS (SELECT 1 FROM [dbo].[roles_interface] WHERE [role_id] = @DesignerRoleId AND [company_id] IS NULL AND [interface_key] = 'studio')
BEGIN
    INSERT INTO [dbo].[roles_interface] ([role_id], [company_id], [interface_key], [created_at], [updated_at], [is_active])
    VALUES (@DesignerRoleId, NULL, 'studio', GETUTCDATE(), GETUTCDATE(), 1);
END

-- Company_Admin - 系統默認權限
IF NOT EXISTS (SELECT 1 FROM [dbo].[roles_interface] WHERE [role_id] = @CompanyAdminRoleId AND [company_id] IS NULL AND [interface_key] = 'adminTools')
BEGIN
    INSERT INTO [dbo].[roles_interface] ([role_id], [company_id], [interface_key], [created_at], [updated_at], [is_active])
    VALUES (@CompanyAdminRoleId, NULL, 'adminTools', GETUTCDATE(), GETUTCDATE(), 1);
END

IF NOT EXISTS (SELECT 1 FROM [dbo].[roles_interface] WHERE [role_id] = @CompanyAdminRoleId AND [company_id] IS NULL AND [interface_key] = 'contactList')
BEGIN
    INSERT INTO [dbo].[roles_interface] ([role_id], [company_id], [interface_key], [created_at], [updated_at], [is_active])
    VALUES (@CompanyAdminRoleId, NULL, 'contactList', GETUTCDATE(), GETUTCDATE(), 1);
END

IF NOT EXISTS (SELECT 1 FROM [dbo].[roles_interface] WHERE [role_id] = @CompanyAdminRoleId AND [company_id] IS NULL AND [interface_key] = 'broadcastGroups')
BEGIN
    INSERT INTO [dbo].[roles_interface] ([role_id], [company_id], [interface_key], [created_at], [updated_at], [is_active])
    VALUES (@CompanyAdminRoleId, NULL, 'broadcastGroups', GETUTCDATE(), GETUTCDATE(), 1);
END

IF NOT EXISTS (SELECT 1 FROM [dbo].[roles_interface] WHERE [role_id] = @CompanyAdminRoleId AND [company_id] IS NULL AND [interface_key] = 'hashtags')
BEGIN
    INSERT INTO [dbo].[roles_interface] ([role_id], [company_id], [interface_key], [created_at], [updated_at], [is_active])
    VALUES (@CompanyAdminRoleId, NULL, 'hashtags', GETUTCDATE(), GETUTCDATE(), 1);
END

IF NOT EXISTS (SELECT 1 FROM [dbo].[roles_interface] WHERE [role_id] = @CompanyAdminRoleId AND [company_id] IS NULL AND [interface_key] = 'companyUserAdmin')
BEGIN
    INSERT INTO [dbo].[roles_interface] ([role_id], [company_id], [interface_key], [created_at], [updated_at], [is_active])
    VALUES (@CompanyAdminRoleId, NULL, 'companyUserAdmin', GETUTCDATE(), GETUTCDATE(), 1);
END

IF NOT EXISTS (SELECT 1 FROM [dbo].[roles_interface] WHERE [role_id] = @CompanyAdminRoleId AND [company_id] IS NULL AND [interface_key] = 'permissionManagement')
BEGIN
    INSERT INTO [dbo].[roles_interface] ([role_id], [company_id], [interface_key], [created_at], [updated_at], [is_active])
    VALUES (@CompanyAdminRoleId, NULL, 'permissionManagement', GETUTCDATE(), GETUTCDATE(), 1);
END

-- Tenant_Admin - 系統默認權限
IF NOT EXISTS (SELECT 1 FROM [dbo].[roles_interface] WHERE [role_id] = @TenantAdminRoleId AND [company_id] IS NULL AND [interface_key] = 'adminTools')
BEGIN
    INSERT INTO [dbo].[roles_interface] ([role_id], [company_id], [interface_key], [created_at], [updated_at], [is_active])
    VALUES (@TenantAdminRoleId, NULL, 'adminTools', GETUTCDATE(), GETUTCDATE(), 1);
END

IF NOT EXISTS (SELECT 1 FROM [dbo].[roles_interface] WHERE [role_id] = @TenantAdminRoleId AND [company_id] IS NULL AND [interface_key] = 'phoneVerificationAdmin')
BEGIN
    INSERT INTO [dbo].[roles_interface] ([role_id], [company_id], [interface_key], [created_at], [updated_at], [is_active])
    VALUES (@TenantAdminRoleId, NULL, 'phoneVerificationAdmin', GETUTCDATE(), GETUTCDATE(), 1);
END

IF NOT EXISTS (SELECT 1 FROM [dbo].[roles_interface] WHERE [role_id] = @TenantAdminRoleId AND [company_id] IS NULL AND [interface_key] = 'permissionManagement')
BEGIN
    INSERT INTO [dbo].[roles_interface] ([role_id], [company_id], [interface_key], [created_at], [updated_at], [is_active])
    VALUES (@TenantAdminRoleId, NULL, 'permissionManagement', GETUTCDATE(), GETUTCDATE(), 1);
END

PRINT '✅ 系統默認權限數據插入完成'
GO

-- =============================================
-- 3. 驗證數據
-- =============================================
PRINT '=========================================='
PRINT '📋 系統默認權限數據驗證（company_id IS NULL）:'
PRINT '=========================================='

SELECT 
    r.[name] AS '角色名稱',
    CASE WHEN ri.[company_id] IS NULL THEN '系統默認' ELSE c.[name] END AS '適用範圍',
    ri.[interface_key] AS '介面 Key',
    ri.[is_active] AS '是否啟用',
    ri.[created_at] AS '創建時間'
FROM [dbo].[roles_interface] ri
INNER JOIN [dbo].[roles] r ON ri.[role_id] = r.[id]
LEFT JOIN [dbo].[companies] c ON ri.[company_id] = c.[id]
WHERE ri.[company_id] IS NULL
ORDER BY r.[name], ri.[interface_key];

PRINT ''
PRINT '=========================================='
PRINT '✅ 角色介面權限系統創建完成！'
PRINT '=========================================='
PRINT ''
PRINT '📝 設計說明:'
PRINT '1. company_id = NULL: 系統默認權限，適用於所有公司'
PRINT '2. company_id = 具體值: 公司自定義權限，覆蓋系統默認'
PRINT '3. 權限查詢邏輯: 優先使用公司自定義，無則使用系統默認'
PRINT '4. 每個公司可以有自己的權限配置，實現完全的多租戶隔離'
PRINT ''
GO

