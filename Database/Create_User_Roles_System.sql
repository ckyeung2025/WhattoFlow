-- =============================================
-- 更新用戶角色系統
-- 添加缺少的欄位到現有的角色表
-- =============================================

USE [PurpleRice]
GO

-- 1. 檢查並添加缺少的欄位到現有的 roles 表
PRINT '開始檢查並添加缺少的欄位...';

-- 添加 is_system_role 欄位
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('roles') AND name = 'is_system_role')
BEGIN
    ALTER TABLE [dbo].[roles] ADD [is_system_role] BIT NOT NULL DEFAULT 0;
    PRINT '✅ 已添加 is_system_role 欄位';
END
ELSE
BEGIN
    PRINT '⚠️ is_system_role 欄位已存在';
END
GO

-- 添加 is_active 欄位
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('roles') AND name = 'is_active')
BEGIN
    ALTER TABLE [dbo].[roles] ADD [is_active] BIT NOT NULL DEFAULT 1;
    PRINT '✅ 已添加 is_active 欄位';
END
ELSE
BEGIN
    PRINT '⚠️ is_active 欄位已存在';
END
GO

-- 修改 company_id 為可空（允許系統級角色）
IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('roles') AND name = 'company_id' AND is_nullable = 0)
BEGIN
    ALTER TABLE [dbo].[roles] ALTER COLUMN [company_id] UNIQUEIDENTIFIER NULL;
    PRINT '✅ 已修改 company_id 欄位為可空';
END
ELSE
BEGIN
    PRINT '⚠️ company_id 欄位已經是可空或不存在';
END
GO

-- 擴展 name 欄位長度（如果需要）
IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('roles') AND name = 'name' AND character_maximum_length < 100)
BEGIN
    ALTER TABLE [dbo].[roles] ALTER COLUMN [name] NVARCHAR(100) NOT NULL;
    PRINT '✅ 已擴展 name 欄位長度到 100';
END
ELSE
BEGIN
    PRINT '⚠️ name 欄位長度已經是 100 或更大';
END
GO

-- 擴展 description 欄位長度（如果需要）
IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('roles') AND name = 'description' AND character_maximum_length < 500)
BEGIN
    ALTER TABLE [dbo].[roles] ALTER COLUMN [description] NVARCHAR(500) NULL;
    PRINT '✅ 已擴展 description 欄位長度到 500';
END
ELSE
BEGIN
    PRINT '⚠️ description 欄位長度已經是 500 或更大';
END
GO

-- 添加唯一約束（如果不存在）
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'UQ_roles_name_company')
BEGIN
    ALTER TABLE [dbo].[roles] ADD CONSTRAINT [UQ_roles_name_company] UNIQUE ([name], [company_id]);
    PRINT '✅ 已添加唯一約束 UQ_roles_name_company';
END
ELSE
BEGIN
    PRINT '⚠️ 唯一約束 UQ_roles_name_company 已存在';
END
GO

-- 2. 檢查並添加缺少的欄位到現有的 user_roles 表
PRINT '開始檢查並添加 user_roles 表的缺少欄位...';

-- 添加 id 欄位（如果不存在）
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('user_roles') AND name = 'id')
BEGIN
    ALTER TABLE [dbo].[user_roles] ADD [id] UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID();
    PRINT '✅ 已添加 id 欄位';
END
ELSE
BEGIN
    PRINT '⚠️ id 欄位已存在';
END
GO

-- 添加 assigned_by 欄位（如果不存在）
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('user_roles') AND name = 'assigned_by')
BEGIN
    ALTER TABLE [dbo].[user_roles] ADD [assigned_by] UNIQUEIDENTIFIER NULL;
    PRINT '✅ 已添加 assigned_by 欄位';
END
ELSE
BEGIN
    PRINT '⚠️ assigned_by 欄位已存在';
END
GO

-- 添加 assigned_at 欄位（如果不存在）
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('user_roles') AND name = 'assigned_at')
BEGIN
    ALTER TABLE [dbo].[user_roles] ADD [assigned_at] DATETIME2 NOT NULL DEFAULT GETUTCDATE();
    PRINT '✅ 已添加 assigned_at 欄位';
END
ELSE
BEGIN
    PRINT '⚠️ assigned_at 欄位已存在';
