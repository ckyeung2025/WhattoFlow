-- ================================================================
-- 修復 message_validations 表中錯誤的 step_index 值
-- ================================================================
-- 問題：之前的代碼使用 execution.CurrentWaitingStep ?? 0，導致所有記錄的 step_index 都是 0
-- 解決方案：根據創建時間和步驟執行時間來推斷正確的 step_index
-- ================================================================

USE [PurpleRice_DB]
GO

-- ================================================================
-- 方法 1：根據時間範圍自動匹配（適用於大部分情況）
-- ================================================================

-- 更新 message_validations 的 step_index，根據創建時間匹配對應的步驟執行記錄
UPDATE mv
SET mv.step_index = se.StepIndex
FROM [dbo].[message_validations] mv
INNER JOIN [dbo].[workflow_step_executions] se 
    ON mv.workflow_execution_id = se.WorkflowExecutionId
    AND mv.created_at BETWEEN se.StartedAt AND ISNULL(se.EndedAt, DATEADD(HOUR, 1, se.StartedAt))
    AND se.StepType IN ('waitReply', 'waitForQRCode', 'waitforqrcode')
WHERE mv.step_index = 0; -- 只修復 step_index 為 0 的記錄

PRINT '✅ 已根據時間範圍自動匹配並更新 step_index';
GO

-- ================================================================
-- 方法 2：查看需要手動修復的記錄（如果方法 1 無法完全修復）
-- ================================================================

-- 顯示仍然需要手動修復的記錄
SELECT 
    mv.id,
    mv.workflow_execution_id,
    mv.step_index,
    mv.user_wa_id,
    mv.user_message,
    mv.message_type,
    mv.media_url,
    mv.created_at,
    mv.validator_type,
    -- 顯示可能匹配的步驟
    (
        SELECT TOP 1 
            CONCAT('StepIndex: ', se2.StepIndex, 
                   ', Type: ', se2.StepType, 
                   ', TaskName: ', se2.TaskName,
                   ', Started: ', FORMAT(se2.StartedAt, 'yyyy-MM-dd HH:mm:ss'))
        FROM [dbo].[workflow_step_executions] se2
        WHERE se2.WorkflowExecutionId = mv.workflow_execution_id
            AND se2.StepType IN ('waitReply', 'waitForQRCode', 'waitforqrcode')
            AND se2.StartedAt <= mv.created_at
        ORDER BY ABS(DATEDIFF(SECOND, se2.StartedAt, mv.created_at)) ASC
    ) AS SuggestedStep
FROM [dbo].[message_validations] mv
WHERE mv.step_index = 0
ORDER BY mv.workflow_execution_id, mv.created_at;

GO

-- ================================================================
-- 方法 3：手動修復特定記錄（根據實際情況調整）
-- ================================================================

-- 示例：修復 execution 2397 的記錄
-- 根據截圖中的時間戳：
-- - 19:22:20.187 和 19:22:54.257 是 waitForQRCode (第一個等待節點)
-- - 19:22:43.047 和 19:22:30.543 是 waitForQRCode (第一個等待節點)

-- 查看 execution 2397 的步驟執行記錄
SELECT 
    se.Id,
    se.StepIndex,
    se.StepType,
    se.TaskName,
    se.Status,
    se.IsWaiting,
    FORMAT(se.StartedAt, 'yyyy-MM-dd HH:mm:ss') AS StartedAt,
    FORMAT(se.EndedAt, 'yyyy-MM-dd HH:mm:ss') AS EndedAt
FROM [dbo].[workflow_step_executions] se
WHERE se.WorkflowExecutionId = 2397
    AND se.StepType IN ('waitReply', 'waitForQRCode', 'waitforqrcode')
ORDER BY se.StepIndex;

GO

-- 手動更新示例（請根據上面的查詢結果調整）
/*
-- 假設 waitForQRCode 的 StepIndex 是 2，waitReply 的 StepIndex 是 5

-- 更新 waitForQRCode 的驗證記錄
UPDATE [dbo].[message_validations]
SET step_index = 2
WHERE workflow_execution_id = 2397
    AND validator_type = 'qrcode'
    AND step_index = 0;

-- 更新 waitReply 的驗證記錄（根據媒體 URL 或時間）
UPDATE [dbo].[message_validations]
SET step_index = 5
WHERE workflow_execution_id = 2397
    AND validator_type = 'default'
    AND step_index = 0
    AND media_url LIKE '%reply_image_20251003_192320%';

PRINT '✅ 手動修復 execution 2397 的 step_index';
*/

GO

-- ================================================================
-- 驗證修復結果
-- ================================================================

-- 查看修復後的結果
SELECT 
    mv.id,
    mv.workflow_execution_id,
    mv.step_index,
    se.TaskName,
    se.StepType,
    mv.validator_type,
    mv.message_type,
    mv.user_message,
    FORMAT(mv.created_at, 'yyyy-MM-dd HH:mm:ss') AS created_at,
    mv.is_valid
FROM [dbo].[message_validations] mv
LEFT JOIN [dbo].[workflow_step_executions] se 
    ON mv.workflow_execution_id = se.WorkflowExecutionId 
    AND mv.step_index = se.StepIndex
WHERE mv.workflow_execution_id = 2397
ORDER BY mv.created_at;

GO

PRINT '================================================================';
PRINT '修復腳本執行完成！';
PRINT '請檢查上面的查詢結果，確認 step_index 是否正確匹配到對應的步驟。';
PRINT '如果還有 step_index = 0 的記錄，請使用方法 3 手動修復。';
PRINT '================================================================';

