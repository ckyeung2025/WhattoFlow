using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using PurpleRice.Data;
using PurpleRice.Models;

namespace PurpleRice.Services
{
    /// <summary>
    /// 工作流程消息發送記錄服務
    /// </summary>
    public class WorkflowMessageSendService
    {
        private readonly PurpleRiceDbContext _db;
        private readonly ILogger<WorkflowMessageSendService> _logger;

        public WorkflowMessageSendService(PurpleRiceDbContext db, ILogger<WorkflowMessageSendService> logger)
        {
            _db = db;
            _logger = logger;
        }

        /// <summary>
        /// 創建消息發送記錄
        /// </summary>
        public async Task<Guid> CreateMessageSendAsync(
            int workflowExecutionId,
            int? workflowStepExecutionId,
            string nodeId,
            string nodeType,
            string messageContent,
            string templateId = null,
            string templateName = null,
            string messageType = "text",
            Guid companyId = default,
            string createdBy = null)
        {
            try
            {
                _logger.LogInformation("創建消息發送記錄，WorkflowExecutionId: {WorkflowExecutionId}, NodeId: {NodeId}", 
                    workflowExecutionId, nodeId);

                var messageSend = new WorkflowMessageSend
                {
                    WorkflowExecutionId = workflowExecutionId,
                    WorkflowStepExecutionId = workflowStepExecutionId,
                    NodeId = nodeId,
                    NodeType = nodeType,
                    MessageContent = messageContent,
                    TemplateId = templateId,
                    TemplateName = templateName,
                    MessageType = messageType,
                    Status = MessageSendStatus.Pending,
                    CompanyId = companyId,
                    CreatedBy = createdBy ?? "system"
                };

                _db.WorkflowMessageSends.Add(messageSend);
                await _db.SaveChangesAsync();

                _logger.LogInformation("成功創建消息發送記錄，ID: {MessageSendId}", messageSend.Id);
                return messageSend.Id;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "創建消息發送記錄失敗");
                throw;
            }
        }

