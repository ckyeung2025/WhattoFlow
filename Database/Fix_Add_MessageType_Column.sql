-- 修復：添加 message_type 列到 message_validations 表

USE [PurpleRice]
GO

PRINT '========== 開始添加 message_type 列 ==========';

-- 直接添加 message_type 列
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
    PRINT '⚠️ message_type 列已存在';
END
GO

-- 為現有記錄設置默認值
UPDATE [dbo].[message_validations]
SET [message_type] = 'text'
WHERE [message_type] IS NULL;

PRINT '✅ 現有記錄的 message_type 已設置為 text';
GO

-- 驗證結果
PRINT '========== 驗證所有媒體字段 ==========';
SELECT 
    COLUMN_NAME AS '列名',
    DATA_TYPE AS '數據類型',
    CHARACTER_MAXIMUM_LENGTH AS '最大長度',
    IS_NULLABLE AS '可為空'
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'message_validations'
AND COLUMN_NAME IN ('message_type', 'media_id', 'media_url')
ORDER BY COLUMN_NAME;
GO

