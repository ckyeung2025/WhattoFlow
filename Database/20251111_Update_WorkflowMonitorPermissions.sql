GO

DECLARE @Now DATETIME2(3) = SYSUTCDATETIME();

DECLARE @WrongKeys TABLE (interface_key NVARCHAR(100));
INSERT INTO @WrongKeys(interface_key)
VALUES (N'permissionManagement.delete'), (N'permissionManagement.cancel');

DECLARE @CorrectKeys TABLE (interface_key NVARCHAR(100));
INSERT INTO @CorrectKeys(interface_key)
VALUES 
(N'workflowMonitor.cancel'), 
(N'workflowMonitor.delete'),
(N'workflowMonitor.whatsappChat'),
(N'workflowMonitor.pause'),
(N'workflowMonitor.resume'),
(N'workflowMonitor.retry');

DECLARE @TargetRoles TABLE (
    role_id UNIQUEIDENTIFIER PRIMARY KEY,
    role_name NVARCHAR(100)
);

INSERT INTO @TargetRoles (role_id, role_name)
SELECT id, name
FROM dbo.roles
WHERE name IN (N'Tenant_Admin', N'Company_Admin');

DECLARE @Companies TABLE (
    company_id UNIQUEIDENTIFIER PRIMARY KEY
);

INSERT INTO @Companies (company_id)
SELECT id FROM dbo.companies;

----------------------------------------------------------
-- 1) 移除錯誤的權限鍵
----------------------------------------------------------
DELETE ri
FROM dbo.roles_interface AS ri
INNER JOIN @WrongKeys wk ON ri.interface_key = wk.interface_key
INNER JOIN @TargetRoles tr ON ri.role_id = tr.role_id;

----------------------------------------------------------
-- 2) 新增正確的全局權限（company_id IS NULL）
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

----------------------------------------------------------
-- 3) 為每家公司新增正確權限
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

GO
