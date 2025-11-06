-- =============================================
-- 完整的 Manual Fill 功能設置
-- 1. 添加 eFormInstances 表的新欄位
-- 2. 修復 workflow_message_recipients 的 recipient_type 約束
-- 執行日期: 2025-10-12
-- =============================================

USE [PurpleRice]
GO

PRINT '========================================';
PRINT '開始 Manual Fill 功能完整設置';
PRINT '========================================';
PRINT '';

-- =============================================
-- 第一部分：添加 eFormInstances 表的新欄位
-- =============================================
PRINT '第一部分：更新 eFormInstances 表';
PRINT '----------------------------------------';

-- 檢查並添加 FillType 欄位
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[eFormInstances]') AND name = 'FillType')
BEGIN
    ALTER TABLE [dbo].[eFormInstances]
    ADD [FillType] NVARCHAR(50) NULL;
    
    PRINT '✅ 已添加 FillType 欄位';
END
ELSE
BEGIN
    PRINT '⚠️ FillType 欄位已存在';
END
GO

-- 檢查並添加 RecipientWhatsAppNo 欄位
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[eFormInstances]') AND name = 'RecipientWhatsAppNo')
BEGIN
    ALTER TABLE [dbo].[eFormInstances]
    ADD [RecipientWhatsAppNo] NVARCHAR(50) NULL;
    
    PRINT '✅ 已添加 RecipientWhatsAppNo 欄位';
END
ELSE
BEGIN
    PRINT '⚠️ RecipientWhatsAppNo 欄位已存在';
END
GO

-- 檢查並添加 RecipientName 欄位
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[eFormInstances]') AND name = 'RecipientName')
BEGIN
    ALTER TABLE [dbo].[eFormInstances]
    ADD [RecipientName] NVARCHAR(200) NULL;
    
    PRINT '✅ 已添加 RecipientName 欄位';
END
ELSE
BEGIN
    PRINT '⚠️ RecipientName 欄位已存在';
END
GO

-- 檢查並添加 ParentInstanceId 欄位
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[eFormInstances]') AND name = 'ParentInstanceId')
BEGIN
    ALTER TABLE [dbo].[eFormInstances]
    ADD [ParentInstanceId] UNIQUEIDENTIFIER NULL;
    
    PRINT '✅ 已添加 ParentInstanceId 欄位';
END
ELSE
BEGIN
    PRINT '⚠️ ParentInstanceId 欄位已存在';
END
GO

-- 檢查並添加 AccessToken 欄位
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[eFormInstances]') AND name = 'AccessToken')
BEGIN
    ALTER TABLE [dbo].[eFormInstances]
    ADD [AccessToken] NVARCHAR(MAX) NULL;
    
    PRINT '✅ 已添加 AccessToken 欄位';
END
ELSE
BEGIN
    PRINT '⚠️ AccessToken 欄位已存在';
END
GO

-- 檢查並添加 TokenExpiresAt 欄位
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[eFormInstances]') AND name = 'TokenExpiresAt')
BEGIN
    ALTER TABLE [dbo].[eFormInstances]
    ADD [TokenExpiresAt] DATETIME2 NULL;
    
    PRINT '✅ 已添加 TokenExpiresAt 欄位';
END
ELSE
BEGIN
    PRINT '⚠️ TokenExpiresAt 欄位已存在';
END
GO

PRINT '';
PRINT '第一部分完成：eFormInstances 表更新完成';
PRINT '';

-- =============================================
-- 第二部分：修復 workflow_message_recipients 的 recipient_type 約束
-- =============================================
PRINT '第二部分：修復 recipient_type 約束';
PRINT '----------------------------------------';

-- 檢查約束是否存在
IF EXISTS (
    SELECT * FROM sys.check_constraints 
    WHERE name = 'CK_workflow_message_recipients_type'
    AND parent_object_id = OBJECT_ID('dbo.workflow_message_recipients')
)
BEGIN
    PRINT '找到約束 CK_workflow_message_recipients_type，開始刪除...';
    
    -- 刪除舊約束
    ALTER TABLE [dbo].[workflow_message_recipients]
    DROP CONSTRAINT [CK_workflow_message_recipients_type];
    
    PRINT '✅ 舊約束已刪除';
END
ELSE
BEGIN
    PRINT '⚠️ 約束 CK_workflow_message_recipients_type 不存在，將創建新約束';
END
GO

-- 添加新約束，包含所有需要的類型
ALTER TABLE [dbo].[workflow_message_recipients]
ADD CONSTRAINT [CK_workflow_message_recipients_type] 
CHECK ([recipient_type] IN (
    'User', 
    'Contact', 
    'Group', 
    'Hashtag', 
    'Initiator', 
    'PhoneNumber',
    'ProcessVariable'  -- ✅ 必須包含這個類型
));

PRINT '✅ 新約束已創建，包含所有必要的類型';
GO

PRINT '';
PRINT '第二部分完成：recipient_type 約束已修復';
PRINT '';

-- =============================================
-- 驗證結果
-- =============================================
PRINT '========================================';
PRINT '驗證設置結果';
PRINT '========================================';
PRINT '';

-- 驗證 eFormInstances 表的欄位
PRINT '1. eFormInstances 表的新欄位：';
SELECT 
    c.name AS ColumnName,
    t.name AS DataType,
    c.max_length AS MaxLength,
    c.is_nullable AS IsNullable
FROM sys.columns c
INNER JOIN sys.types t ON c.user_type_id = t.user_type_id
WHERE c.object_id = OBJECT_ID(N'[dbo].[eFormInstances]')
    AND c.name IN ('FillType', 'RecipientWhatsAppNo', 'RecipientName', 'ParentInstanceId', 'AccessToken', 'TokenExpiresAt')
ORDER BY c.name;

PRINT '';
PRINT '2. workflow_message_recipients 表的約束：';
SELECT 
    name AS CONSTRAINT_NAME,
    definition AS CHECK_DEFINITION
FROM sys.check_constraints
WHERE parent_object_id = OBJECT_ID('dbo.workflow_message_recipients')
AND name = 'CK_workflow_message_recipients_type';

PRINT '';
PRINT '========================================';
PRINT '✅ Manual Fill 功能設置完成！';
PRINT '========================================';
GO

