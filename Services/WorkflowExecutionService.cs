using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using PurpleRice.Data;
using PurpleRice.Models;


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

        public WorkflowExecutionService(
            PurpleRiceDbContext context,
            IQRCodeService qrCodeService,
            IProcessVariableService processVariableService,
            ILogger<WorkflowExecutionService> logger,
            UserSessionService userSessionService)
        {
            _context = context;
            _qrCodeService = qrCodeService;
            _processVariableService = processVariableService;
            _logger = logger;
            _userSessionService = userSessionService;
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
                    .FirstOrDefaultAsync(e => e.Id == executionId);

                if (execution == null)
                {
                    _logger.LogWarning("Workflow execution not found: {ExecutionId}", executionId);
                    return false;
                }

                if (execution.Status != "Running")
                {
                    _logger.LogWarning("Workflow execution is not running: {ExecutionId}, Status: {Status}", executionId, execution.Status);
                    return false;
                }

                // 掃描 QR Code
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

                // 這裡需要根據節點配置來確定要設置的變量
                // 暫時使用一個默認的變量名，實際應該從節點配置中獲取
                await _processVariableService.SetVariableValueAsync(executionId, "qrCodeResult", scannedValue);

                // 更新執行狀態，移動到下一個節點
                // 注意：CurrentNodeId 和 LastUpdatedAt 欄位已移除，此處僅保留註釋
                // execution.CurrentNodeId = GetNextNodeId(execution, nodeId);
                // execution.LastUpdatedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();

                _logger.LogInformation("QR Code processed successfully for execution: {ExecutionId}, Value: {Value}", executionId, scannedValue);
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
