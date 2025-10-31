using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PurpleRice.Models
{
    /// <summary>
    /// 聯絡人定時匯入排程
    /// </summary>
    public class ContactImportSchedule
    {
        [Key]
        public Guid Id { get; set; }
        
        [Required]
        [MaxLength(200)]
        public string Name { get; set; }
        
        [Required]
        [MaxLength(20)]
        public string ImportType { get; set; } // 'excel', 'google', 'sql'
        
        [Required]
        public Guid CompanyId { get; set; }
        
        // 定時設定
        public bool IsScheduled { get; set; }
        
        [MaxLength(20)]
        public string? ScheduleType { get; set; } // 'interval', 'daily', 'weekly', 'cron'
        
        public int? IntervalMinutes { get; set; }
        
        [MaxLength(100)]
        public string? ScheduleCron { get; set; }
        
        public DateTime? LastRunAt { get; set; }
        
        public DateTime? NextRunAt { get; set; }
        
        // 源配置 (JSON)
        [Required]
        public string SourceConfig { get; set; } // 存放 excelConfig, googleConfig, sqlConfig
        
        // 字段映射 (JSON)
        [Required]
        public string FieldMapping { get; set; } // 存放字段映射
        
        // 匯入設定
        public bool AllowUpdateDuplicates { get; set; }
        
        public Guid? BroadcastGroupId { get; set; }
        
        // 狀態
        [MaxLength(20)]
        public string Status { get; set; } = "Active"; // 'Active', 'Paused', 'Inactive'
        
        public bool IsActive { get; set; } = true;
        
        // 審計字段
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
        
        [Required]
        [MaxLength(100)]
        public string CreatedBy { get; set; }
        
        [MaxLength(100)]
        public string? UpdatedBy { get; set; }
        
        // 導航屬性
        [ForeignKey("CompanyId")]
        public Company? Company { get; set; }
    }
}

