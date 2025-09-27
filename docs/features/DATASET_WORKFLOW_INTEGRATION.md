# DataSet 工作流集成功能

## 🎯 **功能概述**

DataSet 工作流集成是 WhattoFlow 系統的核心功能之一，允許在工作流程中直接操作 DataSet，包括查詢、插入、更新和刪除操作。這個功能將 DataSet 作為中央化的數據中轉站，為 Cloud 環境提供安全可靠的數據操作能力。

## 🏗️ **設計理念**

### **核心概念**
- **DataSet 作為中轉站**: 所有外部數據源通過 DataSet 統一管理
- **Cloud 友好**: 避免直接連接外部數據庫，提高安全性
- **時間差容忍**: 數據同步有時間差，但更安全可靠
- **雙重處理策略**: 關鍵字段映射到流程變量，完整數據存儲在關係表中

### **角色分工**
- **流程變量**: 用於流程內部邏輯控制，只映射關鍵字段
- **DataSet 查詢結果**: 用於完整的業務數據展示，支持實時更新

## 🚀 **核心功能**

### **1. 多操作類型支持**
- **SELECT**: 查詢數據集記錄
- **INSERT**: 插入新記錄
- **UPDATE**: 更新現有記錄
- **DELETE**: 刪除記錄

### **2. 智能數據映射**
- **關鍵字段映射**: 將重要字段映射到流程變量
- **完整數據存儲**: 所有查詢結果存儲在關係表中
- **實時數據顯示**: 支持查看最新數據

### **3. 多數據源支持**
- **SQL 數據庫**: 直接執行 SQL 操作
- **Excel 文件**: 通過 DataSet 同步機制處理
- **Google Docs**: 通過 DataSet 同步機制處理

## 🗄️ **數據庫設計**

### **1. 關係表設計**
```sql
-- 流程實例與 DataSet 查詢結果的關係表
CREATE TABLE WorkflowInstanceDataSetRecords (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    WorkflowInstanceId UNIQUEIDENTIFIER NOT NULL,
    WorkflowStepExecutionId UNIQUEIDENTIFIER NOT NULL,
    DataSetId UNIQUEIDENTIFIER NOT NULL,
    DataSetRecordId UNIQUEIDENTIFIER NOT NULL,
    QueryConditions NVARCHAR(MAX), -- 查詢條件 JSON
    MappedVariables NVARCHAR(MAX), -- 映射的變量 JSON
    QueryTimestamp DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    CreatedBy NVARCHAR(255),
    
    CONSTRAINT FK_WorkflowInstanceDataSetRecords_WorkflowInstance 
        FOREIGN KEY (WorkflowInstanceId) REFERENCES WorkflowExecutions(Id),
    CONSTRAINT FK_WorkflowInstanceDataSetRecords_WorkflowStepExecution 
        FOREIGN KEY (WorkflowStepExecutionId) REFERENCES WorkflowStepExecutions(Id),
    CONSTRAINT FK_WorkflowInstanceDataSetRecords_DataSet 
        FOREIGN KEY (DataSetId) REFERENCES DataSets(Id),
    CONSTRAINT FK_WorkflowInstanceDataSetRecords_DataSetRecord 
        FOREIGN KEY (DataSetRecordId) REFERENCES DataSetRecords(Id)
);

-- DataSet 操作記錄表（用於追蹤 INSERT/UPDATE 操作）
CREATE TABLE DataSetOperationRecords (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    DataSetId UNIQUEIDENTIFIER NOT NULL,
    OperationType NVARCHAR(50) NOT NULL, -- INSERT, UPDATE, DELETE
    TargetRecordId UNIQUEIDENTIFIER, -- 目標記錄 ID（UPDATE/DELETE 時使用）
    OperationData NVARCHAR(MAX), -- 操作數據 JSON
    OperationConditions NVARCHAR(MAX), -- 操作條件 JSON（UPDATE/DELETE 時使用）
    WorkflowInstanceId UNIQUEIDENTIFIER,
    WorkflowStepExecutionId UNIQUEIDENTIFIER,
    Status NVARCHAR(50) NOT NULL DEFAULT 'Pending', -- Pending, Processing, Completed, Failed
    ErrorMessage NVARCHAR(MAX),
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    ProcessedAt DATETIME2,
    CreatedBy NVARCHAR(255),
    
    CONSTRAINT FK_DataSetOperationRecords_DataSet 
        FOREIGN KEY (DataSetId) REFERENCES DataSets(Id),
    CONSTRAINT FK_DataSetOperationRecords_WorkflowInstance 
        FOREIGN KEY (WorkflowInstanceId) REFERENCES WorkflowExecutions(Id),
    CONSTRAINT FK_DataSetOperationRecords_WorkflowStepExecution 
        FOREIGN KEY (WorkflowStepExecutionId) REFERENCES WorkflowStepExecutions(Id)
);

-- 索引優化
CREATE INDEX IX_WorkflowInstanceDataSetRecords_WorkflowInstanceId 
    ON WorkflowInstanceDataSetRecords(WorkflowInstanceId);
CREATE INDEX IX_WorkflowInstanceDataSetRecords_DataSetId 
    ON WorkflowInstanceDataSetRecords(DataSetId);
CREATE INDEX IX_DataSetOperationRecords_DataSetId ON DataSetOperationRecords(DataSetId);
CREATE INDEX IX_DataSetOperationRecords_Status ON DataSetOperationRecords(Status);
CREATE INDEX IX_DataSetOperationRecords_WorkflowInstanceId ON DataSetOperationRecords(WorkflowInstanceId);
```

