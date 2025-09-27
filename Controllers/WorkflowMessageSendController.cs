using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using PurpleRice.Data;
using PurpleRice.Services;
using PurpleRice.Models;

namespace PurpleRice.Controllers
{
    /// <summary>
    /// 工作流程消息發送記錄控制器
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class WorkflowMessageSendController : ControllerBase
    {
        private readonly PurpleRiceDbContext _db;
        private readonly WorkflowMessageSendService _messageSendService;
        private readonly RecipientResolverService _recipientResolverService;
        private readonly ILogger<WorkflowMessageSendController> _logger;

        public WorkflowMessageSendController(
            PurpleRiceDbContext db,
            WorkflowMessageSendService messageSendService,
            RecipientResolverService recipientResolverService,
            ILogger<WorkflowMessageSendController> logger)
        {
            _db = db;
            _messageSendService = messageSendService;
            _recipientResolverService = recipientResolverService;
            _logger = logger;
        }

        /// <summary>
        /// 獲取工作流程的消息發送記錄
        /// </summary>
        [HttpGet("workflow/{workflowExecutionId}")]
        public async Task<IActionResult> GetWorkflowMessageSends(int workflowExecutionId)
        {
            try
            {
                _logger.LogInformation("獲取工作流程消息發送記錄，WorkflowExecutionId: {WorkflowExecutionId}", workflowExecutionId);

                var companyId = GetCurrentCompanyId();
                var messageSends = await _messageSendService.GetWorkflowMessageSendsAsync(workflowExecutionId);

                // 過濾當前公司的記錄
                var filteredSends = messageSends.Where(ms => ms.CompanyId == companyId).ToList();

                return Ok(new { data = filteredSends });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "獲取工作流程消息發送記錄失敗");
                return StatusCode(500, new { error = "獲取消息發送記錄失敗", details = ex.Message });
            }
        }

