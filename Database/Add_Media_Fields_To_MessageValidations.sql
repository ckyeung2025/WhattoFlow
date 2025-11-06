-- 添加媒體字段到 message_validations 表
-- 用於支持圖片、音頻、視頻等媒體消息的保存

USE [PurpleRice]
GO

PRINT '========== 開始添加媒體字段到 message_validations 表 ==========';

-- 檢查 message_type 列是否已存在
IF NOT EXISTS (
    SELECT * FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[message_validations]')
    AND name = 'message_type'
)
BEGIN
    -- 添加 message_type 列
    ALTER TABLE [dbo].[message_validations]
    ADD [message_type] NVARCHAR(20) NULL;
    
    PRINT '✅ message_type 列已成功添加';
END
ELSE
BEGIN
    PRINT '⚠️ message_type 列已存在，跳過添加';
END
GO

-- 為現有記錄設置默認值為 'text'（分開執行，避免在 IF 內部使用未提交的列）
IF EXISTS (
    SELECT * FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[message_validations]')
    AND name = 'message_type'
)
BEGIN
    UPDATE [dbo].[message_validations]
    SET [message_type] = 'text'
    WHERE [message_type] IS NULL;
    
    PRINT '✅ 現有記錄的 message_type 已設置為 text';
END
GO

-- 檢查 media_id 列是否已存在
IF NOT EXISTS (
    SELECT * FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[message_validations]')
    AND name = 'media_id'
)
BEGIN
    -- 添加 media_id 列
    ALTER TABLE [dbo].[message_validations]
    ADD [media_id] NVARCHAR(200) NULL;
    
    PRINT '✅ media_id 列已成功添加';
END
ELSE
BEGIN
    PRINT '⚠️ media_id 列已存在，跳過添加';
END
GO

-- 檢查 media_url 列是否已存在
IF NOT EXISTS (
    SELECT * FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[message_validations]')
    AND name = 'media_url'
)
BEGIN
    -- 添加 media_url 列
    ALTER TABLE [dbo].[message_validations]
    ADD [media_url] NVARCHAR(500) NULL;
    
    PRINT '✅ media_url 列已成功添加';
END
ELSE
BEGIN
    PRINT '⚠️ media_url 列已存在，跳過添加';
END
GO

-- 驗證新列
PRINT '========== 驗證新列 ==========';
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    CHARACTER_MAXIMUM_LENGTH,
    IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'message_validations'
AND COLUMN_NAME IN ('message_type', 'media_id', 'media_url')
ORDER BY COLUMN_NAME;
GO

PRINT '========== 媒體字段添加完成 ==========';

