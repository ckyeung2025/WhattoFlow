using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations.Schema;

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
        
        // 記錄工作流啟動者（Meta Webhook 用戶電話號碼或手動啟動者）
        public string? InitiatedBy { get; set; }
        
        // Overdue 逾期監控相關屬性
        [Column("overdue_notified")]
        public bool OverdueNotified { get; set; }         // 是否已發送逾期通知
        [Column("overdue_notified_at")]
        public DateTime? OverdueNotifiedAt { get; set; }  // 逾期通知發送時間
        [Column("overdue_threshold_minutes")]
        public int? OverdueThresholdMinutes { get; set; } // 逾期閾值（分鐘）
        
        // 計算執行時間（分鐘）
        public double? Duration
        {
            get
            {
                if (EndedAt.HasValue)
                {
                    return (EndedAt.Value - StartedAt).TotalMinutes;
                }
                else if (IsWaiting)
                {
                    return (DateTime.UtcNow - StartedAt).TotalMinutes;
                }
                return null;
            }
        }
    }
} 