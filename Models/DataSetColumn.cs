using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PurpleRice.Models
{
    [Table("data_set_columns")]
    public class DataSetColumn
    {
        [Key]
        public Guid Id { get; set; }
        
        [Required]
        public Guid DataSetId { get; set; }
        
        [Required]
        [StringLength(100)]
        public string ColumnName { get; set; } = string.Empty;
        
        [StringLength(100)]
        public string? DisplayName { get; set; }
        
        [Required]
        [StringLength(50)]
        public string DataType { get; set; } = string.Empty; // string, int, decimal, datetime, boolean
        
        public int? MaxLength { get; set; }
        public bool IsRequired { get; set; } = false;
        public bool IsPrimaryKey { get; set; } = false;
        public bool IsSearchable { get; set; } = false;
        public bool IsSortable { get; set; } = false;
        public bool IsIndexed { get; set; } = false;
        
        [StringLength(500)]
        public string? DefaultValue { get; set; }
        
        public int SortOrder { get; set; } = 0;
        
        // 導航屬性
        [ForeignKey("DataSetId")]
        public virtual DataSet DataSet { get; set; } = null!;
    }
}
