using PurpleRice.Services;

namespace PurpleRice.Services.WebhookServices
{
    /// <summary>
    /// Webhook 消息去重服務
    /// 負責防止重複處理相同的消息
    /// </summary>
    public class WebhookDuplicateService
    {
        private readonly LoggingService _loggingService;
        
        // 記憶體快取，用於存儲已處理的消息
        private static readonly Dictionary<string, DateTime> _processedMessages = new Dictionary<string, DateTime>();
        private static readonly object _lockObject = new object();
        private static readonly TimeSpan _messageExpiry = TimeSpan.FromHours(24); // 24小時過期

        public WebhookDuplicateService(Func<string, LoggingService> loggingServiceFactory)
        {
            _loggingService = loggingServiceFactory("WebhookDuplicateService");
        }

        /// <summary>
        /// 檢查消息是否已經處理過
        /// </summary>
        /// <param name="messageId">消息 ID</param>
        /// <returns>是否已處理</returns>
        public Task<bool> IsMessageAlreadyProcessed(string messageId)
        {
            lock (_lockObject)
            {
                // 清理過期的消息記錄
                var expiredKeys = _processedMessages
                    .Where(kvp => DateTime.UtcNow - kvp.Value > _messageExpiry)
                    .Select(kvp => kvp.Key)
                    .ToList();
                
                foreach (var key in expiredKeys)
                {
                    _processedMessages.Remove(key);
                }
                
                var isProcessed = _processedMessages.ContainsKey(messageId);
                if (isProcessed)
                {
                    _loggingService.LogWarning($"檢測到重複消息！消息 ID: {messageId}");
                }
                
                return Task.FromResult(isProcessed);
            }
        }

        /// <summary>
        /// 標記消息為已處理
        /// </summary>
        /// <param name="messageId">消息 ID</param>
        public Task MarkMessageAsProcessed(string messageId)
        {
            lock (_lockObject)
            {
                _processedMessages[messageId] = DateTime.UtcNow;
            }
            _loggingService.LogInformation($"消息 {messageId} 已標記為已處理，時間: {DateTime.UtcNow}");
            return Task.CompletedTask;
        }

        /// <summary>
        /// 取消消息的已處理標記
        /// </summary>
        /// <param name="messageId">消息 ID</param>
        public async Task UnmarkMessageAsProcessed(string messageId)
        {
            lock (_lockObject)
            {
                _processedMessages.Remove(messageId);
            }
            _loggingService.LogInformation($"消息 {messageId} 的已處理標記已移除");
        }

        /// <summary>
        /// 獲取已處理消息的統計信息
        /// </summary>
        /// <returns>統計信息</returns>
        public Dictionary<string, object> GetStatistics()
        {
            lock (_lockObject)
            {
                return new Dictionary<string, object>
                {
                    ["totalProcessedMessages"] = _processedMessages.Count,
                    ["oldestMessage"] = _processedMessages.Any() ? _processedMessages.Values.Min() : null,
                    ["newestMessage"] = _processedMessages.Any() ? _processedMessages.Values.Max() : null,
                    ["expiryTime"] = _messageExpiry.TotalHours
                };
            }
        }
    }
}

