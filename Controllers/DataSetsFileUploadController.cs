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
                            
                            // 讀取前幾行數據來推斷數據類型
                            var sampleRows = rows.Skip(1).Take(5).ToList(); // 取前5行作為樣本
                            
                            for (int i = 0; i < cells.Count; i++)
                            {
                                var cell = cells[i];
                                var headerValue = GetCellValue(cell, workbookPart.SharedStringTablePart);
                                
                                if (!string.IsNullOrWhiteSpace(headerValue))
                                {
                                    // 推斷數據類型
                                    var inferredType = InferDataTypeFromSample(sampleRows, i, workbookPart.SharedStringTablePart);
                                    
                                    columns.Add(new
                                    {
                                        columnName = headerValue.Trim().Replace(" ", "_").ToLower(),
                                        displayName = headerValue.Trim(),
                                        dataType = inferredType,  // ✅ 使用推斷的類型
                                        maxLength = inferredType == "string" ? 255 : (int?)null,
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

                _loggingService.LogInformation($"成功預覽 Excel 欄位定義，共 {columns.Count} 個欄位");
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

        // 新增：根據樣本數據推斷數據類型（改進版本）
        private string InferDataTypeFromSample(List<DocumentFormat.OpenXml.Spreadsheet.Row> sampleRows, int columnIndex, DocumentFormat.OpenXml.Packaging.SharedStringTablePart? sharedStringTable)
        {
            // 首先嘗試從標題行推斷類型（優先級最高）
            if (sampleRows.Any())
            {
                var headerRow = sampleRows.First();
                var cells = headerRow.Elements<DocumentFormat.OpenXml.Spreadsheet.Cell>().ToList();
                if (columnIndex < cells.Count)
                {
                    var headerValue = GetCellValue(cells[columnIndex], sharedStringTable);
                    if (!string.IsNullOrWhiteSpace(headerValue))
                    {
                        var headerInferredType = InferDataTypeFromHeader(headerValue);
                        if (headerInferredType != "string") // 如果標題能明確推斷類型，優先使用
                        {
                            return headerInferredType;
                        }
                    }
                }
            }
            
            var sampleValues = new List<string>();
            
            // 跳過標題行，從第二行開始分析數據
            foreach (var row in sampleRows.Skip(1))
            {
                var cells = row.Elements<DocumentFormat.OpenXml.Spreadsheet.Cell>().ToList();
                if (columnIndex < cells.Count)
                {
                    var value = GetCellValue(cells[columnIndex], sharedStringTable);
                    if (!string.IsNullOrWhiteSpace(value))
                    {
                        sampleValues.Add(value);
                    }
                }
            }
            
            if (!sampleValues.Any())
                return "string";
            
            // 分析樣本值來推斷類型
            var numericCount = 0;
            var dateCount = 0;
            var booleanCount = 0;
            
            foreach (var value in sampleValues)
            {
                if (decimal.TryParse(value, out _))
                    numericCount++;
                else if (DateTime.TryParse(value, out _))
                    dateCount++;
                else if (IsBooleanValue(value))
                    booleanCount++;
                else if (IsExcelDateNumber(value)) // 新增：檢查是否為 Excel 日期序列號
                    dateCount++;
            }
            
            var total = sampleValues.Count;
            var numericRatio = (double)numericCount / total;
            var dateRatio = (double)dateCount / total;
            var booleanRatio = (double)booleanCount / total;
            
            // 如果超過70%的值是某種類型，就推斷為該類型
            if (dateRatio >= 0.7) // 日期類型優先檢查
                return "datetime";
            if (numericRatio >= 0.7)
                return "decimal";
            if (booleanRatio >= 0.7)
                return "boolean";
            
            return "string"; // 默認為字串
        }

        // 新增：檢查是否為 Excel 日期序列號
        private bool IsExcelDateNumber(string value)
        {
            if (string.IsNullOrWhiteSpace(value))
                return false;

            // 嘗試解析為數字
            if (double.TryParse(value, out var numericValue))
            {
                // Excel 日期範圍：從 1900-01-01 到 9999-12-31
                // 對應的數字範圍：1 到 2958465
                if (numericValue >= 1 && numericValue <= 2958465)
                {
                    // 進一步驗證：嘗試轉換為日期
                    try
                    {
                        var baseDate = new DateTime(1900, 1, 1);
                        var calculatedDate = baseDate.AddDays(numericValue - 1);
                        
                        // 如果日期在 1900-03-01 之後，需要減去 1 天來修正 Excel 的閏年錯誤
                        if (calculatedDate >= new DateTime(1900, 3, 1))
                        {
                            calculatedDate = calculatedDate.AddDays(-1);
                        }
                        
                        // 檢查轉換後的日期是否合理
                        if (calculatedDate.Year >= 1900 && calculatedDate.Year <= 9999)
                        {
                            return true;
                        }
                    }
                    catch
                    {
                        // 轉換失敗，不是有效的日期
                    }
                }
            }
            
            return false;
        }

        private bool IsBooleanValue(string value)
        {
            var lowerValue = value.ToLower();
            return lowerValue == "true" || lowerValue == "false" || 
                   lowerValue == "yes" || lowerValue == "no" ||
                   lowerValue == "1" || lowerValue == "0" ||
                   lowerValue == "是" || lowerValue == "否";
        }

        // 新增：根據標題推斷數據類型（與 DataSetsController.cs 保持一致）
        private string InferDataTypeFromHeader(string header)
        {
            var lowerHeader = header.ToLower();
            
            // 檢查日期時間類型（更精確的匹配）
            if (lowerHeader.Contains("date") || lowerHeader.Contains("日期") || 
                lowerHeader.Contains("time") || lowerHeader.Contains("時間") ||
                lowerHeader.Contains("created") || lowerHeader.Contains("建立") ||
                lowerHeader.Contains("updated") || lowerHeader.Contains("更新") ||
                lowerHeader.Contains("modified") || lowerHeader.Contains("修改") ||
                lowerHeader.Contains("scheduled") || lowerHeader.Contains("已排程"))
            {
                // 排除包含其他關鍵字的欄位
                if (!lowerHeader.Contains("unit") && !lowerHeader.Contains("數量") && 
                    !lowerHeader.Contains("count") && !lowerHeader.Contains("計數"))
                {
                    return "datetime";
                }
            }
            
            // 檢查數值類型
            if (lowerHeader.Contains("amount") || lowerHeader.Contains("金額") || 
                lowerHeader.Contains("price") || lowerHeader.Contains("價格") ||
                lowerHeader.Contains("cost") || lowerHeader.Contains("成本") ||
                lowerHeader.Contains("revenue") || lowerHeader.Contains("收入") ||
                lowerHeader.Contains("profit") || lowerHeader.Contains("利潤") ||
                lowerHeader.Contains("discount") || lowerHeader.Contains("折扣") ||
                lowerHeader.Contains("rate") || lowerHeader.Contains("比率") ||
                lowerHeader.Contains("percentage") || lowerHeader.Contains("百分比"))
                return "decimal";
            
            // 檢查數量類型
            if (lowerHeader.Contains("quantity") || lowerHeader.Contains("數量") ||
                lowerHeader.Contains("count") || lowerHeader.Contains("計數") ||
                lowerHeader.Contains("number") || lowerHeader.Contains("數字") ||
                lowerHeader.Contains("total") || lowerHeader.Contains("總計") ||
                lowerHeader.Contains("sum") || lowerHeader.Contains("總和"))
                return "decimal";
            
            // 檢查整數類型
            if (lowerHeader.Contains("id") || lowerHeader.Contains("編號") ||
                lowerHeader.Contains("no") || lowerHeader.Contains("號碼") ||
                lowerHeader.Contains("code") || lowerHeader.Contains("代碼") ||
                lowerHeader.Contains("serial") || lowerHeader.Contains("序號") ||
                lowerHeader.Contains("version") || lowerHeader.Contains("版本"))
                return "int";
            
            // 檢查布林類型
            if (lowerHeader.Contains("status") || lowerHeader.Contains("狀態") ||
                lowerHeader.Contains("active") || lowerHeader.Contains("啟用") ||
                lowerHeader.Contains("enabled") || lowerHeader.Contains("啟用") ||
                lowerHeader.Contains("is") || lowerHeader.Contains("是否") ||
                lowerHeader.Contains("has") || lowerHeader.Contains("擁有") ||
                lowerHeader.Contains("flag") || lowerHeader.Contains("標記") ||
                lowerHeader.Contains("check") || lowerHeader.Contains("檢查"))
                return "boolean";
            
            return "string"; // 默認
        }
    }
}
