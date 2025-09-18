using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace PurpleRice.Models
{
    public class ContactList
    {
        [Key]
        public Guid Id { get; set; }
        
        [Required]
        [JsonPropertyName("company_id")]
        public Guid CompanyId { get; set; }
        
        [Required]
        [MaxLength(200)]
        public string Name { get; set; }
        
        [MaxLength(100)]
        public string? Title { get; set; }
        
        [MaxLength(100)]
        public string? Occupation { get; set; }
        
        [MaxLength(20)]
        [JsonPropertyName("whatsapp_number")]
        public string? WhatsAppNumber { get; set; }
        
        [MaxLength(255)]
        public string? Email { get; set; }
        
        [MaxLength(200)]
        [JsonPropertyName("company_name")]
        public string? CompanyName { get; set; }
        
        [MaxLength(100)]
        public string? Department { get; set; }
        
        [MaxLength(100)]
        public string? Position { get; set; }
        
        [MaxLength(500)]
        public string? Hashtags { get; set; } // 逗號分隔的標籤
        
        [JsonPropertyName("broadcast_group_id")]
        public Guid? BroadcastGroupId { get; set; }
        
        [JsonPropertyName("is_active")]
        public bool IsActive { get; set; } = true;
        
        [JsonPropertyName("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        
        [JsonPropertyName("updated_at")]
        public DateTime? UpdatedAt { get; set; }
        
        [Required]
        [MaxLength(100)]
        [JsonPropertyName("created_by")]
        public string CreatedBy { get; set; }
        
        [MaxLength(100)]
        [JsonPropertyName("updated_by")]
        public string? UpdatedBy { get; set; }
        
        // 導航屬性
        [ForeignKey("BroadcastGroupId")]
        public BroadcastGroup? BroadcastGroup { get; set; }
        
        [ForeignKey("CompanyId")]
        public Company? Company { get; set; }
    }
}