        /// <summary>
        /// 批量添加收件人
        /// </summary>
        public async Task AddRecipientsAsync(Guid messageSendId, List<ResolvedRecipient> recipients, string createdBy = null)
        {
            try
            {
                _logger.LogInformation("=== 開始添加收件人到消息發送記錄 ===");
                _logger.LogInformation("MessageSendId: {MessageSendId}", messageSendId);
                _logger.LogInformation("收件人數量: {Count}", recipients.Count);
                _logger.LogInformation("CreatedBy: {CreatedBy}", createdBy ?? "system");

                // 詳細記錄每個收件人
                for (int i = 0; i < recipients.Count; i++)
                {
                    var recipient = recipients[i];
                    _logger.LogInformation("收件人 {Index}: ID={RecipientId}, Phone={PhoneNumber}, Type={RecipientType}, Name={RecipientName}", 
                        i + 1, recipient.Id, recipient.PhoneNumber, recipient.RecipientType, recipient.RecipientName);
                }

                var messageRecipients = recipients.Select(r => new WorkflowMessageRecipient
                {
                    MessageSendId = messageSendId,
                    PhoneNumber = r.PhoneNumber,
                    RecipientType = r.RecipientType,
                    RecipientId = !string.IsNullOrEmpty(r.RecipientId) && Guid.TryParse(r.RecipientId, out var recipientGuid) ? recipientGuid : null,
                    RecipientName = r.RecipientName,
                    Status = RecipientStatus.Pending,
                    CompanyId = r.CompanyId,
                    CreatedBy = createdBy ?? "system"
                }).ToList();

                _logger.LogInformation("創建了 {Count} 個 WorkflowMessageRecipient 對象", messageRecipients.Count);

                _db.WorkflowMessageRecipients.AddRange(messageRecipients);
                _logger.LogInformation("已將收件人添加到 DbContext");

                // 更新主表的收件人總數
                var messageSend = await _db.WorkflowMessageSends.FindAsync(messageSendId);
                if (messageSend != null)
                {
                    messageSend.TotalRecipients = messageRecipients.Count;
                    messageSend.UpdatedAt = DateTime.UtcNow;
                    _logger.LogInformation("更新主表收件人總數為: {TotalRecipients}", messageRecipients.Count);
                }
                else
                {
                    _logger.LogWarning("找不到 MessageSendId: {MessageSendId} 的記錄", messageSendId);
                }

                _logger.LogInformation("開始保存到數據庫...");
                await _db.SaveChangesAsync();
                _logger.LogInformation("數據庫保存成功");

                _logger.LogInformation("=== 成功添加 {Count} 個收件人 ===", recipients.Count);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "=== 添加收件人失敗 ===");
                _logger.LogError("MessageSendId: {MessageSendId}, 收件人數量: {Count}", messageSendId, recipients.Count);
                throw;
            }
        }

        /// <summary>
        /// 更新消息發送狀態
        /// </summary>
        public async Task UpdateMessageSendStatusAsync(Guid messageSendId, string status, string errorMessage = null)
        {
            try
            {
                _logger.LogInformation("更新消息發送狀態，MessageSendId: {MessageSendId}, Status: {Status}", 
                    messageSendId, status);

                var messageSend = await _db.WorkflowMessageSends.FindAsync(messageSendId);
                if (messageSend == null)
                {
                    _logger.LogWarning("找不到消息發送記錄，ID: {MessageSendId}", messageSendId);
                    return;
                }

                messageSend.Status = status;
                messageSend.ErrorMessage = errorMessage;
                messageSend.UpdatedAt = DateTime.UtcNow;

                if (status == MessageSendStatus.Completed || status == MessageSendStatus.Failed || status == MessageSendStatus.PartiallyFailed)
                {
                    messageSend.CompletedAt = DateTime.UtcNow;
                }

                // 更新統計數據
                var recipients = await _db.WorkflowMessageRecipients
                    .Where(r => r.MessageSendId == messageSendId && r.IsActive)
                    .ToListAsync();

                messageSend.SuccessCount = recipients.Count(r => r.Status == RecipientStatus.Sent || 
                                                               r.Status == RecipientStatus.Delivered || 
                                                               r.Status == RecipientStatus.Read);
                messageSend.FailedCount = recipients.Count(r => r.Status == RecipientStatus.Failed);

                await _db.SaveChangesAsync();

                _logger.LogInformation("成功更新消息發送狀態");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "更新消息發送狀態失敗");
                throw;
            }
        }

        /// <summary>
        /// 更新收件人狀態
        /// </summary>
        public async Task UpdateRecipientStatusAsync(
            Guid recipientId, 
            string status, 
            string whatsappMessageId = null,
            string errorMessage = null,
            string errorCode = null)
        {
            try
            {
                _logger.LogInformation("🔍 [DEBUG] UpdateRecipientStatusAsync 開始");
                _logger.LogInformation("更新收件人狀態，RecipientId: {RecipientId}, Status: {Status}, WhatsAppMessageId: {WhatsAppMessageId}, ErrorMessage: {ErrorMessage}", 
                    recipientId, status, whatsappMessageId, errorMessage);

                var recipient = await _db.WorkflowMessageRecipients.FindAsync(recipientId);
                if (recipient == null)
                {
                    _logger.LogWarning("🔍 [DEBUG] 找不到收件人記錄，ID: {RecipientId}", recipientId);
                    return;
                }

                _logger.LogInformation("🔍 [DEBUG] 找到收件人記錄: PhoneNumber={PhoneNumber}, CurrentStatus={CurrentStatus}", 
                    recipient.PhoneNumber, recipient.Status);
                
                recipient.Status = status;
                recipient.UpdatedAt = DateTime.UtcNow;

                if (!string.IsNullOrEmpty(whatsappMessageId))
                {
                    recipient.WhatsAppMessageId = whatsappMessageId;
                }

                if (!string.IsNullOrEmpty(errorMessage))
                {
                    recipient.ErrorMessage = errorMessage;
                }

                if (!string.IsNullOrEmpty(errorCode))
                {
                    recipient.ErrorCode = errorCode;
                }

                // 設置時間戳
                switch (status)
                {
                    case RecipientStatus.Sent:
                        recipient.SentAt = DateTime.UtcNow;
                        break;
                    case RecipientStatus.Delivered:
                        recipient.DeliveredAt = DateTime.UtcNow;
                        break;
                    case RecipientStatus.Read:
                        recipient.ReadAt = DateTime.UtcNow;
                        break;
                    case RecipientStatus.Failed:
                        recipient.FailedAt = DateTime.UtcNow;
                        break;
                }

                await _db.SaveChangesAsync();
                _logger.LogInformation("🔍 [DEBUG] 收件人狀態已保存到資料庫: RecipientId={RecipientId}, NewStatus={Status}", 
                    recipientId, status);

                // 更新主表統計
                await UpdateMessageSendStatisticsAsync(recipient.MessageSendId);

                _logger.LogInformation("成功更新收件人狀態");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "更新收件人狀態失敗");
                throw;
            }
        }

        /// <summary>
        /// 批量更新收件人狀態
        /// </summary>
        public async Task UpdateRecipientsStatusBatchAsync(
            Guid messageSendId, 
            string status, 
            Dictionary<Guid, string> whatsappMessageIds = null)
        {
            try
            {
                _logger.LogInformation("批量更新收件人狀態，MessageSendId: {MessageSendId}, Status: {Status}", 
                    messageSendId, status);

                var recipients = await _db.WorkflowMessageRecipients
                    .Where(r => r.MessageSendId == messageSendId && r.IsActive)
                    .ToListAsync();

                foreach (var recipient in recipients)
                {
                    recipient.Status = status;
                    recipient.UpdatedAt = DateTime.UtcNow;

                    if (whatsappMessageIds != null && whatsappMessageIds.ContainsKey(recipient.Id))
                    {
                        recipient.WhatsAppMessageId = whatsappMessageIds[recipient.Id];
                    }

                    // 設置時間戳
                    switch (status)
                    {
                        case RecipientStatus.Sent:
                            recipient.SentAt = DateTime.UtcNow;
                            break;
                        case RecipientStatus.Delivered:
                            recipient.DeliveredAt = DateTime.UtcNow;
                            break;
                        case RecipientStatus.Read:
                            recipient.ReadAt = DateTime.UtcNow;
                            break;
                        case RecipientStatus.Failed:
                            recipient.FailedAt = DateTime.UtcNow;
                            break;
                    }
                }

                await _db.SaveChangesAsync();

                // 更新主表統計
                await UpdateMessageSendStatisticsAsync(messageSendId);

                _logger.LogInformation("成功批量更新 {Count} 個收件人狀態", recipients.Count);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "批量更新收件人狀態失敗");
                throw;
            }
        }

        /// <summary>
        /// 更新消息發送統計數據
        /// </summary>
        private async Task UpdateMessageSendStatisticsAsync(Guid messageSendId)
        {
            var messageSend = await _db.WorkflowMessageSends.FindAsync(messageSendId);
            if (messageSend == null) return;

            var recipients = await _db.WorkflowMessageRecipients
                .Where(r => r.MessageSendId == messageSendId && r.IsActive)
                .ToListAsync();

            messageSend.SuccessCount = recipients.Count(r => r.Status == RecipientStatus.Sent || 
                                                           r.Status == RecipientStatus.Delivered || 
                                                           r.Status == RecipientStatus.Read);
            messageSend.FailedCount = recipients.Count(r => r.Status == RecipientStatus.Failed);
            messageSend.UpdatedAt = DateTime.UtcNow;

            await _db.SaveChangesAsync();
        }

        /// <summary>
        /// 獲取消息發送記錄
        /// </summary>
        public async Task<WorkflowMessageSend> GetMessageSendAsync(Guid messageSendId)
        {
            return await _db.WorkflowMessageSends
                .Include(ms => ms.Recipients)
                .Include(ms => ms.WorkflowExecution)
                .FirstOrDefaultAsync(ms => ms.Id == messageSendId && ms.IsActive);
        }

        /// <summary>
        /// 獲取工作流程的所有消息發送記錄
        /// </summary>
        public async Task<List<WorkflowMessageSend>> GetWorkflowMessageSendsAsync(int workflowExecutionId)
        {
            return await _db.WorkflowMessageSends
                .Include(ms => ms.Recipients)
                .Where(ms => ms.WorkflowExecutionId == workflowExecutionId && ms.IsActive)
                .OrderBy(ms => ms.StartedAt)
                .ToListAsync();
        }

        /// <summary>
        /// 獲取發送統計數據
        /// </summary>
        public async Task<MessageSendStatistics> GetStatisticsAsync(
            int? workflowExecutionId = null,
            Guid? companyId = null,
            DateTime? startDate = null,
            DateTime? endDate = null)
        {
            var query = _db.WorkflowMessageSends.Where(ms => ms.IsActive);

            if (workflowExecutionId.HasValue)
            {
                query = query.Where(ms => ms.WorkflowExecutionId == workflowExecutionId.Value);
            }

            if (companyId.HasValue)
            {
                query = query.Where(ms => ms.CompanyId == companyId.Value);
            }

            if (startDate.HasValue)
            {
                query = query.Where(ms => ms.StartedAt >= startDate.Value);
            }

            if (endDate.HasValue)
            {
                query = query.Where(ms => ms.StartedAt <= endDate.Value);
            }

            var totalSends = await query.CountAsync();
            var totalRecipients = await query.SumAsync(ms => ms.TotalRecipients);
            var totalSuccess = await query.SumAsync(ms => ms.SuccessCount);
            var totalFailed = await query.SumAsync(ms => ms.FailedCount);

            var successRate = totalRecipients > 0 ? (double)totalSuccess / totalRecipients * 100 : 0;

            var avgDuration = await query
                .Where(ms => ms.CompletedAt.HasValue)
                .Select(ms => EF.Functions.DateDiffSecond(ms.StartedAt, ms.CompletedAt.Value))
                .DefaultIfEmpty(0)
                .AverageAsync();

            return new MessageSendStatistics
            {
                TotalSends = totalSends,
                TotalRecipients = totalRecipients,
                TotalSuccess = totalSuccess,
                TotalFailed = totalFailed,
                SuccessRate = Math.Round(successRate, 2),
                AverageDurationSeconds = Math.Round(avgDuration, 2)
            };
        }
    }

    /// <summary>
    /// 消息發送統計數據
    /// </summary>
    public class MessageSendStatistics
    {
        public int TotalSends { get; set; }
        public int TotalRecipients { get; set; }
        public int TotalSuccess { get; set; }
        public int TotalFailed { get; set; }
        public double SuccessRate { get; set; }
        public double AverageDurationSeconds { get; set; }
    }
}
