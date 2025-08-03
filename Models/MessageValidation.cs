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
        public bool IsValid { get; set; }
        public string? ErrorMessage { get; set; }
        public string? ValidatorType { get; set; } // "custom", "openai", "xai", "regex"
        public string? ProcessedData { get; set; } // JSON 格式的處理後數據
        public DateTime CreatedAt { get; set; }
    }
} 