using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PurpleRice.Models
{
    [Table("data_set_record_values")]
    public class DataSetRecordValue
    {
        [Key]
        public Guid Id { get; set; }
        
        [Required]
        public Guid RecordId { get; set; }
        
        [Required]
        [StringLength(100)]
        public string ColumnName { get; set; } = string.Empty; // 對應 data_set_columns.column_name
        
        // 值存儲（根據 data_type 選擇對應的欄位）
        [StringLength(500)]
        public string? StringValue { get; set; }      // 字串值
        
        [Column(TypeName = "decimal(18,4)")]
        public decimal? NumericValue { get; set; }     // 數值
        
        public DateTime? DateValue { get; set; }            // 日期值
        
        public bool? BooleanValue { get; set; }               // 布林值
        
        // 長文本值（用於存儲較長的內容）
        [Column(TypeName = "nvarchar(max)")]
        public string? TextValue { get; set; }
        
        // 導航屬性
        [ForeignKey("RecordId")]
        public virtual DataSetRecord Record { get; set; } = null!;
    }
}
