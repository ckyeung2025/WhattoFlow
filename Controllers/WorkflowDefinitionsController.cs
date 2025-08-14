using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using PurpleRice.Data;
using PurpleRice.Models;
using PurpleRice.Services;
using System;
using System.Linq;
using System.Threading.Tasks;
using System.Linq.Dynamic.Core;
using System.Collections.Generic;
using System.Text.Json;
using System.Security.Claims;
using System.Net.Http;
using Microsoft.Extensions.Configuration;

namespace PurpleRice.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class WorkflowDefinitionsController : ControllerBase
    {
        private readonly PurpleRiceDbContext _db;
        private readonly IConfiguration _configuration;
        private readonly WhatsAppWorkflowService _whatsAppWorkflowService;
        private readonly LoggingService _loggingService;
        
        public WorkflowDefinitionsController(PurpleRiceDbContext db, IConfiguration configuration, WhatsAppWorkflowService whatsAppWorkflowService, Func<string, LoggingService> loggingServiceFactory)
        {
            _db = db;
            _configuration = configuration;
            _whatsAppWorkflowService = whatsAppWorkflowService;
            _loggingService = loggingServiceFactory("WorkflowDefinitionsController");
        }

        // 獲取當前用戶的 CompanyId
        private Guid? GetCurrentUserCompanyId()
        {
            // 首先嘗試從 JWT claims 中獲取 company_id
            var companyIdClaim = User.FindFirst("company_id");
            if (companyIdClaim != null && Guid.TryParse(companyIdClaim.Value, out Guid companyId))
            {
                return companyId;
            }

            // 如果 JWT 中沒有，嘗試從 user_id 查詢用戶的 company_id
            var userIdClaim = User.FindFirst("user_id");
            if (userIdClaim != null && Guid.TryParse(userIdClaim.Value, out Guid userId))
            {
                var user = _db.Users.FirstOrDefault(u => u.Id == userId);
                if (user != null)
                {
                    return user.CompanyId;
                }
            }

            return null;
        }

        private int? GetCurrentExecutionId()
        {
            // 從 HTTP 上下文中獲取當前執行 ID
            // 這個方法只在同步上下文中使用
            var executionIdClaim = User.FindFirst("execution_id");
            if (executionIdClaim == null) return null;

            if (int.TryParse(executionIdClaim.Value, out var executionId))
            {
                return executionId;
            }
            return null;
        }

        // GET: api/workflowdefinitions
        [HttpGet]
        public async Task<IActionResult> GetAll(int page = 1, int pageSize = 10, string search = null, string sortBy = null, string sortOrder = null)
        {
            try
            {
                var companyId = GetCurrentUserCompanyId();
                if (!companyId.HasValue)
                {
                    return Unauthorized(new { error = "無法識別用戶公司" });
                }

                var query = _db.WorkflowDefinitions
                    .Where(x => x.CompanyId == companyId.Value)
                    .AsQueryable();

                if (!string.IsNullOrEmpty(search))
                {
                    query = query.Where(x => x.Name.Contains(search) || x.CreatedBy.Contains(search));
                }
                
                // 簡化排序邏輯
                if (!string.IsNullOrEmpty(sortBy))
                {
                    switch (sortBy.ToLower())
                    {
                        case "name":
                            query = sortOrder?.ToLower() == "asc" ? query.OrderBy(x => x.Name) : query.OrderByDescending(x => x.Name);
                            break;
                        case "createdby":
                            query = sortOrder?.ToLower() == "asc" ? query.OrderBy(x => x.CreatedBy) : query.OrderByDescending(x => x.CreatedBy);
                            break;
                        case "createdat":
                            query = sortOrder?.ToLower() == "asc" ? query.OrderBy(x => x.CreatedAt) : query.OrderByDescending(x => x.CreatedAt);
                            break;
                        case "updatedat":
                            query = sortOrder?.ToLower() == "asc" ? query.OrderBy(x => x.UpdatedAt) : query.OrderByDescending(x => x.UpdatedAt);
                            break;
                        case "status":
                            query = sortOrder?.ToLower() == "asc" ? query.OrderBy(x => x.Status) : query.OrderByDescending(x => x.Status);
                            break;
                        default:
                            query = query.OrderByDescending(x => x.CreatedAt);
                            break;
                    }
                }
                else
                {
                    query = query.OrderByDescending(x => x.CreatedAt);
                }
                
                var total = await query.CountAsync();
                var list = await query
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .ToListAsync();
                    
                return Ok(new { data = list, total, page, pageSize });
            }
            catch (Exception ex)
            {
                // 記錄錯誤
                _loggingService.LogError($"WorkflowDefinitions GetAll Error: {ex.Message}", ex);
                return StatusCode(500, new { error = "內部服務器錯誤", details = ex.Message });
            }
        }

        // GET: api/workflowdefinitions/{id}
        [HttpGet("{id}")]
        public async Task<IActionResult> Get(int id)
        {
            var companyId = GetCurrentUserCompanyId();
            if (!companyId.HasValue)
            {
                return Unauthorized(new { error = "無法識別用戶公司" });
            }

            var item = await _db.WorkflowDefinitions
                .Where(x => x.Id == id && x.CompanyId == companyId.Value)
                .FirstOrDefaultAsync();
            
            if (item == null) return NotFound();
            return Ok(item);
        }

        // POST: api/workflowdefinitions
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] WorkflowDefinition def)
        {
            var companyId = GetCurrentUserCompanyId();
            if (!companyId.HasValue)
            {
                return Unauthorized(new { error = "無法識別用戶公司" });
            }

            def.CompanyId = companyId.Value; // 設置為當前用戶的公司ID
            def.CreatedAt = DateTime.Now;
            _db.WorkflowDefinitions.Add(def);
            await _db.SaveChangesAsync();
            return CreatedAtAction(nameof(Get), new { id = def.Id }, def);
        }

        // PUT: api/workflowdefinitions/{id}
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] WorkflowDefinition def)
        {
            var companyId = GetCurrentUserCompanyId();
            if (!companyId.HasValue)
            {
                return Unauthorized(new { error = "無法識別用戶公司" });
            }

            var item = await _db.WorkflowDefinitions
                .Where(x => x.Id == id && x.CompanyId == companyId.Value)
                .FirstOrDefaultAsync();
            
            if (item == null) return NotFound();
            
            item.Name = def.Name;
            item.Description = def.Description;
            item.Json = def.Json;
            item.Status = def.Status;
            item.UpdatedAt = DateTime.Now;
            item.UpdatedBy = def.UpdatedBy;
            // 確保 CompanyId 保持不變
            item.CompanyId = companyId.Value;
            await _db.SaveChangesAsync();
            return Ok(item);
        }

        // DELETE: api/workflowdefinitions/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var companyId = GetCurrentUserCompanyId();
            if (!companyId.HasValue)
            {
                return Unauthorized(new { error = "無法識別用戶公司" });
            }

            var item = await _db.WorkflowDefinitions
                .Where(x => x.Id == id && x.CompanyId == companyId.Value)
                .FirstOrDefaultAsync();
            
            if (item == null) return NotFound();
            _db.WorkflowDefinitions.Remove(item);
            await _db.SaveChangesAsync();
            return NoContent();
        }

        // POST: api/workflowdefinitions/{id}/copy
        [HttpPost("{id}/copy")]
        public async Task<IActionResult> CopyWorkflow(int id)
        {
            var companyId = GetCurrentUserCompanyId();
            if (!companyId.HasValue)
            {
                return Unauthorized(new { error = "無法識別用戶公司" });
            }

            var workflow = await _db.WorkflowDefinitions
                .Where(x => x.Id == id && x.CompanyId == companyId.Value)
                .FirstOrDefaultAsync();
            
            if (workflow == null)
                return NotFound();

            var newWorkflow = new WorkflowDefinition
            {
                Name = $"{workflow.Name} - 複製",
                Description = workflow.Description,
                Json = workflow.Json,
                Status = "啟用",
                CreatedBy = workflow.CreatedBy,
                UpdatedBy = workflow.UpdatedBy,
                CreatedAt = DateTime.Now,
                UpdatedAt = DateTime.Now,
                CompanyId = companyId.Value // 設置為當前用戶的公司ID
            };

            _db.WorkflowDefinitions.Add(newWorkflow);
            await _db.SaveChangesAsync();

            return Ok(newWorkflow);
        }

        // POST: api/workflowdefinitions/batch-delete
        [HttpPost("batch-delete")]
        public async Task<IActionResult> BatchDelete([FromBody] WorkflowBatchDeleteRequest request)
        {
            var companyId = GetCurrentUserCompanyId();
            if (!companyId.HasValue)
            {
                return Unauthorized(new { error = "無法識別用戶公司" });
            }

            var workflowsToDelete = await _db.WorkflowDefinitions
                .Where(x => request.Ids.Contains(x.Id) && x.CompanyId == companyId.Value)
                .ToListAsync();

            if (!workflowsToDelete.Any())
            {
                return NotFound(new { error = "未找到要刪除的流程" });
            }

            _db.WorkflowDefinitions.RemoveRange(workflowsToDelete);
            await _db.SaveChangesAsync();

            return Ok(new { success = true, deletedCount = workflowsToDelete.Count });
        }

        // POST: api/workflowdefinitions/batch-status
        [HttpPost("batch-status")]
        public async Task<IActionResult> BatchStatus([FromBody] WorkflowBatchStatusRequest request)
        {
            var companyId = GetCurrentUserCompanyId();
            if (!companyId.HasValue)
            {
                return Unauthorized(new { error = "無法識別用戶公司" });
            }

            var workflowsToUpdate = await _db.WorkflowDefinitions
                .Where(x => request.Ids.Contains(x.Id) && x.CompanyId == companyId.Value)
                .ToListAsync();

            if (!workflowsToUpdate.Any())
            {
                return NotFound(new { error = "未找到要更新的流程" });
            }

            var newStatus = request.IsActive ? "啟用" : "停用";
            foreach (var workflow in workflowsToUpdate)
            {
                workflow.Status = newStatus;
                workflow.UpdatedAt = DateTime.Now;
            }

            await _db.SaveChangesAsync();

            return Ok(new { success = true, updatedCount = workflowsToUpdate.Count });
        }

        // POST: api/workflowdefinitions/{id}/start
        [HttpPost("{id}/start")]
        public async Task<IActionResult> StartWorkflow(int id, [FromBody] StartWorkflowRequest request)
        {
            var companyId = GetCurrentUserCompanyId();
            if (!companyId.HasValue)
            {
                return Unauthorized(new { error = "無法識別用戶公司" });
            }

            var workflow = await _db.WorkflowDefinitions
                .Where(x => x.Id == id && x.CompanyId == companyId.Value)
                .FirstOrDefaultAsync();
            
            if (workflow == null)
            {
                return NotFound(new { error = "找不到指定的流程" });
            }

            if (workflow.Status != "Active" && workflow.Status != "啟用")
            {
                return BadRequest(new { error = "Workflow is not active, cannot execute" });
            }

            try
            {
                _loggingService.LogInformation($"=== 手動啟動流程開始 ===");
                _loggingService.LogInformation($"流程 ID: {id}");
                _loggingService.LogInformation($"流程名稱: {workflow.Name}");
                _loggingService.LogInformation($"流程狀態: {workflow.Status}");
                _loggingService.LogInformation($"流程 JSON: {workflow.Json}");
                
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

                // 異步執行流程
                _ = Task.Run(async () =>
                {
                    try
                    {
                        _loggingService.LogInformation($"=== 開始異步執行流程 ===");
                        
                        // 在異步執行中創建新的 DbContext 實例
                        var optionsBuilder = new Microsoft.EntityFrameworkCore.DbContextOptionsBuilder<PurpleRiceDbContext>();
                        optionsBuilder.UseSqlServer("Server=127.0.0.1;Database=PurpleRice;User Id=sa;Password=sql!Q@W3e;TrustServerCertificate=true;");
                        
                        using var asyncDbContext = new PurpleRiceDbContext(optionsBuilder.Options);
                        await ExecuteWorkflowAsync(workflow, execution, request.InputData, asyncDbContext);
                        
                        _loggingService.LogInformation($"=== 異步執行完成 ===");
                    }
                    catch (Exception ex)
                    {
                        _loggingService.LogError($"=== 異步執行失敗 ===", ex);
                        _loggingService.LogError($"錯誤訊息: {ex.Message}", ex);
                        _loggingService.LogError($"錯誤堆疊: {ex.StackTrace}", ex);
                        
                        // 使用新的 DbContext 更新執行狀態
                        var optionsBuilder = new Microsoft.EntityFrameworkCore.DbContextOptionsBuilder<PurpleRiceDbContext>();
                        optionsBuilder.UseSqlServer("Server=127.0.0.1;Database=PurpleRice;User Id=sa;Password=sql!Q@W3e;TrustServerCertificate=true;");
                        
                        using var asyncDbContext = new PurpleRiceDbContext(optionsBuilder.Options);
                        var executionToUpdate = await asyncDbContext.WorkflowExecutions.FindAsync(execution.Id);
                        if (executionToUpdate != null)
                        {
                            executionToUpdate.Status = "Failed";
                            executionToUpdate.ErrorMessage = ex.Message;
                            executionToUpdate.EndedAt = DateTime.Now;
                            await asyncDbContext.SaveChangesAsync();
                            _loggingService.LogError($"執行狀態已更新為失敗: {ex.Message}", ex);
                        }
                    }
                });

                return Ok(new
                {
                    success = true,
                    executionId = execution.Id,
                    message = "Workflow started successfully"
                });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"=== 啟動流程失敗 ===", ex);
                _loggingService.LogError($"錯誤訊息: {ex.Message}", ex);
                _loggingService.LogError($"錯誤堆疊: {ex.StackTrace}", ex);
                return StatusCode(500, new { error = $"啟動流程失敗: {ex.Message}" });
            }
        }

        private async Task ExecuteWorkflow(WorkflowDefinition workflow, WorkflowExecution execution, object inputData)
        {
            await ExecuteWorkflowAsync(workflow, execution, inputData, _db);
        }

        private async Task ExecuteWorkflowAsync(WorkflowDefinition workflow, WorkflowExecution execution, object inputData, PurpleRiceDbContext dbContext)
        {
            try
            {
                _loggingService.LogInformation($"=== Starting workflow execution for workflow ID: {workflow.Id} ===");
                _loggingService.LogInformation($"Workflow JSON: {workflow.Json}");
                
                if (string.IsNullOrEmpty(workflow.Json))
                {
                    _loggingService.LogWarning("Workflow JSON is empty");
                    execution.Status = "Failed";
                    execution.ErrorMessage = "Workflow definition is empty";
                    execution.EndedAt = DateTime.Now;
                    await dbContext.SaveChangesAsync();
                    return;
                }

                var workflowData = JsonSerializer.Deserialize<JsonElement>(workflow.Json);
                _loggingService.LogDebug("Parsed workflow data successfully");
                
                if (!workflowData.TryGetProperty("nodes", out var nodes) || !workflowData.TryGetProperty("edges", out var edges))
                {
                    _loggingService.LogError("Failed to get nodes or edges from workflow data");
                    execution.Status = "Failed";
                    execution.ErrorMessage = "Invalid workflow definition format";
                    execution.EndedAt = DateTime.Now;
                    await dbContext.SaveChangesAsync();
                    return;
                }

                _loggingService.LogInformation($"Found {nodes.GetArrayLength()} nodes and {edges.GetArrayLength()} edges");
                await ProcessWorkflowNodesAsync(nodes, edges, execution, inputData, dbContext);

                // 只有在沒有失敗的情況下才設置為完成
                if (execution.Status != "Failed")
                {
                    execution.Status = "Completed";
                    execution.EndedAt = DateTime.Now;
                    // 不設置 CurrentStep，因為在 ExecuteWorkflowAsync 中無法知道具體步驟索引
                    _loggingService.LogInformation("=== Workflow execution completed successfully ===");
                }
                else
                {
                    _loggingService.LogWarning("=== Workflow execution failed, status already set to Failed ===");
                }
                
                await dbContext.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"Workflow execution failed: {ex.Message}");
                _loggingService.LogError($"Exception stack trace: {ex.StackTrace}");
                
                // 直接從資料庫查詢並更新執行記錄
                _loggingService.LogInformation($"開始查詢執行記錄 ID: {execution.Id}");
                try
                {
                    var executionToUpdate = await dbContext.WorkflowExecutions.FindAsync(execution.Id);
                    if (executionToUpdate != null)
                    {
                        _loggingService.LogInformation($"找到執行記錄，當前狀態: {executionToUpdate.Status}");
                        executionToUpdate.Status = "Failed";
                        executionToUpdate.ErrorMessage = ex.Message;
                        executionToUpdate.EndedAt = DateTime.Now;
                        // 不設置 CurrentStep，因為在 ExecuteWorkflowAsync 中無法知道具體步驟索引
                        _loggingService.LogError($"工作流程執行失敗，狀態已更新為 Failed: {ex.Message}");
                        
                        // 保存失敗狀態到資料庫
                        _loggingService.LogInformation($"準備保存失敗狀態到資料庫...");
                        var saveResult = await dbContext.SaveChangesAsync();
                        _loggingService.LogInformation($"保存結果: {saveResult} 個實體被更新");
                        _loggingService.LogInformation($"失敗狀態已保存到資料庫");
                        
                        // 驗證更新是否成功
                        _loggingService.LogInformation($"開始驗證更新結果...");
                        var updatedExecution = await dbContext.WorkflowExecutions.FindAsync(execution.Id);
                        if (updatedExecution != null)
                        {
                            _loggingService.LogInformation($"驗證更新結果 - 執行 ID: {updatedExecution.Id}, 狀態: {updatedExecution.Status}, 錯誤訊息: {updatedExecution.ErrorMessage}");
                        }
                        else
                        {
                            _loggingService.LogWarning($"警告：無法找到更新後的執行記錄");
                        }
                    }
                    else
                    {
                        _loggingService.LogError($"錯誤：無法找到執行記錄 ID: {execution.Id}");
                    }
                }
                catch (Exception findEx)
                {
                    _loggingService.LogError($"查詢執行記錄時出錯: {findEx.Message}");
                    _loggingService.LogInformation($"嘗試使用原始 SQL 更新...");
                    
                    // 使用原始 SQL 更新
                    var sql = "UPDATE workflow_executions SET Status = 'Failed', ErrorMessage = @errorMessage, EndedAt = @endedAt WHERE Id = @id";
                    var parameters = new[]
                    {
                        new Microsoft.Data.SqlClient.SqlParameter("@errorMessage", ex.Message),
                        new Microsoft.Data.SqlClient.SqlParameter("@endedAt", DateTime.Now),
                        new Microsoft.Data.SqlClient.SqlParameter("@id", execution.Id)
                    };
                    
                    var updateResult = await dbContext.Database.ExecuteSqlRawAsync(sql, parameters);
                    _loggingService.LogInformation($"原始 SQL 更新結果: {updateResult} 行被影響");
                    
                    // 同時更新當前步驟的狀態為 Failed
                    _loggingService.LogInformation($"嘗試更新當前步驟狀態為 Failed...");
                    var stepSql = "UPDATE workflow_step_executions SET Status = 'Failed', EndedAt = @endedAt, OutputJson = @outputJson WHERE WorkflowExecutionId = @executionId AND Status = 'Running'";
                    var stepParameters = new[]
                    {
                        new Microsoft.Data.SqlClient.SqlParameter("@endedAt", DateTime.Now),
                        new Microsoft.Data.SqlClient.SqlParameter("@outputJson", $"{{\"error\":\"{ex.Message}\"}}"),
                        new Microsoft.Data.SqlClient.SqlParameter("@executionId", execution.Id)
                    };
                    
                    var stepUpdateResult = await dbContext.Database.ExecuteSqlRawAsync(stepSql, stepParameters);
                    _loggingService.LogInformation($"步驟狀態更新結果: {stepUpdateResult} 行被影響");
                }
            }
        }

        private async Task ProcessWorkflowNodes(JsonElement nodes, JsonElement edges, WorkflowExecution execution, object inputData)
        {
            await ProcessWorkflowNodesAsync(nodes, edges, execution, inputData, _db);
        }

        private async Task ProcessWorkflowNodesAsync(JsonElement nodes, JsonElement edges, WorkflowExecution execution, object inputData, PurpleRiceDbContext dbContext)
        {
            _loggingService.LogInformation($"Processing workflow nodes. Total nodes: {nodes.GetArrayLength()}");
            _loggingService.LogInformation($"Current execution step: {execution.CurrentStep}");
            
            // 構建節點映射和連接關係
            var nodeMap = new Dictionary<string, JsonElement>();
            var edgeMap = new Dictionary<string, List<string>>();
            
            // 建立節點映射
            foreach (var node in nodes.EnumerateArray())
            {
                var nodeId = node.GetProperty("id").GetString();
                nodeMap[nodeId] = node;
                edgeMap[nodeId] = new List<string>();
                _loggingService.LogDebug($"映射節點: {nodeId}");
            }
            
            // 建立連接關係
            foreach (var edge in edges.EnumerateArray())
            {
                var sourceId = edge.GetProperty("source").GetString();
                var targetId = edge.GetProperty("target").GetString();
                
                if (edgeMap.ContainsKey(sourceId))
                {
                    edgeMap[sourceId].Add(targetId);
                    _loggingService.LogDebug($"建立連接: {sourceId} -> {targetId}");
                }
            }
            
            // 找到起始節點（通常是 "start"）
            var startNodeId = nodeMap.Keys.FirstOrDefault(id => 
                nodeMap[id].GetProperty("data").GetProperty("type").GetString() == "start");
            
            if (string.IsNullOrEmpty(startNodeId))
            {
                throw new Exception("找不到起始節點");
            }
            
            _loggingService.LogInformation($"找到起始節點: {startNodeId}");
            
            // 使用廣度優先搜索來處理並行節點
            var nodesToProcess = new Queue<string>();
            var processedNodes = new HashSet<string>();
            
            // 從起始節點開始
            nodesToProcess.Enqueue(startNodeId);
            
            while (nodesToProcess.Count > 0)
            {
                var currentNodeId = nodesToProcess.Dequeue();
                
                if (processedNodes.Contains(currentNodeId))
                {
                    _loggingService.LogDebug($"節點 {currentNodeId} 已經處理過，跳過");
                    continue;
                }
                
                if (!nodeMap.ContainsKey(currentNodeId))
                {
                    _loggingService.LogWarning($"節點 {currentNodeId} 不存在於節點映射中，跳過");
                    continue;
                }
                
                var node = nodeMap[currentNodeId];
                var nodeData = node.GetProperty("data");
                var nodeType = nodeData.GetProperty("type").GetString();
                
                _loggingService.LogInformation($"=== 節點處理開始 ===");
                _loggingService.LogDebug($"節點 ID: {currentNodeId}");
                _loggingService.LogDebug($"節點數據: {nodeData}");
                _loggingService.LogDebug($"節點類型: {nodeType}");
                _loggingService.LogDebug($"節點類型長度: {nodeType?.Length ?? 0}");
                _loggingService.LogDebug($"節點類型字節: {string.Join(", ", nodeType?.Select(c => (int)c) ?? new int[0])}");
                
                _loggingService.LogInformation($"=== Processing node: {currentNodeId} ===");
                _loggingService.LogDebug($"Node type: {nodeType}");
                _loggingService.LogDebug($"Node data: {nodeData}");

                // 創建步驟執行記錄
                var stepExecution = new WorkflowStepExecution
                {
                    WorkflowExecutionId = execution.Id,
                    StepIndex = processedNodes.Count,
                    StepType = nodeType,
                    Status = "Running",
                    StartedAt = DateTime.Now,
                    InputJson = nodeData.ToString() // 使用節點數據而不是 inputData
                };

                _loggingService.LogDebug($"Creating step execution record for node type: {nodeType}");
                dbContext.WorkflowStepExecutions.Add(stepExecution);
                await dbContext.SaveChangesAsync();
                _loggingService.LogDebug($"Step execution record created with ID: {stepExecution.Id}");

                try
                {
                    _loggingService.LogDebug($"Executing switch case for node type: {nodeType.ToLower()}");
                    _loggingService.LogDebug($"原始節點類型: {nodeType}");
                    _loggingService.LogDebug($"轉換後節點類型: {nodeType.ToLower()}");
                    _loggingService.LogDebug($"轉換後節點類型長度: {nodeType.ToLower()?.Length ?? 0}");
                    _loggingService.LogDebug($"轉換後節點類型字節: {string.Join(", ", nodeType.ToLower()?.Select(c => (int)c) ?? new int[0])}");
                    
                    // 檢查所有可能的匹配
                    _loggingService.LogDebug($"檢查 'sendeform' 匹配: {nodeType.ToLower() == "sendeform"}");
                    _loggingService.LogDebug($"檢查 'sendEForm' 匹配: {nodeType.ToLower() == "sendeform"}");
                    _loggingService.LogDebug($"檢查包含 'eform': {nodeType.ToLower().Contains("eform")}");
                    _loggingService.LogDebug($"檢查包含 'form': {nodeType.ToLower().Contains("form")}");
                    
                    // 使用統一的節點類型管理
                    var nodeDefinition = WorkflowNodeTypes.GetDefinition(nodeType);
                    if (nodeDefinition == null)
                    {
                        _loggingService.LogError($"Unknown node type: {nodeType}");
                        throw new Exception($"Unsupported node type: {nodeType}");
                    }

                    _loggingService.LogInformation($"Processing node type: {nodeDefinition.Type} ({nodeDefinition.Label})");

                    // 根據節點類型執行相應操作
                    switch (nodeDefinition.Type.ToLower())
                    {
                        case "start":
                            _loggingService.LogDebug("Skipping Start node");
                            break;
                        case "sendwhatsapp":
                            _loggingService.LogInformation("Executing Send WhatsApp node");
                            await ExecuteSendWhatsAppAsync(nodeData, inputData, dbContext, execution);
                            break;
                        case "sendwhatsapptemplate":
                            _loggingService.LogInformation("Executing Send WhatsApp Template node");
                            await ExecuteSendWhatsAppTemplateAsync(nodeData, inputData, dbContext, execution);
                            break;
                        case "waitreply":
                            _loggingService.LogInformation("Executing Wait Reply node");
                            await ExecuteWaitReply(nodeData, inputData);
                            break;
                        case "dbquery":
                            _loggingService.LogInformation("Executing Database Query node");
                            await ExecuteDbQuery(nodeData, inputData);
                            break;
                        case "callapi":
                            _loggingService.LogInformation("Executing Call API node");
                            await ExecuteCallApi(nodeData, inputData);
                            break;
                        case "sendeform":
                            _loggingService.LogInformation("Executing Send eForm node");
                            await ExecuteSendEFormAsync(nodeData, inputData, dbContext, execution);
                            break;
                        case "eformresult":
                            _loggingService.LogInformation("Executing eForm Result node");
                            await ExecuteEFormResult(nodeData, inputData);
                            break;
                        case "end":
                            _loggingService.LogDebug("Skipping End node");
                            break;
                        default:
                            _loggingService.LogError($"Unknown node type: {nodeType}");
                            throw new Exception($"Unsupported node type: {nodeType}");
                    }

                    stepExecution.Status = "Completed";
                    stepExecution.EndedAt = DateTime.Now;
                    _loggingService.LogInformation($"Node {nodeType} completed successfully");
                }
                catch (Exception ex)
                {
                    _loggingService.LogError($"Error executing node {nodeType}: {ex.Message}");
                    _loggingService.LogError($"Exception stack trace: {ex.StackTrace}");
                    stepExecution.Status = "Failed";
                    stepExecution.OutputJson = JsonSerializer.Serialize(new { error = ex.Message });
                    stepExecution.EndedAt = DateTime.Now;
                    
                    // 當任何步驟失敗時，將整個工作流程狀態更新為 Failed
                    _loggingService.LogInformation($"準備更新主記錄狀態為 Failed，執行 ID: {execution.Id}");
                    
                    // 直接從資料庫查詢並更新執行記錄
                    _loggingService.LogInformation($"開始查詢執行記錄 ID: {execution.Id}");
                    try
                    {
                        var executionToUpdate = await dbContext.WorkflowExecutions.FindAsync(execution.Id);
                        if (executionToUpdate != null)
                        {
                            _loggingService.LogInformation($"找到執行記錄，當前狀態: {executionToUpdate.Status}");
                            executionToUpdate.Status = "Failed";
                            executionToUpdate.ErrorMessage = ex.Message;
                            executionToUpdate.EndedAt = DateTime.Now;
                            executionToUpdate.CurrentStep = processedNodes.Count; // 記錄失敗的步驟索引
                            _loggingService.LogError($"工作流程執行失敗，狀態已更新為 Failed: {ex.Message}");
                            
                            // 保存失敗狀態到資料庫
                            _loggingService.LogInformation($"準備保存失敗狀態到資料庫...");
                            var saveResult = await dbContext.SaveChangesAsync();
                            _loggingService.LogInformation($"保存結果: {saveResult} 個實體被更新");
                            _loggingService.LogInformation($"失敗狀態已保存到資料庫");
                            
                            // 驗證更新是否成功
                            _loggingService.LogInformation($"開始驗證更新結果...");
                            var updatedExecution = await dbContext.WorkflowExecutions.FindAsync(execution.Id);
                            if (updatedExecution != null)
                            {
                                _loggingService.LogInformation($"驗證更新結果 - 執行 ID: {updatedExecution.Id}, 狀態: {updatedExecution.Status}, 錯誤訊息: {updatedExecution.ErrorMessage}");
                            }
                            else
                            {
                                _loggingService.LogWarning($"警告：無法找到更新後的執行記錄");
                            }
                        }
                        else
                        {
                            _loggingService.LogError($"錯誤：無法找到執行記錄 ID: {execution.Id}");
                        }
                    }
                    catch (Exception findEx)
                    {
                        _loggingService.LogError($"查詢執行記錄時出錯: {findEx.Message}");
                        _loggingService.LogInformation($"嘗試使用原始 SQL 更新...");
                        
                        // 使用原始 SQL 更新
                        var sql = "UPDATE workflow_executions SET Status = 'Failed', ErrorMessage = @errorMessage, EndedAt = @endedAt, CurrentStep = @currentStep WHERE Id = @id";
                        var parameters = new[]
                        {
                            new Microsoft.Data.SqlClient.SqlParameter("@errorMessage", ex.Message),
                            new Microsoft.Data.SqlClient.SqlParameter("@endedAt", DateTime.Now),
                            new Microsoft.Data.SqlClient.SqlParameter("@currentStep", processedNodes.Count),
                            new Microsoft.Data.SqlClient.SqlParameter("@id", execution.Id)
                        };
                        
                        var updateResult = await dbContext.Database.ExecuteSqlRawAsync(sql, parameters);
                        _loggingService.LogInformation($"原始 SQL 更新結果: {updateResult} 行被影響");
                    }
                    
                    return; // 失敗時立即退出
                }

                await dbContext.SaveChangesAsync();
                processedNodes.Add(currentNodeId);
                _loggingService.LogInformation($"=== Completed processing node: {currentNodeId} ===");
                
                // 將所有連接的節點加入處理隊列
                if (edgeMap.ContainsKey(currentNodeId))
                {
                    _loggingService.LogDebug($"節點 {currentNodeId} 的連接數量: {edgeMap[currentNodeId].Count}");
                    foreach (var nextNodeId in edgeMap[currentNodeId])
                    {
                        if (!processedNodes.Contains(nextNodeId))
                        {
                            nodesToProcess.Enqueue(nextNodeId);
                            _loggingService.LogDebug($"Added to processing queue: {nextNodeId}");
                        }
                        else
                        {
                            _loggingService.LogDebug($"節點 {nextNodeId} 已經處理過，跳過");
                        }
                    }
                }
                else
                {
                    _loggingService.LogDebug($"節點 {currentNodeId} 沒有連接的節點");
                }
                
                _loggingService.LogDebug($"當前處理隊列中的節點數量: {nodesToProcess.Count}");
                _loggingService.LogDebug($"已處理的節點: {string.Join(", ", processedNodes)}");
            }
            
            _loggingService.LogInformation("Finished processing all workflow nodes");
            _loggingService.LogInformation($"總共處理了 {processedNodes.Count} 個節點");
        }

        private async Task ExecuteSendWhatsAppAsync(JsonElement nodeData, object inputData, PurpleRiceDbContext dbContext, WorkflowExecution execution)
        {
            try
            {
                _loggingService.LogInformation($"=== ExecuteSendWhatsAppAsync 開始 ===");
                _loggingService.LogDebug($"nodeData: {nodeData}");
                
                // 檢查 nodeData 是否為 null
                if (nodeData.ValueKind == JsonValueKind.Null)
                {
                    throw new Exception("nodeData 是 null");
                }

                // 獲取節點數據
                string message = null;
                string to = null;

                // 嘗試多種方式獲取 message
                if (nodeData.TryGetProperty("message", out var messageProp))
                {
                    message = messageProp.GetString();
                    _loggingService.LogDebug($"找到 message: {message}");
                }
                else if (nodeData.TryGetProperty("Message", out var messagePropUpper))
                {
                    message = messagePropUpper.GetString();
                    _loggingService.LogDebug($"找到 Message (大寫): {message}");
                }
                else
                {
                    _loggingService.LogWarning("找不到 message 屬性");
                    // 記錄所有可用的屬性
                    var availableProperties = nodeData.EnumerateObject().Select(p => p.Name).ToList();
                    _loggingService.LogDebug($"可用的屬性: {string.Join(", ", availableProperties)}");
                    
                    // 嘗試從其他可能的屬性獲取
                    if (nodeData.TryGetProperty("taskName", out var taskNameProp))
                    {
                        message = taskNameProp.GetString();
                        _loggingService.LogDebug($"使用 taskName 作為 message: {message}");
                    }
                }

                // 嘗試多種方式獲取 to
                if (nodeData.TryGetProperty("to", out var toProp))
                {
                    to = toProp.GetString();
                    _loggingService.LogDebug($"找到 to: {to}");
                }
                else if (nodeData.TryGetProperty("To", out var toPropUpper))
                {
                    to = toPropUpper.GetString();
                    _loggingService.LogDebug($"找到 To (大寫): {to}");
                }
                else
                {
                    _loggingService.LogWarning("找不到 to 屬性");
                }

                if (string.IsNullOrEmpty(message) || string.IsNullOrEmpty(to))
                {
                    var errorDetails = new
                    {
                        message = message,
                        to = to,
                        nodeDataKeys = nodeData.EnumerateObject().Select(p => p.Name).ToList(),
                        nodeDataString = nodeData.ToString(),
                        executionId = execution.Id,
                        stepIndex = execution.CurrentStep
                    };
                    
                    _loggingService.LogError($"節點數據詳細信息: {System.Text.Json.JsonSerializer.Serialize(errorDetails)}");
                    throw new Exception($"步驟配置中缺少 message 參數或為空。message: '{message}', to: '{to}'");
                }

                // 使用統一的 WhatsApp 服務
                await _whatsAppWorkflowService.SendWhatsAppMessageAsync(to, message, execution, dbContext);
                
                _loggingService.LogInformation($"=== ExecuteSendWhatsAppAsync 完成 ===");
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"發送 WhatsApp 訊息失敗: {ex.Message}");
                _loggingService.LogError($"錯誤堆疊: {ex.StackTrace}");
                throw;
            }
        }

        private async Task ExecuteSendWhatsAppTemplateAsync(JsonElement nodeData, object inputData, PurpleRiceDbContext dbContext, WorkflowExecution execution)
        {
            try
            {
                _loggingService.LogInformation($"=== ExecuteSendWhatsAppTemplateAsync 開始 ===");
                _loggingService.LogDebug($"nodeData: {nodeData}");
                
                // 檢查 nodeData 是否為 null
                if (nodeData.ValueKind == JsonValueKind.Null)
                {
                    throw new Exception("nodeData 是 null");
                }

                // 獲取節點數據
                string templateId = null;
                string to = null;

                // 嘗試多種方式獲取 templateId
                if (nodeData.TryGetProperty("templateId", out var templateIdProp))
                {
                    templateId = templateIdProp.GetString();
                    _loggingService.LogDebug($"找到 templateId: {templateId}");
                }
                else if (nodeData.TryGetProperty("TemplateId", out var templateIdPropUpper))
                {
                    templateId = templateIdPropUpper.GetString();
                    _loggingService.LogDebug($"找到 TemplateId (大寫): {templateId}");
                }
                else
                {
                    _loggingService.LogWarning("找不到 templateId 屬性");
                    var availableProperties = nodeData.EnumerateObject().Select(p => p.Name).ToList();
                    _loggingService.LogDebug($"可用的屬性: {string.Join(", ", availableProperties)}");
                }

                // 嘗試多種方式獲取 to
                if (nodeData.TryGetProperty("to", out var toProp))
                {
                    to = toProp.GetString();
                    _loggingService.LogDebug($"找到 to: {to}");
                }
                else if (nodeData.TryGetProperty("To", out var toPropUpper))
                {
                    to = toPropUpper.GetString();
                    _loggingService.LogDebug($"找到 To (大寫): {to}");
                }
                else
                {
                    _loggingService.LogWarning("找不到 to 屬性");
                }

                if (string.IsNullOrEmpty(templateId) || string.IsNullOrEmpty(to))
                {
                    var errorDetails = new
                    {
                        templateId = templateId,
                        to = to,
                        nodeDataKeys = nodeData.EnumerateObject().Select(p => p.Name).ToList(),
                        nodeDataString = nodeData.ToString(),
                        executionId = execution.Id,
                        stepIndex = execution.CurrentStep
                    };
                    
                    _loggingService.LogError($"節點數據詳細信息: {System.Text.Json.JsonSerializer.Serialize(errorDetails)}");
                    throw new Exception($"步驟配置中缺少 templateId 參數或為空。templateId: '{templateId}', to: '{to}'");
                }

                _loggingService.LogInformation($"模板 ID: {templateId}");
                _loggingService.LogInformation($"收件人: {to}");

                // 使用統一的 WhatsApp 服務
                await _whatsAppWorkflowService.SendWhatsAppTemplateMessageAsync(to, templateId, execution, dbContext);
                
                _loggingService.LogInformation($"=== ExecuteSendWhatsAppTemplateAsync 完成 ===");
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"發送 WhatsApp 模板訊息失敗: {ex.Message}");
                _loggingService.LogError($"錯誤堆疊: {ex.StackTrace}");
                throw;
            }
        }

        private async Task ExecuteDbQuery(JsonElement nodeData, object inputData)
        {
            // 實現數據庫查詢的邏輯
            var sql = nodeData.GetProperty("sql").GetString();

            // 這裡執行 SQL 查詢
        }

        private async Task ExecuteCallApi(JsonElement nodeData, object inputData)
        {
            // 實現 API 調用的邏輯
            var url = nodeData.GetProperty("url").GetString();

            // 這裡調用外部 API
        }

        private async Task ExecuteWaitReply(JsonElement nodeData, object inputData)
        {
            // 實現等待用戶回覆的邏輯
            var timeout = nodeData.GetProperty("timeout").GetInt32();
            
            // 這裡實現等待邏輯
            _loggingService.LogInformation($"Waiting for user reply with timeout: {timeout} seconds");
        }

        private async Task ExecuteSendEFormAsync(JsonElement nodeData, object inputData, PurpleRiceDbContext dbContext, WorkflowExecution execution)
        {
            try
            {
                _loggingService.LogInformation($"=== ExecuteSendEFormAsync 開始 ===");
                _loggingService.LogInformation($"執行 ID: {execution.Id}");
                _loggingService.LogDebug($"節點數據: {nodeData}");
                
                // 獲取節點數據
                var formName = nodeData.GetProperty("formName").GetString();
                var formId = nodeData.GetProperty("formId").GetString();
                var to = nodeData.GetProperty("to").GetString();

                _loggingService.LogInformation($"formName: {formName}");
                _loggingService.LogInformation($"formId: {formId}");
                _loggingService.LogInformation($"to: {to}");

                if (string.IsNullOrEmpty(formName) || string.IsNullOrEmpty(to))
                {
                    throw new Exception("表單名稱和收件人電話號碼不能為空");
                }

                // 1. 查詢原始表單定義
                _loggingService.LogInformation($"開始查詢表單定義: {formName}");
                var eFormDefinition = await dbContext.eFormDefinitions
                    .FirstOrDefaultAsync(f => f.Name == formName && f.Status == "A");

                if (eFormDefinition == null)
                {
                    _loggingService.LogWarning($"找不到表單定義: {formName}，嘗試查詢所有表單...");
                    var allForms = await dbContext.eFormDefinitions.ToListAsync();
                    _loggingService.LogDebug($"資料庫中的所有表單:");
                    foreach (var form in allForms)
                    {
                        _loggingService.LogDebug($"- ID: {form.Id}, Name: {form.Name}, Status: {form.Status}");
                    }
                    throw new Exception($"找不到表單定義: {formName}");
                }

                _loggingService.LogInformation($"找到表單定義，ID: {eFormDefinition.Id}");

                // 2. 查詢當前流程實例中的用戶回覆記錄
                _loggingService.LogInformation($"開始查詢用戶回覆記錄，執行 ID: {execution.Id}");
                var userMessages = await dbContext.MessageValidations
                    .Where(m => m.WorkflowExecutionId == execution.Id && m.IsValid)
                    .OrderBy(m => m.CreatedAt)
                    .ToListAsync();

                _loggingService.LogInformation($"找到 {userMessages.Count} 條有效用戶回覆記錄");
                foreach (var msg in userMessages)
                {
                    _loggingService.LogDebug($"- 用戶訊息: {msg.UserMessage}, 時間: {msg.CreatedAt}");
                }

                // 3. 獲取公司ID
                var workflowDefinition = await dbContext.WorkflowDefinitions
                    .FirstOrDefaultAsync(w => w.Id == execution.WorkflowDefinitionId);

                if (workflowDefinition == null)
                {
                    throw new Exception("找不到工作流程定義");
                }

                var companyId = workflowDefinition.CompanyId;
                _loggingService.LogInformation($"使用公司ID: {companyId}");

                // 4. 創建表單實例記錄
                var eFormInstance = new EFormInstance
                {
                    Id = Guid.NewGuid(),
                    EFormDefinitionId = eFormDefinition.Id,
                    WorkflowExecutionId = execution.Id,
                    WorkflowStepExecutionId = execution.CurrentStep ?? 0,
                    CompanyId = companyId,
                    InstanceName = $"{formName}_{execution.Id}_{DateTime.Now:yyyyMMddHHmmss}",
                    OriginalHtmlCode = eFormDefinition.HtmlCode,
                    Status = "Pending",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                // 5. 如果有用戶回覆，使用 AI 填充表單
                if (userMessages.Any())
                {
                    var latestMessage = userMessages.Last();
                    eFormInstance.UserMessage = latestMessage.UserMessage;

                    _loggingService.LogInformation($"用戶消息: {latestMessage.UserMessage}");

                    // 調用 AI 填充表單
                    var filledHtml = await FillFormWithAI(eFormDefinition.HtmlCode, latestMessage.UserMessage);
                    eFormInstance.FilledHtmlCode = filledHtml;

                    _loggingService.LogInformation($"AI 填充完成，HTML 長度: {filledHtml?.Length ?? 0}");
                }
                else
                {
                    // 沒有用戶回覆，使用原始表單
                    eFormInstance.FilledHtmlCode = eFormDefinition.HtmlCode;
                    _loggingService.LogInformation("沒有用戶回覆，使用原始表單");
                }

                // 6. 生成表單 URL
                var formUrl = $"/eform-instance/{eFormInstance.Id}";
                eFormInstance.FormUrl = formUrl;

                // 7. 保存到數據庫
                _loggingService.LogInformation($"準備保存表單實例到資料庫...");
                dbContext.EFormInstances.Add(eFormInstance);
                await dbContext.SaveChangesAsync();

                _loggingService.LogInformation($"表單實例已創建，ID: {eFormInstance.Id}");

                // 8. 發送 WhatsApp 消息（包含表單鏈接）
                await SendEFormWhatsAppMessage(to, formName, formUrl, dbContext, execution);

                _loggingService.LogInformation($"=== ExecuteSendEFormAsync 完成 ===");
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"發送 eForm 失敗: {ex.Message}");
                _loggingService.LogError($"錯誤堆疊: {ex.StackTrace}");
                throw;
            }
        }

        private async Task<string> FillFormWithAI(string originalHtml, string userMessage)
        {
            try
            {
                _loggingService.LogInformation($"=== FillFormWithAI 開始 ===");
                _loggingService.LogInformation($"開始時間: {DateTime.Now:yyyy-MM-dd HH:mm:ss.fff}");
                _loggingService.LogInformation($"原始 HTML 長度: {originalHtml?.Length ?? 0}");
                _loggingService.LogInformation($"用戶消息: {userMessage}");

                // 從配置中獲取 AI 提示詞
                var formAnalysisPrompt = _configuration["XAI:FormAnalysisPrompt"] ?? "";

                // 構建 AI 提示詞
                var prompt = $@"{formAnalysisPrompt}

HTML 表單內容：
{originalHtml}

用戶輸入消息：
{userMessage}

請分析用戶輸入，並將對應的值填充到 HTML 表單的相應欄位中。只返回完整的 HTML 代碼，不要包含任何解釋文字。";

                // 獲取 X.AI 配置
                var apiKey = _configuration["XAI:ApiKey"];
                var model = _configuration["XAI:Model"] ?? "grok-3";
                var temperature = _configuration.GetValue<double>("XAI:Temperature", 0.8);
                var maxTokens = _configuration.GetValue<int>("XAI:MaxTokens", 15000);

                _loggingService.LogDebug($"XAI 配置 - Model: {model}, Temperature: {temperature}, MaxTokens: {maxTokens}");
                _loggingService.LogDebug($"API Key 前10字符: {apiKey?.Substring(0, Math.Min(10, apiKey?.Length ?? 0))}...");

                if (string.IsNullOrEmpty(apiKey))
                {
                    _loggingService.LogWarning("X.AI API Key 未配置，返回原始 HTML");
                    return originalHtml;
                }

                // 構建 AI 請求
                var aiRequest = new
                {
                    messages = new[]
                    {
                        new { role = "user", content = prompt }
                    },
                    model = model,
                    temperature = temperature,
                    max_tokens = maxTokens
                };

                using var httpClient = new HttpClient();
                httpClient.Timeout = TimeSpan.FromMinutes(5);
                httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {apiKey}");

                var jsonContent = System.Text.Json.JsonSerializer.Serialize(aiRequest);
                var content = new StringContent(jsonContent, System.Text.Encoding.UTF8, "application/json");

                _loggingService.LogInformation($"發送 AI 請求...");
                _loggingService.LogDebug($"請求 URL: https://api.x.ai/v1/chat/completions");
                _loggingService.LogDebug($"請求內容長度: {jsonContent.Length}");
                _loggingService.LogDebug($"提示詞長度: {prompt.Length}");
                _loggingService.LogDebug($"HTTP 客戶端超時設置: {httpClient.Timeout.TotalMinutes} 分鐘");

                var stopwatch = System.Diagnostics.Stopwatch.StartNew();
                
                try
                {
                    var response = await httpClient.PostAsync("https://api.x.ai/v1/chat/completions", content);
                    stopwatch.Stop();
                    
                    _loggingService.LogInformation($"AI 請求完成，耗時: {stopwatch.ElapsedMilliseconds}ms ({stopwatch.ElapsedMilliseconds / 1000.0:F2}秒)");
                    _loggingService.LogDebug($"響應狀態碼: {response.StatusCode}");
                    
                    var responseContent = await response.Content.ReadAsStringAsync();
                    _loggingService.LogDebug($"響應內容長度: {responseContent.Length}");
                    
                    if (responseContent.Length > 0)
                    {
                        _loggingService.LogDebug($"響應內容前500字符: {responseContent.Substring(0, Math.Min(500, responseContent.Length))}");
                    }

                    if (!response.IsSuccessStatusCode)
                    {
                        _loggingService.LogError($"AI 請求失敗: {response.StatusCode} - {responseContent}");
                        _loggingService.LogWarning("=== FillFormWithAI 失敗 - HTTP 錯誤 ===");
                        return originalHtml;
                    }

                    // 解析 AI 響應
                    try
                    {
                        var aiResponse = System.Text.Json.JsonSerializer.Deserialize<JsonElement>(responseContent);
                        var filledHtml = aiResponse.GetProperty("choices")[0].GetProperty("message").GetProperty("content").GetString();

                        _loggingService.LogInformation($"AI 填充完成，新 HTML 長度: {filledHtml?.Length ?? 0}");
                        _loggingService.LogInformation("=== FillFormWithAI 成功完成 ===");
                        return filledHtml;
                    }
                    catch (Exception parseEx)
                    {
                        _loggingService.LogError($"AI 響應解析失敗: {parseEx.Message}");
                        _loggingService.LogDebug($"原始響應內容: {responseContent}");
                        _loggingService.LogWarning("=== FillFormWithAI 失敗 - 響應解析錯誤 ===");
                        return originalHtml;
                    }
                }
                catch (TaskCanceledException timeoutEx)
                {
                    stopwatch.Stop();
                    _loggingService.LogError($"AI 請求超時: {timeoutEx.Message}");
                    _loggingService.LogDebug($"請求耗時: {stopwatch.ElapsedMilliseconds}ms ({stopwatch.ElapsedMilliseconds / 1000.0:F2}秒)");
                    _loggingService.LogDebug($"超時設置: {httpClient.Timeout.TotalMinutes} 分鐘");
                    _loggingService.LogWarning("=== FillFormWithAI 失敗 - 請求超時 ===");
                    return originalHtml;
                }
                catch (HttpRequestException httpEx)
                {
                    stopwatch.Stop();
                    _loggingService.LogError($"AI 請求 HTTP 錯誤: {httpEx.Message}");
                    _loggingService.LogDebug($"請求耗時: {stopwatch.ElapsedMilliseconds}ms ({stopwatch.ElapsedMilliseconds / 1000.0:F2}秒)");
                    _loggingService.LogWarning("=== FillFormWithAI 失敗 - HTTP 請求錯誤 ===");
                    return originalHtml;
                }
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"AI 填充發生未預期錯誤: {ex.Message}");
                _loggingService.LogDebug($"錯誤類型: {ex.GetType().Name}");
                _loggingService.LogDebug($"錯誤堆疊: {ex.StackTrace}");
                _loggingService.LogWarning("=== FillFormWithAI 失敗 - 未預期錯誤 ===");
                return originalHtml; // 失敗時返回原始 HTML
            }
        }

        private async Task SendEFormWhatsAppMessage(string to, string formName, string formUrl, PurpleRiceDbContext dbContext, WorkflowExecution execution)
        {
            try
            {
                _loggingService.LogInformation($"=== SendEFormWhatsAppMessage 開始 ===");
                _loggingService.LogInformation($"收件人: {to}");
                _loggingService.LogInformation($"表單名稱: {formName}");
                _loggingService.LogInformation($"表單URL: {formUrl}");

                // 獲取公司 WhatsApp 配置
                var workflowDefinition = await dbContext.WorkflowDefinitions
                    .FirstOrDefaultAsync(w => w.Id == execution.WorkflowDefinitionId);

                if (workflowDefinition == null)
                {
                    throw new Exception("找不到工作流程定義");
                }

                var company = await dbContext.Companies
                    .FirstOrDefaultAsync(c => c.Id == workflowDefinition.CompanyId);

                if (company == null)
                {
                    throw new Exception("找不到公司配置");
                }

                if (string.IsNullOrEmpty(company.WA_API_Key) || string.IsNullOrEmpty(company.WA_PhoneNo_ID))
                {
                    throw new Exception("公司未配置 WhatsApp API");
                }

                // 格式化電話號碼
                var formattedTo = to;
                if (!to.StartsWith("852"))
                {
                    if (to.StartsWith("0"))
                    {
                        to = to.Substring(1);
                    }
                    formattedTo = "852" + to;
                }

                // 構建消息內容
                var message = $"您有一個新的表單需要填寫：\n\n表單名稱：{formName}\n\n請點擊以下鏈接填寫表單：\n{formUrl}\n\n填寫完成後請點擊表單頂部的「批准」或「拒絕」按鈕。";

                // 發送 WhatsApp 消息
                var url = $"https://graph.facebook.com/v19.0/{company.WA_PhoneNo_ID}/messages";
                var payload = new
                {
                    messaging_product = "whatsapp",
                    to = formattedTo,
                    type = "text",
                    text = new { body = message }
                };

                using var httpClient = new HttpClient();
                httpClient.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", company.WA_API_Key);
                
                var jsonPayload = System.Text.Json.JsonSerializer.Serialize(payload);
                var content = new StringContent(jsonPayload, System.Text.Encoding.UTF8, "application/json");
                
                var response = await httpClient.PostAsync(url, content);
                var responseContent = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    throw new Exception($"WhatsApp API 請求失敗: {response.StatusCode} - {responseContent}");
                }

                _loggingService.LogInformation($"成功發送 eForm WhatsApp 消息到 {formattedTo}");
                _loggingService.LogInformation($"=== SendEFormWhatsAppMessage 完成 ===");
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"發送 eForm WhatsApp 消息失敗: {ex.Message}");
                throw;
            }
        }

        private async Task ExecuteEFormResult(JsonElement nodeData, object inputData)
        {
            // 實現 eForm 結果處理的邏輯
            var result = nodeData.GetProperty("result").GetString();
            
            // 這裡實現 eForm 結果處理邏輯
            _loggingService.LogInformation($"Processing eForm result: {result}");
        }
    }

    // 批量刪除請求模型
    public class WorkflowBatchDeleteRequest
    {
        public List<int> Ids { get; set; } = new List<int>();
    }

    // 批量狀態更新請求模型
    public class WorkflowBatchStatusRequest
    {
        public List<int> Ids { get; set; } = new List<int>();
        public bool IsActive { get; set; }
    }
} 