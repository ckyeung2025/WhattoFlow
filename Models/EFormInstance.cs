using System;

namespace PurpleRice.Models
{
    public class EFormInstance
    {
        public Guid Id { get; set; }
        public Guid EFormDefinitionId { get; set; }
        public eFormDefinition? EFormDefinition { get; set; }
        public int WorkflowExecutionId { get; set; }
        public WorkflowExecution? WorkflowExecution { get; set; }
        public int WorkflowStepExecutionId { get; set; }
        public WorkflowStepExecution? WorkflowStepExecution { get; set; }
        public Guid CompanyId { get; set; }
        public Company? Company { get; set; }
        public string InstanceName { get; set; } = string.Empty;
        public string OriginalHtmlCode { get; set; } = string.Empty;
        public string? FilledHtmlCode { get; set; }
        public string? UserMessage { get; set; }
        public string Status { get; set; } = "Pending"; // Pending, Approved, Rejected
        public string? ApprovalBy { get; set; }
        public DateTime? ApprovalAt { get; set; }
        public string? ApprovalNote { get; set; }
        public string? FormUrl { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        
        // 新增字段 - Manual Fill 支持
        public string? FillType { get; set; }  // "AI", "Data", "Manual"
        public string? RecipientWhatsAppNo { get; set; }  // 收件人手機號（Manual Fill 用）
        public string? RecipientName { get; set; }  // 收件人姓名（可選，方便識別）
        public Guid? ParentInstanceId { get; set; }  // 父表單實例ID（用於關聯同一批次的表單）
        public string? AccessToken { get; set; }  // 安全訪問 Token
        public DateTime? TokenExpiresAt { get; set; }  // Token 過期時間
    }
} 