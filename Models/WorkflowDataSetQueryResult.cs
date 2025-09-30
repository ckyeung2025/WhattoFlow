using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PurpleRice.Models
{
    [Table("workflow_data_set_query_results")]
    public class WorkflowDataSetQueryResult
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        [Column("workflow_execution_id")]
        public int WorkflowExecutionId { get; set; }

        [Required]
        [Column("step_execution_id")]
        public int StepExecutionId { get; set; }

        [Required]
        [Column("data_set_id")]
        public Guid DataSetId { get; set; }

        [Required]
        [MaxLength(20)]
        [Column("operation_type")]
        public string OperationType { get; set; } = string.Empty; // SELECT, INSERT, UPDATE, DELETE

        [Column("query_conditions")]
        public string? QueryConditions { get; set; } // JSON 格式的查詢條件

        [Column("query_result")]
        public string? QueryResult { get; set; } // JSON 格式的查詢結果快照

        [Column("mapped_fields")]
        public string? MappedFields { get; set; } // JSON 格式的欄位映射配置

        [Column("process_variables_used")]
        public string? ProcessVariablesUsed { get; set; } // JSON 格式的使用的流程變量

        [Required]
        [Column("executed_at")]
        public DateTime ExecutedAt { get; set; } = DateTime.UtcNow;

        [Required]
        [MaxLength(20)]
        [Column("status")]
        public string Status { get; set; } = "Success"; // Success, Failed, Partial, Running

        [Column("error_message")]
        public string? ErrorMessage { get; set; }

        [Column("total_records")]
        public int TotalRecords { get; set; } = 0; // 查詢到的記錄總數

        [Column("records_processed")]
        public int RecordsProcessed { get; set; } = 0; // 已處理的記錄數

        // 導航屬性
        [ForeignKey("WorkflowExecutionId")]
        public virtual WorkflowExecution? WorkflowExecution { get; set; }

        [ForeignKey("StepExecutionId")]
        public virtual WorkflowStepExecution? StepExecution { get; set; }

        [ForeignKey("DataSetId")]
        public virtual DataSet? DataSet { get; set; }

        public virtual ICollection<WorkflowDataSetQueryRecord> QueryRecords { get; set; } = new List<WorkflowDataSetQueryRecord>();
    }
}
