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
using System.Text.Json;

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
        private readonly LoggingService _loggingService;
        private static MemoryCache _messageCache = new MemoryCache(new MemoryCacheOptions());
        private static MemoryCache _groupCache = new MemoryCache(new MemoryCacheOptions());

        public WhatsAppQrScanController(PurpleRiceDbContext context, ErpDbContext erpContext, PdfService pdfService, IWebHostEnvironment environment, IConfiguration configuration, Func<string, LoggingService> loggingServiceFactory)
        {
            _context = context;
            _erpContext = erpContext;
            _pdfService = pdfService;
            _environment = environment;
            _configuration = configuration;
            _loggingService = loggingServiceFactory("WhatsAppQrScanController");
        }

        [HttpGet("scan")]
        public IActionResult ScanQRCodeInfo()
        {
            return Ok("API 連線成功，請使用 POST 並上傳圖片檔案欄位 imageFile 來進行 QR Code 掃描。");
        }

        [HttpPost("scan")]
        public async Task<IActionResult> ScanQRCode([FromForm] IFormFile imageFile)
        {
            byte[] imageData = null; // 在方法開始時聲明變量
            
            if (imageFile == null || imageFile.Length == 0)
                return BadRequest("No image uploaded.");

            // 檢查檔案類型
            var allowedExtensions = new[] { ".jpg", ".jpeg", ".png", ".bmp", ".gif" };
            var fileExtension = Path.GetExtension(imageFile.FileName).ToLowerInvariant();
            
            if (!allowedExtensions.Contains(fileExtension))
                return BadRequest("Unsupported file format. Please upload JPG, PNG, BMP, or GIF files.");

            try
            {
                // 先將圖片轉換為 byte[] 以便後續處理
                using (var memoryStream = new MemoryStream())
                {
                    await imageFile.CopyToAsync(memoryStream);
                    imageData = memoryStream.ToArray();
                }

                using var stream = new MemoryStream(imageData);
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
                {
                    // 保存失敗的圖片
                    var failureImagePath = await SaveQRCodeImageAsync(imageData, "failure");
                    
                    return NotFound(new { 
                        message = "No QR code found in the image.",
                        imagePath = failureImagePath
                    });
                }

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
                // 保存格式錯誤的圖片
                try
                {
                    if (imageData != null && imageData.Length > 0)
                    {
                        var errorImagePath = await SaveQRCodeImageAsync(imageData, "format_error");
                        return BadRequest(new { 
                            message = $"Invalid image format: {ex.Message}",
                            imagePath = errorImagePath
                        });
                    }
                }
                catch (Exception saveEx)
                {
                    _loggingService.LogError($"保存格式錯誤圖片失敗: {saveEx.Message}", saveEx);
                }
                
                return BadRequest($"Invalid image format: {ex.Message}");
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"QR Code 掃描發生錯誤: {ex.Message}", ex);
                
                // 保存異常錯誤的圖片
                try
                {
                    if (imageData != null && imageData.Length > 0)
                    {
                        var errorImagePath = await SaveQRCodeImageAsync(imageData, "error");
                        return StatusCode(500, new { 
                            message = $"Internal error: {ex.Message}",
                            imagePath = errorImagePath
                        });
                    }
                }
                catch (Exception saveEx)
                {
                    _loggingService.LogError($"保存錯誤圖片失敗: {saveEx.Message}", saveEx);
                }
                
                return StatusCode(500, $"Internal error: {ex.Message}");
            }
        }

        [HttpGet("{companyToken}")]
        public async Task<IActionResult> VerifyWebhook(string companyToken, [FromQuery(Name = "hub.mode")] string mode,
                                       [FromQuery(Name = "hub.challenge")] string challenge,
                                       [FromQuery(Name = "hub.verify_token")] string verifyToken)
        {
            // 查找對應的公司
            var company = await _context.Companies.FirstOrDefaultAsync(c => c.WA_WebhookToken == companyToken);
            if (company == null)
            {
                return Unauthorized("Company not found");
            }

            // 檢查驗證令牌是否匹配
            if (mode == "subscribe" && verifyToken == company.WA_VerifyToken)
            {
                return Content(challenge);
            }
            else
            {
                return Unauthorized();
            }
        }

        private async Task SendWhatsAppReply(string waId, Company company)
        {
            _loggingService.LogInformation($"=== 開始發送 WhatsApp 回覆 ===");
            _loggingService.LogInformation($"目標 waId: {waId}");
            
            try
            {
                // 使用傳入的 company 參數，而不是重新查詢
                if (company == null)
                {
                    _loggingService.LogError("錯誤：未找到公司資料");
                    return;
                }
                
                if (string.IsNullOrEmpty(company.WA_API_Key))
                {
                    _loggingService.LogError("錯誤：WA_API_Key 為空");
                    return;
                }
                
                if (string.IsNullOrEmpty(company.WA_PhoneNo_ID))
                {
                    _loggingService.LogError("錯誤：WA_PhoneNo_ID 為空");
                    return;
                }
                
                _loggingService.LogInformation($"公司名稱: {company.Name}");
                _loggingService.LogInformation($"WA_PhoneNo_ID: {company.WA_PhoneNo_ID}");
                _loggingService.LogDebug($"API Key 長度: {company.WA_API_Key?.Length ?? 0}");

                var url = $"https://graph.facebook.com/{WhatsAppApiConfig.GetApiVersion()}/{company.WA_PhoneNo_ID}/messages";
                _loggingService.LogInformation($"API URL: {url}");

                var messageText = "親愛的送貨員/客戶，系統未能在您傳送的訊息或照片中辨識到有效的送貨單資料。請您盡量在光線充足的環境下，將送貨單的 QR Code 清晰拍攝後再傳送，謝謝您的配合！\n\nDear delivery staff/customer, our system could not identify valid delivery note information from your message or photo. Please try to take a clear photo of the delivery note's QR code in a well-lit environment and resend it. Thank you for your cooperation!";

                var payload = new
                {
                    messaging_product = "whatsapp",
                    to = waId,
                    type = "text",
                    text = new { body = messageText }
                };

                var jsonPayload = System.Text.Json.JsonSerializer.Serialize(payload);
                _loggingService.LogDebug($"發送的 Payload: {jsonPayload}");

                using var httpClient = new HttpClient();
                httpClient.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", company.WA_API_Key);
                
                var content = new StringContent(jsonPayload, System.Text.Encoding.UTF8, "application/json");
                _loggingService.LogInformation("發送 HTTP 請求...");
                
                var response = await httpClient.PostAsync(url, content);
                var responseContent = await response.Content.ReadAsStringAsync();
                
                _loggingService.LogInformation($"HTTP 回應狀態碼: {response.StatusCode}");
                _loggingService.LogDebug($"HTTP 回應內容: {responseContent}");
                
                if (response.IsSuccessStatusCode)
                {
                    _loggingService.LogInformation("WhatsApp 回覆發送成功！");
                }
                else
                {
                    _loggingService.LogError($"WhatsApp 回覆發送失敗，狀態碼: {response.StatusCode}");
                }
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"發送 WhatsApp 回覆時發生錯誤: {ex.Message}");
                _loggingService.LogDebug($"錯誤堆疊: {ex.StackTrace}");
            }
        }

        private async Task SendWhatsAppSuccessReply(string waId, Company company)
        {
            // 使用傳入的 company 參數，而不是重新查詢
            if (company == null || string.IsNullOrEmpty(company.WA_API_Key) || string.IsNullOrEmpty(company.WA_PhoneNo_ID))
            {
                _loggingService.LogError("WhatsApp 配置不完整");
                return;
            }

            var url = $"https://graph.facebook.com/{WhatsAppApiConfig.GetApiVersion()}/{company.WA_PhoneNo_ID}/messages";

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

        [HttpPost("{companyToken}")]
        public async Task<IActionResult> WhatsAppWebhook(string companyToken, [FromBody] object payload)
        {
            string waId = null;
            string mediaId = null;
            string messageId = null;
            string currentGroupDir = null;

            _loggingService.LogInformation($"=== WhatsApp Webhook 開始處理 ===");
            _loggingService.LogInformation($"CompanyToken: {companyToken}");
            _loggingService.LogDebug($"Payload: {payload}");

            try
            {
                // 使用 companyToken 查找對應的公司
                var company = await _context.Companies.FirstOrDefaultAsync(c => c.WA_WebhookToken == companyToken);
                if (company == null)
                {
                    _loggingService.LogWarning($"找不到對應的公司，Token: {companyToken}");
                    return NotFound("Company not found");
                }

                _loggingService.LogInformation($"找到公司: {company.Name} (ID: {company.Id})");

                var json = payload.ToString();
                _loggingService.LogDebug($"JSON 字串: {json}");
                
                using var doc = System.Text.Json.JsonDocument.Parse(json);
                var root = doc.RootElement;
                _loggingService.LogDebug($"Root 元素: {root}");
                
                var entry = root.GetProperty("entry")[0];
                _loggingService.LogDebug($"Entry: {entry}");
                
                var changes = entry.GetProperty("changes")[0];
                _loggingService.LogDebug($"Changes: {changes}");
                
                var value = changes.GetProperty("value");
                _loggingService.LogDebug($"Value: {value}");
                
                var messages = value.GetProperty("messages")[0];
                _loggingService.LogDebug($"Messages: {messages}");

                // 取 wa_id
                if (value.TryGetProperty("contacts", out var contacts))
                {
                    waId = contacts[0].GetProperty("wa_id").GetString();
                    _loggingService.LogInformation($"取得 wa_id: {waId}");
                }
                else
                {
                    _loggingService.LogWarning("未找到 contacts 屬性");
                }

                // 取 message id
                if (messages.TryGetProperty("id", out var msgIdProp))
                {
                    messageId = msgIdProp.GetString();
                    _loggingService.LogInformation($"取得 message_id: {messageId}");
                }
                else
                {
                    _loggingService.LogWarning("未找到 message id 屬性");
                }

                // 取 image id
                if (messages.TryGetProperty("image", out var image))
                {
                    mediaId = image.GetProperty("id").GetString();
                    _loggingService.LogInformation($"取得 image media_id: {mediaId}");
                }
                else
                {
                    _loggingService.LogInformation("未找到 image 屬性，檢查其他訊息類型...");
                    
                    // 檢查是否有文字訊息
                    if (messages.TryGetProperty("text", out var text))
                    {
                        var textBody = text.GetProperty("body").GetString();
                        _loggingService.LogInformation($"發現文字訊息: {textBody}");
                    }
                    
                    // 檢查是否有文件訊息
                    if (messages.TryGetProperty("document", out var document))
                    {
                        _loggingService.LogInformation("發現文件訊息");
                    }
                    
                    // 檢查是否有語音訊息
                    if (messages.TryGetProperty("audio", out var audio))
                    {
                        _loggingService.LogInformation("發現語音訊息");
                    }
                    
                    // 取得目前分組目錄
                    if (!string.IsNullOrEmpty(waId) && _groupCache.TryGetValue(waId, out string groupDir) && !string.IsNullOrEmpty(groupDir))
                    {
                        _loggingService.LogInformation($"找到現有分組目錄: {groupDir}");
                        await SaveImageToGroupDir(mediaId, waId, groupDir);
                    }
                    else
                    {
                        _loggingService.LogInformation($"未找到現有分組目錄，waId: {waId}");
                    }
                    
                    if (!string.IsNullOrEmpty(waId)) 
                    {
                        _loggingService.LogInformation($"發送回覆給 waId: {waId}");
                        await SendWhatsAppReply(waId, company);
                    }
                    else
                    {
                        _loggingService.LogWarning("無法發送回覆，waId 為空");
                    }
                    return Ok();
                }

                if (string.IsNullOrEmpty(mediaId))
                {
                    _loggingService.LogInformation("mediaId 為空，發送回覆");
                    if (!string.IsNullOrEmpty(waId) && _groupCache.TryGetValue(waId, out string groupDir) && !string.IsNullOrEmpty(groupDir))
                    {
                        await SaveImageToGroupDir(mediaId, waId, groupDir);
                    }
                    if (!string.IsNullOrEmpty(waId)) await SendWhatsAppReply(waId, company);
                    return Ok();
                }

                _loggingService.LogInformation($"開始下載圖片，mediaId: {mediaId}");
                // 下載圖片
                byte[] imageBytes = null;
                try
                {
                    // 使用已找到的公司配置，不需要重新查詢
                    if (string.IsNullOrEmpty(company.WA_API_Key))
                    {
                        _loggingService.LogWarning("WhatsApp 配置不完整，無法下載圖片");
                        if (!string.IsNullOrEmpty(waId)) await SendWhatsAppReply(waId, company);
                        return Ok();
                    }

                    using var httpClient = new HttpClient();
                    httpClient.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", company.WA_API_Key);
                    var metaResp = await httpClient.GetAsync($"https://graph.facebook.com/{WhatsAppApiConfig.GetApiVersion()}/{mediaId}");
                    var metaJson = await metaResp.Content.ReadAsStringAsync();
                    dynamic metaObj = System.Text.Json.JsonSerializer.Deserialize<System.Text.Json.Nodes.JsonObject>(metaJson);
                    var mediaUrl = metaObj?["url"]?.ToString();
                    if (mediaUrl == null) { if (!string.IsNullOrEmpty(waId)) await SendWhatsAppReply(waId, company); return Ok(); }
                    var imgResp = await httpClient.GetAsync(mediaUrl);
                    if (!imgResp.IsSuccessStatusCode) { if (!string.IsNullOrEmpty(waId)) await SendWhatsAppReply(waId, company); return Ok(); }
                    imageBytes = await imgResp.Content.ReadAsByteArrayAsync();
                }
                catch (Exception ex)
                {
                    _loggingService.LogError($"下載圖片失敗: {ex.Message}", ex);
                    if (!string.IsNullOrEmpty(waId)) await SendWhatsAppReply(waId, company);
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
                        if (!string.IsNullOrEmpty(waId)) await SendWhatsAppReply(waId, company);
                        return Ok();
                    }
                    qrCodeText = result.Text.Trim();
                    _loggingService.LogInformation($"掃描到 QR Code 文字: {qrCodeText}");
                }
                catch (Exception ex)
                {
                    _loggingService.LogError($"掃描 QR Code 失敗: {ex.Message}", ex);
                    if (!string.IsNullOrEmpty(waId) && _groupCache.TryGetValue(waId, out string groupDir) && !string.IsNullOrEmpty(groupDir))
                    {
                        await SaveImageToGroupDir(mediaId, waId, groupDir, imageBytes);
                    }
                    if (!string.IsNullOrEmpty(waId)) await SendWhatsAppReply(waId, company);
                    return Ok();
                }

                // 查資料庫
                // 新增：解析 QR Code 格式來提取 invoice no
                string extractedInvoiceNo = qrCodeText;
                
                // 檢查是否為新的 QR Code 格式
                if (qrCodeText.StartsWith("DN*") || qrCodeText.StartsWith("INV*"))
                {
                    // 分割字串並取得第二個元素（索引1）
                    var parts = qrCodeText.Split('*');
                    if (parts.Length >= 2)
                    {
                        extractedInvoiceNo = parts[1];
                        _loggingService.LogInformation($"從 QR Code 格式 '{qrCodeText}' 中提取到 invoice no: {extractedInvoiceNo}");
                    }
                    else
                    {
                        _loggingService.LogWarning($"QR Code 格式不正確，無法解析: {qrCodeText}");
                    }
                }
                
                var orderInfo = await _erpContext.SoOrderManage.Where(o => o.invoiceno == extractedInvoiceNo).FirstOrDefaultAsync();
                if (orderInfo == null)
                {
                    _loggingService.LogWarning($"QR Code 文字 '{qrCodeText}' 提取的 invoice no '{extractedInvoiceNo}' 未找到對應的訂單資訊");
                    if (!string.IsNullOrEmpty(waId) && _groupCache.TryGetValue(waId, out string groupDir) && !string.IsNullOrEmpty(groupDir))
                    {
                        await SaveImageToGroupDir(mediaId, waId, groupDir, imageBytes);
                    }
                    if (!string.IsNullOrEmpty(waId)) await SendWhatsAppReply(waId, company);
                    return Ok();
                }
                _loggingService.LogInformation($"找到訂單資訊: 客戶編號={orderInfo.customerno}, 發票號碼={orderInfo.invoiceno}");

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
                _loggingService.LogInformation($"儲存圖片到新分組: {newGroupDir}");

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
                _loggingService.LogInformation($"產生 PDF: {pdfPath}");

                // 寫入 DeliveryReceipt
                imageRelPath = $"Customer\\{customerNo}\\Original\\{groupName}\\{groupName}_1.jpg"; // 假設只存第一張
                pdfRelPath = $"Customer\\{customerNo}\\PDF\\{groupName}.pdf";
                customerInfo = await _erpContext.ItCustomer.Where(c => c.customerno == orderInfo.customerno).FirstOrDefaultAsync();
                receiptDate = DateTime.Now;
                _loggingService.LogInformation($"寫入 DeliveryReceipt: 發票號碼={orderInfo.invoiceno}, 客戶編號={orderInfo.customerno}");

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
                _loggingService.LogInformation($"儲存 DeliveryReceipt 到資料庫，ID: {deliveryReceipt.id}");

                // 發送成功訊息給送貨員，要求拍攝送貨證明照片
                if (!string.IsNullOrEmpty(waId))
                {
                    await SendWhatsAppSuccessReply(waId, company);
                    _loggingService.LogInformation($"發送成功回覆給 waId: {waId}");
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
                _loggingService.LogInformation($"回傳成功訊息給用戶，waId: {waId}");
                return Ok(response);
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"=== Webhook 處理發生錯誤 ===");
                _loggingService.LogError($"錯誤訊息: {ex.Message}");
                _loggingService.LogDebug($"錯誤堆疊: {ex.StackTrace}");
                _loggingService.LogDebug($"Payload 內容: {payload}");
                
                // 嘗試回覆用戶
                if (!string.IsNullOrEmpty(waId))
                {
                    _loggingService.LogInformation($"嘗試發送錯誤回覆給 waId: {waId}");
                    try
                    {
                        // 需要從外部作用域獲取 company
                        var companyForError = await _context.Companies.FirstOrDefaultAsync(c => c.WA_WebhookToken == companyToken);
                        if (companyForError != null)
                        {
                            await SendWhatsAppReply(waId, companyForError);
                            _loggingService.LogInformation("錯誤回覆發送成功");
                        }
                    }
                    catch (Exception replyEx)
                    {
                        _loggingService.LogError($"發送錯誤回覆失敗: {replyEx.Message}", replyEx);
                    }
                }
                else
                {
                    _loggingService.LogWarning("無法發送錯誤回覆，waId 為空");
                }
                
                return Ok();
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

        /// <summary>
        /// 保存 QR Code 圖片到指定目錄
        /// </summary>
        /// <param name="imageData">圖片數據</param>
        /// <param name="status">掃描狀態 (success/failure)</param>
        /// <returns>保存的圖片路徑</returns>
        private async Task<string> SaveQRCodeImageAsync(byte[] imageData, string status)
        {
            try
            {
                // 創建目錄結構：Uploads\Whatsapp_Images
                var uploadsPath = Path.Combine(_environment.ContentRootPath, "Uploads", "Whatsapp_Images");
                
                if (!Directory.Exists(uploadsPath))
                {
                    Directory.CreateDirectory(uploadsPath);
                    _loggingService.LogInformation($"創建 QR Code 圖片目錄: {uploadsPath}");
                }

                // 生成文件名：使用時間戳和 GUID 確保唯一性
                var timestamp = DateTime.Now.ToString("yyyyMMdd_HHmmss");
                var guid = Guid.NewGuid().ToString("N")[..8]; // 取前8位
                var fileName = $"qr_scan_{status}_{timestamp}_{guid}.jpg";
                
                var filePath = Path.Combine(uploadsPath, fileName);

                // 保存圖片文件
                await System.IO.File.WriteAllBytesAsync(filePath, imageData);
                
                _loggingService.LogInformation($"QR Code 圖片已保存: {filePath}");
                return filePath;
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"保存 QR Code 圖片失敗: {ex.Message}", ex);
                throw;
            }
        }
    }
} 