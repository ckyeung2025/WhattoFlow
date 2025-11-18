-- =============================================
-- 更新 WorkflowMonitor 權限
-- 文件名: Database/20251111_Update_WorkflowMonitorPermissions.sql
-- 日期: 2025-11-11
-- 說明: 
--   1. 移除錯誤的權限鍵（permissionManagement.delete, permissionManagement.cancel）
--   2. 為 Tenant_Admin 和 Company_Admin 角色新增正確的 workflowMonitor 子權限
--   3. 同時更新系統默認權限（company_id IS NULL）和所有公司的權限
-- =============================================

GO

DECLARE @Now DATETIME2(3) = SYSUTCDATETIME();

-- 定義錯誤的權限鍵（這些應該被刪除）
DECLARE @WrongKeys TABLE (interface_key NVARCHAR(100));
INSERT INTO @WrongKeys(interface_key)
VALUES (N'permissionManagement.delete'), (N'permissionManagement.cancel');

-- 定義正確的 workflowMonitor 子權限鍵
DECLARE @CorrectKeys TABLE (interface_key NVARCHAR(100));
INSERT INTO @CorrectKeys(interface_key)
VALUES 
(N'workflowMonitor.cancel'), 
(N'workflowMonitor.delete'),
(N'workflowMonitor.whatsappChat'),
(N'workflowMonitor.pause'),
(N'workflowMonitor.resume'),
(N'workflowMonitor.retry');

-- 目標角色：Tenant_Admin 和 Company_Admin
DECLARE @TargetRoles TABLE (
    role_id UNIQUEIDENTIFIER PRIMARY KEY,
    role_name NVARCHAR(100)
);

INSERT INTO @TargetRoles (role_id, role_name)
SELECT id, name
FROM dbo.roles
WHERE name IN (N'Tenant_Admin', N'Company_Admin');

-- 獲取所有公司
DECLARE @Companies TABLE (
    company_id UNIQUEIDENTIFIER PRIMARY KEY
);

INSERT INTO @Companies (company_id)
SELECT id FROM dbo.companies;

----------------------------------------------------------
-- 1) 移除錯誤的權限鍵（針對所有角色，不限於目標角色）
-- 因為這些錯誤的權限鍵可能被錯誤地分配給任何角色
----------------------------------------------------------
DELETE ri
FROM dbo.roles_interface AS ri
INNER JOIN @WrongKeys wk ON ri.interface_key = wk.interface_key;

PRINT '✅ 已移除錯誤的權限鍵: permissionManagement.delete, permissionManagement.cancel';

----------------------------------------------------------
-- 2) 新增正確的全局權限（company_id IS NULL）
-- 為 Tenant_Admin 和 Company_Admin 角色添加系統默認權限
----------------------------------------------------------
INSERT INTO dbo.roles_interface (
    id,
    role_id,
    company_id,
    interface_key,
    created_at,
    updated_at,
    is_active
)
SELECT NEWID(),
       tr.role_id,
       NULL,
       ck.interface_key,
       @Now,
       @Now,
       1
FROM @TargetRoles tr
CROSS JOIN @CorrectKeys ck
WHERE NOT EXISTS (
    SELECT 1
    FROM dbo.roles_interface ri
    WHERE ri.role_id = tr.role_id
      AND ri.company_id IS NULL
      AND ri.interface_key = ck.interface_key
);

DECLARE @GlobalInsertedCount INT = @@ROWCOUNT;
PRINT '✅ 已新增 ' + CAST(@GlobalInsertedCount AS NVARCHAR(10)) + ' 筆系統默認權限（company_id IS NULL）';

----------------------------------------------------------
-- 3) 為每家公司新增正確權限
-- 為所有現有公司添加 Tenant_Admin 和 Company_Admin 的 workflowMonitor 子權限
----------------------------------------------------------
INSERT INTO dbo.roles_interface (
    id,
    role_id,
    company_id,
    interface_key,
    created_at,
    updated_at,
    is_active
)
SELECT NEWID(),
       tr.role_id,
       c.company_id,
       ck.interface_key,
       @Now,
       @Now,
       1
FROM @TargetRoles tr
CROSS JOIN @Companies c
CROSS JOIN @CorrectKeys ck
WHERE NOT EXISTS (
    SELECT 1
    FROM dbo.roles_interface ri
    WHERE ri.role_id = tr.role_id
      AND ri.company_id = c.company_id
      AND ri.interface_key = ck.interface_key
);

DECLARE @CompanyInsertedCount INT = @@ROWCOUNT;
PRINT '✅ 已新增 ' + CAST(@CompanyInsertedCount AS NVARCHAR(10)) + ' 筆公司專屬權限';

----------------------------------------------------------
-- 4) 驗證結果
----------------------------------------------------------
PRINT '';
PRINT '==========================================';
PRINT '📋 更新結果摘要:';
PRINT '==========================================';
PRINT '目標角色: Tenant_Admin, Company_Admin';
PRINT '新增的權限鍵:';
PRINT '  - workflowMonitor.cancel';
PRINT '  - workflowMonitor.delete';
PRINT '  - workflowMonitor.whatsappChat';
PRINT '  - workflowMonitor.pause';
PRINT '  - workflowMonitor.resume';
PRINT '  - workflowMonitor.retry';
PRINT '==========================================';
PRINT '';

GO
