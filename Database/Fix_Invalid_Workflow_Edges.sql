-- ================================================================
-- 清理 WorkflowDefinitions 中的無效 Edges
-- 問題：當節點被刪除時，前端沒有同時刪除相關的 edges
-- 結果：流程定義中包含指向不存在節點的 edges，導致重複執行
-- ================================================================

-- 備份表
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'WorkflowDefinitions_Backup_InvalidEdges')
BEGIN
    SELECT * 
    INTO WorkflowDefinitions_Backup_InvalidEdges
    FROM WorkflowDefinitions;
    
    PRINT '已備份 WorkflowDefinitions 表到 WorkflowDefinitions_Backup_InvalidEdges';
END

-- 宣告變數
DECLARE @Id INT;
DECLARE @Json NVARCHAR(MAX);
DECLARE @UpdatedJson NVARCHAR(MAX);
DECLARE @UpdateCount INT = 0;

-- 遊標遍歷所有流程定義
DECLARE workflow_cursor CURSOR FOR 
SELECT Id, Json FROM WorkflowDefinitions WHERE Json IS NOT NULL;

OPEN workflow_cursor;
FETCH NEXT FROM workflow_cursor INTO @Id, @Json;

WHILE @@FETCH_STATUS = 0
BEGIN
    BEGIN TRY
        -- 提取 nodes 和 edges
        DECLARE @NodesJson NVARCHAR(MAX);
        DECLARE @EdgesJson NVARCHAR(MAX);
        DECLARE @NodeIds NVARCHAR(MAX) = '';
        DECLARE @ValidEdges NVARCHAR(MAX) = '';
        
        -- 獲取所有節點的 ID
        SELECT @NodeIds = STRING_AGG(CAST(JSON_VALUE(value, '$.id') AS NVARCHAR(MAX)), '|')
        FROM OPENJSON(@Json, '$.nodes');
        
        IF @NodeIds IS NOT NULL
        BEGIN
            -- 過濾有效的 edges（source 和 target 都存在於 nodes 中）
            SELECT @ValidEdges = 
                '[' + 
                STRING_AGG(
                    CAST(value AS NVARCHAR(MAX)), 
                    ','
                ) + 
                ']'
            FROM OPENJSON(@Json, '$.edges')
            WHERE 
                CHARINDEX(JSON_VALUE(value, '$.source'), @NodeIds) > 0
                AND CHARINDEX(JSON_VALUE(value, '$.target'), @NodeIds) > 0;
            
            -- 如果有變更，重建 JSON
            IF @ValidEdges IS NOT NULL AND @ValidEdges != '[]'
            BEGIN
                -- 重新組合 JSON（保留 nodes，替換 edges）
                SET @UpdatedJson = JSON_MODIFY(
                    JSON_MODIFY(@Json, '$.edges', JSON_QUERY(@ValidEdges)),
                    '$.nodes',
                    JSON_QUERY(@Json, '$.nodes')
                );
                
                -- 檢查是否有變更
                IF @UpdatedJson != @Json
                BEGIN
                    UPDATE WorkflowDefinitions 
                    SET Json = @UpdatedJson, 
                        UpdatedAt = GETDATE()
                    WHERE Id = @Id;
                    
                    SET @UpdateCount = @UpdateCount + 1;
                    PRINT '已清理流程 ID: ' + CAST(@Id AS NVARCHAR(10));
                END
            END
            ELSE IF @ValidEdges = '[]'
            BEGIN
                -- 所有 edges 都無效，清空 edges 陣列
                SET @UpdatedJson = JSON_MODIFY(@Json, '$.edges', JSON_QUERY('[]'));
                
                UPDATE WorkflowDefinitions 
                SET Json = @UpdatedJson, 
                    UpdatedAt = GETDATE()
                WHERE Id = @Id;
                
                SET @UpdateCount = @UpdateCount + 1;
                PRINT '已清理流程 ID: ' + CAST(@Id AS NVARCHAR(10)) + ' (所有 edges 已移除)';
            END
        END
    END TRY
    BEGIN CATCH
        PRINT '處理流程 ID: ' + CAST(@Id AS NVARCHAR(10)) + ' 時發生錯誤';
        PRINT '錯誤訊息: ' + ERROR_MESSAGE();
    END CATCH;
    
    FETCH NEXT FROM workflow_cursor INTO @Id, @Json;
END

CLOSE workflow_cursor;
DEALLOCATE workflow_cursor;

PRINT '======================================';
PRINT '清理完成';
PRINT '共更新了 ' + CAST(@UpdateCount AS NVARCHAR(10)) + ' 個流程定義';
PRINT '======================================';

-- 驗證結果
SELECT 
    Id,
    Name,
    (SELECT COUNT(*) FROM OPENJSON(Json, '$.nodes')) AS NodeCount,
    (SELECT COUNT(*) FROM OPENJSON(Json, '$.edges')) AS EdgeCount,
    UpdatedAt
FROM WorkflowDefinitions
ORDER BY UpdatedAt DESC;

