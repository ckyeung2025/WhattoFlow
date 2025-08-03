using System;

namespace PurpleRice.Models
{
    public class WorkflowStepExecution
    {
        public int Id { get; set; }
        public int WorkflowExecutionId { get; set; }
        public WorkflowExecution? WorkflowExecution { get; set; }
        public int StepIndex { get; set; }
        public string? StepType { get; set; }
        public string? Status { get; set; }
        public string? InputJson { get; set; }
        public string? OutputJson { get; set; }
        public DateTime? StartedAt { get; set; }
        public DateTime? EndedAt { get; set; }
        
        // 新增等待相關屬性
        public bool IsWaiting { get; set; }
        public string? WaitingForUser { get; set; }
        public string? ValidationConfig { get; set; } // JSON 格式的驗證配置
    }
} 