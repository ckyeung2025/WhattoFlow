using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using PurpleRice.Models;
using PurpleRice.Models.DTOs;
using PurpleRice.Data;
using PurpleRice.Services;
using System.Security.Claims;
using System.Linq;
using System.Text.Json;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Spreadsheet;

namespace PurpleRice.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class ContactImportController : ControllerBase
    {
        private readonly ContactListService _contactListService;
        private readonly ILogger<ContactImportController> _logger;
        private readonly IConfiguration _configuration;
        private readonly PurpleRiceDbContext _context;

        public ContactImportController(
            ContactListService contactListService, 
            ILogger<ContactImportController> logger, 
            IConfiguration configuration,
            PurpleRiceDbContext context)
        {
            _contactListService = contactListService;
            _logger = logger;
            _configuration = configuration;
            _context = context;
        }

        /// <summary>
        /// 獲取當前用戶ID
        /// </summary>
        private string GetCurrentUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (userIdClaim != null)
            {
                _logger.LogInformation("ContactImportController - Found user ID: {UserId}", userIdClaim.Value);
                return userIdClaim.Value;
            }

            _logger.LogWarning("ContactImportController - No user ID found in claims");
            return "system";
        }

        /// <summary>
        /// 獲取當前公司ID
        /// </summary>
        private Guid GetCurrentCompanyId()
        {
            var companyIdClaim = User.FindFirst("company_id");
            if (companyIdClaim != null && Guid.TryParse(companyIdClaim.Value, out Guid companyId))
            {
                _logger.LogInformation("ContactImportController - Found company ID: {CompanyId}", companyId);
                return companyId;
            }

            _logger.LogWarning("ContactImportController - No company ID found in claims");
            return Guid.Empty;
        }

        /// <summary>
        /// 獲取 Excel 儲存格的值
        /// </summary>
        private string GetCellValue(DocumentFormat.OpenXml.Spreadsheet.Cell cell, DocumentFormat.OpenXml.Packaging.WorkbookPart workbookPart)
        {
            if (cell == null)
                return string.Empty;

            var value = cell.CellValue?.Text;
            if (string.IsNullOrEmpty(value))
                return string.Empty;

            // 如果儲存格有資料類型，根據類型處理
            if (cell.DataType != null)
            {
                if (cell.DataType.Value == CellValues.SharedString)
                {
                    var stringTable = workbookPart?.SharedStringTablePart?.SharedStringTable;
                    if (stringTable != null && int.TryParse(value, out int index) && index < stringTable.Count())
                    {
                        return stringTable.ElementAt(index).InnerText;
                    }
                }
                else if (cell.DataType.Value == CellValues.Boolean)
                {
                    return value == "1" ? "TRUE" : "FALSE";
                }
                else if (cell.DataType.Value == CellValues.Date)
                {
                    if (double.TryParse(value, out double dateValue))
                    {
                        var date = DateTime.FromOADate(dateValue);
                        return date.ToString("yyyy-MM-dd");
                    }
                }
            }

            return value;
        }

        /// <summary>
        /// 從 Google Sheets URL 中提取 Spreadsheet ID
        /// </summary>
        private string ExtractSpreadsheetIdFromUrl(string url)
        {
            if (string.IsNullOrEmpty(url))
                return string.Empty;

            // Google Sheets URL 格式：
            // https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit#gid=SHEET_ID
            var match = System.Text.RegularExpressions.Regex.Match(url, @"/spreadsheets/d/([a-zA-Z0-9-_]+)");
            return match.Success ? match.Groups[1].Value : string.Empty;
        }

        /// <summary>
        /// 檢測 Google 文件類型（Excel 或 Google Sheets）
        /// </summary>
        private async Task<string> DetectGoogleFileTypeAsync(string spreadsheetId)
        {
            try
            {
                var apiKey = _configuration["GoogleApiKey"];
                if (string.IsNullOrEmpty(apiKey))
                {
                    _logger.LogWarning("Google API 金鑰未配置，無法檢測文件類型");
                    return "unknown";
                }

                using var httpClient = new HttpClient();
                httpClient.Timeout = TimeSpan.FromSeconds(30);

                // 嘗試調用 Google Sheets API 來檢測文件類型
                var apiUrl = $"https://sheets.googleapis.com/v4/spreadsheets/{spreadsheetId}?key={apiKey}&fields=sheets.properties.title";
                _logger.LogInformation("檢測文件類型 - API URL: {ApiUrl}", apiUrl);

                var httpResponse = await httpClient.GetAsync(apiUrl);
                var response = await httpResponse.Content.ReadAsStringAsync();
                
                _logger.LogInformation("文件類型檢測響應狀態: {StatusCode}", httpResponse.StatusCode);
                _logger.LogInformation("文件類型檢測響應內容: {Response}", response);

                if (httpResponse.IsSuccessStatusCode)
                {
                    // 成功調用 Google Sheets API，說明是原生 Google Sheets
                    return "googlesheets";
                }
                else
                {
                    // 檢查是否是 "This operation is not supported for this document" 錯誤
                    if (response.Contains("This operation is not supported for this document") || 
                        response.Contains("FAILED_PRECONDITION"))
                    {
                        // 這是 Excel 文件上傳到 Google Drive 的情況
                        return "excel";
                    }
                    else
                    {
                        // 其他錯誤（權限、不存在等）
                        return "error";
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "檢測 Google 文件類型失敗 - SpreadsheetId: {SpreadsheetId}", spreadsheetId);
                return "unknown";
            }
        }

        /// <summary>
        /// 使用 Google Sheets API 獲取工作表列表
        /// </summary>
        private async Task<List<string>> GetGoogleSheetsTabsAsync(string spreadsheetId)
        {
            try
            {
                var apiKey = _configuration["GoogleApiKey"];
                if (string.IsNullOrEmpty(apiKey))
                {
                    _logger.LogWarning("Google API Key 未配置，無法獲取工作表列表");
                    return new List<string>();
                }

                using var httpClient = new HttpClient();
                httpClient.Timeout = TimeSpan.FromSeconds(30);

                // 使用 Google Sheets API v4 獲取 spreadsheet metadata
                // 根據官方文檔：GET /v4/spreadsheets/{spreadsheetId}
                var apiUrl = $"https://sheets.googleapis.com/v4/spreadsheets/{spreadsheetId}?key={apiKey}&fields=sheets.properties.title";
                
                _logger.LogInformation("調用 Google Sheets API - URL: {ApiUrl}", apiUrl);

                var httpResponse = await httpClient.GetAsync(apiUrl);
                var response = await httpResponse.Content.ReadAsStringAsync();
                
                _logger.LogInformation("Google Sheets API HTTP 狀態: {StatusCode}", httpResponse.StatusCode);
                _logger.LogInformation("Google Sheets API 響應: {Response}", response);

                if (!httpResponse.IsSuccessStatusCode)
                {
                    _logger.LogError("Google Sheets API 調用失敗 - 狀態碼: {StatusCode}, 響應: {Response}", 
                        httpResponse.StatusCode, response);
                    return new List<string>(); // 返回空列表而不是 BadRequest
                }

                // 解析 JSON 響應
                _logger.LogInformation("開始解析 JSON 響應...");
                var jsonDoc = System.Text.Json.JsonDocument.Parse(response);
                var sheets = new List<string>();

                _logger.LogInformation("完整的 JSON 結構: {JsonStructure}", jsonDoc.RootElement.ToString());

                if (jsonDoc.RootElement.TryGetProperty("sheets", out var sheetsArray))
                {
                    _logger.LogInformation("找到 sheets 屬性，工作表數量: {Count}", sheetsArray.GetArrayLength());
                    
                    foreach (var sheet in sheetsArray.EnumerateArray())
                    {
                        if (sheet.TryGetProperty("properties", out var properties))
                        {
                            _logger.LogInformation("工作表屬性: {Properties}", properties.ToString());
                            
                            if (properties.TryGetProperty("title", out var title))
                            {
                                var sheetTitle = title.GetString() ?? "";
                                sheets.Add(sheetTitle);
                                _logger.LogInformation("添加工作表: {Title}", sheetTitle);
                            }
                            else
                            {
                                _logger.LogWarning("工作表屬性中沒有找到 title");
                            }
                        }
                        else
                        {
                            _logger.LogWarning("工作表中沒有找到 properties");
                        }
                    }
                }
                else
                {
                    _logger.LogWarning("❌ JSON 響應中沒有找到 sheets 屬性");
                    
                    // 列出所有可用的屬性
                    var availableProperties = new List<string>();
                    foreach (var property in jsonDoc.RootElement.EnumerateObject())
                    {
                        availableProperties.Add(property.Name);
                    }
                    _logger.LogInformation("可用的 JSON 屬性: {Properties}", string.Join(", ", availableProperties));
                }

                _logger.LogInformation("成功獲取 {Count} 個工作表: {Sheets}", sheets.Count, string.Join(", ", sheets));
                return sheets;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "獲取 Google Sheets 工作表列表失敗 - SpreadsheetId: {SpreadsheetId}", spreadsheetId);
                // 如果 API 調用失敗，返回空列表讓用戶手動輸入
                return new List<string>();
            }
        }

        /// <summary>
        /// 解析 CSV 行，處理逗號分隔和引號包圍的值
        /// </summary>
        private string[] ParseCsvLine(string line)
        {
            if (string.IsNullOrEmpty(line)) return new string[0];
            
            var result = new List<string>();
            var current = new System.Text.StringBuilder();
            bool inQuotes = false;
            
            for (int i = 0; i < line.Length; i++)
            {
                char c = line[i];
                
                if (c == '"')
                {
                    if (inQuotes && i + 1 < line.Length && line[i + 1] == '"')
                    {
                        // 雙引號轉義
                        current.Append('"');
                        i++; // 跳過下一個引號
                    }
                    else
                    {
                        inQuotes = !inQuotes;
                    }
                }
                else if (c == ',' && !inQuotes)
                {
                    result.Add(current.ToString());
                    current.Clear();
                }
                else
                {
                    current.Append(c);
                }
            }
            
            result.Add(current.ToString());
            return result.ToArray();
        }

        /// <summary>
        /// 內部 Excel 文件解析方法
        /// </summary>
        private (List<Dictionary<string, object>> data, List<string> columns) ParseExcelFileInternal(string filePath, string sheetName)
        {
            var data = new List<Dictionary<string, object>>();
            var columns = new List<string>();

            try
            {
                using var stream = System.IO.File.OpenRead(filePath);
                using var spreadsheetDocument = SpreadsheetDocument.Open(stream, false);
                
                var workbookPart = spreadsheetDocument.WorkbookPart;
                WorksheetPart worksheetPart = null;
                
                // 根據工作表名稱查找對應的工作表
                if (!string.IsNullOrEmpty(sheetName) && workbookPart?.Workbook?.Sheets != null)
                {
                    var sheet = workbookPart.Workbook.Sheets.Elements<Sheet>()
                        .FirstOrDefault(s => s.Name == sheetName);
                    
                    if (sheet != null)
                    {
                        worksheetPart = (WorksheetPart)workbookPart.GetPartById(sheet.Id);
                    }
                }
                
                // 如果沒有找到指定的工作表，使用第一個工作表
                if (worksheetPart == null)
                {
                    worksheetPart = workbookPart?.WorksheetParts.FirstOrDefault();
                }
                
                if (worksheetPart == null)
                    return (data, columns);

                var worksheet = worksheetPart.Worksheet;
                var sheetData = worksheet.GetFirstChild<SheetData>();
                
                if (sheetData == null)
                    return (data, columns);

                var rows = sheetData.Elements<Row>().ToList();
                if (rows.Count == 0)
                    return (data, columns);

                // 讀取標題行（第一行）
                var headerRow = rows.FirstOrDefault();
                if (headerRow != null)
                {
                    var cells = headerRow.Elements<Cell>().ToList();
                    foreach (var cell in cells)
                    {
                        var cellValue = GetCellValue(cell, workbookPart);
                        if (!string.IsNullOrEmpty(cellValue))
                            columns.Add(cellValue);
                    }
                }

                // 讀取數據行（從第二行開始）
                for (int i = 1; i < rows.Count; i++)
                {
                    var row = rows[i];
                    var cells = row.Elements<Cell>().ToList();
                    var rowData = new Dictionary<string, object>();
                    
                    for (int j = 0; j < Math.Min(columns.Count, cells.Count); j++)
                    {
                        var cellValue = GetCellValue(cells[j], workbookPart);
                        rowData[columns[j]] = cellValue ?? "";
                    }
                    
                    // 只添加非空行
                    if (rowData.Values.Any(v => v != null && !string.IsNullOrWhiteSpace(v.ToString())))
                    {
                        data.Add(rowData);
                    }
                }

                return (data, columns);
            }
            catch (Exception)
            {
                // 如果解析失敗，返回空結果
                return (new List<Dictionary<string, object>>(), new List<string>());
            }
        }

        /// <summary>
        /// 根據工作表名稱獲取 Google Sheets 的 gid
        /// </summary>
        private async Task<int?> GetSheetGidByNameAsync(string spreadsheetId, string sheetName)
        {
            try
            {
                var apiKey = _configuration["GoogleApiKey"];
                if (string.IsNullOrEmpty(apiKey))
                {
                    _logger.LogWarning("Google API 金鑰未配置，無法獲取工作表 gid");
                    return null;
                }

                using var httpClient = new HttpClient();
                httpClient.Timeout = TimeSpan.FromSeconds(30);

                // 使用 Google Sheets API v4 獲取 spreadsheet metadata
                var apiUrl = $"https://sheets.googleapis.com/v4/spreadsheets/{spreadsheetId}?key={apiKey}&fields=sheets.properties";
                _logger.LogInformation("獲取工作表 gid - API URL: {ApiUrl}", apiUrl);

                var httpResponse = await httpClient.GetAsync(apiUrl);
                var response = await httpResponse.Content.ReadAsStringAsync();
                
                if (!httpResponse.IsSuccessStatusCode)
                {
                    _logger.LogError("獲取工作表 gid 失敗 - 狀態碼: {StatusCode}, 響應: {Response}", 
                        httpResponse.StatusCode, response);
                    return null;
                }

                // 解析 JSON 響應
                var jsonDoc = System.Text.Json.JsonDocument.Parse(response);
                
                if (jsonDoc.RootElement.TryGetProperty("sheets", out var sheetsArray))
                {
                    foreach (var sheet in sheetsArray.EnumerateArray())
                    {
                        if (sheet.TryGetProperty("properties", out var properties))
                        {
                            if (properties.TryGetProperty("title", out var title) && 
                                properties.TryGetProperty("sheetId", out var sheetId))
                            {
                                if (title.GetString() == sheetName)
                                {
                                    return sheetId.GetInt32();
                                }
                            }
                        }
                    }
                }

                _logger.LogWarning("未找到名為 '{SheetName}' 的工作表", sheetName);
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "獲取工作表 gid 失敗 - SpreadsheetId: {SpreadsheetId}, SheetName: {SheetName}", 
                    spreadsheetId, sheetName);
                return null;
            }
        }

        /// <summary>
        /// 解析 CSV 內容
        /// </summary>
        private (List<Dictionary<string, object>> data, List<string> columns) ParseCsvContent(string csvContent)
        {
            var data = new List<Dictionary<string, object>>();
            var columns = new List<string>();
            
            var lines = csvContent.Split('\n', StringSplitOptions.RemoveEmptyEntries);
            if (lines.Length == 0)
            {
                return (data, columns);
            }

            // 解析標題行
            var headers = ParseCsvLine(lines[0]);
            columns.AddRange(headers);

            // 解析數據行
            for (int i = 1; i < lines.Length; i++)
            {
                var values = ParseCsvLine(lines[i]);
                var row = new Dictionary<string, object>();
                
                for (int j = 0; j < Math.Min(headers.Length, values.Length); j++)
                {
                    var cellValue = values[j];
                    
                    // 檢測並轉換科學記數法格式的數字（通常是電話號碼）
                    if (!string.IsNullOrEmpty(cellValue) && IsScientificNotation(cellValue))
                    {
                        _logger.LogInformation("🔍 檢測到科學記數法: {OriginalValue}", cellValue);
                        var convertedValue = ConvertScientificNotationToString(cellValue);
                        _logger.LogInformation("✅ 轉換後的值: {ConvertedValue}", convertedValue);
                        cellValue = convertedValue;
                    }
                    
                    row[headers[j]] = cellValue;
                }
                
                // 只添加非空行
                if (row.Values.Any(v => v != null && !string.IsNullOrWhiteSpace(v.ToString())))
                {
                    data.Add(row);
                }
            }

            return (data, columns);
        }

        /// <summary>
        /// 檢測是否為科學記數法格式
        /// </summary>
        private bool IsScientificNotation(string value)
        {
            if (string.IsNullOrEmpty(value))
                return false;
                
            // 檢查是否包含 E 或 e，並且可以解析為 double
            bool hasE = value.Contains('E') || value.Contains('e');
            bool canParse = double.TryParse(value, System.Globalization.NumberStyles.Float, 
                                          System.Globalization.CultureInfo.InvariantCulture, out _);
            
            _logger.LogDebug("檢查科學記數法 - 值: {Value}, 包含E: {HasE}, 可解析: {CanParse}", value, hasE, canParse);
            
            return hasE && canParse;
        }

        /// <summary>
        /// 將科學記數法轉換為完整的數字字符串
        /// </summary>
        private string ConvertScientificNotationToString(string scientificValue)
        {
            try
            {
                if (double.TryParse(scientificValue, System.Globalization.NumberStyles.Float, 
                                  System.Globalization.CultureInfo.InvariantCulture, out double number))
                {
                    // 將科學記數法轉換為完整的數字字符串，不使用科學記數法格式
                    return number.ToString("0", System.Globalization.CultureInfo.InvariantCulture);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning("轉換科學記數法失敗: {Value}, 錯誤: {Error}", scientificValue, ex.Message);
            }
            
            return scientificValue; // 如果轉換失敗，返回原值
        }

        /// <summary>
        /// 直接使用 Google Sheets API v4 獲取數據，避免 CSV 導出的科學記數法問題
        /// </summary>
        private async Task<(bool success, List<Dictionary<string, object>> data, List<string> columns, string errorMessage)> GetGoogleSheetsDataDirectlyAsync(string spreadsheetId, string sheetName)
        {
            try
            {
                var apiKey = _configuration["GoogleApiKey"];
                if (string.IsNullOrEmpty(apiKey))
                {
                    return (false, null, null, "Google API 金鑰未配置");
                }

                using var httpClient = new HttpClient();
                httpClient.Timeout = TimeSpan.FromSeconds(30);

                // 構建 Google Sheets API v4 的 values 端點 URL
                // 使用 valueRenderOption=UNFORMATTED_VALUE 獲取原始值，避免格式化
                var range = string.IsNullOrEmpty(sheetName) ? "A:ZZ" : $"'{sheetName}'!A:ZZ";
                var apiUrl = $"https://sheets.googleapis.com/v4/spreadsheets/{spreadsheetId}/values/{Uri.EscapeDataString(range)}?key={apiKey}&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING";

                _logger.LogInformation("使用 Google Sheets API 直接獲取數據 - URL: {ApiUrl}", apiUrl);

                var response = await httpClient.GetAsync(apiUrl);
                var responseContent = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogError("Google Sheets API 調用失敗 - 狀態碼: {StatusCode}, 響應: {Response}", 
                        response.StatusCode, responseContent);
                    return (false, null, null, $"Google Sheets API 調用失敗: {response.StatusCode}");
                }

                // 解析 JSON 響應
                var jsonDoc = System.Text.Json.JsonDocument.Parse(responseContent);
                
                if (!jsonDoc.RootElement.TryGetProperty("values", out var valuesArray))
                {
                    return (false, null, null, "Google Sheets 響應中沒有找到數據");
                }

                var data = new List<Dictionary<string, object>>();
                var columns = new List<string>();
                var rows = new List<List<string>>();

                // 解析所有行
                foreach (var row in valuesArray.EnumerateArray())
                {
                    var rowData = new List<string>();
                    foreach (var cell in row.EnumerateArray())
                    {
                        // 獲取原始字符串值，避免數字被轉換
                        var cellValue = cell.GetString() ?? "";
                        rowData.Add(cellValue);
                    }
                    rows.Add(rowData);
                }

                if (rows.Count == 0)
                {
                    return (false, null, null, "Google Sheets 中沒有數據");
                }

                // 第一行作為標題
                var headerRow = rows[0];
                columns.AddRange(headerRow);

                // 處理數據行
                for (int i = 1; i < rows.Count; i++)
                {
                    var row = rows[i];
                    var rowDict = new Dictionary<string, object>();
                    
                    for (int j = 0; j < Math.Min(columns.Count, row.Count); j++)
                    {
                        rowDict[columns[j]] = row[j];
                    }
                    
                    // 只添加非空行
                    if (rowDict.Values.Any(v => v != null && !string.IsNullOrWhiteSpace(v.ToString())))
                    {
                        data.Add(rowDict);
                    }
                }

                _logger.LogInformation("Google Sheets API 數據獲取成功 - 行數: {RowCount}, 列數: {ColumnCount}", data.Count, columns.Count);
                return (true, data, columns, null);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "使用 Google Sheets API 獲取數據失敗");
                return (false, null, null, $"獲取數據失敗: {ex.Message}");
            }
        }

        /// <summary>
        /// 檢查重複的 WhatsApp 號碼
        /// </summary>
        [HttpPost("check-duplicates")]
        public async Task<IActionResult> CheckDuplicateWhatsApp([FromBody] List<ContactImportData> contacts)
        {
            try
            {
                var companyId = GetCurrentCompanyId();
                if (companyId == Guid.Empty)
                    return Unauthorized("無法識別公司資訊");

                if (contacts == null || !contacts.Any())
                    return BadRequest("沒有要檢查的聯絡人數據");

                var duplicates = new List<object>();
                
                foreach (var contact in contacts)
                {
                    if (string.IsNullOrEmpty(contact.WhatsAppNumber))
                        continue;

                    // 標準化 WhatsApp 號碼（移除所有非數字字符）
                    var normalizedNumber = NormalizeWhatsAppNumber(contact.WhatsAppNumber);
                    
                    if (string.IsNullOrEmpty(normalizedNumber))
                        continue;

                    // 查找現有的聯絡人
                    var existingContact = await _contactListService.FindByNormalizedWhatsAppAsync(companyId, normalizedNumber);
                    
                    if (existingContact != null)
                    {
                        duplicates.Add(new
                        {
                            rowNumber = contact.RowNumber,
                            newData = new
                            {
                                name = contact.Name,
                                whatsAppNumber = contact.WhatsAppNumber
                            },
                            existingData = new
                            {
                                name = existingContact.Name,
                                whatsAppNumber = existingContact.WhatsAppNumber
                            }
                        });
                    }
                }

                return Ok(new
                {
                    hasDuplicates = duplicates.Any(),
                    duplicates = duplicates
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "檢查重複 WhatsApp 號碼時發生錯誤");
                return StatusCode(500, "檢查重複時發生錯誤");
            }
        }

        /// <summary>
        /// 標準化 WhatsApp 號碼
        /// </summary>
        private string NormalizeWhatsAppNumber(string number)
        {
            if (string.IsNullOrEmpty(number))
                return string.Empty;
            
            // 移除所有非數字字符（包括 +、空格、連字符等）
            return new string(number.Where(char.IsDigit).ToArray());
        }

        /// <summary>
        /// 批量創建聯絡人
        /// </summary>
        [HttpPost("batch")]
        public async Task<IActionResult> BatchCreateContacts([FromBody] BatchCreateContactsRequest request)
        {
            try
            {
                var companyId = GetCurrentCompanyId();
                if (companyId == Guid.Empty)
                    return Unauthorized("無法識別公司資訊");

                var createdBy = GetCurrentUserId();
                if (string.IsNullOrEmpty(createdBy))
                {
                    _logger.LogWarning("BatchCreateContacts - No user ID found, using 'system'");
                    createdBy = "system";
                }

                if (request.Contacts == null || !request.Contacts.Any())
                    return BadRequest("沒有要創建的聯絡人數據");

                var results = new List<ContactImportResult>();
                var successCount = 0;
                var failedCount = 0;

                foreach (var contactData in request.Contacts)
                {
                    try
                    {
                        // 驗證必填欄位
                        if (string.IsNullOrEmpty(contactData.Name))
                        {
                            results.Add(new ContactImportResult
                            {
                                RowNumber = contactData.RowNumber,
                                Success = false,
                                ErrorMessage = "姓名為必填欄位"
                            });
                            failedCount++;
                            continue;
                        }

                        if (string.IsNullOrEmpty(contactData.BroadcastGroupId))
                        {
                            results.Add(new ContactImportResult
                            {
                                RowNumber = contactData.RowNumber,
                                Success = false,
                                ErrorMessage = "廣播群組為必填欄位"
                            });
                            failedCount++;
                            continue;
                        }

                        ContactList contact = null;
                        bool isUpdate = false;

                        // 如果允許更新且有 WhatsApp 號碼，檢查是否存在重複
                        if (request.AllowUpdate && !string.IsNullOrEmpty(contactData.WhatsAppNumber))
                        {
                            var normalizedNumber = NormalizeWhatsAppNumber(contactData.WhatsAppNumber);
                            _logger.LogInformation("🔍 檢查重複 - 原始號碼: {Original}, 標準化號碼: {Normalized}", 
                                contactData.WhatsAppNumber, normalizedNumber);
                            
                            if (!string.IsNullOrEmpty(normalizedNumber))
                            {
                                var existingContact = await _contactListService.FindByNormalizedWhatsAppAsync(companyId, normalizedNumber);
                                _logger.LogInformation("🔍 查找結果 - 找到現有聯絡人: {Found}, ID: {ContactId}", 
                                    existingContact != null, existingContact?.Id);
                                
                                if (existingContact != null)
                                {
                                    // 創建一個新的聯絡人對象用於更新
                                    contact = new ContactList
                                    {
                                        Id = existingContact.Id,
                                        CompanyId = existingContact.CompanyId,
                                        Name = contactData.Name?.Trim(),
                                        Title = contactData.Title?.Trim(),
                                        Occupation = contactData.Occupation?.Trim(),
                                        WhatsAppNumber = contactData.WhatsAppNumber?.Trim(),
                                        Email = contactData.Email?.Trim(),
                                        CompanyName = contactData.CompanyName?.Trim(),
                                        Department = contactData.Department?.Trim(),
                                        Position = contactData.Position?.Trim(),
                                        Hashtags = contactData.Hashtags?.Trim(),
                                        BroadcastGroupId = Guid.Parse(contactData.BroadcastGroupId),
                                        IsActive = true, // 更新時重新激活聯絡人
                                        CreatedAt = existingContact.CreatedAt,
                                        CreatedBy = existingContact.CreatedBy,
                                        UpdatedAt = DateTime.UtcNow,
                                        UpdatedBy = createdBy
                                    };
                                    isUpdate = true;
                                }
                            }
                        }

                        // 如果不是更新，創建新聯絡人
                        if (contact == null)
                        {
                            contact = new ContactList
                            {
                                Id = Guid.NewGuid(),
                                CompanyId = companyId,
                                Name = contactData.Name?.Trim(),
                                Title = contactData.Title?.Trim(),
                                Occupation = contactData.Occupation?.Trim(),
                                WhatsAppNumber = contactData.WhatsAppNumber?.Trim(),
                                Email = contactData.Email?.Trim(),
                                CompanyName = contactData.CompanyName?.Trim(),
                                Department = contactData.Department?.Trim(),
                                Position = contactData.Position?.Trim(),
                                Hashtags = contactData.Hashtags?.Trim(),
                                BroadcastGroupId = Guid.Parse(contactData.BroadcastGroupId),
                                IsActive = true,
                                CreatedAt = DateTime.UtcNow,
                                CreatedBy = createdBy,
                                UpdatedAt = null,
                                UpdatedBy = null
                            };
                        }

                        if (isUpdate)
                        {
                            _logger.LogInformation("🔄 更新聯絡人 - ID: {ContactId}, 姓名: {Name}, WhatsApp: {WhatsApp}", 
                                contact.Id, contact.Name, contact.WhatsAppNumber);
                            await _contactListService.UpdateContactAsync(contact.Id, contact, createdBy);
                            _logger.LogInformation("✅ 聯絡人更新完成 - ID: {ContactId}", contact.Id);
                        }
                        else
                        {
                            _logger.LogInformation("➕ 創建新聯絡人 - 姓名: {Name}, WhatsApp: {WhatsApp}", 
                                contact.Name, contact.WhatsAppNumber);
                            await _contactListService.CreateContactAsync(contact, createdBy);
                            _logger.LogInformation("✅ 新聯絡人創建完成 - ID: {ContactId}", contact.Id);
                        }
                        
                        results.Add(new ContactImportResult
                        {
                            RowNumber = contactData.RowNumber,
                            Success = true,
                            ContactId = contact.Id
                        });
                        successCount++;
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "批量創建聯絡人失敗，行號: {RowNumber}", contactData.RowNumber);
                        
                        results.Add(new ContactImportResult
                        {
                            RowNumber = contactData.RowNumber,
                            Success = false,
                            ErrorMessage = ex.Message
                        });
                        failedCount++;
                    }
                }

                var response = new BatchCreateContactsResponse
                {
                    TotalCount = request.Contacts.Count(),
                    SuccessCount = successCount,
                    FailedCount = failedCount,
                    Results = results
                };

                _logger.LogInformation("批量創建聯絡人完成 - 總數: {Total}, 成功: {Success}, 失敗: {Failed}", 
                    response.TotalCount, response.SuccessCount, response.FailedCount);

                return Ok(response);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "批量創建聯絡人失敗");
                return StatusCode(500, "批量創建聯絡人失敗");
            }
        }

        /// <summary>
        /// 測試 SQL 連接
        /// </summary>
        [HttpPost("test-sql-connection")]
        public async Task<IActionResult> TestSqlConnection([FromBody] SqlConnectionConfig config)
        {
            try
            {
                var connectionString = $"Server={config.Server};Database={config.Database};User Id={config.Username};Password={config.Password};TrustServerCertificate=true;";
                
                using var connection = new Microsoft.Data.SqlClient.SqlConnection(connectionString);
                await connection.OpenAsync();
                
                _logger.LogInformation("SQL 連接測試成功 - Server: {Server}, Database: {Database}", config.Server, config.Database);
                return Ok(new { success = true, message = "SQL 連接測試成功" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "SQL 連接測試失敗 - Server: {Server}, Database: {Database}", config.Server, config.Database);
                return BadRequest(new { success = false, message = "SQL 連接測試失敗: " + ex.Message });
            }
        }

        /// <summary>
        /// 從 SQL 數據庫載入數據
        /// </summary>
        [HttpPost("load-from-sql")]
        public async Task<IActionResult> LoadFromSql([FromBody] SqlConnectionConfig config)
        {
            try
            {
                _logger.LogInformation("開始 SQL 載入 - Server: {Server}, Database: {Database}, Table: {Table}", 
                    config.Server, config.Database, config.Table);
                _logger.LogInformation("Custom Query: {Query}", config.Query ?? "無");
                
                var connectionString = $"Server={config.Server};Database={config.Database};User Id={config.Username};Password={config.Password};TrustServerCertificate=true;";
                _logger.LogInformation("連接字符串: {ConnectionString}", connectionString.Replace(config.Password, "***"));
                
                using var connection = new Microsoft.Data.SqlClient.SqlConnection(connectionString);
                await connection.OpenAsync();
                _logger.LogInformation("SQL 連接已打開");
                
                string query;
                if (!string.IsNullOrEmpty(config.Query))
                {
                    query = config.Query;
                    _logger.LogInformation("使用自定義查詢: {Query}", query);
                }
                else if (!string.IsNullOrEmpty(config.Table))
                {
                    query = $"SELECT * FROM {config.Table}";
                    _logger.LogInformation("使用表名生成查詢: {Query}", query);
                }
                else
                {
                    _logger.LogError("既未提供表名也未提供自定義查詢");
                    return BadRequest(new { success = false, message = "請提供表名或自定義查詢" });
                }
                
                using var command = new Microsoft.Data.SqlClient.SqlCommand(query, connection);
                _logger.LogInformation("開始執行查詢: {Query}", query);
                using var reader = await command.ExecuteReaderAsync();
                _logger.LogInformation("查詢執行完成，開始讀取結果");
                
                var data = new List<Dictionary<string, object>>();
                var columns = new List<string>();
                
                // 獲取列名
                for (int i = 0; i < reader.FieldCount; i++)
                {
                    columns.Add(reader.GetName(i));
                }
                
                // 讀取數據
                while (await reader.ReadAsync())
                {
                    var row = new Dictionary<string, object>();
                    for (int i = 0; i < reader.FieldCount; i++)
                    {
                        var columnName = reader.GetName(i);
                        var value = reader.IsDBNull(i) ? null : reader.GetValue(i);
                        row[columnName] = value;
                    }
                    data.Add(row);
                }
                
                _logger.LogInformation("從 SQL 載入數據成功 - 行數: {RowCount}, 列數: {ColumnCount}", data.Count, columns.Count);
                _logger.LogInformation("SQL 查詢列名: {Columns}", string.Join(", ", columns));
                
                return Ok(new { 
                    success = true, 
                    data = data,
                    columns = columns
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "從 SQL 載入數據失敗");
                return BadRequest(new { success = false, message = "載入數據失敗: " + ex.Message });
            }
        }

        /// <summary>
        /// 從 Excel 文件載入數據
        /// </summary>
        [HttpPost("load-from-excel")]
        public async Task<IActionResult> LoadFromExcel([FromBody] ExcelConfig config)
        {
            try
            {
                _logger.LogInformation("開始從 Excel 載入數據 - FilePath: {FilePath}, SheetName: {SheetName}", 
                    config.FilePath, config.SheetName);

                if (string.IsNullOrEmpty(config.FilePath))
                    return BadRequest(new { success = false, message = "請提供 Excel 文件路徑" });

                if (!System.IO.File.Exists(config.FilePath))
                    return BadRequest(new { success = false, message = "Excel 文件不存在" });

                var fileExtension = Path.GetExtension(config.FilePath).ToLowerInvariant();
                var allowedExtensions = new[] { ".xlsx", ".xls", ".csv" };
                
                if (!allowedExtensions.Contains(fileExtension))
                    return BadRequest(new { success = false, message = "不支持的文件格式，請使用 .xlsx、.xls 或 .csv 文件" });

                var data = new List<Dictionary<string, object>>();
                var columns = new List<string>();

                if (fileExtension == ".csv")
                {
                    // 處理 CSV 文件
                    var lines = await System.IO.File.ReadAllLinesAsync(config.FilePath);
                    if (lines.Length == 0)
                        return BadRequest(new { success = false, message = "CSV 文件為空" });

                    var headers = lines[0].Split(',');
                    columns.AddRange(headers.Select(h => h.Trim()));

                    for (int i = 1; i < lines.Length; i++)
                    {
                        var values = lines[i].Split(',');
                        var row = new Dictionary<string, object>();
                        
                        for (int j = 0; j < Math.Min(headers.Length, values.Length); j++)
                        {
                            row[headers[j].Trim()] = values[j].Trim();
                        }
                        
                        data.Add(row);
                    }
                }
                else
                {
                    // 處理 Excel 文件 (.xlsx, .xls) - 使用 DocumentFormat.OpenXml
                    using var stream = System.IO.File.OpenRead(config.FilePath);
                    using var spreadsheetDocument = DocumentFormat.OpenXml.Packaging.SpreadsheetDocument.Open(stream, false);
                    
                    var workbookPart = spreadsheetDocument.WorkbookPart;
                    WorksheetPart worksheetPart = null;
                    
                    // 根據工作表名稱查找對應的工作表
                    if (!string.IsNullOrEmpty(config.SheetName) && workbookPart?.Workbook?.Sheets != null)
                    {
                        var sheet = workbookPart.Workbook.Sheets.Elements<Sheet>()
                            .FirstOrDefault(s => s.Name == config.SheetName);
                        
                        if (sheet != null)
                        {
                            worksheetPart = (WorksheetPart)workbookPart.GetPartById(sheet.Id);
                        }
                    }
                    
                    // 如果沒有找到指定工作表，使用第一個工作表
                    if (worksheetPart == null)
                    {
                        worksheetPart = workbookPart?.WorksheetParts.FirstOrDefault();
                    }
                    
                    if (worksheetPart == null)
                        return BadRequest(new { success = false, message = "無法讀取 Excel 文件或找不到指定工作表" });

                    var worksheet = worksheetPart.Worksheet;
                    var sheetData = worksheet.GetFirstChild<DocumentFormat.OpenXml.Spreadsheet.SheetData>();
                    
                    if (sheetData == null)
                        return BadRequest(new { success = false, message = "Excel 文件為空或無數據" });

                    var rows = sheetData.Elements<DocumentFormat.OpenXml.Spreadsheet.Row>().ToList();
                    if (rows.Count == 0)
                        return BadRequest(new { success = false, message = "Excel 文件為空或無數據" });

                    // 讀取標題行（第一行）
                    var headerRow = rows.FirstOrDefault();
                    if (headerRow != null)
                    {
                        var cells = headerRow.Elements<DocumentFormat.OpenXml.Spreadsheet.Cell>().ToList();
                        foreach (var cell in cells)
                        {
                            var cellValue = GetCellValue(cell, workbookPart);
                            if (!string.IsNullOrEmpty(cellValue))
                                columns.Add(cellValue);
                        }
                    }

                    // 讀取數據行（從第二行開始）
                    for (int i = 1; i < rows.Count; i++)
                    {
                        var row = rows[i];
                        var cells = row.Elements<DocumentFormat.OpenXml.Spreadsheet.Cell>().ToList();
                        var rowData = new Dictionary<string, object>();
                        
                        for (int j = 0; j < Math.Min(columns.Count, cells.Count); j++)
                        {
                            var cellValue = GetCellValue(cells[j], workbookPart);
                            rowData[columns[j]] = cellValue ?? "";
                        }
                        
                        data.Add(rowData);
                    }
                }

                _logger.LogInformation("Excel 數據載入成功 - 文件: {FileName}, 數據行數: {RowCount}, 欄位數: {ColumnCount}",
                    config.FilePath, data.Count, columns.Count);

                return Ok(new { 
                    success = true, 
                    data = data,
                    columns = columns
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Excel 數據載入失敗 - FilePath: {FilePath}", config.FilePath);
                return BadRequest(new { success = false, message = "Excel 數據載入失敗: " + ex.Message });
            }
        }


        /// <summary>
        /// 上傳 Google Sheets URL 並獲取工作表列表
        /// </summary>
        [HttpPost("upload-google-sheets")]
        public async Task<IActionResult> UploadGoogleSheets([FromBody] GoogleSheetsUrlConfig config)
        {
            try
            {
                _logger.LogInformation("開始獲取 Google Sheets 工作表列表 - URL: {Url}", config.Url);

                if (string.IsNullOrEmpty(config.Url))
                    return BadRequest(new { success = false, message = "請提供 Google Sheets URL" });

                var spreadsheetId = ExtractSpreadsheetIdFromUrl(config.Url);
                if (string.IsNullOrEmpty(spreadsheetId))
                {
                    return BadRequest(new { success = false, message = "無效的 Google Sheets URL" });
                }

                // 檢測文件類型
                var fileType = await DetectGoogleFileTypeAsync(spreadsheetId);
                _logger.LogInformation("檢測到文件類型: {FileType}", fileType);

                if (fileType == "excel")
                {
                    // Excel 文件不支持工作表列表獲取，返回默認配置
                    return Ok(new { 
                        success = true, 
                        spreadsheetId = spreadsheetId,
                        availableSheets = new List<string>(), // 空列表表示不支持
                        fileType = "excel",
                        message = "檢測到 Excel 文件，將使用默認工作表"
                    });
                }
                else
                {
                    // Google Sheets 原生文件，獲取工作表列表
                    var availableSheets = await GetGoogleSheetsTabsAsync(spreadsheetId);
                    
                    _logger.LogInformation("Google Sheets 工作表列表獲取成功 - SpreadsheetId: {SpreadsheetId}, Sheets: {Sheets}", 
                        spreadsheetId, string.Join(", ", availableSheets));

                    return Ok(new { 
                        success = true, 
                        spreadsheetId = spreadsheetId,
                        availableSheets = availableSheets,
                        fileType = "googlesheets",
                        message = $"URL 驗證成功，找到 {availableSheets.Count} 個工作表"
                    });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Google Sheets URL 處理失敗 - URL: {Url}", config.Url);
                return BadRequest(new { success = false, message = "Google Sheets URL 處理失敗: " + ex.Message });
            }
        }

        /// <summary>
        /// 從 Google Docs 載入數據
        /// </summary>
        [HttpPost("load-from-google-docs")]
        public async Task<IActionResult> LoadFromGoogleDocs([FromBody] GoogleDocsConfig config)
        {
            try
            {
                _logger.LogInformation("開始從 Google Docs 載入數據 - URL: {Url}, SheetName: {SheetName}", 
                    config.Url, config.SheetName);

                if (string.IsNullOrEmpty(config.Url))
                    return BadRequest(new { success = false, message = "請提供 Google Docs URL" });

                var spreadsheetId = ExtractSpreadsheetIdFromUrl(config.Url);
                if (string.IsNullOrEmpty(spreadsheetId))
                {
                    return BadRequest(new { success = false, message = "無效的 Google Sheets URL" });
                }

                // 檢測文件類型
                var fileType = await DetectGoogleFileTypeAsync(spreadsheetId);
                _logger.LogInformation("檢測到文件類型: {FileType}", fileType);

                List<Dictionary<string, object>> data;
                List<string> columns;

                if (fileType == "excel")
                {
                    // 對於 Excel 文件，嘗試使用 Google Drive 的直接下載 URL
                    var downloadUrl = $"https://drive.google.com/uc?id={spreadsheetId}&export=download";
                    _logger.LogInformation("嘗試從 Google Drive 下載 Excel 文件 - URL: {DownloadUrl}", downloadUrl);

                    try
                    {
                        using var httpClient = new HttpClient();
                        httpClient.Timeout = TimeSpan.FromSeconds(60);
                        
                        var response = await httpClient.GetAsync(downloadUrl);
                        if (!response.IsSuccessStatusCode)
                        {
                            _logger.LogWarning("Google Drive 下載失敗，狀態碼: {StatusCode}", response.StatusCode);
                            return BadRequest(new { success = false, message = "無法從 Google Drive 下載 Excel 文件，請確保文件是公開的或有適當的權限" });
                        }

                        var fileBytes = await response.Content.ReadAsByteArrayAsync();
                        
                        // 將文件保存到臨時位置
                        var tempFilePath = Path.GetTempFileName() + ".xlsx";
                        await System.IO.File.WriteAllBytesAsync(tempFilePath, fileBytes);

                        try
                        {
                            // 使用現有的 Excel 解析邏輯
                            var excelResult = ParseExcelFileInternal(tempFilePath, config.SheetName ?? "Sheet1");
                            data = excelResult.data;
                            columns = excelResult.columns;
                        }
                        finally
                        {
                            // 清理臨時文件
                            if (System.IO.File.Exists(tempFilePath))
                            {
                                System.IO.File.Delete(tempFilePath);
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "從 Google Drive 讀取 Excel 文件失敗");
                        return BadRequest(new { success = false, message = "讀取 Google Drive Excel 文件失敗: " + ex.Message });
                    }
                }
                else
                {
                    // 對於原生 Google Sheets，使用 Google Sheets API v4 直接獲取值
                    // 這樣可以避免 CSV 導出時的科學記數法轉換問題
                    var parseResult = await GetGoogleSheetsDataDirectlyAsync(spreadsheetId, config.SheetName);
                    if (parseResult.success)
                    {
                        data = parseResult.data;
                        columns = parseResult.columns;
                    }
                    else
                    {
                        return BadRequest(new { success = false, message = parseResult.errorMessage });
                    }
                }

                _logger.LogInformation("Google 文件數據載入成功 - 行數: {RowCount}, 列數: {ColumnCount}", data.Count, columns.Count);

                return Ok(new
                {
                    success = true,
                    data = data,
                    columns = columns,
                    message = $"成功載入 {data.Count} 行數據"
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Google Docs 數據載入失敗 - URL: {Url}", config.Url);
                return BadRequest(new { success = false, message = "Google Docs 數據載入失敗: " + ex.Message });
            }
        }

        /// <summary>
        /// 上傳 Excel 文件並獲取工作表列表
        /// </summary>
        [HttpPost("upload-excel")]
        public async Task<IActionResult> UploadExcelFile(IFormFile file)
        {
            try
            {
                if (file == null || file.Length == 0)
                    return BadRequest(new { success = false, message = "請選擇要上傳的文件" });

                var allowedExtensions = new[] { ".xlsx", ".xls", ".csv" };
                var fileExtension = Path.GetExtension(file.FileName).ToLowerInvariant();
                
                if (!allowedExtensions.Contains(fileExtension))
                    return BadRequest(new { success = false, message = "不支持的文件格式，請上傳 .xlsx、.xls 或 .csv 文件" });

                // 創建上傳目錄
                var uploadDir = Path.Combine(Directory.GetCurrentDirectory(), "Uploads", "Excel");
                if (!Directory.Exists(uploadDir))
                    Directory.CreateDirectory(uploadDir);

                // 生成唯一文件名
                var fileName = $"{Guid.NewGuid()}{fileExtension}";
                var filePath = Path.Combine(uploadDir, fileName);

                // 保存文件
                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }

                var sheets = new List<string>();

                if (fileExtension == ".csv")
                {
                    // CSV 文件只有一個工作表
                    sheets.Add("CSV");
                }
                else
                {
                    // 獲取 Excel 文件中的工作表列表
                    using var fileStream = System.IO.File.OpenRead(filePath);
                    using var spreadsheetDocument = SpreadsheetDocument.Open(fileStream, false);
                    
                    var workbookPart = spreadsheetDocument.WorkbookPart;
                    if (workbookPart?.Workbook?.Sheets != null)
                    {
                        foreach (Sheet sheet in workbookPart.Workbook.Sheets)
                        {
                            if (!string.IsNullOrEmpty(sheet.Name))
                                sheets.Add(sheet.Name);
                        }
                    }
                }

                _logger.LogInformation("Excel 文件上傳成功 - 文件名: {FileName}, 工作表數量: {SheetCount}", 
                    file.FileName, sheets.Count);

                return Ok(new { 
                    success = true, 
                    filePath = filePath,
                    sheets = sheets,
                    message = "文件上傳成功"
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Excel 文件上傳失敗");
                return BadRequest(new { success = false, message = "文件上傳失敗: " + ex.Message });
            }
        }

        /// <summary>
        /// 解析 Excel 文件
        /// </summary>
        [HttpPost("parse-excel")]
        public async Task<IActionResult> ParseExcelFile(IFormFile file)
        {
            try
            {
                if (file == null || file.Length == 0)
                    return BadRequest("請選擇要上傳的文件");

                var allowedExtensions = new[] { ".xlsx", ".xls", ".csv" };
                var fileExtension = Path.GetExtension(file.FileName).ToLowerInvariant();
                
                if (!allowedExtensions.Contains(fileExtension))
                    return BadRequest("不支持的文件格式，請上傳 .xlsx、.xls 或 .csv 文件");

                using var stream = file.OpenReadStream();
                var data = new List<Dictionary<string, object>>();
                var columns = new List<string>();

                if (fileExtension == ".csv")
                {
                    // 解析 CSV 文件
                    using var reader = new StreamReader(stream);
                    var csvContent = await reader.ReadToEndAsync();
                    var lines = csvContent.Split('\n', StringSplitOptions.RemoveEmptyEntries);
                    
                    if (lines.Length > 0)
                    {
                        // 第一行作為列名
                        columns = lines[0].Split(',').Select(c => c.Trim().Trim('"')).ToList();
                        
                        // 解析數據行
                        for (int i = 1; i < lines.Length; i++)
                        {
                            var values = lines[i].Split(',').Select(v => v.Trim().Trim('"')).ToArray();
                            var row = new Dictionary<string, object>();
                            
                            for (int j = 0; j < Math.Min(columns.Count, values.Length); j++)
                            {
                                row[columns[j]] = values[j];
                            }
                            data.Add(row);
                        }
                    }
                }
                else
                {
                    // 解析 Excel 文件 - 使用 DocumentFormat.OpenXml
                    using var spreadsheetDocument = SpreadsheetDocument.Open(stream, false);
                    
                    var workbookPart = spreadsheetDocument.WorkbookPart;
                    var worksheetPart = workbookPart?.WorksheetParts.FirstOrDefault();
                    
                    if (worksheetPart == null)
                        return BadRequest(new { success = false, message = "無法讀取 Excel 文件" });

                    var worksheet = worksheetPart.Worksheet;
                    var sheetData = worksheet.GetFirstChild<SheetData>();
                    
                    if (sheetData == null)
                        return BadRequest(new { success = false, message = "Excel 文件為空或無數據" });

                    var rows = sheetData.Elements<Row>().ToList();
                    if (rows.Count == 0)
                        return BadRequest(new { success = false, message = "Excel 文件為空或無數據" });

                    // 讀取標題行（第一行）
                    var headerRow = rows.FirstOrDefault();
                    if (headerRow != null)
                    {
                        var cells = headerRow.Elements<Cell>().ToList();
                        foreach (var cell in cells)
                        {
                            var cellValue = GetCellValue(cell, workbookPart);
                            if (!string.IsNullOrEmpty(cellValue))
                                columns.Add(cellValue);
                        }
                    }

                    // 讀取數據行（從第二行開始）
                    for (int i = 1; i < rows.Count; i++)
                    {
                        var row = rows[i];
                        var cells = row.Elements<Cell>().ToList();
                        var rowData = new Dictionary<string, object>();
                        
                        for (int j = 0; j < Math.Min(columns.Count, cells.Count); j++)
                        {
                            var cellValue = GetCellValue(cells[j], workbookPart);
                            rowData[columns[j]] = cellValue ?? "";
                        }
                        
                        data.Add(rowData);
                    }
                }

                _logger.LogInformation("Excel 文件解析成功 - 文件名: {FileName}, 行數: {RowCount}, 列數: {ColumnCount}", 
                    file.FileName, data.Count, columns.Count);

                return Ok(new { 
                    success = true, 
                    data = data,
                    columns = columns
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Excel 文件解析失敗");
                return BadRequest(new { success = false, message = "文件解析失敗: " + ex.Message });
            }
        }

        #region Contact Import Schedule API

        /// <summary>
        /// 創建聯絡人匯入排程
        /// </summary>
        [HttpPost("schedule")]
        public async Task<IActionResult> CreateSchedule([FromBody] CreateScheduleRequest request)
        {
            try
            {
                _logger.LogInformation("📥 收到創建聯絡人匯入排程請求");
                _logger.LogInformation($"📋 排程名稱: {request?.Name}");
                _logger.LogInformation($"📋 匯入類型: {request?.ImportType}");
                
                var companyId = GetCurrentCompanyId();
                if (companyId == Guid.Empty)
                    return Unauthorized("無法識別公司資訊");

                var userId = GetCurrentUserId();
                
                _logger.LogInformation($"👤 公司ID: {companyId}, 用戶ID: {userId}");

                // 檢查排程名稱是否已存在
                var existingSchedule = await _context.ContactImportSchedules
                    .FirstOrDefaultAsync(s => s.CompanyId == companyId && s.Name == request.Name);
                
                if (existingSchedule != null)
                {
                    _logger.LogWarning($"⚠️ 排程名稱已存在: {request.Name}");
                    return BadRequest(new { success = false, message = "排程名稱已存在，請使用其他名稱" });
                }

                var schedule = new ContactImportSchedule
                {
                    Id = Guid.NewGuid(),
                    CompanyId = companyId,
                    Name = request.Name,
                    ImportType = request.ImportType,
                    IsScheduled = request.IsScheduled,
                    ScheduleType = request.ScheduleType,
                    IntervalMinutes = request.IntervalMinutes,
                    ScheduleCron = request.ScheduleCron,
                    SourceConfig = JsonSerializer.Serialize(request.SourceConfig),
                    FieldMapping = JsonSerializer.Serialize(request.FieldMapping),
                    AllowUpdateDuplicates = request.AllowUpdateDuplicates,
                    BroadcastGroupId = request.BroadcastGroupId,
                    Status = "Active",
                    IsActive = true,
                    CreatedBy = userId,
                    UpdatedBy = userId
                };
                
                // 計算第一次執行時間
                if (request.IsScheduled && request.ScheduleType == "interval" && request.IntervalMinutes.HasValue)
                {
                    schedule.NextRunAt = DateTime.UtcNow.AddMinutes(request.IntervalMinutes.Value);
                }

                _logger.LogInformation($"✅ 準備保存排程: {schedule.Name}, ID: {schedule.Id}");
                
                _context.ContactImportSchedules.Add(schedule);
                await _context.SaveChangesAsync();
                
                _logger.LogInformation($"🎉 排程創建成功: {schedule.Id}");

                return Ok(new { success = true, scheduleId = schedule.Id });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "創建聯絡人匯入排程失敗");
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        /// <summary>
        /// 獲取聯絡人匯入排程列表
        /// </summary>
        [HttpGet("schedule")]
        public async Task<IActionResult> GetSchedules()
        {
            try
            {
                var companyId = GetCurrentCompanyId();
                if (companyId == Guid.Empty)
                    return Unauthorized("無法識別公司資訊");

                var schedulesList = await _context.ContactImportSchedules
                    .Where(s => s.CompanyId == companyId)
                    .OrderByDescending(s => s.CreatedAt)
                    .ToListAsync();

                var schedules = schedulesList.Select(s => new
                {
                    Id = s.Id,
                    Name = s.Name,
                    ImportType = s.ImportType,
                    IsScheduled = s.IsScheduled,
                    ScheduleType = s.ScheduleType,
                    IntervalMinutes = s.IntervalMinutes,
                    ScheduleCron = s.ScheduleCron,
                    LastRunAt = s.LastRunAt,
                    NextRunAt = s.NextRunAt,
                    Status = s.Status,
                    IsActive = s.IsActive,
                    SourceConfig = s.SourceConfig,
                    FieldMapping = s.FieldMapping,
                    AllowUpdateDuplicates = s.AllowUpdateDuplicates,
                    BroadcastGroupId = s.BroadcastGroupId,
                    CreatedAt = s.CreatedAt,
                    UpdatedAt = s.UpdatedAt
                }).ToList();

                _logger.LogInformation("返回排程列表，共 {Count} 條記錄", schedules.Count);
                foreach (var s in schedules)
                {
                    _logger.LogInformation("排程 {Name}: SourceConfig={SourceConfig}, FieldMapping={FieldMapping}", 
                        s.Name, s.SourceConfig?.Substring(0, Math.Min(100, s.SourceConfig?.Length ?? 0)), 
                        s.FieldMapping?.Substring(0, Math.Min(100, s.FieldMapping?.Length ?? 0)));
                }

                return Ok(new { success = true, schedules });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "獲取聯絡人匯入排程列表失敗");
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        /// <summary>
        /// 更新聯絡人匯入排程
        /// </summary>
        [HttpPut("schedule/{id}")]
        public async Task<IActionResult> UpdateSchedule(Guid id, [FromBody] UpdateScheduleRequest request)
        {
            try
            {
                _logger.LogInformation("=== 開始更新排程 ===");
                _logger.LogInformation("排程ID: {ScheduleId}", id);
                
                // 檢查模型狀態
                if (!ModelState.IsValid)
                {
                    _logger.LogError("模型驗證失敗");
                    foreach (var error in ModelState)
                    {
                        _logger.LogError("字段: {Key}, 錯誤: {Errors}", 
                            error.Key, 
                            string.Join(", ", error.Value.Errors.Select(e => e.ErrorMessage)));
                    }
                    return BadRequest(new { success = false, message = "請求數據驗證失敗", errors = ModelState });
                }
                
                // 記錄請求數據
                _logger.LogInformation("請求數據 - Name: {Name}", request?.Name ?? "NULL");
                _logger.LogInformation("請求數據 - IsScheduled: {IsScheduled}", request?.IsScheduled);
                _logger.LogInformation("請求數據 - ScheduleType: {ScheduleType}", request?.ScheduleType ?? "NULL");
                _logger.LogInformation("請求數據 - IntervalMinutes: {IntervalMinutes}", request?.IntervalMinutes);
                _logger.LogInformation("請求數據 - ScheduleCron: {ScheduleCron}", request?.ScheduleCron ?? "NULL");
                _logger.LogInformation("請求數據 - AllowUpdateDuplicates: {AllowUpdateDuplicates}", request?.AllowUpdateDuplicates);
                _logger.LogInformation("請求數據 - BroadcastGroupId: {BroadcastGroupId}", request?.BroadcastGroupId);
                
                if (request?.SourceConfig != null)
                {
                    try
                    {
                        var sourceConfigJson = JsonSerializer.Serialize(request.SourceConfig);
                        _logger.LogInformation("請求數據 - SourceConfig: {SourceConfig}", sourceConfigJson);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning("序列化 SourceConfig 失敗: {Error}", ex.Message);
                    }
                }
                else
                {
                    _logger.LogWarning("請求數據 - SourceConfig 為 NULL");
                }
                
                if (request?.FieldMapping != null)
                {
                    try
                    {
                        var fieldMappingJson = JsonSerializer.Serialize(request.FieldMapping);
                        _logger.LogInformation("請求數據 - FieldMapping: {FieldMapping}", fieldMappingJson);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning("序列化 FieldMapping 失敗: {Error}", ex.Message);
                    }
                }
                else
                {
                    _logger.LogWarning("請求數據 - FieldMapping 為 NULL");
                }
                
                // 驗證請求數據
                if (request == null)
                {
                    _logger.LogError("請求數據為 NULL");
                    return BadRequest(new { success = false, message = "請求數據不能為空" });
                }
                
                if (string.IsNullOrWhiteSpace(request.Name))
                {
                    _logger.LogError("排程名稱不能為空");
                    return BadRequest(new { success = false, message = "排程名稱不能為空" });
                }

                var companyId = GetCurrentCompanyId();
                _logger.LogInformation("公司ID: {CompanyId}", companyId);
                
                if (companyId == Guid.Empty)
                {
                    _logger.LogError("無法識別公司資訊");
                    return Unauthorized("無法識別公司資訊");
                }

                var schedule = await _context.ContactImportSchedules
                    .FirstOrDefaultAsync(s => s.Id == id && s.CompanyId == companyId);

                if (schedule == null)
                {
                    _logger.LogError("排程不存在 - ID: {ScheduleId}, 公司ID: {CompanyId}", id, companyId);
                    return NotFound(new { success = false, message = "排程不存在" });
                }
                
                _logger.LogInformation("找到排程 - 名稱: {ScheduleName}, 狀態: {Status}, 是否啟用: {IsActive}", 
                    schedule.Name, schedule.Status, schedule.IsActive);

                // 檢查新名稱是否與現有排程重複（排除當前排程）
                if (schedule.Name != request.Name)
                {
                    _logger.LogInformation("檢查排程名稱是否重複 - 新名稱: {NewName}", request.Name);
                    var existingSchedule = await _context.ContactImportSchedules
                        .FirstOrDefaultAsync(s => s.CompanyId == companyId && s.Name == request.Name && s.Id != id);
                    
                    if (existingSchedule != null)
                    {
                        _logger.LogWarning("排程名稱已存在 - 名稱: {Name}", request.Name);
                        return BadRequest(new { success = false, message = "排程名稱已存在，請使用其他名稱" });
                    }
                }

                _logger.LogInformation("開始更新排程字段");
                schedule.Name = request.Name;
                schedule.IsScheduled = request.IsScheduled;
                schedule.ScheduleType = request.ScheduleType;
                schedule.IntervalMinutes = request.IntervalMinutes;
                schedule.ScheduleCron = request.ScheduleCron;
                
                // 序列化 SourceConfig
                try
                {
                    if (request.SourceConfig != null)
                    {
                        schedule.SourceConfig = JsonSerializer.Serialize(request.SourceConfig);
                        _logger.LogInformation("SourceConfig 序列化成功");
                    }
                    else
                    {
                        schedule.SourceConfig = null;
                        _logger.LogInformation("SourceConfig 為 NULL，設置為 null");
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "序列化 SourceConfig 失敗");
                    return BadRequest(new { success = false, message = $"序列化 SourceConfig 失敗: {ex.Message}" });
                }
                
                // 序列化 FieldMapping
                try
                {
                    if (request.FieldMapping != null)
                    {
                        schedule.FieldMapping = JsonSerializer.Serialize(request.FieldMapping);
                        _logger.LogInformation("FieldMapping 序列化成功");
                    }
                    else
                    {
                        schedule.FieldMapping = null;
                        _logger.LogInformation("FieldMapping 為 NULL，設置為 null");
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "序列化 FieldMapping 失敗");
                    return BadRequest(new { success = false, message = $"序列化 FieldMapping 失敗: {ex.Message}" });
                }
                
                schedule.AllowUpdateDuplicates = request.AllowUpdateDuplicates;
                schedule.BroadcastGroupId = request.BroadcastGroupId;
                schedule.UpdatedAt = DateTime.UtcNow;
                schedule.UpdatedBy = GetCurrentUserId();
                
                _logger.LogInformation("準備保存到數據庫");
                await _context.SaveChangesAsync();
                _logger.LogInformation("✅ 排程更新成功");

                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "更新聯絡人匯入排程失敗 - 異常詳情");
                _logger.LogError("異常類型: {ExceptionType}", ex.GetType().Name);
                _logger.LogError("異常訊息: {Message}", ex.Message);
                _logger.LogError("堆疊追蹤: {StackTrace}", ex.StackTrace);
                if (ex.InnerException != null)
                {
                    _logger.LogError("內部異常: {InnerException}", ex.InnerException.Message);
                }
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        /// <summary>
        /// 刪除聯絡人匯入排程
        /// </summary>
        [HttpDelete("schedule/{id}")]
        public async Task<IActionResult> DeleteSchedule(Guid id)
        {
            try
            {
                var companyId = GetCurrentCompanyId();
                if (companyId == Guid.Empty)
                    return Unauthorized("無法識別公司資訊");

                var schedule = await _context.ContactImportSchedules
                    .FirstOrDefaultAsync(s => s.Id == id && s.CompanyId == companyId);

                if (schedule == null)
                    return NotFound(new { success = false, message = "排程不存在" });

                _context.ContactImportSchedules.Remove(schedule);
                await _context.SaveChangesAsync();

                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "刪除聯絡人匯入排程失敗");
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        /// <summary>
        /// 更新聯絡人匯入排程狀態
        /// </summary>
        [HttpPut("schedule/{id}/status")]
        public async Task<IActionResult> UpdateScheduleStatus(Guid id, [FromBody] UpdateStatusRequest request)
        {
            try
            {
                _logger.LogInformation("=== 開始更新排程狀態 ===");
                _logger.LogInformation("排程ID: {ScheduleId}", id);
                
                // 檢查模型狀態
                if (!ModelState.IsValid)
                {
                    _logger.LogError("模型驗證失敗");
                    foreach (var error in ModelState)
                    {
                        _logger.LogError("字段: {Key}, 錯誤: {Errors}", 
                            error.Key, 
                            string.Join(", ", error.Value.Errors.Select(e => e.ErrorMessage)));
                    }
                    return BadRequest(new { success = false, message = "請求數據驗證失敗", errors = ModelState });
                }
                
                // 記錄請求數據
                _logger.LogInformation("請求數據 - Status: {Status}", request?.Status ?? "NULL");
                _logger.LogInformation("請求數據 - IsActive: {IsActive}", request?.IsActive);
                
                // 驗證請求數據
                if (request == null)
                {
                    _logger.LogError("請求數據為 NULL");
                    return BadRequest(new { success = false, message = "請求數據不能為空" });
                }

                var companyId = GetCurrentCompanyId();
                _logger.LogInformation("公司ID: {CompanyId}", companyId);
                
                if (companyId == Guid.Empty)
                {
                    _logger.LogError("無法識別公司資訊");
                    return Unauthorized("無法識別公司資訊");
                }

                var schedule = await _context.ContactImportSchedules
                    .FirstOrDefaultAsync(s => s.Id == id && s.CompanyId == companyId);

                if (schedule == null)
                {
                    _logger.LogError("排程不存在 - ID: {ScheduleId}, 公司ID: {CompanyId}", id, companyId);
                    return NotFound(new { success = false, message = "排程不存在" });
                }
                
                _logger.LogInformation("找到排程 - 名稱: {ScheduleName}, 當前狀態: {CurrentStatus}, 當前是否啟用: {CurrentIsActive}", 
                    schedule.Name, schedule.Status, schedule.IsActive);

                if (!string.IsNullOrEmpty(request.Status))
                {
                    _logger.LogInformation("更新狀態: {OldStatus} -> {NewStatus}", schedule.Status, request.Status);
                    schedule.Status = request.Status;
                }
                
                if (request.IsActive.HasValue)
                {
                    _logger.LogInformation("更新啟用狀態: {OldIsActive} -> {NewIsActive}", schedule.IsActive, request.IsActive.Value);
                    schedule.IsActive = request.IsActive.Value;
                }

                schedule.UpdatedAt = DateTime.UtcNow;
                schedule.UpdatedBy = GetCurrentUserId();

                _logger.LogInformation("準備保存到數據庫");
                await _context.SaveChangesAsync();
                _logger.LogInformation("✅ 排程狀態更新成功");

                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "更新聯絡人匯入排程狀態失敗 - 異常詳情");
                _logger.LogError("異常類型: {ExceptionType}", ex.GetType().Name);
                _logger.LogError("異常訊息: {Message}", ex.Message);
                _logger.LogError("堆疊追蹤: {StackTrace}", ex.StackTrace);
                if (ex.InnerException != null)
                {
                    _logger.LogError("內部異常: {InnerException}", ex.InnerException.Message);
                }
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        /// <summary>
        /// 獲取聯絡人匯入執行記錄
        /// </summary>
        [HttpGet("schedule/{id}/executions")]
        public async Task<IActionResult> GetScheduleExecutions(Guid id)
        {
            try
            {
                var companyId = GetCurrentCompanyId();
                if (companyId == Guid.Empty)
                    return Unauthorized("無法識別公司資訊");

                var executions = await _context.ContactImportExecutions
                    .Where(e => e.ScheduleId == id && e.CompanyId == companyId)
                    .OrderByDescending(e => e.StartedAt)
                    .Select(e => new
                    {
                        e.Id,
                        e.Status,
                        e.TotalRecords,
                        e.SuccessCount,
                        e.FailedCount,
                        e.ErrorMessage,
                        e.StartedAt,
                        e.CompletedAt
                    })
                    .Take(50)
                    .ToListAsync();

                return Ok(new { success = true, executions });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "獲取聯絡人匯入執行記錄失敗");
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        /// <summary>
        /// 手動執行聯絡人匯入排程
        /// </summary>
        [HttpPost("schedule/{id}/execute")]
        public async Task<IActionResult> ExecuteSchedule(Guid id)
        {
            try
            {
                _logger.LogInformation("=== 開始手動執行聯絡人匯入排程 ===");
                _logger.LogInformation("排程ID: {ScheduleId}", id);

                var companyId = GetCurrentCompanyId();
                if (companyId == Guid.Empty)
                {
                    _logger.LogError("無法識別公司資訊");
                    return Unauthorized("無法識別公司資訊");
                }

                var schedule = await _context.ContactImportSchedules
                    .FirstOrDefaultAsync(s => s.Id == id && s.CompanyId == companyId);

                if (schedule == null)
                {
                    _logger.LogError("排程不存在 - ID: {ScheduleId}, 公司ID: {CompanyId}", id, companyId);
                    return NotFound(new { success = false, message = "排程不存在" });
                }

                _logger.LogInformation("找到排程 - 名稱: {ScheduleName}, 匯入類型: {ImportType}", 
                    schedule.Name, schedule.ImportType);

                // 創建執行記錄
                var execution = new ContactImportExecution
                {
                    Id = Guid.NewGuid(),
                    ScheduleId = schedule.Id,
                    CompanyId = schedule.CompanyId,
                    Status = "Running",
                    TotalRecords = 0,
                    SuccessCount = 0,
                    FailedCount = 0,
                    StartedAt = DateTime.UtcNow
                };

                _context.ContactImportExecutions.Add(execution);
                await _context.SaveChangesAsync();

                try
                {
                    // 解析配置
                    Dictionary<string, object> sourceConfig = null;
                    Dictionary<string, string> fieldMapping = null;

                    try
                    {
                        if (!string.IsNullOrEmpty(schedule.SourceConfig))
                        {
                            sourceConfig = JsonSerializer.Deserialize<Dictionary<string, object>>(schedule.SourceConfig);
                        }
                        if (!string.IsNullOrEmpty(schedule.FieldMapping))
                        {
                            fieldMapping = JsonSerializer.Deserialize<Dictionary<string, string>>(schedule.FieldMapping);
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "解析排程配置失敗");
                        throw new Exception($"解析排程配置失敗: {ex.Message}");
                    }

                    if (sourceConfig == null || fieldMapping == null)
                    {
                        throw new Exception("排程配置不完整");
                    }

                    // 根據匯入類型載入數據
                    List<Dictionary<string, object>> data = null;
                    List<string> columns = null;

                    if (schedule.ImportType == "excel")
                    {
                        var excelConfig = new ExcelConfig
                        {
                            FilePath = sourceConfig.ContainsKey("filePath") ? sourceConfig["filePath"]?.ToString() : null,
                            SheetName = sourceConfig.ContainsKey("sheetName") ? sourceConfig["sheetName"]?.ToString() : null
                        };
                        var result = await LoadFromExcelInternalAsync(excelConfig);
                        data = result.data;
                        columns = result.columns;
                    }
                    else if (schedule.ImportType == "google")
                    {
                        var googleConfig = new GoogleDocsConfig
                        {
                            Url = sourceConfig.ContainsKey("url") ? sourceConfig["url"]?.ToString() : null,
                            SheetName = sourceConfig.ContainsKey("sheetName") ? sourceConfig["sheetName"]?.ToString() : null
                        };
                        var result = await LoadFromGoogleDocsInternalAsync(googleConfig);
                        data = result.data;
                        columns = result.columns;
                    }
                    else if (schedule.ImportType == "sql")
                    {
                        var sqlConfig = new SqlConnectionConfig
                        {
                            Server = sourceConfig.ContainsKey("server") ? sourceConfig["server"]?.ToString() : null,
                            Database = sourceConfig.ContainsKey("database") ? sourceConfig["database"]?.ToString() : null,
                            Username = sourceConfig.ContainsKey("username") ? sourceConfig["username"]?.ToString() : null,
                            Password = sourceConfig.ContainsKey("password") ? sourceConfig["password"]?.ToString() : null,
                            Table = sourceConfig.ContainsKey("table") ? sourceConfig["table"]?.ToString() : null,
                            Query = sourceConfig.ContainsKey("query") ? sourceConfig["query"]?.ToString() : null
                        };
                        var result = await LoadFromSqlInternalAsync(sqlConfig);
                        data = result.data;
                        columns = result.columns;
                    }
                    else
                    {
                        throw new Exception($"不支持的匯入類型: {schedule.ImportType}");
                    }

                    if (data == null || data.Count == 0)
                    {
                        throw new Exception("沒有數據可匯入");
                    }

                    _logger.LogInformation("成功載入 {Count} 筆數據", data.Count);
                    _logger.LogInformation("FieldMapping 內容: {FieldMapping}", JsonSerializer.Serialize(fieldMapping));
                    _logger.LogInformation("Schedule BroadcastGroupId: {BroadcastGroupId}", schedule.BroadcastGroupId);

                    // 準備匯入數據
                    var importData = new List<ContactImportData>();
                    
                    // 獲取 broadcastGroupId（優先從 schedule，其次從 fieldMapping）
                    var broadcastGroupId = schedule.BroadcastGroupId?.ToString();
                    if (string.IsNullOrEmpty(broadcastGroupId) && fieldMapping != null && fieldMapping.ContainsKey("broadcastGroupId"))
                    {
                        broadcastGroupId = fieldMapping["broadcastGroupId"];
                        _logger.LogInformation("從 fieldMapping 獲取 broadcastGroupId: {BroadcastGroupId}", broadcastGroupId);
                    }
                    
                    if (string.IsNullOrEmpty(broadcastGroupId))
                    {
                        _logger.LogWarning("⚠️ 未找到 broadcastGroupId，這可能導致匯入失敗");
                    }
                    
                    foreach (var row in data)
                    {
                        var name = GetMappedValue(row, fieldMapping, "name");
                        var broadcastGroupIdValue = broadcastGroupId;
                        
                        // 如果第一行的 Name 或 BroadcastGroupId 為空，記錄警告
                        if (importData.Count == 0)
                        {
                            _logger.LogInformation("第一行數據映射 - Name: {Name}, BroadcastGroupId: {BroadcastGroupId}", 
                                name, broadcastGroupIdValue);
                            _logger.LogInformation("第一行原始數據鍵: {Keys}", string.Join(", ", row.Keys));
                        }
                        
                        var contact = new ContactImportData
                        {
                            RowNumber = importData.Count + 1,
                            Name = name,
                            Title = GetMappedValue(row, fieldMapping, "title"),
                            Occupation = GetMappedValue(row, fieldMapping, "occupation"),
                            WhatsAppNumber = GetMappedValue(row, fieldMapping, "whatsappNumber"),
                            Email = GetMappedValue(row, fieldMapping, "email"),
                            CompanyName = GetMappedValue(row, fieldMapping, "companyName"),
                            Department = GetMappedValue(row, fieldMapping, "department"),
                            Position = GetMappedValue(row, fieldMapping, "position"),
                            Hashtags = GetMappedValue(row, fieldMapping, "hashtags"),
                            BroadcastGroupId = broadcastGroupIdValue // 使用統一的 broadcastGroupId
                        };
                        importData.Add(contact);
                    }
                    
                    _logger.LogInformation("準備匯入數據完成 - 總數: {Count}, BroadcastGroupId: {BroadcastGroupId}", 
                        importData.Count, broadcastGroupId);

                    // 執行批量創建（復用 BatchCreateContacts 的邏輯）
                    var createdBy = GetCurrentUserId();
                    if (string.IsNullOrEmpty(createdBy))
                    {
                        createdBy = "system";
                    }

                    var results = new List<ContactImportResult>();
                    var successCount = 0;
                    var failedCount = 0;

                    foreach (var contactData in importData)
                    {
                        try
                        {
                            // 驗證必填欄位
                            if (string.IsNullOrEmpty(contactData.Name))
                            {
                                results.Add(new ContactImportResult
                                {
                                    RowNumber = contactData.RowNumber,
                                    Success = false,
                                    ErrorMessage = "姓名為必填欄位"
                                });
                                failedCount++;
                                continue;
                            }

                            if (string.IsNullOrEmpty(contactData.BroadcastGroupId))
                            {
                                results.Add(new ContactImportResult
                                {
                                    RowNumber = contactData.RowNumber,
                                    Success = false,
                                    ErrorMessage = "廣播群組為必填欄位"
                                });
                                failedCount++;
                                continue;
                            }

                            ContactList contact = null;
                            bool isUpdate = false;

                            // 如果允許更新且有 WhatsApp 號碼，檢查是否存在重複
                            if (schedule.AllowUpdateDuplicates && !string.IsNullOrEmpty(contactData.WhatsAppNumber))
                            {
                                var normalizedNumber = NormalizeWhatsAppNumber(contactData.WhatsAppNumber);
                                if (!string.IsNullOrEmpty(normalizedNumber))
                                {
                                    var existingContact = await _contactListService.FindByNormalizedWhatsAppAsync(companyId, normalizedNumber);
                                    if (existingContact != null)
                                    {
                                        contact = new ContactList
                                        {
                                            Id = existingContact.Id,
                                            CompanyId = existingContact.CompanyId,
                                            Name = contactData.Name?.Trim(),
                                            Title = contactData.Title?.Trim(),
                                            Occupation = contactData.Occupation?.Trim(),
                                            WhatsAppNumber = contactData.WhatsAppNumber?.Trim(),
                                            Email = contactData.Email?.Trim(),
                                            CompanyName = contactData.CompanyName?.Trim(),
                                            Department = contactData.Department?.Trim(),
                                            Position = contactData.Position?.Trim(),
                                            Hashtags = contactData.Hashtags?.Trim(),
                                            BroadcastGroupId = Guid.Parse(contactData.BroadcastGroupId),
                                            IsActive = true,
                                            CreatedAt = existingContact.CreatedAt,
                                            CreatedBy = existingContact.CreatedBy,
                                            UpdatedAt = DateTime.UtcNow,
                                            UpdatedBy = createdBy
                                        };
                                        isUpdate = true;
                                    }
                                }
                            }

                            // 如果不是更新，創建新聯絡人
                            if (contact == null)
                            {
                                contact = new ContactList
                                {
                                    Id = Guid.NewGuid(),
                                    CompanyId = companyId,
                                    Name = contactData.Name?.Trim(),
                                    Title = contactData.Title?.Trim(),
                                    Occupation = contactData.Occupation?.Trim(),
                                    WhatsAppNumber = contactData.WhatsAppNumber?.Trim(),
                                    Email = contactData.Email?.Trim(),
                                    CompanyName = contactData.CompanyName?.Trim(),
                                    Department = contactData.Department?.Trim(),
                                    Position = contactData.Position?.Trim(),
                                    Hashtags = contactData.Hashtags?.Trim(),
                                    BroadcastGroupId = Guid.Parse(contactData.BroadcastGroupId),
                                    IsActive = true,
                                    CreatedAt = DateTime.UtcNow,
                                    CreatedBy = createdBy,
                                    UpdatedAt = null,
                                    UpdatedBy = null
                                };
                            }

                            if (isUpdate)
                            {
                                await _contactListService.UpdateContactAsync(contact.Id, contact, createdBy);
                            }
                            else
                            {
                                await _contactListService.CreateContactAsync(contact, createdBy);
                            }
                            
                            results.Add(new ContactImportResult
                            {
                                RowNumber = contactData.RowNumber,
                                Success = true,
                                ContactId = contact.Id
                            });
                            successCount++;
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(ex, "批量創建聯絡人失敗，行號: {RowNumber}", contactData.RowNumber);
                            
                            results.Add(new ContactImportResult
                            {
                                RowNumber = contactData.RowNumber,
                                Success = false,
                                ErrorMessage = ex.Message
                            });
                            failedCount++;
                        }
                    }

                    // 更新執行記錄
                    execution.Status = "Success";
                    execution.TotalRecords = results.Count;
                    execution.SuccessCount = successCount;
                    execution.FailedCount = failedCount;
                    execution.CompletedAt = DateTime.UtcNow;

                    if (execution.FailedCount > 0)
                    {
                        var errors = results
                            .Where(r => !r.Success)
                            .Take(5)
                            .Select(r => $"第{r.RowNumber}行: {r.ErrorMessage}");
                        execution.ErrorMessage = string.Join("; ", errors);
                    }

                    await _context.SaveChangesAsync();

                    _logger.LogInformation("✅ 手動執行聯絡人匯入成功 - 總數: {Total}, 成功: {Success}, 失敗: {Failed}",
                        execution.TotalRecords, execution.SuccessCount, execution.FailedCount);

                    return Ok(new
                    {
                        success = true,
                        message = $"匯入完成：成功 {execution.SuccessCount} 筆，失敗 {execution.FailedCount} 筆",
                        execution = new
                        {
                            execution.Id,
                            execution.Status,
                            execution.TotalRecords,
                            execution.SuccessCount,
                            execution.FailedCount,
                            execution.ErrorMessage,
                            execution.StartedAt,
                            execution.CompletedAt
                        }
                    });
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "執行聯絡人匯入失敗");
                    execution.Status = "Failed";
                    execution.ErrorMessage = ex.Message;
                    execution.CompletedAt = DateTime.UtcNow;
                    await _context.SaveChangesAsync();

                    return BadRequest(new { success = false, message = $"執行匯入失敗: {ex.Message}" });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "手動執行聯絡人匯入排程失敗");
                return BadRequest(new { success = false, message = ex.Message });
            }
        }

        /// <summary>
        /// 獲取映射值
        /// </summary>
        private string GetMappedValue(Dictionary<string, object> row, Dictionary<string, string> fieldMapping, string fieldName)
        {
            if (fieldMapping == null || !fieldMapping.ContainsKey(fieldName))
                return null;

            var sourceField = fieldMapping[fieldName];
            if (string.IsNullOrEmpty(sourceField) || !row.ContainsKey(sourceField))
                return null;

            var value = row[sourceField];
            return value?.ToString() ?? null;
        }

        /// <summary>
        /// 內部載入 Excel 數據（用於執行匯入）- 直接復用 LoadFromExcel 的邏輯
        /// </summary>
        private async Task<(List<Dictionary<string, object>> data, List<string> columns)> LoadFromExcelInternalAsync(ExcelConfig config)
        {
            if (string.IsNullOrEmpty(config.FilePath))
                throw new Exception("請提供 Excel 文件路徑");

            if (!System.IO.File.Exists(config.FilePath))
                throw new Exception("Excel 文件不存在");

            var fileExtension = Path.GetExtension(config.FilePath).ToLowerInvariant();
            var allowedExtensions = new[] { ".xlsx", ".xls", ".csv" };
            
            if (!allowedExtensions.Contains(fileExtension))
                throw new Exception("不支持的文件格式，請使用 .xlsx、.xls 或 .csv 文件");

            var data = new List<Dictionary<string, object>>();
            var columns = new List<string>();

            if (fileExtension == ".csv")
            {
                var lines = await System.IO.File.ReadAllLinesAsync(config.FilePath);
                if (lines.Length == 0)
                    throw new Exception("CSV 文件為空");

                var headers = ParseCsvLine(lines[0]);
                columns.AddRange(headers.Select(h => h.Trim()));

                for (int i = 1; i < lines.Length; i++)
                {
                    var values = ParseCsvLine(lines[i]);
                    var row = new Dictionary<string, object>();
                    
                    for (int j = 0; j < Math.Min(headers.Length, values.Length); j++)
                    {
                        row[headers[j].Trim()] = values[j].Trim();
                    }
                    
                    data.Add(row);
                }
            }
            else
            {
                using var stream = System.IO.File.OpenRead(config.FilePath);
                using var spreadsheetDocument = DocumentFormat.OpenXml.Packaging.SpreadsheetDocument.Open(stream, false);
                
                var workbookPart = spreadsheetDocument.WorkbookPart;
                WorksheetPart worksheetPart = null;
                
                if (!string.IsNullOrEmpty(config.SheetName) && workbookPart?.Workbook?.Sheets != null)
                {
                    var sheet = workbookPart.Workbook.Sheets.Elements<Sheet>()
                        .FirstOrDefault(s => s.Name == config.SheetName);
                    
                    if (sheet != null)
                    {
                        worksheetPart = (WorksheetPart)workbookPart.GetPartById(sheet.Id);
                    }
                }
                
                if (worksheetPart == null)
                {
                    worksheetPart = workbookPart?.WorksheetParts.FirstOrDefault();
                }
                
                if (worksheetPart == null)
                    throw new Exception("無法讀取 Excel 文件或找不到指定工作表");

                var worksheet = worksheetPart.Worksheet;
                var sheetData = worksheet.GetFirstChild<DocumentFormat.OpenXml.Spreadsheet.SheetData>();
                
                if (sheetData == null)
                    throw new Exception("Excel 文件為空或無數據");

                var rows = sheetData.Elements<DocumentFormat.OpenXml.Spreadsheet.Row>().ToList();
                if (rows.Count == 0)
                    throw new Exception("Excel 文件為空或無數據");

                var headerRow = rows.FirstOrDefault();
                if (headerRow != null)
                {
                    var cells = headerRow.Elements<DocumentFormat.OpenXml.Spreadsheet.Cell>().ToList();
                    foreach (var cell in cells)
                    {
                        var cellValue = GetCellValue(cell, workbookPart);
                        if (!string.IsNullOrEmpty(cellValue))
                            columns.Add(cellValue);
                    }
                }

                for (int i = 1; i < rows.Count; i++)
                {
                    var row = rows[i];
                    var cells = row.Elements<DocumentFormat.OpenXml.Spreadsheet.Cell>().ToList();
                    var rowData = new Dictionary<string, object>();
                    
                    for (int j = 0; j < Math.Min(columns.Count, cells.Count); j++)
                    {
                        var cellValue = GetCellValue(cells[j], workbookPart);
                        rowData[columns[j]] = cellValue ?? "";
                    }
                    
                    data.Add(rowData);
                }
            }

            return (data, columns);
        }

        /// <summary>
        /// 內部載入 Google Docs 數據（用於執行匯入）- 直接復用 LoadFromGoogleDocs 的邏輯
        /// </summary>
        private async Task<(List<Dictionary<string, object>> data, List<string> columns)> LoadFromGoogleDocsInternalAsync(GoogleDocsConfig config)
        {
            if (string.IsNullOrEmpty(config.Url))
                throw new Exception("請提供 Google Docs URL");

            var spreadsheetId = ExtractSpreadsheetIdFromUrl(config.Url);
            if (string.IsNullOrEmpty(spreadsheetId))
                throw new Exception("無效的 Google Sheets URL");

            var fileType = await DetectGoogleFileTypeAsync(spreadsheetId);
            var data = new List<Dictionary<string, object>>();
            var columns = new List<string>();

            if (fileType == "excel")
            {
                var downloadUrl = $"https://drive.google.com/uc?id={spreadsheetId}&export=download";
                using var httpClient = new HttpClient();
                httpClient.Timeout = TimeSpan.FromSeconds(30);
                
                var response = await httpClient.GetAsync(downloadUrl);
                if (!response.IsSuccessStatusCode)
                    throw new Exception("無法從 Google Drive 下載 Excel 文件");

                using var stream = await response.Content.ReadAsStreamAsync();
                using var spreadsheetDocument = DocumentFormat.OpenXml.Packaging.SpreadsheetDocument.Open(stream, false);
                
                var workbookPart = spreadsheetDocument.WorkbookPart;
                var worksheetPart = workbookPart?.WorksheetParts.FirstOrDefault();
                
                if (worksheetPart == null)
                    throw new Exception("無法讀取 Excel 文件");

                var (dataResult, columnsResult) = await ParseExcelWorksheetAsync(worksheetPart, workbookPart);
                data = dataResult;
                columns = columnsResult;
            }
            else
            {
                var apiKey = _configuration["GoogleApiKey"];
                if (string.IsNullOrEmpty(apiKey))
                    throw new Exception("Google API 金鑰未配置");

                var sheetName = config.SheetName ?? "Sheet1";
                var range = $"{sheetName}!A1:ZZ10000";
                var apiUrl = $"https://sheets.googleapis.com/v4/spreadsheets/{spreadsheetId}/values/{range}?key={apiKey}";
                
                using var httpClient = new HttpClient();
                httpClient.Timeout = TimeSpan.FromSeconds(30);
                
                var response = await httpClient.GetAsync(apiUrl);
                var responseContent = await response.Content.ReadAsStringAsync();
                
                if (!response.IsSuccessStatusCode)
                    throw new Exception($"Google Sheets API 調用失敗: {responseContent}");

                var jsonDoc = System.Text.Json.JsonDocument.Parse(responseContent);
                if (jsonDoc.RootElement.TryGetProperty("values", out var valuesArray))
                {
                    var rows = valuesArray.EnumerateArray().ToList();
                    if (rows.Count > 0)
                    {
                        var headerRow = rows[0];
                        foreach (var cell in headerRow.EnumerateArray())
                        {
                            columns.Add(cell.GetString() ?? "");
                        }

                        for (int i = 1; i < rows.Count; i++)
                        {
                            var row = rows[i];
                            var rowData = new Dictionary<string, object>();
                            var cells = row.EnumerateArray().ToList();
                            
                            for (int j = 0; j < Math.Min(columns.Count, cells.Count); j++)
                            {
                                rowData[columns[j]] = cells[j].GetString() ?? "";
                            }
                            
                            data.Add(rowData);
                        }
                    }
                }
            }

            return (data, columns);
        }

        /// <summary>
        /// 解析 Excel 工作表
        /// </summary>
        private async Task<(List<Dictionary<string, object>> data, List<string> columns)> ParseExcelWorksheetAsync(
            WorksheetPart worksheetPart, 
            WorkbookPart workbookPart)
        {
            var data = new List<Dictionary<string, object>>();
            var columns = new List<string>();

            var worksheet = worksheetPart.Worksheet;
            var sheetData = worksheet.GetFirstChild<DocumentFormat.OpenXml.Spreadsheet.SheetData>();
            
            if (sheetData == null)
                return (data, columns);

            var rows = sheetData.Elements<DocumentFormat.OpenXml.Spreadsheet.Row>().ToList();
            if (rows.Count == 0)
                return (data, columns);

            var headerRow = rows.FirstOrDefault();
            if (headerRow != null)
            {
                var cells = headerRow.Elements<DocumentFormat.OpenXml.Spreadsheet.Cell>().ToList();
                foreach (var cell in cells)
                {
                    var cellValue = GetCellValue(cell, workbookPart);
                    if (!string.IsNullOrEmpty(cellValue))
                        columns.Add(cellValue);
                }
            }

            for (int i = 1; i < rows.Count; i++)
            {
                var row = rows[i];
                var cells = row.Elements<DocumentFormat.OpenXml.Spreadsheet.Cell>().ToList();
                var rowData = new Dictionary<string, object>();
                
                for (int j = 0; j < Math.Min(columns.Count, cells.Count); j++)
                {
                    var cellValue = GetCellValue(cells[j], workbookPart);
                    rowData[columns[j]] = cellValue ?? "";
                }
                
                data.Add(rowData);
            }

            return (data, columns);
        }

        /// <summary>
        /// 內部載入 SQL 數據（用於執行匯入）- 直接復用 LoadFromSql 的邏輯
        /// </summary>
        private async Task<(List<Dictionary<string, object>> data, List<string> columns)> LoadFromSqlInternalAsync(SqlConnectionConfig config)
        {
            var connectionString = $"Server={config.Server};Database={config.Database};User Id={config.Username};Password={config.Password};TrustServerCertificate=true;";
            
            using var connection = new Microsoft.Data.SqlClient.SqlConnection(connectionString);
            await connection.OpenAsync();
            
            string query;
            if (!string.IsNullOrEmpty(config.Query))
            {
                query = config.Query;
            }
            else if (!string.IsNullOrEmpty(config.Table))
            {
                query = $"SELECT * FROM {config.Table}";
            }
            else
            {
                throw new Exception("請提供表名或自定義查詢");
            }
            
            using var command = new Microsoft.Data.SqlClient.SqlCommand(query, connection);
            using var reader = await command.ExecuteReaderAsync();
            
            var data = new List<Dictionary<string, object>>();
            var columns = new List<string>();
            
            for (int i = 0; i < reader.FieldCount; i++)
            {
                columns.Add(reader.GetName(i));
            }
            
            while (await reader.ReadAsync())
            {
                var row = new Dictionary<string, object>();
                for (int i = 0; i < reader.FieldCount; i++)
                {
                    var columnName = reader.GetName(i);
                    var value = reader.IsDBNull(i) ? null : reader.GetValue(i);
                    row[columnName] = value;
                }
                data.Add(row);
            }
            
            return (data, columns);
        }

        #endregion
    }

    /// <summary>
    /// 批量創建聯絡人請求
    /// </summary>
    public class BatchCreateContactsRequest
    {
        public IEnumerable<ContactImportData> Contacts { get; set; }
        public bool AllowUpdate { get; set; } = false;
    }

    /// <summary>
    /// 聯絡人匯入數據
    /// </summary>
    public class ContactImportData
    {
        public int RowNumber { get; set; }
        public string Name { get; set; }
        public string Title { get; set; }
        public string Occupation { get; set; }
        public string WhatsAppNumber { get; set; }
        public string Email { get; set; }
        public string CompanyName { get; set; }
        public string Department { get; set; }
        public string Position { get; set; }
        public string Hashtags { get; set; }
        public string BroadcastGroupId { get; set; }
    }

    /// <summary>
    /// 聯絡人匯入結果
    /// </summary>
    public class ContactImportResult
    {
        public int RowNumber { get; set; }
        public bool Success { get; set; }
        public Guid? ContactId { get; set; }
        public string ErrorMessage { get; set; }
    }

    /// <summary>
    /// 批量創建聯絡人響應
    /// </summary>
    public class BatchCreateContactsResponse
    {
        public int TotalCount { get; set; }
        public int SuccessCount { get; set; }
        public int FailedCount { get; set; }
        public IEnumerable<ContactImportResult> Results { get; set; }
    }

    /// <summary>
    /// SQL 連接配置
    /// </summary>
    public class SqlConnectionConfig
    {
        public string Server { get; set; }
        public string Database { get; set; }
        public string Username { get; set; }
        public string Password { get; set; }
        public string Table { get; set; }
        public string Query { get; set; }
    }

    /// <summary>
    /// Excel 文件配置
    /// </summary>
    public class ExcelConfig
    {
        public string FilePath { get; set; }
        public string SheetName { get; set; }
    }

    /// <summary>
    /// Google Sheets URL 配置
    /// </summary>
    public class GoogleSheetsUrlConfig
    {
        public string Url { get; set; }
    }

    /// <summary>
    /// Google Docs 配置
    /// </summary>
    public class GoogleDocsConfig
    {
        public string Url { get; set; }
        public string SheetName { get; set; }
    }

    /// <summary>
    /// 創建聯絡人匯入排程請求
    /// </summary>
    public class CreateScheduleRequest
    {
        public string Name { get; set; } = "";
        public string ImportType { get; set; } = ""; // 'excel', 'google', 'sql'
        public bool IsScheduled { get; set; }
        public string ScheduleType { get; set; } = ""; // 'interval', 'daily', 'weekly', 'cron'
        public int? IntervalMinutes { get; set; }
        public string? ScheduleCron { get; set; } = null; // Nullable
        public object SourceConfig { get; set; }
        public object FieldMapping { get; set; } // Changed from Dictionary<string, string> to object
        public bool AllowUpdateDuplicates { get; set; }
        public Guid? BroadcastGroupId { get; set; }
    }

    /// <summary>
    /// 更新聯絡人匯入排程請求
    /// </summary>
    public class UpdateScheduleRequest
    {
        public string Name { get; set; }
        public bool IsScheduled { get; set; }
        public string ScheduleType { get; set; }
        public int? IntervalMinutes { get; set; }
        public string? ScheduleCron { get; set; } // 改為可空類型，因為不是所有排程類型都需要 cron
        public object? SourceConfig { get; set; }
        public Dictionary<string, string>? FieldMapping { get; set; }
        public bool AllowUpdateDuplicates { get; set; }
        public Guid? BroadcastGroupId { get; set; }
    }

    /// <summary>
    /// 更新狀態請求
    /// </summary>
    public class UpdateStatusRequest
    {
        public string? Status { get; set; } // 改為可空類型，因為更新狀態時可能只更新 IsActive
        public bool? IsActive { get; set; }
    }
}
