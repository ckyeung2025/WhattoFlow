-- ================================================================
-- 修復 workflow_message_recipients 表中的電話號碼格式
-- ================================================================
-- 問題：電話號碼包含加號(+)和連字符(-)，導致無法匹配 WhatsApp 狀態更新
-- 解決方案：標準化電話號碼格式為純數字
-- ================================================================

USE [PurpleRice_DB]
GO

-- ================================================================
-- 查看當前的電話號碼格式問題
-- ================================================================

SELECT 
    id,
    recipient_name,
    phone_number,
    status,
    whatsapp_message_id,
    FORMAT(created_at, 'yyyy-MM-dd HH:mm:ss') AS created_at
FROM [dbo].[workflow_message_recipients]
WHERE phone_number LIKE '+%' OR phone_number LIKE '%-%'
ORDER BY created_at DESC;

PRINT '====================================';
PRINT '上面是包含特殊字符的電話號碼記錄';
PRINT '====================================';
GO

-- ================================================================
-- 標準化電話號碼格式（移除加號和連字符）
-- ================================================================

-- 更新電話號碼，移除 + 和 -
UPDATE [dbo].[workflow_message_recipients]
SET phone_number = REPLACE(REPLACE(phone_number, '+', ''), '-', '')
WHERE phone_number LIKE '+%' OR phone_number LIKE '%-%';

PRINT '✅ 電話號碼格式已標準化';
GO

-- ================================================================
-- 驗證修復結果
-- ================================================================

SELECT 
    id,
    recipient_name,
    phone_number,
    status,
    whatsapp_message_id,
    FORMAT(created_at, 'yyyy-MM-dd HH:mm:ss') AS created_at
FROM [dbo].[workflow_message_recipients]
WHERE id IN (
    'B97C6A9D-23F3-44F2-A658-2FBD974AB301',
    'D5787765-E0A9-4223-AC19-7B13705319FB',
    'FB5E8BF7-F02F-4D4D-BE21-A6765ABC887B',
    'D31103E2-A027-4F28-8126-26D5CE37E70C',
    '3A656168-7922-4662-B371-3FB197FFA501'
)
ORDER BY created_at;

PRINT '====================================';
PRINT '修復完成！';
PRINT '所有電話號碼現在應該是純數字格式';
PRINT '====================================';

