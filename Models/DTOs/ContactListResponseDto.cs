using System;
using System.Text.Json.Serialization;

namespace PurpleRice.Models.DTOs
{
    public class ContactListResponseDto
    {
        [JsonPropertyName("id")]
        public Guid Id { get; set; }
        
        [JsonPropertyName("companyId")]
        public Guid CompanyId { get; set; }
        
        [JsonPropertyName("name")]
        public string Name { get; set; }
        
        [JsonPropertyName("title")]
        public string? Title { get; set; }
        
        [JsonPropertyName("occupation")]
        public string? Occupation { get; set; }
        
        [JsonPropertyName("whatsAppNumber")]
        public string? WhatsAppNumber { get; set; }
        
        [JsonPropertyName("email")]
        public string? Email { get; set; }
        
        [JsonPropertyName("companyName")]
        public string? CompanyName { get; set; }
        
        [JsonPropertyName("department")]
        public string? Department { get; set; }
        
        [JsonPropertyName("position")]
        public string? Position { get; set; }
        
        [JsonPropertyName("hashtags")]
        public string? Hashtags { get; set; }
        
        [JsonPropertyName("broadcastGroupId")]
        public Guid? BroadcastGroupId { get; set; }
        
        [JsonPropertyName("isActive")]
        public bool IsActive { get; set; }
        
        [JsonPropertyName("createdAt")]
        public DateTime CreatedAt { get; set; }
        
        [JsonPropertyName("updatedAt")]
        public DateTime? UpdatedAt { get; set; }
        
        [JsonPropertyName("createdBy")]
        public string CreatedBy { get; set; }
        
        [JsonPropertyName("updatedBy")]
        public string? UpdatedBy { get; set; }
        
        [JsonPropertyName("broadcastGroup")]
        public BroadcastGroupResponseDto? BroadcastGroup { get; set; }
    }

    public class BroadcastGroupResponseDto
    {
        [JsonPropertyName("id")]
        public Guid Id { get; set; }
        
        [JsonPropertyName("name")]
        public string Name { get; set; }
        
        [JsonPropertyName("description")]
        public string? Description { get; set; }
        
        [JsonPropertyName("color")]
        public string? Color { get; set; }
        
        [JsonPropertyName("isActive")]
        public bool IsActive { get; set; }
        
        [JsonPropertyName("createdAt")]
        public DateTime CreatedAt { get; set; }
        
        [JsonPropertyName("updatedAt")]
        public DateTime? UpdatedAt { get; set; }
        
        [JsonPropertyName("createdBy")]
        public string CreatedBy { get; set; }
        
        [JsonPropertyName("updatedBy")]
        public string? UpdatedBy { get; set; }
    }
}
