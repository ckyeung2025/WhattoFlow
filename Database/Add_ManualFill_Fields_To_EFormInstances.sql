-- 為 eFormInstances 表添加 Manual Fill 支持的新字段
-- 執行日期: 2025-10-12

USE [PurpleRice]
GO

-- 檢查並添加 FillType 欄位
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[eFormInstances]') AND name = 'FillType')
BEGIN
    ALTER TABLE [dbo].[eFormInstances]
    ADD [FillType] NVARCHAR(50) NULL;
    
    PRINT '已添加 FillType 欄位';
END
ELSE
BEGIN
    PRINT 'FillType 欄位已存在';
END
GO

-- 檢查並添加 RecipientWhatsAppNo 欄位
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[eFormInstances]') AND name = 'RecipientWhatsAppNo')
BEGIN
    ALTER TABLE [dbo].[eFormInstances]
    ADD [RecipientWhatsAppNo] NVARCHAR(50) NULL;
    
    PRINT '已添加 RecipientWhatsAppNo 欄位';
END
ELSE
BEGIN
    PRINT 'RecipientWhatsAppNo 欄位已存在';
END
GO

-- 檢查並添加 RecipientName 欄位
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[eFormInstances]') AND name = 'RecipientName')
BEGIN
    ALTER TABLE [dbo].[eFormInstances]
    ADD [RecipientName] NVARCHAR(200) NULL;
    
    PRINT '已添加 RecipientName 欄位';
END
ELSE
BEGIN
    PRINT 'RecipientName 欄位已存在';
END
GO

-- 檢查並添加 ParentInstanceId 欄位
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[eFormInstances]') AND name = 'ParentInstanceId')
BEGIN
    ALTER TABLE [dbo].[eFormInstances]
    ADD [ParentInstanceId] UNIQUEIDENTIFIER NULL;
    
    PRINT '已添加 ParentInstanceId 欄位';
END
ELSE
BEGIN
    PRINT 'ParentInstanceId 欄位已存在';
END
GO

-- 檢查並添加 AccessToken 欄位
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[eFormInstances]') AND name = 'AccessToken')
BEGIN
    ALTER TABLE [dbo].[eFormInstances]
    ADD [AccessToken] NVARCHAR(MAX) NULL;
    
    PRINT '已添加 AccessToken 欄位';
END
ELSE
BEGIN
    PRINT 'AccessToken 欄位已存在';
END
GO

-- 檢查並添加 TokenExpiresAt 欄位
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[eFormInstances]') AND name = 'TokenExpiresAt')
BEGIN
    ALTER TABLE [dbo].[eFormInstances]
    ADD [TokenExpiresAt] DATETIME2 NULL;
    
    PRINT '已添加 TokenExpiresAt 欄位';
END
ELSE
BEGIN
    PRINT 'TokenExpiresAt 欄位已存在';
END
GO

-- 驗證所有欄位都已添加
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

PRINT '=== Manual Fill 欄位添加完成 ===';
GO

