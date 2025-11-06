-- =============================================
-- 更新 EFormInstance 表的 WorkflowStepExecutionId 字段類型
-- 從 INT 改為 UNIQUEIDENTIFIER 以匹配 WorkflowStepExecution.Id
-- =============================================

-- 檢查表是否存在
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'eFormInstances')
BEGIN
    PRINT '找到 eFormInstances 表，開始更新 WorkflowStepExecutionId 字段類型...';
    
    -- 檢查字段是否存在
    IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('eFormInstances') AND name = 'WorkflowStepExecutionId')
    BEGIN
        -- 檢查是否有數據
        DECLARE @RecordCount INT;
        SELECT @RecordCount = COUNT(*) FROM [dbo].[eFormInstances];
        PRINT 'eFormInstances 表中有 ' + CAST(@RecordCount AS VARCHAR(10)) + ' 條記錄';
        
        -- 刪除外鍵約束（如果存在）
        IF EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_eFormInstances_WorkflowStepExecutions')
        BEGIN
            ALTER TABLE [dbo].[eFormInstances] 
            DROP CONSTRAINT [FK_eFormInstances_WorkflowStepExecutions];
            PRINT '已刪除外鍵約束 FK_eFormInstances_WorkflowStepExecutions';
        END
        
        -- 如果有數據，先清空 WorkflowStepExecutionId 字段
        IF @RecordCount > 0
        BEGIN
            PRINT '清空 WorkflowStepExecutionId 字段中的數據...';
            UPDATE [dbo].[eFormInstances] 
            SET [WorkflowStepExecutionId] = NULL;
            PRINT '已清空 WorkflowStepExecutionId 字段';
        END
        
        -- 更新字段類型
        ALTER TABLE [dbo].[eFormInstances] 
        ALTER COLUMN [WorkflowStepExecutionId] UNIQUEIDENTIFIER NULL;
        PRINT '已更新 WorkflowStepExecutionId 字段類型為 UNIQUEIDENTIFIER';
        
        -- 重新添加外鍵約束
        ALTER TABLE [dbo].[eFormInstances] 
        ADD CONSTRAINT [FK_eFormInstances_WorkflowStepExecutions] 
        FOREIGN KEY ([WorkflowStepExecutionId]) 
        REFERENCES [WorkflowStepExecutions]([Id]) 
        ON DELETE SET NULL;
        PRINT '已重新添加外鍵約束 FK_eFormInstances_WorkflowStepExecutions';
        
        PRINT 'EFormInstance 表更新完成！';
    END
    ELSE
    BEGIN
        PRINT '警告：eFormInstances 表中沒有找到 WorkflowStepExecutionId 字段';
    END
END
ELSE
BEGIN
    PRINT '警告：沒有找到 eFormInstances 表';
END