END
GO

-- 添加 is_active 欄位（如果不存在）
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('user_roles') AND name = 'is_active')
BEGIN
    ALTER TABLE [dbo].[user_roles] ADD [is_active] BIT NOT NULL DEFAULT 1;
    PRINT '✅ 已添加 is_active 欄位';
END
ELSE
BEGIN
    PRINT '⚠️ is_active 欄位已存在';
END
GO

-- 添加 created_at 欄位（如果不存在）
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('user_roles') AND name = 'created_at')
BEGIN
    ALTER TABLE [dbo].[user_roles] ADD [created_at] DATETIME2 NOT NULL DEFAULT GETUTCDATE();
    PRINT '✅ 已添加 created_at 欄位';
END
ELSE
BEGIN
    PRINT '⚠️ created_at 欄位已存在';
END
GO

-- 添加 updated_at 欄位（如果不存在）
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('user_roles') AND name = 'updated_at')
BEGIN
    ALTER TABLE [dbo].[user_roles] ADD [updated_at] DATETIME2 NOT NULL DEFAULT GETUTCDATE();
    PRINT '✅ 已添加 updated_at 欄位';
END
ELSE
BEGIN
    PRINT '⚠️ updated_at 欄位已存在';
END
GO

-- 檢查並添加主鍵約束（如果不存在）
IF NOT EXISTS (SELECT * FROM sys.key_constraints WHERE name = 'PK_user_roles')
BEGIN
    -- 如果沒有主鍵，添加一個
    ALTER TABLE [dbo].[user_roles] ADD CONSTRAINT [PK_user_roles] PRIMARY KEY CLUSTERED ([id] ASC);
    PRINT '✅ 已添加主鍵約束 PK_user_roles';
END
ELSE
BEGIN
    PRINT '⚠️ 主鍵約束 PK_user_roles 已存在';
END
GO

-- 檢查並添加外鍵約束（如果不存在）
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_user_roles_users')
BEGIN
    ALTER TABLE [dbo].[user_roles] ADD CONSTRAINT [FK_user_roles_users] 
        FOREIGN KEY ([user_id]) REFERENCES [users]([id]) ON DELETE CASCADE;
    PRINT '✅ 已添加外鍵約束 FK_user_roles_users';
END
ELSE
BEGIN
    PRINT '⚠️ 外鍵約束 FK_user_roles_users 已存在';
END
GO

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_user_roles_roles')
BEGIN
    ALTER TABLE [dbo].[user_roles] ADD CONSTRAINT [FK_user_roles_roles] 
        FOREIGN KEY ([role_id]) REFERENCES [roles]([id]) ON DELETE CASCADE;
    PRINT '✅ 已添加外鍵約束 FK_user_roles_roles';
END
ELSE
BEGIN
    PRINT '⚠️ 外鍵約束 FK_user_roles_roles 已存在';
END
GO

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_user_roles_assigned_by')
BEGIN
    ALTER TABLE [dbo].[user_roles] ADD CONSTRAINT [FK_user_roles_assigned_by] 
        FOREIGN KEY ([assigned_by]) REFERENCES [users]([id]) ON DELETE SET NULL;
    PRINT '✅ 已添加外鍵約束 FK_user_roles_assigned_by';
END
ELSE
BEGIN
    PRINT '⚠️ 外鍵約束 FK_user_roles_assigned_by 已存在';
END
GO

-- 檢查並添加唯一約束（如果不存在）
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'UQ_user_roles_user_role')
BEGIN
    ALTER TABLE [dbo].[user_roles] ADD CONSTRAINT [UQ_user_roles_user_role] UNIQUE ([user_id], [role_id]);
    PRINT '✅ 已添加唯一約束 UQ_user_roles_user_role';
END
ELSE
BEGIN
    PRINT '⚠️ 唯一約束 UQ_user_roles_user_role 已存在';
END
GO

-- 3. 插入預設角色
PRINT '開始插入預設角色...';

-- 清空現有的自定義角色（保留系統角色）
DELETE FROM [dbo].[roles] WHERE [is_system_role] = 0 OR [is_system_role] IS NULL;
GO

