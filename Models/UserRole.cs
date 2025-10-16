using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PurpleRice.Models
{
    [Table("user_roles")]
    public class UserRole
    {
        [Key]
        [Column("id")]
        public Guid Id { get; set; }

        [Required]
        [Column("user_id")]
        public Guid UserId { get; set; }

        [Required]
        [Column("role_id")]
        public Guid RoleId { get; set; }

        [Column("assigned_by")]
        public Guid? AssignedBy { get; set; }

        [Column("assigned_at")]
        public DateTime AssignedAt { get; set; } = DateTime.UtcNow;

        [Column("is_active")]
        public bool IsActive { get; set; } = true;

        [Column("created_at")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        // 導航屬性
        [ForeignKey("UserId")]
        public virtual User User { get; set; }

        [ForeignKey("RoleId")]
        public virtual Role Role { get; set; }

        [ForeignKey("AssignedBy")]
        public virtual User? AssignedByUser { get; set; }
    }
}
