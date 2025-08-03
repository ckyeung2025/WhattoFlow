using System.ComponentModel.DataAnnotations;

namespace PurpleRice.Models
{
    public class WhatsAppTemplate
    {
        public Guid Id { get; set; }
        
        [Required]
        [MaxLength(200)]
        public string Name { get; set; }
        
        [MaxLength(500)]
        public string Description { get; set; }
        
        [MaxLength(100)]
        public string Category { get; set; } = "General";
        
        [Required]
        [MaxLength(50)]
        public string TemplateType { get; set; } = "Text"; // Text, Media, Interactive, Template
        
        [Required]
        public string Content { get; set; } // JSON 格式存儲模板內容
        
        public string Variables { get; set; } // JSON 格式存儲變數定義
        
        [MaxLength(20)]
        public string Status { get; set; } = "Active"; // Active, Inactive, Draft
        
        [MaxLength(10)]
        public string Language { get; set; } = "zh-TW";
        
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
        
        [MaxLength(100)]
        public string CreatedBy { get; set; }
        
        [MaxLength(100)]
        public string UpdatedBy { get; set; }
        
        public Guid? CompanyId { get; set; }
        
        public bool IsDeleted { get; set; } = false;
        
        public int Version { get; set; } = 1;
        
        [MaxLength(200)]
        public string MetaTemplateId { get; set; } // Meta WhatsApp 模板 ID
    }

    public class WhatsAppTemplateUsage
    {
        public Guid Id { get; set; }
        
        public Guid TemplateId { get; set; }
        
        public Guid? WorkflowId { get; set; }
        
        [MaxLength(100)]
        public string NodeId { get; set; } // 流程節點 ID
        
        public DateTime UsedAt { get; set; } = DateTime.UtcNow;
        
        [MaxLength(100)]
        public string UsedBy { get; set; }
        
        public string Variables { get; set; } // 實際使用的變數值
        
        [MaxLength(20)]
        public string Status { get; set; } = "Sent"; // Sent, Failed, Pending
        
        [MaxLength(200)]
        public string MessageId { get; set; } // WhatsApp API 返回的訊息 ID
        
        // 導航屬性
        public WhatsAppTemplate Template { get; set; }
    }
}