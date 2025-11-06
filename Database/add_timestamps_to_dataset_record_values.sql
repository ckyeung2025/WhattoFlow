-- 為 data_set_record_values 表添加時間戳欄位
-- 用於追蹤記錄的創建和更新時間

USE PurpleRice;
GO

-- 檢查是否已存在時間戳欄位
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_NAME = 'data_set_record_values' 
               AND COLUMN_NAME = 'created_at')
BEGIN
    ALTER TABLE data_set_record_values 
    ADD created_at DATETIME2(7) NOT NULL DEFAULT GETUTCDATE();
    
    PRINT '已添加 created_at 欄位到 data_set_record_values 表';
END
ELSE
BEGIN
    PRINT 'created_at 欄位已存在於 data_set_record_values 表';
END

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
               WHERE TABLE_NAME = 'data_set_record_values' 
               AND COLUMN_NAME = 'updated_at')
BEGIN
    ALTER TABLE data_set_record_values 
    ADD updated_at DATETIME2(7) NOT NULL DEFAULT GETUTCDATE();
    
    PRINT '已添加 updated_at 欄位到 data_set_record_values 表';
END
ELSE
BEGIN
    PRINT 'updated_at 欄位已存在於 data_set_record_values 表';
END

-- 為現有記錄設置時間戳
UPDATE data_set_record_values 
SET created_at = GETUTCDATE(),
    updated_at = GETUTCDATE()
WHERE created_at IS NULL OR updated_at IS NULL;

PRINT '已為現有記錄設置時間戳';

-- 顯示表結構確認
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'data_set_record_values'
ORDER BY ORDINAL_POSITION;
