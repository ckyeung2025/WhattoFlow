-- =============================================
-- Migration: 添加 TemplateSource 和 Header 相關字段到 WhatsAppTemplates 表
-- 日期: 2025-01-XX
-- 說明: 擴展現有 WhatsAppTemplates 表，用於區分 Internal/Meta 模板並持久化保存 header_url
-- =============================================

USE [WhattoFlow]  -- 請根據實際數據庫名稱修改
GO

-- 檢查並添加 TemplateSource 字段（區分 Internal 和 Meta 模板）
IF NOT EXISTS (
    SELECT 1 FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'dbo.WhatsAppTemplates') 
    AND name = 'TemplateSource'
)
BEGIN
    ALTER TABLE dbo.WhatsAppTemplates
    ADD TemplateSource NVARCHAR(20) NULL;
    
    PRINT '✅ TemplateSource 字段已添加';
END
ELSE
BEGIN
    PRINT '⚠️ TemplateSource 字段已存在，跳過';
END
GO

-- 為現有記錄設置 TemplateSource 默認值（分開執行，確保字段已存在）
IF EXISTS (
    SELECT 1 FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'dbo.WhatsAppTemplates') 
    AND name = 'TemplateSource'
)
BEGIN
    UPDATE dbo.WhatsAppTemplates
    SET TemplateSource = 'Internal'
    WHERE TemplateSource IS NULL;
    
    PRINT '✅ 已為現有記錄設置 TemplateSource 默認值';
END
GO

-- 檢查並添加 HeaderUrl 字段（Meta template 的 header URL）
IF NOT EXISTS (
    SELECT 1 FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'dbo.WhatsAppTemplates') 
    AND name = 'HeaderUrl'
)
BEGIN
    ALTER TABLE dbo.WhatsAppTemplates
    ADD HeaderUrl NVARCHAR(1000) NULL;
    
    PRINT '✅ HeaderUrl 字段已添加';
END
ELSE
BEGIN
    PRINT '⚠️ HeaderUrl 字段已存在，跳過';
END
GO

-- 檢查並添加 HeaderType 字段（image, video, document）
IF NOT EXISTS (
    SELECT 1 FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'dbo.WhatsAppTemplates') 
    AND name = 'HeaderType'
)
BEGIN
    ALTER TABLE dbo.WhatsAppTemplates
    ADD HeaderType NVARCHAR(50) NULL;
    
    PRINT '✅ HeaderType 字段已添加';
END
ELSE
BEGIN
    PRINT '⚠️ HeaderType 字段已存在，跳過';
END
GO

-- 檢查並添加 HeaderFilename 字段（僅 document 需要）
IF NOT EXISTS (
    SELECT 1 FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'dbo.WhatsAppTemplates') 
    AND name = 'HeaderFilename'
)
BEGIN
    ALTER TABLE dbo.WhatsAppTemplates
    ADD HeaderFilename NVARCHAR(500) NULL;
    
    PRINT '✅ HeaderFilename 字段已添加';
END
ELSE
BEGIN
    PRINT '⚠️ HeaderFilename 字段已存在，跳過';
END
GO

-- 創建索引以提高查詢性能（根據 CompanyId + Name + TemplateSource 查詢）
-- 只有在所有必要字段都存在時才創建索引
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes 
    WHERE name = 'IX_WhatsAppTemplates_Company_TemplateSource_Name' 
    AND object_id = OBJECT_ID(N'dbo.WhatsAppTemplates')
)
BEGIN
    -- 檢查所有必要字段是否存在
    DECLARE @TemplateSourceExists BIT = 0;
    DECLARE @HeaderUrlExists BIT = 0;
    DECLARE @HeaderTypeExists BIT = 0;
    DECLARE @HeaderFilenameExists BIT = 0;
    
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.WhatsAppTemplates') AND name = 'TemplateSource')
        SET @TemplateSourceExists = 1;
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.WhatsAppTemplates') AND name = 'HeaderUrl')
        SET @HeaderUrlExists = 1;
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.WhatsAppTemplates') AND name = 'HeaderType')
        SET @HeaderTypeExists = 1;
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.WhatsAppTemplates') AND name = 'HeaderFilename')
        SET @HeaderFilenameExists = 1;
    
    IF @TemplateSourceExists = 1
    BEGIN
        -- 如果 HeaderUrl 等字段存在，使用 INCLUDE；否則不使用
        IF @HeaderUrlExists = 1 AND @HeaderTypeExists = 1 AND @HeaderFilenameExists = 1
        BEGIN
            CREATE NONCLUSTERED INDEX IX_WhatsAppTemplates_Company_TemplateSource_Name
            ON dbo.WhatsAppTemplates(CompanyId, TemplateSource, Name)
            INCLUDE (HeaderUrl, HeaderType, HeaderFilename);
        END
        ELSE
        BEGIN
            CREATE NONCLUSTERED INDEX IX_WhatsAppTemplates_Company_TemplateSource_Name
            ON dbo.WhatsAppTemplates(CompanyId, TemplateSource, Name);
        END
        
        PRINT '✅ 索引 IX_WhatsAppTemplates_Company_TemplateSource_Name 已創建';
    END
    ELSE
    BEGIN
        PRINT '⚠️ TemplateSource 字段不存在，無法創建索引';
    END
END
ELSE
BEGIN
    PRINT '⚠️ 索引 IX_WhatsAppTemplates_Company_TemplateSource_Name 已存在，跳過';
END
GO

PRINT '=============================================';
PRINT '✅ 數據庫遷移完成！';
PRINT '=============================================';
GO

