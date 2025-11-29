using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using PurpleRice.Data;
using PurpleRice.Models;
using PurpleRice.Models.Dto.ApiProviders;
using PurpleRice.Services.Security;
using PurpleRice.Services;

namespace PurpleRice.Services.ApiProviders
{
    public interface IApiProviderService
    {
        Task<IReadOnlyList<ApiProviderDefinitionDto>> GetDefinitionsAsync(string category = null);
        Task<IReadOnlyList<ApiProviderSettingDto>> GetCompanyProvidersAsync(Guid companyId, string category = null);
        Task<ApiProviderSettingDto> GetCompanyProviderAsync(Guid companyId, string providerKey);
        Task<ApiProviderSettingDto> UpsertCompanyProviderAsync(Guid companyId, string providerKey, ApiProviderSettingUpdateRequest request);
        Task<ApiProviderRuntimeDto?> GetRuntimeProviderAsync(Guid companyId, string providerKey);
    }

    public class ApiProviderService : IApiProviderService
    {
        private readonly PurpleRiceDbContext _dbContext;
        private readonly IApiKeyProtector _apiKeyProtector;
        private readonly LoggingService _logger;

        public ApiProviderService(
            PurpleRiceDbContext dbContext,
            IApiKeyProtector apiKeyProtector,
            Func<string, LoggingService> loggerFactory)
        {
            _dbContext = dbContext;
            _apiKeyProtector = apiKeyProtector;
            _logger = loggerFactory("ApiProviderService");
        }

        public async Task<IReadOnlyList<ApiProviderDefinitionDto>> GetDefinitionsAsync(string category = null)
        {
            var query = _dbContext.ApiProviderDefinitions.AsNoTracking();

            if (!string.IsNullOrWhiteSpace(category))
            {
                query = query.Where(x => x.Category == category);
            }

            var items = await query
                .OrderBy(x => x.Category)
                .ThenBy(x => x.DisplayName)
                .Select(x => new ApiProviderDefinitionDto
                {
                    ProviderKey = x.ProviderKey,
                    Category = x.Category,
                    DisplayName = x.DisplayName,
                    IconName = x.IconName,
                    DefaultApiUrl = x.DefaultApiUrl,
                    DefaultModel = x.DefaultModel,
                    SupportedModels = x.SupportedModels,
                    AuthType = x.AuthType ?? "apiKey",
                    DefaultSettingsJson = x.DefaultSettingsJson,
                    EnableStreaming = x.EnableStreaming,
                    TemperatureMin = x.TemperatureMin,
                    TemperatureMax = x.TemperatureMax
                })
                .ToListAsync();

            return items;
        }

        public async Task<IReadOnlyList<ApiProviderSettingDto>> GetCompanyProvidersAsync(Guid companyId, string category = null)
        {
            var definitionsQuery = _dbContext.ApiProviderDefinitions.AsNoTracking();
            if (!string.IsNullOrWhiteSpace(category))
            {
                definitionsQuery = definitionsQuery.Where(x => x.Category == category);
            }

            var definitions = await definitionsQuery.ToListAsync();
            var settings = await _dbContext.CompanyApiProviderSettings
                .AsNoTracking()
                .Where(x => x.CompanyId == companyId)
                .ToListAsync();

            var result = new List<ApiProviderSettingDto>();

            foreach (var definition in definitions)
            {
                var setting = settings.FirstOrDefault(x => x.ProviderKey == definition.ProviderKey);

                if (setting == null)
                {
                    result.Add(MapToDto(definition, null));
                }
                else
                {
                    result.Add(MapToDto(definition, setting));
                }
            }

            return result
                .OrderBy(x => x.Category)
                .ThenBy(x => x.DisplayName)
                .ToList();
        }

        public async Task<ApiProviderSettingDto> GetCompanyProviderAsync(Guid companyId, string providerKey)
        {
            var definition = await _dbContext.ApiProviderDefinitions
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.ProviderKey == providerKey);

            if (definition == null)
            {
                throw new InvalidOperationException($"Provider '{providerKey}' not found.");
            }

            var setting = await _dbContext.CompanyApiProviderSettings
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.CompanyId == companyId && x.ProviderKey == providerKey);

