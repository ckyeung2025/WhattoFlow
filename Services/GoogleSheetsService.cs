using Google.Apis.Auth.OAuth2;
using Google.Apis.Services;
using Google.Apis.Sheets.v4;
using Google.Apis.Sheets.v4.Data;
using Google.Apis.Drive.v3;
using Google.Apis.Drive.v3.Data;
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
        Task<string> GetFirstSheetNameAsync(Guid companyId, string spreadsheetId);
        Task<bool> TestConnectionAsync(Guid companyId, string spreadsheetId);
        Task<string> DetectFileTypeAsync(Guid companyId, string spreadsheetId);
        
        // 寫入方法（用於雙向同步）
        Task<bool> WriteSheetDataAsync(Guid companyId, string spreadsheetId, string sheetName, List<List<object>> data, int startRow = 1);
        Task<bool> UpdateSheetDataAsync(Guid companyId, string spreadsheetId, string sheetName, Dictionary<int, Dictionary<int, object>> updates);
        Task<bool> ClearSheetRangeAsync(Guid companyId, string spreadsheetId, string sheetName, string range);
        
        // Excel 文件操作方法（用於雙向同步）
        Task<byte[]> DownloadExcelFileAsync(Guid companyId, string fileId);
        Task<bool> UploadExcelFileAsync(Guid companyId, string fileId, byte[] fileBytes);
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

        private async Task<SheetsService> CreateSheetsServiceAsync(Guid companyId, bool requireWriteAccess = false)
        {
            try
            {
                _loggingService.LogInformation($"[GoogleSheetsService] 開始創建 Google Sheets 服務，公司ID: {companyId}, 需要寫入權限: {requireWriteAccess}");
                
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

                // 如果需要寫入權限，必須使用 Service Account（OAuth2），不能使用 API Key
                if (requireWriteAccess)
                {
                    if (string.Equals(runtime.AuthType, "serviceAccount", StringComparison.OrdinalIgnoreCase) &&
                        !string.IsNullOrWhiteSpace(runtime.AuthConfigJson))
                    {
                        _loggingService.LogInformation($"[GoogleSheetsService] 寫入操作需要 Service Account 認證，AuthConfigJson 長度: {runtime.AuthConfigJson.Length}");
                        
                        try
                        {
                            var credential = GoogleCredential.FromJson(runtime.AuthConfigJson);
                            var resolvedScopes = ResolveScopes(runtime);
                            var scopes = new List<string>();
                            
                            // 如果從配置中解析到 scopes，使用它們；否則使用默認值
                            if (resolvedScopes != null && resolvedScopes.Any())
                            {
                                scopes.AddRange(resolvedScopes);
                            }
                            else
                            {
                                scopes.AddRange(new[]
                                {
                                    "https://www.googleapis.com/auth/documents",
                                    "https://www.googleapis.com/auth/drive.file",
                                    "https://www.googleapis.com/auth/spreadsheets"
                                });
                            }
                            
                            // 確保寫入操作必需的 spreadsheets scope 被包含
                            var spreadsheetsScope = "https://www.googleapis.com/auth/spreadsheets";
                            if (!scopes.Contains(spreadsheetsScope))
                            {
                                _loggingService.LogWarning($"[GoogleSheetsService] 自定義 scopes 中缺少 spreadsheets scope，自動添加: {spreadsheetsScope}");
                                scopes.Add(spreadsheetsScope);
                            }
                            
                            _loggingService.LogInformation($"[GoogleSheetsService] Service Account Scopes: {string.Join(", ", scopes)}");
                            
                            credential = credential.CreateScoped(scopes);
                            initializer.HttpClientInitializer = credential;
                            _loggingService.LogInformation("[GoogleSheetsService] Google Sheets 服務初始化成功（使用 Service Account，支持寫入）");
                        }
                        catch (Exception saEx)
                        {
                            _loggingService.LogError($"[GoogleSheetsService] Service Account 認證失敗: {saEx.Message}", saEx);
                            throw;
                        }
                    }
                    else
                    {
                        var errorMessage = "寫入操作需要 Service Account 認證。請在 Google Docs API 供應商配置中設置 AuthType 為 'serviceAccount' 並提供 AuthConfigJson（Service Account JSON）。API Key 僅支持讀取操作，不能用於寫入。";
                        _loggingService.LogError($"[GoogleSheetsService] {errorMessage}");
                        throw new InvalidOperationException(errorMessage);
                    }
                }
                else
                {
                    // 讀取操作：優先使用 API Key（如果有的話），否則使用 Service Account
                    if (!string.IsNullOrWhiteSpace(runtime.ApiKey))
                    {
                        initializer.ApiKey = runtime.ApiKey;
                        _loggingService.LogInformation($"[GoogleSheetsService] Google Sheets 服務初始化成功（使用資料庫中的 API Key，僅支持讀取），API Key 長度: {runtime.ApiKey.Length}");
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
                                "https://www.googleapis.com/auth/spreadsheets"
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

                // 構建範圍字符串
                // Google Sheets API 支持只使用工作表名稱來讀取整個工作表的所有數據
                // 或者使用完整的範圍格式，例如 Sheet1!A1:Z1000
                // 如果沒有指定範圍，使用工作表名稱來讀取整個工作表（轉義工作表名稱以支持特殊字符）
                var escapedSheetName = EscapeSheetName(sheetName);
                var rangeString = range ?? escapedSheetName; // 只使用工作表名稱，讀取整個工作表的所有數據
                
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

        /// <summary>
        /// 獲取 Google Sheets 的第一個工作表名稱
        /// </summary>
        public async Task<string> GetFirstSheetNameAsync(Guid companyId, string spreadsheetId)
        {
            try
            {
                _loggingService.LogInformation($"獲取 Google Sheets 第一個工作表名稱，表格ID: {spreadsheetId}");

                using var sheetsService = await CreateSheetsServiceAsync(companyId);
                var request = sheetsService.Spreadsheets.Get(spreadsheetId);
                var response = await request.ExecuteAsync();

                if (response.Sheets == null || !response.Sheets.Any())
                {
                    _loggingService.LogWarning($"Google Sheets 沒有工作表，表格ID: {spreadsheetId}");
                    return "Sheet1"; // 默認值
                }

                var firstSheet = response.Sheets.First();
                var sheetName = firstSheet.Properties?.Title ?? "Sheet1";
                
                _loggingService.LogInformation($"成功獲取第一個工作表名稱: {sheetName}, 表格ID: {spreadsheetId}");
                return sheetName;
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取 Google Sheets 第一個工作表名稱失敗，表格ID: {spreadsheetId}", ex);
                // 發生錯誤時返回默認值
                return "Sheet1";
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

                // 首先嘗試使用 Google Sheets API 檢測（適用於原生 Google Sheets）
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
                    // 如果 Google Sheets API 失敗，嘗試使用 Google Drive API 檢測（適用於 Excel 文件）
                    if (responseContent.Contains("This operation is not supported for this document") || 
                        responseContent.Contains("FAILED_PRECONDITION"))
                    {
                        // 這可能是 Excel 文件，但需要驗證它是否在 Google Drive 中存在
                        try
                        {
                            using var driveService = await CreateDriveServiceAsync(companyId);
                            var driveRequest = driveService.Files.Get(spreadsheetId);
                            driveRequest.Fields = "id, name, mimeType";
                            var driveFile = await driveRequest.ExecuteAsync();
                            
                            // 檢查 MIME 類型
                            if (driveFile.MimeType == "application/vnd.google-apps.spreadsheet")
                            {
                                // 這是 Google Sheets，但 Google Sheets API 讀不到（可能是權限問題）
                                _loggingService.LogWarning($"[GoogleSheetsService] 文件在 Google Drive 中是 Google Sheets 類型，但 Google Sheets API 無法訪問。可能是權限問題。");
                                return "googlesheets"; // 返回 googlesheets，但可能需要檢查權限
                            }
                            else if (driveFile.MimeType == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
                                     driveFile.MimeType == "application/vnd.ms-excel")
                            {
                                _loggingService.LogInformation($"[GoogleSheetsService] 檢測到文件類型: excel (Excel 文件上傳到 Google Drive)");
                                return "excel";
                            }
                            else
                            {
                                _loggingService.LogWarning($"[GoogleSheetsService] 未知的 MIME 類型: {driveFile.MimeType}");
                                return "unknown";
                            }
                        }
                        catch (Google.GoogleApiException gex) when (gex.HttpStatusCode == System.Net.HttpStatusCode.NotFound)
                        {
                            // 文件在 Google Drive 中不存在，這可能是因為：
                            // 1. Service Account 沒有權限訪問該文件（文件沒有分享給 Service Account）
                            // 2. fileId 是 Google Sheets 的 ID，不是 Drive 文件的 ID
                            // 3. 文件確實不存在
                            // 
                            // 當 Google Sheets API 返回 "This operation is not supported" 時，通常表示是 Excel 文件
                            // 但如果 Google Drive API 也找不到，可能是權限問題
                            // 我們應該嘗試使用 Service Account 通過 Google Sheets API 來驗證
                            _loggingService.LogWarning($"[GoogleSheetsService] 文件在 Google Drive 中不存在（可能是權限問題或 fileId 是 Google Sheets 的 ID）。");
                            
                            // 嘗試使用 Service Account 通過 Google Sheets API 來驗證是否是 Google Sheets
                            try
                            {
                                using var sheetsService = await CreateSheetsServiceAsync(companyId);
                                var testRequest = sheetsService.Spreadsheets.Get(spreadsheetId);
                                testRequest.Fields = "spreadsheetId, properties.title";
                                var testResponse = await testRequest.ExecuteAsync();
                                
                                if (testResponse != null && !string.IsNullOrEmpty(testResponse.SpreadsheetId))
                                {
                                    _loggingService.LogInformation($"[GoogleSheetsService] 使用 Service Account 成功訪問文件，確認是 Google Sheets 類型。");
                                    return "googlesheets";
                                }
                            }
                            catch (Exception sheetsEx)
                            {
                                _loggingService.LogWarning($"[GoogleSheetsService] 使用 Service Account 也無法訪問文件: {sheetsEx.Message}。可能是權限問題。");
                            }
                            
                            // 如果都失敗，可能是 Excel 文件但沒有權限，或者確實是 Google Sheets 但沒有權限
                            // 我們返回 "googlesheets" 作為默認，因為從 URL 來看通常是 Google Sheets
                            _loggingService.LogWarning($"[GoogleSheetsService] 無法確定文件類型，可能是權限問題。默認假設是 Google Sheets。");
                            _loggingService.LogWarning($"[GoogleSheetsService] 請確保文件已分享給 Service Account，並且 Service Account 有讀寫權限。");
                            return "googlesheets"; // 默認返回 googlesheets，因為從 URL 格式來看通常是 Google Sheets
                        }
                        catch (Exception driveEx)
                        {
                            _loggingService.LogWarning($"[GoogleSheetsService] 使用 Google Drive API 檢測失敗: {driveEx.Message}。假設是 Excel 文件。");
                            return "excel";
                        }
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

        /// <summary>
        /// 寫入數據到 Google Sheets
        /// </summary>
        public async Task<bool> WriteSheetDataAsync(Guid companyId, string spreadsheetId, string sheetName, List<List<object>> data, int startRow = 1)
        {
            try
            {
                _loggingService.LogInformation($"開始寫入 Google Sheets 數據，表格ID: {spreadsheetId}, 工作表: {sheetName}, 起始行: {startRow}, 數據行數: {data.Count}");

                if (data == null || !data.Any())
                {
                    _loggingService.LogWarning($"沒有數據需要寫入，表格ID: {spreadsheetId}");
                    return false;
                }

                using var sheetsService = await CreateSheetsServiceAsync(companyId, requireWriteAccess: true);
                
                // 構建範圍字符串（轉義工作表名稱以支持特殊字符）
                var escapedSheetName = EscapeSheetName(sheetName);
                var endRow = startRow + data.Count - 1;
                var rangeString = $"{escapedSheetName}!A{startRow}:ZZ{endRow}";
                
                _loggingService.LogInformation($"寫入範圍: {rangeString}");

                // 構建 ValueRange 對象
                var valueRange = new ValueRange
                {
                    Values = data.Select(row => row.Select(cell => cell ?? string.Empty).Cast<object>().ToList()).Cast<IList<object>>().ToList()
                };

                // 執行寫入操作
                var request = sheetsService.Spreadsheets.Values.Update(valueRange, spreadsheetId, rangeString);
                request.ValueInputOption = SpreadsheetsResource.ValuesResource.UpdateRequest.ValueInputOptionEnum.USERENTERED;
                
                var response = await request.ExecuteAsync();
                
                _loggingService.LogInformation($"成功寫入 Google Sheets 數據，表格ID: {spreadsheetId}, 更新單元格數: {response.UpdatedCells ?? 0}");
                return true;
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"寫入 Google Sheets 數據失敗，表格ID: {spreadsheetId}, 工作表: {sheetName}", ex);
                throw;
            }
        }

        /// <summary>
        /// 更新 Google Sheets 中的特定單元格
        /// </summary>
        /// <param name="updates">Dictionary&lt;行號, Dictionary&lt;列號, 值&gt;&gt;，行號和列號從1開始</param>
        public async Task<bool> UpdateSheetDataAsync(Guid companyId, string spreadsheetId, string sheetName, Dictionary<int, Dictionary<int, object>> updates)
        {
            try
            {
                _loggingService.LogInformation($"開始更新 Google Sheets 數據，表格ID: {spreadsheetId}, 工作表: {sheetName}, 更新單元格數: {updates.Sum(u => u.Value.Count)}");

                if (updates == null || !updates.Any())
                {
                    _loggingService.LogWarning($"沒有更新數據，表格ID: {spreadsheetId}");
                    return false;
                }

                using var sheetsService = await CreateSheetsServiceAsync(companyId, requireWriteAccess: true);

                // 構建批量更新請求
                var data = new List<ValueRange>();
                
                foreach (var rowUpdate in updates)
                {
                    var rowNumber = rowUpdate.Key;
                    var columnUpdates = rowUpdate.Value;
                    
                    if (!columnUpdates.Any()) continue;

                    // 找到最小和最大列號
                    var minCol = columnUpdates.Keys.Min();
                    var maxCol = columnUpdates.Keys.Max();
                    
                    // 將列號轉換為字母（A, B, C...）
                    var startCol = ConvertColumnNumberToLetter(minCol);
                    var endCol = ConvertColumnNumberToLetter(maxCol);
                    
                    // 構建範圍（轉義工作表名稱以支持特殊字符）
                    var escapedSheetName = EscapeSheetName(sheetName);
                    var rangeString = $"{escapedSheetName}!{startCol}{rowNumber}:{endCol}{rowNumber}";
                    
                    // 構建行數據（確保所有列都有值）
                    var rowData = new List<object>();
                    for (int col = minCol; col <= maxCol; col++)
                    {
                        rowData.Add(columnUpdates.ContainsKey(col) ? columnUpdates[col] ?? string.Empty : string.Empty);
                    }
                    
                    data.Add(new ValueRange
                    {
                        Range = rangeString,
                        Values = new List<IList<object>> { rowData }
                    });
                }

                // 執行批量更新
                var batchUpdateRequest = new BatchUpdateValuesRequest
                {
                    ValueInputOption = "USER_ENTERED",
                    Data = data
                };

                var request = sheetsService.Spreadsheets.Values.BatchUpdate(batchUpdateRequest, spreadsheetId);
                var response = await request.ExecuteAsync();
                
                _loggingService.LogInformation($"成功更新 Google Sheets 數據，表格ID: {spreadsheetId}, 更新單元格數: {response.TotalUpdatedCells ?? 0}");
                return true;
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"更新 Google Sheets 數據失敗，表格ID: {spreadsheetId}, 工作表: {sheetName}", ex);
                throw;
            }
        }

        /// <summary>
        /// 清除 Google Sheets 中的指定範圍
        /// </summary>
        public async Task<bool> ClearSheetRangeAsync(Guid companyId, string spreadsheetId, string sheetName, string range)
        {
            try
            {
                _loggingService.LogInformation($"開始清除 Google Sheets 範圍，表格ID: {spreadsheetId}, 工作表: {sheetName}, 範圍: {range}");

                using var sheetsService = await CreateSheetsServiceAsync(companyId, requireWriteAccess: true);
                
                // 構建完整範圍字符串（轉義工作表名稱以支持特殊字符）
                // Google Sheets API 支持只使用工作表名稱來清除整個工作表
                // 或者使用完整的範圍格式，例如 Sheet1!A1:Z1000
                var escapedSheetName = EscapeSheetName(sheetName);
                var rangeString = string.IsNullOrEmpty(range) ? escapedSheetName : $"{escapedSheetName}!{range}";
                
                var request = sheetsService.Spreadsheets.Values.Clear(new ClearValuesRequest(), spreadsheetId, rangeString);
                var response = await request.ExecuteAsync();
                
                _loggingService.LogInformation($"成功清除 Google Sheets 範圍，表格ID: {spreadsheetId}, 清除範圍: {rangeString}");
                return true;
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"清除 Google Sheets 範圍失敗，表格ID: {spreadsheetId}, 工作表: {sheetName}, 範圍: {range}", ex);
                throw;
            }
        }

        /// <summary>
        /// 將列號轉換為字母（1 -> A, 2 -> B, 27 -> AA）
        /// </summary>
        private string ConvertColumnNumberToLetter(int columnNumber)
        {
            if (columnNumber < 1)
                throw new ArgumentException("列號必須大於0", nameof(columnNumber));

            var result = string.Empty;
            while (columnNumber > 0)
            {
                columnNumber--;
                result = (char)('A' + columnNumber % 26) + result;
                columnNumber /= 26;
            }
            return result;
        }

        /// <summary>
        /// 轉義工作表名稱，如果包含特殊字符（空格、中文、標點符號等），用單引號括起來
        /// </summary>
        private string EscapeSheetName(string sheetName)
        {
            if (string.IsNullOrWhiteSpace(sheetName))
                return sheetName;

            // 如果工作表名稱只包含字母、數字和下劃線，不需要轉義
            if (System.Text.RegularExpressions.Regex.IsMatch(sheetName, @"^[A-Za-z0-9_]+$"))
            {
                return sheetName;
            }

            // 如果包含特殊字符，需要用單引號括起來，並轉義單引號（用兩個單引號表示一個單引號）
            return $"'{sheetName.Replace("'", "''")}'";
        }

        /// <summary>
        /// 創建 Google Drive 服務
        /// </summary>
        private async Task<DriveService> CreateDriveServiceAsync(Guid companyId)
        {
            try
            {
                _loggingService.LogInformation($"[GoogleSheetsService] 開始創建 Google Drive 服務，公司ID: {companyId}");
                
                var runtime = await _apiProviderService.GetRuntimeProviderAsync(companyId, "google-docs");

                if (runtime == null)
                {
                    _loggingService.LogWarning($"[GoogleSheetsService] 公司 {companyId} 尚未設定 Google Docs API 供應商（ProviderKey: google-docs）");
                    throw new InvalidOperationException("Google Docs API provider is not configured.");
                }

                _loggingService.LogInformation($"[GoogleSheetsService] 成功獲取 Google Docs provider 配置，ProviderKey: {runtime.ProviderKey}, AuthType: {runtime.AuthType ?? "null"}, HasApiKey: {!string.IsNullOrWhiteSpace(runtime.ApiKey)}, HasAuthConfigJson: {!string.IsNullOrWhiteSpace(runtime.AuthConfigJson)}");

                var applicationName = ResolveApplicationName(runtime) ?? "WhatoFlow Google Drive";
                _loggingService.LogInformation($"[GoogleSheetsService] 應用程式名稱: {applicationName}");

                var initializer = new BaseClientService.Initializer
                {
                    ApplicationName = applicationName
                };

                // Google Drive API 需要 OAuth 或 Service Account 認證才能下載/上傳文件
                // API Key 對 Drive API 的權限非常有限，不能用於文件操作
                if (string.Equals(runtime.AuthType, "serviceAccount", StringComparison.OrdinalIgnoreCase) &&
                     !string.IsNullOrWhiteSpace(runtime.AuthConfigJson))
                {
                    _loggingService.LogInformation($"[GoogleSheetsService] 嘗試使用 Service Account 認證創建 Drive 服務，AuthConfigJson 長度: {runtime.AuthConfigJson.Length}");
                    
                    try
                    {
                        var credential = GoogleCredential.FromJson(runtime.AuthConfigJson);
                        var scopes = ResolveScopes(runtime) ?? new[]
                        {
                            "https://www.googleapis.com/auth/documents",
                            "https://www.googleapis.com/auth/drive.file",
                            "https://www.googleapis.com/auth/spreadsheets"
                        };
                        _loggingService.LogInformation($"[GoogleSheetsService] Drive Service Account Scopes: {string.Join(", ", scopes)}");
                        
                        credential = credential.CreateScoped(scopes);
                        initializer.HttpClientInitializer = credential;
                        _loggingService.LogInformation("[GoogleSheetsService] Google Drive 服務初始化成功（使用 Service Account）");
                    }
                    catch (Exception saEx)
                    {
                        _loggingService.LogError($"[GoogleSheetsService] Service Account 認證失敗: {saEx.Message}", saEx);
                        throw;
                    }
                }
                else
                {
                    // 檢查是否有 API Key，但 Drive API 需要 Service Account 或 OAuth
                    var hasApiKey = !string.IsNullOrWhiteSpace(runtime.ApiKey);
                    var hasAuthConfig = !string.IsNullOrWhiteSpace(runtime.AuthConfigJson);
                    var authType = runtime.AuthType ?? "null";
                    
                    _loggingService.LogWarning($"[GoogleSheetsService] Google Drive API 需要 Service Account 或 OAuth 認證才能下載/上載文件。當前配置 - AuthType: {authType}, HasApiKey: {hasApiKey}, HasAuthConfigJson: {hasAuthConfig}，公司 {companyId}");
                    
                    if (hasApiKey && !hasAuthConfig)
                    {
                        throw new InvalidOperationException("Google Drive API 需要 Service Account 認證才能下載/上傳文件。API Key 僅支持有限的讀取操作。請在 Google Docs API 供應商配置中添加 Service Account 認證信息（AuthType: serviceAccount, AuthConfigJson: Service Account JSON）。");
                    }
                    else
                    {
                        throw new InvalidOperationException("Google Drive service requires Service Account authentication. Please configure Service Account credentials in the Google Docs API provider settings.");
                    }
                }

                var driveService = new DriveService(initializer);
                _loggingService.LogInformation($"[GoogleSheetsService] DriveService 實例創建成功");
                return driveService;
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"[GoogleSheetsService] 創建 Google Drive 服務失敗，公司ID: {companyId}，錯誤類型: {ex.GetType().Name}，錯誤訊息: {ex.Message}，堆棧追蹤: {ex.StackTrace}", ex);
                throw;
            }
        }

        /// <summary>
        /// 從 Google Drive 下載 Excel 文件
        /// </summary>
        public async Task<byte[]> DownloadExcelFileAsync(Guid companyId, string fileId)
        {
            try
            {
                _loggingService.LogInformation($"開始從 Google Drive 下載 Excel 文件，文件ID: {fileId}");

                using var driveService = await CreateDriveServiceAsync(companyId);
                
                // 先檢查文件是否存在及權限
                try
                {
                    var getRequest = driveService.Files.Get(fileId);
                    getRequest.Fields = "id, name, mimeType, size";
                    var fileInfo = await getRequest.ExecuteAsync();
                    var fileSize = fileInfo.Size.HasValue ? fileInfo.Size.Value.ToString() : "未知";
                    _loggingService.LogInformation($"文件信息：ID: {fileInfo.Id}, 名稱: {fileInfo.Name}, MIME類型: {fileInfo.MimeType}, 大小: {fileSize} bytes");
                    
                    // 檢查 MIME 類型
                    if (fileInfo.MimeType == "application/vnd.google-apps.spreadsheet")
                    {
                        _loggingService.LogWarning($"文件是 Google Sheets 類型（不是 Excel），文件ID: {fileId}。應該使用 Google Sheets API 而不是 Google Drive API。");
                        throw new Exception($"文件是 Google Sheets 類型（不是 Excel），文件ID: {fileId}。應該使用 Google Sheets API 而不是 Google Drive API。");
                    }
                }
                catch (Google.GoogleApiException gex) when (gex.HttpStatusCode == System.Net.HttpStatusCode.NotFound)
                {
                    _loggingService.LogError($"文件不存在於 Google Drive（ID: {fileId}）。這可能是因為：1) Service Account 沒有權限訪問該文件，2) 文件確實不存在，3) fileId 是 Google Sheets 的 ID 而不是 Drive 文件的 ID。");
                    _loggingService.LogError($"請確保：1) 文件已分享給 Service Account 的 email，2) Service Account 有讀寫權限，3) 如果這是 Google Sheets，請使用 Google Sheets API。");
                    throw new Exception($"文件不存在於 Google Drive（ID: {fileId}）。請確保文件已分享給 Service Account 並有讀寫權限。");
                }
                catch (Google.GoogleApiException gex) when (gex.HttpStatusCode == System.Net.HttpStatusCode.Forbidden)
                {
                    _loggingService.LogError($"沒有權限訪問文件（ID: {fileId}）。請確保文件已分享給 Service Account 的 email，並且 Service Account 有讀寫權限。");
                    throw new Exception($"沒有權限訪問文件（ID: {fileId}）。請確保文件已分享給 Service Account 並有讀寫權限。");
                }
                
                // 下載文件
                var request = driveService.Files.Get(fileId);
                using var stream = new MemoryStream();
                await request.DownloadAsync(stream);
                
                var fileBytes = stream.ToArray();
                _loggingService.LogInformation($"成功下載 Excel 文件，大小: {fileBytes.Length} bytes，文件ID: {fileId}");
                
                // 如果文件為空，可能是權限問題
                if (fileBytes.Length == 0)
                {
                    _loggingService.LogWarning($"下載的 Excel 文件為空，文件ID: {fileId}。這可能是因為 Service Account 沒有權限訪問該文件。");
                    throw new Exception($"下載的 Excel 文件為空（文件ID: {fileId}）。請確保文件已分享給 Service Account 並有讀寫權限。");
                }
                
                return fileBytes;
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"下載 Excel 文件失敗，文件ID: {fileId}", ex);
                throw;
            }
        }

        /// <summary>
        /// 上傳 Excel 文件到 Google Drive
        /// </summary>
        public async Task<bool> UploadExcelFileAsync(Guid companyId, string fileId, byte[] fileBytes)
        {
            try
            {
                _loggingService.LogInformation($"開始上傳 Excel 文件到 Google Drive，文件ID: {fileId}，大小: {fileBytes.Length} bytes");

                using var driveService = await CreateDriveServiceAsync(companyId);
                
                // 先檢查文件是否存在於 Google Drive
                try
                {
                    var getRequest = driveService.Files.Get(fileId);
                    getRequest.Fields = "id, name, mimeType";
                    var existingFile = await getRequest.ExecuteAsync();
                    _loggingService.LogInformation($"文件已存在於 Google Drive，ID: {existingFile.Id}, 名稱: {existingFile.Name}, MIME類型: {existingFile.MimeType}");
                    
                    // 文件存在，使用 Update 方法
                    using var stream = new MemoryStream(fileBytes);
                    var updateRequest = driveService.Files.Update(
                        new Google.Apis.Drive.v3.Data.File(), 
                        fileId, 
                        stream, 
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
                    
                    var uploadProgress = await updateRequest.UploadAsync();
                    
                    if (uploadProgress.Status != Google.Apis.Upload.UploadStatus.Completed)
                    {
                        var error = uploadProgress.Exception;
                        _loggingService.LogError($"上傳 Excel 文件未完成，文件ID: {fileId}，狀態: {uploadProgress.Status}，錯誤: {error?.Message}");
                        throw new Exception($"上傳 Excel 文件未完成: {uploadProgress.Status}，錯誤: {error?.Message}");
                    }
                    
                    _loggingService.LogInformation($"成功更新 Excel 文件到 Google Drive，文件ID: {fileId}，上傳大小: {uploadProgress.BytesSent} bytes");
                    return true;
                }
                catch (Google.GoogleApiException gex) when (gex.HttpStatusCode == System.Net.HttpStatusCode.NotFound)
                {
                    // 文件不存在於 Google Drive，這可能是因為：
                    // 1. fileId 是 Google Sheets 的 ID，不是 Drive 文件的 ID
                    // 2. 文件確實不存在
                    _loggingService.LogError($"文件不存在於 Google Drive（ID: {fileId}）。這可能是因為 fileId 是 Google Sheets 的 ID，不是 Drive 文件的 ID。");
                    _loggingService.LogError($"無法使用 Google Drive API 更新文件。如果這是 Google Sheets，請使用 Google Sheets API 來更新數據。");
                    _loggingService.LogError($"如果這是 Excel 文件，請確保 fileId 是 Google Drive 文件的 ID，而不是 Google Sheets 的 spreadsheetId。");
                    throw new Exception($"文件不存在於 Google Drive（ID: {fileId}）。如果這是 Google Sheets 文件，請使用 Google Sheets API 來更新數據。如果這是 Excel 文件，請確保 fileId 是 Google Drive 文件的 ID。");
                }
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"上傳 Excel 文件失敗，文件ID: {fileId}", ex);
                throw;
            }
        }
    }
}
