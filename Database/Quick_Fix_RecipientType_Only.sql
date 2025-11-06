-- =============================================
-- 快速修復：只處理 recipient_type 約束問題
-- 這個腳本專門解決當前的錯誤
-- =============================================

USE [PurpleRice]
GO

PRINT '========================================';
PRINT '快速修復 recipient_type 約束';
PRINT '========================================';
PRINT '';

-- 刪除現有約束
IF EXISTS (
    SELECT * FROM sys.check_constraints 
    WHERE name = 'CK_workflow_message_recipients_type'
    AND parent_object_id = OBJECT_ID('dbo.workflow_message_recipients')
)
BEGIN
    PRINT '正在刪除舊約束...';
    
    ALTER TABLE [dbo].[workflow_message_recipients]
    DROP CONSTRAINT [CK_workflow_message_recipients_type];
    
    PRINT '✅ 舊約束已刪除';
END
ELSE
BEGIN
    PRINT '⚠️ 舊約束不存在，將創建新約束';
END
GO

-- 創建新約束，包含所有必要的類型
PRINT '正在創建新約束...';

ALTER TABLE [dbo].[workflow_message_recipients]
ADD CONSTRAINT [CK_workflow_message_recipients_type] 
CHECK ([recipient_type] IN (
    'User',             -- 用戶
    'Contact',          -- 聯絡人
    'Group',            -- 群組
    'Hashtag',          -- 標籤
    'Initiator',        -- 流程啟動人
    'PhoneNumber',      -- 電話號碼
    'ProcessVariable'   -- 流程變量
));

PRINT '✅ 新約束已創建';
GO

-- 驗證
PRINT '';
PRINT '驗證結果:';
SELECT 
    name AS CONSTRAINT_NAME,
    definition AS CHECK_DEFINITION
FROM sys.check_constraints
WHERE parent_object_id = OBJECT_ID('dbo.workflow_message_recipients')
AND name = 'CK_workflow_message_recipients_type';
GO

PRINT '';
PRINT '========================================';
PRINT '✅ recipient_type 約束修復完成！';
PRINT '現在可以重新啟動應用程序並測試';
PRINT '========================================';
GO

