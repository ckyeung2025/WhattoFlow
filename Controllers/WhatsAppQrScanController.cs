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
using Microsoft.Extensions.Caching.Memory;
using PurpleRice.Data;

namespace PurpleRice.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class WhatsAppQrScanController : ControllerBase
    {
        private readonly PurpleRiceDbContext _context;
        private readonly ErpDbContext _erpContext;
        private readonly PdfService _pdfService;
        private readonly IWebHostEnvironment _environment;
        private readonly IConfiguration _configuration;
        private static MemoryCache _messageCache = new MemoryCache(new MemoryCacheOptions());
        private static MemoryCache _groupCache = new MemoryCache(new MemoryCacheOptions());

        public WhatsAppQrScanController(PurpleRiceDbContext context, ErpDbContext erpContext, PdfService pdfService, IWebHostEnvironment environment, IConfiguration configuration)
        {
            _context = context;
            _erpContext = erpContext;
            _pdfService = pdfService;
            _environment = environment;
            _configuration = configuration;
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

                // 儲存記錄到資料庫
                var deliveryReceipt = new DeliveryReceipt
                {
                    within_code = orderInfo.within_code,
                    invoiceno = orderInfo.invoiceno,
                    customerno = orderInfo.customerno,
                    customername = customerInfo?.customername1,
                    contacttel1 = customerInfo?.contacttel1,
                    contacttel2 = customerInfo?.contacttel2,
                    original_image_path = _pdfService.GetRelativePath(originalImagePath),
                    pdf_path = _pdfService.GetRelativePath(pdfPath),
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

        [HttpGet("webhook")]
        public async Task<IActionResult> VerifyWebhook([FromQuery(Name = "hub.mode")] string mode,
                                           [FromQuery(Name = "hub.challenge")] string challenge,
                                           [FromQuery(Name = "hub.verify_token")] string verifyToken)
        {
            // 從第一個公司獲取 VerifyToken（假設只有一個公司）
            var company = await _context.Companies.FirstOrDefaultAsync();
            if (company == null)
            {
                return Unauthorized("No company found");
            }

            if (mode == "subscribe" && verifyToken == company.WA_VerifyToken)
            {
                return Content(challenge);
            }
            else
            {
                return Unauthorized();
            }
        }

        private async Task SendWhatsAppReply(string waId)
        {
            // 從第一個公司獲取 WhatsApp 配置
            var company = await _context.Companies.FirstOrDefaultAsync();
            if (company == null || string.IsNullOrEmpty(company.WA_API_Key) || string.IsNullOrEmpty(company.WA_PhoneNo_ID))
            {
                Console.WriteLine("WhatsApp 配置不完整");
                return;
            }

            var url = $"https://graph.facebook.com/v19.0/{company.WA_PhoneNo_ID}/messages";

            var messageText = "親愛的送貨員/客戶，系統未能在您傳送的訊息或照片中辨識到有效的送貨單資料。請您盡量在光線充足的環境下，將送貨單的 QR Code 清晰拍攝後再傳送，謝謝您的配合！\n\nDear delivery staff/customer, our system could not identify valid delivery note information from your message or photo. Please try to take a clear photo of the delivery note’s QR code in a well-lit environment and resend it. Thank you for your cooperation!";

            var payload = new
            {
                messaging_product = "whatsapp",
                to = waId,
                type = "text",
                text = new { body = messageText }
            };

            using var httpClient = new HttpClient();
            httpClient.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", company.WA_API_Key);
            var content = new StringContent(System.Text.Json.JsonSerializer.Serialize(payload), System.Text.Encoding.UTF8, "application/json");
            await httpClient.PostAsync(url, content);
        }

        private async Task SendWhatsAppSuccessReply(string waId)
        {
            // 從第一個公司獲取 WhatsApp 配置
            var company = await _context.Companies.FirstOrDefaultAsync();
            if (company == null || string.IsNullOrEmpty(company.WA_API_Key) || string.IsNullOrEmpty(company.WA_PhoneNo_ID))
            {
                Console.WriteLine("WhatsApp 配置不完整");
                return;
            }

            var url = $"https://graph.facebook.com/v19.0/{company.WA_PhoneNo_ID}/messages";

            var messageText = "親愛的送貨員，系統已成功找到對應的送貨單記錄。請您現在協助拍攝一張清楚的照片，以證明貨物已送達客戶收貨地址。\n- 請盡量讓照片中同時顯示所有貨物。\n- 建議額外拍攝一張較遠距離（zoom out）的照片，能清楚看到收貨地點的店面或門口位置。\n感謝您的配合！\n\nDear delivery staff, the system has successfully found the corresponding delivery note record. Please now take a clear photo as proof that the goods have been delivered to the customer's address.\n- Please ensure all goods are visible in the photo at the same time.\n- It is also recommended to take an additional zoomed-out photo showing the storefront or entrance of the delivery location.\nThank you for your cooperation!";

            var payload = new
            {
                messaging_product = "whatsapp",
                to = waId,
                type = "text",
                text = new { body = messageText }
            };

            using var httpClient = new HttpClient();
            httpClient.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", company.WA_API_Key);
            var content = new StringContent(System.Text.Json.JsonSerializer.Serialize(payload), System.Text.Encoding.UTF8, "application/json");
            await httpClient.PostAsync(url, content);
        }

        [HttpPost("webhook")]
        public async Task<IActionResult> WhatsAppWebhook([FromBody] object payload)
        {
            string waId = null;
            string mediaId = null;
            string messageId = null;
            string currentGroupDir = null;

            try
            {
                var json = payload.ToString();
                using var doc = System.Text.Json.JsonDocument.Parse(json);
                var root = doc.RootElement;
                var entry = root.GetProperty("entry")[0];
                var changes = entry.GetProperty("changes")[0];
                var value = changes.GetProperty("value");
                var messages = value.GetProperty("messages")[0];

                // 取 wa_id
                if (value.TryGetProperty("contacts", out var contacts))
                    waId = contacts[0].GetProperty("wa_id").GetString();

                // 取 message id
                if (messages.TryGetProperty("id", out var msgIdProp))
                    messageId = msgIdProp.GetString();

                // 取 image id
                if (messages.TryGetProperty("image", out var image))
                    mediaId = image.GetProperty("id").GetString();
                else
                {
                    // 取得目前分組目錄
                    if (!string.IsNullOrEmpty(waId) && _groupCache.TryGetValue(waId, out string groupDir) && !string.IsNullOrEmpty(groupDir))
                    {
                        await SaveImageToGroupDir(mediaId, waId, groupDir);
                    }
                    if (!string.IsNullOrEmpty(waId)) await SendWhatsAppReply(waId);
                    return Ok();
                }

                if (string.IsNullOrEmpty(mediaId))
                {
                    if (!string.IsNullOrEmpty(waId) && _groupCache.TryGetValue(waId, out string groupDir) && !string.IsNullOrEmpty(groupDir))
                    {
                        await SaveImageToGroupDir(mediaId, waId, groupDir);
                    }
                    if (!string.IsNullOrEmpty(waId)) await SendWhatsAppReply(waId);
                    return Ok();
                }
            }
            catch
            {
                return Ok();
            }

            // 下載圖片
            byte[] imageBytes = null;
            try
            {
                // 從第一個公司獲取 WhatsApp 配置
                var company = await _context.Companies.FirstOrDefaultAsync();
                if (company == null || string.IsNullOrEmpty(company.WA_API_Key))
                {
                    Console.WriteLine("WhatsApp 配置不完整，無法下載圖片");
                    if (!string.IsNullOrEmpty(waId)) await SendWhatsAppReply(waId);
                    return Ok();
                }

                using var httpClient = new HttpClient();
                httpClient.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", company.WA_API_Key);
                var metaResp = await httpClient.GetAsync($"https://graph.facebook.com/v19.0/{mediaId}");
                var metaJson = await metaResp.Content.ReadAsStringAsync();
                dynamic metaObj = System.Text.Json.JsonSerializer.Deserialize<System.Text.Json.Nodes.JsonObject>(metaJson);
                var mediaUrl = metaObj?["url"]?.ToString();
                if (mediaUrl == null) { if (!string.IsNullOrEmpty(waId)) await SendWhatsAppReply(waId); return Ok(); }
                var imgResp = await httpClient.GetAsync(mediaUrl);
                if (!imgResp.IsSuccessStatusCode) { if (!string.IsNullOrEmpty(waId)) await SendWhatsAppReply(waId); return Ok(); }
                imageBytes = await imgResp.Content.ReadAsByteArrayAsync();
            }
            catch
            {
                if (!string.IsNullOrEmpty(waId)) await SendWhatsAppReply(waId);
                return Ok();
            }

            // 掃描 QR code
            string qrCodeText = null;
            bool isNewGroup = false;
            string newGroupDir = null;
            string customerNo = null;
            try
            {
                using var ms = new MemoryStream(imageBytes);
                using var bitmap = new Bitmap(ms);
                var options = new DecodingOptions { TryHarder = true, PossibleFormats = new[] { BarcodeFormat.QR_CODE } };
                var reader = new BarcodeReader { AutoRotate = true, TryInverted = true, Options = options };
                var result = reader.Decode(bitmap);
                if (result == null)
                {
                    // 取得目前分組目錄
                    if (!string.IsNullOrEmpty(waId) && _groupCache.TryGetValue(waId, out string groupDir) && !string.IsNullOrEmpty(groupDir))
                    {
                        await SaveImageToGroupDir(mediaId, waId, groupDir, imageBytes);
                    }
                    if (!string.IsNullOrEmpty(waId)) await SendWhatsAppReply(waId);
                    return Ok();
                }
                qrCodeText = result.Text.Trim();
            }
            catch
            {
                if (!string.IsNullOrEmpty(waId) && _groupCache.TryGetValue(waId, out string groupDir) && !string.IsNullOrEmpty(groupDir))
                {
                    await SaveImageToGroupDir(mediaId, waId, groupDir, imageBytes);
                }
                if (!string.IsNullOrEmpty(waId)) await SendWhatsAppReply(waId);
                return Ok();
            }

            // 查資料庫
            var orderInfo = await _erpContext.SoOrderManage.Where(o => o.invoiceno == qrCodeText).FirstOrDefaultAsync();
            if (orderInfo == null)
            {
                if (!string.IsNullOrEmpty(waId) && _groupCache.TryGetValue(waId, out string groupDir) && !string.IsNullOrEmpty(groupDir))
                {
                    await SaveImageToGroupDir(mediaId, waId, groupDir, imageBytes);
                }
                if (!string.IsNullOrEmpty(waId)) await SendWhatsAppReply(waId);
                return Ok();
            }

            // 新分組：以 DN_{customerNo}_{invoiceNo}_{yyyyMMddHHmm} 為目錄名
            customerNo = orderInfo.customerno;
            var invoiceNo = orderInfo.invoiceno;
            var uploadsPath = Path.Combine(_environment.ContentRootPath, "Uploads");
            var groupBaseDir = Path.Combine(uploadsPath, "Customer", customerNo, "Original");
            var groupName = $"DN_{customerNo}_{invoiceNo}_{DateTime.Now:yyyyMMddHHmm}";
            newGroupDir = Path.Combine(groupBaseDir, groupName);
            Directory.CreateDirectory(newGroupDir);
            // 更新 mapping
            if (!string.IsNullOrEmpty(waId))
                _groupCache.Set(waId, newGroupDir, TimeSpan.FromHours(2));
            // 儲存這張圖到新分組
            await SaveImageToGroupDir(mediaId, waId, newGroupDir, imageBytes);

            // 方法開頭統一宣告
            string originalImagePath = null;
            string pdfPath = null;
            string imageRelPath = null;
            string pdfRelPath = null;
            DeliveryReceipt deliveryReceipt = null;
            ItCustomer customerInfo = null;
            DateTime receiptDate = DateTime.Now;

            // 產生 PDF
            originalImagePath = await SaveOriginalImageFromBytes(imageBytes, orderInfo.customerno);
            pdfPath = _pdfService.ConvertImageToPdf(originalImagePath, customerNo, invoiceNo, groupName);

            // 寫入 DeliveryReceipt
            imageRelPath = $"Customer\\{customerNo}\\Original\\{groupName}\\{groupName}_1.jpg"; // 假設只存第一張
            pdfRelPath = $"Customer\\{customerNo}\\PDF\\{groupName}.pdf";
            customerInfo = await _erpContext.ItCustomer.Where(c => c.customerno == orderInfo.customerno).FirstOrDefaultAsync();
            receiptDate = DateTime.Now;

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
                uploaded_by = "DeliveryMan"
            };
            _context.DeliveryReceipt.Add(deliveryReceipt);
            await _context.SaveChangesAsync();

            // 發送成功訊息給送貨員，要求拍攝送貨證明照片
            if (!string.IsNullOrEmpty(waId))
            {
                await SendWhatsAppSuccessReply(waId);
            }

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

        // 新增：從 byte[] 儲存圖片
        private async Task<string> SaveOriginalImageFromBytes(byte[] imageBytes, string customerNo)
        {
            var uploadsPath = Path.Combine(_environment.ContentRootPath, "Uploads");
            var customerPath = Path.Combine(uploadsPath, "Customer", customerNo, "Original");
            Directory.CreateDirectory(customerPath);
            var fileName = $"DN_{customerNo}_{DateTime.Now:yyyyMMdd_HHmmss}.jpg";
            var filePath = Path.Combine(customerPath, fileName);
            await System.IO.File.WriteAllBytesAsync(filePath, imageBytes);
            return filePath;
        }

        // 新增：將圖片存到指定分組目錄（自動流水號命名，支援 jpg/png）
        private async Task SaveImageToGroupDir(string mediaId, string waId, string groupDir, byte[] imageBytes = null)
        {
            if (string.IsNullOrEmpty(groupDir)) return;
            Directory.CreateDirectory(groupDir);
            // 取得 groupName
            var groupName = Path.GetFileName(groupDir);
            // 計算現有圖片數量（jpg/png）
            var jpgCount = Directory.GetFiles(groupDir, $"{groupName}_*.jpg").Length;
            var pngCount = Directory.GetFiles(groupDir, $"{groupName}_*.png").Length;
            int nextIndex = jpgCount + pngCount + 1;
            // 預設副檔名 jpg
            string ext = ".jpg";
            // 嘗試判斷實際副檔名
            if (imageBytes != null && imageBytes.Length > 4)
            {
                // 簡單判斷 png header
                if (imageBytes[0] == 0x89 && imageBytes[1] == 0x50 && imageBytes[2] == 0x4E && imageBytes[3] == 0x47)
                    ext = ".png";
            }
            var fileName = $"{groupName}_{nextIndex}{ext}";
            var filePath = Path.Combine(groupDir, fileName);
            if (imageBytes != null)
            {
                await System.IO.File.WriteAllBytesAsync(filePath, imageBytes);
            }
        }
    }
} 