# 工作流執行系統

## 🎯 **功能概述**

WhattoFlow 系統的工作流執行模組是一個強大的工作流引擎，負責執行、監控和管理工作流實例，支持複雜的業務流程自動化，包括並行執行、條件分支、錯誤處理和用戶交互等功能。

## ��️ **系統架構**

### **1. 核心組件**
- **WorkflowEngine**: 主要執行引擎
- **WorkflowExecution**: 工作流實例管理
- **WorkflowStepExecution**: 步驟執行追蹤
- **執行狀態管理**: 運行、等待、完成、錯誤等狀態

### **2. 技術棧**
- **後端**: .NET 10.0 + Entity Framework
- **數據庫**: SQL Server
- **日誌**: LoggingService
- **異步處理**: Task-based 異步編程

## ⚙️ **工作流引擎**

### **1. 引擎核心**
```csharp
public class WorkflowEngine
{
    private readonly PurpleRiceDbContext _db;
    private readonly WhatsAppWorkflowService _whatsAppWorkflowService;
    private readonly LoggingService _loggingService;

    public async Task ExecuteWorkflowAsync(WorkflowExecution execution)
    {
        try
        {
            // 解析流程 JSON（圖形結構）
            var flowData = JsonSerializer.Deserialize<WorkflowGraph>(
                execution.WorkflowDefinition.Json, 
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true }
            );
            
            if (flowData?.Nodes == null || flowData?.Edges == null) return;

            // 構建節點和邊的映射
            var nodeMap = flowData.Nodes.ToDictionary(n => n.Id);
            var adjacencyList = BuildAdjacencyList(flowData.Edges);

            // 找到開始節點
            var startNode = flowData.Nodes.FirstOrDefault(n => n.Type == "start");
            if (startNode != null)
            {
                await ExecuteNodeRecursively(startNode.Id, nodeMap, adjacencyList, execution, flowData);
            }
        }
        catch (Exception ex)
        {
            _loggingService.LogError(ex, "工作流執行失敗");
            execution.Status = "Error";
            execution.ErrorMessage = ex.Message;
            await _db.SaveChangesAsync();
        }
    }
}
```

### **2. 節點執行邏輯**
```csharp
private async Task ExecuteNodeRecursively(string nodeId, Dictionary<string, WorkflowNode> nodeMap, 
    Dictionary<string, List<string>> adjacencyList, WorkflowExecution execution, WorkflowGraph flowData = null)
{
    if (!nodeMap.ContainsKey(nodeId)) return;

    var node = nodeMap[nodeId];
    var nodeData = node.Data;

    // 記錄步驟執行
    var stepExec = new WorkflowStepExecution
    {
        WorkflowExecutionId = execution.Id,
        StepIndex = execution.CurrentStep ?? 0,
        StepType = nodeData?.Type,
        Status = "Running",
        InputJson = JsonSerializer.Serialize(nodeData),
        StartedAt = DateTime.Now
    };
    _db.WorkflowStepExecutions.Add(stepExec);
    await _db.SaveChangesAsync();

    // 執行節點
    switch (nodeData?.Type)
    {
        case "start":
            await ExecuteStartNode(nodeData, execution);
            break;
        case "end":
            await ExecuteEndNode(nodeData, execution);
            break;
        case "task":
            await ExecuteTaskNode(nodeData, execution);
            break;
        case "decision":
            await ExecuteDecisionNode(nodeData, execution);
            break;
        case "parallel":
            await ExecuteParallelNode(nodeData, execution);
            break;
        case "wait":
            await ExecuteWaitNode(nodeData, execution);
            break;
        case "whatsapp":
            await ExecuteWhatsAppNode(nodeData, execution);
            break;
        case "form":
            await ExecuteFormNode(nodeData, execution);
            break;
        default:
            _loggingService.LogWarning($"未知節點類型: {nodeData?.Type}");
            break;
    }

    // 更新步驟執行狀態
    stepExec.Status = "Completed";
    stepExec.EndedAt = DateTime.Now;
    stepExec.OutputJson = JsonSerializer.Serialize(new { status = "completed" });
    await _db.SaveChangesAsync();

    // 查找並執行後續節點
    var nextNodes = GetNextNodes(nodeId, adjacencyList);
    if (nextNodes.Count == 1)
    {
        // 單一分支，順序執行
        await ExecuteNodeRecursively(nextNodes[0], nodeMap, adjacencyList, execution, flowData);
    }
    else if (nextNodes.Count > 1)
    {
        // 多個分支，並行執行
        var tasks = nextNodes.Select(nextNodeId => 
            ExecuteNodeRecursively(nextNodeId, nodeMap, adjacencyList, execution, flowData)
        );
        await Task.WhenAll(tasks);
    }
}
```

