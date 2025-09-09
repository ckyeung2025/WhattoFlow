namespace PurpleRice.Models
{
    /// <summary>
    /// WhatsApp 消息數據模型
    /// 用於存儲從 Meta Webhook 提取的消息信息
    /// </summary>
    public class WhatsAppMessageData
    {
        /// <summary>
        /// WhatsApp 用戶 ID
        /// </summary>
        public string WaId { get; set; } = string.Empty;

        /// <summary>
        /// 聯絡人姓名
        /// </summary>
        public string ContactName { get; set; } = string.Empty;

        /// <summary>
        /// 消息 ID
        /// </summary>
        public string MessageId { get; set; } = string.Empty;

        /// <summary>
        /// 消息文本內容
        /// </summary>
        public string MessageText { get; set; } = string.Empty;

        /// <summary>
        /// 消息時間戳
        /// </summary>
        public DateTime Timestamp { get; set; }

        /// <summary>
        /// 消息來源
        /// </summary>
        public string Source { get; set; } = string.Empty;

        /// <summary>
        /// 消息類型
        /// </summary>
        public string MessageType { get; set; } = "text";

        /// <summary>
        /// 互動類型（如果是互動消息）
        /// </summary>
        public string InteractiveType { get; set; } = string.Empty;

        /// <summary>
        /// 媒體 ID（如果是媒體消息）
        /// </summary>
        public string MediaId { get; set; } = string.Empty;
    }
}

