-- =============================================
-- 為 eFormDefinitions 表添加表單類型和 Meta Flow 相關字段
-- =============================================

-- 檢查表是否存在
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'eFormDefinitions')
BEGIN
    PRINT '找到 eFormDefinitions 表，開始添加表單類型和 Meta Flow 相關字段...';
    
    -- 添加 form_type 字段
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('eFormDefinitions') AND name = 'form_type')
    BEGIN
        ALTER TABLE [dbo].[eFormDefinitions] 
        ADD [form_type] NVARCHAR(20) NOT NULL DEFAULT 'HTML';
        
        PRINT '已添加 form_type 字段';
        
        EXEC sys.sp_addextendedproperty 
            @name = N'MS_Description', 
            @value = N'表單類型：HTML 或 MetaFlows', 
            @level0type = N'SCHEMA', @level0name = N'dbo', 
            @level1type = N'TABLE', @level1name = N'eFormDefinitions', 
            @level2type = N'COLUMN', @level2name = N'form_type';
    END
    ELSE
    BEGIN
        PRINT 'form_type 字段已存在，跳過添加';
    END
    
    -- 添加 meta_flow_id 字段
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('eFormDefinitions') AND name = 'meta_flow_id')
    BEGIN
        ALTER TABLE [dbo].[eFormDefinitions] 
        ADD [meta_flow_id] NVARCHAR(255) NULL;
        
        PRINT '已添加 meta_flow_id 字段';
        
        EXEC sys.sp_addextendedproperty 
            @name = N'MS_Description', 
            @value = N'Meta Flow ID（從 Meta API 返回）', 
            @level0type = N'SCHEMA', @level0name = N'dbo', 
            @level1type = N'TABLE', @level1name = N'eFormDefinitions', 
            @level2type = N'COLUMN', @level2name = N'meta_flow_id';
    END
    ELSE
    BEGIN
        PRINT 'meta_flow_id 字段已存在，跳過添加';
    END
    
    -- 添加 meta_flow_version 字段
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('eFormDefinitions') AND name = 'meta_flow_version')
    BEGIN
        ALTER TABLE [dbo].[eFormDefinitions] 
        ADD [meta_flow_version] NVARCHAR(50) NULL;
        
        PRINT '已添加 meta_flow_version 字段';
        
        EXEC sys.sp_addextendedproperty 
            @name = N'MS_Description', 
            @value = N'Meta Flow 版本號', 
            @level0type = N'SCHEMA', @level0name = N'dbo', 
            @level1type = N'TABLE', @level1name = N'eFormDefinitions', 
            @level2type = N'COLUMN', @level2name = N'meta_flow_version';
    END
    ELSE
    BEGIN
        PRINT 'meta_flow_version 字段已存在，跳過添加';
    END
    
    -- 添加 meta_flow_status 字段
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('eFormDefinitions') AND name = 'meta_flow_status')
    BEGIN
        ALTER TABLE [dbo].[eFormDefinitions] 
        ADD [meta_flow_status] NVARCHAR(50) NULL;
        
        PRINT '已添加 meta_flow_status 字段';
        
        EXEC sys.sp_addextendedproperty 
            @name = N'MS_Description', 
            @value = N'Meta Flow 狀態（draft, published 等）', 
            @level0type = N'SCHEMA', @level0name = N'dbo', 
            @level1type = N'TABLE', @level1name = N'eFormDefinitions', 
            @level2type = N'COLUMN', @level2name = N'meta_flow_status';
    END
    ELSE
    BEGIN
        PRINT 'meta_flow_status 字段已存在，跳過添加';
    END
    
    -- 添加 meta_flow_json 字段
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('eFormDefinitions') AND name = 'meta_flow_json')
    BEGIN
        ALTER TABLE [dbo].[eFormDefinitions] 
        ADD [meta_flow_json] NVARCHAR(MAX) NULL;
        
        PRINT '已添加 meta_flow_json 字段';
        
        EXEC sys.sp_addextendedproperty 
            @name = N'MS_Description', 
            @value = N'Meta Flow 的完整 JSON 定義', 
            @level0type = N'SCHEMA', @level0name = N'dbo', 
            @level1type = N'TABLE', @level1name = N'eFormDefinitions', 
            @level2type = N'COLUMN', @level2name = N'meta_flow_json';
    END
    ELSE
    BEGIN
        PRINT 'meta_flow_json 字段已存在，跳過添加';
    END
    
    -- 添加 meta_flow_metadata 字段
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('eFormDefinitions') AND name = 'meta_flow_metadata')
    BEGIN
        ALTER TABLE [dbo].[eFormDefinitions] 
        ADD [meta_flow_metadata] NVARCHAR(MAX) NULL;
        
        PRINT '已添加 meta_flow_metadata 字段';
        
        EXEC sys.sp_addextendedproperty 
            @name = N'MS_Description', 
            @value = N'Meta API 返回的其他元數據（JSON 格式）', 
            @level0type = N'SCHEMA', @level0name = N'dbo', 
            @level1type = N'TABLE', @level1name = N'eFormDefinitions', 
            @level2type = N'COLUMN', @level2name = N'meta_flow_metadata';
    END
    ELSE
    BEGIN
        PRINT 'meta_flow_metadata 字段已存在，跳過添加';
    END
    
    PRINT 'eFormDefinitions 表更新完成！';
END
ELSE
BEGIN
    PRINT '警告：沒有找到 eFormDefinitions 表';
END

