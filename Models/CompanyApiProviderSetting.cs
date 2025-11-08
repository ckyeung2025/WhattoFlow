using System;

namespace PurpleRice.Models
{
    public class CompanyApiProviderSetting
    {
        public int Id { get; set; }
        public Guid CompanyId { get; set; }
        public string ProviderKey { get; set; } = string.Empty;
        public string? Category { get; set; }
        public string? ApiUrlOverride { get; set; }
        public byte[]? ApiKeyEncrypted { get; set; }
        public string? ModelOverride { get; set; }
        public decimal? Temperature { get; set; }
        public decimal? TopP { get; set; }
        public bool? EnableStreaming { get; set; }
        public string? ExtraHeadersJson { get; set; }
        public string? AuthType { get; set; }
        public string? AuthConfigJson { get; set; }
        public string? SettingsJson { get; set; }
        public bool Active { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }

        public Company? Company { get; set; }
        public ApiProviderDefinition? ProviderDefinition { get; set; }
    }
}

