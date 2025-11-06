-- =============================================
-- CompanyPhoneVerification 表
-- 用於管理 WhatsApp 電話號碼驗證流程
-- =============================================

USE [PurpleRice]
GO

-- 檢查表是否已存在
IF NOT EXISTS (
    SELECT 1 
    FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_NAME = 'CompanyPhoneVerification'
)
BEGIN
    PRINT '創建 CompanyPhoneVerification 表...'
    
    CREATE TABLE CompanyPhoneVerification (
        Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        CompanyId UNIQUEIDENTIFIER NOT NULL,
        PhoneNumber NVARCHAR(20) NOT NULL,
        Certificate NVARCHAR(MAX) NOT NULL,  -- Base64 編碼憑證
        CertificateExpiry DATETIME2,
        
        -- 驗證狀態: Pending, Requested, Verified, Expired, Failed
        Status NVARCHAR(50) NOT NULL DEFAULT 'Pending',
        VerificationCode NVARCHAR(10),  -- 6位 OTP（僅用於記錄，實際由 Meta 發送）
        CodeExpiry DATETIME2,
        CodeMethod NVARCHAR(20),  -- SMS 或 VOICE
        
        -- WhatsApp API 返回的信息
        PhoneNumberId NVARCHAR(200),  -- Meta 返回的 Phone Number ID
        RequestId NVARCHAR(200),  -- Meta API 請求 ID
        
        -- 元數據
        CreatedAt DATETIME2 DEFAULT GETDATE(),
        UpdatedAt DATETIME2,
        CreatedBy NVARCHAR(100),
        
        -- 錯誤信息
        ErrorMessage NVARCHAR(MAX),
        
        -- 外鍵關聯
        CONSTRAINT FK_CompanyPhoneVerification_Company 
            FOREIGN KEY (CompanyId) REFERENCES Companies(Id)
    );
    
    PRINT '✅ CompanyPhoneVerification 表創建成功！'
END
ELSE
BEGIN
    PRINT '⚠️ CompanyPhoneVerification 表已存在，跳過創建'
END
GO

-- 創建索引
IF NOT EXISTS (
    SELECT 1 
    FROM sys.indexes 
    WHERE name = 'IX_CompanyPhoneVerification_CompanyId' 
    AND object_id = OBJECT_ID('CompanyPhoneVerification')
)
BEGIN
    CREATE INDEX IX_CompanyPhoneVerification_CompanyId 
    ON CompanyPhoneVerification(CompanyId);
    PRINT '✅ 索引 IX_CompanyPhoneVerification_CompanyId 創建成功'
END
GO

IF NOT EXISTS (
    SELECT 1 
    FROM sys.indexes 
    WHERE name = 'IX_CompanyPhoneVerification_Status' 
    AND object_id = OBJECT_ID('CompanyPhoneVerification')
)
BEGIN
    CREATE INDEX IX_CompanyPhoneVerification_Status 
    ON CompanyPhoneVerification(Status);
    PRINT '✅ 索引 IX_CompanyPhoneVerification_Status 創建成功'
END
GO

-- 顯示表結構
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
PRINT '✅ CompanyPhoneVerification 表創建完成！'
PRINT '=========================================='
GO

