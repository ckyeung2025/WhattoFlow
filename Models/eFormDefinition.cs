using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json;
using System.Collections.Generic;

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

        [Column("field_display_settings")]
        public string? FieldDisplaySettings { get; set; }

        // 添加屬性來處理 JSON
        [NotMapped]
        public List<FieldDisplaySetting>? FieldDisplaySettingsList
        {
            get => string.IsNullOrEmpty(FieldDisplaySettings) 
                ? null 
                : JsonSerializer.Deserialize<List<FieldDisplaySetting>>(FieldDisplaySettings);
            set => FieldDisplaySettings = value != null 
                ? JsonSerializer.Serialize(value) 
                : null;
        }
    }

    // 字段顯示設定類
    public class FieldDisplaySetting
    {
        public string FieldId { get; set; } = string.Empty;
        public string FieldType { get; set; } = string.Empty;
        public string InputType { get; set; } = string.Empty;
        public string OriginalLabel { get; set; } = string.Empty;
        public string DisplayLabel { get; set; } = string.Empty;
        public bool ShowInList { get; set; } = true;
        public int Order { get; set; } = 0;
    }
} 