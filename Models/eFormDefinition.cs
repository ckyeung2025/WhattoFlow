using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PurpleRice.Models
{
    public class eFormDefinition
    {
        [Key]
        [Column("id")]
        public Guid Id { get; set; }

        [Column("company_id")]
        public Guid CompanyId { get; set; }

        [Column("name")]
        public string Name { get; set; } = string.Empty;

        [Column("description")]
        public string? Description { get; set; }

        [Column("html_code")]
        public string HtmlCode { get; set; } = string.Empty;

        [Column("status")]
        [StringLength(10)]
        public string? Status { get; set; }

        [Column("rstatus")]
        [StringLength(10)]
        public string? RStatus { get; set; }

        [Column("created_at")]
        public DateTime? CreatedAt { get; set; }

        [Column("updated_at")]
        public DateTime? UpdatedAt { get; set; }

        [Column("created_user_id")]
        public Guid? CreatedUserId { get; set; }

        [Column("updated_user_id")]
        public Guid? UpdatedUserId { get; set; }

        [Column("source_file_path")]
        public string? SourceFilePath { get; set; }
    }
} 