## �� **執行狀態管理**

### **1. 工作流執行狀態**
```csharp
public class WorkflowExecution
{
    public int Id { get; set; }
    public int WorkflowDefinitionId { get; set; }
    public WorkflowDefinition? WorkflowDefinition { get; set; }
    public string? Status { get; set; } // Running, Waiting, Completed, Error
    public int? CurrentStep { get; set; }
    public string? InputJson { get; set; }
    public string? OutputJson { get; set; }
    public DateTime StartedAt { get; set; }
    public DateTime? EndedAt { get; set; }
    public string? CreatedBy { get; set; }
    public string? ErrorMessage { get; set; }
    
    // 等待相關屬性
    public bool IsWaiting { get; set; }
    public DateTime? WaitingSince { get; set; }
    public DateTime? LastUserActivity { get; set; }
    public int? CurrentWaitingStep { get; set; }
    public string? WaitingForUser { get; set; }
    
    public ICollection<WorkflowStepExecution>? StepExecutions { get; set; }
}
```

### **2. 步驟執行追蹤**
```csharp
public class WorkflowStepExecution
{
    public int Id { get; set; }
    public int WorkflowExecutionId { get; set; }
    public WorkflowExecution? WorkflowExecution { get; set; }
    public int StepIndex { get; set; }
    public string? StepType { get; set; }
    public string? Status { get; set; } // Running, Completed, Error
    public string? InputJson { get; set; }
    public string? OutputJson { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? EndedAt { get; set; }
    
    // 等待相關屬性
    public bool IsWaiting { get; set; }
    public string? WaitingForUser { get; set; }
    public string? ValidationConfig { get; set; } // JSON 格式的驗證配置
}
```

## �� **節點類型支持**

### **1. 基礎節點**
- **start**: 開始節點，工作流入口
- **end**: 結束節點，工作流終點
- **task**: 任務節點，執行具體業務邏輯

### **2. 控制節點**
- **decision**: 決策節點，條件分支
- **parallel**: 並行節點，同時執行多個分支
- **wait**: 等待節點，暫停等待用戶輸入

### **3. 業務節點**
- **whatsapp**: WhatsApp 消息發送節點
- **form**: 表單收集節點
- **notification**: 通知節點
- **approval**: 審批節點

## 📱 **WhatsApp 集成**

### **1. WhatsApp 節點執行**
```csharp
private async Task ExecuteWhatsAppNode(WorkflowNodeData nodeData, WorkflowExecution execution)
{
    try
    {
        var phoneNumber = GetVariableValue(execution, "phoneNumber");
        var message = GetVariableValue(execution, "message");
        
        if (string.IsNullOrEmpty(phoneNumber) || string.IsNullOrEmpty(message))
        {
            throw new Exception("WhatsApp 節點缺少必要參數");
        }

        // 發送 WhatsApp 消息
        await _whatsAppWorkflowService.SendMessageAsync(phoneNumber, message);
        
        _loggingService.LogInformation($"WhatsApp 消息發送成功: {phoneNumber}");
    }
    catch (Exception ex)
    {
        _loggingService.LogError(ex, "WhatsApp 節點執行失敗");
        throw;
    }
}
```

### **2. 消息觸發工作流**
```csharp
// 在 MetaWebhookController 中
public async Task<IActionResult> HandleWebhook([FromBody] WebhookRequest request)
{
    try
    {
        foreach (var entry in request.Entry)
        {
            foreach (var change in entry.Changes)
            {
                if (change.Value.Messages != null)
                {
                    foreach (var message in change.Value.Messages)
                    {
                        // 查找相關工作流並觸發執行
                        await TriggerWorkflowFromMessage(message);
                    }
                }
            }
        }
        
        return Ok("OK");
    }
    catch (Exception ex)
    {
        _loggingService.LogError(ex, "Webhook 處理失敗");
        return BadRequest();
    }
}
```

## �� **表單集成**

