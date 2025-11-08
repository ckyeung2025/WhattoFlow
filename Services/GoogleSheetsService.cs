using Google.Apis.Auth.OAuth2;
using Google.Apis.Services;
using Google.Apis.Sheets.v4;
using Google.Apis.Sheets.v4.Data;
using PurpleRice.Models.Dto.ApiProviders;
using PurpleRice.Services.ApiProviders;
using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace PurpleRice.Services
{
    public interface IGoogleSheetsService
    {
        Task<List<List<string>>> ReadSheetDataAsync(Guid companyId, string spreadsheetId, string sheetName, string range = null);
        Task<List<string>> GetSheetNamesAsync(Guid companyId, string spreadsheetId);
        Task<bool> TestConnectionAsync(Guid companyId, string spreadsheetId);
    }

    public class GoogleSheetsService : IGoogleSheetsService
    {
        private readonly LoggingService _loggingService;
        private readonly IApiProviderService _apiProviderService;

        public GoogleSheetsService(LoggingService loggingService, IApiProviderService apiProviderService)
        {
            _loggingService = loggingService;
            _apiProviderService = apiProviderService;
        }

        private async Task<SheetsService> CreateSheetsServiceAsync(Guid companyId)
        {
            try
            {
                var runtime = await _apiProviderService.GetRuntimeProviderAsync(companyId, "google-docs");

                if (runtime == null)
                {
                    _loggingService.LogWarning($"公司 {companyId} 尚未設定 Google Docs API 供應商");
                    throw new InvalidOperationException("Google Docs API provider is not configured.");
                }

                var initializer = new BaseClientService.Initializer
                {
                    ApplicationName = ResolveApplicationName(runtime) ?? "WhatoFlow Google Sheets"
                };

                if (!string.IsNullOrWhiteSpace(runtime.ApiKey))
                {
                    initializer.ApiKey = runtime.ApiKey;
                    _loggingService.LogInformation("Google Sheets 服務初始化成功（使用資料庫中的 API Key）");
                }
                else if (string.Equals(runtime.AuthType, "serviceAccount", StringComparison.OrdinalIgnoreCase) &&
                         !string.IsNullOrWhiteSpace(runtime.AuthConfigJson))
                {
                    var credential = GoogleCredential.FromJson(runtime.AuthConfigJson);
                    var scopes = ResolveScopes(runtime) ?? new[]
                    {
                        "https://www.googleapis.com/auth/documents",
                        "https://www.googleapis.com/auth/drive.file",
                        "https://www.googleapis.com/auth/spreadsheets.readonly"
                    };
                    credential = credential.CreateScoped(scopes);
                    initializer.HttpClientInitializer = credential;
                    _loggingService.LogInformation("Google Sheets 服務初始化成功（使用 Service Account）");
                }
                else
                {
                    var fallbackKey = Environment.GetEnvironmentVariable("GOOGLE_API_KEY");
                    if (!string.IsNullOrWhiteSpace(fallbackKey))
                    {
                        initializer.ApiKey = fallbackKey;
                        _loggingService.LogWarning("使用環境變量 GOOGLE_API_KEY 作為後備。");
                    }
                    else
                    {
                        _loggingService.LogWarning($"Google Docs provider 未提供 API Key 或 Service Account 配置，公司 {companyId}");
                    }
                }

                return new SheetsService(initializer);
            }
            catch (Exception ex)
            {
                _loggingService.LogError("創建 Google Sheets 服務失敗", ex);
                throw;
            }
        }

        public async Task<List<List<string>>> ReadSheetDataAsync(Guid companyId, string spreadsheetId, string sheetName, string range = null)
        {
            try
            {
                _loggingService.LogInformation($"開始讀取 Google Sheets 數據，表格ID: {spreadsheetId}, 工作表: {sheetName}");

                // 構建範圍字符串 - 擴大讀取範圍以確保讀取所有數據
                var rangeString = range ?? $"{sheetName}!A:ZZ"; // 擴展到 ZZ 列以確保讀取所有數據
                
                _loggingService.LogInformation($"讀取範圍: {rangeString}");

                using var sheetsService = await CreateSheetsServiceAsync(companyId);
                var request = sheetsService.Spreadsheets.Values.Get(spreadsheetId, rangeString);
                var response = await request.ExecuteAsync();

                if (response.Values == null || !response.Values.Any())
                {
                    _loggingService.LogWarning($"Google Sheets 沒有數據，表格ID: {spreadsheetId}, 工作表: {sheetName}");
                    return new List<List<string>>();
                }

                var result = new List<List<string>>();
                foreach (var row in response.Values)
                {
                    var stringRow = new List<string>();
                    foreach (var cell in row)
                    {
                        stringRow.Add(cell?.ToString() ?? string.Empty);
                    }
                    result.Add(stringRow);
                }

                _loggingService.LogInformation($"成功讀取 Google Sheets 數據，共 {result.Count} 行，表格ID: {spreadsheetId}");
                
                // 添加詳細的調試信息
                if (result.Any())
                {
                    _loggingService.LogInformation($"第一行數據: {string.Join(" | ", result.First())}");
                    _loggingService.LogInformation($"第一行列數: {result.First().Count}");
                    if (result.Count > 1)
                    {
                        _loggingService.LogInformation($"第二行數據: {string.Join(" | ", result[1])}");
                        _loggingService.LogInformation($"第二行列數: {result[1].Count}");
                    }
                }
                
                return result;
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"讀取 Google Sheets 數據失敗，表格ID: {spreadsheetId}, 工作表: {sheetName}", ex);
                throw;
            }
        }

        public async Task<List<string>> GetSheetNamesAsync(Guid companyId, string spreadsheetId)
        {
            try
            {
                _loggingService.LogInformation($"獲取 Google Sheets 工作表名稱，表格ID: {spreadsheetId}");

                using var sheetsService = await CreateSheetsServiceAsync(companyId);
                var request = sheetsService.Spreadsheets.Get(spreadsheetId);
                var response = await request.ExecuteAsync();

                if (response.Sheets == null || !response.Sheets.Any())
                {
                    _loggingService.LogWarning($"Google Sheets 沒有工作表，表格ID: {spreadsheetId}");
                    return new List<string>();
                }

                var sheetNames = response.Sheets.Select(sheet => sheet.Properties?.Title ?? "Unknown").ToList();
                
                _loggingService.LogInformation($"成功獲取工作表名稱: {string.Join(", ", sheetNames)}, 表格ID: {spreadsheetId}");
                return sheetNames;
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取 Google Sheets 工作表名稱失敗，表格ID: {spreadsheetId}", ex);
                throw;
            }
        }

        public async Task<bool> TestConnectionAsync(Guid companyId, string spreadsheetId)
        {
            try
            {
                _loggingService.LogInformation($"測試 Google Sheets 連接，表格ID: {spreadsheetId}");

                using var sheetsService = await CreateSheetsServiceAsync(companyId);
                var request = sheetsService.Spreadsheets.Get(spreadsheetId);
                var response = await request.ExecuteAsync();

                var isAccessible = response != null && !string.IsNullOrEmpty(response.Properties?.Title);
                
                if (isAccessible)
                {
                    _loggingService.LogInformation($"Google Sheets 連接測試成功，表格標題: {response.Properties.Title}, 表格ID: {spreadsheetId}");
                }
                else
                {
                    _loggingService.LogWarning($"Google Sheets 連接測試失敗，無法訪問表格，表格ID: {spreadsheetId}");
                }

                return isAccessible;
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"Google Sheets 連接測試失敗，表格ID: {spreadsheetId}", ex);
                return false;
            }
        }

        /// <summary>
        /// 從 Google Sheets URL 中提取表格 ID
        /// </summary>
        /// <param name="url">Google Sheets URL</param>
        /// <returns>表格 ID</returns>
        public static string ExtractSpreadsheetId(string url)
        {
            if (string.IsNullOrEmpty(url))
                return string.Empty;

            // 匹配 Google Sheets URL 格式
            // https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit
            var match = Regex.Match(url, @"/spreadsheets/d/([a-zA-Z0-9-_]+)");
            return match.Success ? match.Groups[1].Value : string.Empty;
        }

        private static string? ResolveApplicationName(ApiProviderRuntimeDto runtime)
        {
            if (string.IsNullOrWhiteSpace(runtime.SettingsJson))
            {
                return null;
            }

            try
            {
                using var document = JsonDocument.Parse(runtime.SettingsJson);
                if (document.RootElement.TryGetProperty("applicationName", out var value) && value.ValueKind == JsonValueKind.String)
                {
                    return value.GetString();
                }
            }
            catch (JsonException)
            {
                // ignore parse errors, fallback handled by caller
            }

            return null;
        }

        private static IEnumerable<string>? ResolveScopes(ApiProviderRuntimeDto runtime)
        {
            if (string.IsNullOrWhiteSpace(runtime.SettingsJson))
            {
                return null;
            }

            try
            {
                using var document = JsonDocument.Parse(runtime.SettingsJson);
                if (document.RootElement.TryGetProperty("scopes", out var scopesElement) && scopesElement.ValueKind == JsonValueKind.Array)
                {
                    var scopes = new List<string>();
                    foreach (var item in scopesElement.EnumerateArray())
                    {
                        if (item.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(item.GetString()))
                        {
                            scopes.Add(item.GetString()!);
                        }
                    }

                    return scopes.Count > 0 ? scopes : null;
                }
            }
            catch (JsonException)
            {
                // ignore parse errors, fallback handled by caller
            }

            return null;
        }
    }
}
