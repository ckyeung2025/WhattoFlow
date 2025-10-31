using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PurpleRice.Models
{
    /// <summary>
    /// 聯絡人匯入執行記錄
    /// </summary>
    public class ContactImportExecution
    {
        [Key]
        public Guid Id { get; set; }
        
        [Required]
        public Guid ScheduleId { get; set; }
        
        [Required]
        public Guid CompanyId { get; set; }
        
        // 執行結果
        [Required]
        [MaxLength(20)]
        public string Status { get; set; } // 'Success', 'Failed', 'Partial', 'Running'
        
        public int TotalRecords { get; set; }
        
        public int SuccessCount { get; set; }
        
        public int FailedCount { get; set; }
        
        public string? ErrorMessage { get; set; }
        
        // 時間戳
        public DateTime StartedAt { get; set; } = DateTime.UtcNow;
        
        public DateTime? CompletedAt { get; set; }
        
        // 導航屬性
        [ForeignKey("ScheduleId")]
        public ContactImportSchedule? Schedule { get; set; }
    }
}

