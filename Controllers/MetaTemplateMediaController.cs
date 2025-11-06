using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using System.IO;
using System.Threading.Tasks;
using PurpleRice.Services;
using System;
using System.Linq;

namespace PurpleRice.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize] // 需要登入認證才能上傳
    public class MetaTemplateMediaController : ControllerBase
    {
        private readonly string _publicPath;
        private readonly LoggingService _loggingService;
        private readonly IWebHostEnvironment _environment;

        public MetaTemplateMediaController(
            IWebHostEnvironment environment,
            Func<string, LoggingService> loggingServiceFactory)
        {
            _environment = environment;
            _loggingService = loggingServiceFactory("MetaTemplateMediaController");
            
            // 使用 wwwroot/public 作為公開資源目錄
            _publicPath = Path.Combine(_environment.WebRootPath ?? 
                Path.Combine(Directory.GetCurrentDirectory(), "wwwroot"), "public", "meta-templates");
            
            // 確保目錄存在
            if (!Directory.Exists(_publicPath))
            {
                Directory.CreateDirectory(_publicPath);
            }
        }

        /// <summary>
        /// 上傳 Meta 模板媒體檔案（圖像、視頻、文件）
        /// 檔案會存儲在 wwwroot/public/meta-templates 目錄，這是公開可訪問的
        /// </summary>
        [HttpPost("upload")]
        public async Task<IActionResult> UploadMedia([FromForm] IFormFile file, [FromQuery] string? mediaType = "image")
        {
            try
            {
                if (file == null || file.Length == 0)
                {
                    return BadRequest(new { error = "沒有選擇文件" });
                }

                // 根據媒體類型驗證文件格式
                var fileExtension = Path.GetExtension(file.FileName).ToLowerInvariant();
                bool isValidFile = false;
                long maxSize = 0;

                switch (mediaType.ToLower())
                {
                    case "image":
                        var allowedImageExtensions = new[] { ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp" };
                        isValidFile = allowedImageExtensions.Contains(fileExtension);
                        maxSize = 5 * 1024 * 1024; // 5 MB
                        break;
                    case "video":
                        var allowedVideoExtensions = new[] { ".mp4", ".avi", ".mov", ".wmv" };
                        isValidFile = allowedVideoExtensions.Contains(fileExtension);
                        maxSize = 16 * 1024 * 1024; // 16 MB
                        break;
                    case "document":
                        var allowedDocExtensions = new[] { ".pdf", ".doc", ".docx", ".txt" };
                        isValidFile = allowedDocExtensions.Contains(fileExtension);
                        maxSize = 100 * 1024 * 1024; // 100 MB
                        break;
                    default:
                        return BadRequest(new { error = "不支持的媒體類型" });
                }

                if (!isValidFile)
                {
                    return BadRequest(new { error = $"不支持的文件類型，媒體類型：{mediaType}" });
                }

                if (file.Length > maxSize)
                {
                    return BadRequest(new { error = $"文件大小超過限制（最大 {maxSize / 1024 / 1024} MB）" });
                }

                // 生成唯一文件名
                var fileName = $"{DateTime.UtcNow:yyyyMMddHHmmss}_{Guid.NewGuid()}{fileExtension}";
                var filePath = Path.Combine(_publicPath, fileName);

                // 保存文件
                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }

                _loggingService.LogInformation($"Meta 模板媒體文件上傳成功: {fileName}, 類型: {mediaType}");

                // 構建公開 URL（基於當前請求的主機）
                var request = HttpContext.Request;
                var baseUrl = $"{request.Scheme}://{request.Host}";
                var publicUrl = $"{baseUrl}/public/meta-templates/{fileName}";

                return Ok(new
                {
                    success = true,
                    fileName = fileName,
                    filePath = filePath,
                    publicUrl = publicUrl,
                    message = "檔案上傳成功"
                });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"Meta 模板媒體文件上傳失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = "檔案上傳失敗" });
            }
        }
    }
}

