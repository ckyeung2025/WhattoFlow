using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PurpleRice.Models
{
    public class BroadcastGroup
    {
        [Key]
        public Guid Id { get; set; }
        
        [Required]
        public Guid CompanyId { get; set; }
        
        [Required]
        [MaxLength(200)]
        public string Name { get; set; }
        
        [MaxLength(500)]
        public string? Description { get; set; }
        
        [MaxLength(7)]
        public string? Color { get; set; } // #FF5733 格式
        
        public bool IsActive { get; set; } = true;
        
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
        
        [MaxLength(100)]
        public string CreatedBy { get; set; }
        
        [MaxLength(100)]
        public string? UpdatedBy { get; set; }
        
        // 導航屬性
        [ForeignKey("CompanyId")]
        public Company? Company { get; set; }
        
        public ICollection<ContactList>? Contacts { get; set; }
    }
}
