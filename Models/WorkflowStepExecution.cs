using System;
using System.ComponentModel.DataAnnotations.Schema;

namespace PurpleRice.Models
{
    public class WorkflowStepExecution
    {
        public int Id { get; set; }
        public int WorkflowExecutionId { get; set; }
        public WorkflowExecution? WorkflowExecution { get; set; }
        public int StepIndex { get; set; }
        public string? StepType { get; set; }
        public string? TaskName { get; set; } // 用戶自定義的任務名稱
        public string? Status { get; set; }
        public string? InputJson { get; set; }
        public string? OutputJson { get; set; }
        public string? ReceivedPayloadJson { get; set; }
        public string? AiResultJson { get; set; }
        public DateTime? StartedAt { get; set; }
        public DateTime? EndedAt { get; set; }
        
        // 新增等待相關屬性
        public bool IsWaiting { get; set; }
        public string? WaitingForUser { get; set; }
        public string? ValidationConfig { get; set; } // JSON 格式的驗證配置
        
        // Time Validator 重試機制相關屬性
        [Column("last_retry_at")]
        public DateTime? LastRetryAt { get; set; }        // 上次重試時間
        [Column("retry_count")]
        public int RetryCount { get; set; }               // 已重試次數
        [Column("escalation_sent")]
        public bool EscalationSent { get; set; }          // 是否已發送升級通知
        [Column("escalation_sent_at")]
        public DateTime? EscalationSentAt { get; set; }   // 升級通知發送時間
    }
} 