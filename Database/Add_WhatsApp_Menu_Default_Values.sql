-- =============================================
-- 為現有公司添加 WhatsApp 選單預設值
-- 執行日期: 2025-10-31
-- 用途: 為所有現有公司設置 WhatsApp 選單的預設文字
-- =============================================

USE [PurpleRice]
GO

PRINT '========================================';
PRINT '開始為現有公司添加 WhatsApp 選單預設值';
PRINT '========================================';
PRINT '';

-- 為所有缺少預設值的公司設置預設值
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
    WA_WelcomeMessage IS NULL
    OR WA_NoFunctionMessage IS NULL
    OR WA_MenuTitle IS NULL
    OR WA_MenuFooter IS NULL
    OR WA_MenuButton IS NULL
    OR WA_SectionTitle IS NULL
    OR WA_DefaultOptionDescription IS NULL
    OR WA_InputErrorMessage IS NULL
    OR WA_FallbackMessage IS NULL
    OR WA_SystemErrorMessage IS NULL;

DECLARE @UpdatedCount INT = @@ROWCOUNT;

PRINT '';
PRINT '========================================';
IF @UpdatedCount > 0
BEGIN
    PRINT '✅ 已為 ' + CAST(@UpdatedCount AS VARCHAR) + ' 家公司添加預設值';
END
ELSE
BEGIN
    PRINT '⚠️ 所有公司都已經有預設值，無需更新';
END
PRINT '========================================';
PRINT '';

-- 顯示更新後的結果統計
SELECT 
    COUNT(*) AS '總公司數',
    SUM(CASE WHEN WA_WelcomeMessage IS NOT NULL THEN 1 ELSE 0 END) AS '有歡迎訊息',
    SUM(CASE WHEN WA_MenuTitle IS NOT NULL THEN 1 ELSE 0 END) AS '有選單標題',
    SUM(CASE WHEN WA_SystemErrorMessage IS NOT NULL THEN 1 ELSE 0 END) AS '有系統錯誤訊息'
FROM companies;
GO

-- 顯示一些範例數據
SELECT TOP 5
    Name AS '公司名稱',
    WA_WelcomeMessage AS '歡迎訊息',
    WA_MenuTitle AS '選單標題',
    WA_MenuButton AS '按鈕文字'
FROM companies
WHERE WA_WelcomeMessage IS NOT NULL
ORDER BY CreatedAt DESC;
GO

PRINT '';
PRINT '========================================';
PRINT '✅ 預設值設置完成！';
PRINT '========================================';
GO

