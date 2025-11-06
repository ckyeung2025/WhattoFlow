-- =============================================
-- 聯絡人定時匯入排程相關資料表
-- 用於儲存聯絡人匯入的定時設定和執行記錄
-- =============================================

USE [PurpleRice]
GO

PRINT '========================================';
PRINT '開始創建聯絡人定時匯入資料表';
PRINT '========================================';
PRINT '';

-- 刪除已存在的表（如果存在）
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'contact_import_executions')
BEGIN
    PRINT '刪除已存在的 contact_import_executions 表...';
    DROP TABLE [dbo].[contact_import_executions];
    PRINT '✅ contact_import_executions 表已刪除';
END
GO

IF EXISTS (SELECT * FROM sys.tables WHERE name = 'contact_import_schedules')
BEGIN
    PRINT '刪除已存在的 contact_import_schedules 表...';
    DROP TABLE [dbo].[contact_import_schedules];
    PRINT '✅ contact_import_schedules 表已刪除';
END
GO

-- =============================================
-- 1. 聯絡人匯入排程表
-- =============================================
PRINT '';
PRINT '創建 contact_import_schedules 表...';

CREATE TABLE [dbo].[contact_import_schedules] (
    [id] UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
    [company_id] UNIQUEIDENTIFIER NOT NULL,
    [name] NVARCHAR(200) NOT NULL,  -- 匯入計劃名稱
    [import_type] NVARCHAR(20) NOT NULL,  -- 'excel', 'google', 'sql'
    
    -- 定時設定
    [is_scheduled] BIT NOT NULL DEFAULT 0,  -- 是否啟用定時匯入
    [schedule_type] NVARCHAR(20) NULL,  -- 'interval', 'daily', 'weekly', 'cron'
    [interval_minutes] INT NULL,  -- 間隔分鐘數（interval 類型用）
    [schedule_cron] NVARCHAR(100) NULL,  -- Cron 表達式
    [last_run_at] DATETIME2 NULL,  -- 上次執行時間
    [next_run_at] DATETIME2 NULL,  -- 下次執行時間
    
    -- 源配置 (JSON)
    [source_config] NVARCHAR(MAX) NOT NULL,  -- 存放 excelConfig, googleConfig, sqlConfig
    
    -- 字段映射 (JSON)
    [field_mapping] NVARCHAR(MAX) NOT NULL,  -- 存放字段映射
    
    -- 匯入設定
    [allow_update_duplicates] BIT NOT NULL DEFAULT 0,  -- 允許更新重複聯絡人
    [broadcast_group_id] UNIQUEIDENTIFIER NULL,
    
    -- 狀態
    [status] NVARCHAR(20) NOT NULL DEFAULT 'Active',  -- 'Active', 'Paused', 'Inactive'
    [is_active] BIT NOT NULL DEFAULT 1,
    
    -- 審計字段
    [created_at] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    [updated_at] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    [created_by] NVARCHAR(100) NOT NULL,
    [updated_by] NVARCHAR(100) NULL,
    
    CONSTRAINT [PK_contact_import_schedules] PRIMARY KEY CLUSTERED ([id] ASC)
);

PRINT '✅ contact_import_schedules 表已創建';
GO

-- 添加外鍵約束
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'Companies')
BEGIN
    PRINT '添加外鍵約束到 contact_import_schedules...';
    
    ALTER TABLE [dbo].[contact_import_schedules]
    ADD CONSTRAINT [FK_contact_import_schedules_companies] 
        FOREIGN KEY ([company_id]) 
        REFERENCES [dbo].[Companies]([Id]) 
        ON DELETE CASCADE;
    
    PRINT '✅ 外鍵約束已添加';
END
ELSE
BEGIN
    PRINT '⚠️ Companies 表不存在，跳過外鍵約束';
END
GO

-- 添加檢查約束
PRINT '添加檢查約束到 contact_import_schedules...';

