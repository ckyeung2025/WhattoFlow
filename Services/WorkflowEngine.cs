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
using System.Web;

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
        private readonly IEFormTokenService _eFormTokenService;

        public WorkflowEngine(IServiceProvider serviceProvider, WhatsAppWorkflowService whatsAppWorkflowService, 
            Func<string, LoggingService> loggingServiceFactory, IConfiguration configuration, EFormService eFormService, ISwitchConditionService switchConditionService, UserSessionService userSessionService, DataSetQueryService dataSetQueryService, IVariableReplacementService variableReplacementService, PurpleRiceDbContext context, RecipientResolverService recipientResolverService, IEFormTokenService eFormTokenService)
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
            _eFormTokenService = eFormTokenService;
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

            // 創建包含節點 ID 的完整輸入數據
            var inputData = new
            {
                Id = nodeId,  // 添加節點 ID
                NodeId = nodeId,  // 添加節點 ID 的別名
                Type = nodeData?.Type,
                TaskName = nodeData?.TaskName,
                Data = nodeData
            };
            
            // 處理 Validation 配置的欄位名稱轉換
            string validationConfigJson = null;
            if (nodeData?.Validation != null)
            {
                var validation = nodeData.Validation;
                
                // 處理 RetryMessageConfig 的 IsMetaTemplate 邏輯
                var retryMessageConfig = validation.RetryMessageConfig;
                if (retryMessageConfig != null && !string.IsNullOrEmpty(retryMessageConfig.TemplateId))
                {
                    // 判斷是否為 Meta 模板：如果 TemplateId 是純數字，則可能是 Meta 模板
                    retryMessageConfig.IsMetaTemplate = TemplateHelper.IsMetaTemplateId(retryMessageConfig.TemplateId);
                }
                
                // 處理 EscalationConfig 的 IsMetaTemplate 邏輯
                var escalationConfig = validation.EscalationConfig;
                if (escalationConfig != null && !string.IsNullOrEmpty(escalationConfig.TemplateId))
                {
                    // 判斷是否為 Meta 模板：如果 TemplateId 是純數字，則可能是 Meta 模板
                    escalationConfig.IsMetaTemplate = TemplateHelper.IsMetaTemplateId(escalationConfig.TemplateId);
                }
                
                // 創建標準化的 ValidationConfig 對象
                var standardValidationConfig = new ValidationConfig
                {
                    Enabled = validation.Enabled,
                    ValidatorType = validation.ValidatorType,
                    RetryIntervalDays = validation.RetryIntervalDays,
                    RetryIntervalHours = validation.RetryIntervalHours,
                    RetryIntervalMinutes = validation.RetryIntervalMinutes ?? 
                        (int.TryParse(validation.RetryInterval, out var retryInterval) ? retryInterval : 10), // 預設 10 分鐘
                    RetryLimit = validation.RetryLimitValue ?? 
                        (int.TryParse(validation.RetryLimitFromUI, out var retryLimit) ? retryLimit : 5), // 預設 5 次重試
                    RetryMessageConfig = retryMessageConfig,
                    EscalationConfig = escalationConfig
                };
                
                validationConfigJson = JsonSerializer.Serialize(standardValidationConfig);
            }
            
            var stepExec = new WorkflowStepExecution
            {
                WorkflowExecutionId = execution.Id,
                StepIndex = execution.CurrentStep ?? 0,
                StepType = nodeData?.Type,
                TaskName = nodeData?.TaskName, // 保存用戶自定義的任務名稱
                Status = "Running",
                InputJson = JsonSerializer.Serialize(inputData),
                ValidationConfig = validationConfigJson, // 保存標準化的 Validation 配置
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

        // 執行 sendWhatsApp 節點（合併直接訊息和模板功能）
        private async Task<bool> ExecuteSendWhatsApp(WorkflowNodeData nodeData, WorkflowStepExecution stepExec, WorkflowExecution execution)
        {
            WriteLog($"=== 執行 sendWhatsApp 節點 ===");
            WriteLog($"收件人: {nodeData.To}");
            WriteLog($"訊息模式: {nodeData.MessageMode ?? "direct"}");
            WriteLog($"收件人詳情: {nodeData.RecipientDetails}");
            WriteLog($"🔍 [DEBUG] RecipientDetails 是否為 null: {nodeData.RecipientDetails == null}");
            WriteLog($"🔍 [DEBUG] RecipientDetails 類型: {nodeData.RecipientDetails?.GetType().Name ?? "null"}");
            
            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<PurpleRiceDbContext>();
            
            try
            {
                WriteLog($"🔍 [DEBUG] 開始解析收件人");
                // 使用 RecipientResolverService 解析收件人
                var resolvedRecipients = await _recipientResolverService.ResolveRecipientsAsync(
                    nodeData.To, 
                    nodeData.RecipientDetails != null ? JsonSerializer.Serialize(nodeData.RecipientDetails) : null, 
                    execution.Id,
                    execution.WorkflowDefinition.CompanyId
                );
                
                WriteLog($"🔍 [DEBUG] 解析到 {resolvedRecipients.Count} 個收件人");
                
                // 檢查訊息模式：'direct' 直接訊息或 'template' 使用模板
                string messageMode = nodeData.MessageMode ?? "direct"; // 默認為直接訊息模式
                
                if (messageMode == "template")
                {
                    // === 模板模式 ===
                    WriteLog($"📝 使用模板模式");
                    WriteLog($"模板ID: {nodeData.TemplateId}");
                    WriteLog($"模板名稱: {nodeData.TemplateName}");
                    
                    if (string.IsNullOrEmpty(nodeData.TemplateName))
                    {
                        WriteLog($"sendWhatsApp (模板模式) 缺少必要參數: templateName");
                        stepExec.OutputJson = JsonSerializer.Serialize(new { error = "Missing required parameter: templateName" });
                        return false;
                    }
                    
                    WriteLog($"🔍 [DEBUG] 開始處理模板變數替換");
                    // 優先使用新的模板變數配置，如果沒有則使用舊的 variables
                    Dictionary<string, string> processedVariables;
                    
                    if (nodeData.TemplateVariables != null && nodeData.TemplateVariables.Any())
                    {
                        WriteLog($"🔍 [DEBUG] 使用新的模板變數配置");
                        processedVariables = await ProcessTemplateVariableConfigAsync(nodeData.TemplateVariables, execution.Id, db);
                    }
                    else
                    {
                        WriteLog($"🔍 [DEBUG] 使用舊的模板變數配置");
                        processedVariables = await ProcessTemplateVariablesAsync(nodeData.Variables, execution.Id);
                    }
                    
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
                        "sendWhatsApp", // 統一使用 sendWhatsApp
                        db,
                        nodeData.IsMetaTemplate,  // 傳遞 Meta 模板標記
                        nodeData.TemplateLanguage  // 傳遞模板語言代碼
                    );
                    
                    WriteLog($"🔍 [DEBUG] 模板消息發送記錄創建完成，ID: {messageSendId}");
                    WriteLog($"🔍 [DEBUG] 模板消息發送完成，收件人數量: {resolvedRecipients.Count}");
                    
                    stepExec.OutputJson = JsonSerializer.Serialize(new { 
                        success = true, 
                        message = "WhatsApp template messages sent successfully",
                        recipientCount = resolvedRecipients.Count,
                        templateName = nodeData.TemplateName,
                        taskName = nodeData.TaskName,
                        messageSendId = messageSendId
                    });
                    
                    return true;
                }
                else
                {
                    // === 直接訊息模式 ===
                    WriteLog($"💬 使用直接訊息模式");
                    WriteLog($"消息內容: {nodeData.Message}");
                    
                    if (string.IsNullOrEmpty(nodeData.Message))
                    {
                        WriteLog($"sendWhatsApp (直接訊息模式) 缺少必要參數: message");
                        stepExec.OutputJson = JsonSerializer.Serialize(new { error = "Missing required parameter: message" });
                        return false;
                    }
                    
                    WriteLog($"🔍 [DEBUG] 開始處理變數替換");
                    // 替換訊息內容中的變數
                    var processedMessage = await _variableReplacementService.ReplaceVariablesAsync(nodeData.Message, execution.Id);
                    WriteLog($"🔍 [DEBUG] 原始訊息: {nodeData.Message}");
                    WriteLog($"🔍 [DEBUG] 處理後訊息: {processedMessage}");
                    
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
                    // 使用共用方法處理模板變數
                    Dictionary<string, string> processedVariables;
                    if (nodeData.TemplateVariables != null && nodeData.TemplateVariables.Any())
                    {
                        WriteLog($"🔍 [DEBUG] 使用新的模板變數配置");
                        processedVariables = await ProcessTemplateVariableConfigAsync(nodeData.TemplateVariables, execution.Id, db);
                    }
                    else
                    {
                        WriteLog($"🔍 [DEBUG] 使用舊的模板變數配置");
                        processedVariables = await ProcessTemplateVariablesAsync(nodeData.Variables, execution.Id);
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
                        db,
                        nodeData.IsMetaTemplate,  // 傳遞 Meta 模板標記
                        nodeData.TemplateLanguage  // 傳遞模板語言代碼
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
            
            // ✅ 修復：先解析收件人，然後設置正確的 WaitingForUser
            string actualWaitingUser = userId ?? "85296366318"; // 默認值
            
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
                    actualWaitingUser = userId ?? "85296366318"; // 使用流程啟動人
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
                
                // ✅ 修復：如果解析到收件人，使用第一個收件人作為 WaitingForUser
                if (resolvedRecipients.Count > 0)
                {
                    actualWaitingUser = resolvedRecipients.First().PhoneNumber;
                    WriteLog($"🔍 [DEBUG] 設置 WaitingForUser 為解析到的收件人: {actualWaitingUser}");
                }
                else
                {
                    WriteLog($"⚠️ [WARNING] 沒有解析到收件人，使用默認值: {actualWaitingUser}");
                }
            }
            
            // 設置等待狀態
            execution.Status = "Waiting";
            execution.IsWaiting = true;
            execution.WaitingSince = DateTime.Now;
            execution.WaitingForUser = actualWaitingUser; // ✅ 使用解析到的收件人
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
            
            // 發送提示消息（支持直接訊息和模板）
            string messageMode = nodeData.MessageMode ?? "direct";
            bool shouldSendMessage = (messageMode == "direct" && !string.IsNullOrEmpty(nodeData.Message)) ||
                                    (messageMode == "template" && !string.IsNullOrEmpty(nodeData.TemplateName));
            
            if (shouldSendMessage && company != null)
            {
                WriteLog($"🔍 [DEBUG] messageMode: {messageMode}");
                
                // 獲取收件人信息（已經在前面解析過了）
                string recipientValue;
                string recipientDetailsJson;
                
                if (nodeData.ReplyType == "initiator")
                {
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
                }
                else
                {
                    recipientValue = nodeData.SpecifiedUsers ?? "";
                    recipientDetailsJson = nodeData.RecipientDetails != null ? JsonSerializer.Serialize(nodeData.RecipientDetails) : null;
                }
                
                // 根據訊息模式發送
                if (messageMode == "template")
                {
                    WriteLog($"📝 waitReply 使用模板模式");
                    
                    // 使用共用方法處理模板變數
                    Dictionary<string, string> processedVariables;
                    if (nodeData.TemplateVariables != null && nodeData.TemplateVariables.Any())
                    {
                        WriteLog($"🔍 [DEBUG] waitReply 使用新的模板變數配置");
                        processedVariables = await ProcessTemplateVariableConfigAsync(nodeData.TemplateVariables, execution.Id, db);
                    }
                    else
                    {
                        WriteLog($"🔍 [DEBUG] waitReply 使用舊的模板變數配置");
                        processedVariables = await ProcessTemplateVariablesAsync(nodeData.Variables, execution.Id);
                    }
                    
                    // 發送模板訊息
                    var messageSendId = await _whatsAppWorkflowService.SendWhatsAppTemplateMessageWithTrackingAsync(
                        recipientValue,
                        recipientDetailsJson,
                        nodeData.TemplateId,
                        nodeData.TemplateName,
                        processedVariables,
                        execution,
                        stepExec,
                        stepExec.Id.ToString(),
                        "waitReply",
                        db,
                        nodeData.IsMetaTemplate,  // 傳遞 Meta 模板標記
                        nodeData.TemplateLanguage  // 傳遞模板語言代碼
                    );
                    
                    WriteLog($"🔍 [DEBUG] 等待提示模板訊息發送完成，ID: {messageSendId}");
                }
                else
                {
                    WriteLog($"💬 waitReply 使用直接訊息模式");
                    
                    // 發送直接訊息
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
            
            // ✅ 修復：先解析收件人，然後設置正確的 WaitingForUser
            string actualWaitingUser = userId ?? "85296366318"; // 默認值
            
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
                    actualWaitingUser = userId ?? "85296366318"; // 使用流程啟動人
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
                
                // ✅ 修復：如果解析到收件人，使用第一個收件人作為 WaitingForUser
                if (resolvedRecipients.Count > 0)
                {
                    actualWaitingUser = resolvedRecipients.First().PhoneNumber;
                    WriteLog($"🔍 [DEBUG] 設置 WaitingForUser 為解析到的收件人: {actualWaitingUser}");
                }
                else
                {
                    WriteLog($"⚠️ [WARNING] 沒有解析到收件人，使用默認值: {actualWaitingUser}");
                }
            }
            
            // 設置等待狀態
            execution.Status = "WaitingForQRCode";
            execution.IsWaiting = true;
            execution.WaitingSince = DateTime.Now;
            execution.WaitingForUser = actualWaitingUser; // ✅ 使用解析到的收件人
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
            
            // 發送提示消息（支持直接訊息和模板）
            string messageMode = nodeData.MessageMode ?? "direct";
            bool shouldSendMessage = (messageMode == "direct" && !string.IsNullOrEmpty(nodeData.Message)) ||
                                    (messageMode == "template" && !string.IsNullOrEmpty(nodeData.TemplateName));
            
            if (shouldSendMessage && company != null)
            {
                WriteLog($"🔍 [DEBUG] messageMode: {messageMode}");
                
                // 獲取收件人信息（已經在前面解析過了）
                string recipientValue;
                string recipientDetailsJson;
                
                if (nodeData.ReplyType == "initiator")
                {
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
                }
                else
                {
                    recipientValue = nodeData.SpecifiedUsers ?? "";
                    recipientDetailsJson = nodeData.RecipientDetails != null ? JsonSerializer.Serialize(nodeData.RecipientDetails) : null;
                }
                
                // 根據訊息模式發送
                if (messageMode == "template")
                {
                    WriteLog($"📝 waitForQRCode 使用模板模式");
                    
                    // 使用共用方法處理模板變數
                    Dictionary<string, string> processedVariables;
                    if (nodeData.TemplateVariables != null && nodeData.TemplateVariables.Any())
                    {
                        WriteLog($"🔍 [DEBUG] waitForQRCode 使用新的模板變數配置");
                        processedVariables = await ProcessTemplateVariableConfigAsync(nodeData.TemplateVariables, execution.Id, db);
                    }
                    else
                    {
                        WriteLog($"🔍 [DEBUG] waitForQRCode 使用舊的模板變數配置");
                        processedVariables = await ProcessTemplateVariablesAsync(nodeData.Variables, execution.Id);
                    }
                    
                    // 發送模板訊息
                    var messageSendId = await _whatsAppWorkflowService.SendWhatsAppTemplateMessageWithTrackingAsync(
                        recipientValue,
                        recipientDetailsJson,
                        nodeData.TemplateId,
                        nodeData.TemplateName,
                        processedVariables,
                        execution,
                        stepExec,
                        stepExec.Id.ToString(),
                        "waitForQRCode",
                        db,
                        nodeData.IsMetaTemplate,  // 傳遞 Meta 模板標記
                        nodeData.TemplateLanguage  // 傳遞模板語言代碼
                    );
                    
                    WriteLog($"🔍 [DEBUG] QR Code 等待提示模板訊息發送完成，ID: {messageSendId}");
                }
                else
                {
                    WriteLog($"💬 waitForQRCode 使用直接訊息模式");
                    
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
                }
            }
            
            WriteLog($"QR Code 等待節點設置完成，流程暫停等待 QR Code 上傳");
            return false; // 返回 false 表示暫停執行
        }

        // 使用 DataSet Query 結果填充表單
        private async Task<string> FillFormWithDataSetQueryResults(string originalHtml, string queryResult)
        {
            try
            {
                WriteLog($"🔍 [DEBUG] 開始填充表單，查詢結果: {queryResult}");
                
                // 解析查詢結果 JSON - 修正：應該是數組格式
                var resultDataArray = JsonSerializer.Deserialize<List<Dictionary<string, object>>>(queryResult);
                if (resultDataArray == null || resultDataArray.Count == 0)
                {
                    WriteLog($"⚠️ [WARNING] 無法解析 DataSet Query 結果或結果為空: {queryResult}");
                    return originalHtml;
                }

                // 使用第一條記錄來填充表單
                var resultData = resultDataArray.First();
                WriteLog($"🔍 [DEBUG] 使用第一條記錄填充表單，包含 {resultData.Count} 個欄位");
                
                string filledHtml = originalHtml;
                int fieldsProcessed = 0;
                
                // 動態映射策略：
                // 1. 首先嘗試精確匹配（欄位名稱完全相同）
                // 2. 然後嘗試忽略大小寫匹配
                // 3. 最後嘗試模糊匹配（包含關係）
                WriteLog($"🔍 [DEBUG] 開始動態欄位映射，DataSet 欄位數量: {resultData.Count}");
                
                // 從 HTML 中提取所有可用的表單欄位名稱
                var availableFormFields = ExtractFormFieldNames(originalHtml);
                WriteLog($"🔍 [DEBUG] 表單中可用的欄位: {string.Join(", ", availableFormFields)}");
                
                // 遍歷查詢結果，動態匹配表單欄位
                foreach (var kvp in resultData)
                {
                    var sourceFieldName = kvp.Key;
                    var fieldValue = kvp.Value?.ToString() ?? "";
                    
                    // 跳過系統內部欄位
                    if (sourceFieldName.StartsWith("__"))
                    {
                        WriteLog($"🔍 [DEBUG] 跳過系統欄位: {sourceFieldName}");
                        continue;
                    }
                    
                    // 動態查找對應的表單欄位名稱
                    var targetFieldName = FindMatchingFormField(sourceFieldName, availableFormFields);
                    
                    if (!string.IsNullOrEmpty(targetFieldName))
                    {
                        WriteLog($"🔍 [DEBUG] 動態映射成功: {sourceFieldName} -> {targetFieldName} = {fieldValue}");
                        
                        // 處理日期格式轉換
                        var processedValue = fieldValue;
                        if (IsDateField(targetFieldName) && !string.IsNullOrEmpty(fieldValue))
                        {
                            // 檢查 HTML 中是否有 datetime-local 類型的欄位
                            if (originalHtml.Contains($"type=\"datetime-local\"") && originalHtml.Contains($"name=\"{targetFieldName}\""))
                            {
                                processedValue = ConvertToFormDateTime(fieldValue);
                                WriteLog($"🔍 [DEBUG] 日期時間格式轉換: {fieldValue} -> {processedValue}");
                            }
                            else
                            {
                                processedValue = ConvertToFormDate(fieldValue);
                                WriteLog($"🔍 [DEBUG] 日期格式轉換: {fieldValue} -> {processedValue}");
                            }
                        }
                        
                        // 處理不同類型的輸入欄位
                        filledHtml = FillFormField(filledHtml, targetFieldName, processedValue);
                        fieldsProcessed++;
                    }
                    else
                    {
                        WriteLog($"🔍 [DEBUG] 跳過無法映射的欄位: {sourceFieldName} = {fieldValue}");
                    }
                }

                WriteLog($"🔍 [DEBUG] DataSet Query 結果填充完成，處理了 {fieldsProcessed} 個欄位");
                WriteLog($"🔍 [DEBUG] 填充前 HTML 長度: {originalHtml?.Length ?? 0}");
                WriteLog($"🔍 [DEBUG] 填充後 HTML 長度: {filledHtml?.Length ?? 0}");
                WriteLog($"🔍 [DEBUG] HTML 是否發生變化: {filledHtml != originalHtml}");
                
                return filledHtml;
            }
            catch (Exception ex)
            {
                WriteLog($"❌ [ERROR] 填充表單時發生錯誤: {ex.Message}");
                WriteLog($"❌ [ERROR] 錯誤堆疊: {ex.StackTrace}");
                return originalHtml;
            }
        }

        // 從 HTML 中提取所有表單欄位名稱
        private List<string> ExtractFormFieldNames(string html)
        {
            var fieldNames = new List<string>();
            
            try
            {
                // 使用正則表達式提取所有 name 屬性
                var pattern = @"name\s*=\s*[""']([^""']+)[""']";
                var matches = System.Text.RegularExpressions.Regex.Matches(html, pattern, System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                
                foreach (System.Text.RegularExpressions.Match match in matches)
                {
                    if (match.Groups.Count > 1)
                    {
                        var fieldName = match.Groups[1].Value.Trim();
                        if (!string.IsNullOrEmpty(fieldName) && !fieldNames.Contains(fieldName))
                        {
                            fieldNames.Add(fieldName);
                        }
                    }
                }
                
                WriteLog($"🔍 [DEBUG] 從 HTML 中提取到 {fieldNames.Count} 個欄位名稱");
            }
            catch (Exception ex)
            {
                WriteLog($"⚠️ [WARNING] 提取表單欄位名稱時發生錯誤: {ex.Message}");
            }
            
            return fieldNames;
        }
        
        // 簡化的欄位匹配 - 直接精確匹配
        private string FindMatchingFormField(string sourceFieldName, List<string> availableFormFields)
        {
            if (string.IsNullOrEmpty(sourceFieldName) || availableFormFields == null || availableFormFields.Count == 0)
                return null;
                
            // 直接精確匹配（忽略大小寫）
            var exactMatch = availableFormFields.FirstOrDefault(f => 
                string.Equals(f, sourceFieldName, StringComparison.OrdinalIgnoreCase));
                
            if (exactMatch != null)
            {
                WriteLog($"🔍 [DEBUG] 精確匹配成功: {sourceFieldName} -> {exactMatch}");
                return exactMatch;
            }
            
            WriteLog($"🔍 [DEBUG] 無法找到匹配欄位: {sourceFieldName}");
            WriteLog($"🔍 [DEBUG] 可用欄位列表: {string.Join(", ", availableFormFields)}");
            return null;
        }
        
        // 計算字符串相似度（簡單的 Jaccard 相似度）
        private double CalculateSimilarity(string str1, string str2)
        {
            if (string.IsNullOrEmpty(str1) || string.IsNullOrEmpty(str2))
                return 0;
                
            var set1 = new HashSet<char>(str1);
            var set2 = new HashSet<char>(str2);
            
            var intersection = set1.Intersect(set2).Count();
            var union = set1.Union(set2).Count();
            
            return union > 0 ? (double)intersection / union : 0;
        }
        
        // 檢查是否為日期欄位
        private bool IsDateField(string fieldName)
        {
            var dateFields = new[] { "orderDate", "orderdate", "invoiceDate", "invoicedate", "invdate", "createDate", "create_date", "checkDate", "check_date" };
            return dateFields.Contains(fieldName, StringComparer.OrdinalIgnoreCase);
        }
        
        // 轉換日期格式
        private string ConvertToFormDate(string dateValue)
        {
            try
            {
                if (DateTime.TryParse(dateValue, out DateTime date))
                {
                    // 轉換為 YYYY-MM-DD 格式（適用於 HTML date 輸入）
                    return date.ToString("yyyy-MM-dd");
                }
            }
            catch (Exception ex)
            {
                WriteLog($"⚠️ [WARNING] 日期格式轉換失敗: {dateValue}, 錯誤: {ex.Message}");
            }
            return dateValue; // 如果轉換失敗，返回原始值
        }
        
        // 轉換日期時間格式
        private string ConvertToFormDateTime(string dateValue)
        {
            try
            {
                if (DateTime.TryParse(dateValue, out DateTime date))
                {
                    // 轉換為 YYYY-MM-DDTHH:mm 格式（適用於 HTML datetime-local 輸入）
                    return date.ToString("yyyy-MM-ddTHH:mm");
                }
            }
            catch (Exception ex)
            {
                WriteLog($"⚠️ [WARNING] 日期時間格式轉換失敗: {dateValue}, 錯誤: {ex.Message}");
            }
            return dateValue; // 如果轉換失敗，返回原始值
        }
        
        // 完整的表單欄位填充方法 - 支持所有基本表單元素
        private string FillFormField(string html, string fieldName, string fieldValue)
        {
            try
            {
                // 轉義特殊字符
                var escapedValue = System.Security.SecurityElement.Escape(fieldValue);
                
                WriteLog($"🔍 [DEBUG] 嘗試填充欄位: {fieldName} = {fieldValue}");
                WriteLog($"🔍 [DEBUG] 轉義後的值: {escapedValue}");
                
                // 檢查 HTML 中是否存在該欄位
                var namePattern = $@"name\s*=\s*[""']?{fieldName}[""']?";
                var nameRegex = new System.Text.RegularExpressions.Regex(namePattern, System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                
                if (!nameRegex.IsMatch(html))
                {
                    WriteLog($"⚠️ [WARNING] HTML 中沒有找到 name=\"{fieldName}\" 的欄位");
                    return html;
                }
                
                WriteLog($"🔍 [DEBUG] 確認 HTML 中存在 name=\"{fieldName}\" 的欄位");
                
                // 定義多種表單元素的處理模式
                var patterns = new (string Element, string Pattern, string Replacement)[]
                {
                    // 1. Input 元素 (text, email, password, number, tel, url, search, hidden 等)
                    ("input", 
                     $@"(<input[^>]*name=""{fieldName}""[^>]*?)(?=\s*>)", 
                     $@"$1 value=""{escapedValue}"""),
                    
                    // 2. Textarea 元素
                    ("textarea", 
                     $@"(<textarea[^>]*name=""{fieldName}""[^>]*?>)(.*?)(</textarea>)", 
                     $@"$1{escapedValue}$3"),
                    
                    // 3. Radio 元素 - 設置選中狀態
                    ("radio", 
                     $@"(<input[^>]*name=""{fieldName}""[^>]*value=""{escapedValue}""[^>]*?)(?=\s*>)", 
                     $@"$1 checked"),
                    
                    // 4. Checkbox 元素 - 設置選中狀態
                    ("checkbox", 
                     $@"(<input[^>]*name=""{fieldName}""[^>]*value=""{escapedValue}""[^>]*?)(?=\s*>)", 
                     $@"$1 checked")
                };
                
                bool fieldProcessed = false;
                
                // 首先嘗試處理 Select 元素（需要特殊邏輯）
                var selectPattern = $@"(<select[^>]*name=""{fieldName}""[^>]*?>)(.*?)(</select>)";
                var selectRegex = new System.Text.RegularExpressions.Regex(selectPattern, System.Text.RegularExpressions.RegexOptions.IgnoreCase | System.Text.RegularExpressions.RegexOptions.Singleline);
                
                if (selectRegex.IsMatch(html))
                {
                    WriteLog($"🔍 [DEBUG] 找到 select 元素，欄位: {fieldName}");
                    var beforeReplace = html;
                    html = selectRegex.Replace(html, match =>
                    {
                        var selectContent = match.Groups[2].Value;
                        WriteLog($"🔍 [DEBUG] Select 內容: {selectContent.Substring(0, Math.Min(200, selectContent.Length))}...");
                        // 在 select 內部找到對應的 option 並設置 selected
                        var updatedContent = System.Text.RegularExpressions.Regex.Replace(selectContent, 
                            $@"(<option[^>]*value=""{escapedValue}""[^>]*?)(?=\s*>)", 
                            "$1 selected", 
                            System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                        return match.Value.Replace(selectContent, updatedContent);
                    });
                    
                    var afterReplace = html;
                    WriteLog($"🔍 [DEBUG] 成功填充 select 欄位: {fieldName}");
                    WriteLog($"🔍 [DEBUG] 替換前長度: {beforeReplace.Length}, 替換後長度: {afterReplace.Length}");
                    fieldProcessed = true;
                }
                
                // 嘗試其他元素類型
                if (!fieldProcessed)
                {
                    foreach (var (element, pattern, replacement) in patterns)
                    {
                        WriteLog($"🔍 [DEBUG] 嘗試 {element} 模式，正則: {pattern}");
                        var regex = new System.Text.RegularExpressions.Regex(pattern, System.Text.RegularExpressions.RegexOptions.IgnoreCase | System.Text.RegularExpressions.RegexOptions.Singleline);
                        
                        if (regex.IsMatch(html))
                        {
                            WriteLog($"🔍 [DEBUG] 匹配到 {element} 模式");
                            var beforeReplace = html;
                            html = regex.Replace(html, replacement);
                            var afterReplace = html;
                            
                            WriteLog($"🔍 [DEBUG] 成功填充 {element} 欄位: {fieldName}");
                            WriteLog($"🔍 [DEBUG] 替換前長度: {beforeReplace.Length}, 替換後長度: {afterReplace.Length}");
                            WriteLog($"🔍 [DEBUG] HTML 是否發生變化: {beforeReplace != afterReplace}");
                            
                            // 輸出替換前後的片段進行對比
                            var beforeFragment = GetFieldFragment(beforeReplace, fieldName);
                            var afterFragment = GetFieldFragment(afterReplace, fieldName);
                            WriteLog($"🔍 [DEBUG] 替換前片段: {beforeFragment}");
                            WriteLog($"🔍 [DEBUG] 替換後片段: {afterFragment}");
                            
                            fieldProcessed = true;
                            break; // 找到匹配的元素類型後停止
                        }
                        else
                        {
                            WriteLog($"🔍 [DEBUG] 欄位 {fieldName} 不匹配 {element} 模式");
                        }
                    }
                }
                
                if (!fieldProcessed)
                {
                    WriteLog($"⚠️ [WARNING] 欄位 {fieldName} 沒有找到任何匹配的表單元素");
                    // 輸出該欄位周圍的 HTML 片段進行調試
                    var fieldFragment = GetFieldFragment(html, fieldName);
                    WriteLog($"🔍 [DEBUG] 欄位周圍的 HTML 片段: {fieldFragment}");
                }
                
                return html;
            }
            catch (Exception ex)
            {
                WriteLog($"❌ [ERROR] 填充欄位 {fieldName} 時發生錯誤: {ex.Message}");
                WriteLog($"❌ [ERROR] 錯誤堆疊: {ex.StackTrace}");
                return html;
            }
        }
        
        // 輔助方法：獲取欄位周圍的 HTML 片段
        private string GetFieldFragment(string html, string fieldName)
        {
            try
            {
                var pattern = $@".{{0,100}}name\s*=\s*[""']?{fieldName}[""']?[^>]*>.*?(?=<input|<textarea|<select|$)";
                var regex = new System.Text.RegularExpressions.Regex(pattern, System.Text.RegularExpressions.RegexOptions.IgnoreCase | System.Text.RegularExpressions.RegexOptions.Singleline);
                var match = regex.Match(html);
                return match.Success ? match.Value.Trim() : "未找到匹配片段";
            }
            catch (Exception ex)
            {
                return $"獲取片段時出錯: {ex.Message}";
            }
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

                    // 先解析收件人（所有模式都需要）
                    WriteLog($"🔍 [DEBUG] 開始解析收件人");
                    var resolvedRecipients = await _recipientResolverService.ResolveRecipientsAsync(
                        nodeData.To, 
                        nodeData.RecipientDetails != null ? JsonSerializer.Serialize(nodeData.RecipientDetails) : null, 
                        execution.Id,
                        execution.WorkflowDefinition.CompanyId
                    );
                    
                    WriteLog($"🔍 [DEBUG] 解析到 {resolvedRecipients.Count} 個收件人");
                    
                    var sendEFormMode = nodeData.SendEFormMode ?? "integrateWaitReply"; // 默認為整合等待用戶回覆模式
                    
                    if (sendEFormMode == "manualFill")
                    {
                        // === Manual Fill 模式：為每個收件人創建獨立的表單實例 ===
                        WriteLog($"🔍 [DEBUG] Manual Fill 模式，為每個收件人創建獨立表單");
                        
                        var parentInstanceId = Guid.NewGuid(); // 用於關聯同一批次的表單
                        var instanceIds = new List<Guid>();
                        
                        // 為每個收件人創建獨立的表單實例
                        foreach (var recipient in resolvedRecipients)
                        {
                            // 先創建實例 ID
                            var instanceId = Guid.NewGuid();
                            
                            // 使用實際的實例 ID 生成安全 Token
                            var accessToken = _eFormTokenService.GenerateAccessToken(instanceId, recipient.PhoneNumber);
                            
                            // 創建獨立的表單實例
                            var eFormInstance = new EFormInstance
                            {
                                Id = instanceId,
                                EFormDefinitionId = eFormDefinition.Id,
                                WorkflowExecutionId = execution.Id,
                                WorkflowStepExecutionId = execution.CurrentStep ?? 0,
                                CompanyId = company.Id,
                                InstanceName = $"{nodeData.FormName}_{recipient.RecipientName ?? recipient.PhoneNumber}_{DateTime.Now:yyyyMMddHHmmss}",
                                OriginalHtmlCode = eFormDefinition.HtmlCode,
                                FilledHtmlCode = null,  // Manual Fill 不預填
                                UserMessage = null,
                                Status = "Pending",
                                CreatedAt = DateTime.UtcNow,
                                UpdatedAt = DateTime.UtcNow,
                                
                                // 新增字段
                                FillType = "Manual",
                                RecipientWhatsAppNo = recipient.PhoneNumber,
                                RecipientName = recipient.RecipientName,
                                ParentInstanceId = parentInstanceId,
                                AccessToken = accessToken,
                                TokenExpiresAt = DateTime.UtcNow.AddDays(30)  // 30天有效期
                            };
                            
                            // 生成帶安全 Token 的表單 URL（需要 URL 編碼 Token）
                            var encodedToken = System.Web.HttpUtility.UrlEncode(accessToken);
                            var formUrl = $"/eform-instance/{eFormInstance.Id}?token={encodedToken}";
                            eFormInstance.FormUrl = formUrl;
                            
                            // 保存到數據庫
                            db.EFormInstances.Add(eFormInstance);
                            instanceIds.Add(eFormInstance.Id);
                            
                            WriteLog($"🔍 [DEBUG] 為收件人 {recipient.PhoneNumber} 創建表單實例: {eFormInstance.Id}");
                        }
                        
                        await db.SaveChangesAsync();
                        WriteLog($"🔍 [DEBUG] 已創建 {instanceIds.Count} 個表單實例");
                        
                        // 發送通知給每個收件人（每個人都收到自己的專屬 URL）
                        await SendFormNotificationsToRecipients(resolvedRecipients, instanceIds, nodeData, execution, stepExec, db);
                        
                        // 設置為等待表單審批狀態
                        execution.Status = "WaitingForFormApproval";
                        stepExec.Status = "Waiting";
                        stepExec.OutputJson = JsonSerializer.Serialize(new { 
                            success = true, 
                            message = "Manual Fill forms sent successfully, waiting for submissions",
                            instanceCount = instanceIds.Count,
                            parentInstanceId = parentInstanceId,
                            waitingSince = DateTime.Now 
                        });
                        
                        await SaveExecution(execution);
                        await SaveStepExecution(stepExec);
                        
                        WriteLog($"Manual Fill 表單節點設置為等待表單提交狀態");
                        return false; // 返回 false 表示暫停執行
                    }
                    else
                    {
                        // === AI Fill / Data Fill 模式：單一表單實例 ===
                        string filledHtmlCode = eFormDefinition.HtmlCode;
                        string userMessage = null;
                        
                        switch (sendEFormMode)
                        {
                            case "integrateWaitReply":
                                // 整合等待用戶回覆節點 (AI 自然語言填表)
                                var userMessages = await db.MessageValidations
                                    .Where(m => m.WorkflowExecutionId == execution.Id && m.IsValid)
                                    .OrderBy(m => m.CreatedAt)
                                    .ToListAsync();

                                if (userMessages.Any())
                                {
                                    var latestMessage = userMessages.Last();
                                    userMessage = latestMessage.UserMessage;
                                    filledHtmlCode = await _eFormService.FillFormWithAIAsync(eFormDefinition.HtmlCode, latestMessage.UserMessage);
                                }
                                WriteLog($"🔍 [DEBUG] 整合等待用戶回覆模式，用戶回覆數量: {userMessages.Count}");
                                break;
                                
                            case "integrateDataSetQuery":
                                // 整合 DataSet Query 節點 (結構化數據填表)
                                if (!string.IsNullOrEmpty(nodeData.IntegratedDataSetQueryNodeId))
                                {
                                    WriteLog($"🔍 [DEBUG] 查找指定的 DataSet Query 節點: {nodeData.IntegratedDataSetQueryNodeId}");
                                    
                                    // 先查看所有 DataSet Query 執行記錄
                                    var allDataSetSteps = await db.WorkflowStepExecutions
                                        .Where(s => s.WorkflowExecutionId == execution.Id && 
                                                   s.StepType == "dataSetQuery")
                                        .OrderByDescending(s => s.StartedAt)
                                        .ToListAsync();
                                    
                                    WriteLog($"🔍 [DEBUG] 找到 {allDataSetSteps.Count} 個 DataSet Query 執行記錄");
                                    
                                    foreach (var step in allDataSetSteps)
                                    {
                                        WriteLog($"🔍 [DEBUG] 檢查步驟 {step.Id}，InputJson 長度: {step.InputJson?.Length ?? 0}");
                                        WriteLog($"🔍 [DEBUG] 步驟 {step.Id} 的 InputJson 內容: {step.InputJson?.Substring(0, Math.Min(200, step.InputJson?.Length ?? 0))}...");
                                            
                                        try
                                        {
                                            var inputJson = JsonSerializer.Deserialize<JsonElement>(step.InputJson);
                                            
                                            string foundId = null;
                                            if (inputJson.TryGetProperty("Id", out var idElement))
                                            {
                                                foundId = idElement.GetString();
                                            }
                                            else if (inputJson.TryGetProperty("NodeId", out var nodeIdElement))
                                            {
                                                foundId = nodeIdElement.GetString();
                                            }
                                            else if (inputJson.TryGetProperty("id", out var idLowerElement))
                                            {
                                                foundId = idLowerElement.GetString();
                                            }
                                            
                                            WriteLog($"🔍 [DEBUG] 步驟 {step.Id} 找到的 ID: '{foundId}', 目標 ID: '{nodeData.IntegratedDataSetQueryNodeId}'");
                                        }
                                        catch (Exception ex)
                                        {
                                            WriteLog($"🔍 [DEBUG] 解析步驟 {step.Id} 的 InputJson 時出錯: {ex.Message}");
                                        }
                                    }
                                    
                                    // 查找指定 DataSet Query 節點的執行記錄
                                    // 使用精確匹配，避免部分字符串匹配
                                    var targetStepExecution = allDataSetSteps
                                        .Where(s => {
                                            try
                                            {
                                                var inputJson = JsonSerializer.Deserialize<JsonElement>(s.InputJson);
                                                
                                                string foundId = null;
                                                if (inputJson.TryGetProperty("Id", out var idElement))
                                                {
                                                    foundId = idElement.GetString();
                                                }
                                                else if (inputJson.TryGetProperty("NodeId", out var nodeIdElement))
                                                {
                                                    foundId = nodeIdElement.GetString();
                                                }
                                                
                                                return foundId == nodeData.IntegratedDataSetQueryNodeId;
                                            }
                                            catch
                                            {
                                                return false;
                                            }
                                        })
                                        .FirstOrDefault();
                                    
                                    // 如果還是找不到，嘗試更精確的查找方式
                                    if (targetStepExecution == null)
                                    {
                                        WriteLog($"🔍 [DEBUG] 使用原始查找方式找不到，嘗試更精確的查找");
                                        
                                        // 使用精確的 ID 匹配
                                        foreach (var step in allDataSetSteps)
                                        {
                                            try
                                            {
                                                var inputJson = JsonSerializer.Deserialize<JsonElement>(step.InputJson);
                                                
                                                string foundId = null;
                                                if (inputJson.TryGetProperty("Id", out var idElement))
                                                {
                                                    foundId = idElement.GetString();
                                                }
                                                else if (inputJson.TryGetProperty("NodeId", out var nodeIdElement))
                                                {
                                                    foundId = nodeIdElement.GetString();
                                                }
                                                else if (inputJson.TryGetProperty("id", out var idLowerElement))
                                                {
                                                    foundId = idLowerElement.GetString();
                                                }
                                                
                                                WriteLog($"🔍 [DEBUG] 精確匹配檢查 - 步驟 {step.Id} 找到的 ID: '{foundId}', 目標 ID: '{nodeData.IntegratedDataSetQueryNodeId}'");
                                                
                                                if (foundId == nodeData.IntegratedDataSetQueryNodeId)
                                                {
                                                    targetStepExecution = step;
                                                    WriteLog($"🔍 [DEBUG] 通過精確匹配找到 DataSet Query 節點: {step.Id}");
                                                    break;
                                                }
                                            }
                                            catch (Exception ex)
                                            {
                                                WriteLog($"🔍 [DEBUG] 解析步驟 {step.Id} 的 InputJson 時出錯: {ex.Message}");
                                            }
                                        }
                                        
                                        if (targetStepExecution == null)
                                        {
                                            WriteLog($"⚠️ [WARNING] 無法找到指定的 DataSet Query 節點執行記錄，不應回退到其他查詢");
                                        }
                                    }

                                    if (targetStepExecution != null)
                                    {
                                        WriteLog($"🔍 [DEBUG] 找到 DataSet Query 節點執行記錄: {targetStepExecution.Id}");
                                        
                                        WriteLog($"🔍 [DEBUG] 查找查詢結果 - WorkflowExecutionId: {execution.Id}, StepExecutionId: {targetStepExecution.Id}");
                                        
                                        var queryResults = await db.WorkflowDataSetQueryResults
                                            .Where(r => r.WorkflowExecutionId == execution.Id && r.StepExecutionId == targetStepExecution.Id)
                                            .OrderByDescending(r => r.ExecutedAt)
                                            .FirstOrDefaultAsync();

                                        WriteLog($"🔍 [DEBUG] 查詢結果記錄: {(queryResults != null ? $"ID={queryResults.Id}, DataSetId={queryResults.DataSetId}, StepExecutionId={queryResults.StepExecutionId}" : "null")}");

                                        if (queryResults != null && !string.IsNullOrEmpty(queryResults.QueryResult))
                                        {
                                            WriteLog($"🔍 [DEBUG] 找到查詢結果，記錄數量: {queryResults.TotalRecords}");
                                            WriteLog($"🔍 [DEBUG] 查詢結果內容: {queryResults.QueryResult}");
                                            
                                            // 解析查詢結果並填充表單
                                            var originalHtmlLength = eFormDefinition.HtmlCode?.Length ?? 0;
                                            filledHtmlCode = await FillFormWithDataSetQueryResults(eFormDefinition.HtmlCode, queryResults.QueryResult);
                                            var filledHtmlLength = filledHtmlCode?.Length ?? 0;
                                            
                                            WriteLog($"🔍 [DEBUG] 表單填充完成 - 原始長度: {originalHtmlLength}, 填充後長度: {filledHtmlLength}");
                                            WriteLog($"🔍 [DEBUG] 填充後 HTML 是否與原始相同: {filledHtmlCode == eFormDefinition.HtmlCode}");
                                            
                                            if (filledHtmlCode == eFormDefinition.HtmlCode)
                                            {
                                                WriteLog($"⚠️ [WARNING] 表單填充可能失敗，HTML 沒有變化");
                                            }
                                        }
                                        else
                                        {
                                            WriteLog($"⚠️ [WARNING] 找不到 DataSet Query 結果，使用空白表單");
                                        }
                                    }
                                    else
                                    {
                                        WriteLog($"⚠️ [WARNING] 找不到指定的 DataSet Query 節點執行記錄 (NodeId: {nodeData.IntegratedDataSetQueryNodeId})，使用空白表單");
                                    }
                                }
                                else
                                {
                                    WriteLog($"⚠️ [WARNING] 未指定 DataSet Query 節點 ID，使用空白表單");
                                }
                                break;
                                
                            default:
                                WriteLog($"⚠️ [WARNING] 未知的表單填充模式: {sendEFormMode}，使用默認模式");
                                break;
                        }

                        // 創建單一表單實例
                        var eFormInstance = new EFormInstance
                        {
                            Id = Guid.NewGuid(),
                            EFormDefinitionId = eFormDefinition.Id,
                            WorkflowExecutionId = execution.Id,
                            WorkflowStepExecutionId = execution.CurrentStep ?? 0,
                            CompanyId = company.Id,
                            InstanceName = $"{nodeData.FormName}_{execution.Id}_{DateTime.Now:yyyyMMddHHmmss}",
                            OriginalHtmlCode = eFormDefinition.HtmlCode,
                            FilledHtmlCode = filledHtmlCode,
                            UserMessage = userMessage,
                            Status = "Pending",
                            CreatedAt = DateTime.UtcNow,
                            UpdatedAt = DateTime.UtcNow,
                            FillType = sendEFormMode == "integrateWaitReply" ? "AI" : "Data"
                        };

                        // 生成表單 URL
                        var formUrl = $"/eform-instance/{eFormInstance.Id}";
                        eFormInstance.FormUrl = formUrl;

                        // 保存到數據庫
                        db.EFormInstances.Add(eFormInstance);
                        await db.SaveChangesAsync();
                        
                        // 為 AI Fill / Data Fill 模式發送通知
                        await SendFormNotificationsForSingleInstance(eFormInstance, resolvedRecipients, nodeData, execution, stepExec, db);
                        
                        // 設置為等待表單審批狀態
                        execution.Status = "WaitingForFormApproval";
                        stepExec.Status = "Waiting";
                        stepExec.OutputJson = JsonSerializer.Serialize(new { 
                            success = true, 
                            message = "EForm sent successfully, waiting for approval",
                            formInstanceId = eFormInstance.Id,
                            recipientCount = resolvedRecipients.Count,
                            waitingSince = DateTime.Now 
                        });
                        
                        // 保存狀態
                        await SaveExecution(execution);
                        await SaveStepExecution(stepExec);
                        
                        WriteLog($"eForm 節點設置為等待表單審批狀態");
                        return false; // 返回 false 表示暫停執行
                    }
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

        // 處理模板變數（共用方法）
        /// <summary>
        /// 處理模板變數（新版本 - 支持模板變數配置）
        /// </summary>
        private async Task<Dictionary<string, string>> ProcessTemplateVariablesAsync(
            Dictionary<string, string> variables, 
            int executionId)
        {
            var processedVariables = new Dictionary<string, string>();
            
            if (variables != null)
            {
                foreach (var kvp in variables)
                {
                    var processedValue = await _variableReplacementService.ReplaceVariablesAsync(kvp.Value, executionId);
                    processedVariables[kvp.Key] = processedValue;
                    WriteLog($"🔍 [DEBUG] 模板變數 {kvp.Key}: {kvp.Value} -> {processedValue}");
                }
            }
            
            return processedVariables;
        }

        /// <summary>
        /// 處理新的模板變數配置（支持流程變數和數據集欄位）
        /// </summary>
        private async Task<Dictionary<string, string>> ProcessTemplateVariableConfigAsync(
            List<object> templateVariables,
            int executionId,
            PurpleRiceDbContext dbContext)
        {
            var processedVariables = new Dictionary<string, string>();
            
            if (templateVariables != null && templateVariables.Any())
            {
                foreach (var templateVar in templateVariables)
                {
                    try
                    {
                        // 解析模板變數配置
                        var varJson = JsonSerializer.Serialize(templateVar);
                        var varElement = JsonSerializer.Deserialize<JsonElement>(varJson);
                        
                        var parameterName = varElement.GetProperty("parameterName").GetString();
                        var processVariableId = varElement.GetProperty("processVariableId").GetString();
                        
                        if (string.IsNullOrEmpty(parameterName) || string.IsNullOrEmpty(processVariableId))
                        {
                            WriteLog($"⚠️ [WARNING] 跳過無效的模板變數配置: parameterName={parameterName}, processVariableId={processVariableId}");
                            continue;
                        }
                        
                        string variableValue = "";
                        
                        // 處理流程變數
                        if (Guid.TryParse(processVariableId, out var processVarId))
                        {
                            var processVar = await dbContext.ProcessVariableDefinitions
                                .FirstOrDefaultAsync(pv => pv.Id == processVarId);
                            
                            if (processVar != null)
                            {
                                variableValue = await _variableReplacementService.ReplaceVariablesAsync(
                                    $"${{{processVar.VariableName}}}", executionId);
                                WriteLog($"🔍 [DEBUG] 流程變數 {processVar.VariableName}: {variableValue}");
                            }
                            else
                            {
                                WriteLog($"⚠️ [WARNING] 找不到流程變數 ID: {processVariableId}");
                            }
                        }
                        
                        // 即使值為空也要添加參數，Meta API 需要知道參數的存在
                        processedVariables[parameterName] = variableValue ?? "";
                        WriteLog($"🔍 [DEBUG] 添加模板參數: {parameterName} = '{variableValue ?? ""}'");
                    }
                    catch (Exception ex)
                    {
                        WriteLog($"❌ [ERROR] 處理模板變數配置失敗: {ex.Message}");
                    }
                }
            }
            
            return processedVariables;
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

    // 輔助方法：為 Manual Fill 模式發送通知
    private async Task SendFormNotificationsToRecipients(
        List<ResolvedRecipient> resolvedRecipients, 
        List<Guid> instanceIds, 
        WorkflowNodeData nodeData, 
        WorkflowExecution execution, 
        WorkflowStepExecution stepExec, 
        PurpleRiceDbContext db)
    {
        WriteLog($"🔍 [DEBUG] 開始為 {resolvedRecipients.Count} 個收件人發送表單通知");
        
        // 獲取所有表單實例
        var instances = await db.EFormInstances
            .Where(i => instanceIds.Contains(i.Id))
            .ToListAsync();
        
        // 根據訊息模式發送通知
        string messageMode = nodeData.MessageMode ?? "direct";
        WriteLog($"🔍 [DEBUG] sendEForm messageMode: {messageMode}");
        
        Guid messageSendId = Guid.Empty;
        
        if (messageMode == "template")
        {
            WriteLog($"📝 Manual Fill 使用模板模式");
            
            if (!string.IsNullOrEmpty(nodeData.TemplateName))
            {
                // 使用共用方法處理模板變數
                Dictionary<string, string> processedVariables;
                if (nodeData.TemplateVariables != null && nodeData.TemplateVariables.Any())
                {
                    processedVariables = await ProcessTemplateVariableConfigAsync(nodeData.TemplateVariables, execution.Id, db);
                }
                else
                {
                    processedVariables = await ProcessTemplateVariablesAsync(nodeData.Variables, execution.Id);
                }
                
                // 為每個收件人發送個性化的模板消息
                foreach (var recipient in resolvedRecipients)
                {
                    var instance = instances.FirstOrDefault(i => i.RecipientWhatsAppNo == recipient.PhoneNumber);
                    if (instance != null)
                    {
                        // 添加個性化的表單 URL
                        processedVariables["formUrl"] = instance.FormUrl;
                        processedVariables["formName"] = nodeData.FormName ?? "";
                        processedVariables["recipientName"] = recipient.RecipientName ?? recipient.PhoneNumber;
                        
                        // 發送模板訊息
                        messageSendId = await _whatsAppWorkflowService.SendWhatsAppTemplateMessageWithTrackingAsync(
                            recipient.PhoneNumber,
                            null, // Manual Fill 不需要複雜的收件人配置
                            nodeData.TemplateId,
                            nodeData.TemplateName,
                            processedVariables,
                            execution,
                            stepExec,
                            stepExec.Id.ToString(),
                            "sendEForm",
                            db,
                            nodeData.IsMetaTemplate,
                            nodeData.TemplateLanguage
                        );
                        
                        WriteLog($"🔍 [DEBUG] 為 {recipient.PhoneNumber} 發送表單通知，ID: {messageSendId}");
                    }
                }
            }
        }
        else
        {
            WriteLog($"💬 Manual Fill 使用直接訊息模式");
            
            // 為每個收件人發送個性化的直接消息
            foreach (var recipient in resolvedRecipients)
            {
                var instance = instances.FirstOrDefault(i => i.RecipientWhatsAppNo == recipient.PhoneNumber);
                if (instance != null)
                {
                    // 構建個性化通知消息
                    string message;
                    if (nodeData.UseCustomMessage && !string.IsNullOrEmpty(nodeData.MessageTemplate))
                    {
                        message = nodeData.MessageTemplate
                            .Replace("{formName}", nodeData.FormName ?? "")
                            .Replace("{formUrl}", instance.FormUrl)
                            .Replace("{recipientName}", recipient.RecipientName ?? recipient.PhoneNumber);
                    }
                    else
                    {
                        message = $"您好 {recipient.RecipientName ?? recipient.PhoneNumber}，您的{nodeData.FormName}已準備就緒，請點擊以下鏈接填寫：\n\n{instance.FormUrl}";
                    }
                    
                    messageSendId = await _whatsAppWorkflowService.SendWhatsAppMessageWithTrackingAsync(
                        recipient.PhoneNumber,
                        null,
                        message,
                        execution,
                        stepExec,
                        stepExec.Id.ToString(),
                        "sendEForm",
                        db
                    );
                    
                    WriteLog($"🔍 [DEBUG] 為 {recipient.PhoneNumber} 發送表單通知，ID: {messageSendId}");
                }
            }
        }
        
        WriteLog($"🔍 [DEBUG] Manual Fill 表單通知發送完成");
    }

    // 輔助方法：為單一表單實例發送通知
    private async Task SendFormNotificationsForSingleInstance(
        EFormInstance eFormInstance,
        List<ResolvedRecipient> resolvedRecipients,
        WorkflowNodeData nodeData, 
        WorkflowExecution execution, 
        WorkflowStepExecution stepExec, 
        PurpleRiceDbContext db)
    {
        WriteLog($"🔍 [DEBUG] 為單一表單實例發送通知");
        
        // 根據訊息模式發送通知
        string messageMode = nodeData.MessageMode ?? "direct";
        WriteLog($"🔍 [DEBUG] sendEForm messageMode: {messageMode}");
        
        Guid messageSendId = Guid.Empty;
        
        if (messageMode == "template")
        {
            WriteLog($"📝 sendEForm 使用模板模式");
            
            if (!string.IsNullOrEmpty(nodeData.TemplateName))
            {
                // 使用共用方法處理模板變數
                Dictionary<string, string> processedVariables;
                if (nodeData.TemplateVariables != null && nodeData.TemplateVariables.Any())
                {
                    processedVariables = await ProcessTemplateVariableConfigAsync(nodeData.TemplateVariables, execution.Id, db);
                }
                else
                {
                    processedVariables = await ProcessTemplateVariablesAsync(nodeData.Variables, execution.Id);
                }
                
                // 添加表單 URL 作為變數
                processedVariables["formUrl"] = eFormInstance.FormUrl;
                processedVariables["formName"] = nodeData.FormName ?? "";
                
                // 發送模板訊息
                messageSendId = await _whatsAppWorkflowService.SendWhatsAppTemplateMessageWithTrackingAsync(
                    nodeData.To,
                    nodeData.RecipientDetails != null ? JsonSerializer.Serialize(nodeData.RecipientDetails) : null,
                    nodeData.TemplateId,
                    nodeData.TemplateName,
                    processedVariables,
                    execution,
                    stepExec,
                    stepExec.Id.ToString(),
                    "sendEForm",
                    db,
                    nodeData.IsMetaTemplate,
                    nodeData.TemplateLanguage
                );
                
                WriteLog($"🔍 [DEBUG] EForm 通知模板訊息發送完成，ID: {messageSendId}");
            }
        }
        else
        {
            WriteLog($"💬 sendEForm 使用直接訊息模式");
            
            // 構建通知消息
            string message;
            if (nodeData.UseCustomMessage && !string.IsNullOrEmpty(nodeData.MessageTemplate))
            {
                message = nodeData.MessageTemplate
                    .Replace("{formName}", nodeData.FormName ?? "")
                    .Replace("{formUrl}", eFormInstance.FormUrl);
            }
            else
            {
                message = $"您的{nodeData.FormName}已準備就緒，請點擊以下鏈接填寫：\n\n{eFormInstance.FormUrl}";
            }
            
            messageSendId = await _whatsAppWorkflowService.SendWhatsAppMessageWithTrackingAsync(
                nodeData.To,
                nodeData.RecipientDetails != null ? JsonSerializer.Serialize(nodeData.RecipientDetails) : null,
                message,
                execution,
                stepExec,
                stepExec.Id.ToString(),
                "sendEForm",
                db
            );
            
            WriteLog($"🔍 [DEBUG] EForm 通知訊息發送記錄創建完成，ID: {messageSendId}");
        }
        
        WriteLog($"🔍 [DEBUG] EForm 通知發送完成，收件人數量: {resolvedRecipients.Count}");
    }
} // class WorkflowEngine
} // namespace PurpleRice.Services

namespace PurpleRice.Services
{
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
        
        [System.Text.Json.Serialization.JsonPropertyName("messageMode")]
        public string MessageMode { get; set; } // "direct" 或 "template"
        
        [System.Text.Json.Serialization.JsonPropertyName("templateId")]
        public string TemplateId { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("templateName")]
        public string TemplateName { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("isMetaTemplate")]
        public bool IsMetaTemplate { get; set; } // 標記是否為 Meta 官方模板
        
        [System.Text.Json.Serialization.JsonPropertyName("templateLanguage")]
        public string TemplateLanguage { get; set; } // Meta 模板的語言代碼（如 zh_TW, zh_HK, en_US）
        
        [System.Text.Json.Serialization.JsonPropertyName("variables")]
        public Dictionary<string, string> Variables { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("templateVariables")]
        public List<object> TemplateVariables { get; set; } // 新的模板變數配置
        
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
        
        // sendEForm 節點相關屬性
        [System.Text.Json.Serialization.JsonPropertyName("messageTemplate")]
        public string MessageTemplate { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("useCustomMessage")]
        public bool UseCustomMessage { get; set; }
        
        // sendEForm 節點運作模式
        [System.Text.Json.Serialization.JsonPropertyName("sendEFormMode")]
        public string SendEFormMode { get; set; } = "integrateWaitReply"; // 默認為整合等待用戶回覆模式
        
        [System.Text.Json.Serialization.JsonPropertyName("integratedDataSetQueryNodeId")]
        public string IntegratedDataSetQueryNodeId { get; set; }
        
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
        
        // Time Validator 相關屬性
        public int? RetryIntervalDays { get; set; }
        public int? RetryIntervalHours { get; set; }
        public int? RetryIntervalMinutes { get; set; }
        public RetryMessageConfig RetryMessageConfig { get; set; }
        public EscalationConfig EscalationConfig { get; set; }
        
        // JSON 屬性映射（處理 UI 中的欄位名稱）
        [System.Text.Json.Serialization.JsonPropertyName("retryInterval")]
        public string RetryInterval { get; set; }
        
        [System.Text.Json.Serialization.JsonPropertyName("retryLimit")]
        public string RetryLimitFromUI { get; set; }
        
        // 重命名標準屬性以避免衝突
        [System.Text.Json.Serialization.JsonPropertyName("retryLimitValue")]
        public int? RetryLimitValue { get; set; }
    }
    
    // 工作流程執行結果模型
    public class WorkflowExecutionResult
    {
        public string? Status { get; set; }
        public object? OutputData { get; set; }
    }
    
    // 輔助方法：判斷模板 ID 是否為 Meta 模板
    public static class TemplateHelper
    {
        /// <summary>
        /// 判斷模板 ID 是否為 Meta 模板
        /// </summary>
        /// <param name="templateId">模板 ID</param>
        /// <returns>如果是 Meta 模板返回 true，否則返回 false</returns>
        public static bool IsMetaTemplateId(string templateId)
        {
            if (string.IsNullOrEmpty(templateId))
                return false;

            // Meta 模板 ID 通常是純數字（如 1059722526095407）
            // 內部模板 ID 通常是 GUID 格式
            return long.TryParse(templateId, out _);
        }
    }
} // namespace PurpleRice.Services
