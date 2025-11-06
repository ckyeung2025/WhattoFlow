using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PurpleRice.Models
{
    [Table("roles_interface")]
    public class RolesInterface
    {
        [Key]
        [Column("id")]
        public Guid Id { get; set; }

        [Required]
        [Column("role_id")]
        public Guid RoleId { get; set; }

        [Column("company_id")]
        public Guid? CompanyId { get; set; }

        [Required]
        [MaxLength(100)]
        [Column("interface_key")]
        public string InterfaceKey { get; set; } = string.Empty;

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime? UpdatedAt { get; set; }

        [Column("is_active")]
        public bool IsActive { get; set; } = true;

        // 導航屬性
        [ForeignKey("RoleId")]
        public virtual Role Role { get; set; }

        [ForeignKey("CompanyId")]
        public virtual Company? Company { get; set; }
    }
}

