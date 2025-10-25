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
    public class DeliveryReceiptController : ControllerBase
    {
        private readonly PurpleRiceDbContext _context;
        private readonly ErpDbContext _erpContext;
        private readonly PdfService _pdfService;
        private readonly IWebHostEnvironment _environment;
        private readonly LoggingService _loggingService;

        public DeliveryReceiptController(PurpleRiceDbContext context, ErpDbContext erpContext, PdfService pdfService, IWebHostEnvironment environment, Func<string, LoggingService> loggingServiceFactory)
        {
            _context = context;
            _erpContext = erpContext;
            _pdfService = pdfService;
            _environment = environment;
            _loggingService = loggingServiceFactory("DeliveryReceiptController");
        }

        [HttpGet("upload")]
        public IActionResult UploadInfo()
        {
            _loggingService.LogInformation("簽收單據上傳 API 信息請求");
            return Ok("簽收單據上傳 API，請使用 POST 並上傳簽收單據圖片檔案欄位 receiptImage 來進行 QR Code 掃描和記錄。");
        }

        [HttpPost("upload")]
        public async Task<IActionResult> UploadReceipt([FromForm] IFormFile receiptImage)
        {
            try
            {
                if (receiptImage == null || receiptImage.Length == 0)
                {
                    _loggingService.LogWarning("上傳的簽收單據圖片為空");
                    return BadRequest("No image uploaded.");
                }

                // 檢查檔案類型
                var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".bmp", ".gif" };
                var fileExtension = Path.GetExtension(receiptImage.FileName).ToLowerInvariant();
                
                if (!allowedExtensions.Contains(fileExtension))
                {
                    _loggingService.LogWarning($"不支持的文件格式: {fileExtension}");
                    return BadRequest("Unsupported file format. Please upload JPG, PNG, BMP, or GIF files.");
                }

                _loggingService.LogInformation($"開始處理簽收單據圖片: {receiptImage.FileName}, 大小: {receiptImage.Length} bytes");

                // 1. 掃描 QR Code
                string qrCodeText = null;
                using (var stream = receiptImage.OpenReadStream())
                using (var bitmap = new Bitmap(stream))
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
                        qrCodeText = result.Text.Trim();
                        _loggingService.LogInformation($"成功掃描 QR Code: {qrCodeText}");
                    }
                    else
                    {
                        _loggingService.LogWarning("無法識別圖片中的 QR Code");
                        return BadRequest("無法識別圖片中的 QR Code，請確保圖片清晰且包含有效的 QR Code");
                    }
                }

                // 2. 查詢資料庫中的訂單信息
                var orderInfo = await _erpContext.SoOrderManage
                    .Where(o => o.invoiceno == qrCodeText)
                    .FirstOrDefaultAsync();

                if (orderInfo == null)
                {
                    _loggingService.LogWarning($"找不到對應的發票號: {qrCodeText}");
                    return NotFound(new { 
                        message = "Invoice number not found in database",
                        qrCodeText = qrCodeText
                    });
                }

                _loggingService.LogInformation($"找到訂單信息: 客戶號 {orderInfo.customerno}, 發票號 {orderInfo.invoiceno}");

                // 3. 查詢客戶信息
                var customerInfo = await _erpContext.ItCustomer
                    .Where(c => c.customerno == orderInfo.customerno)
                    .FirstOrDefaultAsync();

                if (customerInfo != null)
                {
                    _loggingService.LogInformation($"找到客戶信息: {customerInfo.customername1}");
                }

                // 4. 保存原始圖片
                var originalImagePath = await SaveOriginalImage(receiptImage, orderInfo.customerno);
                _loggingService.LogInformation($"原始圖片已保存到: {originalImagePath}");

                // 5. 轉換為 PDF
                var receiptDate = DateTime.UtcNow;
                var groupName = $"DN_{orderInfo.customerno}_{orderInfo.invoiceno}_{receiptDate:yyyyMMddHHmm}";
                var pdfPath = _pdfService.ConvertImageToPdf(originalImagePath, orderInfo.customerno, orderInfo.invoiceno, groupName);
                _loggingService.LogInformation($"PDF 已生成: {pdfPath}");

                // 6. 創建簽收記錄
                var imageRelPath = $"Customer\\{orderInfo.customerno}\\Original\\{groupName}\\{groupName}_1.jpg";
                var pdfRelPath = $"Customer\\{orderInfo.customerno}\\PDF\\{groupName}.pdf";
                
                var deliveryReceipt = new DeliveryReceipt
                {
                    within_code = orderInfo.within_code,
                    invoiceno = orderInfo.invoiceno,
                    customerno = orderInfo.customerno,
                    customername = customerInfo?.customername1,
                    contacttel1 = customerInfo?.contacttel1,
                    contacttel2 = customerInfo?.contacttel2,
                    original_image_path = imageRelPath,
                    pdf_path = pdfRelPath,
                    qr_code_text = qrCodeText,
                    receipt_date = receiptDate,
                    upload_date = DateTime.UtcNow,
                    upload_ip = HttpContext.Connection.RemoteIpAddress?.ToString(),
                    status = "PENDING",
                    uploaded_by = "DeliveryMan"
                };

                _context.DeliveryReceipt.Add(deliveryReceipt);
                await _context.SaveChangesAsync();

                _loggingService.LogInformation($"簽收記錄已保存到資料庫，ID: {deliveryReceipt.id}");

                var response = new
                {
                    success = true,
                    message = "QR Code 掃描成功，記錄已儲存",
                    receiptId = deliveryReceipt.id,
                    invoiceNo = orderInfo.invoiceno,
                    customerNo = orderInfo.customerno,
                    contactTel1 = customerInfo?.contacttel1 ?? "",
                    contactTel2 = customerInfo?.contacttel2 ?? "",
                    customerName = customerInfo?.customername1 ?? "",
                    qrCodeText = qrCodeText,
                    receiptDate = deliveryReceipt.receipt_date,
                    uploadDate = deliveryReceipt.upload_date,
                    status = deliveryReceipt.status,
                    originalImagePath = deliveryReceipt.original_image_path,
                    pdfPath = deliveryReceipt.pdf_path,
                    uploadedBy = deliveryReceipt.uploaded_by
                };

                return Ok(response);
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"簽收單據上傳失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = "簽收單據上傳失敗" });
            }
        }

        private async Task<string> SaveOriginalImage(IFormFile imageFile, string customerNo)
        {
            try
            {
                var uploadsPath = Path.Combine(_environment.ContentRootPath, "Uploads");
                var customerPath = Path.Combine(uploadsPath, "Customer", customerNo, "Original");
                
                if (!Directory.Exists(customerPath))
                {
                    Directory.CreateDirectory(customerPath);
                    _loggingService.LogInformation($"創建客戶目錄: {customerPath}");
                }

                var fileName = $"DN_{customerNo}_{DateTime.UtcNow:yyyyMMdd_HHmmss}{Path.GetExtension(imageFile.FileName)}";
                var filePath = Path.Combine(customerPath, fileName);

                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await imageFile.CopyToAsync(stream);
                }

                _loggingService.LogInformation($"圖片已保存: {filePath}");
                return filePath;
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"保存原始圖片失敗: {ex.Message}", ex);
                throw;
            }
        }

        [HttpGet("list")]
        public async Task<IActionResult> GetReceiptList([FromQuery] int page = 1, [FromQuery] int pageSize = 10)
        {
            try
            {
                _loggingService.LogInformation($"獲取簽收單據列表 - 頁面: {page}, 每頁: {pageSize}");
                
                var query = _context.DeliveryReceipt.AsQueryable();
                var total = await query.CountAsync();
                
                var receipts = await query
                    .OrderByDescending(r => r.upload_date)
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .ToListAsync();

                _loggingService.LogInformation($"成功獲取 {receipts.Count} 個簽收單據，總計 {total} 個");

                return Ok(new
                {
                    data = receipts,
                    total = total,
                    page = page,
                    pageSize = pageSize,
                    totalPages = (int)Math.Ceiling((double)total / pageSize)
                });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取簽收單據列表失敗: {ex.Message}", ex);
                return StatusCode(500, new { error = "獲取簽收單據列表失敗" });
            }
        }

        [HttpGet("count")]
        public async Task<IActionResult> GetCount([FromQuery] string uploadedBy, [FromQuery] int confirmed)
        {
            try
            {
                var query = _context.DeliveryReceipt.AsQueryable();
                if (uploadedBy == "DeliveryMan" || uploadedBy == "Customer")
                {
                    query = query.Where(r => r.uploaded_by == uploadedBy);
                }
                if (uploadedBy == "all")
                {
                    query = query.Where(r => r.uploaded_by == "DeliveryMan" || r.uploaded_by == "Customer");
                }
                query = query.Where(r => r.confirmed == (confirmed == 1));
                var count = await query.CountAsync();
                return Ok(new { count });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取簽收單據數量失敗: {ex.Message}", ex);
                return StatusCode(500, $"Internal error: {ex.Message}\n{ex.StackTrace}");
            }
        }
    }
} 