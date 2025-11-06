-- =============================================
-- 移除 CompanyPhoneVerification 表中的 PhoneNumberId 欄位
-- 因為現在使用 Company.WA_PhoneNo_ID 作為主要來源
-- =============================================

USE [PurpleRice]
GO

-- 檢查欄位是否存在
IF EXISTS (
    SELECT 1 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'CompanyPhoneVerification' 
    AND COLUMN_NAME = 'PhoneNumberId'
)
BEGIN
    PRINT '移除 PhoneNumberId 欄位...'
    
    -- 刪除欄位
    ALTER TABLE CompanyPhoneVerification
    DROP COLUMN PhoneNumberId;
    
    PRINT '✅ PhoneNumberId 欄位已移除！'
END
ELSE
BEGIN
    PRINT '⚠️ PhoneNumberId 欄位不存在，跳過移除'
END
GO

-- 顯示更新後的表結構
SELECT 
    COLUMN_NAME AS '欄位名稱',
    DATA_TYPE AS '資料類型',
    CHARACTER_MAXIMUM_LENGTH AS '最大長度',
    IS_NULLABLE AS '可為空'
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'CompanyPhoneVerification'
ORDER BY ORDINAL_POSITION;
GO

PRINT ''
PRINT '=========================================='
PRINT '✅ 欄位移除完成！'
PRINT '=========================================='
PRINT ''
PRINT '📝 注意：'
PRINT '1. 系統現在使用 Company.WA_PhoneNo_ID 作為 PhoneNumberId 的來源'
PRINT '2. 請確保公司設定中已正確配置 WA_PhoneNo_ID'
PRINT ''
GO