            return MapToDto(definition, setting);
        }

        public async Task<ApiProviderSettingDto> UpsertCompanyProviderAsync(Guid companyId, string providerKey, ApiProviderSettingUpdateRequest request)
        {
            if (request == null)
            {
                throw new ArgumentNullException(nameof(request));
            }

            var definition = await _dbContext.ApiProviderDefinitions
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.ProviderKey == providerKey);

            if (definition == null)
            {
                throw new InvalidOperationException($"Provider '{providerKey}' not found.");
            }

            var setting = await _dbContext.CompanyApiProviderSettings
                .FirstOrDefaultAsync(x => x.CompanyId == companyId && x.ProviderKey == providerKey);

            var utcNow = DateTime.UtcNow;

            if (setting == null)
            {
                // 確保公司與角色關聯存在，避免外鍵錯誤
                if (!await _dbContext.Companies.AnyAsync(c => c.Id == companyId))
                {
                    throw new InvalidOperationException($"Company '{companyId}' not found.");
                }

                setting = new CompanyApiProviderSetting
                {
                    CompanyId = companyId,
                    ProviderKey = providerKey,
                    Category = definition.Category,
                    AuthType = definition.AuthType,
                    SettingsJson = definition.DefaultSettingsJson,
                    Active = request.Active,
                    CreatedAt = utcNow,
                    UpdatedAt = utcNow
                };

                _dbContext.CompanyApiProviderSettings.Add(setting);
            }

            setting.Category = definition.Category;
            setting.ApiUrlOverride = string.IsNullOrWhiteSpace(request.ApiUrl) ? null : request.ApiUrl.Trim();
            setting.ModelOverride = string.IsNullOrWhiteSpace(request.Model) ? null : request.Model.Trim();
            setting.Temperature = request.Temperature;
            setting.TopP = request.TopP;
            setting.EnableStreaming = request.EnableStreaming;
            setting.ExtraHeadersJson = NormalizeJsonOrNull(request.ExtraHeadersJson, nameof(request.ExtraHeadersJson));
            setting.AuthType = string.IsNullOrWhiteSpace(request.AuthType)
                ? definition.AuthType
                : request.AuthType.Trim().ToLowerInvariant();
            setting.AuthConfigJson = NormalizeJsonOrNull(request.AuthConfigJson, nameof(request.AuthConfigJson));
            setting.SettingsJson = NormalizeJsonOrNull(request.SettingsJson, nameof(request.SettingsJson))
                ?? definition.DefaultSettingsJson;
            setting.Active = request.Active;
            setting.UpdatedAt = utcNow;

            if (request.ClearApiKey)
            {
                setting.ApiKeyEncrypted = null;
            }
            else if (!string.IsNullOrWhiteSpace(request.ApiKey))
            {
                setting.ApiKeyEncrypted = _apiKeyProtector.Protect(request.ApiKey.Trim());
            }

            await _dbContext.SaveChangesAsync();

            return MapToDto(definition, setting);
        }

        public async Task<ApiProviderRuntimeDto?> GetRuntimeProviderAsync(Guid companyId, string providerKey)
        {
            if (string.IsNullOrWhiteSpace(providerKey))
            {
                throw new ArgumentException("Provider key is required", nameof(providerKey));
            }

            var definition = await _dbContext.ApiProviderDefinitions
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.ProviderKey == providerKey);

            if (definition == null)
            {
                _logger.LogWarning($"Provider definition not found for key '{providerKey}'");
                return null;
            }

            var setting = await _dbContext.CompanyApiProviderSettings
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.CompanyId == companyId && x.ProviderKey == providerKey);

            string? apiKey = null;
            var hasApiKey = false;

            if (setting?.ApiKeyEncrypted != null && setting.ApiKeyEncrypted.Length > 0)
            {
                try
                {
                    apiKey = _apiKeyProtector.Unprotect(setting.ApiKeyEncrypted);
                    hasApiKey = !string.IsNullOrWhiteSpace(apiKey);
                }
                catch (Exception ex)
                {
                    _logger.LogError($"Failed to decrypt API key for provider {providerKey} (company: {companyId})", ex);
                }
            }

            var runtime = new ApiProviderRuntimeDto
            {
                ProviderKey = definition.ProviderKey,
                Category = definition.Category,
                ApiUrl = setting?.ApiUrlOverride ?? definition.DefaultApiUrl,
                Model = setting?.ModelOverride ?? definition.DefaultModel,
                EnableStreaming = setting?.EnableStreaming ?? definition.EnableStreaming,
                AuthType = setting?.AuthType ?? definition.AuthType ?? "apiKey",
                ApiKey = apiKey,
                AuthConfigJson = setting?.AuthConfigJson,
                SettingsJson = setting?.SettingsJson ?? definition.DefaultSettingsJson,
                ExtraHeaders = ParseKeyValueJson(setting?.ExtraHeadersJson),
                Active = setting?.Active ?? false,
                HasApiKey = hasApiKey,
                DefaultApiUrl = definition.DefaultApiUrl,
                DefaultModel = definition.DefaultModel,
                DefaultSettingsJson = definition.DefaultSettingsJson
            };

            return runtime;
        }

        private Dictionary<string, string>? ParseKeyValueJson(string? json)
        {
            if (string.IsNullOrWhiteSpace(json))
            {
                return null;
            }

            try
            {
                var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                using var document = JsonDocument.Parse(json);

                if (document.RootElement.ValueKind == JsonValueKind.Object)
                {
                    foreach (var property in document.RootElement.EnumerateObject())
                    {
                        var value = property.Value.ValueKind switch
                        {
                            JsonValueKind.String => property.Value.GetString() ?? string.Empty,
                            JsonValueKind.Null => string.Empty,
                            _ => property.Value.ToString()
                        };

                        result[property.Name] = value;
                    }
                }

                return result.Count > 0 ? result : null;
            }
            catch (JsonException ex)
            {
                _logger.LogWarning($"Failed to parse JSON into key-value pairs: {ex.Message}");
                return null;
            }
        }

        private ApiProviderSettingDto MapToDto(ApiProviderDefinition definition, CompanyApiProviderSetting setting)
        {
            var hasApiKey = setting?.ApiKeyEncrypted != null && setting.ApiKeyEncrypted.Length > 0;
            string masked = string.Empty;

            if (hasApiKey)
            {
                try
                {
                    masked = MaskApiKey(_apiKeyProtector.Unprotect(setting.ApiKeyEncrypted));
                }
                catch (Exception ex)
                {
                    _logger.LogWarning($"Failed to unprotect API key for provider {definition.ProviderKey}: {ex.Message}");
                    masked = "****";
                }
            }

            var authType = setting?.AuthType ?? definition.AuthType ?? "apiKey";
            var settingsJson = setting?.SettingsJson ?? definition.DefaultSettingsJson;

            return new ApiProviderSettingDto
            {
                ProviderKey = definition.ProviderKey,
                Category = definition.Category,
                DisplayName = definition.DisplayName,
                IconName = definition.IconName,
                ApiUrl = setting?.ApiUrlOverride ?? definition.DefaultApiUrl,
                Model = setting?.ModelOverride ?? definition.DefaultModel,
                Temperature = setting?.Temperature,
                TopP = setting?.TopP,
                EnableStreaming = setting?.EnableStreaming ?? definition.EnableStreaming,
                ExtraHeadersJson = setting?.ExtraHeadersJson,
                AuthType = authType,
                AuthConfigJson = setting?.AuthConfigJson,
                SettingsJson = settingsJson,
                Active = setting?.Active ?? false,
                HasApiKey = hasApiKey,
                MaskedApiKey = masked,
                DefaultApiUrl = definition.DefaultApiUrl,
                DefaultModel = definition.DefaultModel,
                SupportedModels = definition.SupportedModels,
                DefinitionEnableStreaming = definition.EnableStreaming,
                TemperatureMin = definition.TemperatureMin,
                TemperatureMax = definition.TemperatureMax,
                DefaultAuthType = definition.AuthType ?? "apiKey",
                DefaultSettingsJson = definition.DefaultSettingsJson,
                UpdatedAt = setting?.UpdatedAt ?? definition.UpdatedAt
            };
        }

        private string NormalizeJsonOrNull(string value, string fieldName)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return null;
            }

            try
            {
                using var document = JsonDocument.Parse(value);
                return JsonSerializer.Serialize(document.RootElement);
            }
            catch (JsonException ex)
            {
                throw new InvalidOperationException($"Field '{fieldName}' contains invalid JSON: {ex.Message}");
            }
        }

        private string MaskApiKey(string apiKey)
        {
            if (string.IsNullOrWhiteSpace(apiKey))
            {
                return string.Empty;
            }

            if (apiKey.Length <= 4)
            {
                return "****";
            }

            var visible = apiKey.Substring(apiKey.Length - 4);
            return new string('*', apiKey.Length - 4) + visible;
        }
    }
}

