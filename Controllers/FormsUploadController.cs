using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Newtonsoft.Json;
using PurpleRice.Data;
using PurpleRice.Models;
using PurpleRice.Services;
using PurpleRice.Services.ApiProviders;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Claims;
using System.Text;
using System.Threading.Tasks;

namespace PurpleRice.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class FormsUploadController : ControllerBase
    {
        private readonly string _uploadPath = Path.Combine("Uploads", "FormsFiles");
        private readonly PurpleRiceDbContext _context;
        private readonly DocumentConverterService _documentConverter;
        private readonly IConfiguration _configuration;
        private readonly LoggingService _loggingService;
        private readonly IAiCompletionClient _aiCompletionClient;

        public FormsUploadController(PurpleRiceDbContext context, DocumentConverterService documentConverter, IConfiguration configuration, Func<string, LoggingService> loggingServiceFactory, IAiCompletionClient aiCompletionClient)
        {
            _context = context;
            _documentConverter = documentConverter;
            _configuration = configuration;
            _loggingService = loggingServiceFactory("FormsUploadController");
            _aiCompletionClient = aiCompletionClient;
        }

        private Guid GetCurrentCompanyId()
        {
            var companyIdClaim = User?.FindFirst("company_id")
                ?? User?.FindFirst(ClaimTypes.GroupSid)
                ?? User?.FindFirst(ClaimTypes.PrimaryGroupSid);

            if (companyIdClaim != null && Guid.TryParse(companyIdClaim.Value, out var companyId))
            {
                return companyId;
            }

            return Guid.Empty;
        }

        [HttpPost("image")]
        public async Task<IActionResult> UploadImage(IFormFile file)
        {
            try
            {
                if (file == null || file.Length == 0)
                {
                    return BadRequest(new { error = "沒有選擇文件" });
                }

                // 檢查文件類型
                var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".gif", ".bmp" };
                var fileExtension = Path.GetExtension(file.FileName).ToLowerInvariant();
                
                if (!allowedExtensions.Contains(fileExtension))
                {
                    return BadRequest(new { error = "不支持的文件類型，只允許圖片文件" });
                }

                // 生成唯一文件名
                var fileName = $"{DateTime.UtcNow:yyyyMMddHHmmss}_{Guid.NewGuid()}{fileExtension}";
                var filePath = Path.Combine(_uploadPath, fileName);

                // 確保目錄存在
                Directory.CreateDirectory(_uploadPath);

                // 保存文件
                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }

                _loggingService.LogInformation($"圖片文件上傳成功: {fileName}");

                return Ok(new { 
                    success = true, 
                    fileName = fileName,
                    filePath = filePath,
                    message = "圖片上傳成功" 
                });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"圖片文件上傳失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = "圖片上傳失敗" });
            }
        }

        [HttpPost("word")]
        public async Task<IActionResult> UploadWord(IFormFile file)
        {
            try
            {
                if (file == null || file.Length == 0)
                {
                    return BadRequest(new { error = "沒有選擇文件" });
                }

                // 檢查文件類型
                var allowedExtensions = new[] { ".doc", ".docx" };
                var fileExtension = Path.GetExtension(file.FileName).ToLowerInvariant();
                
                if (!allowedExtensions.Contains(fileExtension))
                {
                    return BadRequest(new { error = "不支持的文件類型，只允許 Word 文檔 (.doc, .docx)" });
                }

                // 生成唯一文件名
                var fileName = $"{DateTime.UtcNow:yyyyMMddHHmmss}_{Guid.NewGuid()}{fileExtension}";
                var filePath = Path.Combine(_uploadPath, "Documents", fileName);

                // 確保目錄存在
                Directory.CreateDirectory(Path.GetDirectoryName(filePath));

                // 保存文件
                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }

                _loggingService.LogInformation($"Word 文件上傳成功: {fileName}");

                // 轉換為 HTML
                string htmlContent = null;
                string formName = null;
                try
                {
                    htmlContent = await _documentConverter.ConvertToHtml(filePath);
                    formName = Path.GetFileNameWithoutExtension(file.FileName);
                    _loggingService.LogInformation($"Word 文件轉換為 HTML 成功: {fileName}");
                }
                catch (Exception convertEx)
                {
                    _loggingService.LogWarning($"Word 文件轉換為 HTML 失敗: {convertEx.Message}");
                    return StatusCode(500, new { error = "Word 文件轉換失敗: " + convertEx.Message });
                }

                return Ok(new { 
                    success = true, 
                    fileName = fileName,
                    filePath = filePath,
                    htmlContent = htmlContent,
                    formName = formName,
                    message = "Word 文件上傳並轉換成功" 
                });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"Word 文件上傳失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = "Word 文件上傳失敗" });
            }
        }

        [HttpPost("excel")]
        public async Task<IActionResult> UploadExcel(IFormFile file)
        {
            try
            {
                if (file == null || file.Length == 0)
                {
                    return BadRequest(new { error = "沒有選擇文件" });
                }

                // 檢查文件類型
                var allowedExtensions = new[] { ".xls", ".xlsx" };
                var fileExtension = Path.GetExtension(file.FileName).ToLowerInvariant();
                
                if (!allowedExtensions.Contains(fileExtension))
                {
                    return BadRequest(new { error = "不支持的文件類型，只允許 Excel 文件 (.xls, .xlsx)" });
                }

                // 生成唯一文件名
                var fileName = $"{DateTime.UtcNow:yyyyMMddHHmmss}_{Guid.NewGuid()}{fileExtension}";
                var filePath = Path.Combine(_uploadPath, "Documents", fileName);

                // 確保目錄存在
                Directory.CreateDirectory(Path.GetDirectoryName(filePath));

                // 保存文件
                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }

                _loggingService.LogInformation($"Excel 文件上傳成功: {fileName}");

                // 轉換為 HTML
                string htmlContent = null;
                string formName = null;
                try
                {
                    htmlContent = await _documentConverter.ConvertToHtml(filePath);
                    formName = Path.GetFileNameWithoutExtension(file.FileName);
                    _loggingService.LogInformation($"Excel 文件轉換為 HTML 成功: {fileName}");
                }
                catch (Exception convertEx)
                {
                    _loggingService.LogWarning($"Excel 文件轉換為 HTML 失敗: {convertEx.Message}");
                    return StatusCode(500, new { error = "Excel 文件轉換失敗: " + convertEx.Message });
                }

                return Ok(new { 
                    success = true, 
                    fileName = fileName,
                    filePath = filePath,
                    htmlContent = htmlContent,
                    formName = formName,
                    message = "Excel 文件上傳並轉換成功" 
                });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"Excel 文件上傳失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = "Excel 文件上傳失敗" });
            }
        }

        [HttpPost("pdf")]
        public async Task<IActionResult> UploadPdf(IFormFile file)
        {
            try
            {
                if (file == null || file.Length == 0)
                {
                    return BadRequest(new { error = "沒有選擇文件" });
                }

                // 檢查文件類型
                var allowedExtensions = new[] { ".pdf" };
                var fileExtension = Path.GetExtension(file.FileName).ToLowerInvariant();
                
                if (!allowedExtensions.Contains(fileExtension))
                {
                    return BadRequest(new { error = "不支持的文件類型，只允許 PDF 文件 (.pdf)" });
                }

                // 生成唯一文件名
                var fileName = $"{DateTime.UtcNow:yyyyMMddHHmmss}_{Guid.NewGuid()}{fileExtension}";
                var filePath = Path.Combine(_uploadPath, "Documents", fileName);

                // 確保目錄存在
                Directory.CreateDirectory(Path.GetDirectoryName(filePath));

                // 保存文件
                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }

                _loggingService.LogInformation($"PDF 文件上傳成功: {fileName}");

                // 轉換為 HTML
                string htmlContent = null;
                string formName = null;
                try
                {
                    htmlContent = await _documentConverter.ConvertToHtml(filePath);
                    formName = Path.GetFileNameWithoutExtension(file.FileName);
                    _loggingService.LogInformation($"PDF 文件轉換為 HTML 成功: {fileName}");
                }
                catch (Exception convertEx)
                {
                    _loggingService.LogWarning($"PDF 文件轉換為 HTML 失敗: {convertEx.Message}");
                    return StatusCode(500, new { error = "PDF 文件轉換失敗: " + convertEx.Message });
                }

                return Ok(new { 
                    success = true, 
                    fileName = fileName,
                    filePath = filePath,
                    htmlContent = htmlContent,
                    formName = formName,
                    message = "PDF 文件上傳並轉換成功" 
                });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"PDF 文件上傳失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = "PDF 文件上傳失敗" });
            }
        }

        [HttpPost("document")]
        public async Task<IActionResult> UploadDocument(IFormFile file)
        {
            try
            {
                if (file == null || file.Length == 0)
                {
                    return BadRequest(new { error = "沒有選擇文件" });
                }

                // 檢查文件類型
                var allowedExtensions = new[] { ".doc", ".docx", ".pdf", ".txt", ".rtf" };
                var fileExtension = Path.GetExtension(file.FileName).ToLowerInvariant();
                
                if (!allowedExtensions.Contains(fileExtension))
                {
                    return BadRequest(new { error = "不支持的文件類型，只允許文檔文件" });
                }

                // 生成唯一文件名
                var fileName = $"{DateTime.UtcNow:yyyyMMddHHmmss}_{Guid.NewGuid()}{fileExtension}";
                var filePath = Path.Combine(_uploadPath, "Documents", fileName);

                // 確保目錄存在
                Directory.CreateDirectory(Path.GetDirectoryName(filePath));

                // 保存文件
                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }

                _loggingService.LogInformation($"文檔文件上傳成功: {fileName}");

                // 如果是 Word 文檔，嘗試轉換為 HTML
                string htmlContent = null;
                if (fileExtension == ".docx" || fileExtension == ".doc")
                {
                    try
                    {
                        htmlContent = await _documentConverter.ConvertToHtml(filePath);
                        _loggingService.LogInformation($"文檔轉換為 HTML 成功: {fileName}");
                    }
                    catch (Exception convertEx)
                    {
                        _loggingService.LogWarning($"文檔轉換為 HTML 失敗: {convertEx.Message}");
                        // 轉換失敗不影響上傳
                    }
                }

                return Ok(new { 
                    success = true, 
                    fileName = fileName,
                    filePath = filePath,
                    htmlContent = htmlContent,
                    message = "文檔上傳成功" 
                });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"文檔上傳失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = "文檔上傳失敗" });
            }
        }

        [HttpPost("convert")]
        public async Task<IActionResult> ConvertDocument([FromBody] ConvertRequest request)
        {
            try
            {
                if (string.IsNullOrEmpty(request.FilePath))
                {
                    return BadRequest(new { error = "文件路徑不能為空" });
                }

                var fullPath = Path.Combine(_uploadPath, request.FilePath);
                if (!System.IO.File.Exists(fullPath))
                {
                    return NotFound(new { error = "文件不存在" });
                }

                var fileExtension = Path.GetExtension(fullPath).ToLowerInvariant();
                if (fileExtension != ".docx" && fileExtension != ".doc")
                {
                    return BadRequest(new { error = "只支持 Word 文檔轉換" });
                }

                _loggingService.LogInformation($"開始轉換文檔: {request.FilePath}");

                var htmlContent = await _documentConverter.ConvertToHtml(fullPath);
                
                _loggingService.LogInformation($"文檔轉換成功: {request.FilePath}");

                return Ok(new { 
                    success = true, 
                    htmlContent = htmlContent,
                    message = "文檔轉換成功" 
                });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"文檔轉換失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = "文檔轉換失敗" });
            }
        }

        [HttpGet("files")]
        public async Task<IActionResult> GetFiles([FromQuery] string type = "all")
        {
            try
            {
                var files = new List<object>();
                var uploadDir = new DirectoryInfo(_uploadPath);

                if (!uploadDir.Exists)
                {
                    return Ok(new { files = new List<object>(), message = "上傳目錄不存在" });
                }

                foreach (var file in uploadDir.GetFiles())
                {
                    if (type == "all" || 
                        (type == "image" && IsImageFile(file.Extension)) ||
                        (type == "document" && IsDocumentFile(file.Extension)))
                    {
                        files.Add(new
                        {
                            name = file.Name,
                            size = file.Length,
                            created = file.CreationTime,
                            modified = file.LastWriteTime,
                            type = GetFileType(file.Extension)
                        });
                    }
                }

                _loggingService.LogInformation($"獲取文件列表成功，類型: {type}，數量: {files.Count}");

                return Ok(new { 
                    files = files,
                    total = files.Count,
                    message = "文件列表獲取成功" 
                });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取文件列表失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = "獲取文件列表失敗" });
            }
        }

        private bool IsImageFile(string extension)
        {
            var imageExtensions = new[] { ".jpg", ".jpeg", ".png", ".gif", ".bmp" };
            return imageExtensions.Contains(extension.ToLowerInvariant());
        }

        private bool IsDocumentFile(string extension)
        {
            var documentExtensions = new[] { ".doc", ".docx", ".pdf", ".txt", ".rtf" };
            return documentExtensions.Contains(extension.ToLowerInvariant());
        }

        private string GetFileType(string extension)
        {
            if (IsImageFile(extension)) return "image";
            if (IsDocumentFile(extension)) return "document";
            return "other";
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
                _loggingService.LogInformation($"📋 [GetForms] 獲取表單列表 - 頁面: {page}, 每頁: {pageSize}, 排序: {sortField} {sortOrder}");

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

                _loggingService.LogInformation($"✅ [GetForms] 成功獲取 {forms.Count} 個表單，總計 {total} 個");

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
                _loggingService.LogError($"❌ [GetForms] 獲取表單列表失敗: {ex.Message}", ex);
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
                _loggingService.LogInformation($"🗑️ [BatchDeleteForms] 批量刪除表單 - 數量: {request.FormIds?.Count ?? 0}");

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
                            _loggingService.LogInformation($"🗑️ [BatchDeleteForms] 刪除文件: {filePath}");
                        }

                        // 刪除相關的 HTML 和圖片文件
                        var directory = Path.GetDirectoryName(filePath);
                        if (Directory.Exists(directory))
                        {
                            var relatedFiles = Directory.GetFiles(directory, $"{Path.GetFileNameWithoutExtension(filePath)}*");
                            foreach (var relatedFile in relatedFiles)
                            {
                                System.IO.File.Delete(relatedFile);
                                _loggingService.LogInformation($"🗑️ [BatchDeleteForms] 刪除相關文件: {relatedFile}");
                            }
                        }
                        }
                    }
                    catch (Exception ex)
                    {
                        _loggingService.LogWarning($"⚠️ [BatchDeleteForms] 刪除文件時發生錯誤: {ex.Message}");
                    }
                }

                // 從資料庫刪除
                _context.eFormDefinitions.RemoveRange(formsToDelete);
                await _context.SaveChangesAsync();

                _loggingService.LogInformation($"✅ [BatchDeleteForms] 成功刪除 {formsToDelete.Count} 個表單");

                return Ok(new
                {
                    success = true,
                    deletedCount = formsToDelete.Count,
                    message = $"成功刪除 {formsToDelete.Count} 個表單"
                });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"❌ [BatchDeleteForms] 批量刪除失敗: {ex.Message}", ex);
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
                _loggingService.LogInformation($"🗑️ [DeleteForm] 刪除表單 - ID: {id}");

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
                            _loggingService.LogInformation($"🗑️ [DeleteForm] 刪除文件: {filePath}");
                        }

                        // 刪除相關的 HTML 和圖片文件
                        var directory = Path.GetDirectoryName(filePath);
                        if (Directory.Exists(directory))
                        {
                            var relatedFiles = Directory.GetFiles(directory, $"{Path.GetFileNameWithoutExtension(filePath)}*");
                            foreach (var relatedFile in relatedFiles)
                            {
                                System.IO.File.Delete(relatedFile);
                                _loggingService.LogInformation($"🗑️ [DeleteForm] 刪除相關文件: {relatedFile}");
                            }
                        }
                    }
                }
                catch (Exception ex)
                {
                    _loggingService.LogWarning($"⚠️ [DeleteForm] 刪除文件時發生錯誤: {ex.Message}");
                }

                // 從資料庫刪除
                _context.eFormDefinitions.Remove(form);
                await _context.SaveChangesAsync();

                _loggingService.LogInformation($"✅ [DeleteForm] 成功刪除表單: {form.Name}");

                return Ok(new
                {
                    success = true,
                    message = "表單已成功刪除"
                });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"❌ [DeleteForm] 刪除失敗: {ex.Message}", ex);
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
                _loggingService.LogInformation($"🤖 [GenerateFormWithAI] 開始 AI 生成表單");
                _loggingService.LogInformation($"🤖 [GenerateFormWithAI] 用戶提示: {request.Prompt}");
                _loggingService.LogInformation($"🤖 [GenerateFormWithAI] 包含當前 HTML: {request.IncludeCurrentHtml}");
                if (request.IncludeCurrentHtml && !string.IsNullOrEmpty(request.CurrentHtml))
                {
                    _loggingService.LogInformation($"🤖 [GenerateFormWithAI] 當前 HTML 長度: {request.CurrentHtml.Length}");
                }

                var companyId = GetCurrentCompanyId();
                if (companyId == Guid.Empty)
                {
                    _loggingService.LogWarning("❌ [GenerateFormWithAI] 無法取得公司資訊");
                    return Unauthorized(new { success = false, error = "無法識別公司資訊" });
                }

                if (string.IsNullOrWhiteSpace(request.Prompt))
                {
                    return BadRequest(new { success = false, error = "請輸入生成表單的需求描述" });
                }

                var systemPrompt = _configuration["Fill-Form-Prompt:DefaultSystemPrompt"] ?? string.Empty;
                var userPrompt = request.Prompt.Trim();

                if (request.IncludeCurrentHtml && !string.IsNullOrWhiteSpace(request.CurrentHtml))
                {
                    userPrompt = $"用戶需求：{request.Prompt}\n\n當前 HTML 內容：\n{request.CurrentHtml}\n\n請基於以上內容進行修改和優化。";
                }

                var messages = new[]
                {
                    new AiMessage("user", userPrompt)
                };

                var aiResult = await _aiCompletionClient.SendChatAsync(
                    companyId,
                    request.ProviderKey,
                    systemPrompt,
                    messages);

                if (!aiResult.Success || string.IsNullOrWhiteSpace(aiResult.Content))
                {
                    var providerLabel = string.IsNullOrWhiteSpace(aiResult.ProviderKey) ? request.ProviderKey ?? "(unspecified)" : aiResult.ProviderKey;
                    _loggingService.LogWarning($"❌ [GenerateFormWithAI] AI 生成失敗，Provider: {providerLabel}, 錯誤: {aiResult.ErrorMessage ?? "Unknown"}");
                    return StatusCode(500, new { success = false, error = aiResult.ErrorMessage ?? "AI 生成失敗" });
                }

                var formName = ExtractFormNameFromPrompt(request.Prompt) ?? "AI 生成的表單";

                return Ok(new
                {
                    success = true,
                    htmlContent = aiResult.Content,
                    formName,
                    message = "AI 已成功生成表單"
                });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"❌ [GenerateFormWithAI] 發生錯誤: {ex.Message}", ex);
                return StatusCode(500, new { success = false, error = $"AI 生成表單失敗: {ex.Message}" });
            }
        }

        /// <summary>
        /// 從 AI 響應中提取 HTML 內容
        /// </summary>
        private string ExtractHtmlFromResponse(string response)
        {
            try
            {
                _loggingService.LogInformation($"🔍 [ExtractHtmlFromResponse] 開始提取 HTML，響應長度: {response.Length}");
                
                // 嘗試提取 ```html 和 ``` 之間的內容
                var htmlStart = response.IndexOf("```html");
                if (htmlStart >= 0)
                {
                    var startIndex = htmlStart + 7; // "```html" 的長度
                    var endIndex = response.IndexOf("```", startIndex);
                    if (endIndex >= 0)
                    {
                        var htmlContent = response.Substring(startIndex, endIndex - startIndex).Trim();
                        _loggingService.LogInformation($"✅ [ExtractHtmlFromResponse] 找到 ```html 代碼塊，長度: {htmlContent.Length}");
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
                            _loggingService.LogInformation($"✅ [ExtractHtmlFromResponse] 找到代碼塊包含 HTML，長度: {codeContent.Length}");
                            return codeContent;
                        }
                    }
                }

                // 如果沒有找到代碼塊，嘗試提取 <html 開始的內容
                var htmlTagStart = response.IndexOf("<html");
                if (htmlTagStart >= 0)
                {
                    var htmlContent = response.Substring(htmlTagStart).Trim();
                    _loggingService.LogInformation($"✅ [ExtractHtmlFromResponse] 找到 <html 標籤，長度: {htmlContent.Length}");
                    return htmlContent;
                }

                // 嘗試提取 <!DOCTYPE 開始的內容
                var doctypeStart = response.IndexOf("<!DOCTYPE");
                if (doctypeStart >= 0)
                {
                    var htmlContent = response.Substring(doctypeStart).Trim();
                    _loggingService.LogInformation($"✅ [ExtractHtmlFromResponse] 找到 <!DOCTYPE，長度: {htmlContent.Length}");
                    return htmlContent;
                }

                // 如果都沒有找到，檢查是否包含 HTML 標籤
                if (response.Contains("<head>") || response.Contains("<body>") || response.Contains("<table>"))
                {
                    _loggingService.LogWarning($"⚠️ [ExtractHtmlFromResponse] 未找到明確的 HTML 標記，但包含 HTML 標籤，返回完整響應");
                    return response.Trim();
                }

                _loggingService.LogInformation($"❌ [ExtractHtmlFromResponse] 未找到任何 HTML 內容");
                return response.Trim();
            }
            catch (Exception ex)
            {
                _loggingService.LogWarning($"⚠️ [ExtractHtmlFromResponse] 提取 HTML 時發生錯誤: {ex.Message}");
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
                _loggingService.LogWarning($"⚠️ [ExtractFormNameFromResponse] 提取表單名稱時發生錯誤: {ex.Message}");
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
        public string? ProviderKey { get; set; }
    }

    public class ConvertRequest
    {
        public string FilePath { get; set; } = string.Empty;
    }
} 