ALTER TABLE [dbo].[contact_import_schedules]
ADD CONSTRAINT [CK_contact_import_schedules_import_type] 
    CHECK ([import_type] IN ('excel', 'google', 'sql'));

ALTER TABLE [dbo].[contact_import_schedules]
ADD CONSTRAINT [CK_contact_import_schedules_schedule_type] 
    CHECK ([schedule_type] IS NULL OR [schedule_type] IN ('interval', 'daily', 'weekly', 'cron'));

ALTER TABLE [dbo].[contact_import_schedules]
ADD CONSTRAINT [CK_contact_import_schedules_status] 
    CHECK ([status] IN ('Active', 'Paused', 'Inactive'));

PRINT '✅ 檢查約束已添加';
GO

-- =============================================
-- 2. 聯絡人匯入執行記錄表
-- =============================================
PRINT '';
PRINT '創建 contact_import_executions 表...';

CREATE TABLE [dbo].[contact_import_executions] (
    [id] UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
    [schedule_id] UNIQUEIDENTIFIER NOT NULL,
    [company_id] UNIQUEIDENTIFIER NOT NULL,
    
    -- 執行結果
    [status] NVARCHAR(20) NOT NULL,  -- 'Success', 'Failed', 'Partial', 'Running'
    [total_records] INT NOT NULL DEFAULT 0,  -- 總記錄數
    [success_count] INT NOT NULL DEFAULT 0,  -- 成功數
    [failed_count] INT NOT NULL DEFAULT 0,  -- 失敗數
    [error_message] NVARCHAR(MAX) NULL,  -- 錯誤訊息
    
    -- 時間戳
    [started_at] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    [completed_at] DATETIME2 NULL,  -- 完成時間
    
    CONSTRAINT [PK_contact_import_executions] PRIMARY KEY CLUSTERED ([id] ASC)
);

PRINT '✅ contact_import_executions 表已創建';
GO

-- 添加外鍵約束
PRINT '添加外鍵約束到 contact_import_executions...';

ALTER TABLE [dbo].[contact_import_executions]
ADD CONSTRAINT [FK_contact_import_executions_schedules] 
    FOREIGN KEY ([schedule_id]) 
    REFERENCES [dbo].[contact_import_schedules]([id]) 
    ON DELETE CASCADE;

PRINT '✅ 外鍵約束已添加';
GO

-- 添加檢查約束
PRINT '添加檢查約束到 contact_import_executions...';

ALTER TABLE [dbo].[contact_import_executions]
ADD CONSTRAINT [CK_contact_import_executions_status] 
    CHECK ([status] IN ('Success', 'Failed', 'Partial', 'Running'));

ALTER TABLE [dbo].[contact_import_executions]
ADD CONSTRAINT [CK_contact_import_executions_counts] 
    CHECK ([total_records] >= 0 AND [success_count] >= 0 AND [failed_count] >= 0);

PRINT '✅ 檢查約束已添加';
GO

-- =============================================
-- 索引
-- =============================================
PRINT '';
PRINT '創建索引...';

-- contact_import_schedules 索引
CREATE NONCLUSTERED INDEX [IX_contact_import_schedules_company_id] 
    ON [dbo].[contact_import_schedules] ([company_id] ASC);

CREATE NONCLUSTERED INDEX [IX_contact_import_schedules_status] 
    ON [dbo].[contact_import_schedules] ([status] ASC);

CREATE NONCLUSTERED INDEX [IX_contact_import_schedules_next_run_at] 
    ON [dbo].[contact_import_schedules] ([next_run_at] ASC);

CREATE NONCLUSTERED INDEX [IX_contact_import_schedules_is_scheduled] 
    ON [dbo].[contact_import_schedules] ([is_scheduled] ASC);

CREATE NONCLUSTERED INDEX [IX_contact_import_schedules_import_type] 
    ON [dbo].[contact_import_schedules] ([import_type] ASC);

PRINT '✅ contact_import_schedules 索引已創建';