## 🔧 **後端 API 設計**

### **1. DataSet 操作 DTO**
```csharp
public class DataSetOperationRequest
{
    public Guid DataSetId { get; set; }
    public string OperationType { get; set; } = string.Empty; // SELECT, INSERT, UPDATE, DELETE
    public string QueryConditions { get; set; } = string.Empty; // WHERE 條件（SELECT/UPDATE/DELETE）
    public Dictionary<string, object> OperationData { get; set; } = new(); // 操作數據（INSERT/UPDATE）
    public List<string> MappedFields { get; set; } = new(); // 映射到流程變量的字段
}

public class DataSetOperationResult
{
    public bool Success { get; set; }
    public string OperationType { get; set; } = string.Empty;
    public List<Dictionary<string, object>> Records { get; set; } = new();
    public int AffectedRows { get; set; }
    public string ErrorMessage { get; set; } = string.Empty;
    public Guid? OperationRecordId { get; set; }
}
```

### **2. DataSet 操作 API**
```csharp
[HttpPost("operation")]
public async Task<IActionResult> ExecuteDataSetOperation([FromBody] DataSetOperationRequest request)
{
    try
    {
        _loggingService.LogInformation($"開始執行 DataSet 操作，DataSet ID: {request.DataSetId}, 操作類型: {request.OperationType}");
        
        var dataSet = await _context.DataSets
            .Include(ds => ds.Columns)
            .Include(ds => ds.DataSources)
            .FirstOrDefaultAsync(ds => ds.Id == request.DataSetId);
            
        if (dataSet == null)
        {
            return NotFound(new { success = false, message = "DataSet 不存在" });
        }
        
        // 根據操作類型執行不同邏輯
        var result = request.OperationType.ToUpper() switch
        {
            "SELECT" => await ExecuteDataSetQuery(dataSet, request.QueryConditions),
            "INSERT" => await ExecuteDataSetInsert(dataSet, request.OperationData),
            "UPDATE" => await ExecuteDataSetUpdate(dataSet, request.QueryConditions, request.OperationData),
            "DELETE" => await ExecuteDataSetDelete(dataSet, request.QueryConditions),
            _ => new DataSetOperationResult { Success = false, ErrorMessage = "不支援的操作類型" }
        };
        
        if (result.Success)
        {
            _loggingService.LogInformation($"DataSet {request.OperationType} 操作成功，影響行數: {result.AffectedRows}");
            return Ok(new { success = true, data = result });
        }
        else
        {
            _loggingService.LogWarning($"DataSet {request.OperationType} 操作失敗: {result.ErrorMessage}");
            return BadRequest(new { success = false, message = result.ErrorMessage });
        }
    }
    catch (Exception ex)
    {
        _loggingService.LogError($"DataSet {request.OperationType} 操作失敗", ex);
        return StatusCode(500, new { success = false, message = "操作失敗" });
    }
}
```

