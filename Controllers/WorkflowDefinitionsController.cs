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
        private readonly WorkflowEngine _workflowEngine; // 重新啟用執行引擎
        
        public WorkflowDefinitionsController(
            PurpleRiceDbContext db, 
            IConfiguration configuration, 
            WhatsAppWorkflowService whatsAppWorkflowService, 
            Func<string, LoggingService> loggingServiceFactory,
            WorkflowEngine workflowEngine) // 重新注入執行引擎
        {
            _db = db;
            _configuration = configuration;
            _whatsAppWorkflowService = whatsAppWorkflowService;
            _loggingService = loggingServiceFactory("WorkflowDefinitionsController");
            _workflowEngine = workflowEngine; // 重新啟用執行引擎
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
            
            // 清理無效的 edges
            def.Json = CleanInvalidEdges(def.Json);
            
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
        
        // 清理流程定義中的無效 edges
        private string CleanInvalidEdges(string json)
        {
            if (string.IsNullOrEmpty(json)) return json;
            
            try
            {
                using var document = JsonDocument.Parse(json);
                var root = document.RootElement;
                
                // 獲取所有節點 ID
                var nodeIds = new HashSet<string>();
                if (root.TryGetProperty("nodes", out var nodesElement))
                {
                    foreach (var node in nodesElement.EnumerateArray())
                    {
                        if (node.TryGetProperty("id", out var idElement))
                        {
                            nodeIds.Add(idElement.GetString() ?? "");
                        }
                    }
                }
                
                // 過濾有效的 edges
                var validEdges = new List<JsonElement>();
                if (root.TryGetProperty("edges", out var edgesElement))
                {
                    foreach (var edge in edgesElement.EnumerateArray())
                    {
                        var hasValidSource = edge.TryGetProperty("source", out var sourceElement) && 
                                           nodeIds.Contains(sourceElement.GetString() ?? "");
                        var hasValidTarget = edge.TryGetProperty("target", out var targetElement) && 
                                           nodeIds.Contains(targetElement.GetString() ?? "");
                        
                        if (hasValidSource && hasValidTarget)
                        {
                            validEdges.Add(edge);
                        }
                    }
                }
                
                // 重新構建 JSON
                var options = new JsonWriterOptions { Indented = false };
                using var stream = new System.IO.MemoryStream();
                using (var writer = new Utf8JsonWriter(stream, options))
                {
                    writer.WriteStartObject();
                    
                    // 寫入 nodes
                    if (root.TryGetProperty("nodes", out var nodes))
                    {
                        writer.WritePropertyName("nodes");
                        nodes.WriteTo(writer);
                    }
                    
                    // 寫入清理後的 edges
                    writer.WritePropertyName("edges");
                    writer.WriteStartArray();
                    foreach (var edge in validEdges)
                    {
                        edge.WriteTo(writer);
                    }
                    writer.WriteEndArray();
                    
                    writer.WriteEndObject();
                }
                
                return System.Text.Encoding.UTF8.GetString(stream.ToArray());
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"清理無效 edges 時發生錯誤: {ex.Message}", ex);
                return json; // 如果清理失敗，返回原始 JSON
            }
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
            
            try
            {
                // 1. 獲取所有相關的 WorkflowExecutions
                var executionIds = await _db.WorkflowExecutions
                    .Where(x => x.WorkflowDefinitionId == id)
                    .Select(x => x.Id)
                    .ToListAsync();

                if (executionIds.Any())
                {
                    // 2. 刪除 WorkflowDataSetQueryRecords
                    var queryResultIds = await _db.WorkflowDataSetQueryResults
                        .Where(x => executionIds.Contains(x.WorkflowExecutionId))
                        .Select(x => x.Id)
                        .ToListAsync();
                    
                    if (queryResultIds.Any())
                    {
                        var queryRecords = await _db.WorkflowDataSetQueryRecords
                            .Where(x => queryResultIds.Contains(x.QueryResultId))
                            .ToListAsync();
                        _db.WorkflowDataSetQueryRecords.RemoveRange(queryRecords);
                    }

                    // 3. 刪除 WorkflowDataSetQueryResults
                    var queryResults = await _db.WorkflowDataSetQueryResults
                        .Where(x => executionIds.Contains(x.WorkflowExecutionId))
                        .ToListAsync();
                    _db.WorkflowDataSetQueryResults.RemoveRange(queryResults);

                    // 4. 刪除 WorkflowMessageRecipients
                    var messageSendIds = await _db.WorkflowMessageSends
                        .Where(x => executionIds.Contains(x.WorkflowExecutionId))
                        .Select(x => x.Id)
                        .ToListAsync();
                    
                    if (messageSendIds.Any())
                    {
                        var messageRecipients = await _db.WorkflowMessageRecipients
                            .Where(x => messageSendIds.Contains(x.MessageSendId))
                            .ToListAsync();
                        _db.WorkflowMessageRecipients.RemoveRange(messageRecipients);
                    }

                    // 5. 刪除 WorkflowMessageSends
                    var messageSends = await _db.WorkflowMessageSends
                        .Where(x => executionIds.Contains(x.WorkflowExecutionId))
                        .ToListAsync();
                    _db.WorkflowMessageSends.RemoveRange(messageSends);

                    // 6. 刪除 WorkflowStepExecutions
                    var stepExecutions = await _db.WorkflowStepExecutions
                        .Where(x => executionIds.Contains(x.WorkflowExecutionId))
                        .ToListAsync();
                    _db.WorkflowStepExecutions.RemoveRange(stepExecutions);

                    // 7. 刪除 WorkflowExecutions
                    var executions = await _db.WorkflowExecutions
                        .Where(x => x.WorkflowDefinitionId == id)
                        .ToListAsync();
                    _db.WorkflowExecutions.RemoveRange(executions);
                }

                // 8. 最後刪除 WorkflowDefinition
                _db.WorkflowDefinitions.Remove(item);
                await _db.SaveChangesAsync();
                
                _loggingService.LogInformation($"成功刪除流程 {item.Name} (ID: {id}) 及其所有相關記錄");
                return NoContent();
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"刪除流程失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = "刪除流程失敗", details = ex.Message });
            }
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
                Status = "Enabled",
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

            try
            {
                // 1. 獲取所有相關的 WorkflowExecutions
                var executionIds = await _db.WorkflowExecutions
                    .Where(x => request.Ids.Contains(x.WorkflowDefinitionId))
                    .Select(x => x.Id)
                    .ToListAsync();

                if (executionIds.Any())
                {
                    // 2. 刪除 WorkflowDataSetQueryRecords
                    var queryResultIds = await _db.WorkflowDataSetQueryResults
                        .Where(x => executionIds.Contains(x.WorkflowExecutionId))
                        .Select(x => x.Id)
                        .ToListAsync();
                    
                    if (queryResultIds.Any())
                    {
                        var queryRecords = await _db.WorkflowDataSetQueryRecords
                            .Where(x => queryResultIds.Contains(x.QueryResultId))
                            .ToListAsync();
                        _db.WorkflowDataSetQueryRecords.RemoveRange(queryRecords);
                    }

                    // 3. 刪除 WorkflowDataSetQueryResults
                    var queryResults = await _db.WorkflowDataSetQueryResults
                        .Where(x => executionIds.Contains(x.WorkflowExecutionId))
                        .ToListAsync();
                    _db.WorkflowDataSetQueryResults.RemoveRange(queryResults);

                    // 4. 刪除 WorkflowMessageRecipients
                    var messageSendIds = await _db.WorkflowMessageSends
                        .Where(x => executionIds.Contains(x.WorkflowExecutionId))
                        .Select(x => x.Id)
                        .ToListAsync();
                    
                    if (messageSendIds.Any())
                    {
                        var messageRecipients = await _db.WorkflowMessageRecipients
                            .Where(x => messageSendIds.Contains(x.MessageSendId))
                            .ToListAsync();
                        _db.WorkflowMessageRecipients.RemoveRange(messageRecipients);
                    }

                    // 5. 刪除 WorkflowMessageSends
                    var messageSends = await _db.WorkflowMessageSends
                        .Where(x => executionIds.Contains(x.WorkflowExecutionId))
                        .ToListAsync();
                    _db.WorkflowMessageSends.RemoveRange(messageSends);

                    // 6. 刪除 WorkflowStepExecutions
                    var stepExecutions = await _db.WorkflowStepExecutions
                        .Where(x => executionIds.Contains(x.WorkflowExecutionId))
                        .ToListAsync();
                    _db.WorkflowStepExecutions.RemoveRange(stepExecutions);

                    // 7. 刪除 WorkflowExecutions
                    var executions = await _db.WorkflowExecutions
                        .Where(x => request.Ids.Contains(x.WorkflowDefinitionId))
                        .ToListAsync();
                    _db.WorkflowExecutions.RemoveRange(executions);
                }

                // 8. 最後刪除 WorkflowDefinitions
                _db.WorkflowDefinitions.RemoveRange(workflowsToDelete);
                await _db.SaveChangesAsync();

                _loggingService.LogInformation($"成功批量刪除 {workflowsToDelete.Count} 個流程及其所有相關記錄");
                return Ok(new { success = true, deletedCount = workflowsToDelete.Count });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"批量刪除流程失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = "批量刪除流程失敗", details = ex.Message });
            }
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

            var newStatus = request.IsActive ? "Enabled" : "Disabled";
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

            if (workflow.Status != "Active" && workflow.Status != "Enabled")
            {
                return BadRequest(new { error = "Workflow is not active, cannot execute" });
            }

            try
            {
                _loggingService.LogInformation($"=== 手動啟動流程開始 ===");
                _loggingService.LogInformation($"流程 ID: {id}");
                _loggingService.LogInformation($"流程名稱: {workflow.Name}");
                _loggingService.LogInformation($"流程狀態: {workflow.Status}");
                
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

                // 調用 WorkflowEngine 服務來執行工作流程
                var executionResult = await _workflowEngine.ExecuteWorkflow(execution.Id, request.InputData);

                // 更新執行記錄的狀態和結果
                execution.Status = executionResult.Status;
                execution.OutputJson = JsonSerializer.Serialize(executionResult.OutputData);

                await _db.SaveChangesAsync();

                return Ok(new
                {
                    success = true,
                    executionId = execution.Id,
                    message = "Workflow started and executed successfully"
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