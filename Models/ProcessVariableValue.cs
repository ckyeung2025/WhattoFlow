using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PurpleRice.Models
{
    [Table("process_variable_values")]
    public class ProcessVariableValue
    {
        [Key]
        [Column("id")]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        [Column("workflow_execution_id")]
        public int WorkflowExecutionId { get; set; }

        [Required]
        [MaxLength(100)]
        [Column("variable_name")]
        public string VariableName { get; set; } = string.Empty;

        [Required]
        [MaxLength(50)]
        [Column("data_type")]
        public string DataType { get; set; } = string.Empty;

        // 值存儲（根據 data_type 選擇對應的欄位）
        [MaxLength(500)]
        [Column("string_value")]
        public string? StringValue { get; set; }

        [Column("numeric_value")]
        public decimal? NumericValue { get; set; }

        [Column("date_value")]
        public DateTime? DateValue { get; set; }

        [Column("boolean_value")]
        public bool? BooleanValue { get; set; }

        [Column("text_value")]
        public string? TextValue { get; set; }

        [Column("json_value")]
        public string? JsonValue { get; set; }

        [Column("set_at")]
        public DateTime SetAt { get; set; } = DateTime.UtcNow;

        [MaxLength(100)]
        [Column("set_by")]
        public string? SetBy { get; set; }

        [MaxLength(50)]
        [Column("source_type")]
        public string? SourceType { get; set; }

        [MaxLength(500)]
        [Column("source_reference")]
        public string? SourceReference { get; set; }

        // 導航屬性
        [ForeignKey("WorkflowExecutionId")]
        public virtual WorkflowExecution? WorkflowExecution { get; set; }

        // 輔助方法：根據數據類型獲取值
        public object? GetValue()
        {
            return DataType.ToLower() switch
            {
                "string" => StringValue,
                "int" or "decimal" => NumericValue,
                "datetime" => DateValue,
                "boolean" => BooleanValue,
                "text" => TextValue,
                "json" => JsonValue,
                _ => StringValue
            };
        }

        // 輔助方法：根據數據類型設置值
        public void SetValue(object? value)
        {
            // 清空所有值
            StringValue = null;
            NumericValue = null;
            DateValue = null;
            BooleanValue = null;
            TextValue = null;
            JsonValue = null;

            if (value == null) return;

            switch (DataType.ToLower())
            {
                case "string":
                    StringValue = value.ToString();
                    break;
                case "int":
                case "decimal":
                    if (decimal.TryParse(value.ToString(), out var numValue))
                        NumericValue = numValue;
                    break;
                case "datetime":
                    if (DateTime.TryParse(value.ToString(), out var dateValue))
                        DateValue = dateValue;
                    break;
                case "boolean":
                    if (bool.TryParse(value.ToString(), out var boolValue))
                        BooleanValue = boolValue;
                    break;
                case "text":
                    TextValue = value.ToString();
                    break;
                case "json":
                    JsonValue = value.ToString();
                    break;
                default:
                    StringValue = value.ToString();
                    break;
            }
        }
    }
}
