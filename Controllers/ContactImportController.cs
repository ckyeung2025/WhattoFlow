using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using PurpleRice.Models;
using PurpleRice.Models.DTOs;
using PurpleRice.Services;
using System.Security.Claims;
using System.Linq;
using System.Text.Json;

namespace PurpleRice.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class ContactImportController : ControllerBase
    {
        private readonly ContactListService _contactListService;
        private readonly ILogger<ContactImportController> _logger;

        public ContactImportController(ContactListService contactListService, ILogger<ContactImportController> logger)
        {
            _contactListService = contactListService;
            _logger = logger;
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

                        // 創建聯絡人
                        var contact = new ContactList
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

                        await _contactListService.CreateContactAsync(contact, createdBy);
                        
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
                    // 解析 Excel 文件 (需要安裝 EPPlus 或 ClosedXML)
                    // 這裡先返回模擬數據，實際實現需要添加 Excel 解析庫
                    await Task.Delay(1000); // 模擬解析時間
                    
                    data = new List<Dictionary<string, object>>
                    {
                        new Dictionary<string, object>
                    {
                        { "name", "張三" },
                        { "title", "經理" },
                            { "occupation", "企業家" },
                            { "position", "CEO" },
                        { "whatsapp", "+886912345678" },
                        { "email", "zhang@example.com" },
                        { "company", "ABC公司" },
                        { "department", "技術部" },
                        { "tags", "VIP,重要客戶" }
                    },
                    new Dictionary<string, object>
                    {
                        { "name", "李四" },
                        { "title", "專員" },
                            { "occupation", "工程師" },
                            { "position", "Senior" },
                        { "whatsapp", "+886987654321" },
                        { "email", "li@example.com" },
                        { "company", "XYZ公司" },
                        { "department", "銷售部" },
                        { "tags", "新客戶" }
                    }
                };
                    
                    columns = data.FirstOrDefault()?.Keys.ToList() ?? new List<string>();
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
}
