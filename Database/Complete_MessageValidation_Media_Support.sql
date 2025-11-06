-- 完整的 message_validations 媒體支持遷移腳本
-- 添加 message_type, media_id, media_url 三個字段

USE [PurpleRice]
GO

PRINT '========== 開始完整的媒體支持遷移 ==========';
PRINT '';

-- ========== 1. 添加 message_type 列 ==========
PRINT '========== 步驟 1: 添加 message_type 列 ==========';

IF NOT EXISTS (
    SELECT * FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[message_validations]')
    AND name = 'message_type'
)
BEGIN
    ALTER TABLE [dbo].[message_validations]
    ADD [message_type] NVARCHAR(20) NULL;
    
    PRINT '✅ message_type 列已成功添加';
END
ELSE
BEGIN
    PRINT '⚠️ message_type 列已存在，跳過添加';
END
GO

-- 為現有記錄設置默認值為 'text'
PRINT '設置現有記錄的默認值...';
UPDATE [dbo].[message_validations]
SET [message_type] = 'text'
WHERE [message_type] IS NULL;

DECLARE @UpdatedRows1 INT = @@ROWCOUNT;
PRINT '✅ 已更新 ' + CAST(@UpdatedRows1 AS VARCHAR) + ' 條記錄的 message_type 為 text';
GO

-- ========== 2. 添加 media_id 列 ==========
PRINT '';
PRINT '========== 步驟 2: 添加 media_id 列 ==========';

IF NOT EXISTS (
    SELECT * FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[message_validations]')
    AND name = 'media_id'
)
BEGIN
    ALTER TABLE [dbo].[message_validations]
    ADD [media_id] NVARCHAR(200) NULL;
    
    PRINT '✅ media_id 列已成功添加';
END
ELSE
BEGIN
    PRINT '⚠️ media_id 列已存在，跳過添加';
END
GO

-- ========== 3. 添加 media_url 列 ==========
PRINT '';
PRINT '========== 步驟 3: 添加 media_url 列 ==========';

IF NOT EXISTS (
    SELECT * FROM sys.columns
    WHERE object_id = OBJECT_ID(N'[dbo].[message_validations]')
    AND name = 'media_url'
)
BEGIN
    ALTER TABLE [dbo].[message_validations]
    ADD [media_url] NVARCHAR(500) NULL;
    
    PRINT '✅ media_url 列已成功添加';
END
ELSE
BEGIN
    PRINT '⚠️ media_url 列已存在，跳過添加';
END
GO

-- ========== 4. 驗證所有新列 ==========
PRINT '';
PRINT '========== 步驟 4: 驗證所有新列 ==========';

SELECT 
    COLUMN_NAME AS '列名',
    DATA_TYPE AS '數據類型',
    CHARACTER_MAXIMUM_LENGTH AS '最大長度',
    IS_NULLABLE AS '可為空'
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'message_validations'
AND COLUMN_NAME IN ('message_type', 'media_id', 'media_url')
ORDER BY COLUMN_NAME;

PRINT '';
PRINT '========== 遷移完成 ==========';
PRINT '✅ 所有媒體字段已成功添加到 message_validations 表';
PRINT '✅ waitReply 節點現在支持文本和圖片消息';
PRINT '✅ waitForQRCode 節點的圖片也會記錄到 message_validations';
GO

