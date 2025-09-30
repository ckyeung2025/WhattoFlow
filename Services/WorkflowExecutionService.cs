using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using PurpleRice.Data;
using PurpleRice.Models;
using Microsoft.AspNetCore.Hosting;
using System.IO;


namespace PurpleRice.Services
{
    public interface IWorkflowExecutionService
    {
        Task<WorkflowExecution> StartWorkflowAsync(int workflowDefinitionId, string initiatedBy, Dictionary<string, object> initialVariables = null);
        Task<bool> ProcessQRCodeInputAsync(int executionId, string nodeId, byte[] imageData, string qrCodeValue);
        Task<WorkflowExecution> GetExecutionAsync(int executionId);
        Task<List<WorkflowExecution>> GetExecutionsByWorkflowAsync(int workflowDefinitionId);
        Task ExecuteWorkflowAsync(WorkflowDefinition workflow, WorkflowExecution execution, object inputData);
    }

    public class WorkflowExecutionService : IWorkflowExecutionService
    {
        private readonly PurpleRiceDbContext _context;
        private readonly IQRCodeService _qrCodeService;
        private readonly IProcessVariableService _processVariableService;
        private readonly ILogger<WorkflowExecutionService> _logger;
        private readonly UserSessionService _userSessionService;
        private readonly IWebHostEnvironment _environment;

        public WorkflowExecutionService(
            PurpleRiceDbContext context,
            IQRCodeService qrCodeService,
            IProcessVariableService processVariableService,
            ILogger<WorkflowExecutionService> logger,
            UserSessionService userSessionService,
            IWebHostEnvironment environment)
        {
            _context = context;
            _qrCodeService = qrCodeService;
            _processVariableService = processVariableService;
            _logger = logger;
            _userSessionService = userSessionService;
            _environment = environment;
        }

        public async Task<WorkflowExecution> StartWorkflowAsync(int workflowDefinitionId, string initiatedBy, Dictionary<string, object> initialVariables = null)
        {
            try
            {
                var execution = new WorkflowExecution
                {
                    WorkflowDefinitionId = workflowDefinitionId,
                    Status = "Running",
                    StartedAt = DateTime.UtcNow,
                    InitiatedBy = initiatedBy,
                    CurrentStep = 0, // 從步驟 0 開始
                    InputJson = "{}" // 初始 JSON 數據
                };

                _context.WorkflowExecutions.Add(execution);
                await _context.SaveChangesAsync();

                // 設置初始變量值
                if (initialVariables != null)
                {
                    foreach (var variable in initialVariables)
                    {
                        await _processVariableService.SetVariableValueAsync(execution.Id, variable.Key, variable.Value);
                    }
                }

                _logger.LogInformation("Workflow execution started: {ExecutionId}", execution.Id);
                return execution;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error starting workflow execution");
                throw;
            }
        }

