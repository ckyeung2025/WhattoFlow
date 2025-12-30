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
        Task<string> DetectFileTypeAsync(Guid companyId, string spreadsheetId);
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
                _loggingService.LogInformation($"[GoogleSheetsService] 開始創建 Google Sheets 服務，公司ID: {companyId}");
                
                var runtime = await _apiProviderService.GetRuntimeProviderAsync(companyId, "google-docs");

                if (runtime == null)
                {
                    _loggingService.LogWarning($"[GoogleSheetsService] 公司 {companyId} 尚未設定 Google Docs API 供應商（ProviderKey: google-docs）");
                    throw new InvalidOperationException("Google Docs API provider is not configured.");
                }

                _loggingService.LogInformation($"[GoogleSheetsService] 成功獲取 Google Docs provider 配置，ProviderKey: {runtime.ProviderKey}, AuthType: {runtime.AuthType ?? "null"}, HasApiKey: {!string.IsNullOrWhiteSpace(runtime.ApiKey)}, HasAuthConfigJson: {!string.IsNullOrWhiteSpace(runtime.AuthConfigJson)}");

                var applicationName = ResolveApplicationName(runtime) ?? "WhatoFlow Google Sheets";
                _loggingService.LogInformation($"[GoogleSheetsService] 應用程式名稱: {applicationName}");

                var initializer = new BaseClientService.Initializer
                {
                    ApplicationName = applicationName
                };

                if (!string.IsNullOrWhiteSpace(runtime.ApiKey))
                {
                    initializer.ApiKey = runtime.ApiKey;
                    _loggingService.LogInformation($"[GoogleSheetsService] Google Sheets 服務初始化成功（使用資料庫中的 API Key），API Key 長度: {runtime.ApiKey.Length}");
                }
                else if (string.Equals(runtime.AuthType, "serviceAccount", StringComparison.OrdinalIgnoreCase) &&
                         !string.IsNullOrWhiteSpace(runtime.AuthConfigJson))
                {
                    _loggingService.LogInformation($"[GoogleSheetsService] 嘗試使用 Service Account 認證，AuthConfigJson 長度: {runtime.AuthConfigJson.Length}");
                    
                    try
                    {
                        var credential = GoogleCredential.FromJson(runtime.AuthConfigJson);
                        var scopes = ResolveScopes(runtime) ?? new[]
                        {
                            "https://www.googleapis.com/auth/documents",
                            "https://www.googleapis.com/auth/drive.file",
                            "https://www.googleapis.com/auth/spreadsheets.readonly"
                        };
                        _loggingService.LogInformation($"[GoogleSheetsService] Service Account Scopes: {string.Join(", ", scopes)}");
                        
                        credential = credential.CreateScoped(scopes);
                        initializer.HttpClientInitializer = credential;
                        _loggingService.LogInformation("[GoogleSheetsService] Google Sheets 服務初始化成功（使用 Service Account）");
                    }
                    catch (Exception saEx)
                    {
                        _loggingService.LogError($"[GoogleSheetsService] Service Account 認證失敗: {saEx.Message}", saEx);
                        throw;
                    }
                }
                else
                {
                    var fallbackKey = Environment.GetEnvironmentVariable("GOOGLE_API_KEY");
                    if (!string.IsNullOrWhiteSpace(fallbackKey))
                    {
                        initializer.ApiKey = fallbackKey;
                        _loggingService.LogWarning($"[GoogleSheetsService] 使用環境變量 GOOGLE_API_KEY 作為後備，API Key 長度: {fallbackKey.Length}");
                    }
                    else
                    {
                        _loggingService.LogWarning($"[GoogleSheetsService] Google Docs provider 未提供 API Key 或 Service Account 配置，公司 {companyId}。AuthType: {runtime.AuthType ?? "null"}, HasApiKey: {!string.IsNullOrWhiteSpace(runtime.ApiKey)}, HasAuthConfigJson: {!string.IsNullOrWhiteSpace(runtime.AuthConfigJson)}");
                    }
                }

                var sheetsService = new SheetsService(initializer);
                _loggingService.LogInformation($"[GoogleSheetsService] SheetsService 實例創建成功");
                return sheetsService;
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"[GoogleSheetsService] 創建 Google Sheets 服務失敗，公司ID: {companyId}，錯誤類型: {ex.GetType().Name}，錯誤訊息: {ex.Message}，堆棧追蹤: {ex.StackTrace}", ex);
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

        public async Task<string> DetectFileTypeAsync(Guid companyId, string spreadsheetId)
        {
            try
            {
                _loggingService.LogInformation($"[GoogleSheetsService] 開始檢測文件類型，公司ID: {companyId}, 表格ID: {spreadsheetId}");

                var runtime = await _apiProviderService.GetRuntimeProviderAsync(companyId, "google-docs");
                if (runtime == null || string.IsNullOrWhiteSpace(runtime.ApiKey))
                {
                    _loggingService.LogWarning($"[GoogleSheetsService] 無法獲取 API Key，無法檢測文件類型");
                    return "unknown";
                }

                using var httpClient = new System.Net.Http.HttpClient();
                httpClient.Timeout = TimeSpan.FromSeconds(30);

                var apiUrl = $"https://sheets.googleapis.com/v4/spreadsheets/{spreadsheetId}?key={runtime.ApiKey}&fields=sheets.properties.title";
                _loggingService.LogInformation($"[GoogleSheetsService] 文件類型檢測 API URL: {apiUrl}");

                var httpResponse = await httpClient.GetAsync(apiUrl);
                var responseContent = await httpResponse.Content.ReadAsStringAsync();
                
                _loggingService.LogInformation($"[GoogleSheetsService] 文件類型檢測響應狀態: {httpResponse.StatusCode}");
                _loggingService.LogInformation($"[GoogleSheetsService] 文件類型檢測響應內容: {responseContent}");

                if (httpResponse.IsSuccessStatusCode)
                {
                    _loggingService.LogInformation($"[GoogleSheetsService] 檢測到文件類型: googlesheets (原生 Google Sheets)");
                    return "googlesheets";
                }
                else
                {
                    if (responseContent.Contains("This operation is not supported for this document") || 
                        responseContent.Contains("FAILED_PRECONDITION"))
                    {
                        _loggingService.LogInformation($"[GoogleSheetsService] 檢測到文件類型: excel (Excel 文件上傳到 Google Drive)");
                        return "excel";
                    }
                    else
                    {
                        _loggingService.LogWarning($"[GoogleSheetsService] 文件類型檢測失敗，可能是權限或文件不存在問題");
                        return "error";
                    }
                }
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"[GoogleSheetsService] 檢測文件類型失敗，表格ID: {spreadsheetId}", ex);
                return "unknown";
            }
        }

        public async Task<bool> TestConnectionAsync(Guid companyId, string spreadsheetId)
        {
            try
            {
                _loggingService.LogInformation($"[GoogleSheetsService] 開始測試 Google Sheets 連接，公司ID: {companyId}, 表格ID: {spreadsheetId}");

                using var sheetsService = await CreateSheetsServiceAsync(companyId);
                _loggingService.LogInformation($"[GoogleSheetsService] SheetsService 創建成功，開始發送 API 請求");

                var request = sheetsService.Spreadsheets.Get(spreadsheetId);
                _loggingService.LogInformation($"[GoogleSheetsService] API 請求已構建，開始執行請求");
                
                var response = await request.ExecuteAsync();
                _loggingService.LogInformation($"[GoogleSheetsService] API 請求執行完成，Response 是否為 null: {response == null}");

                if (response == null)
                {
                    _loggingService.LogWarning($"[GoogleSheetsService] Google Sheets API 返回 null 響應，表格ID: {spreadsheetId}");
                    return false;
                }

                _loggingService.LogInformation($"[GoogleSheetsService] Response.Properties 是否為 null: {response.Properties == null}");
                if (response.Properties != null)
                {
                    _loggingService.LogInformation($"[GoogleSheetsService] Response.Properties.Title: {response.Properties.Title ?? "null"}");
                }

                var isAccessible = response != null && !string.IsNullOrEmpty(response.Properties?.Title);
                
                if (isAccessible)
                {
                    _loggingService.LogInformation($"[GoogleSheetsService] Google Sheets 連接測試成功，表格標題: {response.Properties.Title}, 表格ID: {spreadsheetId}");
                }
                else
                {
                    _loggingService.LogWarning($"[GoogleSheetsService] Google Sheets 連接測試失敗，無法訪問表格，表格ID: {spreadsheetId}。Response 為 null: {response == null}, Properties 為 null: {response?.Properties == null}, Title 為空: {string.IsNullOrEmpty(response?.Properties?.Title)}");
                }

                return isAccessible;
            }
            catch (Google.GoogleApiException apiEx)
            {
                // 檢查是否為 "This operation is not supported for this document" 錯誤
                // 這通常表示文件是 Excel 文件上傳到 Google Drive，而不是原生 Google Sheets
                if (apiEx.Message.Contains("This operation is not supported for this document") ||
                    apiEx.Error?.Message?.Contains("This operation is not supported for this document") == true)
                {
                    _loggingService.LogInformation($"[GoogleSheetsService] 檢測到 Excel 文件（上傳到 Google Drive），表格ID: {spreadsheetId}。這不是錯誤，而是文件類型不同");
                    // 對於 Excel 文件，我們認為連接測試"成功"（文件存在且可訪問，只是需要使用不同的 API）
                    return true;
                }

                _loggingService.LogError($"[GoogleSheetsService] Google Sheets API 異常，表格ID: {spreadsheetId}，HTTP 狀態碼: {apiEx.HttpStatusCode}，錯誤訊息: {apiEx.Message}，錯誤內容: {apiEx.Error?.Message ?? "null"}，錯誤詳細: {apiEx.Error?.ToString() ?? "null"}，堆棧追蹤: {apiEx.StackTrace}", apiEx);
                return false;
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"[GoogleSheetsService] Google Sheets 連接測試失敗，表格ID: {spreadsheetId}，錯誤類型: {ex.GetType().Name}，錯誤訊息: {ex.Message}，內部異常: {ex.InnerException?.Message ?? "null"}，堆棧追蹤: {ex.StackTrace}", ex);
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
