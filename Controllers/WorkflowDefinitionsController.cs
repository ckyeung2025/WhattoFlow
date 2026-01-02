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

        // 獲取當前用戶的名稱
        private string GetCurrentUserName()
        {
            var userIdClaim = User.FindFirst("user_id");
            if (userIdClaim != null && Guid.TryParse(userIdClaim.Value, out Guid userId))
            {
                var user = _db.Users.FirstOrDefault(u => u.Id == userId);
                if (user != null && !string.IsNullOrEmpty(user.Name))
                {
                    return user.Name;
                }
                // 如果沒有名稱，使用帳號
                if (user != null && !string.IsNullOrEmpty(user.Account))
                {
                    return user.Account;
                }
            }
            return "系統"; // 如果無法獲取用戶信息，返回默認值
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
            def.CreatedAt = DateTime.UtcNow; // 使用 UTC 時間
            def.CreatedBy = GetCurrentUserName(); // 設置為當前用戶的名稱
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
            item.UpdatedAt = DateTime.UtcNow; // 使用 UTC 時間
            item.UpdatedBy = GetCurrentUserName(); // 設置為當前用戶的名稱
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

        // POST: api/workflowdefinitions/batch-related-records
        [HttpPost("batch-related-records")]
        public async Task<IActionResult> GetBatchRelatedRecords([FromBody] WorkflowBatchDeleteRequest request)
        {
            var companyId = GetCurrentUserCompanyId();
            if (!companyId.HasValue)
            {
                return Unauthorized(new { error = "無法識別用戶公司" });
            }

            var workflows = await _db.WorkflowDefinitions
                .Where(x => request.Ids.Contains(x.Id) && x.CompanyId == companyId.Value)
                .ToListAsync();

            if (!workflows.Any())
            {
                return NotFound(new { error = "未找到流程" });
            }

            try
            {
                // 獲取所有相關的 WorkflowExecutions
                var executionIds = await _db.WorkflowExecutions
                    .Where(x => request.Ids.Contains(x.WorkflowDefinitionId))
                    .Select(x => x.Id)
                    .ToListAsync();

                // 計算各類相關記錄數量
                var executionCount = executionIds.Count;
                var stepExecutionCount = 0;
                var messageSendCount = 0;
                var messageRecipientCount = 0;
                var queryResultCount = 0;
                var queryRecordCount = 0;
                var eformInstanceCount = 0;
                var messageValidationCount = 0;
                var chatMsgCount = 0;
                var processVariableValueCount = 0;
                var processVariableDefinitionCount = 0;

                if (executionIds.Any())
                {
                    stepExecutionCount = await _db.WorkflowStepExecutions
                        .Where(x => executionIds.Contains(x.WorkflowExecutionId))
                        .CountAsync();
                    
                    messageSendCount = await _db.WorkflowMessageSends
                        .Where(x => executionIds.Contains(x.WorkflowExecutionId))
                        .CountAsync();
                    
                    var messageSendIds = await _db.WorkflowMessageSends
                        .Where(x => executionIds.Contains(x.WorkflowExecutionId))
                        .Select(x => x.Id)
                        .ToListAsync();
                    
                    if (messageSendIds.Any())
                    {
                        messageRecipientCount = await _db.WorkflowMessageRecipients
                            .Where(x => messageSendIds.Contains(x.MessageSendId))
                            .CountAsync();
                    }
                    
                    queryResultCount = await _db.WorkflowDataSetQueryResults
                        .Where(x => executionIds.Contains(x.WorkflowExecutionId))
                        .CountAsync();
                    
                    var queryResultIds = await _db.WorkflowDataSetQueryResults
                        .Where(x => executionIds.Contains(x.WorkflowExecutionId))
                        .Select(x => x.Id)
                        .ToListAsync();
                    
                    if (queryResultIds.Any())
                    {
                        queryRecordCount = await _db.WorkflowDataSetQueryRecords
                            .Where(x => queryResultIds.Contains(x.QueryResultId))
                            .CountAsync();
                    }
                    
                    eformInstanceCount = await _db.EFormInstances
                        .Where(x => executionIds.Contains(x.WorkflowExecutionId))
                        .CountAsync();
                    
                    messageValidationCount = await _db.MessageValidations
                        .Where(x => executionIds.Contains(x.WorkflowExecutionId))
                        .CountAsync();
                    
                    chatMsgCount = await _db.WhatsAppMonitorChatMsgs
                        .Where(x => x.WorkflowInstanceId.HasValue && executionIds.Contains(x.WorkflowInstanceId.Value))
                        .CountAsync();
                    
                    processVariableValueCount = await _db.ProcessVariableValues
                        .Where(x => executionIds.Contains(x.WorkflowExecutionId))
                        .CountAsync();
                }
                
                processVariableDefinitionCount = await _db.ProcessVariableDefinitions
                    .Where(x => request.Ids.Contains(x.WorkflowDefinitionId))
                    .CountAsync();

                var relatedRecords = new
                {
                    executionCount,
                    stepExecutionCount,
                    messageSendCount,
                    messageRecipientCount,
                    queryResultCount,
                    queryRecordCount,
                    eformInstanceCount,
                    messageValidationCount,
                    chatMsgCount,
                    processVariableValueCount,
                    processVariableDefinitionCount
                };

                return Ok(relatedRecords);
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"批量查詢相關記錄失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = "批量查詢相關記錄失敗", details = ex.Message });
            }
        }

        // GET: api/workflowdefinitions/{id}/related-records
        [HttpGet("{id}/related-records")]
        public async Task<IActionResult> GetRelatedRecords(int id)
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
                // 獲取所有相關的 WorkflowExecutions
                var executionIds = await _db.WorkflowExecutions
                    .Where(x => x.WorkflowDefinitionId == id)
                    .Select(x => x.Id)
                    .ToListAsync();

                // 計算各類相關記錄數量
                var executionCount = executionIds.Count;
                var stepExecutionCount = 0;
                var messageSendCount = 0;
                var messageRecipientCount = 0;
                var queryResultCount = 0;
                var queryRecordCount = 0;
                var eformInstanceCount = 0;
                var messageValidationCount = 0;
                var chatMsgCount = 0;
                var processVariableValueCount = 0;
                var processVariableDefinitionCount = 0;

                if (executionIds.Any())
                {
                    stepExecutionCount = await _db.WorkflowStepExecutions
                        .Where(x => executionIds.Contains(x.WorkflowExecutionId))
                        .CountAsync();
                    
                    messageSendCount = await _db.WorkflowMessageSends
                        .Where(x => executionIds.Contains(x.WorkflowExecutionId))
                        .CountAsync();
                    
                    var messageSendIds = await _db.WorkflowMessageSends
                        .Where(x => executionIds.Contains(x.WorkflowExecutionId))
                        .Select(x => x.Id)
                        .ToListAsync();
                    
                    if (messageSendIds.Any())
                    {
                        messageRecipientCount = await _db.WorkflowMessageRecipients
                            .Where(x => messageSendIds.Contains(x.MessageSendId))
                            .CountAsync();
                    }
                    
                    queryResultCount = await _db.WorkflowDataSetQueryResults
                        .Where(x => executionIds.Contains(x.WorkflowExecutionId))
                        .CountAsync();
                    
                    var queryResultIds = await _db.WorkflowDataSetQueryResults
                        .Where(x => executionIds.Contains(x.WorkflowExecutionId))
                        .Select(x => x.Id)
                        .ToListAsync();
                    
                    if (queryResultIds.Any())
                    {
                        queryRecordCount = await _db.WorkflowDataSetQueryRecords
                            .Where(x => queryResultIds.Contains(x.QueryResultId))
                            .CountAsync();
                    }
                    
                    eformInstanceCount = await _db.EFormInstances
                        .Where(x => executionIds.Contains(x.WorkflowExecutionId))
                        .CountAsync();
                    
                    messageValidationCount = await _db.MessageValidations
                        .Where(x => executionIds.Contains(x.WorkflowExecutionId))
                        .CountAsync();
                    
                    chatMsgCount = await _db.WhatsAppMonitorChatMsgs
                        .Where(x => x.WorkflowInstanceId.HasValue && executionIds.Contains(x.WorkflowInstanceId.Value))
                        .CountAsync();
                    
                    processVariableValueCount = await _db.ProcessVariableValues
                        .Where(x => executionIds.Contains(x.WorkflowExecutionId))
                        .CountAsync();
                }
                
                processVariableDefinitionCount = await _db.ProcessVariableDefinitions
                    .Where(x => x.WorkflowDefinitionId == id)
                    .CountAsync();

                var relatedRecords = new
                {
                    executionCount,
                    stepExecutionCount,
                    messageSendCount,
                    messageRecipientCount,
                    queryResultCount,
                    queryRecordCount,
                    eformInstanceCount,
                    messageValidationCount,
                    chatMsgCount,
                    processVariableValueCount,
                    processVariableDefinitionCount
                };

                return Ok(relatedRecords);
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"查詢相關記錄失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = "查詢相關記錄失敗", details = ex.Message });
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

                    // 6. 刪除 EFormInstances（需要先刪除相關的 EFormApprovals）
                    var eformInstances = await _db.EFormInstances
                        .Where(x => executionIds.Contains(x.WorkflowExecutionId))
                        .ToListAsync();
                    
                    if (eformInstances.Any())
                    {
                        // 先獲取所有 EFormInstance IDs
                        var eformInstanceIds = eformInstances.Select(x => x.Id).ToList();
                        
                        // 刪除相關的 EFormApprovals
                        var eformApprovals = await _db.EFormApprovals
                            .Where(x => eformInstanceIds.Contains(x.EFormInstanceId))
                            .ToListAsync();
                        if (eformApprovals.Any())
                        {
                            _db.EFormApprovals.RemoveRange(eformApprovals);
                        }
                        
                        // 然後刪除 EFormInstances
                        _db.EFormInstances.RemoveRange(eformInstances);
                    }

                    // 7. 刪除 MessageValidations
                    var messageValidations = await _db.MessageValidations
                        .Where(x => executionIds.Contains(x.WorkflowExecutionId))
                        .ToListAsync();
                    _db.MessageValidations.RemoveRange(messageValidations);

                    // 8. 刪除 WhatsAppMonitorChatMsgs（設置為軟刪除或直接刪除）
                    var chatMsgs = await _db.WhatsAppMonitorChatMsgs
                        .Where(x => x.WorkflowInstanceId.HasValue && executionIds.Contains(x.WorkflowInstanceId.Value))
                        .ToListAsync();
                    foreach (var msg in chatMsgs)
                    {
                        msg.WorkflowInstanceId = null; // 斷開關聯，保留消息記錄
                    }
                    _db.WhatsAppMonitorChatMsgs.UpdateRange(chatMsgs);

                    // 9. 刪除 ProcessVariableValues
                    var processVariableValues = await _db.ProcessVariableValues
                        .Where(x => executionIds.Contains(x.WorkflowExecutionId))
                        .ToListAsync();
                    _db.ProcessVariableValues.RemoveRange(processVariableValues);

                    // 注意：WhatsAppMessage 表已廢棄，已被 WhatsAppMonitorChatMsg 取代
                    // WhatsAppMonitorChatMsg 已在步驟 8 中處理（斷開關聯）

                    // 10. 處理 UserSessions（斷開關聯，保留 session 記錄）
                    var userSessions = await _db.UserSessions
                        .Where(x => x.CurrentWorkflowExecutionId.HasValue && executionIds.Contains(x.CurrentWorkflowExecutionId.Value))
                        .ToListAsync();
                    foreach (var session in userSessions)
                    {
                        session.CurrentWorkflowExecutionId = null; // 斷開關聯，保留 session 記錄
                    }
                    if (userSessions.Any())
                    {
                        _db.UserSessions.UpdateRange(userSessions);
                    }

                    // 11. 刪除 WorkflowStepExecutions
                    var stepExecutions = await _db.WorkflowStepExecutions
                        .Where(x => executionIds.Contains(x.WorkflowExecutionId))
                        .ToListAsync();
                    _db.WorkflowStepExecutions.RemoveRange(stepExecutions);

                    // 12. 刪除 WorkflowExecutions
                    var executions = await _db.WorkflowExecutions
                        .Where(x => x.WorkflowDefinitionId == id)
                        .ToListAsync();
                    _db.WorkflowExecutions.RemoveRange(executions);
                }

                // 13. 刪除 ProcessVariableDefinitions
                var processVariableDefinitions = await _db.ProcessVariableDefinitions
                    .Where(x => x.WorkflowDefinitionId == id)
                    .ToListAsync();
                _db.ProcessVariableDefinitions.RemoveRange(processVariableDefinitions);

                // 14. 最後刪除 WorkflowDefinition
                _db.WorkflowDefinitions.Remove(item);
                await _db.SaveChangesAsync();
                
                _loggingService.LogInformation($"成功刪除流程 {item.Name} (ID: {id}) 及其所有相關記錄");
                return NoContent();
            }
            catch (DbUpdateException dbEx)
            {
                // 處理數據庫更新異常，可能是外鍵約束問題
                var innerEx = dbEx.InnerException;
                var errorMessage = dbEx.Message;
                if (innerEx != null)
                {
                    errorMessage += $" | Inner: {innerEx.Message}";
                }
                
                _loggingService.LogError($"刪除流程失敗 (數據庫錯誤): {errorMessage}", dbEx);
                
                // 檢查是否是外鍵約束錯誤
                if (errorMessage.Contains("FOREIGN KEY") || errorMessage.Contains("reference constraint") || errorMessage.Contains("DELETE statement conflicted"))
                {
                    return StatusCode(500, new { 
                        error = "刪除流程失敗", 
                        details = "存在外鍵約束，無法刪除。請先刪除相關記錄。",
                        technicalDetails = errorMessage
                    });
                }
                
                return StatusCode(500, new { error = "刪除流程失敗", details = errorMessage });
            }
            catch (Exception ex)
            {
                var innerEx = ex.InnerException;
                var errorMessage = ex.Message;
                if (innerEx != null)
                {
                    errorMessage += $" | Inner: {innerEx.Message}";
                }
                
                _loggingService.LogError($"刪除流程失敗: {errorMessage}", ex);
                return StatusCode(500, new { error = "刪除流程失敗", details = errorMessage });
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
                CreatedBy = GetCurrentUserName(), // 設置為當前用戶的名稱
                UpdatedBy = GetCurrentUserName(), // 設置為當前用戶的名稱
                CreatedAt = DateTime.UtcNow, // 使用 UTC 時間
                UpdatedAt = DateTime.UtcNow, // 使用 UTC 時間
                CompanyId = companyId.Value // 設置為當前用戶的公司ID
            };

            _db.WorkflowDefinitions.Add(newWorkflow);
            await _db.SaveChangesAsync();

            // 複製流程變數定義
            var originalVariables = await _db.ProcessVariableDefinitions
                .Where(x => x.WorkflowDefinitionId == id)
                .ToListAsync();

            if (originalVariables.Any())
            {
                var newVariables = originalVariables.Select(v => new ProcessVariableDefinition
                {
                    WorkflowDefinitionId = newWorkflow.Id,
                    VariableName = v.VariableName,
                    DisplayName = v.DisplayName,
                    DataType = v.DataType,
                    Description = v.Description,
                    IsRequired = v.IsRequired,
                    DefaultValue = v.DefaultValue,
                    ValidationRules = v.ValidationRules,
                    JsonSchema = v.JsonSchema,
                    CreatedBy = GetCurrentUserName(),
                    CreatedAt = DateTime.UtcNow
                }).ToList();

                _db.ProcessVariableDefinitions.AddRange(newVariables);
                await _db.SaveChangesAsync();
            }

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

                    // 6. 刪除 EFormInstances（需要先刪除相關的 EFormApprovals）
                    var eformInstances = await _db.EFormInstances
                        .Where(x => executionIds.Contains(x.WorkflowExecutionId))
                        .ToListAsync();
                    
                    if (eformInstances.Any())
                    {
                        // 先獲取所有 EFormInstance IDs
                        var eformInstanceIds = eformInstances.Select(x => x.Id).ToList();
                        
                        // 刪除相關的 EFormApprovals
                        var eformApprovals = await _db.EFormApprovals
                            .Where(x => eformInstanceIds.Contains(x.EFormInstanceId))
                            .ToListAsync();
                        if (eformApprovals.Any())
                        {
                            _db.EFormApprovals.RemoveRange(eformApprovals);
                        }
                        
                        // 然後刪除 EFormInstances
                        _db.EFormInstances.RemoveRange(eformInstances);
                    }

                    // 7. 刪除 MessageValidations
                    var messageValidations = await _db.MessageValidations
                        .Where(x => executionIds.Contains(x.WorkflowExecutionId))
                        .ToListAsync();
                    _db.MessageValidations.RemoveRange(messageValidations);

                    // 8. 刪除 WhatsAppMonitorChatMsgs（斷開關聯，保留消息記錄）
                    var chatMsgs = await _db.WhatsAppMonitorChatMsgs
                        .Where(x => x.WorkflowInstanceId.HasValue && executionIds.Contains(x.WorkflowInstanceId.Value))
                        .ToListAsync();
                    foreach (var msg in chatMsgs)
                    {
                        msg.WorkflowInstanceId = null; // 斷開關聯，保留消息記錄
                    }
                    _db.WhatsAppMonitorChatMsgs.UpdateRange(chatMsgs);

                    // 9. 刪除 ProcessVariableValues
                    var processVariableValues = await _db.ProcessVariableValues
                        .Where(x => executionIds.Contains(x.WorkflowExecutionId))
                        .ToListAsync();
                    _db.ProcessVariableValues.RemoveRange(processVariableValues);

                    // 注意：WhatsAppMessage 表已廢棄，已被 WhatsAppMonitorChatMsg 取代
                    // WhatsAppMonitorChatMsg 已在步驟 8 中處理（斷開關聯）

                    // 10. 處理 UserSessions（斷開關聯，保留 session 記錄）
                    var userSessions = await _db.UserSessions
                        .Where(x => x.CurrentWorkflowExecutionId.HasValue && executionIds.Contains(x.CurrentWorkflowExecutionId.Value))
                        .ToListAsync();
                    foreach (var session in userSessions)
                    {
                        session.CurrentWorkflowExecutionId = null; // 斷開關聯，保留 session 記錄
                    }
                    if (userSessions.Any())
                    {
                        _db.UserSessions.UpdateRange(userSessions);
                    }

                    // 11. 刪除 WorkflowStepExecutions
                    var stepExecutions = await _db.WorkflowStepExecutions
                        .Where(x => executionIds.Contains(x.WorkflowExecutionId))
                        .ToListAsync();
                    _db.WorkflowStepExecutions.RemoveRange(stepExecutions);

                    // 12. 刪除 WorkflowExecutions
                    var executions = await _db.WorkflowExecutions
                        .Where(x => request.Ids.Contains(x.WorkflowDefinitionId))
                        .ToListAsync();
                    _db.WorkflowExecutions.RemoveRange(executions);
                }

                // 13. 刪除 ProcessVariableDefinitions
                var processVariableDefinitions = await _db.ProcessVariableDefinitions
                    .Where(x => request.Ids.Contains(x.WorkflowDefinitionId))
                    .ToListAsync();
                _db.ProcessVariableDefinitions.RemoveRange(processVariableDefinitions);

                // 14. 最後刪除 WorkflowDefinitions
                _db.WorkflowDefinitions.RemoveRange(workflowsToDelete);
                await _db.SaveChangesAsync();

                _loggingService.LogInformation($"成功批量刪除 {workflowsToDelete.Count} 個流程及其所有相關記錄");
                return Ok(new { success = true, deletedCount = workflowsToDelete.Count });
            }
            catch (DbUpdateException dbEx)
            {
                // 處理數據庫更新異常，可能是外鍵約束問題
                var innerEx = dbEx.InnerException;
                var errorMessage = dbEx.Message;
                if (innerEx != null)
                {
                    errorMessage += $" | Inner: {innerEx.Message}";
                }
                
                _loggingService.LogError($"批量刪除流程失敗 (數據庫錯誤): {errorMessage}", dbEx);
                
                // 檢查是否是外鍵約束錯誤
                if (errorMessage.Contains("FOREIGN KEY") || errorMessage.Contains("reference constraint") || errorMessage.Contains("DELETE statement conflicted"))
                {
                    return StatusCode(500, new { 
                        error = "批量刪除流程失敗", 
                        details = "存在外鍵約束，無法刪除。請先刪除相關記錄。",
                        technicalDetails = errorMessage
                    });
                }
                
                return StatusCode(500, new { error = "批量刪除流程失敗", details = errorMessage });
            }
            catch (Exception ex)
            {
                var innerEx = ex.InnerException;
                var errorMessage = ex.Message;
                if (innerEx != null)
                {
                    errorMessage += $" | Inner: {innerEx.Message}";
                }
                
                _loggingService.LogError($"批量刪除流程失敗: {errorMessage}", ex);
                return StatusCode(500, new { error = "批量刪除流程失敗", details = errorMessage });
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
            var currentUserName = GetCurrentUserName(); // 獲取當前用戶名稱
            foreach (var workflow in workflowsToUpdate)
            {
                workflow.Status = newStatus;
                workflow.UpdatedAt = DateTime.UtcNow; // 使用 UTC 時間
                workflow.UpdatedBy = currentUserName; // 設置為當前用戶的名稱
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
                    StartedAt = DateTime.UtcNow, // 使用 UTC 時間
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