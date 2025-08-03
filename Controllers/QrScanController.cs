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
using PurpleRice.Data;

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

        public QrScanController(PurpleRiceDbContext context, ErpDbContext erpContext, PdfService pdfService, IWebHostEnvironment environment)
        {
            _context = context;
            _erpContext = erpContext;
            _pdfService = pdfService;
            _environment = environment;
        }

        [HttpGet("scan")]
        public IActionResult ScanQRCodeInfo()
        {
            return Ok("API 連線成功，請使用 POST 並上傳圖片檔案欄位 imageFile 來進行 QR Code 掃描。");
        }

        [HttpPost("scan")]
        public async Task<IActionResult> ScanQRCode([FromForm] IFormFile imageFile)
        {
            if (imageFile == null || imageFile.Length == 0)
                return BadRequest("No image uploaded.");

            // 檢查檔案類型
            var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".bmp", ".gif" };
            var fileExtension = Path.GetExtension(imageFile.FileName).ToLowerInvariant();
            
            if (!allowedExtensions.Contains(fileExtension))
                return BadRequest("Unsupported file format. Please upload JPG, PNG, BMP, or GIF files.");

            try
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

                if (result == null)
                    return NotFound("No QR code found in the image.");

                var qrCodeText = result.Text.Trim();
                
                // 查詢資料庫
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

                // 查詢客戶資訊
                var customerInfo = await _erpContext.ItCustomer
                    .Where(c => c.customerno == orderInfo.customerno)
                    .FirstOrDefaultAsync();

                // 儲存原始圖片
                var originalImagePath = await SaveOriginalImage(imageFile, orderInfo.customerno);

                // 轉換為 PDF
                var receiptDate = DateTime.Now;
                var groupName = $"DN_{orderInfo.customerno}_{orderInfo.invoiceno}_{receiptDate:yyyyMMddHHmm}";
                var pdfPath = _pdfService.ConvertImageToPdf(originalImagePath, orderInfo.customerno, orderInfo.invoiceno, groupName);
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
                    upload_date = DateTime.Now,
                    upload_ip = HttpContext.Connection.RemoteIpAddress?.ToString(),
                    status = "PENDING",
                    uploaded_by = "DeliveryMan"
                };

                _context.DeliveryReceipt.Add(deliveryReceipt);
                await _context.SaveChangesAsync();

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
            catch (ArgumentException ex)
            {
                return BadRequest($"Invalid image format: {ex.Message}");
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Internal error: {ex.Message}");
            }
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
    }
}