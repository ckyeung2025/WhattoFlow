-- 驗證 workflow_message_sends 和 workflow_message_recipients 表的結構
USE [PurpleRice_DB]
GO

PRINT '========== workflow_message_sends 表結構 ==========' 
-- 查看 workflow_message_sends 表的所有列
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    CHARACTER_MAXIMUM_LENGTH,
    IS_NULLABLE,
    COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'workflow_message_sends'
ORDER BY ORDINAL_POSITION;
GO

PRINT '========== workflow_message_recipients 表結構 ==========';
-- 查看 workflow_message_recipients 表的所有列
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    CHARACTER_MAXIMUM_LENGTH,
    IS_NULLABLE,
    COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'workflow_message_recipients'
ORDER BY ORDINAL_POSITION;
GO

PRINT '========== 約束檢查 ==========';
-- 查看所有約束
SELECT 
    tc.CONSTRAINT_NAME,
    tc.CONSTRAINT_TYPE,
    tc.TABLE_NAME,
    kcu.COLUMN_NAME,
    tc.IS_DEFERRABLE,
    tc.INITIALLY_DEFERRED
FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
LEFT JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
    ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
WHERE tc.TABLE_NAME IN ('workflow_message_sends', 'workflow_message_recipients')
ORDER BY tc.TABLE_NAME, tc.CONSTRAINT_TYPE, tc.CONSTRAINT_NAME;
GO

PRINT '========== 檢查最近的失敗記錄 ==========';
-- 查看最近的消息發送記錄
SELECT TOP 10
    id,
    workflow_execution_id,
    workflow_step_execution_id,
    node_id,
    node_type,
    message_type,
    total_recipients,
    success_count,
    failed_count,
    status,
    started_at,
    LEN(error_message) as error_message_length
FROM [dbo].[workflow_message_sends]
ORDER BY started_at DESC;
GO

-- 查看最近的收件人記錄
SELECT TOP 10
    id,
    message_send_id,
    recipient_type,
    recipient_name,
    phone_number,
    LEN(phone_number) as phone_number_length,
    status,
    error_message
FROM [dbo].[workflow_message_recipients]
ORDER BY created_at DESC;
GO