### **3. SQL 操作實現**
```csharp
private async Task ExecuteSqlInsert(DataSet dataSet, DataSetDataSource dataSource, Dictionary<string, object> operationData, DataSetOperationRecord operationRecord)
{
    try
    {
        // 構建 INSERT SQL
        var columns = string.Join(", ", operationData.Keys);
        var values = string.Join(", ", operationData.Keys.Select(k => $"@{k}"));
        var insertSql = $"INSERT INTO {dataSource.SqlQuery} ({columns}) VALUES ({values})";
        
        // 獲取連接字符串
        var connectionString = GetConnectionString(dataSource);
        
        using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync();
        
        using var command = new SqlCommand(insertSql, connection);
        foreach (var kvp in operationData)
        {
            command.Parameters.AddWithValue($"@{kvp.Key}", kvp.Value ?? DBNull.Value);
        }
        
        var affectedRows = await command.ExecuteNonQueryAsync();
        
        operationRecord.Status = "Completed";
        operationRecord.ProcessedAt = DateTime.UtcNow;
        
        _loggingService.LogInformation($"SQL INSERT 執行成功，影響行數: {affectedRows}");
    }
    catch (Exception ex)
    {
        operationRecord.Status = "Failed";
        operationRecord.ErrorMessage = ex.Message;
        operationRecord.ProcessedAt = DateTime.UtcNow;
        
        _loggingService.LogError("SQL INSERT 執行失敗", ex);
    }
}

private async Task ExecuteSqlUpdate(DataSet dataSet, DataSetDataSource dataSource, string queryConditions, Dictionary<string, object> operationData, DataSetOperationRecord operationRecord)
{
    try
    {
        // 構建 UPDATE SQL
        var setClause = string.Join(", ", operationData.Keys.Select(k => $"{k} = @{k}"));
        var updateSql = $"UPDATE {dataSource.SqlQuery} SET {setClause} WHERE {queryConditions}";
        
        // 獲取連接字符串
        var connectionString = GetConnectionString(dataSource);
        
        using var connection = new SqlConnection(connectionString);
        await connection.OpenAsync();
        
        using var command = new SqlCommand(updateSql, connection);
        foreach (var kvp in operationData)
        {
            command.Parameters.AddWithValue($"@{kvp.Key}", kvp.Value ?? DBNull.Value);
        }
        
        var affectedRows = await command.ExecuteNonQueryAsync();
        
        operationRecord.Status = "Completed";
        operationRecord.ProcessedAt = DateTime.UtcNow;
        
        _loggingService.LogInformation($"SQL UPDATE 執行成功，影響行數: {affectedRows}");
    }
    catch (Exception ex)
    {
        operationRecord.Status = "Failed";
        operationRecord.ErrorMessage = ex.Message;
        operationRecord.ProcessedAt = DateTime.UtcNow;
        
        _loggingService.LogError("SQL UPDATE 執行失敗", ex);
    }
}
```

## 🎨 **前端界面設計**

