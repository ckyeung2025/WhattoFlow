-- =============================================
-- 排程執行記錄統一表
-- 記錄所有類型的排程執行狀態（重試監控、逾期監控、數據集同步、聯絡人匯入等）
-- =============================================

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[scheduler_executions]') AND type in (N'U'))
BEGIN
    PRINT '';
    PRINT '創建 scheduler_executions 表...';
    
    CREATE TABLE [dbo].[scheduler_executions] (
        [id] UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        [company_id] UNIQUEIDENTIFIER NOT NULL,  -- 必填：記錄執行任務的公司 ID
        
        -- 排程類型
        [schedule_type] NVARCHAR(50) NOT NULL,  -- 'retry_monitoring', 'overdue_monitoring', 'dataset_sync', 'contact_import'
        
        -- 關聯信息
        [related_id] UNIQUEIDENTIFIER NULL,     -- 關聯的目標 ID（如 workflow_id, dataset_id, schedule_id）
        [related_name] NVARCHAR(200) NULL,      -- 關聯目標的名稱（便於查詢）
        
        -- 執行結果
        [status] NVARCHAR(20) NOT NULL,          -- 'Success', 'Failed', 'Partial', 'Running', 'Skipped'
        [total_items] INT NOT NULL DEFAULT 0,   -- 處理的項目總數
        [success_count] INT NOT NULL DEFAULT 0, -- 成功數
        [failed_count] INT NOT NULL DEFAULT 0,  -- 失敗數
        
        -- 訊息和錯誤
        [message] NVARCHAR(500) NULL,           -- 摘要訊息
        [error_message] NVARCHAR(MAX) NULL,     -- 詳細錯誤訊息
        
        -- 執行時間
        [started_at] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        [completed_at] DATETIME2 NULL,
        [execution_duration_ms] INT NULL,       -- 執行耗時（毫秒）
        
        -- 審計字段
        [created_by] NVARCHAR(100) NOT NULL DEFAULT 'system',
        
        CONSTRAINT [PK_scheduler_executions] PRIMARY KEY CLUSTERED ([id] ASC)
    );
    
    PRINT '✅ scheduler_executions 表已創建';
END
ELSE
BEGIN
    PRINT '⚠️ scheduler_executions 表已存在，跳過';
END
GO

-- =============================================
-- 添加索引
-- =============================================
PRINT '';
PRINT '創建 scheduler_executions 索引...';

-- 按排程類型查詢
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_scheduler_executions_type')
BEGIN
    CREATE NONCLUSTERED INDEX [IX_scheduler_executions_type] 
        ON [dbo].[scheduler_executions] ([schedule_type] ASC);
    PRINT '✅ IX_scheduler_executions_type 索引已創建';
END

-- 按狀態查詢
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_scheduler_executions_status')
BEGIN
    CREATE NONCLUSTERED INDEX [IX_scheduler_executions_status] 
        ON [dbo].[scheduler_executions] ([status] ASC);
    PRINT '✅ IX_scheduler_executions_status 索引已創建';
END

-- 按開始時間查詢（用於時間範圍篩選）
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_scheduler_executions_started_at')
BEGIN
    CREATE NONCLUSTERED INDEX [IX_scheduler_executions_started_at] 
        ON [dbo].[scheduler_executions] ([started_at] DESC);
    PRINT '✅ IX_scheduler_executions_started_at 索引已創建';
END

-- 按公司查詢
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_scheduler_executions_company_id')
BEGIN
    CREATE NONCLUSTERED INDEX [IX_scheduler_executions_company_id] 
        ON [dbo].[scheduler_executions] ([company_id] ASC);
    PRINT '✅ IX_scheduler_executions_company_id 索引已創建';
END

-- 按關聯 ID 查詢
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_scheduler_executions_related_id')
BEGIN
    CREATE NONCLUSTERED INDEX [IX_scheduler_executions_related_id] 
        ON [dbo].[scheduler_executions] ([related_id] ASC);
    PRINT '✅ IX_scheduler_executions_related_id 索引已創建';
END

-- 複合索引：類型 + 開始時間（常見查詢）
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_scheduler_executions_type_started_at')
BEGIN
    CREATE NONCLUSTERED INDEX [IX_scheduler_executions_type_started_at] 
        ON [dbo].[scheduler_executions] ([schedule_type] ASC, [started_at] DESC);
    PRINT '✅ IX_scheduler_executions_type_started_at 索引已創建';
END

PRINT '✅ scheduler_executions 索引已創建';
GO

-- =============================================
-- 創建視圖：便於查詢的友好視圖
-- =============================================
PRINT '';
PRINT '創建 scheduler_executions 視圖...';

IF EXISTS (SELECT * FROM sys.views WHERE name = 'vw_scheduler_executions')
BEGIN
    DROP VIEW [dbo].[vw_scheduler_executions];
    PRINT '舊視圖已刪除';
END
GO

CREATE VIEW [dbo].[vw_scheduler_executions]
AS
SELECT
    se.id,
    se.company_id,
    se.schedule_type,
    CASE se.schedule_type
        WHEN 'retry_monitoring' THEN '重試監控'
        WHEN 'overdue_monitoring' THEN '逾期監控'
        WHEN 'dataset_sync' THEN '數據集同步'
        WHEN 'contact_import' THEN '聯絡人匯入'
        ELSE se.schedule_type
    END AS schedule_type_name,
    se.related_id,
    se.related_name,
    se.status,
    se.total_items,
    se.success_count,
    se.failed_count,
    se.message,
    se.error_message,
    se.started_at,
    se.completed_at,
    se.execution_duration_ms,
    DATEDIFF(SECOND, se.started_at, se.completed_at) AS duration_seconds,
    se.created_by
FROM [dbo].[scheduler_executions] se;
GO

PRINT '✅ scheduler_executions 視圖已創建';
GO

-- =============================================
-- 清理舊數據（可選，僅執行一次）
-- =============================================
PRINT '';
PRINT '完成！';
PRINT '';
PRINT '表結構：';
PRINT '  - scheduler_executions: 統一記錄所有排程執行狀態';
PRINT '';
PRINT '排程類型：';
PRINT '  - retry_monitoring: 重試監控（檢查等待步驟並發送重試訊息）';
PRINT '  - overdue_monitoring: 逾期監控（檢查逾期流程並發送通知）';
PRINT '  - dataset_sync: 數據集自動同步';
PRINT '  - contact_import: 聯絡人定時匯入';
PRINT '';
PRINT '使用方式：';
PRINT '  1. 查詢所有執行記錄: SELECT * FROM vw_scheduler_executions ORDER BY started_at DESC';
PRINT '  2. 按類型查詢: SELECT * FROM vw_scheduler_executions WHERE schedule_type = ''contact_import''';
PRINT '  3. 查詢失敗記錄: SELECT * FROM vw_scheduler_executions WHERE status = ''Failed''';
PRINT '  4. 按時間範圍查詢: SELECT * FROM vw_scheduler_executions WHERE started_at >= @start_date AND started_at <= @end_date';
GO

