using System;
using System.ComponentModel.DataAnnotations;

namespace PurpleRice.Models
{
    public class User
    {
        [Key]
        public Guid Id { get; set; }
        public Guid CompanyId { get; set; }
        public string Account { get; set; }
        public string? Email { get; set; }
        public string? GoogleId { get; set; }
        public string? PasswordHash { get; set; }
        public bool IsActive { get; set; }
        public bool IsOwner { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public string? AvatarUrl { get; set; }
        public string? Timezone { get; set; }
        public string? Name { get; set; }
        public string? Phone { get; set; }
        public string? Language { get; set; }
    }
} 