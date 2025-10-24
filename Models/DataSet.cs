using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PurpleRice.Models
{
    [Table("data_sets")]
    public class DataSet
    {
        [Key]
        public Guid Id { get; set; }
        
        [Required]
        [StringLength(200)]
        public string Name { get; set; } = string.Empty;
        
        [StringLength(500)]
        public string? Description { get; set; }
        
        [Required]
        [StringLength(50)]
        public string DataSourceType { get; set; } = string.Empty; // SQL, EXCEL, GOOGLE_DOCS
        
        [Required]
        public Guid CompanyId { get; set; }
        
        [Required]
        [StringLength(50)]
        public string Status { get; set; } = "Active"; // Active, Inactive, Error
        
        // 定時更新設定
        public bool IsScheduled { get; set; } = false;
        public int? UpdateIntervalMinutes { get; set; }
        public DateTime? LastUpdateTime { get; set; }
        public DateTime? NextUpdateTime { get; set; }
        
        // 數據統計
        public int TotalRecords { get; set; } = 0;
        public DateTime? LastDataSyncTime { get; set; }
        
        // 同步狀態管理
        [StringLength(20)]
        public string SyncStatus { get; set; } = "Idle"; // Idle, Running, Completed, Failed, Paused
        
        public DateTime? SyncStartedAt { get; set; }
        public DateTime? SyncCompletedAt { get; set; }
        
        public string? SyncErrorMessage { get; set; }
        
        [StringLength(50)]
        public string? SyncStartedBy { get; set; } // Scheduler, User
        
        // 進度追蹤
        public int? TotalRecordsToSync { get; set; } = 0;
        public int? RecordsProcessed { get; set; } = 0;
        public int? RecordsInserted { get; set; } = 0;
        public int? RecordsUpdated { get; set; } = 0;
        public int? RecordsDeleted { get; set; } = 0;
        public int? RecordsSkipped { get; set; } = 0;
        
        // 批次處理設定
        public int? BatchSize { get; set; } = 1000;
        public int? MaxSyncDurationMinutes { get; set; } = 60;
        public bool? AllowOverlap { get; set; } = false;
        
        // 審計欄位
        [Required]
        [StringLength(100)]
        public string CreatedBy { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        
        [StringLength(100)]
        public string? UpdatedBy { get; set; }
        public DateTime? UpdatedAt { get; set; }
        
        // 導航屬性 - 簡化版本
        public virtual ICollection<DataSetColumn> Columns { get; set; } = new List<DataSetColumn>();
        public virtual ICollection<DataSetDataSource> DataSources { get; set; } = new List<DataSetDataSource>();
        public virtual ICollection<DataSetRecord> Records { get; set; } = new List<DataSetRecord>();
    }
}
