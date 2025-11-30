-- =============================================
-- 初始化 Reports 報表權限
-- 文件名: Database/202501XX_Initialize_Reports_Permissions.sql
-- 日期: 2025-01-XX
-- 說明: 
--   1. 為系統角色（Tenant_Admin, Company_Admin, Designer, Approver）新增 Reports 相關權限
--   2. 同時更新系統默認權限（company_id IS NULL）和所有公司的權限
--   3. Reports 權限結構：
--      - reports (主類別)
--      - reports.daily (Daily Reports 類別)
--        - reports.daily.pendingOverview (待批事項總覽)
--        - reports.daily.workflowExecution (工作流執行日報)
--        - reports.daily.formEfficiency (表單處理效率)
--        - reports.daily.workflowHealth (工作流健康度監控)
--        - reports.daily.whatsappInteraction (WhatsApp 互動分析)
--      - reports.monthly (Monthly Reports 類別)
--        - reports.monthly.workflowPerformance (工作流效能月報)
--        - reports.monthly.formApproval (表單審批分析月報)
--        - reports.monthly.businessInsights (業務流程洞察)
--        - reports.monthly.systemUsage (系統使用統計)
--        - reports.monthly.operationalOverview (營運效能總覽)
--        - reports.monthly.processStepExecution (流程步驟執行分析)
--      - reports.realtime (Realtime Reports 類別)
--        - reports.realtime.workflowActivity (工作流活動看板)
-- =============================================

USE [PurpleRice]
GO

DECLARE @Now DATETIME2(3) = SYSUTCDATETIME();

-- 定義 Reports 相關的權限鍵
DECLARE @ReportsKeys TABLE (interface_key NVARCHAR(100), key_order INT);
INSERT INTO @ReportsKeys(interface_key, key_order)
VALUES 
-- 主類別
(N'reports', 1),
-- Daily Reports 類別和子權限
(N'reports.daily', 2),
(N'reports.daily.pendingOverview', 3),
(N'reports.daily.workflowExecution', 4),
(N'reports.daily.formEfficiency', 5),
(N'reports.daily.workflowHealth', 6),
(N'reports.daily.whatsappInteraction', 7),
-- Monthly Reports 類別和子權限
(N'reports.monthly', 8),
(N'reports.monthly.workflowPerformance', 9),
(N'reports.monthly.formApproval', 10),
(N'reports.monthly.businessInsights', 11),
(N'reports.monthly.systemUsage', 12),
(N'reports.monthly.operationalOverview', 13),
(N'reports.monthly.processStepExecution', 14),
-- Realtime Reports 類別和子權限
(N'reports.realtime', 15),
(N'reports.realtime.workflowActivity', 16);

-- 目標角色：Tenant_Admin, Company_Admin, Designer, Approver
DECLARE @TargetRoles TABLE (
    role_id UNIQUEIDENTIFIER PRIMARY KEY,
    role_name NVARCHAR(100),
    should_have_all_reports BIT  -- 是否應該擁有所有 Reports 權限
);

INSERT INTO @TargetRoles (role_id, role_name, should_have_all_reports)
SELECT id, name, 
    CASE 
        WHEN name IN (N'Tenant_Admin', N'Company_Admin') THEN 1  -- 管理員擁有所有權限
        WHEN name IN (N'Designer', N'Approver') THEN 1  -- Designer 和 Approver 也擁有所有權限（可根據需求調整）
        ELSE 0
    END
FROM dbo.roles
WHERE name IN (N'Tenant_Admin', N'Company_Admin', N'Designer', N'Approver');

-- 獲取所有公司
DECLARE @Companies TABLE (
    company_id UNIQUEIDENTIFIER PRIMARY KEY
);

INSERT INTO @Companies (company_id)
SELECT id FROM dbo.companies;

-- 獲取統計信息用於顯示
DECLARE @TargetRoleCount INT;
DECLARE @ReportsKeyCount INT;
DECLARE @CompanyCount INT;

SELECT @TargetRoleCount = COUNT(*) FROM @TargetRoles;
SELECT @ReportsKeyCount = COUNT(*) FROM @ReportsKeys;
SELECT @CompanyCount = COUNT(*) FROM @Companies;

PRINT '==========================================';
PRINT '開始初始化 Reports 權限...';
PRINT '==========================================';
PRINT '目標角色數量: ' + CAST(@TargetRoleCount AS NVARCHAR(10));
PRINT 'Reports 權限鍵數量: ' + CAST(@ReportsKeyCount AS NVARCHAR(10));
PRINT '公司數量: ' + CAST(@CompanyCount AS NVARCHAR(10));
PRINT '';

