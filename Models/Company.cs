using System;
using System.ComponentModel.DataAnnotations;

namespace PurpleRice.Models
{
    public class Company
    {
        [Key]
        public Guid Id { get; set; }
        public string? MasterUserId { get; set; }
        public string Name { get; set; }
        public string? Email { get; set; }
        public string? Address { get; set; }
        public string? Phone { get; set; }
        public string? Website { get; set; }
        public string? WA_API_Key { get; set; }
        public string? WA_PhoneNo_ID { get; set; }
        public string? WA_VerifyToken { get; set; }
        public string? WA_WebhookToken { get; set; }
        public string? LogoUrl { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
    }
} 