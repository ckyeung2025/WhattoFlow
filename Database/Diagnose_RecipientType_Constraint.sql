-- =============================================
-- 診斷 workflow_message_recipients 表的 recipient_type 約束
-- =============================================

USE [PurpleRice]
GO

PRINT '========================================';
PRINT '診斷 recipient_type 約束';
PRINT '========================================';
PRINT '';

-- 1. 檢查約束是否存在
PRINT '1. 檢查約束是否存在:';
IF EXISTS (
    SELECT * FROM sys.check_constraints 
    WHERE name = 'CK_workflow_message_recipients_type'
    AND parent_object_id = OBJECT_ID('dbo.workflow_message_recipients')
)
BEGIN
    PRINT '✅ 約束存在';
    
    -- 顯示約束定義
    SELECT 
        name AS CONSTRAINT_NAME,
        definition AS CHECK_DEFINITION
    FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID('dbo.workflow_message_recipients')
    AND name = 'CK_workflow_message_recipients_type';
END
ELSE
BEGIN
    PRINT '❌ 約束不存在！';
END
GO

PRINT '';
PRINT '2. 檢查表中現有的 recipient_type 值:';
SELECT DISTINCT recipient_type, COUNT(*) as count
FROM [dbo].[workflow_message_recipients]
GROUP BY recipient_type
ORDER BY recipient_type;
GO

PRINT '';
PRINT '3. 檢查最近失敗的記錄（如果有錯誤日誌表）:';
-- 這裡可以查看最近嘗試插入的值
PRINT '請檢查應用程序日誌以查看嘗試插入的 recipient_type 值';
GO

PRINT '';
PRINT '========================================';
PRINT '診斷完成';
PRINT '========================================';

