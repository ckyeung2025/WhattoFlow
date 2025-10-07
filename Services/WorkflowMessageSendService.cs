using System;
using System.Collections.Generic;
using System.Data;
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
                    Id = r.Id, // ✅ 關鍵修復：使用 ResolvedRecipient 的 Id
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
            try
            {
                _logger.LogInformation("開始獲取消息發送記錄，MessageSendId: {MessageSendId}", messageSendId);
                
                // 使用 DataReader 來手動讀取數據，避免 Entity Framework 的 NULL 值問題
                var connection = _db.Database.GetDbConnection();
                if (connection.State != System.Data.ConnectionState.Open)
                {
                    await connection.OpenAsync();
                }
                
                using var command = connection.CreateCommand();
                command.CommandText = @"
                    SELECT 
                        id, workflow_execution_id, workflow_step_execution_id,
                        ISNULL(node_id, '') as node_id,
                        ISNULL(node_type, '') as node_type,
                        ISNULL(message_type, 'text') as message_type,
                        template_id, template_name, message_content,
                        total_recipients, success_count, failed_count,
                        ISNULL(status, 'Pending') as status,
                        started_at, completed_at, error_message,
                        company_id, ISNULL(created_by, 'system') as created_by, 
                        created_at, updated_at, is_active
                    FROM workflow_message_sends 
                    WHERE id = @messageSendId AND is_active = 1";
                
                var parameter = command.CreateParameter();
                parameter.ParameterName = "@messageSendId";
                parameter.Value = messageSendId;
                command.Parameters.Add(parameter);
                
                using var reader = await command.ExecuteReaderAsync();
                if (!await reader.ReadAsync())
                {
                    _logger.LogWarning("找不到消息發送記錄，MessageSendId: {MessageSendId}", messageSendId);
                    return null;
                }
                
                // 手動創建 WorkflowMessageSend 對象
                var messageSend = new WorkflowMessageSend
                {
                    Id = reader.GetGuid("id"),
                    WorkflowExecutionId = reader.GetInt32("workflow_execution_id"),
                    WorkflowStepExecutionId = reader.IsDBNull("workflow_step_execution_id") ? null : reader.GetInt32("workflow_step_execution_id"),
                    NodeId = reader.GetString("node_id"),
                    NodeType = reader.GetString("node_type"),
                    MessageType = reader.GetString("message_type"),
                    TemplateId = reader.IsDBNull("template_id") ? null : reader.GetString("template_id"),
                    TemplateName = reader.IsDBNull("template_name") ? null : reader.GetString("template_name"),
                    MessageContent = reader.IsDBNull("message_content") ? null : reader.GetString("message_content"),
                    TotalRecipients = reader.GetInt32("total_recipients"),
                    SuccessCount = reader.GetInt32("success_count"),
                    FailedCount = reader.GetInt32("failed_count"),
                    Status = reader.GetString("status"),
                    StartedAt = reader.GetDateTime("started_at"),
                    CompletedAt = reader.IsDBNull("completed_at") ? null : reader.GetDateTime("completed_at"),
                    ErrorMessage = reader.IsDBNull("error_message") ? null : reader.GetString("error_message"),
                    CompanyId = reader.GetGuid("company_id"),
                    CreatedBy = reader.GetString("created_by"),
                    CreatedAt = reader.GetDateTime("created_at"),
                    UpdatedAt = reader.GetDateTime("updated_at"),
                    IsActive = reader.GetBoolean("is_active")
                };
                
                reader.Close();
                
                // 獲取收件人記錄
                var recipientCommand = connection.CreateCommand();
                recipientCommand.CommandText = @"
                    SELECT 
                        id, message_send_id,
                        ISNULL(recipient_type, '') as recipient_type,
                        recipient_id, recipient_name,
                        ISNULL(phone_number, '') as phone_number,
                        whatsapp_message_id,
                        ISNULL(status, 'Pending') as status,
                        sent_at, delivered_at, read_at, error_message,
                        retry_count, max_retries, company_id, 
                        ISNULL(created_by, 'system') as created_by,
                        created_at, updated_at, is_active, failed_at, error_code
                    FROM workflow_message_recipients 
                    WHERE message_send_id = @messageSendId AND is_active = 1";
                
                var recipientParameter = recipientCommand.CreateParameter();
                recipientParameter.ParameterName = "@messageSendId";
                recipientParameter.Value = messageSendId;
                recipientCommand.Parameters.Add(recipientParameter);
                
                var recipients = new List<WorkflowMessageRecipient>();
                using var recipientReader = await recipientCommand.ExecuteReaderAsync();
                
                while (await recipientReader.ReadAsync())
                {
                    var recipient = new WorkflowMessageRecipient
                    {
                        Id = recipientReader.GetGuid("id"),
                        MessageSendId = recipientReader.GetGuid("message_send_id"),
                        RecipientType = recipientReader.GetString("recipient_type"),
                        RecipientId = recipientReader.IsDBNull("recipient_id") ? null : recipientReader.GetGuid("recipient_id"),
                        RecipientName = recipientReader.IsDBNull("recipient_name") ? null : recipientReader.GetString("recipient_name"),
                        PhoneNumber = recipientReader.GetString("phone_number"),
                        WhatsAppMessageId = recipientReader.IsDBNull("whatsapp_message_id") ? null : recipientReader.GetString("whatsapp_message_id"),
                        Status = recipientReader.GetString("status"),
                        SentAt = recipientReader.IsDBNull("sent_at") ? null : recipientReader.GetDateTime("sent_at"),
                        DeliveredAt = recipientReader.IsDBNull("delivered_at") ? null : recipientReader.GetDateTime("delivered_at"),
                        ReadAt = recipientReader.IsDBNull("read_at") ? null : recipientReader.GetDateTime("read_at"),
                        ErrorMessage = recipientReader.IsDBNull("error_message") ? null : recipientReader.GetString("error_message"),
                        RetryCount = recipientReader.GetInt32("retry_count"),
                        MaxRetries = recipientReader.GetInt32("max_retries"),
                        CompanyId = recipientReader.GetGuid("company_id"),
                        CreatedBy = recipientReader.GetString("created_by"),
                        CreatedAt = recipientReader.GetDateTime("created_at"),
                        UpdatedAt = recipientReader.GetDateTime("updated_at"),
                        IsActive = recipientReader.GetBoolean("is_active"),
                        FailedAt = recipientReader.IsDBNull("failed_at") ? null : recipientReader.GetDateTime("failed_at"),
                        ErrorCode = recipientReader.IsDBNull("error_code") ? null : recipientReader.GetString("error_code")
                    };
                    recipients.Add(recipient);
                }
                
                messageSend.Recipients = recipients;
                
                _logger.LogInformation("成功獲取消息發送記錄，包含 {RecipientCount} 個收件人", messageSend.Recipients?.Count ?? 0);
                return messageSend;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "獲取消息發送記錄時發生錯誤，MessageSendId: {MessageSendId}", messageSendId);
                throw;
            }
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

        /// <summary>
        /// 獲取每日訊息發送趨勢數據
        /// </summary>
        public async Task<object> GetDailyTrendAsync(Guid? companyId, DateTime startDate, DateTime endDate)
        {
            try
            {
                _logger.LogInformation($"📊 獲取每日趨勢: {startDate:yyyy-MM-dd} 到 {endDate:yyyy-MM-dd}");

                var query = _db.WorkflowMessageSends
                    .Where(ms => ms.IsActive && ms.StartedAt >= startDate && ms.StartedAt <= endDate.AddDays(1));

                if (companyId.HasValue)
                {
                    query = query.Where(ms => ms.CompanyId == companyId.Value);
                }

                // 按日期分組統計
                var dailyStats = await query
                    .GroupBy(ms => ms.StartedAt.Date)
                    .Select(g => new
                    {
                        Date = g.Key,
                        TotalSent = g.Sum(ms => ms.TotalRecipients),
                        Success = g.Sum(ms => ms.SuccessCount),
                        Failed = g.Sum(ms => ms.FailedCount)
                    })
                    .OrderBy(g => g.Date)
                    .ToListAsync();

                // 填充缺失的日期（確保每天都有數據）
                var allDates = new List<DateTime>();
                for (var date = startDate.Date; date <= endDate.Date; date = date.AddDays(1))
                {
                    allDates.Add(date);
                }

                var result = allDates.Select(date =>
                {
                    var stat = dailyStats.FirstOrDefault(s => s.Date == date);
                    return new
                    {
                        date = date.ToString("yyyy-MM-dd"),
                        totalSent = stat?.TotalSent ?? 0,
                        success = stat?.Success ?? 0,
                        failed = stat?.Failed ?? 0
                    };
                }).ToList();

                _logger.LogInformation($"✅ 成功獲取 {result.Count} 天的趨勢數據");

                return new
                {
                    dates = result.Select(r => r.date).ToList(),
                    totalSent = result.Select(r => r.totalSent).ToList(),
                    success = result.Select(r => r.success).ToList(),
                    failed = result.Select(r => r.failed).ToList()
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ 獲取每日趨勢數據失敗");
                throw;
            }
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
