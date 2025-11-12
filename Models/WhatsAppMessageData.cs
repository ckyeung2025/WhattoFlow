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

        /// <summary>
        /// 圖片文字說明（caption，如果圖片消息包含文字）
        /// </summary>
        public string Caption { get; set; } = string.Empty;

        /// <summary>
        /// 媒體檔案的 MIME 類型（image/jpeg、application/pdf 等）
        /// </summary>
        public string? MediaMimeType { get; set; }

        /// <summary>
        /// 媒體原始檔案名稱（若提供）
        /// </summary>
        public string? MediaFileName { get; set; }

        /// <summary>
        /// 媒體資料的 Base64 字串（圖片、文件等）
        /// </summary>
        public string? MediaContentBase64 { get; set; }

        /// <summary>
        /// 針對文件類訊息，轉換後的純文字內容
        /// </summary>
        public string? DocumentPlainText { get; set; }

        /// <summary>
        /// 針對文件類訊息，解析後的結構化 JSON（序列化字串）
        /// </summary>
        public string? DocumentStructuredJson { get; set; }
    }
}

