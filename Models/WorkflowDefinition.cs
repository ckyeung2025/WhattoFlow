using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations.Schema;

namespace PurpleRice.Models
{
    public class WorkflowDefinition
    {
        public int Id { get; set; }
        
        [Column("company_id")]
        public Guid CompanyId { get; set; } // 添加公司ID
        
        public string? Name { get; set; }
        public string? Description { get; set; }
        public string? Json { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public string? CreatedBy { get; set; }
        public string? UpdatedBy { get; set; }
        public string? Status { get; set; }
        public ICollection<WorkflowExecution>? Executions { get; set; }
    }
} 