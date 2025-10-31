using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PurpleRice.Models
{
    /// <summary>
    /// WhatsApp 電話號碼驗證記錄
    /// </summary>
    public class CompanyPhoneVerification
    {
        [Key]
        public Guid Id { get; set; }
        
        [Required]
        public Guid CompanyId { get; set; }
        
        [Required]
        [MaxLength(20)]
        public string PhoneNumber { get; set; }
        
        [Required]
        [Column(TypeName = "NVARCHAR(MAX)")]
        public string Certificate { get; set; }  // Base64 編碼憑證
        
        public DateTime? CertificateExpiry { get; set; }
        
        /// <summary>
        /// 驗證狀態: Pending, Requested, Verified, Expired, Failed
        /// </summary>
        [Required]
        [MaxLength(50)]
        public string Status { get; set; } = "Pending";
        
        [MaxLength(10)]
        public string? VerificationCode { get; set; }  // 6位 OTP（僅用於記錄）
        
        public DateTime? CodeExpiry { get; set; }
        
        [MaxLength(20)]
        public string? CodeMethod { get; set; }  // SMS 或 VOICE
        
        /// <summary>
        /// Meta 返回的 Phone Number ID
        /// </summary>
        [MaxLength(200)]
        public string? PhoneNumberId { get; set; }
        
        /// <summary>
        /// Meta API 請求 ID
        /// </summary>
        [MaxLength(200)]
        public string? RequestId { get; set; }
        
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        
        public DateTime? UpdatedAt { get; set; }
        
        [MaxLength(100)]
        public string? CreatedBy { get; set; }
        
        /// <summary>
        /// 錯誤信息
        /// </summary>
        [Column(TypeName = "NVARCHAR(MAX)")]
        public string? ErrorMessage { get; set; }
        
        // 導航屬性
        [ForeignKey("CompanyId")]
        public virtual Company? Company { get; set; }
    }
}

