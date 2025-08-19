using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Http;
using System.IO;
using System.Threading.Tasks;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Spreadsheet;
using PurpleRice.Services;

namespace PurpleRice.Controllers
{
    [ApiController]
    [Route("api/datasets-upload")]
    public class DataSetsFileUploadController : ControllerBase
    {
        private readonly ILogger<DataSetsFileUploadController> _logger;
        private readonly IWebHostEnvironment _environment;
        private readonly LoggingService _loggingService;

        public DataSetsFileUploadController(ILogger<DataSetsFileUploadController> logger, IWebHostEnvironment environment, Func<string, LoggingService> loggingServiceFactory)
        {
            _logger = logger;
            _environment = environment;
            _loggingService = loggingServiceFactory("DataSetsFileUploadController");
        }

        [HttpPost("excel")]
        public async Task<IActionResult> UploadExcel(IFormFile file)
        {
            try
            {
                _loggingService.LogInformation($"開始處理 Excel 文件上傳: {file?.FileName}, 大小: {file?.Length} bytes");
                
                if (file == null || file.Length == 0)
                {
                    _loggingService.LogWarning("上傳的文件為空");
                    return BadRequest(new { success = false, message = "沒有選擇文件" });
                }

                // 檢查文件類型
                var allowedTypes = new[] { 
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", 
                    "application/vnd.ms-excel" 
                };
                
                if (!allowedTypes.Contains(file.ContentType))
                {
                    _loggingService.LogWarning($"不支持的文件類型: {file.ContentType}, 文件名: {file.FileName}");
                    return BadRequest(new { success = false, message = "只允許上傳 Excel 文件" });
                }

                // 檢查文件大小（10MB）
                if (file.Length > 10 * 1024 * 1024)
                {
                    _loggingService.LogWarning($"文件大小超限: {file.Length} bytes, 文件名: {file.FileName}");
                    return BadRequest(new { success = false, message = "文件大小不能超過 10MB" });
                }

                // 創建上傳目錄
                var uploadDir = Path.Combine(Directory.GetCurrentDirectory(), "Uploads", "excel");
                _loggingService.LogInformation($"準備創建上傳目錄: {uploadDir}");
                
                if (!Directory.Exists(uploadDir))
                {
                    Directory.CreateDirectory(uploadDir);
                    _loggingService.LogInformation($"成功創建上傳目錄: {uploadDir}");
                }

                // 生成唯一文件名
                var fileName = $"{DateTime.Now:yyyyMMddHHmmss}_{Guid.NewGuid()}_{file.FileName}";
                var filePath = Path.Combine(uploadDir, fileName);
                _loggingService.LogInformation($"生成的文件名: {fileName}, 完整路徑: {filePath}");

                // 保存文件
                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }

                // 返回相對路徑
                var relativePath = $"/Uploads/excel/{fileName}";
                _loggingService.LogInformation($"Excel 文件上傳成功: {fileName}, 相對路徑: {relativePath}, 實際路徑: {filePath}");

                return Ok(new
                {
                    success = true,
                    message = "文件上傳成功",
                    fileName = fileName,
                    filePath = relativePath,
                    fileSize = file.Length
                });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"Excel 文件上傳失敗: {ex.Message}", ex);
                return StatusCode(500, new { success = false, message = "文件上傳失敗: " + ex.Message });
            }
        }

        [HttpGet("excel/sheets")]
        public async Task<IActionResult> GetExcelSheets([FromQuery] string filePath)
        {
            try
            {
                _loggingService.LogInformation($"開始獲取 Excel 工作表名稱，請求路徑: {filePath}");
                
                if (string.IsNullOrEmpty(filePath))
                {
                    _loggingService.LogWarning("文件路徑參數為空");
                    return BadRequest(new { success = false, message = "文件路徑不能為空" });
                }

                // 構建完整的文件路徑
                var fullPath = filePath;
                
                // 檢查是否為真正的絕對路徑（Windows 系統上以 / 開頭的路徑不是真正的絕對路徑）
                if (!Path.IsPathRooted(filePath) || (filePath.StartsWith("/") && !filePath.StartsWith("\\")))
                {
                    // 移除開頭的斜線，然後與 Uploads 路徑組合
                    var relativePath = filePath.TrimStart('/');
                    
                    // 使用當前目錄構建完整路徑
                    fullPath = Path.Combine(Directory.GetCurrentDirectory(), relativePath);
                    
                    _loggingService.LogInformation($"路徑構建調試 - 原始路徑: {filePath}");
                    _loggingService.LogInformation($"路徑構建調試 - 相對路徑: {relativePath}");
                    _loggingService.LogInformation($"路徑構建調試 - 當前目錄: {Directory.GetCurrentDirectory()}");
                    _loggingService.LogInformation($"路徑構建調試 - 最終路徑: {fullPath}");
                }
                else
                {
                    _loggingService.LogInformation($"使用原始路徑（絕對路徑）: {fullPath}");
                }

                _loggingService.LogInformation($"請求的文件路徑: {filePath}, 構建的完整路徑: {fullPath}");

                if (!System.IO.File.Exists(fullPath))
                {
                    _loggingService.LogWarning($"文件不存在: {fullPath}");
                    return BadRequest(new { success = false, message = $"文件不存在: {fullPath}" });
                }

                _loggingService.LogInformation($"文件存在，開始讀取 Excel 工作表名稱: {fullPath}");

                var sheetNames = new List<string>();
                using (var stream = System.IO.File.OpenRead(fullPath))
                {
                    var spreadsheetDocument = DocumentFormat.OpenXml.Packaging.SpreadsheetDocument.Open(stream, false);
                    var workbookPart = spreadsheetDocument.WorkbookPart;
                    var workbook = workbookPart.Workbook;

                    foreach (DocumentFormat.OpenXml.Spreadsheet.Sheet sheet in workbook.Sheets)
                    {
                        sheetNames.Add(sheet.Name);
                    }
                }

                _loggingService.LogInformation($"成功讀取 Excel 工作表名稱: {string.Join(", ", sheetNames)}, 共 {sheetNames.Count} 個工作表");

                return Ok(new
                {
                    success = true,
                    sheetNames = sheetNames
                });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"讀取 Excel 工作表名稱失敗: {ex.Message}", ex);
                return StatusCode(500, new { success = false, message = "讀取工作表名稱失敗: " + ex.Message });
            }
        }

        [HttpGet("excel/preview")]
        public async Task<IActionResult> PreviewExcelColumns([FromQuery] string filePath, [FromQuery] string sheetName)
        {
            try
            {
                _loggingService.LogInformation($"開始預覽 Excel 欄位，文件路徑: {filePath}, 工作表: {sheetName}");
                
                if (string.IsNullOrEmpty(filePath) || string.IsNullOrEmpty(sheetName))
                {
                    _loggingService.LogWarning($"參數為空 - 文件路徑: {filePath}, 工作表: {sheetName}");
                    return BadRequest(new { success = false, message = "文件路徑和工作表名稱不能為空" });
                }

                // 構建完整的文件路徑
                var fullPath = filePath;
                
                // 檢查是否為真正的絕對路徑（Windows 系統上以 / 開頭的路徑不是真正的絕對路徑）
                if (!Path.IsPathRooted(filePath) || (filePath.StartsWith("/") && !filePath.StartsWith("\\")))
                {
                    // 移除開頭的斜線，然後與 Uploads 路徑組合
                    var relativePath = filePath.TrimStart('/');
                    
                    // 使用當前目錄構建完整路徑
                    fullPath = Path.Combine(Directory.GetCurrentDirectory(), relativePath);
                    
                    _loggingService.LogInformation($"預覽欄位路徑構建調試 - 原始路徑: {filePath}");
                    _loggingService.LogInformation($"預覽欄位路徑構建調試 - 相對路徑: {relativePath}");
                    _loggingService.LogInformation($"預覽欄位路徑構建調試 - 當前目錄: {Directory.GetCurrentDirectory()}");
                    _loggingService.LogInformation($"預覽欄位路徑構建調試 - 最終路徑: {fullPath}");
                }
                else
                {
                    _loggingService.LogInformation($"使用原始路徑（絕對路徑）: {fullPath}");
                }

                _loggingService.LogInformation($"預覽欄位 - 請求的文件路徑: {filePath}, 構建的完整路徑: {fullPath}");

                if (!System.IO.File.Exists(fullPath))
                {
                    _loggingService.LogWarning($"預覽欄位 - 文件不存在: {fullPath}");
                    return BadRequest(new { success = false, message = $"文件不存在: {fullPath}" });
                }

                _loggingService.LogInformation($"文件存在，開始讀取 Excel 欄位定義: {fullPath}, 工作表: {sheetName}");

                var columns = new List<object>();
                using (var stream = System.IO.File.OpenRead(fullPath))
                {
                    var spreadsheetDocument = DocumentFormat.OpenXml.Packaging.SpreadsheetDocument.Open(stream, false);
                    var workbookPart = spreadsheetDocument.WorkbookPart;
                    var workbook = workbookPart.Workbook;

                    var sheet = workbook.Sheets.FirstOrDefault(s => (s as DocumentFormat.OpenXml.Spreadsheet.Sheet)?.Name == sheetName) as DocumentFormat.OpenXml.Spreadsheet.Sheet;
                    if (sheet == null)
                    {
                        _loggingService.LogWarning($"找不到工作表: {sheetName}");
                        return BadRequest(new { success = false, message = $"找不到工作表: {sheetName}" });
                    }

                    var worksheetPart = workbookPart.GetPartById(sheet.Id) as DocumentFormat.OpenXml.Packaging.WorksheetPart;
                    if (worksheetPart == null)
                    {
                        _loggingService.LogWarning($"無法讀取工作表內容: {sheetName}");
                        return BadRequest(new { success = false, message = "無法讀取工作表內容" });
                    }

                    var worksheet = worksheetPart.Worksheet;
                    var sheetData = worksheet.GetFirstChild<DocumentFormat.OpenXml.Spreadsheet.SheetData>();

                    if (sheetData != null)
                    {
                        var rows = sheetData.Elements<DocumentFormat.OpenXml.Spreadsheet.Row>().ToList();
                        if (rows.Any())
                        {
                            // 讀取標題行（第一行）
                            var headerRow = rows.First();
                            var cells = headerRow.Elements<DocumentFormat.OpenXml.Spreadsheet.Cell>().ToList();
                            
                            _loggingService.LogInformation($"找到標題行，單元格數量: {cells.Count}");
                            
                            for (int i = 0; i < cells.Count; i++)
                            {
                                var cell = cells[i];
                                var value = GetCellValue(cell, workbookPart.SharedStringTablePart);
                                
                                if (!string.IsNullOrWhiteSpace(value))
                                {
                                    columns.Add(new
                                    {
                                        columnName = value.Trim().Replace(" ", "_").ToLower(),
                                        displayName = value.Trim(),
                                        dataType = "string",
                                        maxLength = 255,
                                        isRequired = false,
                                        isPrimaryKey = i == 0,
                                        isSearchable = true,
                                        isSortable = true,
                                        isIndexed = false,
                                        sortOrder = i
                                    });
                                }
                            }
                        }
                        else
                        {
                            _loggingService.LogWarning($"工作表 {sheetName} 沒有行數據");
                        }
                    }
                    else
                    {
                        _loggingService.LogWarning($"工作表 {sheetName} 沒有數據");
                    }
                }

                _loggingService.LogInformation($"成功預覽 Excel 欄位定義，共 {columns.Count} 個欄位: {string.Join(", ", columns.Select(c => c.GetType().GetProperty("displayName")?.GetValue(c)))})");

                return Ok(new
                {
                    success = true,
                    columns = columns
                });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"預覽 Excel 欄位定義失敗: {ex.Message}", ex);
                return StatusCode(500, new { success = false, message = "預覽欄位定義失敗: " + ex.Message });
            }
        }

        private string GetCellValue(DocumentFormat.OpenXml.Spreadsheet.Cell cell, DocumentFormat.OpenXml.Packaging.SharedStringTablePart? sharedStringTable)
        {
            if (cell.CellValue == null)
                return string.Empty;

            var value = cell.CellValue.InnerText;

            if (cell.DataType != null && cell.DataType.Value == DocumentFormat.OpenXml.Spreadsheet.CellValues.SharedString)
            {
                if (int.TryParse(value, out var index) && sharedStringTable != null)
                {
                    var sharedString = sharedStringTable.SharedStringTable.Elements<DocumentFormat.OpenXml.Spreadsheet.SharedStringItem>().ElementAt(index);
                    value = sharedString.Text?.Text ?? string.Empty;
                }
            }

            return value;
        }
    }
}
