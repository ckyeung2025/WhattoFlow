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
         private readonly IEFormTokenService _eFormTokenService;
         
         public EFormInstancesController(PurpleRiceDbContext db, IServiceProvider serviceProvider, WhatsAppWorkflowService whatsAppWorkflowService, Func<string, LoggingService> loggingServiceFactory, WebhookMessageProcessingService webhookMessageProcessingService, UserSessionService userSessionService, IEFormTokenService eFormTokenService)
         {
             _db = db;
             _serviceProvider = serviceProvider;
             _whatsAppWorkflowService = whatsAppWorkflowService;
             _loggingService = loggingServiceFactory("EFormInstancesController");
             _webhookMessageProcessingService = webhookMessageProcessingService;
             _userSessionService = userSessionService;
             _eFormTokenService = eFormTokenService;
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
                        e.FillType,
                        e.CreatedAt,
                        e.UserMessage,
                        e.WorkflowExecutionId,
                        createdBy = "系統",
                        dueDate = e.CreatedAt.AddDays(7), // 假設 7 天後到期
                        priority = "High", // 暫時設為高優先級
                        fieldDisplaySettings = e.EFormDefinition != null ? e.EFormDefinition.FieldDisplaySettings : null, // 新增：字段顯示設定
                        htmlCode = e.FilledHtmlCode ?? e.OriginalHtmlCode // 新增：HTML 代碼用於解析字段值
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

        // GET: api/eforminstances/approved - 獲取所有已批准的表單實例
        [HttpGet("approved")]
        public async Task<IActionResult> GetApprovedEformInstances(
            int page = 1, 
            int pageSize = 20,
            string search = null,
            string priority = null)
        {
            try
            {
                _loggingService.LogInformation("獲取已批准的表單實例");
                
                // 調試：檢查數據庫中所有狀態值
                var allStatuses = await _db.EFormInstances
                    .Select(e => e.Status)
                    .Distinct()
                    .ToListAsync();
                _loggingService.LogInformation($"數據庫中所有狀態值: {string.Join(", ", allStatuses)}");
                
                var query = _db.EFormInstances
                    .Include(e => e.EFormDefinition)
                    .Where(e => e.Status == "Approved")
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

                // 計算總數
                var total = await query.CountAsync();

                // 分頁
                var eformInstances = await query
                    .OrderByDescending(e => e.ApprovalAt ?? e.CreatedAt)
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .Select(e => new
                    {
                        e.Id,
                        formName = e.EFormDefinition != null ? e.EFormDefinition.Name : "未命名表單",
                        e.InstanceName,
                        e.Status,
                        e.FillType,
                        e.CreatedAt,
                        e.UserMessage,
                        e.WorkflowExecutionId,
                        createdBy = "系統",
                        dueDate = e.CreatedAt.AddDays(7),
                        priority = "High",
                        approvalBy = e.ApprovalBy,
                        approvalAt = e.ApprovalAt,
                        approvalNote = e.ApprovalNote,
                        fieldDisplaySettings = e.EFormDefinition != null ? e.EFormDefinition.FieldDisplaySettings : null, // 新增：字段顯示設定
                        htmlCode = e.FilledHtmlCode ?? e.OriginalHtmlCode // 新增：HTML 代碼用於解析字段值
                    })
                    .ToListAsync();

                _loggingService.LogInformation($"找到 {eformInstances.Count} 個已批准的表單實例");

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
                _loggingService.LogError($"獲取已批准表單實例時發生錯誤: {ex.Message}");
                return StatusCode(500, new { error = $"獲取已批准表單實例失敗: {ex.Message}" });
            }
        }

        // GET: api/eforminstances/rejected - 獲取所有已拒絕的表單實例
        [HttpGet("rejected")]
        public async Task<IActionResult> GetRejectedEformInstances(
            int page = 1, 
            int pageSize = 20,
            string search = null,
            string priority = null)
        {
            try
            {
                _loggingService.LogInformation("獲取已拒絕的表單實例");
                
                // 調試：檢查數據庫中所有狀態值
                var allStatuses = await _db.EFormInstances
                    .Select(e => e.Status)
                    .Distinct()
                    .ToListAsync();
                _loggingService.LogInformation($"數據庫中所有狀態值: {string.Join(", ", allStatuses)}");
                
                var query = _db.EFormInstances
                    .Include(e => e.EFormDefinition)
                    .Where(e => e.Status == "Rejected")
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

                // 計算總數
                var total = await query.CountAsync();

                // 分頁
                var eformInstances = await query
                    .OrderByDescending(e => e.ApprovalAt ?? e.CreatedAt)
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .Select(e => new
                    {
                        e.Id,
                        formName = e.EFormDefinition != null ? e.EFormDefinition.Name : "未命名表單",
                        e.InstanceName,
                        e.Status,
                        e.FillType,
                        e.CreatedAt,
                        e.UserMessage,
                        e.WorkflowExecutionId,
                        createdBy = "系統",
                        dueDate = e.CreatedAt.AddDays(7),
                        priority = "High",
                        approvalBy = e.ApprovalBy,
                        approvalAt = e.ApprovalAt,
                        approvalNote = e.ApprovalNote,
                        fieldDisplaySettings = e.EFormDefinition != null ? e.EFormDefinition.FieldDisplaySettings : null, // 新增：字段顯示設定
                        htmlCode = e.FilledHtmlCode ?? e.OriginalHtmlCode // 新增：HTML 代碼用於解析字段值
                    })
                    .ToListAsync();

                _loggingService.LogInformation($"找到 {eformInstances.Count} 個已拒絕的表單實例");

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
                _loggingService.LogError($"獲取已拒絕表單實例時發生錯誤: {ex.Message}");
                return StatusCode(500, new { error = $"獲取已拒絕表單實例失敗: {ex.Message}" });
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

        // GET: api/eforminstances/statistics/fillType - 獲取 Fill Type 統計數據
        [HttpGet("statistics/fillType")]
        public async Task<IActionResult> GetFillTypeStatistics([FromQuery] string? status = null)
        {
            try
            {
                _loggingService.LogInformation($"獲取 Fill Type 統計數據 (狀態過濾: {status ?? "全部"})");
                
                // 根據狀態過濾（如果提供）
                var query = _db.EFormInstances.AsQueryable();
                if (!string.IsNullOrEmpty(status))
                {
                    query = query.Where(e => e.Status == status);
                }
                
                // 統計 FillType
                var fillTypeStatistics = await query
                    .GroupBy(e => e.FillType)
                    .Select(g => new { FillType = g.Key, Count = g.Count() })
                    .ToListAsync();

                _loggingService.LogInformation($"FillType 統計 ({status ?? "全部狀態"}): {string.Join(", ", fillTypeStatistics.Select(s => $"{s.FillType}:{s.Count}"))}");

                var aiFillCount = fillTypeStatistics.FirstOrDefault(s => s.FillType == "AI")?.Count ?? 0;
                var dataFillCount = fillTypeStatistics.FirstOrDefault(s => s.FillType == "Data")?.Count ?? 0;
                var manualFillCount = fillTypeStatistics.FirstOrDefault(s => s.FillType == "Manual")?.Count ?? 0;

                var result = new
                {
                    aiFillCount = aiFillCount,
                    dataFillCount = dataFillCount,
                    manualFillCount = manualFillCount
                };

                _loggingService.LogInformation($"Fill Type 統計數據: AI Fill {aiFillCount}, Data Fill {dataFillCount}, Manual Fill {manualFillCount}");

                return Ok(result);
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取 Fill Type 統計數據失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = "獲取 Fill Type 統計數據失敗", message = ex.Message });
            }
        }

        // GET: api/eforminstances/manual/pending - 獲取手動填寫待回應表單
        [HttpGet("manual/pending")]
        public async Task<IActionResult> GetManualPendingEformInstances(int page = 1, int pageSize = 20, string search = null)
        {
            try
            {
                _loggingService.LogInformation("獲取手動填寫待回應表單實例");
                
                var query = _db.EFormInstances
                    .Include(e => e.EFormDefinition)
                    .Where(e => e.FillType == "Manual" && e.Status == "Pending")
                    .AsQueryable();

                if (!string.IsNullOrEmpty(search))
                {
                    query = query.Where(e => e.EFormDefinition.Name.Contains(search) || 
                                           e.InstanceName.Contains(search) ||
                                           (e.RecipientName != null && e.RecipientName.Contains(search)));
                }

                var total = await query.CountAsync();
                var eformInstances = await query
                    .OrderByDescending(e => e.CreatedAt)
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .Select(e => new
                    {
                        e.Id,
                        formName = e.EFormDefinition.Name,
                        e.InstanceName,
                        e.Status,
                        e.FillType,
                        priority = "High", // 暫時設為高優先級
                        e.CreatedAt,
                        dueDate = e.CreatedAt.AddDays(7), // 假設 7 天後到期
                        e.WorkflowExecutionId,
                        e.UserMessage,
                        e.RecipientWhatsAppNo,
                        e.RecipientName,
                        e.AccessToken,
                        createdBy = "系統"
                    })
                    .ToListAsync();

                _loggingService.LogInformation($"找到 {eformInstances.Count} 個手動填寫待回應表單實例");

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
                _loggingService.LogError($"獲取手動填寫待回應表單實例時發生錯誤: {ex.Message}");
                return StatusCode(500, new { error = $"獲取手動填寫待回應表單實例失敗: {ex.Message}" });
            }
        }

        // GET: api/eforminstances/manual/responded - 獲取手動填寫已收到回應表單
        [HttpGet("manual/responded")]
        public async Task<IActionResult> GetManualRespondedEformInstances(int page = 1, int pageSize = 20, string search = null)
        {
            try
            {
                _loggingService.LogInformation("獲取手動填寫已收到回應表單實例");
                
                var query = _db.EFormInstances
                    .Include(e => e.EFormDefinition)
                    .Where(e => e.FillType == "Manual" && (e.Status == "Submitted" || e.Status == "Approved" || e.Status == "Rejected"))
                    .AsQueryable();

                if (!string.IsNullOrEmpty(search))
                {
                    query = query.Where(e => e.EFormDefinition.Name.Contains(search) || 
                                           e.InstanceName.Contains(search) ||
                                           (e.RecipientName != null && e.RecipientName.Contains(search)));
                }

                var total = await query.CountAsync();
                var eformInstances = await query
                    .OrderByDescending(e => e.UpdatedAt)
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .Select(e => new
                    {
                        e.Id,
                        formName = e.EFormDefinition.Name,
                        e.InstanceName,
                        e.Status,
                        e.FillType,
                        priority = "High", // 暫時設為高優先級
                        e.CreatedAt,
                        e.UpdatedAt,
                        dueDate = e.CreatedAt.AddDays(7), // 假設 7 天後到期
                        e.WorkflowExecutionId,
                        e.UserMessage,
                        e.RecipientWhatsAppNo,
                        e.RecipientName,
                        e.AccessToken,
                        e.ApprovalBy,
                        e.ApprovalAt,
                        rejectedBy = (string?)null, // EFormInstance 中沒有這個字段
                        rejectedAt = (DateTime?)null, // EFormInstance 中沒有這個字段
                        createdBy = "系統"
                    })
                    .ToListAsync();

                _loggingService.LogInformation($"找到 {eformInstances.Count} 個手動填寫已收到回應表單實例");

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
                _loggingService.LogError($"獲取手動填寫已收到回應表單實例時發生錯誤: {ex.Message}");
                return StatusCode(500, new { error = $"獲取手動填寫已收到回應表單實例失敗: {ex.Message}" });
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

        // GET: api/eforminstances/{id} - 獲取表單實例（需要登入或有效 Token）
        [HttpGet("{id}")]
        public async Task<IActionResult> Get(Guid id, [FromQuery] string token = null)
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

                // 檢查是否為 Manual Fill 模式且提供了 Token
                if (instance.FillType == "Manual" && !string.IsNullOrEmpty(token))
                {
                    // 驗證 Token
                    if (!_eFormTokenService.ValidateAccessToken(token, out var tokenInstanceId, out var tokenWhatsAppNo))
                    {
                        return Unauthorized(new { error = "無效的訪問令牌" });
                    }

                    // 驗證 Token 是否匹配當前實例
                    if (tokenInstanceId != id)
                    {
                        return Unauthorized(new { error = "令牌與表單不匹配" });
                    }

                    // 驗證 WhatsApp 號碼是否匹配
                    if (!string.IsNullOrEmpty(instance.RecipientWhatsAppNo) && 
                        instance.RecipientWhatsAppNo != tokenWhatsAppNo)
                    {
                        return Forbid("您無權訪問此表單");
                    }

                    // 檢查 Token 是否過期
                    if (instance.TokenExpiresAt.HasValue && instance.TokenExpiresAt.Value < DateTime.UtcNow)
                    {
                        return Unauthorized(new { error = "訪問令牌已過期" });
                    }

                    // Manual Fill 模式：返回可編輯的表單
                    return Ok(new
                    {
                        id = instance.Id,
                        instanceName = instance.InstanceName,
                        formName = instance.EFormDefinition?.Name,
                        status = instance.Status,
                        htmlCode = instance.OriginalHtmlCode, // Manual Fill 顯示原始表單
                        userMessage = instance.UserMessage,
                        createdAt = instance.CreatedAt,
                        approvalBy = instance.ApprovalBy,
                        approvalAt = instance.ApprovalAt,
                        approvalNote = instance.ApprovalNote,
                        fillType = instance.FillType,
                        recipientWhatsAppNo = instance.RecipientWhatsAppNo,
                        recipientName = instance.RecipientName,
                        urlToken = token, // 返回 Token 供前端使用
                        isManualFill = true,
                        fieldDisplaySettings = instance.EFormDefinition?.FieldDisplaySettings // 新增：字段顯示設定
                    });
                }
                else
                {
                    // AI Fill / Data Fill 模式：需要登入認證
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
                        approvalNote = instance.ApprovalNote,
                        fillType = instance.FillType,
                        isManualFill = false,
                        fieldDisplaySettings = instance.EFormDefinition?.FieldDisplaySettings // 新增：字段顯示設定
                    });
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = $"獲取表單實例失敗: {ex.Message}" });
            }
        }

        // GET: api/eforminstances/{id}/public - 匿名訪問表單實例（僅限 Manual Fill）
        [HttpGet("{id}/public")]
        [AllowAnonymous]
        public async Task<IActionResult> GetPublic(Guid id, [FromQuery] string token)
        {
            try
            {
                if (string.IsNullOrEmpty(token))
                {
                    return BadRequest(new { error = "缺少訪問令牌" });
                }

                var instance = await _db.EFormInstances
                    .Include(e => e.EFormDefinition)
                    .FirstOrDefaultAsync(e => e.Id == id);

                if (instance == null)
                {
                    return NotFound(new { error = "找不到表單實例" });
                }

                // 只允許 Manual Fill 模式
                if (instance.FillType != "Manual")
                {
                    return Forbid("此表單需要登入訪問");
                }

                // 驗證 Token
                Console.WriteLine($"[CONTROLLER DEBUG] 開始驗證 Token: {token}");
                if (!_eFormTokenService.ValidateAccessToken(token, out var tokenInstanceId, out var tokenWhatsAppNo))
                {
                    Console.WriteLine($"[CONTROLLER DEBUG] Token 驗證失敗");
                    return Unauthorized(new { error = "無效的訪問令牌" });
                }
                Console.WriteLine($"[CONTROLLER DEBUG] Token 驗證成功，InstanceId: {tokenInstanceId}, WhatsAppNo: {tokenWhatsAppNo}");

                // 驗證 Token 是否匹配當前實例
                if (tokenInstanceId != id)
                {
                    return Unauthorized(new { error = "令牌與表單不匹配" });
                }

                // 驗證 WhatsApp 號碼是否匹配
                if (!string.IsNullOrEmpty(instance.RecipientWhatsAppNo) && 
                    instance.RecipientWhatsAppNo != tokenWhatsAppNo)
                {
                    return Forbid("您無權訪問此表單");
                }

                // 檢查 Token 是否過期
                if (instance.TokenExpiresAt.HasValue && instance.TokenExpiresAt.Value < DateTime.UtcNow)
                {
                    return Unauthorized(new { error = "訪問令牌已過期" });
                }

                // 返回表單信息
                return Ok(new
                {
                    id = instance.Id,
                    instanceName = instance.InstanceName,
                    formName = instance.EFormDefinition?.Name,
                    status = instance.Status,
                    htmlCode = instance.OriginalHtmlCode, // Manual Fill 顯示原始表單
                    userMessage = instance.UserMessage,
                    createdAt = instance.CreatedAt,
                    approvalBy = instance.ApprovalBy,
                    approvalAt = instance.ApprovalAt,
                    approvalNote = instance.ApprovalNote,
                    fillType = instance.FillType,
                    recipientWhatsAppNo = instance.RecipientWhatsAppNo,
                    recipientName = instance.RecipientName,
                    urlToken = token, // 返回 Token 供前端使用
                    isManualFill = true
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

                // 只允許 Pending 或 Rejected 狀態的表單進行批准
                if (instance.Status != "Pending" && instance.Status != "Rejected")
                {
                    _loggingService.LogWarning($"表單狀態不允許批准，當前狀態: {instance.Status}");
                    return BadRequest(new { error = $"表單狀態 {instance.Status} 不允許批准操作" });
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

                // 只允許 Pending 或 Approved 狀態的表單進行拒絕
                if (instance.Status != "Pending" && instance.Status != "Approved")
                {
                    _loggingService.LogWarning($"表單狀態不允許拒絕，當前狀態: {instance.Status}");
                    return BadRequest(new { error = $"表單狀態 {instance.Status} 不允許拒絕操作" });
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

        // POST: api/eforminstances/{id}/submit - 用戶提交填寫完成的表單
        [HttpPost("{id}/submit")]
        [AllowAnonymous]  // Manual Fill 可能不需要登入
        public async Task<IActionResult> SubmitForm(Guid id, [FromBody] SubmitFormRequest request)
        {
            try
            {
                _loggingService.LogInformation($"收到表單提交請求，ID: {id}");
                _loggingService.LogInformation($"請求數據: {System.Text.Json.JsonSerializer.Serialize(request)}");
                
                var instance = await _db.EFormInstances.FirstOrDefaultAsync(e => e.Id == id);
                
                if (instance == null)
                {
                    _loggingService.LogWarning($"找不到表單實例，ID: {id}");
                    return NotFound(new { error = "找不到表單實例" });
                }
                
                // 驗證 Token（Manual Fill 模式）
                if (instance.FillType == "Manual")
                {
                    if (string.IsNullOrEmpty(request.Token))
                    {
                        _loggingService.LogWarning($"Manual Fill 表單缺少 Token");
                        return BadRequest(new { error = "缺少訪問令牌" });
                    }
                    
                    // 驗證 Token
                    if (!_eFormTokenService.ValidateAccessToken(request.Token, out var tokenInstanceId, out var tokenWhatsAppNo))
                    {
                        _loggingService.LogWarning($"Token 驗證失敗");
                        return Unauthorized(new { error = "無效的訪問令牌" });
                    }
                    
                    // 驗證 Token 是否匹配當前實例
                    if (tokenInstanceId != id)
                    {
                        _loggingService.LogWarning($"Token 與實例 ID 不匹配");
                        return Unauthorized(new { error = "令牌與表單不匹配" });
                    }
                    
                    // 驗證 WhatsApp 號碼是否匹配
                    if (!string.IsNullOrEmpty(instance.RecipientWhatsAppNo) && 
                        instance.RecipientWhatsAppNo != tokenWhatsAppNo)
                    {
                        _loggingService.LogWarning($"WhatsApp 號碼不匹配: 實例={instance.RecipientWhatsAppNo}, Token={tokenWhatsAppNo}");
                        return Forbid("您無權提交此表單");
                    }
                    
                    // 檢查 Token 是否過期
                    if (instance.TokenExpiresAt.HasValue && instance.TokenExpiresAt.Value < DateTime.UtcNow)
                    {
                        _loggingService.LogWarning($"Token 已過期");
                        return Unauthorized(new { error = "訪問令牌已過期" });
                    }
                }
                
                // 檢查表單狀態 - 允許 Pending 和 Submitted 狀態重新提交
                if (instance.Status != "Pending" && instance.Status != "Submitted")
                {
                    _loggingService.LogWarning($"表單狀態不允許提交，當前狀態: {instance.Status}");
                    return BadRequest(new { error = "表單已經被處理過" });
                }
                
                // 更新表單內容
                instance.FilledHtmlCode = request.FilledHtmlCode;
                instance.Status = "Submitted";  // 新增狀態：已提交
                instance.UpdatedAt = DateTime.UtcNow;
                
                await _db.SaveChangesAsync();
                
                _loggingService.LogInformation($"表單提交成功，ID: {id}");
                
                return Ok(new { 
                    success = true, 
                    message = "表單提交成功",
                    instanceId = instance.Id,
                    status = instance.Status
                });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"提交表單時發生錯誤: {ex.Message}", ex);
                return StatusCode(500, new { error = $"提交表單失敗: {ex.Message}" });
            }
        }

        // GET: api/eforminstances/{id}/validate-token - 驗證 Token 並獲取表單信息
        [HttpGet("{id}/validate-token")]
        [AllowAnonymous]
        public async Task<IActionResult> ValidateToken(Guid id, [FromQuery] string token)
        {
            try
            {
                var instance = await _db.EFormInstances
                    .Include(e => e.EFormDefinition)
                    .FirstOrDefaultAsync(e => e.Id == id);
                
                if (instance == null)
                    return NotFound(new { error = "找不到表單實例" });
                
                // 驗證 Token
                if (!_eFormTokenService.ValidateAccessToken(token, out var tokenInstanceId, out var tokenWhatsAppNo))
                    return Unauthorized(new { error = "無效的訪問令牌" });
                
                if (tokenInstanceId != id)
                    return Unauthorized(new { error = "令牌與表單不匹配" });
                
                // 檢查 Token 是否過期
                if (instance.TokenExpiresAt.HasValue && instance.TokenExpiresAt.Value < DateTime.UtcNow)
                    return Unauthorized(new { error = "訪問令牌已過期" });
                
                return Ok(new
                {
                    success = true,
                    instanceId = instance.Id,
                    formName = instance.EFormDefinition?.Name,
                    status = instance.Status,
                    recipientName = instance.RecipientName,
                    recipientWhatsAppNo = instance.RecipientWhatsAppNo,
                    canEdit = instance.Status == "Pending" || instance.Status == "Submitted"
                });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"驗證 Token 時發生錯誤: {ex.Message}", ex);
                return StatusCode(500, new { error = $"驗證失敗: {ex.Message}" });
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

    public class SubmitFormRequest
    {
        public string Token { get; set; } = string.Empty;
        public string FilledHtmlCode { get; set; } = string.Empty;
    }
} 