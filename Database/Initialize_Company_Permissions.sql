-- =============================================
-- 為所有現有公司初始化權限設置
-- 文件名: Database/Initialize_Company_Permissions.sql
-- 說明: 為每個公司複製系統默認權限，使每個公司都有自己獨立的權限配置
-- =============================================

USE [PurpleRice]
GO

-- =============================================
-- 1. 為所有現有公司初始化權限（從系統默認權限複製）
-- =============================================

DECLARE @CompanyId UNIQUEIDENTIFIER;
DECLARE @RoleId UNIQUEIDENTIFIER;
DECLARE @InterfaceKey NVARCHAR(100);
DECLARE @SystemDefaultId UNIQUEIDENTIFIER;

-- 獲取所有公司（companies 表沒有 is_active 欄位）
DECLARE company_cursor CURSOR FOR
SELECT id FROM [dbo].[companies];

-- 獲取所有角色
DECLARE role_cursor CURSOR FOR
SELECT id FROM [dbo].[roles] WHERE is_active = 1;

OPEN company_cursor;
FETCH NEXT FROM company_cursor INTO @CompanyId;

WHILE @@FETCH_STATUS = 0
BEGIN
    PRINT '正在為公司 ' + CAST(@CompanyId AS NVARCHAR(50)) + ' 初始化權限...';
    
    -- 為每個角色初始化權限
    OPEN role_cursor;
    FETCH NEXT FROM role_cursor INTO @RoleId;
    
    WHILE @@FETCH_STATUS = 0
    BEGIN
        -- 獲取該角色的系統默認權限
        DECLARE interface_cursor CURSOR FOR
        SELECT interface_key 
        FROM [dbo].[roles_interface] 
        WHERE role_id = @RoleId 
          AND company_id IS NULL 
          AND is_active = 1;
        
        OPEN interface_cursor;
        FETCH NEXT FROM interface_cursor INTO @InterfaceKey;
        
        WHILE @@FETCH_STATUS = 0
        BEGIN
            -- 檢查該公司是否已經有此權限配置
            IF NOT EXISTS (
                SELECT 1 
                FROM [dbo].[roles_interface] 
                WHERE role_id = @RoleId 
                  AND company_id = @CompanyId 
                  AND interface_key = @InterfaceKey
            )
            BEGIN
                -- 插入公司專屬權限（從系統默認複製）
                INSERT INTO [dbo].[roles_interface] (
                    [id],
                    [role_id],
                    [company_id],
                    [interface_key],
                    [created_at],
                    [updated_at],
                    [is_active]
                )
                VALUES (
                    NEWID(),
                    @RoleId,
                    @CompanyId,
                    @InterfaceKey,
                    GETUTCDATE(),
                    GETUTCDATE(),
                    1
                );
                
                PRINT '  已為角色 ' + CAST(@RoleId AS NVARCHAR(50)) + ' 添加權限: ' + @InterfaceKey;
            END
            ELSE
            BEGIN
                PRINT '  角色 ' + CAST(@RoleId AS NVARCHAR(50)) + ' 的權限 ' + @InterfaceKey + ' 已存在，跳過';
            END
            
            FETCH NEXT FROM interface_cursor INTO @InterfaceKey;
        END
        
        CLOSE interface_cursor;
        DEALLOCATE interface_cursor;
        
        FETCH NEXT FROM role_cursor INTO @RoleId;
    END
    
    CLOSE role_cursor;
    FETCH NEXT FROM company_cursor INTO @CompanyId;
END

CLOSE company_cursor;
DEALLOCATE company_cursor;
DEALLOCATE role_cursor;

PRINT '✅ 所有公司的權限初始化完成！';

-- =============================================
-- 2. 驗證結果：查看每個公司的權限數量
-- =============================================
SELECT 
    c.id AS company_id,
    c.name AS company_name,
    r.name AS role_name,
    COUNT(ri.id) AS permission_count
FROM [dbo].[companies] c
CROSS JOIN [dbo].[roles] r
LEFT JOIN [dbo].[roles_interface] ri ON ri.company_id = c.id AND ri.role_id = r.id AND ri.is_active = 1
WHERE r.is_active = 1
GROUP BY c.id, c.name, r.name
ORDER BY c.name, r.name;

-- =============================================
-- 3. 查看系統默認權限（company_id = NULL）的數量（應該保留作為新公司的模板）
-- =============================================
SELECT 
    r.name AS role_name,
    COUNT(ri.id) AS system_default_permission_count
FROM [dbo].[roles] r
LEFT JOIN [dbo].[roles_interface] ri ON ri.role_id = r.id AND ri.company_id IS NULL AND ri.is_active = 1
WHERE r.is_active = 1
GROUP BY r.name
ORDER BY r.name;

GO

