-- =====================================================
-- 工作流 DataSet 查詢功能數據表創建腳本
-- 創建日期: 2025-01-27
-- 描述: 為工作流 DataSet 查詢節點添加數據表支持
-- =====================================================

-- 1. 創建工作流 DataSet 查詢結果表
CREATE TABLE workflow_data_set_query_results (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    workflow_execution_id INT NOT NULL,
    step_execution_id INT NOT NULL,
    data_set_id UNIQUEIDENTIFIER NOT NULL,
    operation_type NVARCHAR(20) NOT NULL, -- SELECT, INSERT, UPDATE, DELETE
    query_conditions NVARCHAR(MAX), -- JSON 格式的查詢條件
    query_result NVARCHAR(MAX), -- JSON 格式的查詢結果快照
    mapped_fields NVARCHAR(MAX), -- JSON 格式的欄位映射配置
    process_variables_used NVARCHAR(MAX), -- JSON 格式的使用的流程變量
    executed_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    status NVARCHAR(20) NOT NULL DEFAULT 'Success', -- Success, Failed, Partial
    error_message NVARCHAR(MAX),
    total_records INT DEFAULT 0, -- 查詢到的記錄總數
    records_processed INT DEFAULT 0, -- 已處理的記錄數
    
    -- 外鍵約束
    CONSTRAINT FK_workflow_data_set_query_results_execution 
        FOREIGN KEY (workflow_execution_id) REFERENCES workflow_executions(id) ON DELETE CASCADE,
    CONSTRAINT FK_workflow_data_set_query_results_step 
        FOREIGN KEY (step_execution_id) REFERENCES workflow_step_executions(id) ON DELETE CASCADE,
    CONSTRAINT FK_workflow_data_set_query_results_dataset 
        FOREIGN KEY (data_set_id) REFERENCES data_sets(id) ON DELETE CASCADE,
    
    -- 檢查約束
    CONSTRAINT CK_workflow_data_set_query_results_operation_type 
        CHECK (operation_type IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')),
    CONSTRAINT CK_workflow_data_set_query_results_status 
        CHECK (status IN ('Success', 'Failed', 'Partial', 'Running'))
);

-- 2. 創建工作流 DataSet 查詢記錄關聯表
CREATE TABLE workflow_data_set_query_records (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    query_result_id UNIQUEIDENTIFIER NOT NULL,
    data_set_record_id UNIQUEIDENTIFIER NOT NULL,
    record_primary_key NVARCHAR(255), -- 主鍵值，如 invoice_no
    record_status NVARCHAR(50), -- 記錄狀態
    mapped_variable_name NVARCHAR(100), -- 映射到的流程變量名稱
    mapped_variable_value NVARCHAR(MAX), -- 映射到的流程變量值
    created_at DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    
    -- 外鍵約束
    CONSTRAINT FK_workflow_data_set_query_records_result 
        FOREIGN KEY (query_result_id) REFERENCES workflow_data_set_query_results(id) ON DELETE CASCADE,
    CONSTRAINT FK_workflow_data_set_query_records_record 
        FOREIGN KEY (data_set_record_id) REFERENCES data_set_records(id) ON DELETE CASCADE
);

-- 3. 創建索引以提升查詢性能
-- 工作流執行查詢結果索引
CREATE INDEX IX_workflow_data_set_query_results_execution 
    ON workflow_data_set_query_results(workflow_execution_id);

CREATE INDEX IX_workflow_data_set_query_results_dataset 
    ON workflow_data_set_query_results(data_set_id);

CREATE INDEX IX_workflow_data_set_query_results_executed_at 
    ON workflow_data_set_query_results(executed_at);

-- 查詢記錄關聯索引
CREATE INDEX IX_workflow_data_set_query_records_result 
    ON workflow_data_set_query_records(query_result_id);

CREATE INDEX IX_workflow_data_set_query_records_record 
    ON workflow_data_set_query_records(data_set_record_id);

CREATE INDEX IX_workflow_data_set_query_records_primary_key 
    ON workflow_data_set_query_records(record_primary_key);

-- 4. 添加表註釋
EXEC sys.sp_addextendedproperty 
    @name = N'MS_Description', 
    @value = N'工作流 DataSet 查詢結果表，保存每次查詢的完整結果快照', 
    @level0type = N'SCHEMA', @level0name = N'dbo', 
    @level1type = N'TABLE', @level1name = N'workflow_data_set_query_results';

EXEC sys.sp_addextendedproperty 
    @name = N'MS_Description', 
    @value = N'工作流 DataSet 查詢記錄關聯表，指向實際的 DataSet 記錄', 
    @level0type = N'SCHEMA', @level0name = N'dbo', 
    @level1type = N'TABLE', @level1name = N'workflow_data_set_query_records';

-- 5. 添加欄位註釋
-- workflow_data_set_query_results 表欄位註釋
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'查詢結果唯一標識', @level0type = N'SCHEMA', @level0name = N'dbo', @level1type = N'TABLE', @level1name = N'workflow_data_set_query_results', @level2type = N'COLUMN', @level2name = N'id';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'工作流執行ID', @level0type = N'SCHEMA', @level0name = N'dbo', @level1type = N'TABLE', @level1name = N'workflow_data_set_query_results', @level2type = N'COLUMN', @level2name = N'workflow_execution_id';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'步驟執行ID', @level0type = N'SCHEMA', @level0name = N'dbo', @level1type = N'TABLE', @level1name = N'workflow_data_set_query_results', @level2type = N'COLUMN', @level2name = N'step_execution_id';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'DataSet ID', @level0type = N'SCHEMA', @level0name = N'dbo', @level1type = N'TABLE', @level1name = N'workflow_data_set_query_results', @level2type = N'COLUMN', @level2name = N'data_set_id';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'操作類型：SELECT, INSERT, UPDATE, DELETE', @level0type = N'SCHEMA', @level0name = N'dbo', @level1type = N'TABLE', @level1name = N'workflow_data_set_query_results', @level2type = N'COLUMN', @level2name = N'operation_type';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'查詢條件（JSON格式）', @level0type = N'SCHEMA', @level0name = N'dbo', @level1type = N'TABLE', @level1name = N'workflow_data_set_query_results', @level2type = N'COLUMN', @level2name = N'query_conditions';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'查詢結果快照（JSON格式）', @level0type = N'SCHEMA', @level0name = N'dbo', @level1type = N'TABLE', @level1name = N'workflow_data_set_query_results', @level2type = N'COLUMN', @level2name = N'query_result';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'欄位映射配置（JSON格式）', @level0type = N'SCHEMA', @level0name = N'dbo', @level1type = N'TABLE', @level1name = N'workflow_data_set_query_results', @level2type = N'COLUMN', @level2name = N'mapped_fields';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'使用的流程變量（JSON格式）', @level0type = N'SCHEMA', @level0name = N'dbo', @level1type = N'TABLE', @level1name = N'workflow_data_set_query_results', @level2type = N'COLUMN', @level2name = N'process_variables_used';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'執行時間', @level0type = N'SCHEMA', @level0name = N'dbo', @level1type = N'TABLE', @level1name = N'workflow_data_set_query_results', @level2type = N'COLUMN', @level2name = N'executed_at';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'執行狀態', @level0type = N'SCHEMA', @level0name = N'dbo', @level1type = N'TABLE', @level1name = N'workflow_data_set_query_results', @level2type = N'COLUMN', @level2name = N'status';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'錯誤訊息', @level0type = N'SCHEMA', @level0name = N'dbo', @level1type = N'TABLE', @level1name = N'workflow_data_set_query_results', @level2type = N'COLUMN', @level2name = N'error_message';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'查詢到的記錄總數', @level0type = N'SCHEMA', @level0name = N'dbo', @level1type = N'TABLE', @level1name = N'workflow_data_set_query_results', @level2type = N'COLUMN', @level2name = N'total_records';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'已處理的記錄數', @level0type = N'SCHEMA', @level0name = N'dbo', @level1type = N'TABLE', @level1name = N'workflow_data_set_query_results', @level2type = N'COLUMN', @level2name = N'records_processed';

-- workflow_data_set_query_records 表欄位註釋
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'記錄關聯唯一標識', @level0type = N'SCHEMA', @level0name = N'dbo', @level1type = N'TABLE', @level1name = N'workflow_data_set_query_records', @level2type = N'COLUMN', @level2name = N'id';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'查詢結果ID', @level0type = N'SCHEMA', @level0name = N'dbo', @level1type = N'TABLE', @level1name = N'workflow_data_set_query_records', @level2type = N'COLUMN', @level2name = N'query_result_id';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'DataSet記錄ID', @level0type = N'SCHEMA', @level0name = N'dbo', @level1type = N'TABLE', @level1name = N'workflow_data_set_query_records', @level2type = N'COLUMN', @level2name = N'data_set_record_id';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'記錄主鍵值', @level0type = N'SCHEMA', @level0name = N'dbo', @level1type = N'TABLE', @level1name = N'workflow_data_set_query_records', @level2type = N'COLUMN', @level2name = N'record_primary_key';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'記錄狀態', @level0type = N'SCHEMA', @level0name = N'dbo', @level1type = N'TABLE', @level1name = N'workflow_data_set_query_records', @level2type = N'COLUMN', @level2name = N'record_status';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'映射到的流程變量名稱', @level0type = N'SCHEMA', @level0name = N'dbo', @level1type = N'TABLE', @level1name = N'workflow_data_set_query_records', @level2type = N'COLUMN', @level2name = N'mapped_variable_name';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'映射到的流程變量值', @level0type = N'SCHEMA', @level0name = N'dbo', @level1type = N'TABLE', @level1name = N'workflow_data_set_query_records', @level2type = N'COLUMN', @level2name = N'mapped_variable_value';
EXEC sys.sp_addextendedproperty @name = N'MS_Description', @value = N'創建時間', @level0type = N'SCHEMA', @level0name = N'dbo', @level1type = N'TABLE', @level1name = N'workflow_data_set_query_records', @level2type = N'COLUMN', @level2name = N'created_at';

-- 6. 創建視圖以便於查詢
CREATE VIEW v_workflow_dataset_query_summary AS
SELECT 
    wqrr.id,
    wqrr.workflow_execution_id,
    wqrr.step_execution_id,
    wqrr.data_set_id,
    ds.name as data_set_name,
    wqrr.operation_type,
    wqrr.status,
    wqrr.executed_at,
    wqrr.total_records,
    wqrr.records_processed,
    wqrr.error_message,
    we.status as workflow_status,
    wse.StepType as step_type,
    wse.Status as step_status
FROM workflow_data_set_query_results wqrr
LEFT JOIN data_sets ds ON wqrr.data_set_id = ds.id
LEFT JOIN workflow_executions we ON wqrr.workflow_execution_id = we.id
LEFT JOIN workflow_step_executions wse ON wqrr.step_execution_id = wse.id;

-- 7. 添加視圖註釋
EXEC sys.sp_addextendedproperty 
    @name = N'MS_Description', 
    @value = N'工作流 DataSet 查詢結果摘要視圖', 
    @level0type = N'SCHEMA', @level0name = N'dbo', 
    @level1type = N'VIEW', @level1name = N'v_workflow_dataset_query_summary';

PRINT '工作流 DataSet 查詢功能數據表創建完成！';
PRINT '已創建表：';
PRINT '- workflow_data_set_query_results';
PRINT '- workflow_data_set_query_records';
PRINT '已創建視圖：';
PRINT '- v_workflow_dataset_query_summary';
PRINT '已創建索引和約束，提升查詢性能。';
