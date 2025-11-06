-- =============================================
-- 添加 WA_Business_Account_ID 欄位到 Companies 表
-- 用於 Meta WhatsApp Business API 整合
-- =============================================

USE [PurpleRice]
GO

-- 檢查欄位是否已存在
IF NOT EXISTS (
    SELECT 1 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'Companies' 
    AND COLUMN_NAME = 'WA_Business_Account_ID'
)
BEGIN
    PRINT '添加 WA_Business_Account_ID 欄位...'
    
    ALTER TABLE Companies
    ADD WA_Business_Account_ID NVARCHAR(200) NULL;
    
    PRINT '✅ WA_Business_Account_ID 欄位添加成功！'
END
ELSE
BEGIN
    PRINT '⚠️ WA_Business_Account_ID 欄位已存在，跳過添加'
END
GO

-- 顯示更新後的 Companies 表結構
SELECT 
    COLUMN_NAME AS '欄位名稱',
    DATA_TYPE AS '資料類型',
    CHARACTER_MAXIMUM_LENGTH AS '最大長度',
    IS_NULLABLE AS '可為空'
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'Companies'
AND COLUMN_NAME LIKE 'WA_%'
ORDER BY ORDINAL_POSITION;
GO

PRINT ''
PRINT '=========================================='
PRINT '✅ 遷移完成！'
PRINT '=========================================='
PRINT ''
PRINT '📝 下一步：'
PRINT '1. 前往 Meta Business Suite'
PRINT '2. 找到您的 WhatsApp Business Account ID'
PRINT '3. 在系統的公司設定中更新此欄位'
PRINT ''
GO

