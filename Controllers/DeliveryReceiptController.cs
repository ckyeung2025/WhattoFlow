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

        public DeliveryReceiptController(PurpleRiceDbContext context, ErpDbContext erpContext, PdfService pdfService, IWebHostEnvironment environment)
        {
            _context = context;
            _erpContext = erpContext;
            _pdfService = pdfService;
            _environment = environment;
        }

        [HttpGet("upload")]
        public IActionResult UploadInfo()
        {
            return Ok("簽收單據上傳 API，請使用 POST 並上傳簽收單據圖片檔案欄位 receiptImage 來進行 QR Code 掃描和記錄。");
        }

        [HttpPost("upload")]
        public async Task<IActionResult> UploadReceipt([FromForm] IFormFile receiptImage)
        {
            if (receiptImage == null || receiptImage.Length == 0)
                return BadRequest("No image uploaded.");

            // 檢查檔案類型
            var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".bmp", ".gif" };
            var fileExtension = Path.GetExtension(receiptImage.FileName).ToLowerInvariant();
            
            if (!allowedExtensions.Contains(fileExtension))
                return BadRequest("Unsupported file format. Please upload JPG, PNG, BMP, or GIF files.");

            try
            {
                // 1. 掃描 QR Code
                string qrCodeText = await ScanQRCode(receiptImage);
                if (string.IsNullOrEmpty(qrCodeText))
                {
                    return BadRequest("No QR code found in the image. Please ensure the image contains a valid QR code.");
                }

                // 2. 查詢資料庫
                var orderInfo = await _erpContext.SoOrderManage
                    .Where(o => o.invoiceno == qrCodeText)
                    .FirstOrDefaultAsync();

                if (orderInfo == null)
                {
                    return NotFound(new { 
                        message = "Invoice number not found in database",
                        qrCodeText = qrCodeText
                    });
                }

                // 3. 查詢客戶資訊
                var customerInfo = await _erpContext.ItCustomer
                    .Where(c => c.customerno == orderInfo.customerno)
                    .FirstOrDefaultAsync();

                // 4. 儲存原始圖片
                var originalImagePath = await SaveOriginalImage(receiptImage, orderInfo.customerno);

                // 5. 轉換為 PDF
                var receiptDate = DateTime.Now;
                var groupName = $"DN_{orderInfo.customerno}_{orderInfo.invoiceno}_{receiptDate:yyyyMMddHHmm}";
                var pdfPath = _pdfService.ConvertImageToPdf(originalImagePath, orderInfo.customerno, orderInfo.invoiceno, groupName);
                var imageRelPath = $"Customer\\{orderInfo.customerno}\\Original\\{groupName}\\{groupName}_1.jpg";
                var pdfRelPath = $"Customer\\{orderInfo.customerno}\\PDF\\{groupName}.pdf";

                // 6. 檢查是否已存在相同 QR code 的記錄
                var existingReceipt = await _context.DeliveryReceipt
                    .Where(r => r.qr_code_text == qrCodeText)
                    .FirstOrDefaultAsync();

                DeliveryReceipt deliveryReceipt;
                bool isUpdate = false;

                if (existingReceipt != null)
                {
                    // 更新現有記錄
                    existingReceipt.upload_date = DateTime.Now;
                    existingReceipt.uploaded_by = "Customer";
                    existingReceipt.original_image_path = imageRelPath;
                    existingReceipt.pdf_path = pdfRelPath;
                    existingReceipt.receipt_date = receiptDate;
                    existingReceipt.upload_ip = HttpContext.Connection.RemoteIpAddress?.ToString();
                    
                    deliveryReceipt = existingReceipt;
                    isUpdate = true;
                }
                else
                {
                    // 新增記錄
                    deliveryReceipt = new DeliveryReceipt
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
                        upload_date = DateTime.Now,
                        upload_ip = HttpContext.Connection.RemoteIpAddress?.ToString(),
                        status = "PENDING",
                        uploaded_by = "Customer"
                    };

                    _context.DeliveryReceipt.Add(deliveryReceipt);
                }

                await _context.SaveChangesAsync();

                // 7. 回傳結果
                var response = new
                {
                    success = true,
                    message = isUpdate ? "簽收單據更新成功" : "簽收單據上傳成功",
                    isUpdate = isUpdate,
                    receiptId = deliveryReceipt.id,
                    invoiceNo = deliveryReceipt.invoiceno,
                    customerNo = deliveryReceipt.customerno,
                    customerName = deliveryReceipt.customername,
                    contactTel1 = deliveryReceipt.contacttel1,
                    contactTel2 = deliveryReceipt.contacttel2,
                    qrCodeText = deliveryReceipt.qr_code_text,
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
                return StatusCode(500, $"Internal error: {ex.Message}");
            }
        }

        private async Task<string> ScanQRCode(IFormFile imageFile)
        {
            using var stream = imageFile.OpenReadStream();
            using var bitmap = new Bitmap(stream);

            var options = new DecodingOptions
            {
                TryHarder = true,
                PossibleFormats = new[] { BarcodeFormat.QR_CODE }
            };

            var reader = new BarcodeReader
            {
                AutoRotate = true,
                TryInverted = true,
                Options = options
            };

            var result = reader.Decode(bitmap);
            return result?.Text?.Trim() ?? string.Empty;
        }

        private async Task<string> SaveOriginalImage(IFormFile imageFile, string customerNo)
        {
            var uploadsPath = Path.Combine(_environment.ContentRootPath, "Uploads");
            var customerPath = Path.Combine(uploadsPath, "Customer", customerNo, "Original");
            Directory.CreateDirectory(customerPath);

            var fileName = $"DN_{customerNo}_{DateTime.Now:yyyyMMdd_HHmmss}{Path.GetExtension(imageFile.FileName)}";
            var filePath = Path.Combine(customerPath, fileName);

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await imageFile.CopyToAsync(stream);
            }

            return filePath;
        }

        [HttpGet("list")]
        public async Task<IActionResult> GetReceiptList([FromQuery] DateTime? date = null, [FromQuery] string? customerNo = null)
        {
            try
            {
                var query = _context.DeliveryReceipt.AsQueryable();

                if (date.HasValue)
                {
                    query = query.Where(r => r.receipt_date.Date == date.Value.Date);
                }

                if (!string.IsNullOrEmpty(customerNo))
                {
                    query = query.Where(r => r.customerno == customerNo);
                }

                var receipts = await query
                    .OrderByDescending(r => r.upload_date)
                    .Select(r => new
                    {
                        r.id,
                        r.invoiceno,
                        r.customerno,
                        r.customername,
                        r.contacttel1,
                        r.contacttel2,
                        r.receipt_date,
                        r.upload_date,
                        r.status,
                        r.qr_code_text,
                        r.original_image_path,
                        r.pdf_path
                    })
                    .ToListAsync();

                return Ok(new { 
                    success = true, 
                    count = receipts.Count,
                    receipts 
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Internal error: {ex.Message}");
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
                return StatusCode(500, $"Internal error: {ex.Message}\n{ex.StackTrace}");
            }
        }
    }
} 