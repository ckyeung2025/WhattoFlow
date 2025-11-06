-- 修復 workflow_message_recipients 表的 recipient_type CHECK 約束
-- 添加 'ProcessVariable' 到允許的值列表

-- USE [PurpleRice_DB]  -- 請根據實際數據庫名稱修改或刪除此行
-- GO

PRINT '========== 檢查並修復 recipient_type 約束 ==========';

-- 檢查約束是否存在
IF EXISTS (
    SELECT * FROM sys.check_constraints 
    WHERE name = 'CK_workflow_message_recipients_type'
    AND parent_object_id = OBJECT_ID('dbo.workflow_message_recipients')
)
BEGIN
    PRINT '找到約束 CK_workflow_message_recipients_type，開始刪除...';
    
    -- 刪除舊約束
    ALTER TABLE [dbo].[workflow_message_recipients]
    DROP CONSTRAINT [CK_workflow_message_recipients_type];
    
    PRINT '✅ 舊約束已刪除';
END
ELSE
BEGIN
    PRINT '⚠️ 約束 CK_workflow_message_recipients_type 不存在';
END
GO

-- 添加新約束，包含 'ProcessVariable'
ALTER TABLE [dbo].[workflow_message_recipients]
ADD CONSTRAINT [CK_workflow_message_recipients_type] 
CHECK ([recipient_type] IN (
    'User', 
    'Contact', 
    'Group', 
    'Hashtag', 
    'Initiator', 
    'PhoneNumber',
    'ProcessVariable'  -- ✅ 新增
));

PRINT '✅ 新約束已創建，包含 ProcessVariable';
GO

-- 驗證約束
PRINT '========== 驗證約束 ==========';
SELECT 
    name AS CONSTRAINT_NAME,
    definition AS CHECK_DEFINITION
FROM sys.check_constraints
WHERE parent_object_id = OBJECT_ID('dbo.workflow_message_recipients')
AND name = 'CK_workflow_message_recipients_type';
GO