### **1. 節點配置界面**
```javascript
// 在 NodePropertyDrawer.js 中的 DataSet 查詢節點配置
{selectedNode.data.type === 'dataSetQuery' && (
  <>
    <Form.Item label="選擇 DataSet" name="dataSetId">
      <Select 
        placeholder="選擇要操作的 DataSet"
        onChange={(value) => {
          loadDataSetColumns(value);
        }}
      >
        {dataSets.map(ds => (
          <Option key={ds.id} value={ds.id}>
            {ds.name} ({ds.dataSourceType})
          </Option>
        ))}
      </Select>
    </Form.Item>
    
    <Form.Item label="操作類型" name="operationType">
      <Select 
        placeholder="選擇操作類型"
        onChange={(value) => {
          updateOperationConfig(value);
        }}
      >
        <Option value="SELECT">查詢 (SELECT)</Option>
        <Option value="INSERT">插入 (INSERT)</Option>
        <Option value="UPDATE">更新 (UPDATE)</Option>
        <Option value="DELETE">刪除 (DELETE)</Option>
      </Select>
    </Form.Item>
    
    {/* 查詢條件 - SELECT/UPDATE/DELETE 時顯示 */}
    {(selectedNode.data.operationType === 'SELECT' || 
      selectedNode.data.operationType === 'UPDATE' || 
      selectedNode.data.operationType === 'DELETE') && (
      <Form.Item label="查詢條件" name="queryConditions">
        <Input.TextArea 
          rows={3} 
          placeholder="WHERE 條件，可使用流程變量 ${variableName}"
        />
      </Form.Item>
    )}
    
    {/* 操作數據 - INSERT/UPDATE 時顯示 */}
    {(selectedNode.data.operationType === 'INSERT' || 
      selectedNode.data.operationType === 'UPDATE') && (
      <>
        <Form.Item label="操作數據" name="operationData">
          <div style={{ border: '1px solid #d9d9d9', borderRadius: '4px', padding: '8px' }}>
            {operationDataFields.map((field, index) => (
              <div key={index} style={{ marginBottom: '8px', display: 'flex', gap: '8px' }}>
                <Input 
                  placeholder="欄位名稱"
                  value={field.name}
                  onChange={(e) => updateOperationDataField(index, 'name', e.target.value)}
                  style={{ width: '40%' }}
                />
                <Input 
                  placeholder="欄位值或流程變量 ${variableName}"
                  value={field.value}
                  onChange={(e) => updateOperationDataField(index, 'value', e.target.value)}
                  style={{ width: '50%' }}
                />
                <Button 
                  type="text" 
                  danger 
                  onClick={() => removeOperationDataField(index)}
                >
                  刪除
                </Button>
              </div>
            ))}
            <Button 
              type="dashed" 
              onClick={addOperationDataField}
              style={{ width: '100%' }}
            >
              添加欄位
            </Button>
          </div>
        </Form.Item>
      </>
    )}
    
    {/* 映射字段 - SELECT 時顯示 */}
    {selectedNode.data.operationType === 'SELECT' && (
      <Form.Item label="映射到流程變量的關鍵字段" name="mappedFields">
        <Select 
          mode="multiple" 
          placeholder="選擇關鍵字段（如 ID、狀態等）"
          disabled={!selectedNode.data.dataSetId}
        >
          {dataSetColumns.map(col => (
            <Option key={col.columnName} value={col.columnName}>
              {col.displayName} ({col.dataType})
            </Option>
          ))}
        </Select>
      </Form.Item>
    )}
    
    <Form.Item label="測試操作" name="testOperation">
      <Button 
        type="default" 
        onClick={testDataSetOperation}
        disabled={!selectedNode.data.dataSetId || !selectedNode.data.operationType}
      >
        測試操作
      </Button>
    </Form.Item>
  </>
)}
```

