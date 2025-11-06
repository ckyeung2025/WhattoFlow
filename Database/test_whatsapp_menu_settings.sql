-- 測試 WhatsApp 菜單設置
-- 此腳本展示如何為特定公司設置自定義 WhatsApp 菜單文字

-- 假設你有一個公司 ID（請替換成實際的公司 ID）
DECLARE @CompanyId UNIQUEIDENTIFIER = 'your-company-guid-here';

-- 設置自定義 WhatsApp 菜單文字
UPDATE companies 
SET 
    -- 主要歡迎訊息
    WA_WelcomeMessage = N'🎉 歡迎來到我們的智能服務平台！

✨ 請從以下選項中選擇您需要的服務：',
    
    -- 無功能時的訊息
    WA_NoFunctionMessage = N'👋 歡迎使用我們的智能助手！

⚠️ 抱歉，目前系統正在維護中，暫無可用功能。
📞 如有緊急需求，請直接聯繫客服：+852 1234 5678',
    
    -- 選單標題
    WA_MenuTitle = N'🏢 企業服務中心',
    
    -- 選單底部文字
    WA_MenuFooter = N'💡 點擊下方按鈕查看所有可用服務',
    
    -- 查看選項按鈕文字
    WA_MenuButton = N'📋 瀏覽服務',
    
    -- 服務選項區段標題
    WA_SectionTitle = N'🔧 可用服務',
    
    -- 預設選項描述
    WA_DefaultOptionDescription = N'點擊選擇這項服務',
    
    -- 輸入錯誤提示訊息
    WA_InputErrorMessage = N'❌ 輸入格式不正確，請重新輸入。

💡 提示：請確認您輸入的信息格式正確。',
    
    -- 回退到純文字時的提示訊息
    WA_FallbackMessage = N'

📱 操作指南：
• 回覆數字選擇對應功能
• 輸入「菜單」或「選單」重新顯示選項',
    
    -- 系統錯誤訊息
    WA_SystemErrorMessage = N'🚫 系統配置錯誤

🛠️ 請聯繫技術支援解決此問題'

WHERE Id = @CompanyId;

-- 檢查更新結果
IF @@ROWCOUNT > 0
    PRINT '✅ 成功更新公司的 WhatsApp 菜單設置';
ELSE
    PRINT '❌ 找不到指定的公司 ID，請檢查 @CompanyId 變量';

-- 查詢更新後的設置
SELECT 
    Name as '公司名稱',
    WA_WelcomeMessage as '歡迎訊息',
    WA_MenuTitle as '菜單標題',
    WA_MenuFooter as '菜單底部',
    WA_MenuButton as '按鈕文字',
    WA_SectionTitle as '區段標題',
    WA_DefaultOptionDescription as '預設描述'
FROM companies 
WHERE Id = @CompanyId;

-- 範例：為所有公司設置預設值（請謹慎執行）
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
    WA_QRCodeSuccessMessage = N'QR Code 掃描成功！流程將繼續執行。',
    WA_QRCodeErrorMessage = N'無法識別圖片中的 QR Code，請確保圖片清晰且包含有效的 QR Code。',
    WA_QRCodeUploadErrorMessage = N'無法處理您上傳的圖片，請重新上傳。',
    WA_QRCodeProcessErrorMessage = N'處理您的 QR Code 時發生錯誤，請稍後再試。',
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
    OR WA_QRCodeSuccessMessage IS NULL
    OR WA_QRCodeErrorMessage IS NULL
    OR WA_QRCodeUploadErrorMessage IS NULL
    OR WA_QRCodeProcessErrorMessage IS NULL
    OR WA_SystemErrorMessage IS NULL;

PRINT '✅ 已為所有缺少設置的公司添加預設值';
*/
