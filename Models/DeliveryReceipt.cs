using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PurpleRice.Models
{
    [Table("delivery_receipt")]
    public class DeliveryReceipt
    {
        [Key]
        public int id { get; set; }
        
        [Required]
        [StringLength(10)]
        public string within_code { get; set; } = string.Empty;
        
        [Required]
        [StringLength(10)]
        public string invoiceno { get; set; } = string.Empty;
        
        [Required]
        [StringLength(8)]
        public string customerno { get; set; } = string.Empty;
        
        [StringLength(60)]
        public string? customername { get; set; }
        
        [StringLength(30)]
        public string? contacttel1 { get; set; }
        
        [StringLength(30)]
        public string? contacttel2 { get; set; }
        
        [Required]
        [StringLength(255)]
        public string original_image_path { get; set; } = string.Empty;
        
        [Required]
        [StringLength(255)]
        public string pdf_path { get; set; } = string.Empty;
        
        [StringLength(1000)]
        public string? qr_code_text { get; set; }
        
        [Required]
        public DateTime receipt_date { get; set; } = DateTime.UtcNow;
        
        [Required]
        public DateTime upload_date { get; set; } = DateTime.UtcNow;
        
        [StringLength(50)]
        public string? upload_ip { get; set; }
        
        [StringLength(20)]
        public string status { get; set; } = "PENDING"; // PENDING, APPROVED, REJECTED
        
        [StringLength(1000)]
        public string? remarks { get; set; }
        
        [StringLength(16)]
        public string? approved_by { get; set; }
        
        public DateTime? approved_date { get; set; }
        
        [StringLength(1000)]
        public string? approval_remarks { get; set; }
        
        public bool confirmed { get; set; }
        
        [StringLength(20)]
        public string? uploaded_by { get; set; } // DeliveryMan, Customer
    }
} 