-- 插入系統預設角色
INSERT INTO [dbo].[roles] ([id], [company_id], [name], [description], [is_system_role], [is_active], [created_at], [updated_at]) VALUES
(NEWID(), NULL, 'Tenant_Admin', '租戶管理員 - 管理所有公司，擁有所有權限', 1, 1, GETUTCDATE(), GETUTCDATE()),
(NEWID(), NULL, 'Company_Admin', '公司管理員 - 管理自己公司的所有功能', 1, 1, GETUTCDATE(), GETUTCDATE()),
(NEWID(), NULL, 'Designer', '設計師 - 在公司內進行表單和流程設計', 1, 1, GETUTCDATE(), GETUTCDATE()),
(NEWID(), NULL, 'Approver', '審批者 - 在公司內進行審批和拒絕操作', 1, 1, GETUTCDATE(), GETUTCDATE());
GO

PRINT '✅ 預設角色插入完成';

-- 4. 創建索引
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_roles_company_id')
BEGIN
    CREATE INDEX [IX_roles_company_id] ON [dbo].[roles] ([company_id]);
    PRINT '✅ 創建索引 IX_roles_company_id';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_roles_is_system_role')
BEGIN
    CREATE INDEX [IX_roles_is_system_role] ON [dbo].[roles] ([is_system_role]);
    PRINT '✅ 創建索引 IX_roles_is_system_role';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_user_roles_user_id')
BEGIN
    CREATE INDEX [IX_user_roles_user_id] ON [dbo].[user_roles] ([user_id]);
    PRINT '✅ 創建索引 IX_user_roles_user_id';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_user_roles_role_id')
BEGIN
    CREATE INDEX [IX_user_roles_role_id] ON [dbo].[user_roles] ([role_id]);
    PRINT '✅ 創建索引 IX_user_roles_role_id';
END

-- 5. 顯示更新結果
PRINT ''
PRINT '=========================================='
PRINT '✅ 用戶角色系統更新完成！'
PRINT '=========================================='
PRINT ''
PRINT '📋 已更新的表:'
PRINT '- roles: 角色表（添加了 is_system_role, is_active 欄位）'
PRINT '- user_roles: 用戶角色關聯表（添加了缺少的欄位和約束）'
PRINT ''
PRINT '🔄 對現有 roles 表的修改:'
PRINT '1. 添加 is_system_role 欄位（標識系統預設角色）'
PRINT '2. 添加 is_active 欄位（標識角色是否啟用）'
PRINT '3. 修改 company_id 為可空（支持系統級角色）'
PRINT '4. 擴展欄位長度以支持更長的角色名稱和描述'
PRINT '5. 添加唯一約束確保角色名稱在同一公司內唯一'
PRINT ''
PRINT '🔄 對現有 user_roles 表的修改:'
PRINT '1. 添加 id 欄位（主鍵）'
PRINT '2. 添加 assigned_by 欄位（分配者）'
PRINT '3. 添加 assigned_at 欄位（分配時間）'
PRINT '4. 添加 is_active 欄位（是否啟用）'
PRINT '5. 添加 created_at 欄位（創建時間）'
PRINT '6. 添加 updated_at 欄位（更新時間）'
PRINT '7. 添加主鍵約束'
PRINT '8. 添加外鍵約束'
PRINT '9. 添加唯一約束（防止重複分配）'
PRINT ''
PRINT '🎭 預設角色:'
PRINT '1. Tenant_Admin - 租戶管理員'
PRINT '2. Company_Admin - 公司管理員'  
PRINT '3. Designer - 設計師'
PRINT '4. Approver - 審批者'
PRINT ''
PRINT '📝 下一步:'
PRINT '1. 更新前端頁面以支持角色選擇'
PRINT '2. 創建角色管理API接口'
PRINT '3. 實現權限控制邏輯'
PRINT ''

-- 6. 驗證數據
SELECT 
    r.[name] AS '角色名稱',
    r.[description] AS '角色描述',
    CASE r.[is_system_role] WHEN 1 THEN '系統角色' ELSE '自定義角色' END AS '角色類型',
    CASE WHEN r.[company_id] IS NULL THEN '全域' ELSE c.[name] END AS '適用範圍'
FROM [dbo].[roles] r
LEFT JOIN [dbo].[companies] c ON r.[company_id] = c.[id]
ORDER BY r.[is_system_role] DESC, r.[name];

GO
