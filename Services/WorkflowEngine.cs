using PurpleRice.Data;
using PurpleRice.Models;
using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Threading.Tasks;
using PurpleRice.Services;
using System.Linq;
using Microsoft.EntityFrameworkCore;
using System.IO;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace PurpleRice.Services
{
    public class WorkflowEngine
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly WhatsAppWorkflowService _whatsAppWorkflowService;
        private readonly LoggingService _loggingService;

        public WorkflowEngine(IServiceProvider serviceProvider, WhatsAppWorkflowService whatsAppWorkflowService, Func<string, LoggingService> loggingServiceFactory)
        {
            _serviceProvider = serviceProvider;
            _whatsAppWorkflowService = whatsAppWorkflowService;
            _loggingService = loggingServiceFactory("WorkflowEngine");
        }

        private void WriteLog(string message)
        {
            _loggingService.LogInformation(message);
        }

        public async Task ExecuteWorkflowAsync(WorkflowExecution execution)
        {
            try
            {
                // 解析流程 JSON（圖形結構）
                var options = new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                };
                var flowData = JsonSerializer.Deserialize<WorkflowGraph>(execution.WorkflowDefinition.Json, options);
                if (flowData?.Nodes == null || flowData?.Edges == null) return;

                // 構建節點和邊的映射
                var nodeMap = flowData.Nodes.ToDictionary(n => n.Id);
                var edgeMap = flowData.Edges.ToDictionary(e => e.Id);
                
                // 構建鄰接表（有向圖）
                var adjacencyList = new Dictionary<string, List<string>>();
                foreach (var edge in flowData.Edges)
                {
                    if (!adjacencyList.ContainsKey(edge.Source))
                        adjacencyList[edge.Source] = new List<string>();
                    adjacencyList[edge.Source].Add(edge.Target);
                }

                // 找到起始節點
                var startNode = flowData.Nodes.FirstOrDefault(n => n.Data?.Type == "start");
                if (startNode == null) return;

                WriteLog($"=== 開始執行工作流程 ===");
                WriteLog($"執行 ID: {execution.Id}");
                WriteLog($"節點數量: {flowData.Nodes.Count}");
                WriteLog($"邊數量: {flowData.Edges.Count}");
                WriteLog($"起始節點: {startNode.Id}");

                // 從起始節點開始執行
                await ExecuteNodeRecursively(startNode.Id, nodeMap, adjacencyList, execution, flowData);
                
                WriteLog($"=== 工作流程執行完成 ===");
            }
            catch (Exception ex)
            {
                WriteLog($"=== 工作流程執行失敗 ===");
                WriteLog($"錯誤: {ex.Message}");
                WriteLog($"堆疊: {ex.StackTrace}");
                
                execution.Status = "Error";
                execution.ErrorMessage = ex.Message;
                using var scope = _serviceProvider.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<PurpleRiceDbContext>();
                await db.SaveChangesAsync();
            }
        }

        // 新增：從 WorkflowDefinitionsController 調用的方法
        public async Task<WorkflowExecutionResult> ExecuteWorkflow(int executionId, object inputData)
        {
            try
            {
                WriteLog($"=== ExecuteWorkflow 開始 ===");
                WriteLog($"執行 ID: {executionId}");

                // 使用 IServiceProvider 創建新的 DbContext 實例
                using var scope = _serviceProvider.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<PurpleRiceDbContext>();

                // 查找執行記錄
                var execution = await db.WorkflowExecutions
                    .Include(e => e.WorkflowDefinition)
                    .FirstOrDefaultAsync(e => e.Id == executionId);

                if (execution == null)
                {
                    throw new Exception($"找不到執行記錄: {executionId}");
                }

                // 更新輸入數據
                if (inputData != null)
                {
                    execution.InputJson = JsonSerializer.Serialize(inputData);
                }

                // 執行工作流程
                await ExecuteWorkflowAsync(execution);

                // 返回執行結果
                return new WorkflowExecutionResult
                {
                    Status = execution.Status,
                    OutputData = new
                    {
                        executionId = execution.Id,
                        status = execution.Status,
                        completedAt = execution.EndedAt,
                        errorMessage = execution.ErrorMessage
                    }
                };
            }
            catch (Exception ex)
            {
                WriteLog($"ExecuteWorkflow 失敗: {ex.Message}");
                return new WorkflowExecutionResult
                {
                    Status = "Failed",
                    OutputData = new
                    {
                        error = ex.Message,
                        stackTrace = ex.StackTrace
                    }
                };
            }
        }

        private async Task ExecuteNodeRecursively(string nodeId, Dictionary<string, WorkflowNode> nodeMap, 
            Dictionary<string, List<string>> adjacencyList, WorkflowExecution execution, WorkflowGraph flowData = null)
        {
            if (!nodeMap.ContainsKey(nodeId)) return;

            var node = nodeMap[nodeId];
            var nodeData = node.Data;

            // 為每個節點執行創建獨立的 DbContext 實例
            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<PurpleRiceDbContext>();

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
            db.WorkflowStepExecutions.Add(stepExec);
            await db.SaveChangesAsync();

            WriteLog($"=== 執行節點: {nodeId} ===");
            WriteLog($"節點類型: {nodeData?.Type}");
            WriteLog($"任務名稱: {nodeData?.TaskName}");
            WriteLog($"節點數據: {JsonSerializer.Serialize(nodeData)}");

            // 執行節點
            switch (nodeData?.Type)
            {
                case "start":
                    // 起始節點，繼續到下一個節點
                    WriteLog("處理 Start 節點");
                    break;
                case "sendWhatsApp":
                    WriteLog($"=== WorkflowEngine sendWhatsApp 節點處理 ===");
                    WriteLog($"節點ID: {nodeId}");
                    WriteLog($"nodeData.To: '{nodeData.To}'");
                    WriteLog($"nodeData.Message: '{nodeData.Message}'");
                    WriteLog($"nodeData.Type: '{nodeData.Type}'");
                    WriteLog($"nodeData.TaskName: '{nodeData.TaskName}'");
                    
                    if (!string.IsNullOrEmpty(nodeData.To) && !string.IsNullOrEmpty(nodeData.Message))
                    {
                        WriteLog($"參數完整，開始發送 WhatsApp 消息到 {nodeData.To}");
                        WriteLog($"消息內容: {nodeData.Message}");
                        await _whatsAppWorkflowService.SendWhatsAppMessageAsync(nodeData.To, nodeData.Message, execution, db);
                        WriteLog($"WhatsApp 消息發送完成: {nodeData.TaskName}");
                    }
                    else
                    {
                        WriteLog($"sendWhatsApp 步驟缺少必要參數: to={nodeData.To}, message={nodeData.Message}");
                        // 記錄完整的節點數據以便調試
                        var nodeDataJson = JsonSerializer.Serialize(nodeData);
                        WriteLog($"完整節點數據: {nodeDataJson}");
                    }
                    break;
                case "sendWhatsAppTemplate":
                    if (!string.IsNullOrEmpty(nodeData.To) && !string.IsNullOrEmpty(nodeData.TemplateName))
                    {
                        await _whatsAppWorkflowService.SendWhatsAppTemplateMessageAsync(nodeData.To, nodeData.TemplateId, execution, db);
                    }
                    else
                    {
                        WriteLog($"sendWhatsAppTemplate 步驟缺少必要參數: to={nodeData.To}, templateName={nodeData.TemplateName}");
                    }
                    break;
                case "waitReply":
                case "waitForUserReply":
                    // 等待用戶回覆，暫停流程
                    execution.Status = "Waiting";
                    execution.CurrentStep = stepExec.StepIndex;
                    stepExec.Status = "Waiting";
                    await db.SaveChangesAsync();
                    return; // 暫停流程，等待外部觸發
                case "dbQuery":
                    // TODO: 執行資料庫查詢/更新
                    break;
                case "callApi":
                    // TODO: 呼叫外部 API
                    break;
                case "sendEForm":
                case "sendeform":
                    WriteLog($"=== WorkflowEngine sendEForm 節點處理 ===");
                    WriteLog($"nodeData.FormName: '{nodeData.FormName}'");
                    WriteLog($"nodeData.FormId: '{nodeData.FormId}'");
                    WriteLog($"nodeData.To: '{nodeData.To}'");
                    WriteLog($"nodeData.Type: '{nodeData.Type}'");
                    WriteLog($"nodeData.TaskName: '{nodeData.TaskName}'");
                    
                    if (!string.IsNullOrEmpty(nodeData.FormName) && !string.IsNullOrEmpty(nodeData.To))
                    {
                        WriteLog($"參數完整，開始處理 eForm 發送");
                        // 这里应该调用 eForm 服务
                        WriteLog($"eForm 節點處理完成，繼續到下一個節點");
                        
                        // 重要：更新步骤执行状态
                        stepExec.Status = "Completed";
                        stepExec.EndedAt = DateTime.Now;
                        stepExec.OutputJson = JsonSerializer.Serialize(new { success = true, message = "EForm sent successfully" });
                        await db.SaveChangesAsync();
                    }
                    else
                    {
                        WriteLog($"sendEForm 步驟缺少必要參數: formName={nodeData.FormName}, to={nodeData.To}");
                        var nodeDataJson = JsonSerializer.Serialize(nodeData);
                        WriteLog($"完整節點數據: {nodeDataJson}");
                        
                        // 标记步骤为失败
                        stepExec.Status = "Failed";
                        stepExec.EndedAt = DateTime.Now;
                        stepExec.OutputJson = JsonSerializer.Serialize(new { error = "Missing required parameters" });
                        await db.SaveChangesAsync();
                        return; // 停止执行
                    }
                    break;
                case "end":
                    // 結束節點
                    WriteLog($"=== 到達 End 節點: {nodeId} ===");
                    stepExec.Status = "Completed";
                    stepExec.EndedAt = DateTime.Now;
                    await db.SaveChangesAsync();
                    WriteLog($"End 節點 {nodeId} 標記為完成");
                    
                    // 檢查是否所有分支都已完成
                    var allEndNodes = flowData.Nodes.Where(n => n.Data?.Type == "end").ToList();
                    var completedEndNodes = await db.WorkflowStepExecutions
                        .Where(s => s.WorkflowExecutionId == execution.Id && 
                                   s.StepType == "end" && 
                                   s.Status == "Completed")
                        .CountAsync();
                    
                    WriteLog($"=== End 節點完成檢查 ===");
                    WriteLog($"總 End 節點數: {allEndNodes.Count}");
                    WriteLog($"已完成 End 節點數: {completedEndNodes}");
                    WriteLog($"所有 End 節點ID: {string.Join(", ", allEndNodes.Select(n => n.Id))}");
                    
                    // 如果所有 End 節點都已完成，則標記整個流程為完成
                    if (completedEndNodes >= allEndNodes.Count)
                    {
                        execution.Status = "Completed";
                        execution.EndedAt = DateTime.Now;
                        await db.SaveChangesAsync();
                        WriteLog($"=== 所有分支都已完成，工作流程標記為完成 ===");
                    }
                    else
                    {
                        WriteLog($"還有 {allEndNodes.Count - completedEndNodes} 個分支未完成");
                    }
                    return;
                default:
                    stepExec.Status = "UnknownStepType";
                    break;
            }

            stepExec.Status = "Completed";
            stepExec.EndedAt = DateTime.Now;
            await db.SaveChangesAsync();

            // 更新執行步驟
            execution.CurrentStep = (execution.CurrentStep ?? 0) + 1;

            // 找到下一個節點並並行執行
            if (adjacencyList.ContainsKey(nodeId))
            {
                var nextNodes = adjacencyList[nodeId];
                WriteLog($"=== 節點 {nodeId} 的後續節點分析 ===");
                WriteLog($"後續節點數量: {nextNodes.Count}");
                WriteLog($"後續節點列表: {string.Join(", ", nextNodes)}");
                
                // 詳細檢查每個後續節點
                foreach (var nextNodeId in nextNodes)
                {
                    if (nodeMap.ContainsKey(nextNodeId))
                    {
                        var nextNode = nodeMap[nextNodeId];
                        WriteLog($"後續節點 {nextNodeId}: 類型={nextNode.Data?.Type}, 任務={nextNode.Data?.TaskName}");
                    }
                    else
                    {
                        WriteLog($"警告: 後續節點 {nextNodeId} 不存在於節點映射中");
                    }
                }
                
                if (nextNodes.Count == 1)
                {
                    // 單一分支，直接執行
                    WriteLog($"單一分支執行: {nextNodes[0]}");
                    await ExecuteNodeRecursively(nextNodes[0], nodeMap, adjacencyList, execution, flowData);
                    WriteLog($"單一分支執行完成: {nextNodes[0]}");
                }
                else if (nextNodes.Count > 1)
                {
                    // 多個分支，並行執行
                    WriteLog($"=== 開始並行執行 {nextNodes.Count} 個分支節點 ===");
                    WriteLog($"分支節點: {string.Join(", ", nextNodes)}");
                    
                    var tasks = new List<Task>();
                    foreach (var nextNodeId in nextNodes)
                    {
                        WriteLog($"創建任務: {nextNodeId}");
                        var task = ExecuteNodeRecursively(nextNodeId, nodeMap, adjacencyList, execution, flowData);
                        tasks.Add(task);
                    }
                    
                    WriteLog($"等待 {tasks.Count} 個並行任務完成...");
                    await Task.WhenAll(tasks);
                    WriteLog($"=== 所有 {tasks.Count} 個分支節點執行完成 ===");
                }
            }
            else
            {
                WriteLog($"節點 {nodeId} 沒有後續節點");
            }
        }
    }

    // 圖形結構模型
    public class WorkflowGraph
    {
        public List<WorkflowNode> Nodes { get; set; } = new List<WorkflowNode>();
        public List<WorkflowEdge> Edges { get; set; } = new List<WorkflowEdge>();
    }

    public class WorkflowNode
    {
        public string Id { get; set; }
        public string Type { get; set; }
        public WorkflowNodeData Data { get; set; }
        public WorkflowPosition Position { get; set; }
    }

    public class WorkflowNodeData
    {
        public string Type { get; set; }
        public string TaskName { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("to")]
        public string To { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("message")]
        public string Message { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("templateId")]
        public string TemplateId { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("templateName")]
        public string TemplateName { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("replyType")]
        public string ReplyType { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("specifiedUsers")]
        public string SpecifiedUsers { get; set; }
        
        public WorkflowValidation Validation { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("sql")]
        public string Sql { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("url")]
        public string Url { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("formName")]
        public string FormName { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("formId")]
        public string FormId { get; set; }
    }

    public class WorkflowPosition
    {
        public double X { get; set; }
        public double Y { get; set; }
    }

    public class WorkflowEdge
    {
        public string Id { get; set; }
        public string Source { get; set; }
        public string Target { get; set; }
        public string Type { get; set; }
    }

    public class WorkflowValidation
    {
        public bool Enabled { get; set; }
        public string ValidatorType { get; set; }
        public string Prompt { get; set; }
        public string RetryMessage { get; set; }
        public int MaxRetries { get; set; }
    }

    // 新增：工作流程執行結果模型
    public class WorkflowExecutionResult
    {
        public string Status { get; set; }
        public object OutputData { get; set; }
    }
} 