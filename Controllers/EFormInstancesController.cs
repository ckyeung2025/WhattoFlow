using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PurpleRice.Data;
using PurpleRice.Models;
using PurpleRice.Services;
using PurpleRice.Services.WebhookServices;
using System;
using System.Linq;
using System.Threading.Tasks;
using System.Collections.Generic;
using System.Text.Json;
using System.Text;

namespace PurpleRice.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class EFormInstancesController : ControllerBase
    {
                 private readonly PurpleRiceDbContext _db;
         private readonly IServiceProvider _serviceProvider;
         private readonly WhatsAppWorkflowService _whatsAppWorkflowService;
         private readonly LoggingService _loggingService;
         private readonly WebhookMessageProcessingService _webhookMessageProcessingService;
         private readonly UserSessionService _userSessionService;
         
         public EFormInstancesController(PurpleRiceDbContext db, IServiceProvider serviceProvider, WhatsAppWorkflowService whatsAppWorkflowService, Func<string, LoggingService> loggingServiceFactory, WebhookMessageProcessingService webhookMessageProcessingService, UserSessionService userSessionService)
         {
             _db = db;
             _serviceProvider = serviceProvider;
             _whatsAppWorkflowService = whatsAppWorkflowService;
             _loggingService = loggingServiceFactory("EFormInstancesController");
             _webhookMessageProcessingService = webhookMessageProcessingService;
             _userSessionService = userSessionService;
         }

        // GET: api/eforminstances/pending - 獲取所有待處理的表單實例
        [HttpGet("pending")]
        public async Task<IActionResult> GetPendingEformInstances(
            int page = 1, 
            int pageSize = 20,
            string search = null,
            string priority = null)
        {
            try
            {
                _loggingService.LogInformation("獲取待處理的表單實例");
                
                var query = _db.EFormInstances
                    .Include(e => e.EFormDefinition)
                    .Where(e => e.Status == "Pending")
                    .AsQueryable();

                // 搜索篩選
                if (!string.IsNullOrEmpty(search))
                {
                    query = query.Where(e => 
                        e.InstanceName.Contains(search) ||
                        (e.EFormDefinition != null && e.EFormDefinition.Name.Contains(search)) ||
                        e.UserMessage.Contains(search)
                    );
                }

                // 優先級篩選（如果表單有優先級字段）
                // 注意：這裡假設表單實例有優先級字段，如果沒有可以移除這個篩選
                // if (!string.IsNullOrEmpty(priority) && priority != "all")
                // {
                //     query = query.Where(e => e.Priority == priority);
                // }

                // 計算總數
                var total = await query.CountAsync();

                // 分頁
                var eformInstances = await query
                    .OrderByDescending(e => e.CreatedAt)
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .Select(e => new
                    {
                        e.Id,
                        formName = e.EFormDefinition != null ? e.EFormDefinition.Name : "未命名表單",
                        e.InstanceName,
                        e.Status,
                        e.CreatedAt,
                        e.UserMessage,
                        e.WorkflowExecutionId,
                        createdBy = "系統",
                        dueDate = e.CreatedAt.AddDays(7), // 假設 7 天後到期
                        priority = "High" // 暫時設為高優先級
                    })
                    .ToListAsync();

                _loggingService.LogInformation($"找到 {eformInstances.Count} 個待處理的表單實例");

                return Ok(new
                {
                    data = eformInstances,
                    total = total,
                    page = page,
                    pageSize = pageSize,
                    totalPages = (int)System.Math.Ceiling((double)total / pageSize)
                });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取待處理表單實例時發生錯誤: {ex.Message}");
                return StatusCode(500, new { error = $"獲取待處理表單實例失敗: {ex.Message}" });
            }
        }

        // GET: api/eforminstances/statistics/pending - 獲取待處理表單統計
        [HttpGet("statistics/pending")]
        public async Task<IActionResult> GetPendingStatistics()
        {
            try
            {
                _loggingService.LogInformation("獲取待處理表單統計數據");
                
                var total = await _db.EFormInstances
                    .Where(e => e.Status == "Pending")
                    .CountAsync();

                var overdue = await _db.EFormInstances
                    .Where(e => e.Status == "Pending" && e.CreatedAt < DateTime.UtcNow.AddDays(-7))
                    .CountAsync();

                var urgent = await _db.EFormInstances
                    .Where(e => e.Status == "Pending" && e.CreatedAt < DateTime.UtcNow.AddDays(-3))
                    .CountAsync();

                var statistics = new
                {
                    total = total,
                    pending = total,
                    overdue = overdue,
                    urgent = urgent
                };

                _loggingService.LogInformation($"統計數據: 總計 {total}, 逾期 {overdue}, 緊急 {urgent}");

                return Ok(statistics);
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取待處理表單統計時發生錯誤: {ex.Message}");
                return StatusCode(500, new { error = $"獲取統計數據失敗: {ex.Message}" });
            }
        }

        // GET: api/eforminstances/statistics/by-status - 獲取按狀態分組的表單統計
        [HttpGet("statistics/by-status")]
        public async Task<IActionResult> GetStatisticsByStatus()
        {
            try
            {
                _loggingService.LogInformation("📊 獲取表單狀態分組統計數據");
                
                var pending = await _db.EFormInstances
                    .Where(e => e.Status == "Pending")
                    .CountAsync();

                var approved = await _db.EFormInstances
                    .Where(e => e.Status == "Approved")
                    .CountAsync();

                var rejected = await _db.EFormInstances
                    .Where(e => e.Status == "Rejected")
                    .CountAsync();

                var total = pending + approved + rejected;

                var statistics = new
                {
                    total = total,
                    pending = pending,
                    approved = approved,
                    rejected = rejected
                };

                _loggingService.LogInformation($"✅ 狀態統計: 總計={total}, 待處理={pending}, 已批准={approved}, 已拒絕={rejected}");

                return Ok(statistics);
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"❌ 獲取狀態統計時發生錯誤: {ex.Message}");
                return StatusCode(500, new { error = $"獲取統計數據失敗: {ex.Message}" });
            }
        }

        // GET: api/eforminstances/{id} - 獲取表單實例
        [HttpGet("{id}")]
        public async Task<IActionResult> Get(Guid id)
        {
            try
            {
                var instance = await _db.EFormInstances
                    .Include(e => e.EFormDefinition)
                    .FirstOrDefaultAsync(e => e.Id == id);

                if (instance == null)
                {
                    return NotFound(new { error = "找不到表單實例" });
                }

                return Ok(new
                {
                    id = instance.Id,
                    instanceName = instance.InstanceName,
                    formName = instance.EFormDefinition?.Name,
                    status = instance.Status,
                    htmlCode = instance.FilledHtmlCode ?? instance.OriginalHtmlCode,
                    userMessage = instance.UserMessage,
                    createdAt = instance.CreatedAt,
                    approvalBy = instance.ApprovalBy,
                    approvalAt = instance.ApprovalAt,
                    approvalNote = instance.ApprovalNote
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = $"獲取表單實例失敗: {ex.Message}" });
            }
        }

        // POST: api/eforminstances/{id}/approve - 批准表單
        [HttpPost("{id}/approve")]
        public async Task<IActionResult> Approve(Guid id, [FromBody] ApprovalRequest request)
        {
            try
            {
                _loggingService.LogInformation($"收到批准請求，ID: {id}");
                _loggingService.LogInformation($"請求數據: {System.Text.Json.JsonSerializer.Serialize(request)}");
                
                var instance = await _db.EFormInstances
                    .FirstOrDefaultAsync(e => e.Id == id);

                if (instance == null)
                {
                    _loggingService.LogWarning($"找不到表單實例，ID: {id}");
                    return NotFound(new { error = "找不到表單實例" });
                }

                _loggingService.LogInformation($"找到表單實例，當前狀態: {instance.Status}");

                if (instance.Status != "Pending")
                {
                    _loggingService.LogWarning($"表單狀態不是 Pending，當前狀態: {instance.Status}");
                    return BadRequest(new { error = "表單已經被處理過" });
                }

                // 更新表單實例狀態
                instance.Status = "Approved";
                instance.ApprovalBy = request.ApprovedBy ?? "System";
                instance.ApprovalAt = DateTime.UtcNow;
                instance.ApprovalNote = request.Note;
                instance.UpdatedAt = DateTime.UtcNow;

                _loggingService.LogInformation($"準備創建審批記錄");

                // 創建審批記錄
                var approval = new EFormApproval
                {
                    EFormInstanceId = instance.Id,
                    Action = "Approve",
                    ApprovedBy = request.ApprovedBy ?? "System",
                    ApprovalNote = request.Note,
                    ApprovedAt = DateTime.UtcNow
                };

                _db.EFormApprovals.Add(approval);
                await _db.SaveChangesAsync();

                _loggingService.LogInformation($"審批記錄已保存，繼續執行工作流程");

                // 繼續執行工作流程
                _loggingService.LogInformation($"準備執行工作流程，WorkflowExecutionId: {instance.WorkflowExecutionId}");
                
                // 使用 WebhookMessageProcessingService 繼續流程
                try
                {
                    _loggingService.LogInformation($"開始調用 WebhookMessageProcessingService 繼續流程");
                    await _webhookMessageProcessingService.ContinueWorkflowAfterFormApprovalAsync(instance.Id, "Approved");
                    _loggingService.LogInformation($"流程繼續完成");
                }
                catch (Exception ex)
                {
                    _loggingService.LogError($"繼續流程失敗: {ex.Message}", ex);
                }

                _loggingService.LogInformation($"批准操作完成，返回成功響應");

                return Ok(new
                {
                    success = true,
                    message = "表單已批准",
                    instanceId = instance.Id,
                    status = instance.Status
                });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"批准表單時發生錯誤: {ex.Message}", ex);
                return StatusCode(500, new { error = $"批准表單失敗: {ex.Message}" });
            }
        }

        // POST: api/eforminstances/{id}/reject - 拒絕表單
        [HttpPost("{id}/reject")]
        public async Task<IActionResult> Reject(Guid id, [FromBody] ApprovalRequest request)
        {
            try
            {
                _loggingService.LogInformation($"收到拒絕請求，ID: {id}");
                _loggingService.LogInformation($"請求數據: {System.Text.Json.JsonSerializer.Serialize(request)}");
                
                var instance = await _db.EFormInstances
                    .FirstOrDefaultAsync(e => e.Id == id);

                if (instance == null)
                {
                    _loggingService.LogWarning($"找不到表單實例，ID: {id}");
                    return NotFound(new { error = "找不到表單實例" });
                }

                _loggingService.LogInformation($"找到表單實例，當前狀態: {instance.Status}");

                if (instance.Status != "Pending")
                {
                    _loggingService.LogWarning($"表單狀態不是 Pending，當前狀態: {instance.Status}");
                    return BadRequest(new { error = "表單已經被處理過" });
                }

                // 更新表單實例狀態
                instance.Status = "Rejected";
                instance.ApprovalBy = request.ApprovedBy ?? "System";
                instance.ApprovalAt = DateTime.UtcNow;
                instance.ApprovalNote = request.Note;
                instance.UpdatedAt = DateTime.UtcNow;

                _loggingService.LogInformation($"準備創建審批記錄");

                // 創建審批記錄
                var approval = new EFormApproval
                {
                    EFormInstanceId = instance.Id,
                    Action = "Reject",
                    ApprovedBy = request.ApprovedBy ?? "System",
                    ApprovalNote = request.Note,
                    ApprovedAt = DateTime.UtcNow
                };

                _db.EFormApprovals.Add(approval);
                await _db.SaveChangesAsync();

                _loggingService.LogInformation($"審批記錄已保存，繼續執行工作流程");

                // 繼續執行工作流程
                _loggingService.LogInformation($"準備執行工作流程，WorkflowExecutionId: {instance.WorkflowExecutionId}");
                
                // 使用 WebhookMessageProcessingService 繼續流程
                try
                {
                    _loggingService.LogInformation($"開始調用 WebhookMessageProcessingService 繼續流程");
                    await _webhookMessageProcessingService.ContinueWorkflowAfterFormApprovalAsync(instance.Id, "Rejected");
                    _loggingService.LogInformation($"流程繼續完成");
                }
                catch (Exception ex)
                {
                    _loggingService.LogError($"繼續流程失敗: {ex.Message}", ex);
                }

                _loggingService.LogInformation($"拒絕操作完成，返回成功響應");

                return Ok(new
                {
                    success = true,
                    message = "表單已拒絕",
                    instanceId = instance.Id,
                    status = instance.Status
                });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"拒絕表單時發生錯誤: {ex.Message}", ex);
                return StatusCode(500, new { error = $"拒絕表單失敗: {ex.Message}" });
            }
        }



     }
 
          // 工作流程圖相關類別
     public class WorkflowGraph
     {
         public List<WorkflowNodeWrapper> nodes { get; set; } = new();
         public List<WorkflowEdge> edges { get; set; } = new();
     }
 
     public class WorkflowNodeWrapper
     {
         public string id { get; set; } = "";
         public string type { get; set; } = "";
         public WorkflowNode data { get; set; } = new();
     }
 
     public class WorkflowNode
     {
         public string label { get; set; } = "";
         public string type { get; set; } = "";
         public string taskName { get; set; } = "";
         public string message { get; set; } = "";
         public string to { get; set; } = "";
         public string templateName { get; set; } = "";
         public string templateId { get; set; } = "";
         public string formName { get; set; } = "";
         public string formId { get; set; } = "";
         public string formDescription { get; set; } = "";
     }
 
     public class WorkflowEdge
     {
         public string source { get; set; } = "";
         public string target { get; set; } = "";
     }

    public class ApprovalRequest
    {
        public string ApprovedBy { get; set; } = string.Empty;
        public string Note { get; set; } = string.Empty;
    }
} 