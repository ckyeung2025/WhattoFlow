using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PurpleRice.Models
{
    public class BroadcastSend
    {
        [Key]
        public Guid Id { get; set; }
        
        [Required]
        public Guid CompanyId { get; set; }
        
        public int? WorkflowExecutionId { get; set; }
        
        public Guid? BroadcastGroupId { get; set; }
        
        [MaxLength(500)]
        public string? HashtagFilter { get; set; }
        
        public string? MessageContent { get; set; }
        
        public Guid? TemplateId { get; set; }
        
        public int TotalContacts { get; set; } = 0;
        
        public int SentCount { get; set; } = 0;
        
        public int FailedCount { get; set; } = 0;
        
        [MaxLength(20)]
        public string Status { get; set; } = "Pending"; // Pending, Sending, Completed, Failed, Cancelled
        
        public DateTime StartedAt { get; set; } = DateTime.UtcNow;
        
        public DateTime? CompletedAt { get; set; }
        
        [MaxLength(100)]
        public string CreatedBy { get; set; }
        
        public string? ErrorMessage { get; set; }
        
        // 導航屬性
        [ForeignKey("CompanyId")]
        public Company? Company { get; set; }
        
        [ForeignKey("WorkflowExecutionId")]
        public WorkflowExecution? WorkflowExecution { get; set; }
        
        [ForeignKey("BroadcastGroupId")]
        public BroadcastGroup? BroadcastGroup { get; set; }
        
        [ForeignKey("TemplateId")]
        public WhatsAppTemplate? Template { get; set; }
        
        public ICollection<BroadcastSendDetail>? SendDetails { get; set; }
    }
}
