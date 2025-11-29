using System;

namespace PurpleRice.Models
{
    public class ApiProviderDefinition
    {
        public int Id { get; set; }
        public string ProviderKey { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public string DisplayName { get; set; } = string.Empty;
        public string? IconName { get; set; }
        public string DefaultApiUrl { get; set; } = string.Empty;
        public string? DefaultModel { get; set; }
        public string? SupportedModels { get; set; }
        public string AuthType { get; set; } = "apiKey";
        public string? DefaultSettingsJson { get; set; }
        public bool EnableStreaming { get; set; }
        public decimal? TemperatureMin { get; set; }
        public decimal? TemperatureMax { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }
}


