using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PurpleRice.Models
{
    [Table("workflow_data_set_query_records")]
    public class WorkflowDataSetQueryRecord
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        [Column("query_result_id")]
        public Guid QueryResultId { get; set; }

        [Column("data_set_record_id")]
        public Guid? DataSetRecordId { get; set; } // 可空：外部數據源查詢時不一定有對應的 DataSetRecord

        [MaxLength(255)]
        [Column("record_primary_key")]
        public string? RecordPrimaryKey { get; set; } // 主鍵值，如 invoice_no

        [MaxLength(50)]
        [Column("record_status")]
        public string? RecordStatus { get; set; } // 記錄狀態

        [MaxLength(100)]
        [Column("mapped_variable_name")]
        public string? MappedVariableName { get; set; } // 映射到的流程變量名稱

        [Column("mapped_variable_value")]
        public string? MappedVariableValue { get; set; } // 映射到的流程變量值

        [Required]
        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        // 導航屬性
        [ForeignKey("QueryResultId")]
        public virtual WorkflowDataSetQueryResult? QueryResult { get; set; }

        [ForeignKey("DataSetRecordId")]
        public virtual DataSetRecord? DataSetRecord { get; set; }
    }
}
