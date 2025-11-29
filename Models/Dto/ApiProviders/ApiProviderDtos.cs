using System;
using System.Collections.Generic;

namespace PurpleRice.Models.Dto.ApiProviders
{
    public class ApiProviderDefinitionDto
    {
        public string ProviderKey { get; set; }
        public string Category { get; set; }
        public string DisplayName { get; set; }
        public string? IconName { get; set; }
        public string DefaultApiUrl { get; set; }
        public string? DefaultModel { get; set; }
        public string? SupportedModels { get; set; }
        public string AuthType { get; set; } = "apiKey";
        public string? DefaultSettingsJson { get; set; }
        public bool EnableStreaming { get; set; }
        public decimal? TemperatureMin { get; set; }
        public decimal? TemperatureMax { get; set; }
    }

    public class ApiProviderSettingDto
    {
        public string ProviderKey { get; set; }
        public string Category { get; set; }
        public string DisplayName { get; set; }
        public string? IconName { get; set; }
        public string ApiUrl { get; set; }
        public string? Model { get; set; }
        public decimal? Temperature { get; set; }
        public decimal? TopP { get; set; }
        public bool? EnableStreaming { get; set; }
        public string? ExtraHeadersJson { get; set; }
        public string? AuthType { get; set; }
        public string? AuthConfigJson { get; set; }
        public string? SettingsJson { get; set; }
        public bool Active { get; set; }
        public bool HasApiKey { get; set; }
        public string MaskedApiKey { get; set; }
        public string DefaultApiUrl { get; set; }
        public string? DefaultModel { get; set; }
        public string? SupportedModels { get; set; }
        public bool DefinitionEnableStreaming { get; set; }
        public decimal? TemperatureMin { get; set; }
        public decimal? TemperatureMax { get; set; }
        public string DefaultAuthType { get; set; } = "apiKey";
        public string? DefaultSettingsJson { get; set; }
        public DateTime UpdatedAt { get; set; }
    }

    public class ApiProviderSettingUpdateRequest
    {
        public string ApiUrl { get; set; }
        public string? ApiKey { get; set; }
        public bool ClearApiKey { get; set; }
        public string? Model { get; set; }
        public decimal? Temperature { get; set; }
        public decimal? TopP { get; set; }
        public bool? EnableStreaming { get; set; }
        public string? ExtraHeadersJson { get; set; }
        public string? AuthType { get; set; }
        public string? AuthConfigJson { get; set; }
        public string? SettingsJson { get; set; }
        public bool Active { get; set; } = true;
    }

    public class ApiProviderRuntimeDto
    {
        public string ProviderKey { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public string ApiUrl { get; set; } = string.Empty;
        public string? Model { get; set; }
        public bool EnableStreaming { get; set; }
        public string AuthType { get; set; } = "apiKey";
        public string? ApiKey { get; set; }
        public string? AuthConfigJson { get; set; }
        public string? SettingsJson { get; set; }
        public Dictionary<string, string>? ExtraHeaders { get; set; }
        public bool Active { get; set; }
        public bool HasApiKey { get; set; }
        public string DefaultApiUrl { get; set; } = string.Empty;
        public string? DefaultModel { get; set; }
        public string? DefaultSettingsJson { get; set; }
    }
}

