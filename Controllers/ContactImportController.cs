using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using PurpleRice.Models;
using PurpleRice.Models.DTOs;
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

        public ContactImportController(ContactListService contactListService, ILogger<ContactImportController> logger, IConfiguration configuration)
        {
            _contactListService = contactListService;
            _logger = logger;
            _configuration = configuration;
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
}
