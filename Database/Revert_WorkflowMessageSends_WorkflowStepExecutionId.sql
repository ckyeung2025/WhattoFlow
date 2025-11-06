-- =============================================
-- 將 workflow_message_sends 表的 workflow_step_execution_id 字段類型
-- 從 UNIQUEIDENTIFIER 改回 INT 以匹配 WorkflowStepExecution.Id
-- =============================================

-- 檢查表是否存在
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'workflow_message_sends')
BEGIN
    PRINT '找到 workflow_message_sends 表，開始更新 workflow_step_execution_id 字段類型...';
    
    -- 檢查字段是否存在
    IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('workflow_message_sends') AND name = 'workflow_step_execution_id')
    BEGIN
        -- 檢查是否有數據
        DECLARE @RecordCount INT;
        SELECT @RecordCount = COUNT(*) FROM [dbo].[workflow_message_sends];
        PRINT 'workflow_message_sends 表中有 ' + CAST(@RecordCount AS VARCHAR(10)) + ' 條記錄';
        
        -- 如果有數據，先清空 workflow_step_execution_id 字段
        IF @RecordCount > 0
        BEGIN
            PRINT '清空 workflow_step_execution_id 字段中的數據...';
            UPDATE [dbo].[workflow_message_sends] 
            SET [workflow_step_execution_id] = NULL;
            PRINT '已清空 workflow_step_execution_id 字段';
        END
        
        -- 更新字段類型
        ALTER TABLE [dbo].[workflow_message_sends] 
        ALTER COLUMN [workflow_step_execution_id] INT NULL;
        PRINT '已更新 workflow_step_execution_id 字段類型為 INT';
        
        PRINT 'workflow_message_sends 表更新完成！';
    END
    ELSE
    BEGIN
        PRINT '警告：workflow_message_sends 表中沒有找到 workflow_step_execution_id 字段';
    END
END
ELSE
BEGIN
    PRINT '警告：沒有找到 workflow_message_sends 表';
END
