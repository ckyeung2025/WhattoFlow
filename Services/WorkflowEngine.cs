using PurpleRice.Data;
using PurpleRice.Models;
using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Threading.Tasks;
using PurpleRice.Services;
using PurpleRice.Services.WebhookServices;
using System.Linq;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace PurpleRice.Services
{
    public class WorkflowEngine
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly WhatsAppWorkflowService _whatsAppWorkflowService;
        private readonly LoggingService _loggingService;
        private readonly IConfiguration _configuration;
        private readonly EFormService _eFormService;
        private readonly ISwitchConditionService _switchConditionService;
        private readonly UserSessionService _userSessionService;
        private readonly DataSetQueryService _dataSetQueryService;
        private readonly IVariableReplacementService _variableReplacementService;
        private readonly PurpleRiceDbContext _context;
        private readonly RecipientResolverService _recipientResolverService;

        public WorkflowEngine(IServiceProvider serviceProvider, WhatsAppWorkflowService whatsAppWorkflowService, 
            Func<string, LoggingService> loggingServiceFactory, IConfiguration configuration, EFormService eFormService, ISwitchConditionService switchConditionService, UserSessionService userSessionService, DataSetQueryService dataSetQueryService, IVariableReplacementService variableReplacementService, PurpleRiceDbContext context, RecipientResolverService recipientResolverService)
        {
            _serviceProvider = serviceProvider;
            _whatsAppWorkflowService = whatsAppWorkflowService;
            _loggingService = loggingServiceFactory("WorkflowEngine");
            _configuration = configuration;
            _eFormService = eFormService;
            _switchConditionService = switchConditionService;
            _userSessionService = userSessionService;
            _dataSetQueryService = dataSetQueryService;
            _variableReplacementService = variableReplacementService;
            _context = context;
            _recipientResolverService = recipientResolverService;
        }

        private void WriteLog(string message)
        {
            _loggingService.LogInformation(message);
        }

        // 從等待節點繼續執行流程的方法
        public async Task ContinueWorkflowFromWaitReply(WorkflowExecution execution, object inputData)
        {
            try
            {
                WriteLog($"=== 繼續執行工作流程 ===");
                WriteLog($"執行 ID: {execution.Id}");
                WriteLog($"當前步驟: {execution.CurrentStep}");
                
                // 確保 WorkflowDefinition 已加載
                if (execution.WorkflowDefinition == null)
                {
                    WriteLog($"WorkflowDefinition 未加載，重新加載執行記錄");
                    using var scope = _serviceProvider.CreateScope();
                    var db = scope.ServiceProvider.GetRequiredService<PurpleRiceDbContext>();
                    
                    execution = await db.WorkflowExecutions
                        .Include(e => e.WorkflowDefinition)
                        .FirstOrDefaultAsync(e => e.Id == execution.Id);
                    
                    if (execution?.WorkflowDefinition == null)
                    {
                        WriteLog($"無法加載 WorkflowDefinition，執行 ID: {execution?.Id}");
                        return;
                    }
                }
                
                // 解析流程 JSON
                var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                var flowData = JsonSerializer.Deserialize<WorkflowGraph>(execution.WorkflowDefinition.Json, options);
                if (flowData?.Nodes == null || flowData?.Edges == null) return;

                // 構建鄰接表（有向圖）
                var adjacencyList = BuildAdjacencyList(flowData.Edges);

                // 根據流程狀態決定如何繼續
                if (execution.Status == "WaitingForFormApproval")
                {
                    await ContinueFromFormApproval(execution, flowData, adjacencyList);
                }
                else
                {
                    await ContinueFromWaitReply(execution, flowData, adjacencyList);
                }
                
                WriteLog($"=== 繼續執行完成 ===");
            }
            catch (Exception ex)
            {
                WriteLog($"=== 繼續執行工作流程失敗 ===");
                WriteLog($"錯誤: {ex.Message}");
                WriteLog($"堆疊: {ex.StackTrace}");
                
                execution.Status = "Error";
                execution.ErrorMessage = ex.Message;
                await SaveExecution(execution);
            }
        }

        public async Task ExecuteWorkflowAsync(WorkflowExecution execution, string userId = null)
        {
            try
            {
                // 解析流程 JSON
                var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                var flowData = JsonSerializer.Deserialize<WorkflowGraph>(execution.WorkflowDefinition.Json, options);
                if (flowData?.Nodes == null || flowData?.Edges == null) return;

                // 驗證邊緣
                if (!ValidateWorkflowEdges(flowData.Edges, flowData.Nodes))
                {
                    execution.Status = "Error";
                    execution.ErrorMessage = "工作流程邊緣驗證失敗";
                    await SaveExecution(execution);
                    return;
                }

                // 構建鄰接表
                var adjacencyList = BuildAdjacencyList(flowData.Edges);

                // 找到起始節點
                var startNode = flowData.Nodes.FirstOrDefault(n => n.Data?.Type == "start");
                if (startNode == null) return;

                WriteLog($"=== 開始執行工作流程 ===");
                WriteLog($"執行 ID: {execution.Id}");
                WriteLog($"節點數量: {flowData.Nodes.Count}");
                WriteLog($"邊數量: {flowData.Edges.Count}");
                WriteLog($"起始節點: {startNode.Id}");

                // 使用多分支執行引擎
                await ExecuteMultiBranchWorkflow(startNode.Id, flowData.Nodes, adjacencyList, execution, userId, flowData.Edges);
                
                WriteLog($"=== 工作流程執行完成 ===");
            }
            catch (Exception ex)
            {
                WriteLog($"=== 工作流程執行失敗 ===");
                WriteLog($"錯誤: {ex.Message}");
                WriteLog($"堆疊: {ex.StackTrace}");
                
                execution.Status = "Error";
                execution.ErrorMessage = ex.Message;
                await SaveExecution(execution);
            }
        }

        public async Task<WorkflowExecutionResult> ExecuteWorkflow(int executionId, object inputData)
        {
            try
            {
                WriteLog($"=== ExecuteWorkflow 開始 ===");
                WriteLog($"執行 ID: {executionId}");

                using var scope = _serviceProvider.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<PurpleRiceDbContext>();

                var execution = await db.WorkflowExecutions
                    .Include(e => e.WorkflowDefinition)
                    .FirstOrDefaultAsync(e => e.Id == executionId);

                if (execution == null)
                    throw new Exception($"找不到執行記錄: {executionId}");

                if (inputData != null)
                    execution.InputJson = JsonSerializer.Serialize(inputData);

                await ExecuteWorkflowAsync(execution, null);

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
                    OutputData = new { error = ex.Message, stackTrace = ex.StackTrace }
                };
            }
        }

        // 構建鄰接表
        private Dictionary<string, List<string>> BuildAdjacencyList(List<WorkflowEdge> edges)
        {
            var adjacencyList = new Dictionary<string, List<string>>();
            
            foreach (var edge in edges)
            {
                // 確保 Source 和 Target 不為空
                if (string.IsNullOrEmpty(edge.Source) || string.IsNullOrEmpty(edge.Target))
                {
                    WriteLog($"警告: 邊緣 {edge.Id} 的 Source 或 Target 為空，跳過");
                    continue;
                }
                
                // 防止自連接
                if (edge.Source == edge.Target)
                {
                    WriteLog($"警告: 邊緣 {edge.Id} 是自連接，跳過");
                    continue;
                }
                
                if (!adjacencyList.ContainsKey(edge.Source))
                    adjacencyList[edge.Source] = new List<string>();
                    
                // 防止重複連接
                if (!adjacencyList[edge.Source].Contains(edge.Target))
                {
                    adjacencyList[edge.Source].Add(edge.Target);
                    WriteLog($"添加連接: {edge.Source} -> {edge.Target} (邊緣ID: {edge.Id})");
                }
                else
                {
                    WriteLog($"警告: 重複連接 {edge.Source} -> {edge.Target}，跳過");
                }
            }
            
            return adjacencyList;
        }

        // 驗證工作流程邊緣
        private bool ValidateWorkflowEdges(List<WorkflowEdge> edges, List<WorkflowNode> nodes)
        {
            var nodeIds = nodes.Select(n => n.Id).ToHashSet();
            var issues = new List<string>();
            var validEdges = new List<WorkflowEdge>();
            
            foreach (var edge in edges)
            {
                bool isValid = true;
                
                // 檢查 Source 節點是否存在
                if (!nodeIds.Contains(edge.Source))
                {
                    issues.Add($"邊緣 {edge.Id} 的 Source 節點 {edge.Source} 不存在");
                    isValid = false;
                }
                
                // 檢查 Target 節點是否存在
                if (!nodeIds.Contains(edge.Target))
                {
                    issues.Add($"邊緣 {edge.Id} 的 Target 節點 {edge.Target} 不存在");
                    isValid = false;
                }
                
                // 檢查自連接
                if (edge.Source == edge.Target)
                {
                    issues.Add($"邊緣 {edge.Id} 是自連接");
                    isValid = false;
                }
                
                // 只保留有效的邊緣
                if (isValid)
                {
                    validEdges.Add(edge);
                }
            }
            
            if (issues.Any())
            {
                WriteLog("工作流程邊緣驗證發現問題，自動清理無效邊緣:");
                foreach (var issue in issues)
                {
                    WriteLog($"- {issue}");
                }
                
                // 更新邊緣列表，移除無效邊緣
                edges.Clear();
                edges.AddRange(validEdges);
                
                WriteLog($"已清理無效邊緣，保留 {validEdges.Count} 個有效邊緣");
            }
            
            return true; // 總是返回 true，因為我們已經清理了無效邊緣
        }

        // 從表單審批狀態繼續
        private async Task ContinueFromFormApproval(WorkflowExecution execution, WorkflowGraph flowData, Dictionary<string, List<string>> adjacencyList)
                {
                    WriteLog($"流程狀態為 WaitingForFormApproval，尋找 sendEForm 節點");
                    
                    var sendEFormNode = flowData.Nodes.FirstOrDefault(n => n.Data?.Type == "sendEForm" || n.Data?.Type == "sendeform");
                    if (sendEFormNode == null)
                    {
                        WriteLog($"錯誤: 找不到 sendEForm 節點");
                        return;
                    }

                    var sendEFormNodeId = sendEFormNode.Id;
                    WriteLog($"找到 sendEForm 節點: {sendEFormNodeId}");

            // 重要：檢查是否已經有 sendEForm 步驟執行過
            if (await IsNodeAlreadyExecuted(execution.Id, sendEFormNodeId, "sendEForm"))
            {
                WriteLog($"警告: sendEForm 節點 {sendEFormNodeId} 已經執行過，直接執行後續節點");
                        }
                        else
                        {
                // 標記 sendEForm 步驟完成
                await MarkSendEFormStepComplete(execution.Id);
            }

            // 更新流程狀態
            execution.Status = "Running";
            execution.IsWaiting = false;
            execution.WaitingSince = null;
            execution.LastUserActivity = DateTime.Now;
            execution.CurrentStep = (execution.CurrentStep ?? 0) + 1;
            await SaveExecution(execution);

            // 直接執行 sendEForm 節點的後續節點，而不是重新執行 sendEForm 節點本身
            await ExecuteAllNextNodes(sendEFormNodeId, flowData.Nodes.ToDictionary(n => n.Id), adjacencyList, execution, execution.WaitingForUser, flowData.Edges);
        }

        // 從等待回覆狀態繼續
        private async Task ContinueFromWaitReply(WorkflowExecution execution, WorkflowGraph flowData, Dictionary<string, List<string>> adjacencyList)
        {
                    WriteLog($"流程狀態為 {execution.Status}，使用等待用戶回覆邏輯");
                    
                    // ✅ 修復：查找當前正在等待的步驟執行記錄，而不是流程中的第一個等待節點
                    using var scope = _serviceProvider.CreateScope();
                    var db = scope.ServiceProvider.GetRequiredService<PurpleRiceDbContext>();
                    
                    var currentWaitingStep = await db.WorkflowStepExecutions
                        .Where(s => s.WorkflowExecutionId == execution.Id && s.IsWaiting)
                        .OrderByDescending(s => s.Id)
                        .FirstOrDefaultAsync();
                    
                    if (currentWaitingStep == null)
                    {
                        WriteLog($"警告: 找不到當前等待的步驟執行記錄，使用舊邏輯查找第一個等待節點");
                        var waitNode = flowData.Nodes.FirstOrDefault(n => n.Data?.Type == "waitReply" || n.Data?.Type == "waitForUserReply" || n.Data?.Type == "waitForQRCode" || n.Data?.Type == "waitforqrcode");
                        if (waitNode == null)
                        {
                            WriteLog($"錯誤: 找不到等待節點");
                            return;
                        }
                        // 先提取節點類型，避免在 LINQ 表達式中使用 null 條件運算符
                        var waitNodeType = waitNode.Data?.Type;
                        currentWaitingStep = await db.WorkflowStepExecutions
                            .FirstOrDefaultAsync(s => s.WorkflowExecutionId == execution.Id && s.StepType == waitNodeType);
                    }
                    
                    // 從 InputJson 中提取節點 ID
                    string waitNodeId = null;
                    if (!string.IsNullOrEmpty(currentWaitingStep.InputJson))
                    {
                        try
                        {
                            var nodeData = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(currentWaitingStep.InputJson);
                            // 嘗試從多個可能的字段中提取節點信息
                            foreach (var flowNode in flowData.Nodes)
                            {
                                if (flowNode.Data?.Type == currentWaitingStep.StepType && 
                                    flowNode.Data?.TaskName == currentWaitingStep.TaskName)
                                {
                                    waitNodeId = flowNode.Id;
                                    break;
                                }
                            }
                        }
                        catch
                        {
                            WriteLog($"警告: 無法解析步驟的 InputJson");
                        }
                    }
                    
                    if (waitNodeId == null)
                    {
                        WriteLog($"錯誤: 無法確定等待節點的 ID");
                        return;
                    }
                    
                    WriteLog($"找到當前等待節點: {waitNodeId} (StepType: {currentWaitingStep.StepType}, TaskName: {currentWaitingStep.TaskName})");

            // 標記 waitReply 步驟完成
            await MarkWaitReplyStepComplete(execution.Id);

                    // 找到下一個節點
                    if (adjacencyList.ContainsKey(waitNodeId))
                    {
                        // ✅ 修復：過濾掉不存在的節點，只取第一個有效的節點
                        var nextNodeIds = adjacencyList[waitNodeId];
                        var nodeMap = flowData.Nodes.ToDictionary(n => n.Id);
                        var nextNodeId = nextNodeIds.FirstOrDefault(id => nodeMap.ContainsKey(id));
                        
                        if (nextNodeId != null)
                        {
                            WriteLog($"找到下一個節點: {nextNodeId}");
                            WriteLog($"注意: 等待節點有 {nextNodeIds.Count} 個後續連接，已過濾無效節點");
                            
                            // 更新執行狀態
                            execution.IsWaiting = false;
                            execution.WaitingSince = null;
                            execution.LastUserActivity = DateTime.Now;
                            execution.Status = "Running";
                            execution.CurrentStep = (execution.CurrentStep ?? 0) + 1;
                    await SaveExecution(execution);

                            WriteLog($"執行狀態已更新，開始執行下一個節點: {nextNodeId}");
                    await ExecuteMultiBranchWorkflow(nextNodeId, flowData.Nodes, adjacencyList, execution, execution.WaitingForUser, flowData.Edges);
                        }
                        else
                        {
                            WriteLog($"錯誤: 等待節點 {waitNodeId} 沒有有效的後續節點（可能有無效邊連接）");
                        }
                    }
                    else
                    {
                        WriteLog($"錯誤: 等待節點 {waitNodeId} 在鄰接表中找不到");
                    }
                }
                
        // 核心：多分支執行引擎
        private async Task ExecuteMultiBranchWorkflow(string startNodeId, List<WorkflowNode> nodes, 
            Dictionary<string, List<string>> adjacencyList, WorkflowExecution execution, string userId, List<WorkflowEdge> edges = null)
        {
            WriteLog($"=== 開始多分支執行引擎 ===");
            WriteLog($"起始節點: {startNodeId}");
            
            // 創建節點映射
            var nodeMap = nodes.ToDictionary(n => n.Id);
            
            // 從起始節點開始執行
            await ExecuteNodeWithBranches(startNodeId, nodeMap, adjacencyList, execution, userId, edges);
            
            WriteLog($"=== 多分支執行引擎完成 ===");
        }

        // 執行單個節點並處理其所有分支
        private async Task ExecuteNodeWithBranches(string nodeId, Dictionary<string, WorkflowNode> nodeMap, 
            Dictionary<string, List<string>> adjacencyList, WorkflowExecution execution, string userId, List<WorkflowEdge> edges = null)
        {
            if (!nodeMap.ContainsKey(nodeId)) return;

            var node = nodeMap[nodeId];
            var nodeData = node.Data;

            WriteLog($"=== 執行節點: {nodeId} ===");
            WriteLog($"節點類型: {nodeData?.Type}");
            WriteLog($"任務名稱: {nodeData?.TaskName}");

            // 重要：檢查是否已經執行過這個節點，防止循環
            if (await IsNodeAlreadyExecuted(execution.Id, nodeId, nodeData?.Type))
            {
                WriteLog($"警告: 節點 {nodeId} ({nodeData?.Type}) 已經執行過，跳過以避免循環");
                return;
            }

            // 創建步驟執行記錄
            var stepExec = await CreateStepExecution(nodeId, nodeData, execution);
            if (stepExec == null) return;

            try
            {
                // 執行節點邏輯
                var shouldContinue = await ExecuteNodeLogic(nodeId, nodeData, stepExec, execution, userId);
                
                if (!shouldContinue)
                {
                    WriteLog($"節點 {nodeId} 設置為等待狀態，暫停執行");
                    return; // 節點設置為等待狀態，暫停執行
                }

                // 標記節點完成
                stepExec.Status = "Completed";
                stepExec.EndedAt = DateTime.Now;
                await SaveStepExecution(stepExec);

                // 根據節點類型選擇執行方式
                if (nodeData?.Type == "switch")
                {
                    await ExecuteSwitchNextNodes(nodeId, nodeMap, adjacencyList, execution, userId, stepExec, edges);
                }
                else
                {
                    // 找到並執行所有後續節點（多分支並行執行）
                    await ExecuteAllNextNodes(nodeId, nodeMap, adjacencyList, execution, userId, edges);
                }
            }
            catch (Exception ex)
            {
                WriteLog($"執行節點 {nodeId} 時發生錯誤: {ex.Message}");
                stepExec.Status = "Failed";
                stepExec.EndedAt = DateTime.Now;
                stepExec.OutputJson = JsonSerializer.Serialize(new { error = ex.Message });
                await SaveStepExecution(stepExec);
                
                execution.Status = "Error";
                execution.ErrorMessage = ex.Message;
                await SaveExecution(execution);
            }
        }

        // 執行節點邏輯
        private async Task<bool> ExecuteNodeLogic(string nodeId, WorkflowNodeData nodeData, 
            WorkflowStepExecution stepExec, WorkflowExecution execution, string userId)
        {
            switch (nodeData?.Type)
            {
                case "start":
                    WriteLog("處理 Start 節點");
                    return true;

                case "sendWhatsApp":
                    return await ExecuteSendWhatsApp(nodeData, stepExec, execution);

                case "sendWhatsAppTemplate":
                    return await ExecuteSendWhatsAppTemplate(nodeData, stepExec, execution);

                case "waitReply":
                case "waitForUserReply":
                    return await ExecuteWaitReply(nodeData, stepExec, execution, userId);

                case "waitForQRCode":
                case "waitforqrcode":
                    return await ExecuteWaitForQRCode(nodeData, stepExec, execution, userId);

                case "sendEForm":
                case "sendeform":
                    return await ExecuteSendEForm(nodeData, stepExec, execution);

                case "switch":
                    return await ExecuteSwitch(nodeData, stepExec, execution, userId);

                case "end":
                    return await ExecuteEnd(nodeId, stepExec, execution);

                case "dataSetQuery":
                    return await ExecuteDataSetQuery(nodeData, stepExec, execution);

                default:
                    WriteLog($"未處理的節點類型: {nodeData?.Type}");
                    stepExec.Status = "UnknownStepType";
                    return false;
            }
        }

        // 執行所有後續節點（多分支並行執行）
        private async Task ExecuteAllNextNodes(string currentNodeId, Dictionary<string, WorkflowNode> nodeMap, 
            Dictionary<string, List<string>> adjacencyList, WorkflowExecution execution, string userId, List<WorkflowEdge> edges = null)
        {
            if (!adjacencyList.ContainsKey(currentNodeId))
            {
                WriteLog($"節點 {currentNodeId} 沒有後續節點");
                return;
            }

            var nextNodeIds = adjacencyList[currentNodeId];
            WriteLog($"=== 節點 {currentNodeId} 的後續節點分析 ===");
            WriteLog($"後續節點數量: {nextNodeIds.Count}");
            WriteLog($"後續節點列表: {string.Join(", ", nextNodeIds)}");

            // 詳細檢查每個後續節點
            foreach (var nextNodeId in nextNodeIds)
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

            // 並行執行所有後續節點
            var tasks = new List<Task>();
            foreach (var nextNodeId in nextNodeIds)
            {
                WriteLog($"創建任務: {nextNodeId}");
                var task = ExecuteNodeWithBranches(nextNodeId, nodeMap, adjacencyList, execution, userId, edges);
                tasks.Add(task);
            }

            WriteLog($"等待 {tasks.Count} 個並行任務完成...");
            await Task.WhenAll(tasks);
            WriteLog($"=== 所有 {tasks.Count} 個分支節點執行完成 ===");
        }

        // 創建步驟執行記錄
        private async Task<WorkflowStepExecution> CreateStepExecution(string nodeId, WorkflowNodeData nodeData, WorkflowExecution execution)
        {
            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<PurpleRiceDbContext>();

            var stepExec = new WorkflowStepExecution
            {
                WorkflowExecutionId = execution.Id,
                StepIndex = execution.CurrentStep ?? 0,
                StepType = nodeData?.Type,
                TaskName = nodeData?.TaskName, // 保存用戶自定義的任務名稱
                Status = "Running",
                InputJson = JsonSerializer.Serialize(nodeData),
                StartedAt = DateTime.Now
            };

            db.WorkflowStepExecutions.Add(stepExec);
            await db.SaveChangesAsync();

            return stepExec;
        }

        // 保存步驟執行記錄
        private async Task SaveStepExecution(WorkflowStepExecution stepExec)
        {
            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<PurpleRiceDbContext>();
            
            var existingStep = await db.WorkflowStepExecutions.FindAsync(stepExec.Id);
            if (existingStep != null)
            {
                existingStep.Status = stepExec.Status;
                existingStep.OutputJson = stepExec.OutputJson;
                existingStep.EndedAt = stepExec.EndedAt;
                existingStep.IsWaiting = stepExec.IsWaiting;
                await db.SaveChangesAsync();
            }
        }

        // 保存執行記錄
        private async Task SaveExecution(WorkflowExecution execution)
        {
            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<PurpleRiceDbContext>();
            
            var existingExecution = await db.WorkflowExecutions.FindAsync(execution.Id);
            if (existingExecution != null)
            {
                existingExecution.Status = execution.Status;
                existingExecution.ErrorMessage = execution.ErrorMessage;
                existingExecution.EndedAt = execution.EndedAt;
                existingExecution.IsWaiting = execution.IsWaiting;
                existingExecution.WaitingSince = execution.WaitingSince;
                existingExecution.WaitingForUser = execution.WaitingForUser;
                existingExecution.LastUserActivity = execution.LastUserActivity;
                existingExecution.CurrentStep = execution.CurrentStep;
                await db.SaveChangesAsync();
            }
        }

        // 標記 sendEForm 步驟完成
        private async Task MarkSendEFormStepComplete(int executionId)
        {
            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<PurpleRiceDbContext>();
            
            var sendEFormStepExecution = await db.WorkflowStepExecutions
                .Where(s => s.WorkflowExecutionId == executionId && s.StepType == "sendEForm")
                .OrderByDescending(s => s.StartedAt)
                .FirstOrDefaultAsync();
            
            if (sendEFormStepExecution != null)
            {
                sendEFormStepExecution.Status = "Completed";
                sendEFormStepExecution.IsWaiting = false;
                sendEFormStepExecution.EndedAt = DateTime.Now;
                await db.SaveChangesAsync();
                WriteLog($"sendEForm 步驟已標記為完成");
            }
        }

        // 標記等待步驟完成（支持 waitReply 和 waitForQRCode）
        private async Task MarkWaitReplyStepComplete(int executionId)
        {
            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<PurpleRiceDbContext>();
            
            // ✅ 修復：查找所有等待類型的步驟（waitReply, waitForQRCode, waitForUserReply）
            var waitStepExecution = await db.WorkflowStepExecutions
                .Where(s => s.WorkflowExecutionId == executionId && 
                           s.IsWaiting == true &&
                           (s.StepType == "waitReply" || 
                            s.StepType == "waitForQRCode" || 
                            s.StepType == "waitforqrcode" || 
                            s.StepType == "waitForUserReply"))
                .OrderByDescending(s => s.StartedAt)
                .FirstOrDefaultAsync();
            
            if (waitStepExecution != null)
            {
                waitStepExecution.IsWaiting = false;
                waitStepExecution.Status = "Completed";
                waitStepExecution.EndedAt = DateTime.Now;
                waitStepExecution.OutputJson = JsonSerializer.Serialize(new { 
                    message = "User replied, continuing workflow",
                    stepType = waitStepExecution.StepType,
                    timestamp = DateTime.Now,
                    userResponse = "User provided response"
                });
                await db.SaveChangesAsync();
                WriteLog($"✅ 等待節點狀態已更新為 Completed，步驟ID: {waitStepExecution.Id}, 類型: {waitStepExecution.StepType}");
                                 }
                                 else
                                 {
                WriteLog($"警告: 找不到等待步驟執行記錄（executionId: {executionId}）");
            }
        }

        // 執行 sendWhatsApp 節點
        private async Task<bool> ExecuteSendWhatsApp(WorkflowNodeData nodeData, WorkflowStepExecution stepExec, WorkflowExecution execution)
        {
            WriteLog($"=== 執行 sendWhatsApp 節點 ===");
            WriteLog($"收件人: {nodeData.To}");
            WriteLog($"消息內容: {nodeData.Message}");
            WriteLog($"收件人詳情: {nodeData.RecipientDetails}");
            WriteLog($"🔍 [DEBUG] RecipientDetails 是否為 null: {nodeData.RecipientDetails == null}");
            WriteLog($"🔍 [DEBUG] RecipientDetails 類型: {nodeData.RecipientDetails?.GetType().Name ?? "null"}");
            
            if (!string.IsNullOrEmpty(nodeData.Message))
            {
                using var scope = _serviceProvider.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<PurpleRiceDbContext>();
                
                try
                {
                    WriteLog($"🔍 [DEBUG] 開始處理變數替換");
                    // 替換訊息內容中的變數
                    var processedMessage = await _variableReplacementService.ReplaceVariablesAsync(nodeData.Message, execution.Id);
                    WriteLog($"🔍 [DEBUG] 原始訊息: {nodeData.Message}");
                    WriteLog($"🔍 [DEBUG] 處理後訊息: {processedMessage}");
                    
                    WriteLog($"🔍 [DEBUG] 開始解析收件人");
                    // 使用 RecipientResolverService 解析收件人
                    var resolvedRecipients = await _recipientResolverService.ResolveRecipientsAsync(
                        nodeData.To, 
                        nodeData.RecipientDetails != null ? JsonSerializer.Serialize(nodeData.RecipientDetails) : null, 
                        execution.Id,
                        execution.WorkflowDefinition.CompanyId
                    );
                    
                    WriteLog($"🔍 [DEBUG] 解析到 {resolvedRecipients.Count} 個收件人");
                    
                    // 發送消息給所有解析到的收件人
                    var messageSendId = await _whatsAppWorkflowService.SendWhatsAppMessageWithTrackingAsync(
                        nodeData.To, // 使用原始收件人值
                        nodeData.RecipientDetails != null ? JsonSerializer.Serialize(nodeData.RecipientDetails) : null, // 使用原始收件人詳細信息
                        processedMessage,
                        execution,
                        stepExec,
                        stepExec.Id.ToString(), // nodeId
                        "sendWhatsApp",
                        db
                    );
                    
                    WriteLog($"🔍 [DEBUG] 消息發送記錄創建完成，ID: {messageSendId}");
                    
                    WriteLog($"🔍 [DEBUG] 消息發送完成，收件人數量: {resolvedRecipients.Count}");
                    
                    stepExec.OutputJson = JsonSerializer.Serialize(new { 
                        success = true, 
                        message = "WhatsApp messages sent successfully",
                        recipientCount = resolvedRecipients.Count,
                        taskName = nodeData.TaskName,
                        messageSendId = messageSendId
                    });
                    
                    return true;
                }
                catch (Exception ex)
                {
                    WriteLog($"發送 WhatsApp 消息失敗: {ex.Message}");
                    stepExec.OutputJson = JsonSerializer.Serialize(new { 
                        error = "Failed to send WhatsApp message",
                        message = ex.Message
                    });
                    return false;
                }
            }
            else
            {
                WriteLog($"sendWhatsApp 步驟缺少必要參數: message={nodeData.Message}, recipientDetails={nodeData.RecipientDetails}");
                stepExec.OutputJson = JsonSerializer.Serialize(new { error = "Missing required parameters" });
                return false;
            }
        }

        // 執行 sendWhatsAppTemplate 節點
        private async Task<bool> ExecuteSendWhatsAppTemplate(WorkflowNodeData nodeData, WorkflowStepExecution stepExec, WorkflowExecution execution)
        {
            WriteLog($"=== 執行 sendWhatsAppTemplate 節點 ===");
            WriteLog($"收件人: {nodeData.To}");
            WriteLog($"模板ID: {nodeData.TemplateId}");
            WriteLog($"模板名稱: {nodeData.TemplateName}");
            WriteLog($"收件人詳情: {nodeData.RecipientDetails}");
            
            if (!string.IsNullOrEmpty(nodeData.TemplateName))
            {
                using var scope = _serviceProvider.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<PurpleRiceDbContext>();
                
                try
                {
                    WriteLog($"🔍 [DEBUG] 開始處理模板變數替換");
                    // 替換模板變數中的變數
                    var processedVariables = new Dictionary<string, string>();
                    if (nodeData.Variables != null)
                    {
                        foreach (var kvp in nodeData.Variables)
                        {
                            var processedValue = await _variableReplacementService.ReplaceVariablesAsync(kvp.Value, execution.Id);
                            processedVariables[kvp.Key] = processedValue;
                            WriteLog($"🔍 [DEBUG] 模板變數 {kvp.Key}: {kvp.Value} -> {processedValue}");
                        }
                    }
                    
                    WriteLog($"🔍 [DEBUG] 開始解析收件人");
                    // 使用 RecipientResolverService 解析收件人
                    var resolvedRecipients = await _recipientResolverService.ResolveRecipientsAsync(
                        nodeData.To, 
                        nodeData.RecipientDetails != null ? JsonSerializer.Serialize(nodeData.RecipientDetails) : null, 
                        execution.Id,
                        execution.WorkflowDefinition.CompanyId
                    );
                    
                    WriteLog($"🔍 [DEBUG] 解析到 {resolvedRecipients.Count} 個收件人");
                    
                    // 發送模板消息給所有解析到的收件人
                    var messageSendId = await _whatsAppWorkflowService.SendWhatsAppTemplateMessageWithTrackingAsync(
                        nodeData.To, // 使用原始收件人值
                        nodeData.RecipientDetails != null ? JsonSerializer.Serialize(nodeData.RecipientDetails) : null, // 使用原始收件人詳細信息
                        nodeData.TemplateId,
                        nodeData.TemplateName,
                        processedVariables,
                        execution,
                        stepExec,
                        stepExec.Id.ToString(), // nodeId
                        "sendWhatsAppTemplate",
                        db
                    );
                    
                    WriteLog($"🔍 [DEBUG] 模板消息發送記錄創建完成，ID: {messageSendId}");
                    
                    WriteLog($"🔍 [DEBUG] 模板消息發送完成，收件人數量: {resolvedRecipients.Count}");
                    
                    stepExec.OutputJson = JsonSerializer.Serialize(new { 
                        success = true, 
                        message = "WhatsApp template messages sent successfully",
                        recipientCount = resolvedRecipients.Count,
                        templateName = nodeData.TemplateName,
                        messageSendId = messageSendId
                    });
                    
                    return true;
                }
                catch (Exception ex)
                {
                    WriteLog($"發送 WhatsApp 模板消息失敗: {ex.Message}");
                    stepExec.OutputJson = JsonSerializer.Serialize(new { 
                        error = "Failed to send WhatsApp template message",
                        message = ex.Message
                    });
                    return false;
                }
            }
            else
            {
                WriteLog($"sendWhatsAppTemplate 步驟缺少必要參數: templateName={nodeData.TemplateName}, recipientDetails={nodeData.RecipientDetails}");
                stepExec.OutputJson = JsonSerializer.Serialize(new { error = "Missing required parameters" });
                return false;
            }
        }

        // 執行 waitReply 節點
        private async Task<bool> ExecuteWaitReply(WorkflowNodeData nodeData, WorkflowStepExecution stepExec, WorkflowExecution execution, string userId)
        {
            WriteLog($"=== 執行 waitReply 節點 ===");
            
            // 設置等待狀態
            execution.Status = "Waiting";
            execution.IsWaiting = true;
            execution.WaitingSince = DateTime.Now;
            execution.WaitingForUser = userId ?? "85296366318";
                        execution.LastUserActivity = DateTime.Now;
            execution.CurrentStep = stepExec.StepIndex;
                        
                        stepExec.Status = "Waiting";
            stepExec.IsWaiting = true;
            stepExec.OutputJson = JsonSerializer.Serialize(new { 
                message = "Waiting for user reply",
                waitingSince = DateTime.Now,
                waitingForUser = execution.WaitingForUser
            });
            
            // 保存狀態
            await SaveExecution(execution);
            await SaveStepExecution(stepExec);
            
            // 發送提示消息
            if (!string.IsNullOrEmpty(nodeData.Message))
            {
                using var scope = _serviceProvider.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<PurpleRiceDbContext>();
                
                var company = await db.Companies.FindAsync(execution.WorkflowDefinition.CompanyId);
                if (company != null)
                {
                    WriteLog($"🔍 [DEBUG] 開始解析 waitReply 收件人");
                    WriteLog($"🔍 [DEBUG] nodeData.SpecifiedUsers: '{nodeData.SpecifiedUsers}'");
                    WriteLog($"🔍 [DEBUG] nodeData.ReplyType: '{nodeData.ReplyType}'");
                    WriteLog($"🔍 [DEBUG] nodeData.RecipientDetails: {(nodeData.RecipientDetails != null ? JsonSerializer.Serialize(nodeData.RecipientDetails) : "null")}");
                    
                    // 根據 replyType 決定收件人
                    string recipientValue;
                    string recipientDetailsJson;
                    
                    // ✅ 修復：只根據 replyType 判斷，不檢查 specifiedUsers 是否為空
                    if (nodeData.ReplyType == "initiator")
                    {
                        // 使用流程啟動人
                        recipientValue = "${initiator}";
                        recipientDetailsJson = JsonSerializer.Serialize(new 
                        { 
                            users = new List<object>(),
                            contacts = new List<object>(),
                            groups = new List<object>(),
                            hashtags = new List<object>(),
                            processVariables = new List<string>(),
                            useInitiator = true,
                            phoneNumbers = new List<string>()
                        });
                        WriteLog($"🔍 [DEBUG] 使用流程啟動人作為收件人");
                    }
                    else
                    {
                        // ✅ 使用 recipientDetails（即使 specifiedUsers 為空）
                        recipientValue = nodeData.SpecifiedUsers ?? "";
                        recipientDetailsJson = nodeData.RecipientDetails != null ? JsonSerializer.Serialize(nodeData.RecipientDetails) : null;
                        WriteLog($"🔍 [DEBUG] 使用 recipientDetails 配置（replyType={nodeData.ReplyType}）");
                        WriteLog($"🔍 [DEBUG] recipientDetailsJson: {recipientDetailsJson}");
                    }
                    
                    // 使用 RecipientResolverService 解析收件人
                    var resolvedRecipients = await _recipientResolverService.ResolveRecipientsAsync(
                        recipientValue,
                        recipientDetailsJson, 
                        execution.Id,
                        execution.WorkflowDefinition.CompanyId
                    );
                    
                    WriteLog($"🔍 [DEBUG] 解析到 {resolvedRecipients.Count} 個收件人");
                    
                    // 發送等待提示訊息給所有解析到的收件人
                    var messageSendId = await _whatsAppWorkflowService.SendWhatsAppMessageWithTrackingAsync(
                        recipientValue,
                        recipientDetailsJson,
                        nodeData.Message,
                        execution,
                        stepExec,
                        stepExec.Id.ToString(), // nodeId
                        "waitReply",
                        db
                    );
                    
                    WriteLog($"🔍 [DEBUG] 等待提示訊息發送記錄創建完成，ID: {messageSendId}");
                    
                    WriteLog($"🔍 [DEBUG] 等待提示訊息發送完成，收件人數量: {resolvedRecipients.Count}");
                }
            }
            
            WriteLog($"等待節點設置完成，流程暫停等待用戶回覆");
            return false; // 返回 false 表示暫停執行
        }

        // 執行 waitForQRCode 節點
        private async Task<bool> ExecuteWaitForQRCode(WorkflowNodeData nodeData, WorkflowStepExecution stepExec, WorkflowExecution execution, string userId)
        {
            WriteLog($"=== 執行 waitForQRCode 節點 ===");
            WriteLog($"QR Code 變量: {nodeData.QrCodeVariable}");
            WriteLog($"提示訊息: {nodeData.Message}");
            WriteLog($"成功訊息: {nodeData.QrCodeSuccessMessage}");
            WriteLog($"錯誤訊息: {nodeData.QrCodeErrorMessage}");
            WriteLog($"超時時間: {nodeData.Timeout} 秒");
            
            // 設置等待狀態
            execution.Status = "WaitingForQRCode";
            execution.IsWaiting = true;
            execution.WaitingSince = DateTime.Now;
            execution.WaitingForUser = userId ?? "85296366318";
            execution.LastUserActivity = DateTime.Now;
            execution.CurrentStep = stepExec.StepIndex;
            
            stepExec.Status = "Waiting";
            stepExec.IsWaiting = true;
            stepExec.OutputJson = JsonSerializer.Serialize(new { 
                message = "Waiting for QR Code upload",
                qrCodeVariable = nodeData.QrCodeVariable,
                timeout = nodeData.Timeout,
                waitingSince = DateTime.Now,
                waitingForUser = execution.WaitingForUser
            });
            
            // 保存狀態
            await SaveExecution(execution);
            await SaveStepExecution(stepExec);
            
            // 發送提示消息
            if (!string.IsNullOrEmpty(nodeData.Message))
            {
                using var scope = _serviceProvider.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<PurpleRiceDbContext>();
                
                var company = await db.Companies.FindAsync(execution.WorkflowDefinition.CompanyId);
                if (company != null)
                {
                    WriteLog($"🔍 [DEBUG] 開始解析 waitForQRCode 收件人");
                    WriteLog($"🔍 [DEBUG] nodeData.ReplyType: '{nodeData.ReplyType}'");
                    WriteLog($"🔍 [DEBUG] nodeData.RecipientDetails: {(nodeData.RecipientDetails != null ? JsonSerializer.Serialize(nodeData.RecipientDetails) : "null")}");
                    
                    // 根據 replyType 決定收件人
                    string recipientValue;
                    string recipientDetailsJson;
                    
                    // ✅ 修復：只根據 replyType 判斷
                    if (nodeData.ReplyType == "initiator")
                    {
                        // 使用流程啟動人
                        recipientValue = "${initiator}";
                        recipientDetailsJson = JsonSerializer.Serialize(new 
                        { 
                            users = new List<object>(),
                            contacts = new List<object>(),
                            groups = new List<object>(),
                            hashtags = new List<object>(),
                            processVariables = new List<string>(),
                            useInitiator = true,
                            phoneNumbers = new List<string>()
                        });
                        WriteLog($"🔍 [DEBUG] 使用流程啟動人作為收件人");
                    }
                    else
                    {
                        // ✅ 使用 recipientDetails
                        recipientValue = nodeData.SpecifiedUsers ?? "";
                        recipientDetailsJson = nodeData.RecipientDetails != null ? JsonSerializer.Serialize(nodeData.RecipientDetails) : null;
                        WriteLog($"🔍 [DEBUG] 使用 recipientDetails 配置（replyType={nodeData.ReplyType}）");
                    }
                    
                    // 使用 RecipientResolverService 解析收件人
                    var resolvedRecipients = await _recipientResolverService.ResolveRecipientsAsync(
                        recipientValue,
                        recipientDetailsJson, 
                        execution.Id,
                        execution.WorkflowDefinition.CompanyId
                    );
                    
                    WriteLog($"🔍 [DEBUG] 解析到 {resolvedRecipients.Count} 個收件人");
                    
                    // 發送 QR Code 等待提示訊息給所有解析到的收件人
                    var messageSendId = await _whatsAppWorkflowService.SendWhatsAppMessageWithTrackingAsync(
                        recipientValue,
                        recipientDetailsJson,
                        nodeData.Message,
                        execution,
                        stepExec,
                        stepExec.Id.ToString(), // nodeId
                        "waitQRCode",
                        db
                    );
                    
                    WriteLog($"🔍 [DEBUG] QR Code 等待提示訊息發送記錄創建完成，ID: {messageSendId}");
                    
                    WriteLog($"🔍 [DEBUG] QR Code 等待提示訊息發送完成，收件人數量: {resolvedRecipients.Count}");
                }
            }
            
            WriteLog($"QR Code 等待節點設置完成，流程暫停等待 QR Code 上傳");
            return false; // 返回 false 表示暫停執行
        }

        // 執行 sendEForm 節點
        private async Task<bool> ExecuteSendEForm(WorkflowNodeData nodeData, WorkflowStepExecution stepExec, WorkflowExecution execution)
        {
            WriteLog($"=== 執行 sendEForm 節點 ===");
                        
                        if (!string.IsNullOrEmpty(nodeData.FormName))
                        {
                using var scope = _serviceProvider.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<PurpleRiceDbContext>();
                            
                            try
                            {
                                // 獲取公司信息
                                var company = await db.Companies.FindAsync(execution.WorkflowDefinition.CompanyId);
                                if (company == null)
                                {
                                    stepExec.OutputJson = JsonSerializer.Serialize(new { error = "Company not found" });
                        return false;
                                }

                                // 查詢表單定義
                                var eFormDefinition = await db.eFormDefinitions
                                    .FirstOrDefaultAsync(f => f.Name == nodeData.FormName && f.Status == "A");

                                if (eFormDefinition == null)
                                {
                                    stepExec.OutputJson = JsonSerializer.Serialize(new { error = $"Form definition not found: {nodeData.FormName}" });
                        return false;
                                }

                    // 查詢用戶回覆記錄
                                var userMessages = await db.MessageValidations
                                    .Where(m => m.WorkflowExecutionId == execution.Id && m.IsValid)
                                    .OrderBy(m => m.CreatedAt)
                                    .ToListAsync();

                                // 創建表單實例
                                var eFormInstance = new EFormInstance
                                {
                                    Id = Guid.NewGuid(),
                                    EFormDefinitionId = eFormDefinition.Id,
                                    WorkflowExecutionId = execution.Id,
                                    WorkflowStepExecutionId = execution.CurrentStep ?? 0,
                                    CompanyId = company.Id,
                                    InstanceName = $"{nodeData.FormName}_{execution.Id}_{DateTime.Now:yyyyMMddHHmmss}",
                                    OriginalHtmlCode = eFormDefinition.HtmlCode,
                                    Status = "Pending",
                                    CreatedAt = DateTime.UtcNow,
                                    UpdatedAt = DateTime.UtcNow
                                };

                    // 如果有用戶回覆，使用 AI 填充表單
                                if (userMessages.Any())
                                {
                                    var latestMessage = userMessages.Last();
                                    eFormInstance.UserMessage = latestMessage.UserMessage;
                                    var filledHtml = await _eFormService.FillFormWithAIAsync(eFormDefinition.HtmlCode, latestMessage.UserMessage);
                                    eFormInstance.FilledHtmlCode = filledHtml;
                                }
                                else
                                {
                                    eFormInstance.FilledHtmlCode = eFormDefinition.HtmlCode;
                                }

                                // 生成表單 URL
                                var formUrl = $"/eform-instance/{eFormInstance.Id}";
                                eFormInstance.FormUrl = formUrl;

                                // 保存到數據庫
                                db.EFormInstances.Add(eFormInstance);
                                await db.SaveChangesAsync();

                                WriteLog($"🔍 [DEBUG] 開始解析收件人");
                                // 使用 RecipientResolverService 解析收件人
                                var resolvedRecipients = await _recipientResolverService.ResolveRecipientsAsync(
                                    nodeData.To, 
                                    nodeData.RecipientDetails != null ? JsonSerializer.Serialize(nodeData.RecipientDetails) : null, 
                                    execution.Id,
                                    execution.WorkflowDefinition.CompanyId
                                );
                                
                                WriteLog($"🔍 [DEBUG] 解析到 {resolvedRecipients.Count} 個收件人");
                                
                                // 發送 WhatsApp 消息通知所有收件人
                                var message = $"您的{nodeData.FormName}已準備就緒，請點擊以下鏈接填寫：\n\n{formUrl}";
                                var messageSendId = await _whatsAppWorkflowService.SendWhatsAppMessageWithTrackingAsync(
                                    nodeData.To, // 使用原始收件人值
                                    nodeData.RecipientDetails != null ? JsonSerializer.Serialize(nodeData.RecipientDetails) : null, // 使用原始收件人詳細信息
                                    message,
                                    execution,
                                    stepExec,
                                    stepExec.Id.ToString(), // nodeId
                                    "sendEForm",
                                    db
                                );
                                
                                WriteLog($"🔍 [DEBUG] EForm 通知訊息發送記錄創建完成，ID: {messageSendId}");
                                
                                WriteLog($"🔍 [DEBUG] EForm 通知發送完成，收件人數量: {resolvedRecipients.Count}");

                                // 設置為等待表單審批狀態
                                execution.Status = "WaitingForFormApproval";
                                 stepExec.Status = "Waiting";
                                 stepExec.OutputJson = JsonSerializer.Serialize(new { 
                                     success = true, 
                                     message = "EForm sent successfully, waiting for approval",
                                     formInstanceId = eFormInstance.Id,
                                     recipientCount = resolvedRecipients.Count,
                                     messageSendId = messageSendId,
                                     waitingSince = DateTime.Now 
                                 });
                                 
                                 // 保存狀態
                    await SaveExecution(execution);
                    await SaveStepExecution(stepExec);
                    
                    WriteLog($"eForm 節點設置為等待表單審批狀態");
                    return false; // 返回 false 表示暫停執行
                             }
                             catch (Exception ex)
                             {
                                 WriteLog($"eForm 處理失敗: {ex.Message}");
                                 stepExec.OutputJson = JsonSerializer.Serialize(new { error = ex.Message });
                    return false;
                             }
                         }
                         else
                         {
                             WriteLog($"sendEForm 步驟缺少必要參數: formName={nodeData.FormName}, recipientDetails={nodeData.RecipientDetails}");
                             stepExec.OutputJson = JsonSerializer.Serialize(new { error = "Missing required parameters" });
                return false;
            }
        }

        // 執行 end 節點
        private async Task<bool> ExecuteEnd(string nodeId, WorkflowStepExecution stepExec, WorkflowExecution execution)
        {
                    WriteLog($"=== 到達 End 節點: {nodeId} ===");
            
            stepExec.OutputJson = JsonSerializer.Serialize(new { 
                message = "End node reached",
                nodeId = nodeId,
                completedAt = DateTime.Now
            });
                    
                    // 檢查是否所有分支都已完成
            var completedEndNodes = await CountCompletedEndNodes(execution.Id);
                    
                    WriteLog($"=== End 節點完成檢查 ===");
                    WriteLog($"已完成 End 節點數: {completedEndNodes}");
                    
            // 標記整個流程為完成
                        execution.Status = "Completed";
                        execution.EndedAt = DateTime.Now;
            await SaveExecution(execution);
            
            // 清理用戶會話中的已完成流程
            await _userSessionService.ClearCompletedWorkflowFromSessionAsync(execution.Id);
            
            WriteLog($"=== 工作流程標記為完成 ===");
            
            return false; // 返回 false 表示暫停執行
        }

        // 執行 Switch 節點
        private async Task<bool> ExecuteSwitch(WorkflowNodeData nodeData, WorkflowStepExecution stepExec, WorkflowExecution execution, string userId)
        {
            WriteLog($"=== 執行 Switch 節點 ===");
            WriteLog($"節點數據: {JsonSerializer.Serialize(nodeData)}");

            try
            {
                // 獲取條件群組
                var conditionGroups = GetConditionGroupsFromNodeData(nodeData);
                var defaultPath = GetDefaultPathFromNodeData(nodeData);

                WriteLog($"條件群組數量: {conditionGroups?.Count ?? 0}");
                WriteLog($"默認路徑: {defaultPath}");

                // 評估條件群組 - 支持多個條件同時滿足
                var selectedPaths = new List<string>();
                if (conditionGroups != null && conditionGroups.Any())
                {
                    foreach (var group in conditionGroups)
                    {
                        WriteLog($"評估條件群組: {group.Id}, 關係: {group.Relation}");
                        
                        bool groupResult = await EvaluateConditionGroup(execution.Id, group);
                        if (groupResult)
                        {
                            selectedPaths.Add(group.OutputPath);
                            WriteLog($"條件群組 {group.Id} 滿足，添加路徑: {group.OutputPath}");
                        }
                    }
                }

                // 如果沒有條件滿足，使用默認路徑
                if (!selectedPaths.Any())
                {
                    if (!string.IsNullOrEmpty(defaultPath))
                    {
                        selectedPaths.Add(defaultPath);
                        WriteLog($"沒有條件滿足，使用默認路徑: {defaultPath}");
                    }
                }

                // 記錄執行結果
                stepExec.OutputJson = JsonSerializer.Serialize(new
                {
                    selectedPaths = selectedPaths,
                    selectedPath = selectedPaths.FirstOrDefault(), // 保持向後兼容
                    evaluatedAt = DateTime.Now,
                    conditionGroupsCount = conditionGroups?.Count ?? 0,
                    defaultPathUsed = !selectedPaths.Any() || selectedPaths.Contains(defaultPath)
                });

                WriteLog($"Switch 節點執行完成，選擇路徑數量: {selectedPaths.Count}");
                return true; // 返回 true 表示繼續執行
            }
            catch (Exception ex)
            {
                WriteLog($"執行 Switch 節點時發生錯誤: {ex.Message}");
                stepExec.OutputJson = JsonSerializer.Serialize(new { error = ex.Message });
                return false;
            }
        }

        // 從節點數據中獲取條件群組
        private List<SwitchConditionGroup> GetConditionGroupsFromNodeData(WorkflowNodeData nodeData)
        {
            try
            {
                if (nodeData.ConditionGroups != null)
                {
                    return nodeData.ConditionGroups;
                }

                // 如果 ConditionGroups 為 null，嘗試從 JSON 中解析
                if (!string.IsNullOrEmpty(nodeData.Json))
                {
                    var jsonData = JsonSerializer.Deserialize<Dictionary<string, object>>(nodeData.Json);
                    if (jsonData.ContainsKey("conditionGroups"))
                    {
                        var conditionGroupsJson = JsonSerializer.Serialize(jsonData["conditionGroups"]);
                        return JsonSerializer.Deserialize<List<SwitchConditionGroup>>(conditionGroupsJson);
                    }
                }

                return new List<SwitchConditionGroup>();
            }
            catch (Exception ex)
            {
                WriteLog($"解析條件群組時發生錯誤: {ex.Message}");
                return new List<SwitchConditionGroup>();
            }
        }

        // 從節點數據中獲取默認路徑
        private string GetDefaultPathFromNodeData(WorkflowNodeData nodeData)
        {
            try
            {
                if (!string.IsNullOrEmpty(nodeData.DefaultPath))
                {
                    return nodeData.DefaultPath;
                }

                // 如果 DefaultPath 為空，嘗試從 JSON 中解析
                if (!string.IsNullOrEmpty(nodeData.Json))
                {
                    var jsonData = JsonSerializer.Deserialize<Dictionary<string, object>>(nodeData.Json);
                    if (jsonData.ContainsKey("defaultPath"))
                    {
                        return jsonData["defaultPath"]?.ToString();
                    }
                }

                return "default";
            }
            catch (Exception ex)
            {
                WriteLog($"解析默認路徑時發生錯誤: {ex.Message}");
                return "default";
            }
        }

        // 評估條件群組
        private async Task<bool> EvaluateConditionGroup(int executionId, SwitchConditionGroup group)
        {
            if (group.Conditions == null || !group.Conditions.Any())
            {
                WriteLog($"條件群組 {group.Id} 沒有條件，返回 false");
                return false;
            }

            WriteLog($"評估條件群組 {group.Id}，條件數量: {group.Conditions.Count}，關係: {group.Relation}");

            if (group.Relation?.ToLower() == "and")
            {
                // AND 關係：所有條件都必須滿足
                foreach (var condition in group.Conditions)
                {
                    bool conditionResult = await _switchConditionService.EvaluateConditionAsync(executionId, condition);
                    WriteLog($"條件 {condition.VariableName} {condition.Operator} {condition.Value}: {conditionResult}");
                    
                    if (!conditionResult)
                    {
                        WriteLog($"條件群組 {group.Id} 的 AND 關係不滿足");
                        return false;
                    }
                }
                WriteLog($"條件群組 {group.Id} 的 AND 關係滿足");
                return true;
            }
            else
            {
                // OR 關係：任一條件滿足即可
                foreach (var condition in group.Conditions)
                {
                    bool conditionResult = await _switchConditionService.EvaluateConditionAsync(executionId, condition);
                    WriteLog($"條件 {condition.VariableName} {condition.Operator} {condition.Value}: {conditionResult}");
                    
                    if (conditionResult)
                    {
                        WriteLog($"條件群組 {group.Id} 的 OR 關係滿足");
                        return true;
                    }
                }
                WriteLog($"條件群組 {group.Id} 的 OR 關係不滿足");
                return false;
            }
        }

        // 計算已完成的 End 節點數量
        private async Task<int> CountCompletedEndNodes(int executionId)
        {
            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<PurpleRiceDbContext>();
            
            return await db.WorkflowStepExecutions
                .Where(s => s.WorkflowExecutionId == executionId && 
                           s.StepType == "end" && 
                           s.Status == "Completed")
                .CountAsync();
        }

        // 檢查節點是否已經執行過，防止循環
        private async Task<bool> IsNodeAlreadyExecuted(int executionId, string nodeId, string nodeType)
        {
            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<PurpleRiceDbContext>();

            // 檢查是否已經有相同節點ID的執行記錄
            var existingStep = await db.WorkflowStepExecutions
                .Where(s => s.WorkflowExecutionId == executionId && 
                           s.StepType == nodeType &&
                           s.InputJson.Contains($"\"Id\":\"{nodeId}\""))
                .FirstOrDefaultAsync();
            
            if (existingStep != null)
            {
                WriteLog($"發現重複執行: 節點 {nodeId} ({nodeType}) 已經在步驟 {existingStep.Id} 中執行過");
                return true;
            }
            
            // 特別檢查 sendEForm 節點，防止重複創建表單
            if (nodeType == "sendEForm" || nodeType == "sendeform")
            {
                var existingEFormSteps = await db.WorkflowStepExecutions
                    .Where(s => s.WorkflowExecutionId == executionId && s.StepType == "sendEForm")
                            .CountAsync();
                        
                if (existingEFormSteps > 0)
                {
                    WriteLog($"發現重複的 sendEForm 節點: 已經有 {existingEFormSteps} 個 sendEForm 步驟執行過");
                    return true;
                }
            }
            
            return false;
        }
        
        // 從邊 ID 中提取目標節點（智能處理正向和反向邊）
        private string ExtractTargetNodeFromEdge(string edgeId, string currentNodeId)
        {
            if (string.IsNullOrEmpty(edgeId))
                return null;
            
            WriteLog($"🔍 解析邊 ID: {edgeId}");
            WriteLog($"🔍 當前節點: {currentNodeId}");
            
            // 邊 ID 格式：
            // xy-edge__{sourceNode}{sourceHandle}-source-{targetNode}{targetHandle}-target
            // 例如：xy-edge__switch_xxxbottom-source-waitReply_xxxtop-target
            // 或反向：xy-edge__waitReply_xxxtop-source-switch_xxxbottom-target
            
            // 分割邊 ID 以提取 source 和 target 節點
            var parts = edgeId.Split(new[] { "-source-", "-target" }, StringSplitOptions.None);
            if (parts.Length < 2)
            {
                WriteLog($"❌ 邊 ID 格式不正確");
                return null;
            }
            
            // 提取前綴後的第一個節點（source 節點）
            var prefix = edgeId.StartsWith("xy-edge__") ? "xy-edge__" : 
                         edgeId.StartsWith("reactflow__edge-") ? "reactflow__edge-" : "";
            
            if (string.IsNullOrEmpty(prefix))
            {
                WriteLog($"❌ 無法識別邊 ID 前綴");
                return null;
            }
            
            var afterPrefix = edgeId.Substring(prefix.Length);
            
            // 查找 source 和 target 的位置
            var sourceMarkerIndex = afterPrefix.IndexOf("-source-");
            if (sourceMarkerIndex < 0)
            {
                WriteLog($"❌ 找不到 -source- 標記");
                return null;
            }
            
            // 提取 source 節點（去除 handle 後綴）
            var sourceWithHandle = afterPrefix.Substring(0, sourceMarkerIndex);
            var sourceNodeId = RemoveHandleSuffix(sourceWithHandle);
            
            // 提取 target 節點（在 -source- 之後，在 -target 之前）
            var afterSource = afterPrefix.Substring(sourceMarkerIndex + 8); // 跳過 "-source-"
            var targetMarkerIndex = afterSource.IndexOf("-target");
            if (targetMarkerIndex < 0)
            {
                WriteLog($"❌ 找不到 -target 標記");
                return null;
            }
            
            var targetWithHandle = afterSource.Substring(0, targetMarkerIndex);
            var targetNodeId = RemoveHandleSuffix(targetWithHandle);
            
            WriteLog($"📍 Source 節點: {sourceNodeId}");
            WriteLog($"📍 Target 節點: {targetNodeId}");
            
            // 判斷當前節點在邊的哪一端，返回另一端的節點
            if (currentNodeId == sourceNodeId)
            {
                WriteLog($"✅ 當前節點在 source 端，目標是: {targetNodeId}");
                return targetNodeId;
            }
            else if (currentNodeId == targetNodeId)
            {
                WriteLog($"✅ 當前節點在 target 端（反向邊），目標是: {sourceNodeId}");
                return sourceNodeId;
            }
            else
            {
                WriteLog($"⚠️ 當前節點 {currentNodeId} 不在邊的任何一端，默認返回 target: {targetNodeId}");
                return targetNodeId;
            }
        }
        
        // 移除 handle 後綴（top, bottom, left, right）
        private string RemoveHandleSuffix(string nodeIdWithHandle)
        {
            var suffixes = new[] { "top", "bottom", "left", "right" };
            foreach (var suffix in suffixes)
            {
                if (nodeIdWithHandle.EndsWith(suffix))
                {
                    return nodeIdWithHandle.Substring(0, nodeIdWithHandle.Length - suffix.Length);
                }
            }
            return nodeIdWithHandle;
        }
        
        // 從路徑中提取目標節點 ID
        private string GetTargetNodeIdFromPath(string path, Dictionary<string, List<string>> adjacencyList)
        {
            // 路徑格式可能是:
            // 1. "reactflow__edge-switch_xxxbottom-source-sendWhatsApp_xxxtop-target"
            // 2. "xy-edge__switch_xxxbottom-source-sendWhatsApp_xxxtop-target"
            // 3. "xy-edge__waitReply_xxxtop-source-switch_xxxbottom-target" (反向邊)
            
            if (string.IsNullOrEmpty(path))
                return null;
            
            WriteLog($"🔍 [DEBUG] 解析路徑: {path}");
                
            // 嘗試多種格式提取節點 ID
            
            // 格式 1: "source-" 和 "top-target" 之間
            var sourceIndex = path.IndexOf("source-");
            var topTargetIndex = path.IndexOf("top-target");
            
            if (sourceIndex >= 0 && topTargetIndex > sourceIndex)
            {
                var nodeId = path.Substring(sourceIndex + 7, topTargetIndex - sourceIndex - 7);
                WriteLog($"✅ 從路徑提取節點 ID (格式1): {nodeId}");
                return nodeId;
            }
            
            // 格式 2: "source-" 和 "bottom-target" 之間
            var bottomTargetIndex = path.IndexOf("bottom-target");
            if (sourceIndex >= 0 && bottomTargetIndex > sourceIndex)
            {
                var nodeId = path.Substring(sourceIndex + 7, bottomTargetIndex - sourceIndex - 7);
                WriteLog($"✅ 從路徑提取節點 ID (格式2): {nodeId}");
                return nodeId;
            }
            
            // 格式 3: "source-" 和 "right-target" 之間
            var rightTargetIndex = path.IndexOf("right-target");
            if (sourceIndex >= 0 && rightTargetIndex > sourceIndex)
            {
                var nodeId = path.Substring(sourceIndex + 7, rightTargetIndex - sourceIndex - 7);
                WriteLog($"✅ 從路徑提取節點 ID (格式3): {nodeId}");
                return nodeId;
            }
            
            // 格式 4: 反向邊 - 從邊 ID 的開頭部分提取（xy-edge__{nodeId}top-source-...）
            if (path.StartsWith("xy-edge__") || path.StartsWith("reactflow__edge-"))
            {
                var prefix = path.StartsWith("xy-edge__") ? "xy-edge__" : "reactflow__edge-";
                var remaining = path.Substring(prefix.Length);
                
                // 查找第一個 "source" 或 "target" 關鍵字之前的部分
                var keywords = new[] { "top-source", "bottom-source", "left-source", "right-source", 
                                      "top-target", "bottom-target", "left-target", "right-target" };
                
                foreach (var keyword in keywords)
                {
                    var keywordIndex = remaining.IndexOf(keyword);
                    if (keywordIndex > 0)
                    {
                        var possibleNodeId = remaining.Substring(0, keywordIndex);
                        WriteLog($"✅ 從路徑提取節點 ID (格式4-反向邊): {possibleNodeId}");
                        return possibleNodeId;
                    }
                }
            }
            
            WriteLog($"❌ 無法從路徑 {path} 提取節點 ID");
            return null;
        }
        
        // 執行 Switch 節點的後續節點（根據條件結果選擇性執行）
        private async Task ExecuteSwitchNextNodes(string currentNodeId, Dictionary<string, WorkflowNode> nodeMap, 
            Dictionary<string, List<string>> adjacencyList, WorkflowExecution execution, string userId, WorkflowStepExecution stepExec, List<WorkflowEdge> edges = null)
        {
            try
            {
                // 從 stepExec.OutputJson 中獲取 selectedPaths
                var outputData = JsonSerializer.Deserialize<Dictionary<string, object>>(stepExec.OutputJson ?? "{}");
                var selectedPaths = new List<string>();
                
                // 支持新的多路徑格式和向後兼容
                if (outputData?.ContainsKey("selectedPaths") == true)
                {
                    var pathsArray = outputData["selectedPaths"] as JsonElement?;
                    if (pathsArray?.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var path in pathsArray.Value.EnumerateArray())
                        {
                            if (path.ValueKind == JsonValueKind.String)
                            {
                                selectedPaths.Add(path.GetString() ?? "");
                            }
                        }
                    }
                }
                else if (outputData?.ContainsKey("selectedPath") == true)
                {
                    // 向後兼容單一路徑
                    var singlePath = outputData["selectedPath"]?.ToString();
                    if (!string.IsNullOrEmpty(singlePath))
                    {
                        selectedPaths.Add(singlePath);
                    }
                }
                
                WriteLog($"=== Switch 節點後續處理 ===");
                WriteLog($"選擇的路徑數量: {selectedPaths.Count}");
                WriteLog($"選擇的路徑: {string.Join(", ", selectedPaths)}");
                
                if (!selectedPaths.Any())
                {
                    WriteLog("沒有選擇路徑，跳過後續節點執行");
                    return;
                }
                
                // 並行執行所有選中的路徑
                var tasks = new List<Task>();
                foreach (var path in selectedPaths)
                {
                    WriteLog($"🔍 處理選擇的路徑（邊 ID）: {path}");
                    
                    string targetNodeId = null;
                    
                    // ✅ 優先使用邊列表（最準確）
                    if (edges != null && edges.Any())
                    {
                        var edge = edges.FirstOrDefault(e => e.Id == path);
                        if (edge != null)
                        {
                            // 從邊的 source 和 target 屬性判斷目標節點
                            if (edge.Source == currentNodeId)
                            {
                                targetNodeId = edge.Target;
                                WriteLog($"✅ 從邊屬性找到目標節點 (source->target): {targetNodeId}");
                            }
                            else if (edge.Target == currentNodeId)
                            {
                                targetNodeId = edge.Source;
                                WriteLog($"✅ 從邊屬性找到目標節點 (target->source 反向): {targetNodeId}");
                            }
                            else
                            {
                                // 當前節點不在邊的任一端，默認使用 target
                                targetNodeId = edge.Target;
                                WriteLog($"⚠️ 當前節點 {currentNodeId} 不在邊的任何一端，默認使用 target: {targetNodeId}");
                            }
                        }
                        else
                        {
                            WriteLog($"⚠️ 在邊列表中找不到邊 ID: {path}");
                        }
                    }
                    
                    // 如果沒有邊列表或找不到邊，嘗試解析邊 ID
                    if (string.IsNullOrEmpty(targetNodeId))
                    {
                        WriteLog($"嘗試從邊 ID 解析目標節點...");
                        targetNodeId = ExtractTargetNodeFromEdge(path, currentNodeId);
                    }
                    
                    if (string.IsNullOrEmpty(targetNodeId))
                    {
                        WriteLog($"❌ 無法找到目標節點");
                        continue;
                    }
                    
                    WriteLog($"✅ 最終目標節點: {targetNodeId}");
                    
                    // 執行目標節點
                    if (nodeMap.ContainsKey(targetNodeId))
                    {
                        WriteLog($"開始執行目標節點: {targetNodeId}");
                        var task = ExecuteNodeWithBranches(targetNodeId, nodeMap, adjacencyList, execution, userId, edges);
                        tasks.Add(task);
                    }
                    else
                    {
                        WriteLog($"警告: 目標節點 {targetNodeId} 不存在於節點映射中");
                    }
                }
                
                // 等待所有選中的節點完成
                if (tasks.Any())
                {
                    WriteLog($"等待 {tasks.Count} 個選中的節點完成...");
                    await Task.WhenAll(tasks);
                    WriteLog($"所有選中的節點執行完成");
                }
            }
            catch (Exception ex)
            {
                WriteLog($"執行 Switch 後續節點時發生錯誤: {ex.Message}");
            }
        }

    // DataSet 查詢執行方法
    private async Task<bool> ExecuteDataSetQuery(WorkflowNodeData nodeData, WorkflowStepExecution stepExec, WorkflowExecution execution)
    {
        try
        {
            WriteLog($"執行 DataSet 查詢節點: {nodeData?.TaskName}");

            // 獲取節點配置
            var dataSetId = nodeData?.DataSetId;
            var operationType = nodeData?.OperationType ?? "SELECT";
            var queryConditionGroups = nodeData?.QueryConditionGroups ?? new List<object>();
            var operationData = nodeData?.OperationData ?? new Dictionary<string, object>();
            var mappedFields = nodeData?.MappedFields ?? new List<object>();

            // 調試日誌：記錄原始查詢條件
            WriteLog($"原始查詢條件組數量: {queryConditionGroups.Count}");
            foreach (var group in queryConditionGroups)
            {
                WriteLog($"查詢條件組: {JsonSerializer.Serialize(group)}");
            }

            if (string.IsNullOrEmpty(dataSetId))
            {
                WriteLog("DataSet ID 為空，跳過執行");
                stepExec.Status = "Skipped";
                stepExec.OutputJson = JsonSerializer.Serialize(new { message = "DataSet ID 未配置" });
                return true;
            }

            // 獲取當前流程變量值
            var processVariables = await GetCurrentProcessVariables(execution.Id);

            // 構建查詢請求
            var request = new Models.DTOs.DataSetQueryRequest
            {
                DataSetId = Guid.Parse(dataSetId),
                OperationType = operationType,
                ProcessVariableValues = processVariables
            };

            // 轉換查詢條件
            foreach (var groupObj in queryConditionGroups)
            {
                var groupJson = JsonSerializer.Serialize(groupObj);
                WriteLog($"轉換查詢條件組 JSON: {groupJson}");
                
                // 嘗試直接反序列化
                var group = JsonSerializer.Deserialize<Models.DTOs.QueryConditionGroup>(groupJson);
                if (group != null)
                {
                    WriteLog($"成功轉換查詢條件組，條件數量: {group.Conditions.Count}");
                    if (group.Conditions.Count > 0)
                    {
                        WriteLog($"第一個條件: FieldName={group.Conditions[0].FieldName}, Operator={group.Conditions[0].Operator}, Value={group.Conditions[0].Value}");
                    }
                    request.QueryConditionGroups.Add(group);
                }
                else
                {
                    WriteLog("查詢條件組轉換失敗，group 為 null");
                }
            }

            // 轉換欄位映射
            foreach (var mappingObj in mappedFields)
            {
                var mappingJson = JsonSerializer.Serialize(mappingObj);
                WriteLog($"轉換欄位映射 JSON: {mappingJson}");
                
                var mapping = JsonSerializer.Deserialize<Models.DTOs.FieldMapping>(mappingJson);
                if (mapping != null)
                {
                    WriteLog($"成功轉換欄位映射: {mapping.FieldName} → {mapping.VariableName}");
                    request.MappedFields.Add(mapping);
                }
                else
                {
                    WriteLog("欄位映射轉換失敗，mapping 為 null");
                }
            }

            // 執行查詢
            var result = await _dataSetQueryService.ExecuteDataSetQueryAsync(
                execution.Id,
                stepExec.Id,
                request
            );

            // 更新步驟執行狀態
            if (result.Success)
            {
                stepExec.Status = "Completed";
                stepExec.OutputJson = JsonSerializer.Serialize(new
                {
                    success = true,
                    message = result.Message,
                    totalCount = result.TotalCount,
                    queryResultId = result.QueryResultId,
                    dataSetName = result.DataSetName
                });
                WriteLog($"DataSet 查詢成功: {result.Message}");
            }
            else
            {
                stepExec.Status = "Failed";
                stepExec.OutputJson = JsonSerializer.Serialize(new
                {
                    success = false,
                    message = result.Message
                });
                WriteLog($"DataSet 查詢失敗: {result.Message}");
            }

            return result.Success;
        }
        catch (Exception ex)
        {
            WriteLog($"執行 DataSet 查詢節點時發生錯誤: {ex.Message}");
            stepExec.Status = "Error";
            stepExec.OutputJson = JsonSerializer.Serialize(new
            {
                success = false,
                message = ex.Message
            });
            return false;
        }
    }

    // 獲取當前流程變量值
    private async Task<Dictionary<string, object>> GetCurrentProcessVariables(int workflowExecutionId)
    {
        try
        {
            var variables = await _context.ProcessVariableValues
                .Where(pv => pv.WorkflowExecutionId == workflowExecutionId)
                .ToListAsync();

            var result = new Dictionary<string, object>();
            foreach (var variable in variables)
            {
                result[variable.VariableName] = variable.GetValue();
            }
            return result;
        }
        catch (Exception ex)
        {
            WriteLog($"獲取流程變量失敗: {ex.Message}");
            return new Dictionary<string, object>();
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
    
    [System.Text.Json.Serialization.JsonPropertyName("variables")]
    public Dictionary<string, string> Variables { get; set; }
    
    [System.Text.Json.Serialization.JsonPropertyName("replyType")]
    public string ReplyType { get; set; }
    
    [System.Text.Json.Serialization.JsonPropertyName("specifiedUsers")]
    public string SpecifiedUsers { get; set; }
    
    [System.Text.Json.Serialization.JsonPropertyName("recipientDetails")]
    public object RecipientDetails { get; set; }
    
    public WorkflowValidation Validation { get; set; }
    
    [System.Text.Json.Serialization.JsonPropertyName("sql")]
    public string Sql { get; set; }
    
    [System.Text.Json.Serialization.JsonPropertyName("url")]
    public string Url { get; set; }
    
    [System.Text.Json.Serialization.JsonPropertyName("formName")]
    public string FormName { get; set; }
    
    [System.Text.Json.Serialization.JsonPropertyName("formId")]
    public string FormId { get; set; }
    
    // Switch 節點相關屬性
    [System.Text.Json.Serialization.JsonPropertyName("conditionGroups")]
    public List<SwitchConditionGroup> ConditionGroups { get; set; }
    
    [System.Text.Json.Serialization.JsonPropertyName("defaultPath")]
    public string DefaultPath { get; set; }
    
    // QR Code 節點相關屬性
    [System.Text.Json.Serialization.JsonPropertyName("qrCodeVariable")]
    public string QrCodeVariable { get; set; }
    
    [System.Text.Json.Serialization.JsonPropertyName("timeout")]
    public int? Timeout { get; set; }
    
    [System.Text.Json.Serialization.JsonPropertyName("qrCodeSuccessMessage")]
    public string QrCodeSuccessMessage { get; set; }
    
    [System.Text.Json.Serialization.JsonPropertyName("qrCodeErrorMessage")]
    public string QrCodeErrorMessage { get; set; }
    
    // e-Form 節點相關屬性
    [System.Text.Json.Serialization.JsonPropertyName("approvalResultVariable")]
    public string ApprovalResultVariable { get; set; }
    
    // 通用 JSON 數據存儲
    [System.Text.Json.Serialization.JsonPropertyName("json")]
    public string Json { get; set; }
    
    // DataSet 查詢節點相關屬性
    [System.Text.Json.Serialization.JsonPropertyName("dataSetId")]
    public string DataSetId { get; set; }
    
    [System.Text.Json.Serialization.JsonPropertyName("operationType")]
    public string OperationType { get; set; }
    
    [System.Text.Json.Serialization.JsonPropertyName("queryConditionGroups")]
    public List<object> QueryConditionGroups { get; set; }
    
    [System.Text.Json.Serialization.JsonPropertyName("operationData")]
    public Dictionary<string, object> OperationData { get; set; }
    
    [System.Text.Json.Serialization.JsonPropertyName("mappedFields")]
    public List<object> MappedFields { get; set; }
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
    
    // 新增屬性以支持新的 workflow designer
    [System.Text.Json.Serialization.JsonPropertyName("sourceHandle")]
    public string SourceHandle { get; set; }
    
    [System.Text.Json.Serialization.JsonPropertyName("targetHandle")]
    public string TargetHandle { get; set; }
    
    [System.Text.Json.Serialization.JsonPropertyName("markerEnd")]
    public object MarkerEnd { get; set; }
    
    [System.Text.Json.Serialization.JsonPropertyName("data")]
    public Dictionary<string, object> Data { get; set; }
    
    [System.Text.Json.Serialization.JsonPropertyName("style")]
    public Dictionary<string, object> Style { get; set; }
    
    [System.Text.Json.Serialization.JsonPropertyName("animated")]
    public bool? Animated { get; set; }
}

public class WorkflowValidation
{
    public bool Enabled { get; set; }
    public string ValidatorType { get; set; }
    public string Prompt { get; set; }
    public string RetryMessage { get; set; }
    public int MaxRetries { get; set; }
}

}

// 工作流程執行結果模型
public class WorkflowExecutionResult
{
    public string? Status { get; set; }
    public object? OutputData { get; set; }
} 
