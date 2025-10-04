using System;

namespace PurpleRice.Models
{
    public class MessageValidation
    {
        public int Id { get; set; }
        public int WorkflowExecutionId { get; set; }
        public WorkflowExecution? WorkflowExecution { get; set; }
        public int StepIndex { get; set; }
        public string UserWaId { get; set; } = string.Empty;
        public string UserMessage { get; set; } = string.Empty;
        
        /// <summary>
        /// 消息類型：text, image, audio, video, document
        /// </summary>
        public string? MessageType { get; set; } = "text";
        
        /// <summary>
        /// 媒體 ID（用於圖片、音頻、視頻等）
        /// </summary>
        public string? MediaId { get; set; }
        
        /// <summary>
        /// 媒體 URL（本地存儲路徑或外部 URL）
        /// </summary>
        public string? MediaUrl { get; set; }
        
        public bool IsValid { get; set; }
        public string? ErrorMessage { get; set; }
        public string? ValidatorType { get; set; } // "custom", "openai", "xai", "regex"
        public string? ProcessedData { get; set; } // JSON 格式的處理後數據
        public DateTime CreatedAt { get; set; }
    }
} 