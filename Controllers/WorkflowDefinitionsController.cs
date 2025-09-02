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