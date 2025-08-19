using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PurpleRice.Models
{
    [Table("WhatsAppMonitorChatMsg", Schema = "dbo")]
    public class WhatsAppMonitorChatMsg
    {
        [Key]
        public long Id { get; set; }
        
        [Required]
        [StringLength(50)]
        public string WaId { get; set; }
        
        public int? WorkflowInstanceId { get; set; }
        
        [Required]
        [StringLength(100)]
        public string MessageId { get; set; }
        
        [Required]
        [StringLength(20)]
        public string SenderType { get; set; } // 'user' 或 'admin'
        
        [Required]
        public string MessageText { get; set; }
        
        [StringLength(20)]
        public string MessageType { get; set; } = "text";
        
        [StringLength(20)]
        public string Status { get; set; } = "sent";
        
        [Required]
        public DateTime Timestamp { get; set; }
        
        public DateTime CreatedAt { get; set; } = DateTime.Now;
        
        public DateTime UpdatedAt { get; set; } = DateTime.Now;
        
        public bool IsDeleted { get; set; } = false;
        
        public string? Metadata { get; set; }
        
        // 導航屬性
        [ForeignKey("WorkflowInstanceId")]
        public virtual WorkflowExecution? WorkflowExecution { get; set; }
    }
}
