using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PurpleRice.Data;
using PurpleRice.Models;
using PurpleRice.Services;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace PurpleRice.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class WorkflowEngineController : ControllerBase
    {
        private readonly PurpleRiceDbContext _context;
        private readonly LoggingService _loggingService;
        private readonly WorkflowEngine _workflowEngine;

        public WorkflowEngineController(
            PurpleRiceDbContext context, 
            Func<string, LoggingService> loggingServiceFactory,
            WorkflowEngine workflowEngine)
        {
            _context = context;
            _loggingService = loggingServiceFactory("WorkflowEngineController");
            _workflowEngine = workflowEngine;
        }

        // 手動啟動工作流程
        [HttpPost("workflow/{id}/start")]
        public async Task<IActionResult> StartWorkflow(int id, [FromBody] StartWorkflowRequest request)
        {
            try
            {
                _loggingService.LogInformation($"=== 手動啟動工作流程開始 ===");
                _loggingService.LogInformation($"工作流程 ID: {id}");

                // 查找工作流程定義
                var workflow = await _context.WorkflowDefinitions
                    .FirstOrDefaultAsync(w => w.Id == id);

                if (workflow == null)
                {
                    _loggingService.LogWarning($"找不到工作流程，ID: {id}");
                    return NotFound(new { error = "工作流程不存在" });
                }

                if (workflow.Status != "Active" && workflow.Status != "啟用")
                {
                    _loggingService.LogWarning($"工作流程狀態不正確: {workflow.Status}");
                    return BadRequest(new { error = "工作流程未啟用" });
                }

                // 創建執行記錄
                var execution = new WorkflowExecution
                {
                    WorkflowDefinitionId = workflow.Id,
                    Status = "Running",
                    StartedAt = DateTime.Now,
                    InputJson = System.Text.Json.JsonSerializer.Serialize(request.InputData),
                    CreatedBy = "manual-user"
                };

                _context.WorkflowExecutions.Add(execution);
                await _context.SaveChangesAsync();

                _loggingService.LogInformation($"執行記錄已創建，ID: {execution.Id}");

                // 調用 WorkflowEngine 執行工作流程
                var result = await _workflowEngine.ExecuteWorkflow(execution.Id, request.InputData);

                _loggingService.LogInformation($"工作流程執行完成，狀態: {result.Status}");

                return Ok(new
                {
                    success = true,
                    executionId = execution.Id,
                    status = result.Status,
                    message = "工作流程已啟動並執行完成"
                });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"啟動工作流程失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = $"啟動工作流程失敗: {ex.Message}" });
            }
        }

        [HttpGet("workflows")]
        public async Task<IActionResult> GetWorkflows([FromQuery] int page = 1, [FromQuery] int pageSize = 10)
        {
            try
            {
                _loggingService.LogInformation($"獲取工作流程列表 - 頁面: {page}, 每頁: {pageSize}");

                var query = _context.WorkflowDefinitions.AsQueryable();
                var total = await query.CountAsync();

                var workflows = await query
                    .OrderByDescending(w => w.CreatedAt)
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .Select(w => new
                    {
                        w.Id,
                        w.Name,
                        w.Description,
                        w.Status,
                        w.CreatedAt,
                        w.UpdatedAt
                    })
                    .ToListAsync();

                _loggingService.LogInformation($"成功獲取 {workflows.Count} 個工作流程，總計 {total} 個");

                return Ok(new
                {
                    data = workflows,
                    total = total,
                    page = page,
                    pageSize = pageSize,
                    totalPages = (int)Math.Ceiling((double)total / pageSize)
                });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取工作流程列表失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = "獲取工作流程列表失敗" });
            }
        }

        [HttpGet("workflow/{id}")]
        public async Task<IActionResult> GetWorkflow(int id)
        {
            try
            {
                _loggingService.LogInformation($"獲取工作流程詳情 - ID: {id}");

                var workflow = await _context.WorkflowDefinitions
                    .FirstOrDefaultAsync(w => w.Id == id);

                if (workflow == null)
                {
                    _loggingService.LogWarning($"找不到工作流程，ID: {id}");
                    return NotFound(new { error = "工作流程不存在" });
                }

                _loggingService.LogInformation($"成功獲取工作流程: {workflow.Name}");
                return Ok(workflow);
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取工作流程詳情失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = "獲取工作流程詳情失敗" });
            }
        }

        [HttpGet("executions")]
        public async Task<IActionResult> GetExecutions([FromQuery] int page = 1, [FromQuery] int pageSize = 10)
        {
            try
            {
                _loggingService.LogInformation($"獲取工作流程執行列表 - 頁面: {page}, 每頁: {pageSize}");

                var query = _context.WorkflowExecutions.AsQueryable();
                var total = await query.CountAsync();

                var executions = await query
                    .OrderByDescending(e => e.StartedAt)
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .Select(e => new
                    {
                        e.Id,
                        e.WorkflowDefinitionId,
                        e.Status,
                        e.StartedAt,
                        e.EndedAt,
                        e.CurrentStep
                    })
                    .ToListAsync();

                _loggingService.LogInformation($"成功獲取 {executions.Count} 個執行記錄，總計 {total} 個");

                return Ok(new
                {
                    data = executions,
                    total = total,
                    page = page,
                    pageSize = pageSize,
                    totalPages = (int)Math.Ceiling((double)total / pageSize)
                });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取執行記錄列表失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = "獲取執行記錄列表失敗" });
            }
        }

        [HttpGet("execution/{id}")]
        public async Task<IActionResult> GetExecution(int id)
        {
            try
            {
                _loggingService.LogInformation($"獲取執行記錄詳情 - ID: {id}");

                var execution = await _context.WorkflowExecutions
                    .Include(e => e.StepExecutions)
                    .FirstOrDefaultAsync(e => e.Id == id);

                if (execution == null)
                {
                    _loggingService.LogWarning($"找不到執行記錄，ID: {id}");
                    return NotFound(new { error = "執行記錄不存在" });
                }

                _loggingService.LogInformation($"成功獲取執行記錄: ID {execution.Id}, 狀態 {execution.Status}");
                return Ok(execution);
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取執行記錄詳情失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = "獲取執行記錄詳情失敗" });
            }
        }

        [HttpGet("statistics")]
        public async Task<IActionResult> GetStatistics()
        {
            try
            {
                _loggingService.LogInformation("獲取工作流程引擎統計信息");

                var totalWorkflows = await _context.WorkflowDefinitions.CountAsync();
                var activeWorkflows = await _context.WorkflowDefinitions.CountAsync(w => w.Status == "Active" || w.Status == "啟用");
                var totalExecutions = await _context.WorkflowExecutions.CountAsync();
                var runningExecutions = await _context.WorkflowExecutions.CountAsync(e => e.Status == "Running");
                var completedExecutions = await _context.WorkflowExecutions.CountAsync(e => e.Status == "Completed");
                var failedExecutions = await _context.WorkflowExecutions.CountAsync(e => e.Status == "Failed");

                var statistics = new
                {
                    totalWorkflows = totalWorkflows,
                    activeWorkflows = activeWorkflows,
                    totalExecutions = totalExecutions,
                    runningExecutions = runningExecutions,
                    completedExecutions = completedExecutions,
                    failedExecutions = failedExecutions
                };

                _loggingService.LogInformation($"成功獲取統計信息: 工作流程 {totalWorkflows}, 執行記錄 {totalExecutions}");
                return Ok(statistics);
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取統計信息失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = "獲取統計信息失敗" });
            }
        }
    }

    // 啟動工作流程請求模型
    public class StartWorkflowRequest
    {
        public object InputData { get; set; }
    }
}
