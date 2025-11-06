-- ======================================================================
-- 更新 workflow_data_set_query_records 表
-- 將 data_set_record_id 欄位改為可空
-- 原因：外部數據源查詢時不一定有對應的 DataSetRecord
-- 日期：2025-09-30
-- ======================================================================

USE [PurpleRice];
GO

-- 檢查表是否存在
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[workflow_data_set_query_records]') AND type in (N'U'))
BEGIN
    PRINT '找到表 workflow_data_set_query_records，開始更新...';
    
    -- 檢查欄位是否存在
    IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[workflow_data_set_query_records]') AND name = 'data_set_record_id')
    BEGIN
        PRINT '開始修改 data_set_record_id 欄位為可空...';
        
        -- 1. 先刪除可能存在的外鍵約束
        DECLARE @ConstraintName nvarchar(200);
        SELECT @ConstraintName = name 
        FROM sys.foreign_keys 
        WHERE parent_object_id = OBJECT_ID(N'[dbo].[workflow_data_set_query_records]') 
          AND referenced_object_id = OBJECT_ID(N'[dbo].[data_set_records]')
          AND COL_NAME(parent_object_id, parent_column_id) = 'data_set_record_id';
        
        IF @ConstraintName IS NOT NULL
        BEGIN
            PRINT '刪除外鍵約束: ' + @ConstraintName;
            DECLARE @SQL nvarchar(500);
            SET @SQL = 'ALTER TABLE [dbo].[workflow_data_set_query_records] DROP CONSTRAINT ' + @ConstraintName;
            EXEC sp_executesql @SQL;
            PRINT '外鍵約束已刪除';
        END
        ELSE
        BEGIN
            PRINT '沒有找到外鍵約束';
        END
        
        -- 2. 修改欄位為可空
        ALTER TABLE [dbo].[workflow_data_set_query_records]
        ALTER COLUMN [data_set_record_id] UNIQUEIDENTIFIER NULL;
        
        PRINT 'data_set_record_id 欄位已成功修改為可空';
        
        -- 3. 可選：重新添加外鍵約束（如果需要）
        -- 注意：由於現在是可空欄位，外鍵約束會允許 NULL 值
        IF NOT EXISTS (
            SELECT * FROM sys.foreign_keys 
            WHERE parent_object_id = OBJECT_ID(N'[dbo].[workflow_data_set_query_records]') 
              AND referenced_object_id = OBJECT_ID(N'[dbo].[data_set_records]')
        )
        BEGIN
            PRINT '添加外鍵約束（允許 NULL）...';
            ALTER TABLE [dbo].[workflow_data_set_query_records]
            ADD CONSTRAINT FK_WorkflowDataSetQueryRecords_DataSetRecords
            FOREIGN KEY ([data_set_record_id]) 
            REFERENCES [dbo].[data_set_records]([id]);
            
            PRINT '外鍵約束已添加';
        END
        
        PRINT '✅ 數據庫更新完成！';
    END
    ELSE
    BEGIN
        PRINT '錯誤: 找不到欄位 data_set_record_id';
    END
END
ELSE
BEGIN
    PRINT '錯誤: 找不到表 workflow_data_set_query_records';
END
GO

-- 驗證更新
SELECT 
    c.name AS ColumnName,
    t.name AS DataType,
    c.max_length AS MaxLength,
    c.is_nullable AS IsNullable
FROM sys.columns c
JOIN sys.types t ON c.user_type_id = t.user_type_id
WHERE c.object_id = OBJECT_ID(N'[dbo].[workflow_data_set_query_records]')
  AND c.name = 'data_set_record_id';
GO

PRINT '========================================';
PRINT '更新完成！請檢查上方的驗證結果';
PRINT 'IsNullable 應該為 1（可空）';
PRINT '========================================';
GO
