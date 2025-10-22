using Google.Apis.Auth.OAuth2;
using Google.Apis.Sheets.v4;
using Google.Apis.Sheets.v4.Data;
using Google.Apis.Services;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Configuration;

namespace PurpleRice.Services
{
    public interface IGoogleSheetsService
    {
        Task<List<List<string>>> ReadSheetDataAsync(string spreadsheetId, string sheetName, string range = null);
        Task<List<string>> GetSheetNamesAsync(string spreadsheetId);
        Task<bool> TestConnectionAsync(string spreadsheetId);
    }

    public class GoogleSheetsService : IGoogleSheetsService
    {
        private readonly LoggingService _loggingService;
        private readonly SheetsService _sheetsService;
        private readonly IConfiguration _configuration;

        public GoogleSheetsService(LoggingService loggingService, IConfiguration configuration)
        {
            _loggingService = loggingService;
            _configuration = configuration;
            _sheetsService = CreateSheetsService();
        }

        private SheetsService CreateSheetsService()
        {
            try
            {
                // 嘗試從多個來源獲取 API Key
                var apiKey = Environment.GetEnvironmentVariable("GOOGLE_API_KEY") ?? 
                            _configuration["GoogleApiKey"];
                
                var initializer = new BaseClientService.Initializer()
                {
                    ApplicationName = "WhatoFlow DataSet Management"
                };
                
                // 如果有 API Key，則使用它
                if (!string.IsNullOrEmpty(apiKey))
                {
                    initializer.ApiKey = apiKey;
                    _loggingService.LogInformation("Google Sheets 服務初始化成功（使用 API Key）");
                }
                else
                {
                    _loggingService.LogWarning("未找到 GOOGLE_API_KEY 環境變量或 GoogleApiKey 配置，將嘗試無認證訪問");
                    _loggingService.LogWarning("請設置環境變量 GOOGLE_API_KEY 或在 appsettings.json 中添加 GoogleApiKey 配置");
                }
                
                var service = new SheetsService(initializer);
                return service;
            }
            catch (Exception ex)
            {
                _loggingService.LogError("創建 Google Sheets 服務失敗", ex);
                throw;
            }
        }

        public async Task<List<List<string>>> ReadSheetDataAsync(string spreadsheetId, string sheetName, string range = null)
        {
            try
            {
                _loggingService.LogInformation($"開始讀取 Google Sheets 數據，表格ID: {spreadsheetId}, 工作表: {sheetName}");

                // 構建範圍字符串 - 擴大讀取範圍以確保讀取所有數據
                var rangeString = range ?? $"{sheetName}!A:ZZ"; // 擴展到 ZZ 列以確保讀取所有數據
                
                _loggingService.LogInformation($"讀取範圍: {rangeString}");

                var request = _sheetsService.Spreadsheets.Values.Get(spreadsheetId, rangeString);
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

        public async Task<List<string>> GetSheetNamesAsync(string spreadsheetId)
        {
            try
            {
                _loggingService.LogInformation($"獲取 Google Sheets 工作表名稱，表格ID: {spreadsheetId}");

                var request = _sheetsService.Spreadsheets.Get(spreadsheetId);
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

        public async Task<bool> TestConnectionAsync(string spreadsheetId)
        {
            try
            {
                _loggingService.LogInformation($"測試 Google Sheets 連接，表格ID: {spreadsheetId}");

                var request = _sheetsService.Spreadsheets.Get(spreadsheetId);
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
    }
}
