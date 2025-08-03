using System;
using System.Collections.Generic;

namespace PurpleRice.Models
{
    public class WorkflowExecution
    {
        public int Id { get; set; }
        public int WorkflowDefinitionId { get; set; }
        public WorkflowDefinition? WorkflowDefinition { get; set; }
        public string? Status { get; set; }
        public int? CurrentStep { get; set; }
        public string? InputJson { get; set; } // 匹配資料庫欄位名稱
        public string? OutputJson { get; set; }
        public DateTime StartedAt { get; set; }
        public DateTime? EndedAt { get; set; } // 匹配資料庫欄位名稱
        public string? CreatedBy { get; set; }
        public string? ErrorMessage { get; set; } // 添加錯誤信息字段
        public ICollection<WorkflowStepExecution>? StepExecutions { get; set; }
        
        // 新增等待相關屬性
        public bool IsWaiting { get; set; }
        public DateTime? WaitingSince { get; set; }
        public DateTime? LastUserActivity { get; set; }
        public int? CurrentWaitingStep { get; set; }
        public string? WaitingForUser { get; set; }
    }
} 