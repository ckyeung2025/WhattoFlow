using System;

namespace PurpleRice.Models
{
    /// <summary>
    /// 排程執行記錄統一模型
    /// 記錄所有類型的排程執行狀態
    /// </summary>
    public class SchedulerExecution
    {
        public Guid Id { get; set; }
        public Guid CompanyId { get; set; }  // 改為非空
        
        /// <summary>
        /// 排程類型: 'retry_monitoring', 'overdue_monitoring', 'dataset_sync', 'contact_import'
        /// </summary>
        public string ScheduleType { get; set; }
        
        /// <summary>
        /// 關聯的目標 ID（如 workflow_id, dataset_id, schedule_id）
        /// </summary>
        public Guid? RelatedId { get; set; }
        
        /// <summary>
        /// 關聯目標的名稱（便於查詢）
        /// </summary>
        public string RelatedName { get; set; }
        
        /// <summary>
        /// 執行狀態: 'Success', 'Failed', 'Partial', 'Running', 'Skipped'
        /// </summary>
        public string Status { get; set; }
        
        /// <summary>
        /// 處理的項目總數
        /// </summary>
        public int TotalItems { get; set; }
        
        /// <summary>
        /// 成功數
        /// </summary>
        public int SuccessCount { get; set; }
        
        /// <summary>
        /// 失敗數
        /// </summary>
        public int FailedCount { get; set; }
        
        /// <summary>
        /// 摘要訊息
        /// </summary>
        public string Message { get; set; }
        
        /// <summary>
        /// 詳細錯誤訊息
        /// </summary>
        public string ErrorMessage { get; set; }
        
        /// <summary>
        /// 開始時間
        /// </summary>
        public DateTime StartedAt { get; set; }
        
        /// <summary>
        /// 完成時間
        /// </summary>
        public DateTime? CompletedAt { get; set; }
        
        /// <summary>
        /// 執行耗時（毫秒）
        /// </summary>
        public int? ExecutionDurationMs { get; set; }
        
        /// <summary>
        /// 創建者
        /// </summary>
        public string CreatedBy { get; set; }
        
        // Navigation
        public Company Company { get; set; }
    }
}