        /// <summary>
        /// 獲取消息發送記錄詳情
        /// </summary>
        [HttpGet("{messageSendId}")]
        public async Task<IActionResult> GetMessageSend(Guid messageSendId)
        {
            try
            {
                _logger.LogInformation("獲取消息發送記錄詳情，MessageSendId: {MessageSendId}", messageSendId);

                var companyId = GetCurrentCompanyId();
                
                // 先檢查記錄是否存在（不包含關聯數據）
                var exists = await _db.WorkflowMessageSends
                    .AnyAsync(ms => ms.Id == messageSendId && ms.IsActive);
                
                if (!exists)
                {
                    _logger.LogWarning("消息發送記錄不存在，MessageSendId: {MessageSendId}", messageSendId);
                    return NotFound(new { error = "找不到消息發送記錄" });
                }
                
                var messageSend = await _messageSendService.GetMessageSendAsync(messageSendId);

                if (messageSend == null || messageSend.CompanyId != companyId)
                {
                    return NotFound(new { error = "找不到消息發送記錄" });
                }

                return Ok(new { data = messageSend });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "獲取消息發送記錄詳情失敗");
                return StatusCode(500, new { error = "獲取消息發送記錄詳情失敗", details = ex.Message });
            }
        }

        /// <summary>
        /// 獲取消息發送記錄詳細狀態（包含收件人詳情）
        /// </summary>
        [HttpGet("{messageSendId}/detail")]
        public async Task<IActionResult> GetMessageSendDetail(Guid messageSendId)
        {
            try
            {
                _logger.LogInformation("獲取消息發送記錄詳細狀態，MessageSendId: {MessageSendId}", messageSendId);

                var companyId = GetCurrentCompanyId();
                var messageSend = await _messageSendService.GetMessageSendAsync(messageSendId);

                if (messageSend == null || messageSend.CompanyId != companyId)
                {
                    return NotFound(new { error = "找不到消息發送記錄" });
                }

                return Ok(new { data = messageSend });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "獲取消息發送記錄詳細狀態失敗");
                return StatusCode(500, new { error = "獲取消息發送記錄詳細狀態失敗", details = ex.Message });
            }
        }

        /// <summary>
        /// 獲取發送統計數據
        /// </summary>
        [HttpGet("statistics")]
        public async Task<IActionResult> GetStatistics(
            [FromQuery] int? workflowExecutionId = null,
            [FromQuery] DateTime? startDate = null,
            [FromQuery] DateTime? endDate = null)
        {
            try
            {
                _logger.LogInformation("獲取發送統計數據");

                var companyId = GetCurrentCompanyId();
                var statistics = await _messageSendService.GetStatisticsAsync(
                    workflowExecutionId, 
                    companyId, 
                    startDate, 
                    endDate);

                return Ok(new { data = statistics });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "獲取發送統計數據失敗");
                return StatusCode(500, new { error = "獲取發送統計數據失敗", details = ex.Message });
            }
        }

        /// <summary>
        /// 創建消息發送記錄（內部使用）
        /// </summary>
        [HttpPost("create")]
        public async Task<IActionResult> CreateMessageSend([FromBody] CreateMessageSendRequest request)
        {
            try
            {
                _logger.LogInformation("創建消息發送記錄，WorkflowExecutionId: {WorkflowExecutionId}, NodeId: {NodeId}", 
                    request.WorkflowExecutionId, request.NodeId);

                var companyId = GetCurrentCompanyId();
                var createdBy = GetCurrentUserId();

                // 創建消息發送記錄
                var messageSendId = await _messageSendService.CreateMessageSendAsync(
                    request.WorkflowExecutionId,
                    request.WorkflowStepExecutionId,
                    request.NodeId,
                    request.NodeType,
                    request.MessageContent,
                    request.TemplateId,
                    request.TemplateName,
                    request.MessageType,
                    companyId,
                    createdBy);

                // 解析收件人
                var recipients = await _recipientResolverService.ResolveRecipientsAsync(
                    request.RecipientValue,
                    request.RecipientDetails,
                    request.WorkflowExecutionId,
                    companyId);

                // 添加收件人
                if (recipients.Any())
                {
                    await _messageSendService.AddRecipientsAsync(messageSendId, recipients, createdBy);
                }

                return Ok(new { 
                    messageSendId = messageSendId,
                    recipientCount = recipients.Count,
                    message = "消息發送記錄創建成功"
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "創建消息發送記錄失敗");
                return StatusCode(500, new { error = "創建消息發送記錄失敗", details = ex.Message });
            }
        }

        /// <summary>
        /// 更新消息發送狀態（內部使用）
        /// </summary>
        [HttpPut("{messageSendId}/status")]
        public async Task<IActionResult> UpdateMessageSendStatus(
            Guid messageSendId, 
            [FromBody] UpdateMessageSendStatusRequest request)
        {
            try
            {
                _logger.LogInformation("更新消息發送狀態，MessageSendId: {MessageSendId}, Status: {Status}", 
                    messageSendId, request.Status);

                await _messageSendService.UpdateMessageSendStatusAsync(
                    messageSendId, 
                    request.Status, 
                    request.ErrorMessage);

                return Ok(new { message = "消息發送狀態更新成功" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "更新消息發送狀態失敗");
                return StatusCode(500, new { error = "更新消息發送狀態失敗", details = ex.Message });
            }
        }

        /// <summary>
        /// 更新收件人狀態（內部使用）
        /// </summary>
        [HttpPut("recipient/{recipientId}/status")]
        public async Task<IActionResult> UpdateRecipientStatus(
            Guid recipientId, 
            [FromBody] UpdateRecipientStatusRequest request)
        {
            try
            {
                _logger.LogInformation("更新收件人狀態，RecipientId: {RecipientId}, Status: {Status}", 
                    recipientId, request.Status);

                await _messageSendService.UpdateRecipientStatusAsync(
                    recipientId,
                    request.Status,
                    request.WhatsAppMessageId,
                    request.ErrorMessage,
                    request.ErrorCode);

                return Ok(new { message = "收件人狀態更新成功" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "更新收件人狀態失敗");
                return StatusCode(500, new { error = "更新收件人狀態失敗", details = ex.Message });
            }
        }

        /// <summary>
        /// 批量更新收件人狀態（內部使用）
        /// </summary>
        [HttpPut("{messageSendId}/recipients/status")]
        public async Task<IActionResult> UpdateRecipientsStatusBatch(
            Guid messageSendId, 
            [FromBody] UpdateRecipientsStatusBatchRequest request)
        {
            try
            {
                _logger.LogInformation("批量更新收件人狀態，MessageSendId: {MessageSendId}, Status: {Status}", 
                    messageSendId, request.Status);

                await _messageSendService.UpdateRecipientsStatusBatchAsync(
                    messageSendId,
                    request.Status,
                    request.WhatsAppMessageIds);

                return Ok(new { message = "批量更新收件人狀態成功" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "批量更新收件人狀態失敗");
                return StatusCode(500, new { error = "批量更新收件人狀態失敗", details = ex.Message });
            }
        }

        /// <summary>
        /// 獲取當前公司ID
        /// </summary>
        private Guid GetCurrentCompanyId()
        {
            var companyIdClaim = User.FindFirst("company_id")?.Value;
            if (string.IsNullOrEmpty(companyIdClaim) || !Guid.TryParse(companyIdClaim, out var companyId))
            {
                throw new UnauthorizedAccessException("無法獲取公司ID");
            }
            return companyId;
        }

        /// <summary>
        /// 獲取當前用戶ID
        /// </summary>
        private string GetCurrentUserId()
        {
            var userId = User.FindFirst("user_id")?.Value ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return userId ?? "system";
        }
    }

    /// <summary>
    /// 創建消息發送記錄請求
    /// </summary>
    public class CreateMessageSendRequest
    {
        public int WorkflowExecutionId { get; set; }
        public int? WorkflowStepExecutionId { get; set; }
        public string NodeId { get; set; }
        public string NodeType { get; set; }
        public string MessageContent { get; set; }
        public string TemplateId { get; set; }
        public string TemplateName { get; set; }
        public string MessageType { get; set; } = "text";
        public string RecipientValue { get; set; }
        public string RecipientDetails { get; set; }
    }

    /// <summary>
    /// 更新消息發送狀態請求
    /// </summary>
    public class UpdateMessageSendStatusRequest
    {
        public string Status { get; set; }
        public string ErrorMessage { get; set; }
    }

    /// <summary>
    /// 更新收件人狀態請求
    /// </summary>
    public class UpdateRecipientStatusRequest
    {
        public string Status { get; set; }
        public string WhatsAppMessageId { get; set; }
        public string ErrorMessage { get; set; }
        public string ErrorCode { get; set; }
    }

    /// <summary>
    /// 批量更新收件人狀態請求
    /// </summary>
    public class UpdateRecipientsStatusBatchRequest
    {
        public string Status { get; set; }
        public Dictionary<Guid, string> WhatsAppMessageIds { get; set; }
    }
}
