using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PurpleRice.Models
{
    public class BroadcastSendDetail
    {
        [Key]
        public Guid Id { get; set; }
        
        [Required]
        public Guid BroadcastSendId { get; set; }
        
        [Required]
        public Guid ContactId { get; set; }
        
        public int? WhatsAppMessageId { get; set; }
        
        [MaxLength(20)]
        public string Status { get; set; } = "Pending"; // Pending, Sent, Failed, Delivered, Read
        
        public DateTime? SentAt { get; set; }
        
        [MaxLength(500)]
        public string? ErrorMessage { get; set; }
        
        // 導航屬性
        [ForeignKey("BroadcastSendId")]
        public BroadcastSend? BroadcastSend { get; set; }
        
        [ForeignKey("ContactId")]
        public ContactList? Contact { get; set; }
        
        [ForeignKey("WhatsAppMessageId")]
        public WhatsAppMessage? WhatsAppMessage { get; set; }
    }
}
