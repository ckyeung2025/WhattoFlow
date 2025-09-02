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

        public WorkflowEngine(IServiceProvider serviceProvider, WhatsAppWorkflowService whatsAppWorkflowService, 
            Func<string, LoggingService> loggingServiceFactory, IConfiguration configuration, EFormService eFormService)
        {
            _serviceProvider = serviceProvider;
            _whatsAppWorkflowService = whatsAppWorkflowService;
            _loggingService = loggingServiceFactory("WorkflowEngine");
            _configuration = configuration;
            _eFormService = eFormService;
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
                await ExecuteMultiBranchWorkflow(startNode.Id, flowData.Nodes, adjacencyList, execution, userId);
                
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
                    if (!adjacencyList.ContainsKey(edge.Source))
                        adjacencyList[edge.Source] = new List<string>();
                    adjacencyList[edge.Source].Add(edge.Target);
            }
            return adjacencyList;
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
            await ExecuteAllNextNodes(sendEFormNodeId, flowData.Nodes.ToDictionary(n => n.Id), adjacencyList, execution, execution.WaitingForUser);
        }

        // 從等待回覆狀態繼續
        private async Task ContinueFromWaitReply(WorkflowExecution execution, WorkflowGraph flowData, Dictionary<string, List<string>> adjacencyList)
        {
                    WriteLog($"流程狀態為 {execution.Status}，使用等待用戶回覆邏輯");
                    
                    var waitNode = flowData.Nodes.FirstOrDefault(n => n.Data?.Type == "waitReply" || n.Data?.Type == "waitForUserReply");
                    if (waitNode == null)
                    {
                        WriteLog($"錯誤: 找不到等待節點");
                        return;
                    }

                    var waitNodeId = waitNode.Id;
                    WriteLog($"找到等待節點: {waitNodeId}");

            // 標記 waitReply 步驟完成
            await MarkWaitReplyStepComplete(execution.Id);

                    // 找到下一個節點
                    if (adjacencyList.ContainsKey(waitNodeId))
                    {
                        var nextNodeId = adjacencyList[waitNodeId].FirstOrDefault();
                        if (nextNodeId != null)
                        {
                            WriteLog($"找到下一個節點: {nextNodeId}");
                            
                            // 更新執行狀態
                            execution.IsWaiting = false;
                            execution.WaitingSince = null;
                            execution.LastUserActivity = DateTime.Now;
                            execution.Status = "Running";
                            execution.CurrentStep = (execution.CurrentStep ?? 0) + 1;
                    await SaveExecution(execution);

                            WriteLog($"執行狀態已更新，開始執行下一個節點: {nextNodeId}");
                    await ExecuteMultiBranchWorkflow(nextNodeId, flowData.Nodes, adjacencyList, execution, execution.WaitingForUser);
                        }
                        else
                        {
                            WriteLog($"錯誤: 等待節點 {waitNodeId} 沒有後續節點");
                        }
                    }
                    else
                    {
                        WriteLog($"錯誤: 等待節點 {waitNodeId} 在鄰接表中找不到");
                    }
                }
                
        // 核心：多分支執行引擎
        private async Task ExecuteMultiBranchWorkflow(string startNodeId, List<WorkflowNode> nodes, 
            Dictionary<string, List<string>> adjacencyList, WorkflowExecution execution, string userId)
        {
            WriteLog($"=== 開始多分支執行引擎 ===");
            WriteLog($"起始節點: {startNodeId}");
            
            // 創建節點映射
            var nodeMap = nodes.ToDictionary(n => n.Id);
            
            // 從起始節點開始執行
            await ExecuteNodeWithBranches(startNodeId, nodeMap, adjacencyList, execution, userId);
            
            WriteLog($"=== 多分支執行引擎完成 ===");
        }

        // 執行單個節點並處理其所有分支
        private async Task ExecuteNodeWithBranches(string nodeId, Dictionary<string, WorkflowNode> nodeMap, 
            Dictionary<string, List<string>> adjacencyList, WorkflowExecution execution, string userId)
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

                // 找到並執行所有後續節點（多分支並行執行）
                await ExecuteAllNextNodes(nodeId, nodeMap, adjacencyList, execution, userId);
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

                case "sendEForm":
                case "sendeform":
                    return await ExecuteSendEForm(nodeData, stepExec, execution);

                case "end":
                    return await ExecuteEnd(nodeId, stepExec, execution);

                default:
                    WriteLog($"未處理的節點類型: {nodeData?.Type}");
                    stepExec.Status = "UnknownStepType";
                    return false;
            }
        }

        // 執行所有後續節點（多分支並行執行）
        private async Task ExecuteAllNextNodes(string currentNodeId, Dictionary<string, WorkflowNode> nodeMap, 
            Dictionary<string, List<string>> adjacencyList, WorkflowExecution execution, string userId)
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
                var task = ExecuteNodeWithBranches(nextNodeId, nodeMap, adjacencyList, execution, userId);
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

        // 標記 waitReply 步驟完成
        private async Task MarkWaitReplyStepComplete(int executionId)
        {
            using var scope = _serviceProvider.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<PurpleRiceDbContext>();
            
            var waitStepExecution = await db.WorkflowStepExecutions
                .Where(s => s.WorkflowExecutionId == executionId && s.StepType == "waitReply")
                .OrderByDescending(s => s.StartedAt)
                .FirstOrDefaultAsync();
            
            if (waitStepExecution != null)
            {
                waitStepExecution.IsWaiting = false;
                waitStepExecution.Status = "Completed";
                waitStepExecution.EndedAt = DateTime.Now;
                waitStepExecution.OutputJson = JsonSerializer.Serialize(new { 
                    message = "User replied, continuing workflow",
                    timestamp = DateTime.Now,
                    userResponse = "User provided response"
                });
                await db.SaveChangesAsync();
                WriteLog($"waitReply 節點狀態已更新為 Completed，步驟ID: {waitStepExecution.Id}");
                                 }
                                 else
                                 {
                WriteLog($"警告: 找不到 waitReply 步驟執行記錄");
            }
        }

        // 執行 sendWhatsApp 節點
        private async Task<bool> ExecuteSendWhatsApp(WorkflowNodeData nodeData, WorkflowStepExecution stepExec, WorkflowExecution execution)
        {
            WriteLog($"=== 執行 sendWhatsApp 節點 ===");
            
            if (!string.IsNullOrEmpty(nodeData.To) && !string.IsNullOrEmpty(nodeData.Message))
            {
                using var scope = _serviceProvider.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<PurpleRiceDbContext>();
                
                await _whatsAppWorkflowService.SendWhatsAppMessageAsync(nodeData.To, nodeData.Message, execution, db);
                WriteLog($"WhatsApp 消息發送完成: {nodeData.TaskName}");
                
                stepExec.OutputJson = JsonSerializer.Serialize(new { 
                    success = true, 
                    message = "WhatsApp message sent successfully",
                    to = nodeData.To,
                    taskName = nodeData.TaskName
                });
                
                return true;
                             }
                             else
                             {
                WriteLog($"sendWhatsApp 步驟缺少必要參數: to={nodeData.To}, message={nodeData.Message}");
                stepExec.OutputJson = JsonSerializer.Serialize(new { error = "Missing required parameters" });
                return false;
            }
        }

        // 執行 sendWhatsAppTemplate 節點
        private async Task<bool> ExecuteSendWhatsAppTemplate(WorkflowNodeData nodeData, WorkflowStepExecution stepExec, WorkflowExecution execution)
        {
            WriteLog($"=== 執行 sendWhatsAppTemplate 節點 ===");
            
            if (!string.IsNullOrEmpty(nodeData.To) && !string.IsNullOrEmpty(nodeData.TemplateName))
            {
                using var scope = _serviceProvider.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<PurpleRiceDbContext>();
                
                await _whatsAppWorkflowService.SendWhatsAppTemplateMessageAsync(nodeData.To, nodeData.TemplateId, execution, db);
                WriteLog($"WhatsApp 模板消息發送完成: {nodeData.TaskName}");
                
                stepExec.OutputJson = JsonSerializer.Serialize(new { 
                    success = true, 
                    message = "WhatsApp template message sent successfully",
                    to = nodeData.To,
                    templateName = nodeData.TemplateName
                });
                
                return true;
                            }
                            else
                            {
                WriteLog($"sendWhatsAppTemplate 步驟缺少必要參數: to={nodeData.To}, templateName={nodeData.TemplateName}");
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
                    var waId = nodeData.To ?? userId ?? "85296366318";
                    await _whatsAppWorkflowService.SendWhatsAppMessageAsync(waId, nodeData.Message, execution, db);
                    WriteLog($"成功發送等待提示訊息: '{nodeData.Message}' 到用戶: {waId}");
                }
            }
            
            WriteLog($"等待節點設置完成，流程暫停等待用戶回覆");
            return false; // 返回 false 表示暫停執行
        }

        // 執行 sendEForm 節點
        private async Task<bool> ExecuteSendEForm(WorkflowNodeData nodeData, WorkflowStepExecution stepExec, WorkflowExecution execution)
        {
            WriteLog($"=== 執行 sendEForm 節點 ===");
                        
                        if (!string.IsNullOrEmpty(nodeData.FormName) && !string.IsNullOrEmpty(nodeData.To))
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

                                // 發送 WhatsApp 消息通知用戶
                                var message = $"您的{nodeData.FormName}已準備就緒，請點擊以下鏈接填寫：\n\n{formUrl}";
                                await _whatsAppWorkflowService.SendWhatsAppMessageAsync(nodeData.To, message, execution, db);

                    // 設置為等待表單審批狀態
                                 execution.Status = "WaitingForFormApproval";
                                 stepExec.Status = "Waiting";
                                 stepExec.OutputJson = JsonSerializer.Serialize(new { 
                                     success = true, 
                                     message = "EForm sent successfully, waiting for approval",
                                     formInstanceId = eFormInstance.Id,
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
                             WriteLog($"sendEForm 步驟缺少必要參數: formName={nodeData.FormName}, to={nodeData.To}");
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
            WriteLog($"=== 工作流程標記為完成 ===");
            
            return false; // 返回 false 表示暫停執行
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

    // 工作流程執行結果模型
    public class WorkflowExecutionResult
    {
        public string Status { get; set; }
        public object OutputData { get; set; }
    }
} 
