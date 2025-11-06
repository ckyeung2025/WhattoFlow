-- 添加 WhatsApp 菜單設置字段到 companies 表
-- 執行日期: 2025-10-25
-- 用途: 為每個公司提供自定義 WhatsApp 菜單文字的功能

USE [your_database_name]; -- 請根據實際數據庫名稱修改

-- 添加 WhatsApp 菜單設置字段
ALTER TABLE companies
ADD 
    -- 主要歡迎訊息
    WA_WelcomeMessage NVARCHAR(1000) NULL,
    
    -- 無功能時的訊息
    WA_NoFunctionMessage NVARCHAR(1000) NULL,
    
    -- 選單標題 (WhatsApp List Header)
    WA_MenuTitle NVARCHAR(100) NULL,
    
    -- 選單底部文字 (WhatsApp List Footer)
    WA_MenuFooter NVARCHAR(200) NULL,
    
    -- 查看選項按鈕文字 (WhatsApp List Button)
    WA_MenuButton NVARCHAR(50) NULL,
    
    -- 服務選項區段標題 (WhatsApp List Section Title)
    WA_SectionTitle NVARCHAR(100) NULL,
    
    -- 預設選項描述 (當工作流程沒有描述時使用)
    WA_DefaultOptionDescription NVARCHAR(200) NULL,
    
    -- 輸入錯誤提示訊息
    WA_InputErrorMessage NVARCHAR(500) NULL,
    
    -- 回退到純文字時的提示訊息
    WA_FallbackMessage NVARCHAR(500) NULL,
    
    -- 系統錯誤訊息
    WA_SystemErrorMessage NVARCHAR(500) NULL;

-- 添加註釋說明每個字段的用途
EXEC sys.sp_addextendedproperty 
    @name = N'MS_Description',
    @value = N'WhatsApp 主要歡迎訊息，顯示在菜單開頭',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE',  @level1name = N'companies',
    @level2type = N'COLUMN', @level2name = N'WA_WelcomeMessage';

EXEC sys.sp_addextendedproperty 
    @name = N'MS_Description',
    @value = N'當沒有啟用的工作流程時顯示的訊息',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE',  @level1name = N'companies',
    @level2type = N'COLUMN', @level2name = N'WA_NoFunctionMessage';

EXEC sys.sp_addextendedproperty 
    @name = N'MS_Description',
    @value = N'WhatsApp 列表菜單的標題文字',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE',  @level1name = N'companies',
    @level2type = N'COLUMN', @level2name = N'WA_MenuTitle';

EXEC sys.sp_addextendedproperty 
    @name = N'MS_Description',
    @value = N'WhatsApp 列表菜單的底部提示文字',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE',  @level1name = N'companies',
    @level2type = N'COLUMN', @level2name = N'WA_MenuFooter';

EXEC sys.sp_addextendedproperty 
    @name = N'MS_Description',
    @value = N'WhatsApp 列表菜單的查看按鈕文字',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE',  @level1name = N'companies',
    @level2type = N'COLUMN', @level2name = N'WA_MenuButton';

EXEC sys.sp_addextendedproperty 
    @name = N'MS_Description',
    @value = N'WhatsApp 列表菜單的區段標題',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE',  @level1name = N'companies',
    @level2type = N'COLUMN', @level2name = N'WA_SectionTitle';

EXEC sys.sp_addextendedproperty 
    @name = N'MS_Description',
    @value = N'當工作流程沒有描述時使用的預設選項描述',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE',  @level1name = N'companies',
    @level2type = N'COLUMN', @level2name = N'WA_DefaultOptionDescription';

EXEC sys.sp_addextendedproperty 
    @name = N'MS_Description',
    @value = N'用戶輸入錯誤時的提示訊息',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE',  @level1name = N'companies',
    @level2type = N'COLUMN', @level2name = N'WA_InputErrorMessage';

EXEC sys.sp_addextendedproperty 
    @name = N'MS_Description',
    @value = N'當 WhatsApp 互動式消息失敗時的回退提示',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE',  @level1name = N'companies',
    @level2type = N'COLUMN', @level2name = N'WA_FallbackMessage';

EXEC sys.sp_addextendedproperty 
    @name = N'MS_Description',
    @value = N'系統錯誤時的一般性提示訊息',
    @level0type = N'SCHEMA', @level0name = N'dbo',
    @level1type = N'TABLE',  @level1name = N'companies',
    @level2type = N'COLUMN', @level2name = N'WA_SystemErrorMessage';

PRINT 'WhatsApp 菜單設置字段已成功添加到 companies 表';

-- 可選：為現有公司設置預設值（如果需要的話）
/*
UPDATE companies 
SET 
    WA_WelcomeMessage = N'歡迎使用我們的服務！

請選擇您需要的功能：',
    WA_NoFunctionMessage = N'歡迎使用我們的服務！

目前沒有可用的功能，請聯繫管理員。',
    WA_MenuTitle = N'服務選單',
    WA_MenuFooter = N'請選擇您需要的服務',
    WA_MenuButton = N'查看選項',
    WA_SectionTitle = N'服務選項',
    WA_DefaultOptionDescription = N'點擊選擇此服務',
    WA_InputErrorMessage = N'輸入不正確，請重新輸入。',
    WA_FallbackMessage = N'

回覆數字選擇功能，或輸入「選單」重新顯示選單。',
    WA_SystemErrorMessage = N'系統錯誤：無法找到 QR Code 節點配置。'
WHERE 
    WA_WelcomeMessage IS NULL;

PRINT '預設值已設置完成';
*/
