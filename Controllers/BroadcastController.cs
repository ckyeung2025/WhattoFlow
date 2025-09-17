using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using PurpleRice.Data;
using PurpleRice.Models;
using PurpleRice.Services;
using System.Security.Claims;

namespace PurpleRice.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class BroadcastController : ControllerBase
    {
        private readonly PurpleRiceDbContext _context;
        private readonly ContactListService _contactListService;
        private readonly ILogger<BroadcastController> _logger;

        public BroadcastController(
            PurpleRiceDbContext context, 
            ContactListService contactListService, 
            ILogger<BroadcastController> logger)
        {
            _context = context;
            _contactListService = contactListService;
            _logger = logger;
        }

        #region 廣播發送

        /// <summary>
        /// 發送廣播訊息
        /// </summary>
        [HttpPost("send")]
        public async Task<IActionResult> SendBroadcast([FromBody] BroadcastSendRequest request)
        {
            try
            {
                var companyId = GetCurrentCompanyId();
                if (companyId == Guid.Empty)
                    return Unauthorized("無法識別公司資訊");

                var createdBy = GetCurrentUserId();

                // 獲取目標聯絡人
                var contacts = await GetTargetContactsAsync(companyId, request.BroadcastGroupId, request.HashtagFilter);
                
                if (!contacts.Any())
                    return BadRequest("沒有找到符合條件的聯絡人");

                // 創建廣播發送記錄
                var broadcastSend = new BroadcastSend
                {
                    Id = Guid.NewGuid(),
                    CompanyId = companyId,
                    WorkflowExecutionId = request.WorkflowExecutionId,
                    BroadcastGroupId = request.BroadcastGroupId,
                    HashtagFilter = request.HashtagFilter,
                    MessageContent = request.MessageContent,
                    TemplateId = request.TemplateId,
                    TotalContacts = contacts.Count,
                    Status = "Pending",
                    StartedAt = DateTime.UtcNow,
                    CreatedBy = createdBy
                };

                _context.BroadcastSends.Add(broadcastSend);

                // 創建發送明細
                var sendDetails = contacts.Select(contact => new BroadcastSendDetail
                {
                    Id = Guid.NewGuid(),
                    BroadcastSendId = broadcastSend.Id,
                    ContactId = contact.Id,
                    Status = "Pending"
                }).ToList();

                _context.BroadcastSendDetails.AddRange(sendDetails);
                await _context.SaveChangesAsync();

                // 異步發送訊息（這裡可以整合到現有的 WhatsApp 服務）
                _ = Task.Run(async () => await ProcessBroadcastSendAsync(broadcastSend.Id));

                return Ok(new
                {
                    broadcastId = broadcastSend.Id,
                    totalContacts = contacts.Count,
                    message = "廣播發送已開始處理"
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "發送廣播訊息失敗");
                return StatusCode(500, "發送廣播訊息失敗");
            }
        }

        /// <summary>
        /// 獲取廣播發送狀態
        /// </summary>
        [HttpGet("status/{broadcastId}")]
        public async Task<IActionResult> GetBroadcastStatus(Guid broadcastId)
        {
            try
            {
                var companyId = GetCurrentCompanyId();
                if (companyId == Guid.Empty)
                    return Unauthorized("無法識別公司資訊");

                var broadcast = await _context.BroadcastSends
                    .Include(bs => bs.BroadcastGroup)
                    .Include(bs => bs.SendDetails)
                    .FirstOrDefaultAsync(bs => bs.Id == broadcastId && bs.CompanyId == companyId);

                if (broadcast == null)
                    return NotFound("廣播記錄不存在");

                var statusDetails = await _context.BroadcastSendDetails
                    .Where(bsd => bsd.BroadcastSendId == broadcastId)
                    .GroupBy(bsd => bsd.Status)
                    .Select(g => new { Status = g.Key, Count = g.Count() })
                    .ToListAsync();

                return Ok(new
                {
                    broadcastId = broadcast.Id,
                    status = broadcast.Status,
                    totalContacts = broadcast.TotalContacts,
                    sentCount = broadcast.SentCount,
                    failedCount = broadcast.FailedCount,
                    startedAt = broadcast.StartedAt,
                    completedAt = broadcast.CompletedAt,
                    errorMessage = broadcast.ErrorMessage,
                    statusDetails
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "獲取廣播狀態失敗，ID: {BroadcastId}", broadcastId);
                return StatusCode(500, "獲取廣播狀態失敗");
            }
        }

        /// <summary>
        /// 取消廣播發送
        /// </summary>
        [HttpPost("cancel/{broadcastId}")]
        public async Task<IActionResult> CancelBroadcast(Guid broadcastId)
        {
            try
            {
                var companyId = GetCurrentCompanyId();
                if (companyId == Guid.Empty)
                    return Unauthorized("無法識別公司資訊");

                var broadcast = await _context.BroadcastSends
                    .FirstOrDefaultAsync(bs => bs.Id == broadcastId && bs.CompanyId == companyId);

                if (broadcast == null)
                    return NotFound("廣播記錄不存在");

                if (broadcast.Status != "Pending" && broadcast.Status != "Sending")
                    return BadRequest("只能取消待發送或發送中的廣播");

                broadcast.Status = "Cancelled";
                broadcast.CompletedAt = DateTime.UtcNow;

                // 取消所有待發送的明細
                var pendingDetails = await _context.BroadcastSendDetails
                    .Where(bsd => bsd.BroadcastSendId == broadcastId && bsd.Status == "Pending")
                    .ToListAsync();

                foreach (var detail in pendingDetails)
                {
                    detail.Status = "Cancelled";
                }

                await _context.SaveChangesAsync();

                _logger.LogInformation("廣播 {BroadcastId} 已取消", broadcastId);
                return Ok(new { message = "廣播已取消" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "取消廣播失敗，ID: {BroadcastId}", broadcastId);
                return StatusCode(500, "取消廣播失敗");
            }
        }

        #endregion

        #region 預覽功能

        /// <summary>
        /// 預覽廣播目標聯絡人
        /// </summary>
        [HttpPost("preview")]
        public async Task<IActionResult> PreviewBroadcast([FromBody] BroadcastPreviewRequest request)
        {
            try
            {
                var companyId = GetCurrentCompanyId();
                if (companyId == Guid.Empty)
                    return Unauthorized("無法識別公司資訊");

                var contacts = await GetTargetContactsAsync(companyId, request.BroadcastGroupId, request.HashtagFilter);

                var preview = contacts.Take(10).Select(c => new
                {
                    id = c.Id,
                    name = c.Name,
                    whatsappNumber = c.WhatsAppNumber,
                    email = c.Email,
                    company = c.CompanyName,
                    department = c.Department,
                    position = c.Position,
                    hashtags = c.Hashtags
                }).ToList();

                return Ok(new
                {
                    totalCount = contacts.Count,
                    preview,
                    message = $"找到 {contacts.Count} 位符合條件的聯絡人"
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "預覽廣播目標失敗");
                return StatusCode(500, "預覽廣播目標失敗");
            }
        }

        #endregion

        #region 私有方法

        /// <summary>
        /// 獲取目標聯絡人
        /// </summary>
        private async Task<List<ContactList>> GetTargetContactsAsync(Guid companyId, Guid? broadcastGroupId, string? hashtagFilter)
        {
            var query = _context.ContactLists
                .Where(c => c.CompanyId == companyId && c.IsActive)
                .AsQueryable();

            // 群組篩選
            if (broadcastGroupId.HasValue)
            {
                query = query.Where(c => c.BroadcastGroupId == broadcastGroupId.Value);
            }

            // 標籤篩選
            if (!string.IsNullOrEmpty(hashtagFilter))
            {
                var hashtags = hashtagFilter.Split(',', StringSplitOptions.RemoveEmptyEntries)
                    .Select(h => h.Trim()).ToList();
                
                query = query.Where(c => hashtags.Any(h => c.Hashtags.Contains(h)));
            }

            return await query.ToListAsync();
        }

        /// <summary>
        /// 處理廣播發送（異步）
        /// </summary>
        private async Task ProcessBroadcastSendAsync(Guid broadcastId)
        {
            try
            {
                var broadcast = await _context.BroadcastSends
                    .Include(bs => bs.SendDetails)
                    .FirstOrDefaultAsync(bs => bs.Id == broadcastId);

                if (broadcast == null) return;

                broadcast.Status = "Sending";
                await _context.SaveChangesAsync();

                var pendingDetails = await _context.BroadcastSendDetails
                    .Include(bsd => bsd.Contact)
                    .Where(bsd => bsd.BroadcastSendId == broadcastId && bsd.Status == "Pending")
                    .ToListAsync();

                foreach (var detail in pendingDetails)
                {
                    try
                    {
                        // 這裡整合到現有的 WhatsApp 發送服務
                        // 暫時模擬發送過程
                        await Task.Delay(1000); // 模擬發送延遲

                        detail.Status = "Sent";
                        detail.SentAt = DateTime.UtcNow;
                        broadcast.SentCount++;

                        _logger.LogInformation("廣播訊息已發送給聯絡人 {ContactName}", detail.Contact?.Name);
                    }
                    catch (Exception ex)
                    {
                        detail.Status = "Failed";
                        detail.ErrorMessage = ex.Message;
                        broadcast.FailedCount++;

                        _logger.LogError(ex, "發送廣播訊息給聯絡人 {ContactName} 失敗", detail.Contact?.Name);
                    }

                    await _context.SaveChangesAsync();
                }

                // 更新廣播狀態
                broadcast.Status = broadcast.FailedCount > 0 ? "Completed" : "Completed";
                broadcast.CompletedAt = DateTime.UtcNow;

                await _context.SaveChangesAsync();

                _logger.LogInformation("廣播 {BroadcastId} 處理完成，成功: {SentCount}，失敗: {FailedCount}", 
                    broadcastId, broadcast.SentCount, broadcast.FailedCount);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "處理廣播發送失敗，ID: {BroadcastId}", broadcastId);
                
                var broadcast = await _context.BroadcastSends.FindAsync(broadcastId);
                if (broadcast != null)
                {
                    broadcast.Status = "Failed";
                    broadcast.ErrorMessage = ex.Message;
                    broadcast.CompletedAt = DateTime.UtcNow;
                    await _context.SaveChangesAsync();
                }
            }
        }

        /// <summary>
        /// 獲取當前用戶的公司ID
        /// </summary>
        private Guid GetCurrentCompanyId()
        {
            // 先嘗試小寫的 company_id（JWT token 中使用的）
            var companyIdClaim = User.FindFirst("company_id");
            if (companyIdClaim != null && Guid.TryParse(companyIdClaim.Value, out var companyId))
            {
                return companyId;
            }
            
            // 如果沒有找到，嘗試大寫的 CompanyId（向後兼容）
            companyIdClaim = User.FindFirst("CompanyId");
            if (companyIdClaim != null && Guid.TryParse(companyIdClaim.Value, out companyId))
            {
                return companyId;
            }
            
            return Guid.Empty;
        }

        /// <summary>
        /// 獲取當前用戶ID
        /// </summary>
        private string GetCurrentUserId()
        {
            return User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "system";
        }

        #endregion
    }

    #region 請求模型

    public class BroadcastSendRequest
    {
        public int? WorkflowExecutionId { get; set; }
        public Guid? BroadcastGroupId { get; set; }
        public string? HashtagFilter { get; set; }
        public string? MessageContent { get; set; }
        public Guid? TemplateId { get; set; }
    }

    public class BroadcastPreviewRequest
    {
        public Guid? BroadcastGroupId { get; set; }
        public string? HashtagFilter { get; set; }
    }

    #endregion
}
