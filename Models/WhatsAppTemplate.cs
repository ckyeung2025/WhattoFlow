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
        
        [MaxLength(20)]
        public string TemplateSource { get; set; } = "Internal"; // Internal, Meta - 區分內部模板和 Meta 官方模板
        
        [Required]
        public string Content { get; set; } // JSON 格式存儲模板內容
        
        public string Variables { get; set; } // JSON 格式存儲變數定義
        
        [MaxLength(20)]
        public string Status { get; set; } = "Active"; // Active, Inactive, Draft
        
        // Meta 模板的 Header 相關字段（用於 IMAGE/VIDEO/DOCUMENT）
        [MaxLength(1000)]
        public string HeaderUrl { get; set; } // Meta template 的 header URL（用於發送消息時）
        
        [MaxLength(50)]
        public string HeaderType { get; set; } // image, video, document
        
        [MaxLength(500)]
        public string HeaderFilename { get; set; } // 僅 document 需要
        
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