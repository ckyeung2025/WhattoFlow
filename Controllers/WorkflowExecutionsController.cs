using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PurpleRice.Data;
using PurpleRice.Models;
using System;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using System.Collections.Generic;
using PurpleRice.Services;

namespace PurpleRice.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class WorkflowExecutionsController : ControllerBase
    {
        private readonly PurpleRiceDbContext _db;
        private readonly WorkflowEngine _engine;
        private readonly LoggingService _loggingService;
        
        public WorkflowExecutionsController(PurpleRiceDbContext db, WorkflowEngine engine, Func<string, LoggingService> loggingServiceFactory)
        {
            _db = db;
            _engine = engine;
            _loggingService = loggingServiceFactory("WorkflowExecutionsController");
        }

        // POST: api/workflowexecutions/start
        [HttpPost("start")] // body: { workflowDefinitionId: 1, input: {...} }
        public async Task<IActionResult> Start([FromBody] WorkflowStartRequest req)
        {
            var def = await _db.WorkflowDefinitions.FindAsync(req.WorkflowDefinitionId);
            if (def == null) return NotFound("Workflow definition not found");

            var execution = new WorkflowExecution
            {
                WorkflowDefinitionId = def.Id,
                Status = "Running",
                CurrentStep = 0,
                InputJson = req.Input != null ? JsonSerializer.Serialize(req.Input) : null,
                StartedAt = DateTime.Now
            };
            _db.WorkflowExecutions.Add(execution);
            await _db.SaveChangesAsync();

            // 執行流程
            await _engine.ExecuteWorkflowAsync(execution, null);

            return Ok(new { executionId = execution.Id, status = execution.Status });
        }

        // 手動啟動工作流程（從 WorkflowEngineController 合併）
        [HttpPost("workflow/{id}/start")]
        public async Task<IActionResult> StartWorkflow(int id, [FromBody] StartWorkflowRequest request)
        {
            try
            {
                _loggingService.LogInformation($"=== 手動啟動工作流程開始 ===");
                _loggingService.LogInformation($"工作流程 ID: {id}");

                // 查找工作流程定義
                var workflow = await _db.WorkflowDefinitions
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
                    InputJson = JsonSerializer.Serialize(request.InputData),
                    CreatedBy = User.FindFirst("user_id")?.Value ?? "manual-user"
                };

                _db.WorkflowExecutions.Add(execution);
                await _db.SaveChangesAsync();

                _loggingService.LogInformation($"執行記錄已創建，ID: {execution.Id}");

                // 調用 WorkflowEngine 執行工作流程
                var result = await _engine.ExecuteWorkflow(execution.Id, request.InputData);

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

        // GET: api/workflowexecutions/{id}
        [HttpGet("{id}")]
        public async Task<IActionResult> Get(int id)
        {
            var exec = await _db.WorkflowExecutions
                .Include(e => e.StepExecutions)
                .FirstOrDefaultAsync(e => e.Id == id);
            if (exec == null) return NotFound();
            return Ok(exec);
        }

        // POST: api/workflowexecutions/{id}/resume
        [HttpPost("{id}/resume")]
        public async Task<IActionResult> Resume(int id, [FromBody] Dictionary<string, object> input)
        {
            var exec = await _db.WorkflowExecutions.Include(e => e.WorkflowDefinition).FirstOrDefaultAsync(e => e.Id == id);
            if (exec == null) return NotFound();
            if (exec.Status != "Waiting") return BadRequest("Workflow is not waiting");
            exec.Status = "Running";
            exec.InputJson = input != null ? JsonSerializer.Serialize(input) : null;
            await _engine.ExecuteWorkflowAsync(exec, null);
            return Ok(new { executionId = exec.Id, status = exec.Status });
        }

        // GET: api/workflowexecutions/monitor
        [HttpGet("monitor")]
        public async Task<IActionResult> GetMonitorData(
            int page = 1, 
            int pageSize = 20, 
            string status = null, 
            string search = null,
            DateTime? startDate = null,
            DateTime? endDate = null)
        {
            try
            {
                var query = _db.WorkflowExecutions
                    .Include(e => e.WorkflowDefinition)
                    .Include(e => e.StepExecutions)
                    .AsQueryable();

                // 狀態篩選
                if (!string.IsNullOrEmpty(status) && status != "all")
                {
                    query = query.Where(e => e.Status == status);
                }

                // 搜索篩選
                if (!string.IsNullOrEmpty(search))
                {
                    query = query.Where(e => 
                        e.WorkflowDefinition.Name.Contains(search) ||
                        e.Id.ToString().Contains(search) ||
                        (e.CreatedBy != null && e.CreatedBy.Contains(search))
                    );
                }

                // 日期範圍篩選
                if (startDate.HasValue)
                {
                    query = query.Where(e => e.StartedAt >= startDate.Value);
                }
                if (endDate.HasValue)
                {
                    query = query.Where(e => e.StartedAt <= endDate.Value);
                }

                // 計算總數
                var total = await query.CountAsync();

                // 分頁
                var instances = await query
                    .OrderByDescending(e => e.StartedAt)
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .Select(e => new
                    {
                        e.Id,
                        workflowName = e.WorkflowDefinition.Name,
                        e.Status,
                        currentStep = e.CurrentStep,
                        stepCount = e.StepExecutions != null ? e.StepExecutions.Count : 0,
                        e.StartedAt,
                        e.EndedAt,
                        duration = e.EndedAt.HasValue ? 
                            (int?)(e.EndedAt.Value - e.StartedAt).TotalMinutes : null,
                        e.CreatedBy,
                        e.ErrorMessage,
                        e.InputJson  // 添加 InputJson 字段
                    })
                    .ToListAsync();

                return Ok(new
                {
                    data = instances,
                    total = total,
                    page = page,
                    pageSize = pageSize
                });
            }
            catch (Exception ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }

        // GET: api/workflowexecutions/monitor/statistics
        [HttpGet("monitor/statistics")]
        public async Task<IActionResult> GetMonitorStatistics()
        {
            try
            {
                // 檢查數據庫中是否有數據
                var total = await _db.WorkflowExecutions.CountAsync();
                
                if (total == 0)
                {
                    // 如果沒有數據，返回默認值
                    return Ok(new
                    {
                        total = 0,
                        running = 0,
                        completed = 0,
                        failed = 0,
                        waiting = 0,
                        successRate = 0,
                        averageExecutionTime = 0
                    });
                }

                // 獲取所有可能的狀態值
                var allStatuses = await _db.WorkflowExecutions
                    .Select(e => e.Status)
                    .Distinct()
                    .ToListAsync();

                // 動態計算各種狀態的數量
                var running = await _db.WorkflowExecutions.CountAsync(e => 
                    e.Status != null && e.Status.ToLower().Contains("run"));
                var completed = await _db.WorkflowExecutions.CountAsync(e => 
                    e.Status != null && e.Status.ToLower().Contains("complete"));
                var failed = await _db.WorkflowExecutions.CountAsync(e => 
                    e.Status != null && e.Status.ToLower().Contains("fail"));
                var waiting = await _db.WorkflowExecutions.CountAsync(e => 
                    e.Status != null && e.Status.ToLower().Contains("wait"));

                var successRate = total > 0 ? Math.Round((double)completed / total * 100, 1) : 0;

                // 計算平均執行時間，處理可能的空值
                double averageExecutionTime = 0;
                try
                {
                    var completedExecutions = await _db.WorkflowExecutions
                        .Where(e => e.Status != null && e.Status.ToLower().Contains("complete") && e.EndedAt.HasValue)
                        .Select(e => new { e.StartedAt, e.EndedAt })
                        .ToListAsync();

                    if (completedExecutions.Any())
                    {
                        var totalMinutes = completedExecutions
                            .Select(e => (e.EndedAt.Value - e.StartedAt).TotalMinutes)
                            .Where(minutes => minutes >= 0)
                            .ToList();

                        if (totalMinutes.Any())
                        {
                            averageExecutionTime = Math.Round(totalMinutes.Average(), 1);
                        }
                    }
                }
                catch (Exception ex)
                {
                    // 如果計算平均時間失敗，記錄錯誤但繼續執行
                    _loggingService.LogError($"計算平均執行時間時出錯: {ex.Message}");
                    averageExecutionTime = 0;
                }

                return Ok(new
                {
                    total,
                    running,
                    completed,
                    failed,
                    waiting,
                    successRate,
                    averageExecutionTime,
                    debug = new
                    {
                        allStatuses = allStatuses,
                        message = "統計計算完成"
                    }
                });
            }
            catch (Exception ex)
            {
                // 返回詳細的錯誤信息以便調試
                return BadRequest(new { 
                    error = ex.Message,
                    stackTrace = ex.StackTrace,
                    innerException = ex.InnerException?.Message
                });
            }
        }

        // 從 WorkflowEngineController 合併的統計信息方法
        [HttpGet("statistics")]
        public async Task<IActionResult> GetStatistics()
        {
            try
            {
                _loggingService.LogInformation("獲取工作流程引擎統計信息");

                var totalWorkflows = await _db.WorkflowDefinitions.CountAsync();
                var activeWorkflows = await _db.WorkflowDefinitions.CountAsync(w => w.Status == "Active" || w.Status == "啟用");
                var totalExecutions = await _db.WorkflowExecutions.CountAsync();
                var runningExecutions = await _db.WorkflowExecutions.CountAsync(e => e.Status == "Running");
                var completedExecutions = await _db.WorkflowExecutions.CountAsync(e => e.Status == "Completed");
                var failedExecutions = await _db.WorkflowExecutions.CountAsync(e => e.Status == "Failed");

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

        // GET: api/workflowexecutions/{id}/details
        [HttpGet("{id}/details")]
        public async Task<IActionResult> GetInstanceDetails(int id)
        {
            try
            {
                var instance = await _db.WorkflowExecutions
                    .Include(e => e.WorkflowDefinition)
                    .Include(e => e.StepExecutions)
                    .FirstOrDefaultAsync(e => e.Id == id);

                if (instance == null)
                {
                    return NotFound(new { error = "實例不存在" });
                }

                var details = new
                {
                    instance.Id,
                    workflowName = instance.WorkflowDefinition.Name,
                    instance.Status,
                    instance.CurrentStep,
                    instance.StartedAt,
                    instance.EndedAt,
                    duration = instance.EndedAt.HasValue ? 
                        (int?)(instance.EndedAt.Value - instance.StartedAt).TotalMinutes : null,
                    instance.CreatedBy,
                    instance.ErrorMessage,
                    stepExecutions = instance.StepExecutions?.Select(s => new
                    {
                        s.Id,
                        stepName = s.StepType,
                        s.Status,
                        s.StartedAt,
                        completedAt = s.EndedAt,
                        errorMessage = s.OutputJson,
                        output = s.OutputJson
                    }).ToList()
                };

                return Ok(details);
            }
            catch (Exception ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }

        // POST: api/workflowexecutions/{id}/pause
        [HttpPost("{id}/pause")]
        public async Task<IActionResult> PauseInstance(int id)
        {
            try
            {
                var instance = await _db.WorkflowExecutions.FindAsync(id);
                if (instance == null)
                {
                    return NotFound(new { error = "實例不存在" });
                }

                if (instance.Status != "Running")
                {
                    return BadRequest(new { error = "只有運行中的實例才能暫停" });
                }

                instance.Status = "Paused";
                await _db.SaveChangesAsync();

                return Ok(new { message = "實例已暫停" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }

        // POST: api/workflowexecutions/{id}/resume
        [HttpPost("{id}/resume")]
        public async Task<IActionResult> ResumeInstance(int id)
        {
            try
            {
                var instance = await _db.WorkflowExecutions.FindAsync(id);
                if (instance == null)
                {
                    return NotFound(new { error = "實例不存在" });
                }

                if (instance.Status != "Paused" && instance.Status != "Waiting")
                {
                    return BadRequest(new { error = "只有暫停或等待中的實例才能恢復" });
                }

                instance.Status = "Running";
                await _db.SaveChangesAsync();

                return Ok(new { message = "實例已恢復" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }

        // POST: api/workflowexecutions/{id}/cancel
        [HttpPost("{id}/cancel")]
        public async Task<IActionResult> CancelInstance(int id)
        {
            try
            {
                var instance = await _db.WorkflowExecutions.FindAsync(id);
                if (instance == null)
                {
                    return NotFound(new { error = "實例不存在" });
                }

                if (instance.Status == "Completed" || instance.Status == "Cancelled")
                {
                    return BadRequest(new { error = "已完成或已取消的實例無法取消" });
                }

                instance.Status = "Cancelled";
                instance.EndedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync();

                return Ok(new { message = "實例已取消" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }

        // POST: api/workflowexecutions/{id}/retry
        [HttpPost("{id}/retry")]
        public async Task<IActionResult> RetryInstance(int id)
        {
            try
            {
                var instance = await _db.WorkflowExecutions.FindAsync(id);
                if (instance == null)
                {
                    return NotFound(new { error = "實例不存在" });
                }

                if (instance.Status != "Failed")
                {
                    return BadRequest(new { error = "只有失敗的實例才能重試" });
                }

                // 創建新的重試實例
                var retryInstance = new WorkflowExecution
                {
                    WorkflowDefinitionId = instance.WorkflowDefinitionId,
                    Status = "Running",
                    StartedAt = DateTime.UtcNow,
                    CreatedBy = instance.CreatedBy,
                    InputJson = instance.InputJson // 使用 InputJson 而不是 Input
                };

                _db.WorkflowExecutions.Add(retryInstance);
                await _db.SaveChangesAsync();

                return Ok(new { message = "重試實例已創建", instanceId = retryInstance.Id });
            }
            catch (Exception ex)
            {
                return BadRequest(new { error = ex.Message });
            }
        }

        // GET: api/workflowexecutions/{id}/eform-instances
        [HttpGet("{id}/eform-instances")]
        public async Task<IActionResult> GetEformInstances(int id)
        {
            try
            {
                _loggingService.LogInformation($"正在查找工作流程實例 ID: {id} 的表單實例");
                
                // 檢查工作流程實例是否存在
                var workflowInstance = await _db.WorkflowExecutions.FindAsync(id);
                if (workflowInstance == null)
                {
                    _loggingService.LogWarning($"工作流程實例 ID: {id} 不存在");
                    return NotFound(new { error = "工作流程實例不存在" });
                }
                
                _loggingService.LogInformation($"找到工作流程實例: {workflowInstance.Id}, 狀態: {workflowInstance.Status}");

                // 查找與此工作流程實例相關的表單實例
                var eformInstances = await _db.EFormInstances
                    .Include(e => e.EFormDefinition)
                    .Where(e => e.WorkflowExecutionId == id)
                    .Select(e => new
                    {
                        e.Id,
                        formName = e.EFormDefinition != null ? e.EFormDefinition.Name : "未命名表單",
                        e.InstanceName,
                        e.Status,
                        e.CreatedAt,
                        e.UserMessage,
                        e.ApprovalBy,
                        e.ApprovalAt,
                        e.ApprovalNote
                    })
                    .ToListAsync();
                
                _loggingService.LogInformation($"找到 {eformInstances.Count} 個表單實例");

                return Ok(eformInstances);
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取表單實例時發生錯誤: {ex.Message}");
                _loggingService.LogDebug($"錯誤詳情: {ex.StackTrace}");
                return BadRequest(new { error = ex.Message });
            }
        }
    }

    public class WorkflowStartRequest
    {
        public int WorkflowDefinitionId { get; set; }
        public Dictionary<string, object> Input { get; set; }
    }

    // 從 WorkflowEngineController 合併的請求模型
    public class StartWorkflowRequest
    {
        public object InputData { get; set; }
    }
} 