### **2. 流程實例監控界面**
```javascript
// 在 WorkflowMonitorPage.js 中新增 DataSet 查詢結果標籤
<TabPane tab={t('workflowMonitor.datasetQueryResults')} key="datasetResults">
  <DataSetQueryResultsComponent 
    instanceId={instance.id}
    onRefresh={() => loadDataSetQueryResults(instance.id)}
  />
</TabPane>

// DataSetQueryResultsComponent.js
const DataSetQueryResultsComponent = ({ instanceId, onRefresh }) => {
  const [datasetResults, setDatasetResults] = useState([]);
  const [operationResults, setOperationResults] = useState([]);
  
  const loadDataSetQueryResults = async () => {
    try {
      setLoading(true);
      
      // 載入查詢結果
      const queryResponse = await fetch(`/api/workflowexecutions/${instanceId}/dataset-results`);
      const queryData = await queryResponse.json();
      setDatasetResults(queryData.data || []);
      
      // 載入操作結果
      const operationResponse = await fetch(`/api/workflowexecutions/${instanceId}/dataset-operations`);
      const operationData = await operationResponse.json();
      setOperationResults(operationData.data || []);
      
    } catch (error) {
      message.error('載入 DataSet 結果失敗: ' + error.message);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div>
      {/* 查詢結果 */}
      {datasetResults.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <Title level={4}>查詢結果</Title>
          {datasetResults.map(result => (
            <Card key={result.id} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span>DataSet: {result.dataSetName}</span>
                  <Tag color="blue" style={{ marginLeft: 8 }}>
                    {new Date(result.queryTimestamp).toLocaleString('zh-TW')}
                  </Tag>
                </div>
                <Space>
                  {result.hasNewerData && (
                    <Tag color="orange">有更新數據</Tag>
                  )}
                  <Button 
                    type="primary" 
                    icon={<EyeOutlined />}
                    onClick={() => handleViewDetails(result)}
                  >
                    查看詳情
                  </Button>
                </Space>
              </div>
            </Card>
          ))}
        </div>
      )}
      
      {/* 操作結果 */}
      {operationResults.length > 0 && (
        <div>
          <Title level={4}>操作結果</Title>
          {operationResults.map(result => (
            <Card key={result.id} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <Tag color={getOperationTypeColor(result.operationType)}>
                    {result.operationType}
                  </Tag>
                  <span style={{ marginLeft: 8 }}>DataSet: {result.dataSetName}</span>
                </div>
                <div>
                  <Tag color={getStatusColor(result.status)}>
                    {result.status}
                  </Tag>
                  <span style={{ marginLeft: 8 }}>
                    {new Date(result.createdAt).toLocaleString('zh-TW')}
                  </span>
                </div>
              </div>
              
              <div style={{ marginTop: 16 }}>
                <div><strong>操作數據:</strong> {result.operationData}</div>
                {result.queryConditions && (
                  <div><strong>查詢條件:</strong> {result.queryConditions}</div>
                )}
                {result.errorMessage && (
                  <Alert message="錯誤信息" description={result.errorMessage} type="error" />
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
```

## ⚙️ **工作流程引擎整合**

