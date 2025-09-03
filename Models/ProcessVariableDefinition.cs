using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PurpleRice.Models
{
    [Table("process_variable_definitions")]
    public class ProcessVariableDefinition
    {
        [Key]
        [Column("id")]
        public Guid Id { get; set; } = Guid.NewGuid();

        [Required]
        [Column("workflow_definition_id")]
        public int WorkflowDefinitionId { get; set; }

        [Required]
        [MaxLength(100)]
        [Column("variable_name")]
        public string VariableName { get; set; } = string.Empty;

        [MaxLength(200)]
        [Column("display_name")]
        public string? DisplayName { get; set; }

        [Required]
        [MaxLength(50)]
        [Column("data_type")]
        public string DataType { get; set; } = string.Empty;

        [MaxLength(500)]
        [Column("description")]
        public string? Description { get; set; }

        [Column("is_required")]
        public bool IsRequired { get; set; } = false;

        [MaxLength(500)]
        [Column("default_value")]
        public string? DefaultValue { get; set; }

        [MaxLength(1000)]
        [Column("validation_rules")]
        public string? ValidationRules { get; set; }

        [Column("json_schema")]
        public string? JsonSchema { get; set; }

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime? UpdatedAt { get; set; }

        [Required]
        [MaxLength(100)]
        [Column("created_by")]
        public string CreatedBy { get; set; } = string.Empty;

        [MaxLength(100)]
        [Column("updated_by")]
        public string? UpdatedBy { get; set; }

        // 導航屬性
        [ForeignKey("WorkflowDefinitionId")]
        public virtual WorkflowDefinition? WorkflowDefinition { get; set; }

        public virtual ICollection<ProcessVariableValue> Values { get; set; } = new List<ProcessVariableValue>();
    }
}
