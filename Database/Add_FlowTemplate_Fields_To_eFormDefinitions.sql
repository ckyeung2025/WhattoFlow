-- =============================================
-- 為 eFormDefinitions 表添加 Flow Template 相關字段
-- 用於支持 WhatsApp Flow Template 功能（24小時窗口外發送）
-- =============================================

-- 檢查表是否存在
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'eFormDefinitions')
BEGIN
    PRINT '找到 eFormDefinitions 表，開始添加 Flow Template 字段...';
    
    -- =============================================
    -- 1. 添加 meta_flow_template_id 字段
    -- =============================================
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('eFormDefinitions') AND name = 'meta_flow_template_id')
    BEGIN
        ALTER TABLE [dbo].[eFormDefinitions] 
        ADD [meta_flow_template_id] NVARCHAR(255) NULL;
        
        PRINT '已添加 meta_flow_template_id 字段';
        
        -- 添加註釋
        EXEC sys.sp_addextendedproperty 
            @name = N'MS_Description', 
            @value = N'Meta Flow Template ID，用於在 24 小時窗口外發送 Flow 消息', 
            @level0type = N'SCHEMA', @level0name = N'dbo', 
            @level1type = N'TABLE', @level1name = N'eFormDefinitions', 
            @level2type = N'COLUMN', @level2name = N'meta_flow_template_id';
        
        PRINT '已添加 meta_flow_template_id 字段註釋';
    END
    ELSE
    BEGIN
        PRINT 'meta_flow_template_id 字段已存在，跳過添加';
    END
    
    -- =============================================
    -- 2. 添加 meta_flow_template_name 字段
    -- =============================================
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('eFormDefinitions') AND name = 'meta_flow_template_name')
    BEGIN
        ALTER TABLE [dbo].[eFormDefinitions] 
        ADD [meta_flow_template_name] NVARCHAR(255) NULL;
        
        PRINT '已添加 meta_flow_template_name 字段';
        
        -- 添加註釋
        EXEC sys.sp_addextendedproperty 
            @name = N'MS_Description', 
            @value = N'Meta Flow Template 名稱', 
            @level0type = N'SCHEMA', @level0name = N'dbo', 
            @level1type = N'TABLE', @level1name = N'eFormDefinitions', 
            @level2type = N'COLUMN', @level2name = N'meta_flow_template_name';
        
        PRINT '已添加 meta_flow_template_name 字段註釋';
    END
    ELSE
    BEGIN
        PRINT 'meta_flow_template_name 字段已存在，跳過添加';
    END
    
    -- =============================================
    -- 3. 添加 meta_flow_template_status 字段
    -- =============================================
    IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('eFormDefinitions') AND name = 'meta_flow_template_status')
    BEGIN
        ALTER TABLE [dbo].[eFormDefinitions] 
        ADD [meta_flow_template_status] NVARCHAR(50) NULL;
        
        PRINT '已添加 meta_flow_template_status 字段';
        
        -- 添加註釋
        EXEC sys.sp_addextendedproperty 
            @name = N'MS_Description', 
            @value = N'Meta Flow Template 狀態（PENDING, APPROVED, REJECTED 等）', 
            @level0type = N'SCHEMA', @level0name = N'dbo', 
            @level1type = N'TABLE', @level1name = N'eFormDefinitions', 
            @level2type = N'COLUMN', @level2name = N'meta_flow_template_status';
        
        PRINT '已添加 meta_flow_template_status 字段註釋';
    END
    ELSE
    BEGIN
        PRINT 'meta_flow_template_status 字段已存在，跳過添加';
    END
    
    PRINT '=============================================';
    PRINT 'eFormDefinitions 表 Flow Template 字段更新完成！';
    PRINT '已添加的字段：';
    PRINT '  - meta_flow_template_id (NVARCHAR(255))';
    PRINT '  - meta_flow_template_name (NVARCHAR(255))';
    PRINT '  - meta_flow_template_status (NVARCHAR(50))';
    PRINT '=============================================';
END
ELSE
BEGIN
    PRINT '警告：沒有找到 eFormDefinitions 表';
END
GO

