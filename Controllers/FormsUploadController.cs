using Microsoft.AspNetCore.Mvc;
using System.IO;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using System;
using System.Linq;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using System.Text;
using System.Collections.Generic;
using PurpleRice.Data;
using PurpleRice.Models;
using Microsoft.EntityFrameworkCore;
using PurpleRice.Services;
using Microsoft.Extensions.Configuration;
using System.Net.Http;
using Newtonsoft.Json;

namespace PurpleRice.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class FormsUploadController : ControllerBase
    {
        private readonly string _uploadPath = Path.Combine("Uploads", "FormsFiles");
        private readonly PurpleRiceDbContext _context;
        private readonly DocumentConverterService _documentConverter;
        private readonly IConfiguration _configuration;
        private readonly LoggingService _loggingService;

        public FormsUploadController(PurpleRiceDbContext context, DocumentConverterService documentConverter, IConfiguration configuration, Func<string, LoggingService> loggingServiceFactory)
        {
            _context = context;
            _documentConverter = documentConverter;
            _configuration = configuration;
            _loggingService = loggingServiceFactory("FormsUploadController");
        }

        [HttpPost("image")]
        public async Task<IActionResult> UploadImage(IFormFile file)
        {
            try
            {
                // 檢查文件是否存在
                if (file == null || file.Length == 0)
                {
                    return BadRequest(new { error = "沒有選擇文件" });
                }

                // 檢查文件類型
                var allowedTypes = new[] { "image/jpeg", "image/png", "image/gif", "image/bmp", "image/webp", "image/tiff" };
                if (!allowedTypes.Contains(file.ContentType.ToLower()))
                {
                    return BadRequest(new { error = "不支持的文件類型" });
                }

                // 檢查文件大小 (限制為 10MB)
                if (file.Length > 10 * 1024 * 1024)
                {
                    return BadRequest(new { error = "文件大小不能超過 10MB" });
                }

                // 確保上傳目錄存在
                var uploadDir = Path.Combine(Directory.GetCurrentDirectory(), _uploadPath);
                if (!Directory.Exists(uploadDir))
                {
                    Directory.CreateDirectory(uploadDir);
                }

                // 生成唯一文件名
                var fileName = $"{DateTime.Now:yyyyMMddHHmmss}_{Guid.NewGuid()}{Path.GetExtension(file.FileName)}";
                var filePath = Path.Combine(uploadDir, fileName);

                // 保存文件
                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }

                // 返回成功響應
                var imageUrl = $"/Uploads/FormsFiles/{fileName}";
                return Ok(new { 
                    url = imageUrl,
                    uploaded = true,
                    fileName = fileName
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = $"上傳失敗: {ex.Message}" });
            }
        }

        [HttpPost("document")]
        public async Task<IActionResult> UploadDocument(IFormFile file)
        {
            _loggingService.LogInformation($"📤 [UploadDocument] 開始處理文檔上傳");
            _loggingService.LogInformation($"📤 [UploadDocument] 文件名: {file?.FileName}");
            _loggingService.LogInformation($"📤 [UploadDocument] 文件大小: {file?.Length} bytes");
            _loggingService.LogInformation($"📤 [UploadDocument] 內容類型: {file?.ContentType}");
            
            try
            {
                            // 檢查文件是否存在
            if (file == null || file.Length == 0)
            {
                _loggingService.LogWarning($"❌ [UploadDocument] 文件為空或不存在");
                return BadRequest(new { error = "沒有選擇文件" });
            }

                // 檢查文件類型
                var allowedTypes = new[] { 
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
                    "application/msword", // .doc
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
                    "application/vnd.ms-excel", // .xls
                    "application/pdf", // .pdf
                    "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
                    "application/vnd.ms-powerpoint", // .ppt
                    "application/rtf", // .rtf
                    "text/plain" // .txt
                };
                
                _loggingService.LogInformation($"🔍 [UploadDocument] 檢查文件類型: {file.ContentType}");
                if (!allowedTypes.Contains(file.ContentType.ToLower()))
                {
                    _loggingService.LogWarning($"❌ [UploadDocument] 不支持的文件類型: {file.ContentType}");
                    return BadRequest(new { error = "不支持的文件類型。支持格式：Word (.doc, .docx), Excel (.xls, .xlsx), PDF, PowerPoint (.ppt, .pptx), RTF, TXT" });
                }

                // 檢查文件大小 (限制為 50MB)
                if (file.Length > 50 * 1024 * 1024)
                {
                    _loggingService.LogWarning($"❌ [UploadDocument] 文件太大: {file.Length} bytes");
                    return BadRequest(new { error = "文件大小不能超過 50MB" });
                }

                _loggingService.LogInformation($"✅ [UploadDocument] 文件驗證通過");

                // 生成 e-form ID
                var eFormId = Guid.NewGuid().ToString();
                _loggingService.LogInformation($"🆔 [UploadDocument] 生成 e-form ID: {eFormId}");

                // 確保上傳目錄存在（基於 e-form ID 的目錄結構）
                var uploadDir = Path.Combine(Directory.GetCurrentDirectory(), _uploadPath, "Documents", eFormId);
                _loggingService.LogInformation($"📁 [UploadDocument] 上傳目錄: {uploadDir}");
                
                if (!Directory.Exists(uploadDir))
                {
                    Directory.CreateDirectory(uploadDir);
                    _loggingService.LogInformation($"📁 [UploadDocument] 創建 e-form 目錄: {eFormId}");
                }

                // 生成唯一文件名
                var fileName = $"{DateTime.Now:yyyyMMddHHmmss}_{Guid.NewGuid()}{Path.GetExtension(file.FileName)}";
                var filePath = Path.Combine(uploadDir, fileName);
                _loggingService.LogInformation($"📁 [UploadDocument] 保存路徑: {filePath}");

                // 保存文件
                _loggingService.LogInformation($"💾 [UploadDocument] 開始保存文件...");
                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }
                _loggingService.LogInformation($"✅ [UploadDocument] 文件保存成功");

                // 檢查是否支持該格式
                if (!_documentConverter.IsSupportedFormat(filePath))
                {
                    _loggingService.LogWarning($"❌ [UploadDocument] 不支持的文件格式: {Path.GetExtension(filePath)}");
                    return BadRequest(new { error = "不支持的文件格式" });
                }

                // 使用 LibreOffice 轉換文檔為 HTML
                _loggingService.LogInformation($"🔄 [UploadDocument] 開始使用 LibreOffice 轉換文檔為 HTML...");
                var htmlContent = await _documentConverter.ConvertToHtml(filePath, eFormId);
                
                _loggingService.LogInformation($"📄 [UploadDocument] 轉換結果長度: {htmlContent?.Length ?? 0}");
                
                if (string.IsNullOrEmpty(htmlContent))
                {
                    _loggingService.LogWarning($"❌ [UploadDocument] HTML 內容為空");
                    return BadRequest(new { error = "文檔轉換失敗，無法提取內容" });
                }

                _loggingService.LogInformation($"✅ [UploadDocument] 文檔轉換成功");

                // 創建新的 eFormDefinition
                var formName = Path.GetFileNameWithoutExtension(file.FileName) ?? "未命名表單";
                _loggingService.LogInformation($"📝 [UploadDocument] 創建表單: {formName}");
                
                var eFormGuid = Guid.Parse(eFormId);
                var eForm = new eFormDefinition
                {
                    Id = eFormGuid,
                    CompanyId = Guid.NewGuid(), // 臨時處理
                    Name = formName,
                    Description = $"從文檔創建: {file.FileName}",
                    HtmlCode = htmlContent,
                    SourceFilePath = $"Documents/{eFormId}/{fileName}",
                    Status = "A",
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow,
                    CreatedUserId = Guid.NewGuid(), // 臨時處理
                    UpdatedUserId = Guid.NewGuid() // 臨時處理
                };

                _loggingService.LogInformation($"💾 [UploadDocument] 保存到資料庫...");
                _context.eFormDefinitions.Add(eForm);
                await _context.SaveChangesAsync();
                _loggingService.LogInformation($"✅ [UploadDocument] 資料庫保存成功，表單 ID: {eForm.Id}");

                return Ok(new { 
                    success = true,
                    formId = eForm.Id,
                    htmlContent = htmlContent,
                    formName = eForm.Name,
                    sourceFilePath = eForm.SourceFilePath,
                    message = "文檔已成功轉換並創建表單"
                });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"❌ [UploadDocument] 處理失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = $"處理失敗: {ex.Message}" });
            }
        }

        [HttpPost("word")]
        public async Task<IActionResult> UploadWordFile(IFormFile file)
        {
            // 重定向到新的通用文檔上傳端點
            return await UploadDocument(file);
        }

        [HttpPost("excel")]
        public async Task<IActionResult> UploadExcelFile(IFormFile file)
        {
            // 重定向到新的通用文檔上傳端點
            return await UploadDocument(file);
        }

        [HttpPost("pdf")]
        public async Task<IActionResult> UploadPdfFile(IFormFile file)
        {
            // 重定向到新的通用文檔上傳端點
            return await UploadDocument(file);
        }

        private async Task<string> ConvertWordToHtml(string filePath)
        {
            Console.WriteLine($"🔍 [ConvertWordToHtml] 開始轉換文件: {filePath}");
            
            var htmlBuilder = new StringBuilder();
            htmlBuilder.AppendLine("<!DOCTYPE html>");
            htmlBuilder.AppendLine("<html>");
            htmlBuilder.AppendLine("<head>");
            htmlBuilder.AppendLine("<meta charset=\"utf-8\">");
            htmlBuilder.AppendLine("<style>");
            htmlBuilder.AppendLine("body { font-family: Arial, sans-serif; line-height: 1.6; margin: 20px; }");
            htmlBuilder.AppendLine("table { border-collapse: collapse; width: 100%; margin: 10px 0; }");
            htmlBuilder.AppendLine("table, th, td { border: 1px solid #ddd; }");
            htmlBuilder.AppendLine("th, td { padding: 8px; text-align: left; }");
            htmlBuilder.AppendLine("th { background-color: #f2f2f2; }");
            htmlBuilder.AppendLine("img { max-width: 100%; height: auto; }");
            htmlBuilder.AppendLine("</style>");
            htmlBuilder.AppendLine("</head>");
            htmlBuilder.AppendLine("<body>");

            try
            {
                Console.WriteLine($"📄 [ConvertWordToHtml] 嘗試打開 Word 文件...");
                using (var document = WordprocessingDocument.Open(filePath, false))
                {
                    Console.WriteLine($"✅ [ConvertWordToHtml] Word 文件打開成功");
                    
                    var mainPart = document.MainDocumentPart;
                    Console.WriteLine($"📋 [ConvertWordToHtml] MainPart: {(mainPart != null ? "存在" : "null")}");
                    Console.WriteLine($"📋 [ConvertWordToHtml] Document: {(mainPart?.Document != null ? "存在" : "null")}");
                    Console.WriteLine($"📋 [ConvertWordToHtml] Body: {(mainPart?.Document?.Body != null ? "存在" : "null")}");
                    
                    if (mainPart?.Document?.Body != null)
                    {
                        Console.WriteLine($"�� [ConvertWordToHtml] 開始處理段落和文本...");
                        
                        // 處理段落和文本
                        var paragraphCount = 0;
                        foreach (var paragraph in mainPart.Document.Body.Elements<Paragraph>())
                        {
                            if (paragraph == null) 
                            {
                                Console.WriteLine($"⚠️ [ConvertWordToHtml] 跳過 null 段落");
                                continue;
                            }
                            
                            paragraphCount++;
                            Console.WriteLine($"📄 [ConvertWordToHtml] 處理段落 #{paragraphCount}");
                            
                            // 處理段落對齊
                            var alignment = paragraph.ParagraphProperties?.Justification?.Val;
                            var alignStyle = "";
                            if (alignment != null)
                            {
                                switch (alignment.Value.ToString().ToLower())
                                {
                                    case "center":
                                        alignStyle = "text-align: center;";
                                        Console.WriteLine($"📄 [ConvertWordToHtml] 段落置中對齊");
                                        break;
                                    case "right":
                                        alignStyle = "text-align: right;";
                                        Console.WriteLine($"📄 [ConvertWordToHtml] 段落右對齊");
                                        break;
                                    case "left":
                                        alignStyle = "text-align: left;";
                                        Console.WriteLine($"📄 [ConvertWordToHtml] 段落左對齊");
                                        break;
                                    case "both":
                                        alignStyle = "text-align: justify;";
                                        Console.WriteLine($"📄 [ConvertWordToHtml] 段落兩端對齊");
                                        break;
                                }
                            }
                            
                            var paragraphStyle = !string.IsNullOrEmpty(alignStyle) ? $" style=\"{alignStyle}\"" : "";
                            htmlBuilder.AppendLine($"<p{paragraphStyle}>");
                            
                            var runCount = 0;
                            foreach (var run in paragraph.Elements<Run>())
                            {
                                if (run == null) 
                                {
                                    Console.WriteLine($"⚠️ [ConvertWordToHtml] 跳過 null Run");
                                    continue;
                                }
                                
                                runCount++;
                                Console.WriteLine($"📝 [ConvertWordToHtml] 處理 Run #{runCount}");
                                
                                var textCount = 0;
                                foreach (var text in run.Elements<Text>())
                                {
                                    if (text == null) 
                                    {
                                        Console.WriteLine($"⚠️ [ConvertWordToHtml] 跳過 null Text");
                                        continue;
                                    }
                                    
                                    textCount++;
                                    var content = text.Text ?? "";
                                    Console.WriteLine($"📄 [ConvertWordToHtml] Text #{textCount}: '{content}' (長度: {content.Length})");
                                    
                                    // 處理格式
                                    var isBold = run.RunProperties?.Bold?.Val != null && run.RunProperties.Bold.Val.Value;
                                    var isItalic = run.RunProperties?.Italic?.Val != null && run.RunProperties.Italic.Val.Value;
                                    var isUnderline = run.RunProperties?.Underline?.Val != null && run.RunProperties.Underline.Val.Value == DocumentFormat.OpenXml.Wordprocessing.UnderlineValues.Single;
                                    var isStrike = run.RunProperties?.Strike?.Val != null && run.RunProperties.Strike.Val.Value;
                                    
                                    // 處理字體大小
                                    var fontSize = run.RunProperties?.FontSize?.Val;
                                    var fontSizeStyle = "";
                                    if (fontSize != null)
                                    {
                                        try
                                        {
                                            // 嘗試將字體大小轉換為數字
                                            if (int.TryParse(fontSize.Value.ToString(), out int fontSizeInt))
                                            {
                                                // 將 half-points 轉換為 pixels (1 half-point = 0.5 points, 1 point = 1.33 pixels)
                                                var sizeInPixels = (fontSizeInt / 2.0) * 1.33;
                                                fontSizeStyle = $"font-size: {sizeInPixels:F1}px;";
                                                Console.WriteLine($"🔤 [ConvertWordToHtml] 字體大小: {fontSizeInt} half-points -> {sizeInPixels:F1}px");
                                            }
                                            else
                                            {
                                                Console.WriteLine($"⚠️ [ConvertWordToHtml] 無法解析字體大小: {fontSize.Value}");
                                            }
                                        }
                                        catch (Exception ex)
                                        {
                                            Console.WriteLine($"⚠️ [ConvertWordToHtml] 處理字體大小時發生錯誤: {ex.Message}");
                                        }
                                    }
                                    
                                    // 處理字體名稱 - 使用 RunFonts 而不是 FontFamily
                                    var fontName = run.RunProperties?.RunFonts?.Ascii;
                                    var fontFamilyStyle = "";
                                    if (!string.IsNullOrEmpty(fontName))
                                    {
                                        fontFamilyStyle = $"font-family: '{fontName}';";
                                        Console.WriteLine($"🔤 [ConvertWordToHtml] 字體: {fontName}");
                                    }
                                    
                                    // 組合樣式
                                    var style = "";
                                    if (!string.IsNullOrEmpty(fontSizeStyle) || !string.IsNullOrEmpty(fontFamilyStyle))
                                    {
                                        style = $" style=\"{fontSizeStyle}{fontFamilyStyle}\"";
                                    }
                                    
                                    // 應用格式
                                    var formattedContent = content;
                                    
                                    // 應用下劃線
                                    if (isUnderline)
                                    {
                                        formattedContent = $"<u>{formattedContent}</u>";
                                        Console.WriteLine($"🔤 [ConvertWordToHtml] 應用下劃線格式");
                                    }
                                    
                                    // 應用刪除線
                                    if (isStrike)
                                    {
                                        formattedContent = $"<s>{formattedContent}</s>";
                                        Console.WriteLine($"🔤 [ConvertWordToHtml] 應用刪除線格式");
                                    }
                                    
                                    // 應用斜體
                                    if (isItalic)
                                    {
                                        formattedContent = $"<em>{formattedContent}</em>";
                                        Console.WriteLine($"🔤 [ConvertWordToHtml] 應用斜體格式");
                                    }
                                    
                                    // 應用粗體
                                    if (isBold)
                                    {
                                        formattedContent = $"<strong>{formattedContent}</strong>";
                                        Console.WriteLine($"🔤 [ConvertWordToHtml] 應用粗體格式");
                                    }
                                    
                                    // 應用字體樣式
                                    if (!string.IsNullOrEmpty(style))
                                    {
                                        formattedContent = $"<span{style}>{formattedContent}</span>";
                                        Console.WriteLine($"🔤 [ConvertWordToHtml] 應用字體樣式");
                                    }
                                    
                                    htmlBuilder.Append(formattedContent);
                                }
                            }
                            
                            htmlBuilder.AppendLine("</p>");
                        }
                        
                        Console.WriteLine($"✅ [ConvertWordToHtml] 段落處理完成，共處理 {paragraphCount} 個段落");

                        // 處理表格
                        Console.WriteLine($"📊 [ConvertWordToHtml] 開始處理表格...");
                        var tableCount = 0;
                        foreach (var table in mainPart.Document.Body.Elements<Table>())
                        {
                            if (table == null) 
                            {
                                Console.WriteLine($"⚠️ [ConvertWordToHtml] 跳過 null 表格");
                                continue;
                            }
                            
                            tableCount++;
                            Console.WriteLine($"📊 [ConvertWordToHtml] 處理表格 #{tableCount}");
                            
                            htmlBuilder.AppendLine("<table>");
                            
                            var rowCount = 0;
                            foreach (var row in table.Elements<TableRow>())
                            {
                                if (row == null) 
                                {
                                    Console.WriteLine($"⚠️ [ConvertWordToHtml] 跳過 null 行");
                                    continue;
                                }
                                
                                rowCount++;
                                Console.WriteLine($"📋 [ConvertWordToHtml] 處理表格行 #{rowCount}");
                                
                                htmlBuilder.AppendLine("<tr>");
                                
                                var cells = row.Elements<TableCell>().ToList();
                                Console.WriteLine($"📋 [ConvertWordToHtml] 該行有 {cells.Count} 個單元格");
                                
                                var cellCount = 0;
                                foreach (var cell in cells)
                                {
                                    if (cell == null) 
                                    {
                                        Console.WriteLine($"⚠️ [ConvertWordToHtml] 跳過 null 單元格");
                                        continue;
                                    }
                                    
                                    cellCount++;
                                    var isHeader = cells.First() == cell;
                                    var tag = isHeader ? "th" : "td";
                                    
                                    Console.WriteLine($"📋 [ConvertWordToHtml] 處理單元格 #{cellCount} ({tag})");
                                    htmlBuilder.AppendLine($"<{tag}>");
                                    
                                    var cellParagraphCount = 0;
                                    foreach (var paragraph in cell.Elements<Paragraph>())
                                    {
                                        if (paragraph == null) continue;
                                        
                                        cellParagraphCount++;
                                        Console.WriteLine($"📄 [ConvertWordToHtml] 單元格段落 #{cellParagraphCount}");
                                        
                                        var cellRunCount = 0;
                                        foreach (var run in paragraph.Elements<Run>())
                                        {
                                            if (run == null) continue;
                                            
                                            cellRunCount++;
                                            Console.WriteLine($"📝 [ConvertWordToHtml] 單元格 Run #{cellRunCount}");
                                            
                                            var cellTextCount = 0;
                                            foreach (var text in run.Elements<Text>())
                                            {
                                                if (text == null) continue;
                                                
                                                cellTextCount++;
                                                var content = text.Text ?? "";
                                                Console.WriteLine($"📄 [ConvertWordToHtml] 單元格 Text #{cellTextCount}: '{content}'");
                                                
                                                var isBold = run.RunProperties?.Bold?.Val != null && run.RunProperties.Bold.Val.Value;
                                                var isItalic = run.RunProperties?.Italic?.Val != null && run.RunProperties.Italic.Val.Value;
                                                var isUnderline = run.RunProperties?.Underline?.Val != null && run.RunProperties.Underline.Val.Value == DocumentFormat.OpenXml.Wordprocessing.UnderlineValues.Single;
                                                var isStrike = run.RunProperties?.Strike?.Val != null && run.RunProperties.Strike.Val.Value;
                                                
                                                // 處理字體大小
                                                var fontSize = run.RunProperties?.FontSize?.Val;
                                                var fontSizeStyle = "";
                                                if (fontSize != null)
                                                {
                                                    try
                                                    {
                                                        // 嘗試將字體大小轉換為數字
                                                        if (int.TryParse(fontSize.Value.ToString(), out int fontSizeInt))
                                                        {
                                                            // 將 half-points 轉換為 pixels (1 half-point = 0.5 points, 1 point = 1.33 pixels)
                                                            var sizeInPixels = (fontSizeInt / 2.0) * 1.33;
                                                            fontSizeStyle = $"font-size: {sizeInPixels:F1}px;";
                                                        }
                                                    }
                                                    catch (Exception ex)
                                                    {
                                                        Console.WriteLine($"⚠️ [ConvertWordToHtml] 表格中處理字體大小時發生錯誤: {ex.Message}");
                                                    }
                                                }
                                                
                                                // 處理字體名稱 - 使用 RunFonts 而不是 FontFamily
                                                var fontName = run.RunProperties?.RunFonts?.Ascii;
                                                var fontFamilyStyle = "";
                                                if (!string.IsNullOrEmpty(fontName))
                                                {
                                                    fontFamilyStyle = $"font-family: '{fontName}';";
                                                }
                                                
                                                // 組合樣式
                                                var style = "";
                                                if (!string.IsNullOrEmpty(fontSizeStyle) || !string.IsNullOrEmpty(fontFamilyStyle))
                                                {
                                                    style = $" style=\"{fontSizeStyle}{fontFamilyStyle}\"";
                                                }
                                                
                                                // 應用格式
                                                var formattedContent = content;
                                                
                                                // 應用下劃線
                                                if (isUnderline)
                                                {
                                                    formattedContent = $"<u>{formattedContent}</u>";
                                                }
                                                
                                                // 應用刪除線
                                                if (isStrike)
                                                {
                                                    formattedContent = $"<s>{formattedContent}</s>";
                                                }
                                                
                                                // 應用斜體
                                                if (isItalic)
                                                {
                                                    formattedContent = $"<em>{formattedContent}</em>";
                                                }
                                                
                                                // 應用粗體
                                                if (isBold)
                                                {
                                                    formattedContent = $"<strong>{formattedContent}</strong>";
                                                }
                                                
                                                // 應用字體樣式
                                                if (!string.IsNullOrEmpty(style))
                                                {
                                                    formattedContent = $"<span{style}>{formattedContent}</span>";
                                                }
                                                
                                                htmlBuilder.Append(formattedContent);
                                            }
                                        }
                                    }
                                    
                                    htmlBuilder.AppendLine($"</{tag}>");
                                }
                                
                                htmlBuilder.AppendLine("</tr>");
                            }
                            
                            htmlBuilder.AppendLine("</table>");
                        }
                        
                        Console.WriteLine($"✅ [ConvertWordToHtml] 表格處理完成，共處理 {tableCount} 個表格");

                        // 處理圖片（如果有的話）
                        if (mainPart.ImageParts != null && mainPart.ImageParts.Any())
                        {
                            var imageCount = mainPart.ImageParts.Count();
                            Console.WriteLine($"🖼️ [ConvertWordToHtml] 發現 {imageCount} 個圖片");
                            
                            var imageIndex = 0;
                            foreach (var imagePart in mainPart.ImageParts)
                            {
                                if (imagePart == null) continue;
                                
                                imageIndex++;
                                Console.WriteLine($"🖼️ [ConvertWordToHtml] 處理圖片 #{imageIndex}");
                                
                                try
                                {
                                    // 獲取圖片數據
                                    using (var imageStream = imagePart.GetStream())
                                    {
                                        var imageBytes = new byte[imageStream.Length];
                                        imageStream.Read(imageBytes, 0, (int)imageStream.Length);
                                        
                                        // 轉換為 base64
                                        var base64String = Convert.ToBase64String(imageBytes);
                                        var contentType = imagePart.ContentType;
                                        
                                        Console.WriteLine($"🖼️ [ConvertWordToHtml] 圖片類型: {contentType}, 大小: {imageBytes.Length} bytes");
                                        
                                        // 嵌入圖片到 HTML
                                        htmlBuilder.AppendLine($"<img src=\"data:{contentType};base64,{base64String}\" alt=\"圖片 {imageIndex}\" style=\"max-width: 100%; height: auto; margin: 10px 0;\" />");
                                    }
                                }
                                catch (Exception ex)
                                {
                                    Console.WriteLine($"❌ [ConvertWordToHtml] 處理圖片 #{imageIndex} 時發生錯誤: {ex.Message}");
                                    htmlBuilder.AppendLine($"<p style='color: red;'>圖片 {imageIndex} 處理失敗: {ex.Message}</p>");
                                }
                            }
                        }
                        else
                        {
                            Console.WriteLine($"ℹ️ [ConvertWordToHtml] 沒有發現圖片");
                        }
                    }
                    else
                    {
                        Console.WriteLine($"❌ [ConvertWordToHtml] Document Body 為 null，無法處理內容");
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ [ConvertWordToHtml] 轉換過程中發生錯誤: {ex.Message}");
                Console.WriteLine($"❌ [ConvertWordToHtml] 錯誤堆疊: {ex.StackTrace}");
                htmlBuilder.AppendLine($"<p style='color: red;'>轉換錯誤: {ex.Message}</p>");
            }

            htmlBuilder.AppendLine("</body>");
            htmlBuilder.AppendLine("</html>");

            var result = htmlBuilder.ToString();
            Console.WriteLine($"✅ [ConvertWordToHtml] 轉換完成，HTML 長度: {result.Length} 字符");
            Console.WriteLine($"📄 [ConvertWordToHtml] HTML 前 200 字符: {result.Substring(0, Math.Min(200, result.Length))}...");

            return result;
        }

        /// <summary>
        /// 獲取表單列表（支持分頁和排序）
        /// </summary>
        [HttpGet("forms")]
        public async Task<IActionResult> GetForms(
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 10,
            [FromQuery] string sortField = "createdAt",
            [FromQuery] string sortOrder = "desc")
        {
            try
            {
                Console.WriteLine($"📋 [GetForms] 獲取表單列表 - 頁面: {page}, 每頁: {pageSize}, 排序: {sortField} {sortOrder}");

                var query = _context.eFormDefinitions.AsQueryable();

                // 應用排序
                query = sortField.ToLower() switch
                {
                    "name" => sortOrder.ToLower() == "asc" ? query.OrderBy(f => f.Name) : query.OrderByDescending(f => f.Name),
                    "updatedat" => sortOrder.ToLower() == "asc" ? query.OrderBy(f => f.UpdatedAt) : query.OrderByDescending(f => f.UpdatedAt),
                    "status" => sortOrder.ToLower() == "asc" ? query.OrderBy(f => f.Status) : query.OrderByDescending(f => f.Status),
                    _ => sortOrder.ToLower() == "asc" ? query.OrderBy(f => f.CreatedAt) : query.OrderByDescending(f => f.CreatedAt)
                };

                // 計算總數
                var total = await query.CountAsync();

                // 應用分頁
                var forms = await query
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .Select(f => new
                    {
                        f.Id,
                        f.Name,
                        f.Description,
                        f.Status,
                        f.CreatedAt,
                        f.UpdatedAt,
                        f.SourceFilePath
                    })
                    .ToListAsync();

                Console.WriteLine($"✅ [GetForms] 成功獲取 {forms.Count} 個表單，總計 {total} 個");

                return Ok(new
                {
                    success = true,
                    data = forms,
                    total = total,
                    page = page,
                    pageSize = pageSize,
                    sortField = sortField,
                    sortOrder = sortOrder
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ [GetForms] 獲取表單列表失敗: {ex.Message}");
                return StatusCode(500, new { success = false, error = $"獲取表單列表失敗: {ex.Message}" });
            }
        }

        /// <summary>
        /// 批量刪除表單
        /// </summary>
        [HttpDelete("batch-delete")]
        public async Task<IActionResult> BatchDeleteForms([FromBody] BatchDeleteRequest request)
        {
            try
            {
                Console.WriteLine($"🗑️ [BatchDeleteForms] 批量刪除表單 - 數量: {request.FormIds?.Count ?? 0}");

                if (request.FormIds == null || !request.FormIds.Any())
                {
                    return BadRequest(new { success = false, error = "請提供要刪除的表單 ID" });
                }

                var formsToDelete = await _context.eFormDefinitions
                    .Where(f => request.FormIds.Contains(f.Id))
                    .ToListAsync();

                if (!formsToDelete.Any())
                {
                    return NotFound(new { success = false, error = "未找到要刪除的表單" });
                }

                // 刪除相關文件
                foreach (var form in formsToDelete)
                {
                    try
                    {
                        if (!string.IsNullOrEmpty(form.SourceFilePath))
                        {
                            var filePath = Path.Combine(_uploadPath, form.SourceFilePath);
                                                    if (System.IO.File.Exists(filePath))
                        {
                            System.IO.File.Delete(filePath);
                            Console.WriteLine($"🗑️ [BatchDeleteForms] 刪除文件: {filePath}");
                        }

                        // 刪除相關的 HTML 和圖片文件
                        var directory = Path.GetDirectoryName(filePath);
                        if (Directory.Exists(directory))
                        {
                            var relatedFiles = Directory.GetFiles(directory, $"{Path.GetFileNameWithoutExtension(filePath)}*");
                            foreach (var relatedFile in relatedFiles)
                            {
                                System.IO.File.Delete(relatedFile);
                                Console.WriteLine($"🗑️ [BatchDeleteForms] 刪除相關文件: {relatedFile}");
                            }
                        }
                        }
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"⚠️ [BatchDeleteForms] 刪除文件時發生錯誤: {ex.Message}");
                    }
                }

                // 從資料庫刪除
                _context.eFormDefinitions.RemoveRange(formsToDelete);
                await _context.SaveChangesAsync();

                Console.WriteLine($"✅ [BatchDeleteForms] 成功刪除 {formsToDelete.Count} 個表單");

                return Ok(new
                {
                    success = true,
                    deletedCount = formsToDelete.Count,
                    message = $"成功刪除 {formsToDelete.Count} 個表單"
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ [BatchDeleteForms] 批量刪除失敗: {ex.Message}");
                return StatusCode(500, new { success = false, error = $"批量刪除失敗: {ex.Message}" });
            }
        }

        /// <summary>
        /// 刪除單個表單
        /// </summary>
        [HttpDelete("delete/{id}")]
        public async Task<IActionResult> DeleteForm(Guid id)
        {
            try
            {
                Console.WriteLine($"🗑️ [DeleteForm] 刪除表單 - ID: {id}");

                var form = await _context.eFormDefinitions.FindAsync(id);
                if (form == null)
                {
                    return NotFound(new { success = false, error = "未找到要刪除的表單" });
                }

                // 刪除相關文件
                try
                {
                    if (!string.IsNullOrEmpty(form.SourceFilePath))
                    {
                        var filePath = Path.Combine(_uploadPath, form.SourceFilePath);
                        if (System.IO.File.Exists(filePath))
                        {
                            System.IO.File.Delete(filePath);
                            Console.WriteLine($"🗑️ [DeleteForm] 刪除文件: {filePath}");
                        }

                        // 刪除相關的 HTML 和圖片文件
                        var directory = Path.GetDirectoryName(filePath);
                        if (Directory.Exists(directory))
                        {
                            var relatedFiles = Directory.GetFiles(directory, $"{Path.GetFileNameWithoutExtension(filePath)}*");
                            foreach (var relatedFile in relatedFiles)
                            {
                                System.IO.File.Delete(relatedFile);
                                Console.WriteLine($"🗑️ [DeleteForm] 刪除相關文件: {relatedFile}");
                            }
                        }
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"⚠️ [DeleteForm] 刪除文件時發生錯誤: {ex.Message}");
                }

                // 從資料庫刪除
                _context.eFormDefinitions.Remove(form);
                await _context.SaveChangesAsync();

                Console.WriteLine($"✅ [DeleteForm] 成功刪除表單: {form.Name}");

                return Ok(new
                {
                    success = true,
                    message = "表單已成功刪除"
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ [DeleteForm] 刪除失敗: {ex.Message}");
                return StatusCode(500, new { success = false, error = $"刪除失敗: {ex.Message}" });
            }
        }

        [HttpGet("test")]
        public IActionResult Test()
        {
            return Ok(new { message = "Upload API 正常運作" });
        }

        /// <summary>
        /// AI 生成表單
        /// </summary>
        [HttpPost("ai-generate")]
        public async Task<IActionResult> GenerateFormWithAI([FromBody] AiGenerateRequest request)
        {
            try
            {
                Console.WriteLine($"🤖 [GenerateFormWithAI] 開始 AI 生成表單");
                Console.WriteLine($"🤖 [GenerateFormWithAI] 用戶提示: {request.Prompt}");
                Console.WriteLine($"🤖 [GenerateFormWithAI] 包含當前 HTML: {request.IncludeCurrentHtml}");
                if (request.IncludeCurrentHtml && !string.IsNullOrEmpty(request.CurrentHtml))
                {
                    Console.WriteLine($"🤖 [GenerateFormWithAI] 當前 HTML 長度: {request.CurrentHtml.Length}");
                }

                // 獲取 X.AI 配置
                var apiKey = _configuration["XAI:ApiKey"];
                var defaultSystemPrompt = _configuration["XAI:DefaultSystemPrompt"];

                if (string.IsNullOrEmpty(apiKey))
                {
                    Console.WriteLine($"❌ [GenerateFormWithAI] X.AI API Key 未配置");
                    return BadRequest(new { success = false, error = "X.AI API Key 未配置" });
                }

                // 檢查是否為測試 API Key
                if (apiKey.Contains("test-key") || apiKey.Contains("please-replace"))
                {
                    Console.WriteLine($"🧪 [GenerateFormWithAI] 使用測試模式，生成模擬響應");
                    
                    // 生成模擬的 HTML 表單
                    var mockHtmlContent = GenerateMockHtmlForm(request.Prompt, request.IncludeCurrentHtml, request.CurrentHtml);
                    var mockFormName = ExtractFormNameFromPrompt(request.Prompt) ?? "AI 生成的表單";
                    
                    return Ok(new
                    {
                        success = true,
                        htmlContent = mockHtmlContent,
                        formName = mockFormName,
                        message = "測試模式：已生成模擬表單"
                    });
                }

                // 構建用戶消息
                var userMessage = request.Prompt;
                if (request.IncludeCurrentHtml && !string.IsNullOrEmpty(request.CurrentHtml))
                {
                    userMessage = $"用戶需求：{request.Prompt}\n\n當前 HTML 內容：\n{request.CurrentHtml}\n\n請基於以上內容進行修改和優化。";
                }

                // 從配置文件中獲取 AI 模型參數
                var model = _configuration["XAI:Model"] ?? "grok-3";
                var stream = _configuration.GetValue<bool>("XAI:Stream", true);
                var temperature = _configuration.GetValue<double>("XAI:Temperature", 0.8);
                var maxTokens = _configuration.GetValue<int>("XAI:MaxTokens", 15000);
                var topP = _configuration.GetValue<double>("XAI:TopP", 0.9);

                Console.WriteLine($"🤖 [GenerateFormWithAI] 模型: {model}");
                Console.WriteLine($"🤖 [GenerateFormWithAI] 流式響應: {stream}");
                Console.WriteLine($"🤖 [GenerateFormWithAI] 溫度: {temperature}");
                Console.WriteLine($"🤖 [GenerateFormWithAI] 最大 Token: {maxTokens}");
                Console.WriteLine($"🤖 [GenerateFormWithAI] Top P: {topP}");

                // 構建請求 - 使用配置文件中的參數
                var aiRequest = new
                {
                    messages = new[]
                    {
                        new { role = "system", content = defaultSystemPrompt },
                        new { role = "user", content = userMessage }
                    },
                    model = model,
                    stream = stream,
                    temperature = temperature,
                    max_tokens = maxTokens,
                    top_p = topP
                };

                Console.WriteLine($"🤖 [GenerateFormWithAI] 發送請求到 X.AI API");

                using (var httpClient = new HttpClient())
                {
                    // 設置更長的超時時間，因為 AI 生成可能需要較長時間
                    httpClient.Timeout = TimeSpan.FromMinutes(10); // 10分鐘超時
                    httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {apiKey}");
                    httpClient.DefaultRequestHeaders.Add("User-Agent", "PurpleRice-FormGenerator/1.0");
                    // 移除錯誤的 Content-Type 頭部設置
                    // httpClient.DefaultRequestHeaders.Add("Content-Type", "application/json");

                    var jsonContent = JsonConvert.SerializeObject(aiRequest);
                    var content = new StringContent(jsonContent, Encoding.UTF8, "application/json");

                    Console.WriteLine($"🤖 [GenerateFormWithAI] 請求內容: {jsonContent}");
                    Console.WriteLine($"🤖 [GenerateFormWithAI] API Key: {apiKey.Substring(0, 10)}...");
                    Console.WriteLine($"🤖 [GenerateFormWithAI] 請求 URL: https://api.x.ai/v1/chat/completions");

                    try
                    {
                        // 使用正確的 X.AI API 端點
                        var response = await httpClient.PostAsync("https://api.x.ai/v1/chat/completions", content);
                        
                        Console.WriteLine($"🤖 [GenerateFormWithAI] X.AI 響應狀態: {response.StatusCode}");

                        if (!response.IsSuccessStatusCode)
                        {
                            var errorContent = await response.Content.ReadAsStringAsync();
                            Console.WriteLine($"❌ [GenerateFormWithAI] X.AI API 請求失敗: {response.StatusCode} - {errorContent}");
                            return StatusCode(500, new { success = false, error = $"X.AI API 請求失敗: {response.StatusCode} - {errorContent}" });
                        }

                        // 處理流式響應
                        var responseStream = await response.Content.ReadAsStreamAsync();
                        var reader = new StreamReader(responseStream);
                        var fullResponse = new StringBuilder();
                        
                        Console.WriteLine($"🤖 [GenerateFormWithAI] 開始處理流式響應...");
                        
                        string line;
                        while ((line = await reader.ReadLineAsync()) != null)
                        {
                            if (line.StartsWith("data: "))
                            {
                                var data = line.Substring(6);
                                if (data == "[DONE]")
                                {
                                    Console.WriteLine($"🤖 [GenerateFormWithAI] 流式響應完成");
                                    break;
                                }
                                
                                try
                                {
                                    var jsonData = JsonConvert.DeserializeObject<dynamic>(data);
                                    var streamContent = jsonData?.choices?[0]?.delta?.content?.ToString();
                                    if (!string.IsNullOrEmpty(streamContent))
                                    {
                                        fullResponse.Append(streamContent);
                                    }
                                }
                                catch (Exception ex)
                                {
                                    Console.WriteLine($"⚠️ [GenerateFormWithAI] 解析流式數據時發生錯誤: {ex.Message}");
                                }
                            }
                        }

                        var generatedContent = fullResponse.ToString();
                        Console.WriteLine($"🤖 [GenerateFormWithAI] 完整響應長度: {generatedContent.Length}");

                        if (string.IsNullOrEmpty(generatedContent))
                        {
                            Console.WriteLine($"❌ [GenerateFormWithAI] AI 生成內容為空");
                            return BadRequest(new { success = false, error = "AI 生成內容為空" });
                        }

                        Console.WriteLine($"✅ [GenerateFormWithAI] AI 生成成功，內容長度: {generatedContent.Length}");

                        // 提取 HTML 內容
                        var htmlContent = ExtractHtmlFromResponse(generatedContent);
                        var formName = ExtractFormNameFromResponse(generatedContent) ?? "AI 生成的表單";

                        Console.WriteLine($"✅ [GenerateFormWithAI] 提取的 HTML 長度: {htmlContent.Length}");
                        Console.WriteLine($"✅ [GenerateFormWithAI] 表單名稱: {formName}");

                        return Ok(new
                        {
                            success = true,
                            htmlContent = htmlContent,
                            formName = formName,
                            message = "AI 已成功生成表單"
                        });
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"❌ [GenerateFormWithAI] HTTP 請求異常: {ex.Message}");
                        Console.WriteLine($"❌ [GenerateFormWithAI] 異常類型: {ex.GetType().Name}");
                        Console.WriteLine($"❌ [GenerateFormWithAI] 錯誤堆疊: {ex.StackTrace}");
                        return StatusCode(500, new { success = false, error = $"HTTP 請求異常: {ex.Message}" });
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ [GenerateFormWithAI] AI 生成失敗: {ex.Message}");
                Console.WriteLine($"❌ [GenerateFormWithAI] 錯誤堆疊: {ex.StackTrace}");
                return StatusCode(500, new { success = false, error = $"AI 生成失敗: {ex.Message}" });
            }
        }

        /// <summary>
        /// 從 AI 響應中提取 HTML 內容
        /// </summary>
        private string ExtractHtmlFromResponse(string response)
        {
            try
            {
                Console.WriteLine($"🔍 [ExtractHtmlFromResponse] 開始提取 HTML，響應長度: {response.Length}");
                
                // 嘗試提取 ```html 和 ``` 之間的內容
                var htmlStart = response.IndexOf("```html");
                if (htmlStart >= 0)
                {
                    var startIndex = htmlStart + 7; // "```html" 的長度
                    var endIndex = response.IndexOf("```", startIndex);
                    if (endIndex >= 0)
                    {
                        var htmlContent = response.Substring(startIndex, endIndex - startIndex).Trim();
                        Console.WriteLine($"✅ [ExtractHtmlFromResponse] 找到 ```html 代碼塊，長度: {htmlContent.Length}");
                        return htmlContent;
                    }
                }

                // 嘗試提取 ``` 和 ``` 之間的內容（如果沒有 html 標記）
                var codeStart = response.IndexOf("```");
                if (codeStart >= 0)
                {
                    var startIndex = codeStart + 3;
                    var endIndex = response.IndexOf("```", startIndex);
                    if (endIndex >= 0)
                    {
                        var codeContent = response.Substring(startIndex, endIndex - startIndex).Trim();
                        // 檢查是否包含 HTML 標籤
                        if (codeContent.Contains("<html") || codeContent.Contains("<!DOCTYPE") || codeContent.Contains("<head>") || codeContent.Contains("<body>"))
                        {
                            Console.WriteLine($"✅ [ExtractHtmlFromResponse] 找到代碼塊包含 HTML，長度: {codeContent.Length}");
                            return codeContent;
                        }
                    }
                }

                // 如果沒有找到代碼塊，嘗試提取 <html 開始的內容
                var htmlTagStart = response.IndexOf("<html");
                if (htmlTagStart >= 0)
                {
                    var htmlContent = response.Substring(htmlTagStart).Trim();
                    Console.WriteLine($"✅ [ExtractHtmlFromResponse] 找到 <html 標籤，長度: {htmlContent.Length}");
                    return htmlContent;
                }

                // 嘗試提取 <!DOCTYPE 開始的內容
                var doctypeStart = response.IndexOf("<!DOCTYPE");
                if (doctypeStart >= 0)
                {
                    var htmlContent = response.Substring(doctypeStart).Trim();
                    Console.WriteLine($"✅ [ExtractHtmlFromResponse] 找到 <!DOCTYPE，長度: {htmlContent.Length}");
                    return htmlContent;
                }

                // 如果都沒有找到，檢查是否包含 HTML 標籤
                if (response.Contains("<head>") || response.Contains("<body>") || response.Contains("<table>"))
                {
                    Console.WriteLine($"⚠️ [ExtractHtmlFromResponse] 未找到明確的 HTML 標記，但包含 HTML 標籤，返回完整響應");
                    return response.Trim();
                }

                Console.WriteLine($"❌ [ExtractHtmlFromResponse] 未找到任何 HTML 內容");
                return response.Trim();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"⚠️ [ExtractHtmlFromResponse] 提取 HTML 時發生錯誤: {ex.Message}");
                return response.Trim();
            }
        }

        /// <summary>
        /// 從 AI 響應中提取表單名稱
        /// </summary>
        private string ExtractFormNameFromResponse(string response)
        {
            try
            {
                // 嘗試從響應中提取表單名稱
                var lines = response.Split('\n');
                foreach (var line in lines)
                {
                    if (line.Contains("表單名稱") || line.Contains("Form Name") || line.Contains("名稱"))
                    {
                        var colonIndex = line.IndexOf(':');
                        if (colonIndex >= 0)
                        {
                            return line.Substring(colonIndex + 1).Trim();
                        }
                    }
                }

                // 如果沒有找到明確的名稱，嘗試從標題中提取
                var titleMatch = System.Text.RegularExpressions.Regex.Match(response, @"<title[^>]*>(.*?)</title>", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
                if (titleMatch.Success)
                {
                    return titleMatch.Groups[1].Value.Trim();
                }

                return null;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"⚠️ [ExtractFormNameFromResponse] 提取表單名稱時發生錯誤: {ex.Message}");
                return null;
            }
        }

        /// <summary>
        /// 生成模擬的 HTML 表單
        /// </summary>
        private string GenerateMockHtmlForm(string prompt, bool includeCurrentHtml = false, string currentHtml = "")
        {
            // 如果包含當前 HTML，則基於當前內容進行修改
            if (includeCurrentHtml && !string.IsNullOrEmpty(currentHtml))
            {
                // 簡單的修改：在現有內容基礎上添加一些改進
                var modifiedHtml = currentHtml;
                
                // 如果沒有樣式，添加豐富的樣式
                if (!modifiedHtml.Contains("<style>"))
                {
                    var styleInsertion = "<style>\n" +
                        "* { box-sizing: border-box; }\n" +
                        "body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background-color: #f5f5f5; }\n" +
                        ".form-container { max-width: 800px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow: hidden; }\n" +
                        ".form-header { background: linear-gradient(135deg, #2c3e50, #34495e); color: white; padding: 20px; text-align: center; }\n" +
                        ".form-header h1 { margin: 0; font-size: 24px; font-weight: 600; }\n" +
                        ".form-header p { margin: 10px 0 0 0; opacity: 0.9; }\n" +
                        ".form-body { padding: 30px; }\n" +
                        "table { border-collapse: collapse; width: 100%; margin: 15px 0; border-radius: 6px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }\n" +
                        "table, th, td { border: 1px solid #bdc3c7; }\n" +
                        "th, td { padding: 12px 15px; text-align: left; }\n" +
                        "th { background: linear-gradient(135deg, #3498db, #2980b9); color: white; font-weight: 600; text-transform: uppercase; font-size: 14px; }\n" +
                        "tr:nth-child(even) { background-color: #f8f9fa; }\n" +
                        "tr:nth-child(odd) { background-color: #ffffff; }\n" +
                        "tr:hover { background-color: #e8f4fd; transition: background-color 0.3s ease; }\n" +
                        ".form-group { margin-bottom: 20px; }\n" +
                        "label { display: block; margin-bottom: 5px; font-weight: 600; color: #2c3e50; }\n" +
                        "input[type=\"text\"], input[type=\"email\"], input[type=\"date\"], select, textarea { width: 100%; padding: 12px; border: 2px solid #3498db; border-radius: 4px; font-size: 14px; transition: border-color 0.3s ease; }\n" +
                        "input[type=\"text\"]:focus, input[type=\"email\"]:focus, input[type=\"date\"]:focus, select:focus, textarea:focus { outline: none; border-color: #e74c3c; box-shadow: 0 0 5px rgba(231, 76, 60, 0.3); }\n" +
                        "textarea { resize: vertical; min-height: 100px; }\n" +
                        ".submit-btn { background: linear-gradient(135deg, #e74c3c, #c0392b); color: white; padding: 15px 30px; border: none; border-radius: 6px; font-size: 16px; font-weight: 600; cursor: pointer; transition: transform 0.2s ease; }\n" +
                        ".submit-btn:hover { transform: translateY(-2px); box-shadow: 0 4px 8px rgba(231, 76, 60, 0.3); }\n" +
                        ".required { color: #e74c3c; }\n" +
                        "@media (max-width: 768px) { .form-container { margin: 10px; } .form-body { padding: 20px; } }\n" +
                        "</style>";
                    modifiedHtml = modifiedHtml.Replace("</head>", styleInsertion + "\n</head>");
                }
                else
                {
                    // 如果已有樣式，嘗試增強現有樣式
                    var enhancedStyles = "\n" +
                        "table { border-collapse: collapse; width: 100%; margin: 15px 0; border-radius: 6px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }\n" +
                        "table, th, td { border: 1px solid #bdc3c7; }\n" +
                        "th, td { padding: 12px 15px; text-align: left; }\n" +
                        "th { background: linear-gradient(135deg, #3498db, #2980b9); color: white; font-weight: 600; text-transform: uppercase; font-size: 14px; }\n" +
                        "tr:nth-child(even) { background-color: #f8f9fa; }\n" +
                        "tr:nth-child(odd) { background-color: #ffffff; }\n" +
                        "tr:hover { background-color: #e8f4fd; transition: background-color 0.3s ease; }\n" +
                        "input[type=\"text\"], input[type=\"email\"], input[type=\"date\"], select, textarea { border: 2px solid #3498db; border-radius: 4px; transition: border-color 0.3s ease; }\n" +
                        "input[type=\"text\"]:focus, input[type=\"email\"]:focus, input[type=\"date\"]:focus, select:focus, textarea:focus { outline: none; border-color: #e74c3c; box-shadow: 0 0 5px rgba(231, 76, 60, 0.3); }\n" +
                        ".submit-btn { background: linear-gradient(135deg, #e74c3c, #c0392b); color: white; padding: 15px 30px; border: none; border-radius: 6px; font-size: 16px; font-weight: 600; cursor: pointer; transition: transform 0.2s ease; }\n" +
                        ".submit-btn:hover { transform: translateY(-2px); box-shadow: 0 4px 8px rgba(231, 76, 60, 0.3); }\n";
                    
                    // 在現有樣式後添加增強樣式
                    modifiedHtml = modifiedHtml.Replace("</style>", enhancedStyles + "\n</style>");
                }
                
                // 添加一個註釋說明這是修改後的版本
                modifiedHtml = modifiedHtml.Replace("<body>", "<body>\n<!-- 由 AI 修改和優化的表單 -->");
                
                return modifiedHtml;
            }
            
            // 生成全新的模擬表單
            var htmlBuilder = new StringBuilder();
            htmlBuilder.AppendLine("<!DOCTYPE html>");
            htmlBuilder.AppendLine("<html>");
            htmlBuilder.AppendLine("<head>");
            htmlBuilder.AppendLine("<meta charset=\"utf-8\">");
            htmlBuilder.AppendLine("<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">");
            htmlBuilder.AppendLine("<title>專業表單設計</title>");
            htmlBuilder.AppendLine("<style>");
            htmlBuilder.AppendLine("* { box-sizing: border-box; }");
            htmlBuilder.AppendLine("body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; margin: 0; padding: 20px; background-color: #f5f5f5; }");
            htmlBuilder.AppendLine(".form-container { max-width: 800px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow: hidden; }");
            htmlBuilder.AppendLine(".form-header { background: linear-gradient(135deg, #2c3e50, #34495e); color: white; padding: 20px; text-align: center; }");
            htmlBuilder.AppendLine(".form-header h1 { margin: 0; font-size: 24px; font-weight: 600; }");
            htmlBuilder.AppendLine(".form-header p { margin: 10px 0 0 0; opacity: 0.9; }");
            htmlBuilder.AppendLine(".form-body { padding: 30px; }");
            htmlBuilder.AppendLine("table { border-collapse: collapse; width: 100%; margin: 15px 0; border-radius: 6px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }");
            htmlBuilder.AppendLine("table, th, td { border: 1px solid #bdc3c7; }");
            htmlBuilder.AppendLine("th, td { padding: 12px 15px; text-align: left; }");
            htmlBuilder.AppendLine("th { background: linear-gradient(135deg, #3498db, #2980b9); color: white; font-weight: 600; text-transform: uppercase; font-size: 14px; }");
            htmlBuilder.AppendLine("tr:nth-child(even) { background-color: #f8f9fa; }");
            htmlBuilder.AppendLine("tr:nth-child(odd) { background-color: #ffffff; }");
            htmlBuilder.AppendLine("tr:hover { background-color: #e8f4fd; transition: background-color 0.3s ease; }");
            htmlBuilder.AppendLine(".form-group { margin-bottom: 20px; }");
            htmlBuilder.AppendLine("label { display: block; margin-bottom: 5px; font-weight: 600; color: #2c3e50; }");
            htmlBuilder.AppendLine("input[type=\"text\"], input[type=\"email\"], input[type=\"date\"], select, textarea { width: 100%; padding: 12px; border: 2px solid #3498db; border-radius: 4px; font-size: 14px; transition: border-color 0.3s ease; }");
            htmlBuilder.AppendLine("input[type=\"text\"]:focus, input[type=\"email\"]:focus, input[type=\"date\"]:focus, select:focus, textarea:focus { outline: none; border-color: #e74c3c; box-shadow: 0 0 5px rgba(231, 76, 60, 0.3); }");
            htmlBuilder.AppendLine("textarea { resize: vertical; min-height: 100px; }");
            htmlBuilder.AppendLine(".submit-btn { background: linear-gradient(135deg, #e74c3c, #c0392b); color: white; padding: 15px 30px; border: none; border-radius: 6px; font-size: 16px; font-weight: 600; cursor: pointer; transition: transform 0.2s ease; }");
            htmlBuilder.AppendLine(".submit-btn:hover { transform: translateY(-2px); box-shadow: 0 4px 8px rgba(231, 76, 60, 0.3); }");
            htmlBuilder.AppendLine(".required { color: #e74c3c; }");
            htmlBuilder.AppendLine("@media (max-width: 768px) { .form-container { margin: 10px; } .form-body { padding: 20px; } }");
            htmlBuilder.AppendLine("</style>");
            htmlBuilder.AppendLine("</head>");
            htmlBuilder.AppendLine("<body>");
            htmlBuilder.AppendLine("<div class=\"form-container\">");
            htmlBuilder.AppendLine("<div class=\"form-header\">");
            htmlBuilder.AppendLine("<h1>專業申請表單</h1>");
            htmlBuilder.AppendLine("<p>請填寫以下信息，所有標記 * 的欄位為必填項</p>");
            htmlBuilder.AppendLine("</div>");
            htmlBuilder.AppendLine("<div class=\"form-body\">");
            htmlBuilder.AppendLine("<form action=\"#\" method=\"post\">");
            htmlBuilder.AppendLine("<table>");
            htmlBuilder.AppendLine("<thead>");
            htmlBuilder.AppendLine("<tr>");
            htmlBuilder.AppendLine("<th colspan=\"2\">申請人基本信息</th>");
            htmlBuilder.AppendLine("</tr>");
            htmlBuilder.AppendLine("</thead>");
            htmlBuilder.AppendLine("<tbody>");
            htmlBuilder.AppendLine("<tr>");
            htmlBuilder.AppendLine("<td><label for=\"name\">姓名 <span class=\"required\">*</span></label></td>");
            htmlBuilder.AppendLine("<td><input type=\"text\" id=\"name\" name=\"name\" required placeholder=\"請輸入您的姓名\"></td>");
            htmlBuilder.AppendLine("</tr>");
            htmlBuilder.AppendLine("<tr>");
            htmlBuilder.AppendLine("<td><label for=\"email\">電子郵件 <span class=\"required\">*</span></label></td>");
            htmlBuilder.AppendLine("<td><input type=\"email\" id=\"email\" name=\"email\" required placeholder=\"請輸入您的電子郵件\"></td>");
            htmlBuilder.AppendLine("</tr>");
            htmlBuilder.AppendLine("<tr>");
            htmlBuilder.AppendLine("<td><label for=\"phone\">聯絡電話</label></td>");
            htmlBuilder.AppendLine("<td><input type=\"text\" id=\"phone\" name=\"phone\" placeholder=\"請輸入您的聯絡電話\"></td>");
            htmlBuilder.AppendLine("</tr>");
            htmlBuilder.AppendLine("<tr>");
            htmlBuilder.AppendLine("<td><label for=\"department\">所屬部門</label></td>");
            htmlBuilder.AppendLine("<td><select id=\"department\" name=\"department\">");
            htmlBuilder.AppendLine("<option value=\"\">請選擇部門</option>");
            htmlBuilder.AppendLine("<option value=\"hr\">人力資源部</option>");
            htmlBuilder.AppendLine("<option value=\"it\">資訊技術部</option>");
            htmlBuilder.AppendLine("<option value=\"finance\">財務部</option>");
            htmlBuilder.AppendLine("<option value=\"marketing\">行銷部</option>");
            htmlBuilder.AppendLine("</select></td>");
            htmlBuilder.AppendLine("</tr>");
            htmlBuilder.AppendLine("</tbody>");
            htmlBuilder.AppendLine("</table>");
            htmlBuilder.AppendLine("<table>");
            htmlBuilder.AppendLine("<thead>");
            htmlBuilder.AppendLine("<tr>");
            htmlBuilder.AppendLine("<th colspan=\"2\">申請詳情</th>");
            htmlBuilder.AppendLine("</tr>");
            htmlBuilder.AppendLine("</thead>");
            htmlBuilder.AppendLine("<tbody>");
            htmlBuilder.AppendLine("<tr>");
            htmlBuilder.AppendLine("<td><label for=\"request_type\">申請類型 <span class=\"required\">*</span></label></td>");
            htmlBuilder.AppendLine("<td><select id=\"request_type\" name=\"request_type\" required>");
            htmlBuilder.AppendLine("<option value=\"\">請選擇申請類型</option>");
            htmlBuilder.AppendLine("<option value=\"leave\">請假申請</option>");
            htmlBuilder.AppendLine("<option value=\"equipment\">設備申請</option>");
            htmlBuilder.AppendLine("<option value=\"training\">培訓申請</option>");
            htmlBuilder.AppendLine("<option value=\"other\">其他申請</option>");
            htmlBuilder.AppendLine("</select></td>");
            htmlBuilder.AppendLine("</tr>");
            htmlBuilder.AppendLine("<tr>");
            htmlBuilder.AppendLine("<td><label for=\"start_date\">開始日期 <span class=\"required\">*</span></label></td>");
            htmlBuilder.AppendLine("<td><input type=\"date\" id=\"start_date\" name=\"start_date\" required></td>");
            htmlBuilder.AppendLine("</tr>");
            htmlBuilder.AppendLine("<tr>");
            htmlBuilder.AppendLine("<td><label for=\"end_date\">結束日期</label></td>");
            htmlBuilder.AppendLine("<td><input type=\"date\" id=\"end_date\" name=\"end_date\"></td>");
            htmlBuilder.AppendLine("</tr>");
            htmlBuilder.AppendLine("<tr>");
            htmlBuilder.AppendLine("<td><label for=\"description\">申請說明 <span class=\"required\">*</span></label></td>");
            htmlBuilder.AppendLine("<td><textarea id=\"description\" name=\"description\" rows=\"4\" required placeholder=\"請詳細描述您的申請原因和需求\"></textarea></td>");
            htmlBuilder.AppendLine("</tr>");
            htmlBuilder.AppendLine("</tbody>");
            htmlBuilder.AppendLine("</table>");
            htmlBuilder.AppendLine("<div style=\"text-align: center; margin-top: 30px;\">");
            htmlBuilder.AppendLine("<button type=\"submit\" class=\"submit-btn\">提交申請</button>");
            htmlBuilder.AppendLine("</div>");
            htmlBuilder.AppendLine("</form>");
            htmlBuilder.AppendLine("</div>");
            htmlBuilder.AppendLine("</div>");
            htmlBuilder.AppendLine("</body>");
            htmlBuilder.AppendLine("</html>");
            return htmlBuilder.ToString();
        }

        /// <summary>
        /// 從提示中提取表單名稱
        /// </summary>
        private string ExtractFormNameFromPrompt(string prompt)
        {
            if (prompt.Contains("表單名稱"))
            {
                var lines = prompt.Split('\n');
                foreach (var line in lines)
                {
                    if (line.Contains("表單名稱"))
                    {
                        var colonIndex = line.IndexOf(':');
                        if (colonIndex >= 0)
                        {
                            return line.Substring(colonIndex + 1).Trim();
                        }
                    }
                }
            }
            return null;
        }
    }

    public class BatchDeleteRequest
    {
        public List<Guid> FormIds { get; set; } = new List<Guid>();
    }

    public class AiGenerateRequest
    {
        public string Prompt { get; set; } = string.Empty;
        public bool IncludeCurrentHtml { get; set; } = false;
        public string CurrentHtml { get; set; } = string.Empty;
    }
} 