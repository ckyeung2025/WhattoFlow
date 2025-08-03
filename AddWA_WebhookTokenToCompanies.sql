-- 添加 WA_WebhookToken 欄位到 companies 表
IF NOT EXISTS (
    SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'companies' 
    AND COLUMN_NAME = 'WA_WebhookToken'
)
BEGIN
    ALTER TABLE companies 
    ADD WA_WebhookToken NVARCHAR(255) NULL;
    
    PRINT 'WA_WebhookToken 欄位已添加到 companies 表';
END
ELSE
BEGIN
    PRINT 'WA_WebhookToken 欄位已存在於 companies 表';
END 