        public async Task<bool> ProcessQRCodeInputAsync(int executionId, string nodeId, byte[] imageData, string qrCodeValue)
        {
            try
            {
                var execution = await _context.WorkflowExecutions
                    .Include(e => e.WorkflowDefinition)
                    .FirstOrDefaultAsync(e => e.Id == executionId);

                if (execution == null)
                {
                    _logger.LogWarning("Workflow execution not found: {ExecutionId}", executionId);
                    return false;
                }

                // 檢查是否在等待 QR Code 狀態
                if (execution.Status != "WaitingForQRCode" && execution.Status != "Running")
                {
                    _logger.LogWarning("Workflow execution is not in correct status: {ExecutionId}, Status: {Status}", executionId, execution.Status);
                    return false;
                }

                // 掃描 QR Code（圖片已經在控制器中保存了）
                string scannedValue = null;
                if (imageData != null && imageData.Length > 0)
                {
                    scannedValue = await _qrCodeService.ScanQRCodeAsync(imageData);
                }
                else if (!string.IsNullOrEmpty(qrCodeValue))
                {
                    scannedValue = qrCodeValue;
                }

                if (string.IsNullOrEmpty(scannedValue))
                {
                    _logger.LogWarning("No QR Code value found for execution: {ExecutionId}", executionId);
                    return false;
                }

                // 從工作流程定義中獲取節點配置
                string qrCodeVariableName = "qrCodeResult"; // 默認變量名
                
                if (execution.WorkflowDefinition != null && !string.IsNullOrEmpty(execution.WorkflowDefinition.Json))
                {
                    try
                    {
                        var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                        var flowData = JsonSerializer.Deserialize<WorkflowGraph>(execution.WorkflowDefinition.Json, options);
                        
                        if (flowData?.Nodes != null)
                        {
                            var targetNode = flowData.Nodes.FirstOrDefault(n => n.Id == nodeId);
                            if (targetNode?.Data != null && !string.IsNullOrEmpty(targetNode.Data.QrCodeVariable))
                            {
                                qrCodeVariableName = targetNode.Data.QrCodeVariable;
                                _logger.LogInformation("Found QR Code variable name from node config: {VariableName}", qrCodeVariableName);
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning("Failed to parse workflow definition JSON: {Error}", ex.Message);
                    }
                }

                // 設置流程變量
                await _processVariableService.SetVariableValueAsync(executionId, qrCodeVariableName, scannedValue, 
                    setBy: "QRCodeInput", sourceType: "QRCodeScan", sourceReference: nodeId);

                // 更新執行狀態，恢復流程執行
                execution.Status = "Running";
                execution.IsWaiting = false;
                execution.WaitingSince = null;
                execution.LastUserActivity = DateTime.UtcNow;
                execution.CurrentStep = (execution.CurrentStep ?? 0) + 1;

                await _context.SaveChangesAsync();

                _logger.LogInformation("QR Code processed successfully for execution: {ExecutionId}, Variable: {VariableName}, Value: {Value}", 
                    executionId, qrCodeVariableName, scannedValue);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing QR Code input");
                throw;
            }
        }

        public async Task<WorkflowExecution> GetExecutionAsync(int executionId)
        {
            return await _context.WorkflowExecutions
                .FirstOrDefaultAsync(e => e.Id == executionId);
        }

        public async Task<List<WorkflowExecution>> GetExecutionsByWorkflowAsync(int workflowDefinitionId)
        {
            return await _context.WorkflowExecutions
                .Where(e => e.WorkflowDefinitionId == workflowDefinitionId)
                .OrderByDescending(e => e.StartedAt)
                .ToListAsync();
        }

        private string GetNextNodeId(WorkflowExecution execution, string currentNodeId)
        {
            // 這裡需要根據工作流定義來確定下一個節點
            // 暫時返回一個默認值，實際應該解析工作流的 JSON 定義
            return "end";
        }

        public async Task ExecuteWorkflowAsync(WorkflowDefinition workflow, WorkflowExecution execution, object inputData)
        {
            try
            {
                _logger.LogInformation("Executing workflow: {WorkflowId}, Execution: {ExecutionId}", workflow.Id, execution.Id);
                
                // 這裡實現工作流程執行邏輯
                // 暫時只記錄日誌，實際應該根據工作流定義執行相應的節點
                
                execution.Status = "Completed";
                execution.EndedAt = DateTime.UtcNow;
                
                await _context.SaveChangesAsync();
                
                // 清理用戶會話中的已完成流程
                await _userSessionService.ClearCompletedWorkflowFromSessionAsync(execution.Id);
                
                _logger.LogInformation("Workflow execution completed: {ExecutionId}", execution.Id);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error executing workflow: {ExecutionId}", execution.Id);
                execution.Status = "Failed";
                execution.ErrorMessage = ex.Message;
                execution.EndedAt = DateTime.UtcNow;
                
                await _context.SaveChangesAsync();
                throw;
            }
        }
    }
}
