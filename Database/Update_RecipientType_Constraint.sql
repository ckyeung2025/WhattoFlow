-- =============================================
-- 更新 workflow_message_recipients 表的 recipient_type 約束
-- 添加 PhoneNumber 類型支持
-- =============================================

-- 刪除現有的約束
IF EXISTS (SELECT * FROM sys.check_constraints WHERE name = 'CK_workflow_message_recipients_type')
BEGIN
    ALTER TABLE [dbo].[workflow_message_recipients] 
    DROP CONSTRAINT [CK_workflow_message_recipients_type];
    PRINT '已刪除現有的 recipient_type 約束';
END
GO

-- 添加新的約束，包含 PhoneNumber 類型
ALTER TABLE [dbo].[workflow_message_recipients] 
ADD CONSTRAINT [CK_workflow_message_recipients_type] 
    CHECK ([recipient_type] IN ('User', 'Contact', 'Group', 'Hashtag', 'Initiator', 'PhoneNumber'));
GO

PRINT '已添加新的 recipient_type 約束，包含 PhoneNumber 類型';