-- contact_import_executions 索引
CREATE NONCLUSTERED INDEX [IX_contact_import_executions_schedule_id] 
    ON [dbo].[contact_import_executions] ([schedule_id] ASC);

CREATE NONCLUSTERED INDEX [IX_contact_import_executions_company_id] 
    ON [dbo].[contact_import_executions] ([company_id] ASC);

CREATE NONCLUSTERED INDEX [IX_contact_import_executions_started_at] 
    ON [dbo].[contact_import_executions] ([started_at] DESC);

CREATE NONCLUSTERED INDEX [IX_contact_import_executions_status] 
    ON [dbo].[contact_import_executions] ([status] ASC);

PRINT '✅ contact_import_executions 索引已創建';
GO

-- =============================================
-- 觸發器：自動更新 updated_at 欄位
-- =============================================
PRINT '';
PRINT '創建觸發器...';

-- 刪除舊觸發器（如果存在）
IF EXISTS (SELECT * FROM sys.triggers WHERE name = 'TR_contact_import_schedules_updated_at')
BEGIN
    DROP TRIGGER [dbo].[TR_contact_import_schedules_updated_at];
    PRINT '舊觸發器已刪除';
END
GO

-- 創建新的觸發器
CREATE TRIGGER [dbo].[TR_contact_import_schedules_updated_at]
ON [dbo].[contact_import_schedules]
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    
    UPDATE [dbo].[contact_import_schedules]
    SET [updated_at] = GETUTCDATE()
    WHERE [id] IN (SELECT DISTINCT [id] FROM inserted);
END;
GO

PRINT '✅ 觸發器已創建';
GO

-- =============================================
-- 驗證
-- =============================================
PRINT '';
PRINT '========================================';
PRINT '驗證結果:';
PRINT '========================================';

-- 檢查表是否存在
SELECT 
    '表結構驗證' AS 類別,
    name AS 表名,
    CASE WHEN name IS NOT NULL THEN '✅ 存在' ELSE '❌ 不存在' END AS 狀態
FROM sys.tables
WHERE name IN ('contact_import_schedules', 'contact_import_executions');

-- 檢查索引
SELECT 
    '索引驗證' AS 類別,
    i.name AS 索引名,
    t.name AS 表名,
    CASE WHEN i.name IS NOT NULL THEN '✅ 存在' ELSE '❌ 不存在' END AS 狀態
FROM sys.indexes i
INNER JOIN sys.tables t ON i.object_id = t.object_id
WHERE t.name IN ('contact_import_schedules', 'contact_import_executions')
    AND i.name LIKE 'IX_%'
ORDER BY t.name, i.name;

-- 檢查約束
SELECT 
    '約束驗證' AS 類別,
    cc.name AS 約束名,
    t.name AS 表名,
    cc.definition AS 定義
FROM sys.check_constraints cc
INNER JOIN sys.tables t ON cc.parent_object_id = t.object_id
WHERE t.name IN ('contact_import_schedules', 'contact_import_executions')
ORDER BY t.name, cc.name;

-- 檢查外鍵
SELECT 
    '外鍵驗證' AS 類別,
    fk.name AS 外鍵名,
    OBJECT_NAME(fk.parent_object_id) AS 子表,
    OBJECT_NAME(fk.referenced_object_id) AS 父表
FROM sys.foreign_keys fk
WHERE OBJECT_NAME(fk.parent_object_id) IN ('contact_import_schedules', 'contact_import_executions')
ORDER BY OBJECT_NAME(fk.parent_object_id);

PRINT '';
PRINT '========================================';
PRINT '✅ 聯絡人定時匯入資料表創建完成！';
PRINT '========================================';
PRINT '';
PRINT '已創建：';
PRINT '  1. contact_import_schedules - 匯入排程表';
PRINT '  2. contact_import_executions - 執行記錄表';
PRINT '  3. 相關索引和約束';
PRINT '  4. 自動更新時間戳的觸發器';
PRINT '';
PRINT '下一步：請更新 C# Model 和 DbContext';
PRINT '========================================';
GO

