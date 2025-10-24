using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PurpleRice.Models
{
    [Table("data_set_data_sources")]
    public class DataSetDataSource
    {
        [Key]
        public Guid Id { get; set; }
        
        [Required]
        public Guid DataSetId { get; set; }
        
        [Required]
        [StringLength(50)]
        public string SourceType { get; set; } = string.Empty; // SQL, EXCEL, GOOGLE_DOCS
        
        // SQL 數據源
        [StringLength(1000)]
        public string? DatabaseConnection { get; set; }
        
        [Column(TypeName = "nvarchar(max)")]
        public string? SqlQuery { get; set; }
        
        [StringLength(2000)]
        public string? SqlParameters { get; set; } // JSON 格式的參數
        
        // Excel 數據源
        [StringLength(1000)]
        public string? ExcelFilePath { get; set; }
        
        [StringLength(100)]
        public string? ExcelSheetName { get; set; }
        
        // Google Docs 數據源
        [StringLength(1000)]
        public string? GoogleDocsUrl { get; set; }
        
        [StringLength(100)]
        public string? GoogleDocsSheetName { get; set; }
        
        // 認證設定
        [StringLength(2000)]
        public string? AuthenticationConfig { get; set; } // JSON 格式的認證配置
        
        // 更新設定
        public DateTime? LastUpdateTime { get; set; }
        
        // 導航屬性
        [ForeignKey("DataSetId")]
        public virtual DataSet DataSet { get; set; } = null!;
    }
}
