using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PurpleRice.Models
{
    [Table("data_set_records")]
    public class DataSetRecord
    {
        [Key]
        public Guid Id { get; set; }
        
        [Required]
        public Guid DataSetId { get; set; }
        
        // 核心欄位
        [StringLength(255)]
        public string? PrimaryKeyValue { get; set; } // 主鍵值，如 invoice_no
        
        [StringLength(50)]
        public string? Status { get; set; } // 記錄狀態
        
        // 審計欄位
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
        
        // 導航屬性
        [ForeignKey("DataSetId")]
        public virtual DataSet DataSet { get; set; } = null!;
        
        public virtual ICollection<DataSetRecordValue> Values { get; set; } = new List<DataSetRecordValue>();
    }
}