### **1. 表單節點執行**
```csharp
private async Task ExecuteFormNode(WorkflowNodeData nodeData, WorkflowExecution execution)
{
    try
    {
        // 創建表單實例
        var formInstance = new EFormInstance
        {
            EFormDefinitionId = Guid.Parse(nodeData.FormId),
            WorkflowExecutionId = execution.Id,
            WorkflowStepExecutionId = GetCurrentStepExecutionId(execution),
            CompanyId = GetCompanyIdFromExecution(execution),
            InstanceName = $"工作流表單 - {execution.Id}",
            Status = "Pending",
            CreatedAt = DateTime.Now,
            UpdatedAt = DateTime.Now
        };

        _db.EFormInstances.Add(formInstance);
        await _db.SaveChangesAsync();

        // 設置工作流為等待狀態
        execution.Status = "Waiting";
        execution.IsWaiting = true;
        execution.WaitingSince = DateTime.Now;
        execution.CurrentWaitingStep = GetCurrentStepExecutionId(execution);
        await _db.SaveChangesAsync();

        _loggingService.LogInformation($"表單節點執行完成，等待用戶填寫: {formInstance.Id}");
    }
    catch (Exception ex)
    {
        _loggingService.LogError(ex, "表單節點執行失敗");
        throw;
    }
}
```

## �� **並行執行支持**

### **1. 並行節點處理**
```csharp
private async Task ExecuteParallelNode(WorkflowNodeData nodeData, WorkflowExecution execution)
{
    try
    {
        _loggingService.LogInformation($"=== 開始並行執行 {nodeData.ParallelBranches?.Count ?? 0} 個分支 ===");
        
        var tasks = new List<Task>();
        foreach (var branch in nodeData.ParallelBranches ?? new List<string>())
        {
            var task = ExecuteBranchAsync(branch, execution);
            tasks.Add(task);
        }
        
        // 等待所有分支完成
        await Task.WhenAll(tasks);
        
        _loggingService.LogInformation("=== 所有並行分支執行完成 ===");
    }
    catch (Exception ex)
    {
        _loggingService.LogError(ex, "並行節點執行失敗");
        throw;
    }
}
```

## �� **監控和調試**

### **1. 實時監控 API**
```csharp
[HttpGet("monitor")]
public async Task<IActionResult> GetMonitorData(
    int page = 1, 
    int pageSize = 20, 
    string status = null)
{
    try
    {
        var query = _db.WorkflowExecutions
            .Include(e => e.WorkflowDefinition)
            .Include(e => e.StepExecutions)
            .AsQueryable();

        if (!string.IsNullOrEmpty(status))
        {
            query = query.Where(e => e.Status == status);
        }

        var total = await query.CountAsync();
        var executions = await query
            .OrderByDescending(e => e.StartedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return Ok(new
        {
            total,
            page,
            pageSize,
            data = executions
        });
    }
    catch (Exception ex)
    {
        _loggingService.LogError(ex, "獲取監控數據失敗");
        return StatusCode(500, new { error = "獲取監控數據失敗" });
    }
}
```

### **2. 執行日誌**
```csharp
private void WriteLog(string message)
{
    _loggingService.LogInformation($"[WorkflowEngine] {message}");
}

// 在關鍵節點記錄詳細日誌
WriteLog($"=== 執行節點: {nodeId} ===");
WriteLog($"節點類型: {nodeData?.Type}");
WriteLog($"任務名稱: {nodeData?.TaskName}");
WriteLog($"節點數據: {JsonSerializer.Serialize(nodeData)}");
```

## ⚠️ **錯誤處理**

### **1. 異常捕獲和處理**
```csharp
try
{
    await ExecuteNodeRecursively(startNode.Id, nodeMap, adjacencyList, execution, flowData);
}
catch (Exception ex)
{
    _loggingService.LogError(ex, "工作流執行失敗");
    execution.Status = "Error";
    execution.ErrorMessage = ex.Message;
    await _db.SaveChangesAsync();
}
```

### **2. 錯誤恢復機制**
```csharp
[HttpPost("{id}/resume")]
public async Task<IActionResult> Resume(int id, [FromBody] Dictionary<string, object> input)
{
    var exec = await _db.WorkflowExecutions
        .Include(e => e.WorkflowDefinition)
        .FirstOrDefaultAsync(e => e.Id == id);
        
    if (exec == null) return NotFound();
    if (exec.Status != "Waiting") return BadRequest("工作流不在等待狀態");
    
    exec.Status = "Running";
    exec.InputJson = input != null ? JsonSerializer.Serialize(input) : null;
    
    await _engine.ExecuteWorkflowAsync(exec);
    
    return Ok(new { executionId = exec.Id, status = exec.Status });
}
```

## �� **配置和優化**

### **1. 性能配置**
```json
{
  "WorkflowEngine": {
    "MaxConcurrentExecutions": 100,
    "ExecutionTimeout": 300,
    "RetryAttempts": 3,
    "RetryDelay": 5000,
    "EnableLogging": true,
    "LogLevel": "Info"
  }
}
```

### **2. 數據庫優化**
- 使用適當的索引
- 定期清理過期的執行記錄
- 實現分頁查詢
- 異步數據庫操作

---

**最後更新**: 2025年8月20日
**系統版本**: v2.0