### **1. DataSet 查詢節點執行器**
```csharp
public async Task<ExecutionResult> ExecuteDataSetQueryNode(
    WorkflowStepExecution stepExecution, 
    DataSetQueryNodeConfig config)
{
    try
    {
        _loggingService.LogInformation($"開始執行 DataSet 操作節點，步驟: {stepExecution.StepName}, 操作類型: {config.OperationType}");
        
        // 1. 解析查詢條件和操作數據中的流程變量
        var resolvedConditions = ResolveProcessVariables(
            config.QueryConditions, 
            stepExecution.ProcessVariables
        );
        
        var resolvedOperationData = new Dictionary<string, object>();
        foreach (var kvp in config.OperationData)
        {
            resolvedOperationData[kvp.Key] = ResolveProcessVariableValue(
                kvp.Value?.ToString(), 
                stepExecution.ProcessVariables
            );
        }
        
        // 2. 執行 DataSet 操作
        var operationRequest = new DataSetOperationRequest
        {
            DataSetId = config.DataSetId,
            OperationType = config.OperationType,
            QueryConditions = resolvedConditions,
            OperationData = resolvedOperationData,
            MappedFields = config.MappedFields
        };
        
        var operationResult = await _dataSetService.ExecuteDataSetOperation(operationRequest);
        
        if (!operationResult.Success)
        {
            return ExecutionResult.Failed($"DataSet {config.OperationType} 操作失敗: {operationResult.ErrorMessage}");
        }
        
        // 3. 映射關鍵字段到流程變量（SELECT 操作）
        if (config.OperationType.ToUpper() == "SELECT" && operationResult.Records.Any())
        {
            var firstRecord = operationResult.Records.First();
            foreach (var field in config.MappedFields)
            {
                if (firstRecord.ContainsKey(field))
                {
                    await SetProcessVariable(
                        stepExecution, 
                        field, 
                        firstRecord[field],
                        "dataset_query"
                    );
                }
            }
        }
        
        // 4. 建立關係記錄
        if (operationResult.OperationRecordId.HasValue)
        {
            var relation = new WorkflowInstanceDataSetRecord
            {
                Id = Guid.NewGuid(),
                WorkflowInstanceId = stepExecution.WorkflowExecutionId,
                WorkflowStepExecutionId = stepExecution.Id,
                DataSetId = config.DataSetId,
                DataSetRecordId = operationResult.OperationRecordId.Value,
                QueryConditions = config.QueryConditions,
                MappedVariables = JsonSerializer.Serialize(config.MappedFields),
                QueryTimestamp = DateTime.UtcNow,
                CreatedAt = DateTime.UtcNow,
                CreatedBy = stepExecution.CreatedBy
            };
            
            _context.WorkflowInstanceDataSetRecords.Add(relation);
            await _context.SaveChangesAsync();
        }
        
        _loggingService.LogInformation($"DataSet {config.OperationType} 操作節點執行成功，影響行數: {operationResult.AffectedRows}");
        
        return ExecutionResult.Success(new
        {
            operationType = config.OperationType,
            affectedRows = operationResult.AffectedRows,
            mappedFields = config.MappedFields,
            queryConditions = config.QueryConditions
        });
    }
    catch (Exception ex)
    {
        _loggingService.LogError($"DataSet {config.OperationType} 操作節點執行失敗", ex);
        return ExecutionResult.Failed($"DataSet {config.OperationType} 操作節點執行失敗: {ex.Message}");
    }
}
```

## 📋 **實施步驟**

### **第一階段：數據庫設計**
1. 創建 `WorkflowInstanceDataSetRecords` 表
2. 創建 `DataSetOperationRecords` 表
3. 建立必要的索引和外鍵約束

### **第二階段：後端 API 開發**
1. 實現 DataSet 操作 API (`/api/datasets/operation`)
2. 實現流程實例 DataSet 結果 API (`/api/workflowexecutions/{id}/dataset-results`)
3. 實現 SQL 操作執行邏輯

### **第三階段：前端節點配置界面**
1. 更新 `NodePropertyDrawer.js` 支援多操作類型
2. 實現操作數據動態配置
3. 實現操作測試功能

### **第四階段：工作流程引擎整合**
1. 更新 `WorkflowEngine` 支援 DataSet 操作節點
2. 實現流程變量解析和映射
3. 實現關係記錄創建

### **第五階段：流程實例監控界面**
1. 實現 `DataSetQueryResultsComponent` 組件
2. 支援查詢結果和操作結果顯示
3. 實現實時數據更新功能

## 🔍 **使用場景**

### **1. 客戶資料查詢**
- 根據客戶 ID 查詢客戶詳細資料
- 將關鍵字段（姓名、電話）映射到流程變量
- 在後續節點中使用客戶資料

### **2. 訂單狀態更新**
- 根據訂單 ID 更新訂單狀態
- 記錄操作結果供審計追蹤
- 支援批量更新操作

### **3. 庫存管理**
- 查詢產品庫存數量
- 更新庫存狀態
- 記錄庫存變更歷史

## 🚀 **優勢特點**

### **1. Cloud 友好**
- 避免直接連接外部數據庫
- 通過 DataSet 統一管理數據源
- 提高系統安全性和穩定性

### **2. 靈活性**
- 支援多種操作類型
- 支援多種數據源
- 支援動態查詢條件

### **3. 可追蹤性**
- 完整的操作記錄
- 詳細的錯誤信息
- 實時的狀態監控

### **4. 用戶友好**
- 視覺化的節點配置
- 實時的操作預覽
- 直觀的結果顯示

---

**最後更新**: 2025年1月2日  
**系統版本**: v2.2  
**新增功能**: DataSet 工作流集成、多操作類型支援、實時數據監控
