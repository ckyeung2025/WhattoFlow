using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PurpleRice.Data;
using PurpleRice.Models;
using PurpleRice.Services;
using System;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using System.Net.Http.Headers;
using System.Collections.Generic;

namespace PurpleRice.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class CompanyPhoneVerificationController : ControllerBase
    {
        private readonly PurpleRiceDbContext _db;
        private readonly LoggingService _loggingService;
        
        public CompanyPhoneVerificationController(
            PurpleRiceDbContext db,
            LoggingService loggingService)
        {
            _db = db;
            _loggingService = loggingService;
        }

        /// <summary>
        /// Admin 上傳憑證和電話號碼（用於記錄，實際電話號碼已在 Meta Business Suite 中註冊）
        /// 注意：階段1、2已手動完成，Company.WA_PhoneNo_ID 已存在
        /// 系統只需要生成驗證 URL，客戶輸入 OTP 完成連結
        /// </summary>
        [HttpPost("upload-certificate")]
        public async Task<IActionResult> UploadCertificate([FromBody] CertificateUploadRequest request)
        {
            try
            {
                _loggingService.LogInformation($"=== 上傳憑證開始（簡化流程：階段1、2已手動完成）===");
                _loggingService.LogInformation($"CompanyId: {request?.CompanyId}, PhoneNumber: {request?.PhoneNumber ?? "null"}, Certificate: {(string.IsNullOrEmpty(request?.Certificate) ? "null/empty" : "provided")}");
                
                // 檢查請求對象
                if (request == null)
                {
                    _loggingService.LogError("請求對象為 null");
                    return BadRequest(new { error = "請求數據無效" });
                }
                
                // 檢查 CompanyId
                if (string.IsNullOrEmpty(request.CompanyId))
                {
                    _loggingService.LogError("CompanyId 為空");
                    return BadRequest(new { error = "公司 ID 不能為空" });
                }
                
                // 驗證請求
                // 電話號碼改為可選（如果 Company.WA_PhoneNo_ID 存在，可以從 Meta API 查詢）
                // 但如果沒有 PhoneNumberId，電話號碼仍然是必需的
                
                if (!Guid.TryParse(request.CompanyId, out var companyId))
                {
                    return BadRequest(new { error = "無效的公司 ID" });
                }
                
                // 檢查公司是否存在
                var company = await _db.Companies
                    .FirstOrDefaultAsync(c => c.Id == companyId);
                
                if (company == null)
                {
                    return NotFound(new { error = "找不到指定的公司" });
                }
                
                // 檢查 Company.WA_PhoneNo_ID 是否已配置（階段1、2應已手動完成）
                string? phoneNumberToUse = request.PhoneNumber;  // 預設使用請求中的電話號碼
                
                if (string.IsNullOrEmpty(company.WA_PhoneNo_ID))
                {
                    _loggingService.LogWarning($"⚠️ Company.WA_PhoneNo_ID 為空，請確認階段1、2已手動完成");
                    
                    // 如果沒有 WA_PhoneNo_ID，電話號碼是必需的
                    if (string.IsNullOrEmpty(request.PhoneNumber))
                    {
                        return BadRequest(new { error = "電話號碼不能為空（Company.WA_PhoneNo_ID 未配置）" });
                    }
                }
                else
                {
                    _loggingService.LogInformation($"✅ Company.WA_PhoneNo_ID 已配置: {company.WA_PhoneNo_ID}");
                    
                    // 如果電話號碼為空，嘗試從 Meta API 查詢（使用 PhoneNumberId）
                    if (string.IsNullOrEmpty(request.PhoneNumber))
                    {
                        _loggingService.LogInformation($"電話號碼為空，嘗試從 Meta API 查詢電話號碼");
                        
                        try
                        {
                            var apiVersion = WhatsAppApiConfig.GetApiVersion();
                            var queryUrl = $"https://graph.facebook.com/{apiVersion}/{company.WA_PhoneNo_ID}?fields=display_phone_number,verified_name";
                            
                            using var httpClient = new HttpClient();
                            httpClient.DefaultRequestHeaders.Authorization = 
                                new AuthenticationHeaderValue("Bearer", company.WA_API_Key);
                            
                            var queryResponse = await httpClient.GetAsync(queryUrl);
                            var queryResponseContent = await queryResponse.Content.ReadAsStringAsync();
                            
                            if (queryResponse.IsSuccessStatusCode)
                            {
                                var queryJson = JsonSerializer.Deserialize<JsonElement>(queryResponseContent);
                                if (queryJson.TryGetProperty("display_phone_number", out var displayPhone))
                                {
                                    phoneNumberToUse = displayPhone.GetString();
                                    _loggingService.LogInformation($"從 Meta API 查詢到電話號碼: {phoneNumberToUse}");
                                }
                            }
                            else
                            {
                                _loggingService.LogWarning($"從 Meta API 查詢電話號碼失敗: {queryResponseContent}");
                            }
                        }
                        catch (Exception ex)
                        {
                            _loggingService.LogWarning($"查詢電話號碼時發生錯誤: {ex.Message}");
                        }
                        
                        // 如果仍然沒有電話號碼，使用 Company 的 Phone 字段（如果有）
                        if (string.IsNullOrEmpty(phoneNumberToUse) && !string.IsNullOrEmpty(company.Phone))
                        {
                            phoneNumberToUse = company.Phone;
                            _loggingService.LogInformation($"使用 Company.Phone 作為電話號碼: {phoneNumberToUse}");
                        }
                        
                        // 如果還是沒有，允許為空（電話號碼主要用於顯示和記錄）
                        if (string.IsNullOrEmpty(phoneNumberToUse))
                        {
                            _loggingService.LogWarning($"無法獲取電話號碼，將使用空值（電話號碼主要用於顯示）");
                            phoneNumberToUse = "";  // 允許為空
                        }
                    }
                }
                
                // 檢查是否有未完成的驗證記錄（使用 PhoneNumberId 或電話號碼匹配）
                var existingPending = await _db.CompanyPhoneVerifications
                    .Include(v => v.Company)
                    .FirstOrDefaultAsync(v => 
                        v.CompanyId == companyId && 
                        (v.Status == "Pending" || v.Status == "Requested" || v.Status == "Verified") &&
                        (!string.IsNullOrEmpty(company.WA_PhoneNo_ID) && v.Company != null && v.Company.WA_PhoneNo_ID == company.WA_PhoneNo_ID || 
                         !string.IsNullOrEmpty(phoneNumberToUse) && !string.IsNullOrEmpty(v.PhoneNumber) && v.PhoneNumber == phoneNumberToUse));
                
                if (existingPending != null)
                {
                    // 如果已有進行中的驗證記錄，返回現有的 URL
                    var existingUrl = $"{Request.Scheme}://{Request.Host}/phone-verification/{existingPending.Id}";
                    _loggingService.LogInformation($"該電話號碼/PhoneNumberId 已有進行中的驗證記錄，返回現有 URL");
                    return Ok(new { 
                        VerificationId = existingPending.Id,
                        VerificationUrl = existingUrl,
                        Message = "已有進行中的驗證記錄，請使用現有 URL",
                        Existing = true
                    });
                }
                
                // 創建驗證記錄（憑證和電話號碼都可選，用於記錄）
                var verification = new CompanyPhoneVerification
                {
                    CompanyId = companyId,
                    PhoneNumber = phoneNumberToUse ?? "",  // 使用查詢到的或提供的電話號碼（可為空）
                    Certificate = request.Certificate ?? "",  // 憑證改為可選
                    CertificateExpiry = string.IsNullOrEmpty(request.Certificate) 
                        ? null 
                        : (DateTime?)DateTime.UtcNow.AddDays(7),
                    Status = "Pending",  // 待客戶輸入 PIN
                    CreatedAt = DateTime.UtcNow,
                    CreatedBy = request.CreatedBy ?? "admin"
                };
                
                _db.CompanyPhoneVerifications.Add(verification);
                await _db.SaveChangesAsync();
                
                _loggingService.LogInformation($"✅ 驗證記錄已創建（簡化流程），ID: {verification.Id}");
                _loggingService.LogInformation($"流程說明：階段1、2已手動完成，客戶只需輸入 OTP 完成連結");
                
                // 生成驗證 URL（供 Admin 發送給客戶）
                var verificationUrl = $"{Request.Scheme}://{Request.Host}/phone-verification/{verification.Id}";
                
                return Ok(new { 
                    VerificationId = verification.Id,
                    VerificationUrl = verificationUrl,
                    Message = "驗證記錄已創建，請將 URL 發送給客戶。客戶將在 Meta Business Suite 中收到 OTP，然後在此 URL 輸入驗證碼完成連結。",
                    Instructions = "客戶步驟：1) 訪問此 URL  2) 在 Meta Business Suite 中確認已收到 OTP  3) 在此 URL 輸入 6 位驗證碼  4) 系統自動完成連結"
                });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"上傳憑證失敗: {ex.Message}", ex);
                return BadRequest(new { error = ex.Message });
            }
        }

        /// <summary>
        /// 獲取驗證記錄詳情
        /// </summary>
        [HttpGet("{verificationId}")]
        public async Task<IActionResult> GetVerification(Guid verificationId)
        {
            try
            {
                var verification = await _db.CompanyPhoneVerifications
                    .Include(v => v.Company)
                    .FirstOrDefaultAsync(v => v.Id == verificationId);
                
                if (verification == null)
                {
                    return NotFound(new { error = "找不到驗證記錄" });
                }
                
                return Ok(new
                {
                    Id = verification.Id,
                    CompanyId = verification.CompanyId,
                    CompanyName = verification.Company?.Name,
                    PhoneNumber = verification.PhoneNumber,
                    Status = verification.Status,
                    CertificateExpiry = verification.CertificateExpiry,
                    CodeExpiry = verification.CodeExpiry,
                    CodeMethod = verification.CodeMethod,
                    PhoneNumberId = verification.Company?.WA_PhoneNo_ID ?? verification.PhoneNumberId,
                    CreatedAt = verification.CreatedAt,
                    UpdatedAt = verification.UpdatedAt,
                    ErrorMessage = verification.ErrorMessage
                });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取驗證記錄失敗: {ex.Message}", ex);
                return BadRequest(new { error = ex.Message });
            }
        }

        /// <summary>
        /// 客戶請求驗證碼
        /// </summary>
        [HttpPost("request-verification-code/{verificationId}")]
        public async Task<IActionResult> RequestVerificationCode(
            Guid verificationId, 
            [FromBody] RequestCodeRequest? request = null)
        {
            try
            {
                _loggingService.LogInformation($"=== 請求驗證碼開始 ===");
                _loggingService.LogInformation($"VerificationId: {verificationId}");
                
                var verification = await _db.CompanyPhoneVerifications
                    .Include(v => v.Company)
                    .FirstOrDefaultAsync(v => v.Id == verificationId);
                
                if (verification == null)
                {
                    return NotFound(new { error = "找不到驗證記錄" });
                }
                
                // 檢查憑證是否過期
                if (verification.CertificateExpiry < DateTime.UtcNow)
                {
                    verification.Status = "Expired";
                    verification.UpdatedAt = DateTime.UtcNow;
                    await _db.SaveChangesAsync();
                    return BadRequest(new { error = "憑證已過期，請聯繫管理員重新上傳" });
                }
                
                // 檢查驗證狀態（允許 Pending、Failed 和 Requested 狀態重新發送）
                if (verification.Status != "Pending" && verification.Status != "Failed" && verification.Status != "Requested")
                {
                    return BadRequest(new { error = "無效的驗證狀態，當前狀態：" + verification.Status });
                }
                
                // 確定使用的電話號碼
                // 優先使用驗證記錄中的電話號碼（Admin 上傳憑證時輸入的）
                // 如果客戶在請求中提供了電話號碼，使用客戶提供的（允許客戶修改）
                string phoneNumberToUse = verification.PhoneNumber;  // 默認使用驗證記錄中的電話號碼
                if (request != null && !string.IsNullOrEmpty(request.PhoneNumber))
                {
                    // 如果客戶提供了電話號碼，使用客戶提供的（可能是修正或更新）
                    phoneNumberToUse = request.PhoneNumber;
                    _loggingService.LogInformation($"客戶提供了電話號碼，使用客戶提供的: {phoneNumberToUse}");
                }
                else
                {
                    _loggingService.LogInformation($"使用驗證記錄中的電話號碼: {phoneNumberToUse}");
                }
                
                // 驗證電話號碼格式（如果電話號碼為空，使用驗證記錄中的）
                if (string.IsNullOrEmpty(phoneNumberToUse))
                {
                    return BadRequest(new { error = "電話號碼為空，請提供有效的電話號碼或在驗證記錄中配置電話號碼" });
                }
                
                // 檢查公司配置
                if (string.IsNullOrEmpty(verification.Company?.WA_Business_Account_ID))
                {
                    return BadRequest(new { error = "公司未配置 WhatsApp Business Account ID" });
                }
                
                if (string.IsNullOrEmpty(verification.Company?.WA_API_Key))
                {
                    return BadRequest(new { error = "公司未配置 WhatsApp API Key" });
                }
                
                var apiVersion = WhatsAppApiConfig.GetApiVersion();
                var businessAccountId = verification.Company.WA_Business_Account_ID;
                var accessToken = verification.Company.WA_API_Key;
                
                string? phoneNumberId = null;
                using var httpClient = new HttpClient();
                httpClient.DefaultRequestHeaders.Authorization = 
                    new AuthenticationHeaderValue("Bearer", accessToken);
                
                // 優先使用 Company.WA_PhoneNo_ID（已在 Meta Business Suite 中配置的 PhoneNumberId）
                if (!string.IsNullOrEmpty(verification.Company.WA_PhoneNo_ID))
                {
                    phoneNumberId = verification.Company.WA_PhoneNo_ID;
                    _loggingService.LogInformation($"✅ 使用 Company.WA_PhoneNo_ID: {phoneNumberId}（跳過註冊步驟）");
                    // 重置狀態和過期時間以便重新請求
                    verification.Status = "Pending";
                    verification.CodeExpiry = null;
                }
                // 如果 Company.WA_PhoneNo_ID 為空，檢查驗證記錄中的 PhoneNumberId
                else if (!string.IsNullOrEmpty(verification.PhoneNumberId))
                {
                    phoneNumberId = verification.PhoneNumberId;
                    _loggingService.LogInformation($"使用驗證記錄中的 PhoneNumberId: {phoneNumberId}");
                    // 同時更新 Company.WA_PhoneNo_ID 以便後續使用
                    verification.Company.WA_PhoneNo_ID = phoneNumberId;
                    verification.Status = "Pending";
                    verification.CodeExpiry = null;
                }
                else
                {
                    _loggingService.LogInformation($"PhoneNumberId 為空，需要註冊電話號碼");
                    
                    // 第一次註冊或沒有 PhoneNumberId，需要註冊電話號碼
                    // 從電話號碼中提取國家代碼（cc）
                    string countryCode = ExtractCountryCode(phoneNumberToUse);
                    if (string.IsNullOrEmpty(countryCode))
                    {
                        return BadRequest(new { error = "無法從電話號碼提取國家代碼，請確保電話號碼格式正確（例如：+85296062000）" });
                    }
                    
                    _loggingService.LogInformation($"提取的國家代碼: {countryCode}, 原始電話號碼: {phoneNumberToUse}");
                    
                    // 清理電話號碼格式
                    // 根據 Meta API 文檔，phone_number 參數應該包含完整的電話號碼（包括國家代碼）
                    // 但 cc 參數也需要提供國家代碼
                    string cleanedPhoneNumber = phoneNumberToUse;
                    
                    // 移除 + 號
                    cleanedPhoneNumber = cleanedPhoneNumber.Replace("+", "");
                    
                    // 移除所有非數字字符
                    var digitsOnly = new string(cleanedPhoneNumber.Where(char.IsDigit).ToArray());
                    
                    // 確保電話號碼以國家代碼開頭（如果沒有，則加上）
                    if (!string.IsNullOrEmpty(countryCode) && !digitsOnly.StartsWith(countryCode))
                    {
                        // 如果電話號碼不包含國家代碼，加上國家代碼
                        digitsOnly = countryCode + digitsOnly;
                        _loggingService.LogInformation($"電話號碼不包含國家代碼，已添加: {digitsOnly}");
                    }
                    else if (!string.IsNullOrEmpty(countryCode) && digitsOnly.StartsWith(countryCode))
                    {
                        // 如果電話號碼已經包含國家代碼，保持原樣
                        _loggingService.LogInformation($"電話號碼已包含國家代碼: {digitsOnly}");
                    }
                    
                    // 最終的電話號碼應該是包含國家代碼的完整號碼
                    cleanedPhoneNumber = digitsOnly;
                    
                    if (string.IsNullOrEmpty(cleanedPhoneNumber))
                    {
                        return BadRequest(new { error = "清理後的電話號碼為空，請檢查電話號碼格式" });
                    }
                    
                    _loggingService.LogInformation($"最終電話號碼: {cleanedPhoneNumber}, 國家代碼: {countryCode}");
                    
                    // 步驟 1: 使用 API 註冊電話號碼（包含憑證）
                    var registerUrl = $"https://graph.facebook.com/{apiVersion}/{businessAccountId}/phone_numbers";
                    
                    var registerPayload = new
                    {
                        verified_name = verification.Company.Name,
                        phone_number = cleanedPhoneNumber,  // 使用清理後的電話號碼（包含國家代碼的完整號碼）
                        cc = countryCode,  // 國家代碼（必填，用於驗證）
                        code_verification_status = "NOT_VERIFIED",
                        certificate = verification.Certificate
                    };
                    
                    _loggingService.LogInformation($"準備發送給 Meta API - phone_number: {cleanedPhoneNumber}, cc: {countryCode}");
                    
                    _loggingService.LogInformation($"註冊電話號碼 API URL: {registerUrl}");
                    
                    var registerContent = new StringContent(
                        JsonSerializer.Serialize(registerPayload), 
                        Encoding.UTF8, 
                        "application/json");
                    
                    var registerResponse = await httpClient.PostAsync(registerUrl, registerContent);
                    var registerResponseContent = await registerResponse.Content.ReadAsStringAsync();
                    
                    _loggingService.LogInformation($"註冊電話號碼 API 響應: {registerResponse.StatusCode}");
                    _loggingService.LogInformation($"註冊電話號碼 API 響應內容: {registerResponseContent}");
                    
                    if (!registerResponse.IsSuccessStatusCode)
                    {
                        // 解析 Meta API 錯誤信息
                        string errorMessage = "註冊電話號碼失敗";
                        string userFriendlyMessage = "註冊電話號碼失敗，請稍後再試";
                        
                        try
                        {
                            var errorJson = JsonSerializer.Deserialize<JsonElement>(registerResponseContent);
                            if (errorJson.TryGetProperty("error", out var errorObj))
                            {
                                if (errorObj.TryGetProperty("error_user_msg", out var userMsg))
                                {
                                    userFriendlyMessage = userMsg.GetString() ?? userFriendlyMessage;
                                    errorMessage = userFriendlyMessage;
                                }
                                else if (errorObj.TryGetProperty("message", out var msg))
                                {
                                    errorMessage = msg.GetString() ?? errorMessage;
                                    userFriendlyMessage = errorMessage;
                                }
                                
                                // 檢查是否是"手機號碼無效"或"已存在"錯誤（號碼已經在 Meta Business Suite 中，已經被連結）
                                bool isAlreadyLinked = errorMessage.Contains("手機號碼無效") || 
                                    errorMessage.Contains("Invalid parameter") ||
                                    errorMessage.Contains("already registered") ||
                                    (errorMessage.Contains("phone number") && errorMessage.Contains("invalid")) ||
                                    errorMessage.Contains("already exists") ||
                                    errorMessage.Contains("duplicate");
                                
                                if (isAlreadyLinked)
                                {
                                    _loggingService.LogWarning($"檢測到號碼可能已連結到 Meta Business Suite，嘗試查詢 PhoneNumberId");
                                    
                                    // 嘗試從 Meta API 查詢已存在的電話號碼列表
                                    try
                                    {
                                        var queryUrl = $"https://graph.facebook.com/{apiVersion}/{businessAccountId}/phone_numbers";
                                        _loggingService.LogInformation($"查詢已存在的電話號碼列表: {queryUrl}");
                                        
                                        var queryResponse = await httpClient.GetAsync(queryUrl);
                                        var queryResponseContent = await queryResponse.Content.ReadAsStringAsync();
                                        
                                        _loggingService.LogInformation($"查詢電話號碼列表 API 響應: {queryResponse.StatusCode}");
                                        _loggingService.LogInformation($"查詢電話號碼列表 API 響應內容: {queryResponseContent}");
                                        
                                        if (queryResponse.IsSuccessStatusCode)
                                        {
                                            var queryResponseJson = JsonSerializer.Deserialize<JsonElement>(queryResponseContent);
                                            if (queryResponseJson.TryGetProperty("data", out var dataArray))
                                            {
                                                // 在返回的電話號碼列表中查找匹配的號碼
                                                foreach (var phoneItem in dataArray.EnumerateArray())
                                                {
                                                    if (phoneItem.TryGetProperty("id", out var phoneId))
                                                    {
                                                        // 如果沒有找到具體匹配，使用第一個 PhoneNumberId（因為用戶確認號碼已存在）
                                                        // 或者可以根據 verified_name 或 display_phone_number 匹配
                                                        var foundPhoneId = phoneId.GetString();
                                                        _loggingService.LogInformation($"找到已存在的 Phone Number ID: {foundPhoneId}");
                                                        phoneNumberId = foundPhoneId;
                                                        // 保存 PhoneNumberId 並跳過註冊錯誤
                                                        verification.PhoneNumberId = phoneNumberId;
                                                        verification.Status = "Pending";
                                                        verification.CodeExpiry = null;
                                                        verification.UpdatedAt = DateTime.UtcNow;
                                                        await _db.SaveChangesAsync();
                                                        _loggingService.LogInformation($"已保存 PhoneNumberId 到驗證記錄: {phoneNumberId}");
                                                        goto SkipRegistration;
                                                    }
                                                }
                                            }
                                        }
                                    }
                                    catch (Exception queryEx)
                                    {
                                        _loggingService.LogWarning($"查詢已存在的電話號碼失敗: {queryEx.Message}");
                                    }
                                    
                                    // 如果查詢失敗，嘗試使用現有的 PhoneNumberId（如果有的話）
                                    if (string.IsNullOrEmpty(phoneNumberId) && !string.IsNullOrEmpty(verification.PhoneNumberId))
                                    {
                                        _loggingService.LogInformation($"使用現有的 Phone Number ID: {verification.PhoneNumberId}");
                                        phoneNumberId = verification.PhoneNumberId;
                                        verification.Status = "Pending";
                                        verification.CodeExpiry = null;
                                        goto SkipRegistration;
                                    }
                                }
                            }
                        }
                        catch
                        {
                            // 如果解析失敗，使用原始錯誤信息
                            errorMessage = $"註冊電話號碼失敗: {registerResponseContent}";
                        }
                        
                        // 如果仍然沒有找到 PhoneNumberId，返回錯誤
                        if (string.IsNullOrEmpty(phoneNumberId))
                        {
                            verification.Status = "Failed";
                            verification.ErrorMessage = errorMessage;
                            verification.UpdatedAt = DateTime.UtcNow;
                            await _db.SaveChangesAsync();
                            
                            _loggingService.LogError($"註冊電話號碼失敗: {errorMessage}");
                            
                            return BadRequest(new { 
                                error = userFriendlyMessage, 
                                details = registerResponseContent,
                                errorType = "PHONE_NUMBER_LIMIT" // 錯誤類型，用於前端顯示不同提示
                            });
                        }
                    }
                    
                    // 解析註冊響應獲取 Phone Number ID
                    try
                    {
                        var registerResponseJson = JsonSerializer.Deserialize<JsonElement>(registerResponseContent);
                        if (registerResponseJson.TryGetProperty("id", out var idProp))
                        {
                            phoneNumberId = idProp.GetString();
                            _loggingService.LogInformation($"獲取到 Phone Number ID: {phoneNumberId}");
                        }
                        else if (registerResponseJson.TryGetProperty("phone_number_id", out var phoneIdProp))
                        {
                            phoneNumberId = phoneIdProp.GetString();
                            _loggingService.LogInformation($"獲取到 Phone Number ID (phone_number_id): {phoneNumberId}");
                        }
                        else
                        {
                            // 嘗試查找響應中的所有屬性，用於調試
                            _loggingService.LogWarning($"註冊響應中沒有找到 PhoneNumberId，響應內容: {registerResponseContent}");
                            if (registerResponseJson.ValueKind == JsonValueKind.Object)
                            {
                                foreach (var prop in registerResponseJson.EnumerateObject())
                                {
                                    _loggingService.LogWarning($"響應屬性: {prop.Name} = {prop.Value}");
                                }
                            }
                        }
                        
                        // 註冊成功後，立即保存 PhoneNumberId 到驗證記錄
                        if (!string.IsNullOrEmpty(phoneNumberId))
                        {
                            verification.PhoneNumberId = phoneNumberId;
                            verification.UpdatedAt = DateTime.UtcNow;
                            await _db.SaveChangesAsync();
                            _loggingService.LogInformation($"已保存 PhoneNumberId 到驗證記錄: {phoneNumberId}");
                        }
                    }
                    catch (Exception ex)
                    {
                        _loggingService.LogWarning($"解析註冊響應失敗: {ex.Message}");
                    }
                    
                    // 如果註冊成功但沒有獲取到 PhoneNumberId，檢查是否可以使用現有的
                    if (string.IsNullOrEmpty(phoneNumberId) && !string.IsNullOrEmpty(verification.PhoneNumberId))
                    {
                        _loggingService.LogInformation($"註冊響應中沒有 PhoneNumberId，使用現有的: {verification.PhoneNumberId}");
                        phoneNumberId = verification.PhoneNumberId;
                    }
                }
                
                // 如果註冊失敗（已註冊），但有現有的 PhoneNumberId，使用現有的
                if (string.IsNullOrEmpty(phoneNumberId) && !string.IsNullOrEmpty(verification.PhoneNumberId))
                {
                    phoneNumberId = verification.PhoneNumberId;
                    _loggingService.LogInformation($"使用現有的 Phone Number ID: {phoneNumberId}");
                }
                
                SkipRegistration:
                // 請求驗證碼
                if (string.IsNullOrEmpty(phoneNumberId))
                {
                    return BadRequest(new { error = "無法獲取 Phone Number ID，請檢查 API 響應" });
                }
                
                var requestCodeUrl = $"https://graph.facebook.com/{apiVersion}/{phoneNumberId}/request_code";
                var codeMethod = (request?.CodeMethod) ?? "SMS";  // 默認使用 SMS（request 可能為 null）
                var language = (request?.Language) ?? "zh_HK";
                
                var requestCodePayload = new
                {
                    code_method = codeMethod,
                    language = language
                };
                
                _loggingService.LogInformation($"📱 準備請求驗證碼 - 電話號碼: {phoneNumberToUse}, PhoneNumberId: {phoneNumberId}, 方法: {codeMethod}, 語言: {language}");
                _loggingService.LogInformation($"請求驗證碼 API URL: {requestCodeUrl}");
                _loggingService.LogInformation($"請求驗證碼 Payload: {JsonSerializer.Serialize(requestCodePayload)}");
                
                var requestCodeContent = new StringContent(
                    JsonSerializer.Serialize(requestCodePayload), 
                    Encoding.UTF8, 
                    "application/json");
                
                var requestCodeResponse = await httpClient.PostAsync(requestCodeUrl, requestCodeContent);
                var requestCodeResponseContent = await requestCodeResponse.Content.ReadAsStringAsync();
                
                _loggingService.LogInformation($"請求驗證碼 API 響應: {requestCodeResponse.StatusCode}");
                _loggingService.LogInformation($"請求驗證碼 API 響應內容: {requestCodeResponseContent}");
                
                if (!requestCodeResponse.IsSuccessStatusCode)
                {
                    // 解析錯誤信息
                    string errorDetails = requestCodeResponseContent;
                    string userFriendlyMessage = "請求驗證碼失敗，請稍後再試";
                    bool isAlreadyVerified = false;
                    
                    try
                    {
                        var errorJson = JsonSerializer.Deserialize<JsonElement>(requestCodeResponseContent);
                        if (errorJson.TryGetProperty("error", out var errorObj))
                        {
                            // 檢查錯誤代碼：136024（子碼 2388091）= 電話號碼已驗證
                            if (errorObj.TryGetProperty("code", out var codeProp))
                            {
                                var errorCode = codeProp.GetInt32();
                                if (errorCode == 136024)
                                {
                                    // 檢查錯誤子代碼：2388091 = 已驗證電話號碼的所有權
                                    if (errorObj.TryGetProperty("error_subcode", out var subcodeProp))
                                    {
                                        var errorSubcode = subcodeProp.GetInt32();
                                        if (errorSubcode == 2388091)
                                        {
                                            isAlreadyVerified = true;
                                            _loggingService.LogInformation($"✅ 檢測到電話號碼已驗證 - 錯誤代碼: {errorCode}, 子代碼: {errorSubcode}");
                                        }
                                    }
                                    else
                                    {
                                        // 如果沒有子代碼，檢查錯誤消息是否包含"已驗證"
                                        if (errorObj.TryGetProperty("error_user_msg", out var userMsgCheck))
                                        {
                                            var msgText = userMsgCheck.GetString() ?? "";
                                            if (msgText.Contains("已驗證") || msgText.Contains("already verified") || 
                                                msgText.Contains("所有權") || msgText.Contains("ownership"))
                                            {
                                                isAlreadyVerified = true;
                                                _loggingService.LogInformation($"✅ 檢測到電話號碼已驗證 - 錯誤消息: {msgText}");
                                            }
                                        }
                                    }
                                }
                            }
                            
                            if (errorObj.TryGetProperty("error_user_msg", out var userMsg))
                            {
                                userFriendlyMessage = userMsg.GetString() ?? userFriendlyMessage;
                            }
                            else if (errorObj.TryGetProperty("message", out var msg))
                            {
                                userFriendlyMessage = msg.GetString() ?? userFriendlyMessage;
                            }
                            
                            // 記錄完整的錯誤信息
                            if (isAlreadyVerified)
                            {
                                _loggingService.LogInformation($"電話號碼已驗證 - 錯誤: {userFriendlyMessage}, 詳細: {requestCodeResponseContent}");
                            }
                            else
                            {
                                _loggingService.LogError($"請求驗證碼失敗 - 狀態碼: {requestCodeResponse.StatusCode}, 錯誤: {userFriendlyMessage}, 詳細: {requestCodeResponseContent}");
                            }
                        }
                    }
                    catch
                    {
                        _loggingService.LogError($"請求驗證碼失敗 - 狀態碼: {requestCodeResponse.StatusCode}, 響應內容: {requestCodeResponseContent}");
                    }
                    
                    // 如果電話號碼已驗證，Meta API 不允許再次發送 OTP
                    // 根據 Meta Cloud API 文檔，如果電話號碼已經驗證但還沒有連結，
                    // 需要用戶輸入一個自訂的 6 位數 PIN，然後調用 register API 完成連結
                    if (isAlreadyVerified)
                    {
                        _loggingService.LogWarning($"⚠️ 電話號碼已驗證，Meta API 不允許再次發送 OTP");
                        _loggingService.LogInformation($"解決方案：需要用戶輸入自訂 PIN，然後調用 register API 完成連結");
                        
                        // 更新驗證記錄狀態，標記為需要 PIN 輸入
                        verification.Status = "Verified";  // 標記為已驗證
                        verification.PhoneNumberId = phoneNumberId;
                        verification.UpdatedAt = DateTime.UtcNow;
                        
                        // 更新 Company.WA_PhoneNo_ID（如果還沒有設置或不同）
                        if (verification.Company != null)
                        {
                            if (string.IsNullOrEmpty(verification.Company.WA_PhoneNo_ID) || verification.Company.WA_PhoneNo_ID != phoneNumberId)
                            {
                                verification.Company.WA_PhoneNo_ID = phoneNumberId;
                                verification.Company.UpdatedAt = DateTime.UtcNow;
                                _loggingService.LogInformation($"已更新 Company.WA_PhoneNo_ID: {phoneNumberId}");
                            }
                        }
                        
                        await _db.SaveChangesAsync();
                        
                        // 返回特殊響應，告知前端需要用戶輸入 PIN
                        return Ok(new { 
                            Message = "電話號碼已驗證，請輸入一個 6 位數 PIN 完成連結",
                            Status = "Verified",
                            RequiresPin = true,  // 標記需要 PIN 輸入
                            PhoneNumberId = phoneNumberId,
                            Instructions = "請輸入一個 6 位數 PIN 碼。這將作為您的兩步驗證 PIN，請妥善保管。"
                        });
                    }
                    else
                    {
                        // 其他錯誤，標記為失敗
                        verification.Status = "Failed";
                        verification.ErrorMessage = $"請求驗證碼失敗: {errorDetails}";
                        verification.UpdatedAt = DateTime.UtcNow;
                        await _db.SaveChangesAsync();
                        
                        return BadRequest(new { error = userFriendlyMessage, details = requestCodeResponseContent });
                    }
                }
                
                // 即使響應成功，也要檢查響應內容是否包含錯誤
                try
                {
                    var responseJson = JsonSerializer.Deserialize<JsonElement>(requestCodeResponseContent);
                    if (responseJson.TryGetProperty("error", out var errorObj))
                    {
                        string errorMessage = "請求驗證碼失敗";
                        bool isAlreadyVerifiedInSuccess = false;
                        
                        // 檢查是否是已驗證的錯誤
                        if (errorObj.TryGetProperty("code", out var codeProp))
                        {
                            var errorCode = codeProp.GetInt32();
                            if (errorCode == 136024)
                            {
                                if (errorObj.TryGetProperty("error_subcode", out var subcodeProp))
                                {
                                    var errorSubcode = subcodeProp.GetInt32();
                                    if (errorSubcode == 2388091)
                                    {
                                        isAlreadyVerifiedInSuccess = true;
                                    }
                                }
                                else if (errorObj.TryGetProperty("error_user_msg", out var userMsg))
                                {
                                    var msgText = userMsg.GetString() ?? "";
                                    if (msgText.Contains("已驗證") || msgText.Contains("already verified") || 
                                        msgText.Contains("所有權") || msgText.Contains("ownership"))
                                    {
                                        isAlreadyVerifiedInSuccess = true;
                                    }
                                }
                            }
                        }
                        
                        if (errorObj.TryGetProperty("error_user_msg", out var userMsg2))
                        {
                            errorMessage = userMsg2.GetString() ?? errorMessage;
                        }
                        else if (errorObj.TryGetProperty("message", out var msg))
                        {
                            errorMessage = msg.GetString() ?? errorMessage;
                        }
                        
                        if (isAlreadyVerifiedInSuccess)
                        {
                            _loggingService.LogInformation($"✅ 檢測到電話號碼已驗證（成功響應中的錯誤）: {errorMessage}");
                            
                            verification.Status = "Verified";
                            verification.ErrorMessage = null;
                            verification.UpdatedAt = DateTime.UtcNow;
                            
                            // 更新 Company.WA_PhoneNo_ID
                            if (verification.Company != null)
                            {
                                if (string.IsNullOrEmpty(verification.Company.WA_PhoneNo_ID) || verification.Company.WA_PhoneNo_ID != phoneNumberId)
                                {
                                    verification.Company.WA_PhoneNo_ID = phoneNumberId;
                                    verification.Company.UpdatedAt = DateTime.UtcNow;
                                }
                            }
                            
                            await _db.SaveChangesAsync();
                            
                            return Ok(new { 
                                Message = "電話號碼已經驗證，無需再次驗證",
                                Status = "Verified",
                                PhoneNumberId = phoneNumberId,
                                AlreadyVerified = true
                            });
                        }
                        else
                        {
                            _loggingService.LogError($"Meta API 返回錯誤（即使狀態碼是成功）: {errorMessage}, 完整響應: {requestCodeResponseContent}");
                            
                            verification.Status = "Failed";
                            verification.ErrorMessage = $"請求驗證碼失敗: {errorMessage}";
                            verification.UpdatedAt = DateTime.UtcNow;
                            await _db.SaveChangesAsync();
                            
                            return BadRequest(new { error = errorMessage, details = requestCodeResponseContent });
                        }
                    }
                    else
                    {
                        // 檢查響應是否包含 success 字段
                        if (responseJson.TryGetProperty("success", out var successProp))
                        {
                            var success = successProp.GetBoolean();
                            if (success)
                            {
                                _loggingService.LogInformation($"✅ 驗證碼請求成功 - Meta API 返回 success: true");
                                
                                // 檢查是否有其他重要字段
                                if (responseJson.TryGetProperty("code_expiry", out var expiry))
                                {
                                    _loggingService.LogInformation($"驗證碼過期時間: {expiry}");
                                }
                                if (responseJson.TryGetProperty("message", out var msg))
                                {
                                    _loggingService.LogInformation($"Meta API 消息: {msg}");
                                }
                            }
                            else
                            {
                                _loggingService.LogWarning($"⚠️ Meta API 返回 success: false - 響應內容: {requestCodeResponseContent}");
                                verification.Status = "Failed";
                                verification.ErrorMessage = "Meta API 返回 success: false";
                                verification.UpdatedAt = DateTime.UtcNow;
                                await _db.SaveChangesAsync();
                                return BadRequest(new { error = "驗證碼請求失敗", details = requestCodeResponseContent });
                            }
                        }
                        else
                        {
                            // 如果沒有 success 字段，記錄完整的響應
                            _loggingService.LogInformation($"✅ 驗證碼請求成功 - 響應內容: {requestCodeResponseContent}");
                        }
                    }
                }
                catch (Exception parseEx)
                {
                    _loggingService.LogWarning($"解析驗證碼響應失敗: {parseEx.Message}, 但狀態碼是成功的");
                    // 如果解析失敗但狀態碼是成功的，繼續處理
                }
                
                // 更新驗證記錄
                verification.Status = "Requested";
                verification.PhoneNumberId = phoneNumberId;  // 保存 PhoneNumberId 到驗證記錄（用於記錄）
                verification.CodeMethod = codeMethod;
                verification.CodeExpiry = DateTime.UtcNow.AddMinutes(10);  // OTP 有效期 10 分鐘
                verification.UpdatedAt = DateTime.UtcNow;
                verification.PhoneNumber = phoneNumberToUse;  // 更新電話號碼（如果客戶輸入的與記錄不同）
                
                // 更新 Company.WA_PhoneNo_ID（如果還沒有設置或不同）
                if (verification.Company != null)
                {
                    if (string.IsNullOrEmpty(verification.Company.WA_PhoneNo_ID) || verification.Company.WA_PhoneNo_ID != phoneNumberId)
                    {
                        verification.Company.WA_PhoneNo_ID = phoneNumberId;
                        verification.Company.UpdatedAt = DateTime.UtcNow;
                        _loggingService.LogInformation($"已更新 Company.WA_PhoneNo_ID: {phoneNumberId}");
                    }
                }
                
                await _db.SaveChangesAsync();
                
                _loggingService.LogInformation($"驗證碼已請求，驗證記錄已更新");
                
                return Ok(new { 
                    Message = "驗證碼已發送，請檢查您的電話",
                    CodeMethod = codeMethod,
                    CodeExpiry = verification.CodeExpiry
                });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"請求驗證碼失敗: {ex.Message}", ex);
                return BadRequest(new { error = ex.Message });
            }
        }

        /// <summary>
        /// 客戶驗證驗證碼
        /// </summary>
        [HttpPost("verify-code/{verificationId}")]
        public async Task<IActionResult> VerifyCode(
            Guid verificationId, 
            [FromBody] VerifyCodeRequest request)
        {
            try
            {
                _loggingService.LogInformation($"=== 驗證驗證碼開始 ===");
                _loggingService.LogInformation($"VerificationId: {verificationId}");
                
                var verification = await _db.CompanyPhoneVerifications
                    .Include(v => v.Company)
                    .FirstOrDefaultAsync(v => v.Id == verificationId);
                
                if (verification == null)
                {
                    return NotFound(new { error = "找不到驗證記錄" });
                }
                
                // 檢查驗證狀態
                // 簡化流程：階段1、2已手動完成，OTP 已在 Meta Business Suite 中發送
                // 允許 Pending、Requested、Verified 狀態直接驗證（不需要先請求 OTP）
                if (verification.Status != "Pending" && verification.Status != "Requested" && verification.Status != "Verified")
                {
                    if (verification.Status == "Expired")
                    {
                        return BadRequest(new { error = "驗證碼已過期，請在 Meta Business Suite 中重新請求驗證碼" });
                    }
                    if (verification.Status == "Failed")
                    {
                        // 允許失敗狀態重新驗證
                        verification.Status = "Pending";
                        verification.ErrorMessage = null;
                        verification.UpdatedAt = DateTime.UtcNow;
                        await _db.SaveChangesAsync();
                    }
                    else
                    {
                        return BadRequest(new { error = "無效的驗證狀態，當前狀態：" + verification.Status });
                    }
                }
                
                // 如果狀態是 Verified（因為之前檢測到已驗證），允許重新驗證以完成連結流程
                if (verification.Status == "Verified")
                {
                    _loggingService.LogInformation($"狀態為 Verified（已驗證但可能需要連結），允許輸入驗證碼完成連結");
                    verification.Status = "Requested";
                    verification.UpdatedAt = DateTime.UtcNow;
                }
                
                // 簡化流程：不需要檢查 CodeExpiry（因為 OTP 已在 Meta Business Suite 中發送）
                // 只要用戶有正確的驗證碼，就可以驗證
                // 如果 CodeExpiry 為 null，設置一個寬鬆的過期時間（允許驗證）
                if (!verification.CodeExpiry.HasValue)
                {
                    verification.CodeExpiry = DateTime.UtcNow.AddMinutes(30);  // 設置寬鬆的過期時間
                    verification.UpdatedAt = DateTime.UtcNow;
                    _loggingService.LogInformation($"CodeExpiry 為 null，設置寬鬆的過期時間: {verification.CodeExpiry}");
                }
                
                // 優先使用 Company.WA_PhoneNo_ID
                string? phoneNumberId = null;
                if (!string.IsNullOrEmpty(verification.Company?.WA_PhoneNo_ID))
                {
                    phoneNumberId = verification.Company.WA_PhoneNo_ID;
                    _loggingService.LogInformation($"使用 Company.WA_PhoneNo_ID: {phoneNumberId}");
                }
                else if (!string.IsNullOrEmpty(verification.PhoneNumberId))
                {
                    phoneNumberId = verification.PhoneNumberId;
                    _loggingService.LogInformation($"使用驗證記錄中的 PhoneNumberId: {phoneNumberId}");
                }
                
                if (string.IsNullOrEmpty(phoneNumberId))
                {
                    return BadRequest(new { error = "無法獲取 Phone Number ID，請檢查公司配置或驗證記錄" });
                }
                
                // 使用 Meta API 驗證驗證碼
                var apiVersion = WhatsAppApiConfig.GetApiVersion();
                var url = $"https://graph.facebook.com/{apiVersion}/{phoneNumberId}/verify_code";
                
                var payload = new
                {
                    code = request.Code
                };
                
                _loggingService.LogInformation($"驗證驗證碼 API URL: {url}");
                _loggingService.LogInformation($"驗證驗證碼 Payload: {JsonSerializer.Serialize(payload)}");
                
                using var httpClient = new HttpClient();
                httpClient.DefaultRequestHeaders.Authorization = 
                    new AuthenticationHeaderValue("Bearer", verification.Company?.WA_API_Key);
                
                var content = new StringContent(
                    JsonSerializer.Serialize(payload), 
                    Encoding.UTF8, 
                    "application/json");
                
                var response = await httpClient.PostAsync(url, content);
                var responseContent = await response.Content.ReadAsStringAsync();
                
                _loggingService.LogInformation($"驗證驗證碼 API 響應: {response.StatusCode}");
                _loggingService.LogInformation($"驗證驗證碼 API 響應內容: {responseContent}");
                
                if (!response.IsSuccessStatusCode)
                {
                    verification.Status = "Failed";
                    verification.ErrorMessage = $"驗證失敗: {responseContent}";
                    verification.UpdatedAt = DateTime.UtcNow;
                    await _db.SaveChangesAsync();
                    
                    return BadRequest(new { error = "驗證失敗，請檢查驗證碼是否正確", details = responseContent });
                }
                
                // 驗證成功後，需要調用 register API 將電話號碼註冊為"已連結"狀態
                _loggingService.LogInformation($"✅ 驗證碼驗證成功，準備註冊電話號碼為「已連結」狀態");
                
                var registerUrl = $"https://graph.facebook.com/{apiVersion}/{phoneNumberId}/register";
                var registerPayload = new
                {
                    messaging_product = "whatsapp",
                    pin = request.Code  // 使用同一個驗證碼作為 PIN
                };
                
                _loggingService.LogInformation($"註冊電話號碼 API URL: {registerUrl}");
                _loggingService.LogInformation($"註冊電話號碼 Payload: {JsonSerializer.Serialize(registerPayload)}");
                
                var registerContent = new StringContent(
                    JsonSerializer.Serialize(registerPayload), 
                    Encoding.UTF8, 
                    "application/json");
                
                var registerResponse = await httpClient.PostAsync(registerUrl, registerContent);
                var registerResponseContent = await registerResponse.Content.ReadAsStringAsync();
                
                _loggingService.LogInformation($"註冊電話號碼 API 響應: {registerResponse.StatusCode}");
                _loggingService.LogInformation($"註冊電話號碼 API 響應內容: {registerResponseContent}");
                
                if (!registerResponse.IsSuccessStatusCode)
                {
                    // 註冊失敗，但驗證碼驗證已成功，所以標記為部分成功
                    _loggingService.LogWarning($"⚠️ 驗證碼驗證成功，但註冊電話號碼失敗: {registerResponseContent}");
                    
                    // 檢查是否已經註冊（避免重複註冊的錯誤）
                    bool isAlreadyRegistered = false;
                    try
                    {
                        var registerErrorJson = JsonSerializer.Deserialize<JsonElement>(registerResponseContent);
                        if (registerErrorJson.TryGetProperty("error", out var registerErrorObj))
                        {
                            var errorMsg = registerErrorObj.TryGetProperty("error_user_msg", out var userMsg) 
                                ? userMsg.GetString() 
                                : registerErrorObj.TryGetProperty("message", out var msg) 
                                    ? msg.GetString() 
                                    : "";
                            
                            if (errorMsg != null && (
                                errorMsg.Contains("已註冊") || 
                                errorMsg.Contains("already registered") ||
                                errorMsg.Contains("已連結") ||
                                errorMsg.Contains("already linked") ||
                                errorMsg.Contains("已驗證") ||
                                errorMsg.Contains("already verified")))
                            {
                                isAlreadyRegistered = true;
                                _loggingService.LogInformation($"✅ 電話號碼已經註冊/連結，跳過註冊步驟");
                            }
                        }
                    }
                    catch
                    {
                        // 解析失敗，繼續處理
                    }
                    
                    if (!isAlreadyRegistered)
                    {
                        // 如果確實失敗且不是"已註冊"錯誤，標記為失敗
                        verification.Status = "Failed";
                        verification.ErrorMessage = $"驗證碼驗證成功，但註冊失敗: {registerResponseContent}";
                        verification.UpdatedAt = DateTime.UtcNow;
                        await _db.SaveChangesAsync();
                        
                        return BadRequest(new { 
                            error = "驗證碼驗證成功，但無法將電話號碼設為「已連結」狀態", 
                            details = registerResponseContent 
                        });
                    }
                }
                else
                {
                    _loggingService.LogInformation($"✅ 電話號碼已成功註冊為「已連結」狀態");
                }
                
                // 註冊成功（或已註冊），標記為已完成
                verification.Status = "Verified";
                verification.UpdatedAt = DateTime.UtcNow;
                verification.ErrorMessage = null;
                
                // 更新公司的 WA_PhoneNo_ID（如果還沒有設置或不同）
                var company = verification.Company;
                if (company != null)
                {
                    if (string.IsNullOrEmpty(company.WA_PhoneNo_ID) || company.WA_PhoneNo_ID != phoneNumberId)
                    {
                        company.WA_PhoneNo_ID = phoneNumberId;
                        company.UpdatedAt = DateTime.UtcNow;
                        _loggingService.LogInformation($"已更新 Company.WA_PhoneNo_ID: {phoneNumberId}");
                    }
                }
                
                await _db.SaveChangesAsync();
                
                _loggingService.LogInformation($"✅ 驗證碼驗證成功！電話號碼已註冊為「已連結」狀態");
                
                return Ok(new { 
                    Message = "驗證成功！電話號碼已設為「已連結」狀態",
                    PhoneNumberId = phoneNumberId,  // 返回實際使用的 PhoneNumberId
                    Status = "Linked"  // 標記為已連結
                });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"驗證驗證碼失敗: {ex.Message}", ex);
                return BadRequest(new { error = ex.Message });
            }
        }

        /// <summary>
        /// 獲取公司的所有驗證記錄（Admin 用）
        /// </summary>
        [HttpGet("company/{companyId}")]
        public async Task<IActionResult> GetCompanyVerifications(Guid companyId)
        {
            try
            {
                var verifications = await _db.CompanyPhoneVerifications
                    .Where(v => v.CompanyId == companyId)
                    .OrderByDescending(v => v.CreatedAt)
                    .Select(v => new
                    {
                        v.Id,
                        v.PhoneNumber,
                        v.Status,
                        v.CertificateExpiry,
                        v.CodeExpiry,
                        v.CodeMethod,
                        PhoneNumberId = v.Company != null ? v.Company.WA_PhoneNo_ID : v.PhoneNumberId,
                        v.CreatedAt,
                        v.UpdatedAt,
                        v.ErrorMessage
                    })
                    .ToListAsync();
                
                return Ok(verifications);
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取公司驗證記錄失敗: {ex.Message}", ex);
                return BadRequest(new { error = ex.Message });
            }
        }

        /// <summary>
        /// 使用自訂 PIN 完成電話號碼連結（適用於已驗證但未連結的情況）
        /// </summary>
        [HttpPost("register-with-pin/{verificationId}")]
        public async Task<IActionResult> RegisterWithPin(
            Guid verificationId,
            [FromBody] RegisterWithPinRequest request)
        {
            try
            {
                _loggingService.LogInformation($"=== 使用 PIN 完成連結開始 ===");
                _loggingService.LogInformation($"VerificationId: {verificationId}, PIN: {request.Pin?.Length} 位");
                
                // 驗證 PIN 格式
                if (string.IsNullOrEmpty(request.Pin) || request.Pin.Length != 6 || !request.Pin.All(char.IsDigit))
                {
                    return BadRequest(new { error = "PIN 必須是 6 位數字" });
                }
                
                var verification = await _db.CompanyPhoneVerifications
                    .Include(v => v.Company)
                    .FirstOrDefaultAsync(v => v.Id == verificationId);
                
                if (verification == null)
                {
                    return NotFound(new { error = "找不到驗證記錄" });
                }
                
                // 檢查驗證狀態（應該是 Verified）
                if (verification.Status != "Verified" && verification.Status != "Pending")
                {
                    return BadRequest(new { error = "無效的驗證狀態，當前狀態：" + verification.Status });
                }
                
                // 優先使用 Company.WA_PhoneNo_ID
                string? phoneNumberId = null;
                if (!string.IsNullOrEmpty(verification.Company?.WA_PhoneNo_ID))
                {
                    phoneNumberId = verification.Company.WA_PhoneNo_ID;
                    _loggingService.LogInformation($"使用 Company.WA_PhoneNo_ID: {phoneNumberId}");
                }
                else if (!string.IsNullOrEmpty(verification.PhoneNumberId))
                {
                    phoneNumberId = verification.PhoneNumberId;
                    _loggingService.LogInformation($"使用驗證記錄中的 PhoneNumberId: {phoneNumberId}");
                }
                
                if (string.IsNullOrEmpty(phoneNumberId))
                {
                    return BadRequest(new { error = "無法獲取 Phone Number ID，請檢查公司配置或驗證記錄" });
                }
                
                // 檢查公司配置
                if (string.IsNullOrEmpty(verification.Company?.WA_API_Key))
                {
                    return BadRequest(new { error = "公司未配置 WhatsApp API Key" });
                }
                
                // 調用 register API
                var apiVersion = WhatsAppApiConfig.GetApiVersion();
                var registerUrl = $"https://graph.facebook.com/{apiVersion}/{phoneNumberId}/register";
                var registerPayload = new
                {
                    messaging_product = "whatsapp",
                    pin = request.Pin  // 使用用戶輸入的自訂 PIN
                };
                
                _loggingService.LogInformation($"調用 register API - URL: {registerUrl}");
                _loggingService.LogInformation($"Register Payload: {JsonSerializer.Serialize(registerPayload)}");
                
                using var httpClient = new HttpClient();
                httpClient.DefaultRequestHeaders.Authorization = 
                    new AuthenticationHeaderValue("Bearer", verification.Company?.WA_API_Key);
                
                var registerContent = new StringContent(
                    JsonSerializer.Serialize(registerPayload), 
                    Encoding.UTF8, 
                    "application/json");
                
                var registerResponse = await httpClient.PostAsync(registerUrl, registerContent);
                var registerResponseContent = await registerResponse.Content.ReadAsStringAsync();
                
                _loggingService.LogInformation($"Register API 響應: {registerResponse.StatusCode}");
                _loggingService.LogInformation($"Register API 響應內容: {registerResponseContent}");
                
                if (!registerResponse.IsSuccessStatusCode)
                {
                    // Register API 失敗，檢查錯誤
                    _loggingService.LogWarning($"⚠️ Register API 失敗: {registerResponseContent}");
                    
                    // 檢查是否已經連結（避免重複連結的錯誤）
                    bool isAlreadyLinked = false;
                    try
                    {
                        var registerErrorJson = JsonSerializer.Deserialize<JsonElement>(registerResponseContent);
                        if (registerErrorJson.TryGetProperty("error", out var registerErrorObj))
                        {
                            var errorMsg = registerErrorObj.TryGetProperty("error_user_msg", out var userMsg) 
                                ? userMsg.GetString() 
                                : registerErrorObj.TryGetProperty("message", out var msg) 
                                    ? msg.GetString() 
                                    : "";
                            
                            if (errorMsg != null && (
                                errorMsg.Contains("已註冊") || 
                                errorMsg.Contains("already registered") ||
                                errorMsg.Contains("已連結") ||
                                errorMsg.Contains("already linked")))
                            {
                                isAlreadyLinked = true;
                                _loggingService.LogInformation($"✅ 電話號碼已經連結，跳過註冊步驟");
                            }
                        }
                    }
                    catch
                    {
                        // 解析失敗，繼續處理
                    }
                    
                    if (isAlreadyLinked)
                    {
                        // 已經連結，標記為成功
                        verification.Status = "Verified";
                        verification.ErrorMessage = null;
                        verification.UpdatedAt = DateTime.UtcNow;
                        verification.PhoneNumberId = phoneNumberId;
                        
                        if (verification.Company != null)
                        {
                            if (string.IsNullOrEmpty(verification.Company.WA_PhoneNo_ID) || verification.Company.WA_PhoneNo_ID != phoneNumberId)
                            {
                                verification.Company.WA_PhoneNo_ID = phoneNumberId;
                                verification.Company.UpdatedAt = DateTime.UtcNow;
                            }
                        }
                        
                        await _db.SaveChangesAsync();
                        
                        return Ok(new { 
                            Message = "電話號碼已經連結！",
                            Status = "Linked",
                            PhoneNumberId = phoneNumberId
                        });
                    }
                    else
                    {
                        // 確實失敗，返回錯誤
                        verification.Status = "Failed";
                        verification.ErrorMessage = $"使用 PIN 連結失敗: {registerResponseContent}";
                        verification.UpdatedAt = DateTime.UtcNow;
                        await _db.SaveChangesAsync();
                        
                        return BadRequest(new { 
                            error = "無法使用 PIN 完成連結",
                            details = registerResponseContent
                        });
                    }
                }
                else
                {
                    // 註冊成功！電話號碼已連結
                    _loggingService.LogInformation($"✅ 電話號碼成功連結！PhoneNumberId: {phoneNumberId}, PIN: {request.Pin}");
                    
                    verification.Status = "Verified";
                    verification.ErrorMessage = null;
                    verification.UpdatedAt = DateTime.UtcNow;
                    verification.PhoneNumberId = phoneNumberId;
                    
                    // 更新 Company.WA_PhoneNo_ID
                    if (verification.Company != null)
                    {
                        if (string.IsNullOrEmpty(verification.Company.WA_PhoneNo_ID) || verification.Company.WA_PhoneNo_ID != phoneNumberId)
                        {
                            verification.Company.WA_PhoneNo_ID = phoneNumberId;
                            verification.Company.UpdatedAt = DateTime.UtcNow;
                            _loggingService.LogInformation($"已更新 Company.WA_PhoneNo_ID: {phoneNumberId}");
                        }
                    }
                    
                    await _db.SaveChangesAsync();
                    
                    return Ok(new { 
                        Message = "電話號碼已成功連結！",
                        Status = "Linked",
                        PhoneNumberId = phoneNumberId,
                        PinSet = true,
                        Note = "兩步驗證 PIN 已設定，請妥善保管此 PIN"
                    });
                }
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"使用 PIN 完成連結失敗: {ex.Message}", ex);
                return BadRequest(new { error = ex.Message });
            }
        }

        /// <summary>
        /// 從電話號碼中提取國家代碼
        /// </summary>
        private string ExtractCountryCode(string phoneNumber)
        {
            if (string.IsNullOrEmpty(phoneNumber))
                return null;

            // 移除所有非數字字符，只保留數字
            var digitsOnly = new string(phoneNumber.Where(char.IsDigit).ToArray());

            // 常見的國家代碼列表（1-3位數）
            var commonCountryCodes = new[]
            {
                "852",  // 香港
                "853",  // 澳門
                "86",   // 中國
                "1",    // 美國/加拿大
                "44",   // 英國
                "81",   // 日本
                "82",   // 韓國
                "65",   // 新加坡
                "60",   // 馬來西亞
                "66",   // 泰國
            };

            // 先檢查 3 位數國家代碼
            foreach (var code in commonCountryCodes.Where(c => c.Length == 3))
            {
                if (digitsOnly.StartsWith(code))
                {
                    return code;
                }
            }

            // 再檢查 2 位數國家代碼
            foreach (var code in commonCountryCodes.Where(c => c.Length == 2))
            {
                if (digitsOnly.StartsWith(code))
                {
                    return code;
                }
            }

            // 如果電話號碼以 + 開頭，嘗試提取前 1-3 位作為國家代碼
            if (phoneNumber.StartsWith("+"))
            {
                // +85296062000 -> 852
                var afterPlus = phoneNumber.Substring(1);
                var firstDigits = new string(afterPlus.TakeWhile(char.IsDigit).ToArray());
                
                // 嘗試 3 位數
                if (firstDigits.Length >= 3)
                {
                    var threeDigit = firstDigits.Substring(0, 3);
                    if (commonCountryCodes.Contains(threeDigit))
                    {
                        return threeDigit;
                    }
                }
                
                // 嘗試 2 位數
                if (firstDigits.Length >= 2)
                {
                    var twoDigit = firstDigits.Substring(0, 2);
                    if (commonCountryCodes.Contains(twoDigit))
                    {
                        return twoDigit;
                    }
                }
            }

            // 默認：如果電話號碼長度大於 8 位，假設前 3 位是國家代碼（針對香港）
            // 這是一個簡化的假設，可能需要根據實際情況調整
            if (digitsOnly.Length >= 11)
            {
                // 85296062000 -> 852
                return digitsOnly.Substring(0, 3);
            }

            // 如果無法提取，返回 null（將在調用處處理錯誤）
            return null;
        }
    }

    // DTO 類
    public class CertificateUploadRequest
    {
        public string CompanyId { get; set; }
        public string? PhoneNumber { get; set; }  // 改為可選（當 Company.WA_PhoneNo_ID 存在時）
        public string? Certificate { get; set; }  // 改為可選（階段1、2已手動完成）
        public string? CreatedBy { get; set; }
    }

    public class RequestCodeRequest
    {
        public string? PhoneNumber { get; set; }  // 電話號碼可選（如果驗證記錄中已有）
        public string? CodeMethod { get; set; }  // SMS 或 VOICE
        public string? Language { get; set; }  // 例如: zh_HK, en_US
    }

    public class VerifyCodeRequest
    {
        public string Code { get; set; }
    }

    public class RegisterWithPinRequest
    {
        public string Pin { get; set; }
    }
}

