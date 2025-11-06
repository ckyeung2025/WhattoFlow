-- ================================================================
-- 修復 message_validations 表中的 media_url 路徑
-- ================================================================
-- 問題：media_url 存儲的是絕對路徑（C:\GIT\WhattoFlow\Uploads\...）
-- 解決方案：轉換為相對 URL 路徑（/Uploads/...）
-- ================================================================

USE [PurpleRice_DB]
GO

-- ================================================================
-- 查看需要修復的記錄
-- ================================================================

-- 顯示當前有絕對路徑的記錄
SELECT 
    id,
    workflow_execution_id,
    step_index,
    message_type,
    media_url,
    created_at
FROM [dbo].[message_validations]
WHERE media_url IS NOT NULL
    AND media_url LIKE 'C:\GIT\WhattoFlow\Uploads\%'
ORDER BY created_at DESC;

GO

PRINT '上面是需要修復的記錄';
PRINT '====================================';
GO

-- ================================================================
-- 修復 media_url 路徑（將絕對路徑轉換為相對 URL 路徑）
-- ================================================================

-- 更新 media_url，將 C:\GIT\WhattoFlow\Uploads\ 替換為 /Uploads/
-- 並將反斜槓 \ 替換為正斜槓 /
UPDATE [dbo].[message_validations]
SET media_url = REPLACE(
    REPLACE(media_url, 'C:\GIT\WhattoFlow\Uploads\', '/Uploads/'),
    '\',
    '/'
)
WHERE media_url IS NOT NULL
    AND media_url LIKE 'C:\GIT\WhattoFlow\Uploads\%';

PRINT '✅ 已將絕對路徑轉換為相對 URL 路徑';
GO

-- ================================================================
-- 驗證修復結果
-- ================================================================

-- 顯示修復後的記錄
SELECT 
    id,
    workflow_execution_id,
    step_index,
    message_type,
    media_url,
    created_at
FROM [dbo].[message_validations]
WHERE media_url IS NOT NULL
ORDER BY created_at DESC;

GO

PRINT '====================================';
PRINT '修復完成！';
PRINT '所有 media_url 現在應該以 /Uploads/ 開頭';
PRINT '====================================';

