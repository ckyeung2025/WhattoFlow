-- =============================================
-- Migration: 添加 TargetTableName 欄位到 data_set_data_sources 表
-- 日期: 2025-01-01
-- 說明: 為 SQL 數據源添加目標表名配置，用於出站同步和雙向同步
--       此欄位只在 syncDirection 為 outbound 或 bidirectional 時使用
-- =============================================

USE [PurpleRice]  -- 請根據實際數據庫名稱修改
GO

PRINT '--- 開始添加 TargetTableName 欄位到 data_set_data_sources 表 ---';
GO

-- 檢查並添加 target_table_name 欄位
IF NOT EXISTS (
    SELECT 1 FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'dbo.data_set_data_sources') 
    AND name = 'target_table_name'
)
BEGIN
    ALTER TABLE dbo.data_set_data_sources
    ADD target_table_name NVARCHAR(200) NULL;
    
    PRINT '✅ target_table_name 欄位已添加';
END
ELSE
BEGIN
    PRINT '⚠️ target_table_name 欄位已存在，跳過';
END
GO

-- 驗證欄位已正確添加
IF EXISTS (
    SELECT 1 FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'dbo.data_set_data_sources') 
    AND name = 'target_table_name'
)
BEGIN
    PRINT '✅ 驗證成功：target_table_name 欄位已存在於 data_set_data_sources 表';
    
    -- 顯示欄位信息
    SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        CHARACTER_MAXIMUM_LENGTH,
        IS_NULLABLE,
        COLUMN_DEFAULT
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'data_set_data_sources' 
    AND COLUMN_NAME = 'target_table_name';
END
ELSE
BEGIN
    PRINT '❌ 錯誤：target_table_name 欄位未成功添加';
END
GO

-- 顯示更新後的表結構（相關欄位）
PRINT '--- data_set_data_sources 表相關欄位結構 ---';
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    CHARACTER_MAXIMUM_LENGTH,
    IS_NULLABLE,
    COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'data_set_data_sources' 
AND COLUMN_NAME IN ('source_type', 'sql_query', 'target_table_name')
ORDER BY 
    CASE COLUMN_NAME
        WHEN 'source_type' THEN 1
        WHEN 'sql_query' THEN 2
        WHEN 'target_table_name' THEN 3
    END;
GO

PRINT '--- 遷移完成 ---';
PRINT '✅ target_table_name 欄位已成功添加到 data_set_data_sources 表';
PRINT '📝 說明：此欄位用於 SQL 出站同步和雙向同步，指定要寫入的目標表名';
PRINT '📝 注意：此欄位只在 syncDirection 為 outbound 或 bidirectional 時需要填寫';
GO

