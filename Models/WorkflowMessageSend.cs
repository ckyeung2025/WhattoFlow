using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PurpleRice.Models
{
    /// <summary>
    /// 工作流程消息發送記錄主表
    /// </summary>
    [Table("workflow_message_sends")]
    public class WorkflowMessageSend
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        /// <summary>
        /// 工作流程執行ID
        /// </summary>
        [Required]
        public int WorkflowExecutionId { get; set; }

        /// <summary>
        /// 工作流程步驟執行ID（可選）
        /// </summary>
        public int? WorkflowStepExecutionId { get; set; }

        /// <summary>
        /// 節點ID
        /// </summary>
        [Required]
        [MaxLength(50)]
        public string NodeId { get; set; }

        /// <summary>
        /// 節點類型
        /// </summary>
        [Required]
        [MaxLength(50)]
        public string NodeType { get; set; }

        /// <summary>
        /// 消息類型
        /// </summary>
        [Required]
        [MaxLength(20)]
        public string MessageType { get; set; } = "text";

        /// <summary>
        /// 模板ID（如果是模板消息）
        /// </summary>
        [MaxLength(50)]
        public string TemplateId { get; set; }

        /// <summary>
        /// 模板名稱
        /// </summary>
        [MaxLength(100)]
        public string TemplateName { get; set; }

        /// <summary>
        /// 消息內容
        /// </summary>
        public string MessageContent { get; set; }

        /// <summary>
        /// 總收件人數
        /// </summary>
        public int TotalRecipients { get; set; } = 0;

        /// <summary>
        /// 成功發送數
        /// </summary>
        public int SuccessCount { get; set; } = 0;

        /// <summary>
        /// 失敗發送數
        /// </summary>
        public int FailedCount { get; set; } = 0;

        /// <summary>
        /// 發送狀態
        /// </summary>
        [Required]
        [MaxLength(20)]
        public string Status { get; set; } = "Pending";

        /// <summary>
        /// 開始時間
        /// </summary>
        public DateTime StartedAt { get; set; } = DateTime.UtcNow;

        /// <summary>
        /// 完成時間
        /// </summary>
        public DateTime? CompletedAt { get; set; }

        /// <summary>
        /// 錯誤信息
        /// </summary>
        public string ErrorMessage { get; set; }

        /// <summary>
        /// 公司ID
        /// </summary>
        [Required]
        public Guid CompanyId { get; set; }

        /// <summary>
        /// 創建者
        /// </summary>
        [Required]
        [MaxLength(50)]
        public string CreatedBy { get; set; }

        /// <summary>
        /// 創建時間
        /// </summary>
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        /// <summary>
        /// 更新時間
        /// </summary>
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        /// <summary>
        /// 是否啟用
        /// </summary>
        public bool IsActive { get; set; } = true;

        // 導航屬性
        [ForeignKey("WorkflowExecutionId")]
        public virtual WorkflowExecution WorkflowExecution { get; set; }

        [ForeignKey("CompanyId")]
        public virtual Company Company { get; set; }

        public virtual ICollection<WorkflowMessageRecipient> Recipients { get; set; } = new List<WorkflowMessageRecipient>();
    }

    /// <summary>
    /// 工作流程消息收件人明細表
    /// </summary>
    [Table("workflow_message_recipients")]
    public class WorkflowMessageRecipient
    {
        [Key]
        public Guid Id { get; set; } = Guid.NewGuid();

        /// <summary>
        /// 消息發送記錄ID
        /// </summary>
        [Required]
        public Guid MessageSendId { get; set; }

        /// <summary>
        /// 收件人類型
        /// </summary>
        [Required]
        [MaxLength(20)]
        public string RecipientType { get; set; }

        /// <summary>
        /// 收件人ID（可選）
        /// </summary>
        public Guid? RecipientId { get; set; }

        /// <summary>
        /// 收件人名稱
        /// </summary>
        [MaxLength(200)]
        public string RecipientName { get; set; }

        /// <summary>
        /// 電話號碼
        /// </summary>
        [Required]
        [MaxLength(20)]
        public string PhoneNumber { get; set; }

        /// <summary>
        /// WhatsApp消息ID
        /// </summary>
        [MaxLength(100)]
        public string WhatsAppMessageId { get; set; }

        /// <summary>
        /// 發送狀態
        /// </summary>
        [Required]
        [MaxLength(20)]
        public string Status { get; set; } = "Pending";

        /// <summary>
        /// 錯誤代碼
        /// </summary>
        [MaxLength(50)]
        public string ErrorCode { get; set; }

        /// <summary>
        /// 錯誤信息
        /// </summary>
        [MaxLength(500)]
        public string ErrorMessage { get; set; }

        /// <summary>
        /// 發送時間
        /// </summary>
        public DateTime? SentAt { get; set; }

        /// <summary>
        /// 送達時間
        /// </summary>
        public DateTime? DeliveredAt { get; set; }

        /// <summary>
        /// 已讀時間
        /// </summary>
        public DateTime? ReadAt { get; set; }

        /// <summary>
        /// 失敗時間
        /// </summary>
        public DateTime? FailedAt { get; set; }

        /// <summary>
        /// 重試次數
        /// </summary>
        [Required]
        public int RetryCount { get; set; } = 0;

        /// <summary>
        /// 最大重試次數
        /// </summary>
        [Required]
        public int MaxRetries { get; set; } = 3;

        /// <summary>
        /// 公司ID
        /// </summary>
        [Required]
        public Guid CompanyId { get; set; }

        /// <summary>
        /// 創建者
        /// </summary>
        [Required]
        [MaxLength(50)]
        public string CreatedBy { get; set; }

        /// <summary>
        /// 創建時間
        /// </summary>
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        /// <summary>
        /// 更新時間
        /// </summary>
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        /// <summary>
        /// 是否啟用
        /// </summary>
        public bool IsActive { get; set; } = true;

        // 導航屬性
        [ForeignKey("MessageSendId")]
        public virtual WorkflowMessageSend MessageSend { get; set; }

        [ForeignKey("CompanyId")]
        public virtual Company Company { get; set; }
    }

    /// <summary>
    /// 發送狀態枚舉
    /// </summary>
    public static class MessageSendStatus
    {
        public const string Pending = "Pending";
        public const string InProgress = "InProgress";
        public const string Completed = "Completed";
        public const string Failed = "Failed";
        public const string PartiallyFailed = "PartiallyFailed";
    }

    /// <summary>
    /// 收件人狀態枚舉
    /// </summary>
    public static class RecipientStatus
    {
        public const string Pending = "Pending";
        public const string Sent = "Sent";
        public const string Delivered = "Delivered";
        public const string Read = "Read";
        public const string Failed = "Failed";
        public const string Retrying = "Retrying";
    }

    /// <summary>
    /// 收件人類型枚舉
    /// </summary>
    public static class RecipientType
    {
        public const string User = "User";
        public const string Contact = "Contact";
        public const string Group = "Group";
        public const string Hashtag = "Hashtag";
        public const string Initiator = "Initiator";
        public const string PhoneNumber = "PhoneNumber";
    }
}