----------------------------------------------------------
-- 1) 新增系統默認權限（company_id IS NULL）
-- 為所有目標角色添加 Reports 相關權限
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
       rk.interface_key,
       @Now,
       @Now,
       1
FROM @TargetRoles tr
CROSS JOIN @ReportsKeys rk
WHERE tr.should_have_all_reports = 1
  AND NOT EXISTS (
    SELECT 1
    FROM dbo.roles_interface ri
    WHERE ri.role_id = tr.role_id
      AND ri.company_id IS NULL
      AND ri.interface_key = rk.interface_key
  );

DECLARE @GlobalInsertedCount INT = @@ROWCOUNT;
PRINT '✅ 已新增 ' + CAST(@GlobalInsertedCount AS NVARCHAR(10)) + ' 筆系統默認權限（company_id IS NULL）';

----------------------------------------------------------
-- 2) 為每家公司新增權限
-- 為所有現有公司添加目標角色的 Reports 權限
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
       rk.interface_key,
       @Now,
       @Now,
       1
FROM @TargetRoles tr
CROSS JOIN @Companies c
CROSS JOIN @ReportsKeys rk
WHERE tr.should_have_all_reports = 1
  AND NOT EXISTS (
    SELECT 1
    FROM dbo.roles_interface ri
    WHERE ri.role_id = tr.role_id
      AND ri.company_id = c.company_id
      AND ri.interface_key = rk.interface_key
  );

DECLARE @CompanyInsertedCount INT = @@ROWCOUNT;
PRINT '✅ 已新增 ' + CAST(@CompanyInsertedCount AS NVARCHAR(10)) + ' 筆公司專屬權限';

----------------------------------------------------------
-- 3) 驗證結果
----------------------------------------------------------
PRINT '';
PRINT '==========================================';
PRINT '📋 更新結果摘要:';
PRINT '==========================================';
PRINT '目標角色: Tenant_Admin, Company_Admin, Designer, Approver';
PRINT '新增的權限鍵:';
SELECT 
    '  - ' + interface_key AS '權限鍵'
FROM @ReportsKeys
ORDER BY key_order;

PRINT '';
PRINT '系統默認權限統計（company_id IS NULL）:';
SELECT 
    r.name AS '角色名稱',
    COUNT(DISTINCT ri.interface_key) AS '權限數量'
FROM dbo.roles_interface ri
INNER JOIN dbo.roles r ON ri.role_id = r.id
INNER JOIN @ReportsKeys rk ON ri.interface_key = rk.interface_key
WHERE ri.company_id IS NULL
  AND r.name IN (N'Tenant_Admin', N'Company_Admin', N'Designer', N'Approver')
GROUP BY r.name
ORDER BY r.name;

PRINT '';
PRINT '公司專屬權限統計（按公司分組）:';
SELECT 
    c.name AS '公司名稱',
    r.name AS '角色名稱',
    COUNT(DISTINCT ri.interface_key) AS '權限數量'
FROM dbo.roles_interface ri
INNER JOIN dbo.roles r ON ri.role_id = r.id
INNER JOIN dbo.companies c ON ri.company_id = c.id
INNER JOIN @ReportsKeys rk ON ri.interface_key = rk.interface_key
WHERE ri.company_id IS NOT NULL
  AND r.name IN (N'Tenant_Admin', N'Company_Admin', N'Designer', N'Approver')
GROUP BY c.name, r.name
ORDER BY c.name, r.name;

PRINT '';
PRINT '公司專屬權限總覽（按公司統計）:';
SELECT 
    c.name AS '公司名稱',
    COUNT(DISTINCT ri.role_id) AS '角色數量',
    COUNT(DISTINCT ri.interface_key) AS '權限總數',
    COUNT(*) AS '權限記錄數'
FROM dbo.roles_interface ri
INNER JOIN dbo.companies c ON ri.company_id = c.id
INNER JOIN @ReportsKeys rk ON ri.interface_key = rk.interface_key
WHERE ri.company_id IS NOT NULL
GROUP BY c.name
ORDER BY c.name;

PRINT '';
PRINT '==========================================';
PRINT '✅ Reports 權限初始化完成！';
PRINT '==========================================';
PRINT '';
PRINT '📝 權限說明:';
PRINT '1. reports: 報表主類別權限';
PRINT '2. reports.daily: Daily Reports 類別權限';
PRINT '3. reports.monthly: Monthly Reports 類別權限';
PRINT '4. 每個具體報表都有獨立的權限鍵，可單獨授權';
PRINT '5. 擁有父級權限（如 reports.daily）會自動包含所有子級權限';
PRINT '';

GO

