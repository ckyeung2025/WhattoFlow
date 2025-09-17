using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PurpleRice.Models
{
    public class ContactHashtag
    {
        [Key]
        public Guid Id { get; set; }
        
        [Required]
        public Guid CompanyId { get; set; }
        
        [Required]
        [MaxLength(100)]
        public string Name { get; set; }
        
        [MaxLength(7)]
        public string? Color { get; set; } // #FF5733 格式
        
        [MaxLength(300)]
        public string? Description { get; set; }
        
        public bool IsActive { get; set; } = true;
        
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        
        [MaxLength(100)]
        public string CreatedBy { get; set; }
        
        // 導航屬性
        [ForeignKey("CompanyId")]
        public Company? Company { get; set; }
    }
}
