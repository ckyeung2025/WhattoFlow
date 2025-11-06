-- =============================================
-- 為 eFormDefinitions 表添加字段顯示設定字段
-- =============================================

-- 檢查表是否存在
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'eFormDefinitions')
BEGIN
    PRINT '找到 eFormDefinitions 表，開始添加字段顯示設定字段...';
    
    -- 檢查字段是否已存在
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('eFormDefinitions') AND name = 'field_display_settings')
    BEGIN
        -- 添加字段顯示設定字段
        ALTER TABLE [dbo].[eFormDefinitions] 
        ADD [field_display_settings] NVARCHAR(MAX) NULL;
        
        PRINT '已添加 field_display_settings 字段';
        
        -- 添加註釋
        EXEC sys.sp_addextendedproperty 
            @name = N'MS_Description', 
            @value = N'表單字段顯示設定，存儲為 JSON 格式', 
            @level0type = N'SCHEMA', @level0name = N'dbo', 
            @level1type = N'TABLE', @level1name = N'eFormDefinitions', 
            @level2type = N'COLUMN', @level2name = N'field_display_settings';
        
        PRINT '已添加字段註釋';
        PRINT 'eFormDefinitions 表更新完成！';
    END
    ELSE
    BEGIN
        PRINT 'field_display_settings 字段已存在，跳過添加';
    END
END
ELSE
BEGIN
    PRINT '警告：沒有找到 eFormDefinitions 表';
END
