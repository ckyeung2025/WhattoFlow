using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using System.Drawing;
using ZXing;
using ZXing.Common;
using ZXing.QrCode;
using PurpleRice.Data;
using PurpleRice.Models;
using PurpleRice.Services;

namespace PurpleRice.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class QrScanController : ControllerBase
    {
        private readonly PurpleRiceDbContext _context;
        private readonly ErpDbContext _erpContext;
        private readonly PdfService _pdfService;
        private readonly IWebHostEnvironment _environment;
        private readonly LoggingService _loggingService;

        public QrScanController(PurpleRiceDbContext context, ErpDbContext erpContext, PdfService pdfService, IWebHostEnvironment environment, Func<string, LoggingService> loggingServiceFactory)
        {
            _context = context;
            _erpContext = erpContext;
            _pdfService = pdfService;
            _environment = environment;
            _loggingService = loggingServiceFactory("QrScanController");
        }

        [HttpGet("scan")]
        public IActionResult ScanQRCodeInfo()
        {
            _loggingService.LogInformation("QR Code 掃描 API 信息請求");
            return Ok("API 連線成功，請使用 POST 並上傳圖片檔案欄位 imageFile 來進行 QR Code 掃描。");
        }

        [HttpPost("scan")]
        public async Task<IActionResult> ScanQRCode([FromForm] IFormFile imageFile)
        {
            try
            {
                if (imageFile == null || imageFile.Length == 0)
                {
                    _loggingService.LogWarning("上傳的圖片文件為空");
                    return BadRequest("No image uploaded.");
                }

                // 檢查檔案類型
                var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".bmp", ".gif" };
                var fileExtension = Path.GetExtension(imageFile.FileName).ToLowerInvariant();
                
                if (!allowedExtensions.Contains(fileExtension))
                {
                    _loggingService.LogWarning($"不支持的文件格式: {fileExtension}");
                    return BadRequest("Unsupported file format. Please upload JPG, PNG, BMP, or GIF files.");
                }

                _loggingService.LogInformation($"開始處理圖片文件: {imageFile.FileName}, 大小: {imageFile.Length} bytes");

                // 保存上傳的圖片
                var uploadPath = Path.Combine(_environment.ContentRootPath, "Uploads", "qr-scans");
                if (!Directory.Exists(uploadPath))
                {
                    Directory.CreateDirectory(uploadPath);
                    _loggingService.LogInformation($"創建 QR 掃描上傳目錄: {uploadPath}");
                }

                var fileName = $"{DateTime.Now:yyyyMMddHHmmss}_{Guid.NewGuid()}{fileExtension}";
                var filePath = Path.Combine(uploadPath, fileName);

                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await imageFile.CopyToAsync(stream);
                }

                _loggingService.LogInformation($"圖片已保存到: {filePath}");

                // 使用 ZXing 掃描 QR Code
                using (var bitmap = new Bitmap(filePath))
                {
                    var reader = new BarcodeReader
                    {
                        Options = new DecodingOptions
                        {
                            TryHarder = true,
                            PossibleFormats = new[] { BarcodeFormat.QR_CODE }
                        }
                    };

                    var result = reader.Decode(bitmap);

                    if (result != null)
                    {
                        _loggingService.LogInformation($"成功掃描 QR Code: {result.Text}");
                        
                        // 這裡可以添加 QR Code 內容的處理邏輯
                        // 例如：解析送貨單號、客戶信息等
                        
                        return Ok(new
                        {
                            success = true,
                            qrContent = result.Text,
                            fileName = fileName,
                            message = "QR Code 掃描成功"
                        });
                    }
                    else
                    {
                        _loggingService.LogWarning("無法識別圖片中的 QR Code");
                        return BadRequest(new
                        {
                            success = false,
                            message = "無法識別圖片中的 QR Code，請確保圖片清晰且包含有效的 QR Code"
                        });
                    }
                }
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"QR Code 掃描失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = "QR Code 掃描失敗" });
            }
        }

        [HttpGet("history")]
        public async Task<IActionResult> GetScanHistory([FromQuery] int page = 1, [FromQuery] int pageSize = 10)
        {
            try
            {
                _loggingService.LogInformation($"獲取掃描歷史 - 頁面: {page}, 每頁: {pageSize}");
                
                // 這裡可以實現掃描歷史的查詢邏輯
                // 例如：從資料庫中查詢之前的掃描記錄
                
                var history = new List<object>(); // 暫時返回空列表
                
                _loggingService.LogInformation($"成功獲取掃描歷史，數量: {history.Count}");
                
                return Ok(new
                {
                    data = history,
                    page = page,
                    pageSize = pageSize,
                    total = history.Count
                });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取掃描歷史失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = "獲取掃描歷史失敗" });
            }
        }
    }
}