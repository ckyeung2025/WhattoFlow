using System;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using PurpleRice.Models.Dto.ApiProviders;
using PurpleRice.Services.ApiProviders;

namespace PurpleRice.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class ApiProvidersController : ControllerBase
    {
        private readonly IApiProviderService _apiProviderService;
        private readonly ILogger<ApiProvidersController> _logger;

        public ApiProvidersController(
            IApiProviderService apiProviderService,
            ILogger<ApiProvidersController> logger)
        {
            _apiProviderService = apiProviderService;
            _logger = logger;
        }

        [HttpGet("definitions")]
        public async Task<IActionResult> GetDefinitions([FromQuery] string category = null)
        {
            var items = await _apiProviderService.GetDefinitionsAsync(category);
            return Ok(items);
        }

        [HttpGet("company")]
        public async Task<IActionResult> GetCompanyProviders([FromQuery] string category = null)
        {
            var companyId = GetCurrentCompanyId();
            if (companyId == Guid.Empty)
            {
                return Unauthorized(new { error = "無法識別公司資訊" });
            }

            var items = await _apiProviderService.GetCompanyProvidersAsync(companyId, category);
            return Ok(items);
        }

        [HttpGet("company/{providerKey}")]
        public async Task<IActionResult> GetCompanyProvider(string providerKey)
        {
            var companyId = GetCurrentCompanyId();
            if (companyId == Guid.Empty)
            {
                return Unauthorized(new { error = "無法識別公司資訊" });
            }

            try
            {
                var item = await _apiProviderService.GetCompanyProviderAsync(companyId, providerKey);
                return Ok(item);
            }
            catch (InvalidOperationException ex)
            {
                _logger.LogWarning(ex, "Provider not found: {ProviderKey}", providerKey);
                return NotFound(new { error = ex.Message });
            }
        }

        [HttpPost("company/{providerKey}")]
        public async Task<IActionResult> UpsertCompanyProvider(string providerKey, [FromBody] ApiProviderSettingUpdateRequest request)
        {
            if (request == null)
            {
                return BadRequest(new { error = "請提供設定資料" });
            }

            var companyId = GetCurrentCompanyId();
            if (companyId == Guid.Empty)
            {
                return Unauthorized(new { error = "無法識別公司資訊" });
            }

            try
            {
                var item = await _apiProviderService.UpsertCompanyProviderAsync(companyId, providerKey, request);
                return Ok(item);
            }
            catch (InvalidOperationException ex)
            {
                _logger.LogWarning(ex, "Provider upsert failed: {ProviderKey}", providerKey);
                var isNotFound = ex.Message.Contains("not found", StringComparison.OrdinalIgnoreCase);
                return isNotFound
                    ? NotFound(new { error = ex.Message })
                    : BadRequest(new { error = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to update provider setting: {ProviderKey}", providerKey);
                return StatusCode(500, new { error = ex.Message });
            }
        }

        [HttpPost("test-email/{providerKey}")]
        public async Task<IActionResult> TestEmail(string providerKey, [FromBody] TestEmailRequest request)
        {
            if (request == null)
            {
                return BadRequest(new { error = "請提供測試郵件資料" });
            }

            var companyId = GetCurrentCompanyId();
            if (companyId == Guid.Empty)
            {
                return Unauthorized(new { error = "無法識別公司資訊" });
            }

            if (providerKey != "microsoft-graph")
            {
                return BadRequest(new { error = "目前僅支持 Microsoft Graph API 郵件測試" });
            }

            try
            {
                // 驗證必要欄位
                if (string.IsNullOrWhiteSpace(request.TenantId) ||
                    string.IsNullOrWhiteSpace(request.ClientId) ||
                    string.IsNullOrWhiteSpace(request.ClientSecret) ||
                    string.IsNullOrWhiteSpace(request.FromEmail))
                {
                    return BadRequest(new { error = "請提供完整的 OAuth 配置和發件人地址" });
                }

                // 獲取 OAuth 2.0 Access Token
                _logger.LogInformation($"開始獲取 Microsoft Graph Access Token - TenantId: {request.TenantId}, ClientId: {request.ClientId}");
                var accessToken = await GetMicrosoftGraphAccessTokenAsync(request.TenantId, request.ClientId, request.ClientSecret);
                if (string.IsNullOrWhiteSpace(accessToken))
                {
                    return BadRequest(new { error = "無法獲取 OAuth 2.0 Access Token。請檢查：\n1. Tenant ID、Client ID 和 Client Secret 是否正確\n2. 應用程序是否已配置 Mail.Send 應用程序權限（Application Permission）\n3. 管理員是否已同意該權限" });
                }
                
                _logger.LogInformation($"成功獲取 Access Token，開始發送測試郵件 - From: {request.FromEmail}, To: {request.ToEmail ?? request.FromEmail}");

                // 發送測試郵件
                var result = await SendMicrosoftGraphEmailAsync(
                    accessToken,
                    request.FromEmail,
                    request.ToEmail ?? request.FromEmail,
                    request.Subject ?? "WhattoFlow 郵件發送測試",
                    request.Body ?? "這是一封測試郵件，用於驗證 Microsoft Graph API 郵件發送配置是否正確。",
                    request.ReplyTo
                );

                return Ok(new
                {
                    success = true,
                    message = "測試郵件發送成功",
                    fromEmail = request.FromEmail,
                    toEmail = request.ToEmail ?? request.FromEmail
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send test email: {ProviderKey}", providerKey);
                return StatusCode(500, new { error = ex.Message });
            }
        }

        private async Task<string> GetMicrosoftGraphAccessTokenAsync(string tenantId, string clientId, string clientSecret)
        {
            try
            {
                var tokenUrl = $"https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token";
                
                var content = new FormUrlEncodedContent(new[]
                {
                    new KeyValuePair<string, string>("client_id", clientId),
                    new KeyValuePair<string, string>("client_secret", clientSecret),
                    new KeyValuePair<string, string>("scope", "https://graph.microsoft.com/.default"),
                    new KeyValuePair<string, string>("grant_type", "client_credentials")
                });

                using var httpClient = new HttpClient();
                var response = await httpClient.PostAsync(tokenUrl, content);
                var responseContent = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogError($"Failed to get access token: {response.StatusCode} - {responseContent}");
                    
                    // 解析錯誤訊息
                    try
                    {
                        var errorJson = JsonSerializer.Deserialize<JsonElement>(responseContent);
                        if (errorJson.TryGetProperty("error_description", out var errorDesc))
                        {
                            _logger.LogError($"OAuth token error description: {errorDesc.GetString()}");
                        }
                    }
                    catch { }
                    
                    return null;
                }

                var tokenResponse = JsonSerializer.Deserialize<JsonElement>(responseContent);
                if (tokenResponse.TryGetProperty("access_token", out var accessTokenElement))
                {
                    // 檢查 token 的權限範圍
                    if (tokenResponse.TryGetProperty("scope", out var scopeElement))
                    {
                        var scopes = scopeElement.GetString();
                        _logger.LogInformation($"Access token scopes: {scopes}");
                    }
                    
                    return accessTokenElement.GetString();
                }

                // 如果沒有 access_token，記錄錯誤信息
                if (tokenResponse.TryGetProperty("error_description", out var tokenErrorDesc))
                {
                    _logger.LogError($"OAuth token error: {tokenErrorDesc.GetString()}");
                }

                return null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting Microsoft Graph access token");
                return null;
            }
        }

        private async Task<bool> SendMicrosoftGraphEmailAsync(
            string accessToken,
            string fromEmail,
            string toEmail,
            string subject,
            string body,
            string replyTo = null)
        {
            try
            {
                var apiUrl = $"https://graph.microsoft.com/v1.0/users/{fromEmail}/sendMail";

                var emailMessage = new
                {
                    message = new
                    {
                        subject = subject,
                        body = new
                        {
                            contentType = "Text",
                            content = body
                        },
                        toRecipients = new[]
                        {
                            new
                            {
                                emailAddress = new
                                {
                                    address = toEmail
                                }
                            }
                        },
                        replyTo = !string.IsNullOrWhiteSpace(replyTo) ? new[]
                        {
                            new
                            {
                                emailAddress = new
                                {
                                    address = replyTo
                                }
                            }
                        } : null
                    }
                };

                var json = JsonSerializer.Serialize(emailMessage, new JsonSerializerOptions
                {
                    DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
                });

                using var httpClient = new HttpClient();
                httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

                var content = new StringContent(json, Encoding.UTF8, "application/json");
                var response = await httpClient.PostAsync(apiUrl, content);
                var responseContent = await response.Content.ReadAsStringAsync();

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogError($"Failed to send email: {response.StatusCode} - {responseContent}");
                    
                    // 解析錯誤訊息
                    string errorMessage = $"發送郵件失敗: {response.StatusCode}";
                    string errorCode = null;
                    string errorDetails = null;
                    
                    try
                    {
                        var errorJson = JsonSerializer.Deserialize<JsonElement>(responseContent);
                        if (errorJson.TryGetProperty("error", out var errorObj))
                        {
                            if (errorObj.TryGetProperty("code", out var code))
                            {
                                errorCode = code.GetString();
                            }
                            
                            if (errorObj.TryGetProperty("message", out var message))
                            {
                                errorDetails = message.GetString();
                                errorMessage = $"發送郵件失敗: {errorDetails}";
                            }
                            
                            // 根據錯誤代碼提供具體的解決方案
                            if (errorCode == "ErrorAccessDenied" || errorDetails?.Contains("Access is denied", StringComparison.OrdinalIgnoreCase) == true)
                            {
                                errorMessage = "權限不足。請確認以下配置：\n" +
                                    "1. 在 Azure Portal 中為應用程序添加 'Mail.Send' 應用程序權限（Application Permission，不是 Delegated Permission）\n" +
                                    "2. 點擊「為 [組織名稱] 授與管理員同意」按鈕\n" +
                                    "3. 確認發件人 email 地址與應用程序有權限發送的用戶匹配\n" +
                                    "4. 如果使用應用程序權限，發件人必須是應用程序有權限的用戶\n" +
                                    "詳見：https://learn.microsoft.com/en-us/graph/auth-v2-service";
                            }
                            else if (errorCode == "ErrorInvalidUser")
                            {
                                errorMessage = $"無效的用戶：發件人 email '{fromEmail}' 不存在或應用程序無權限訪問。請確認 email 地址正確，且應用程序有權限代表該用戶發送郵件。";
                            }
                            else if (!string.IsNullOrWhiteSpace(errorDetails))
                            {
                                errorMessage = $"發送郵件失敗: {errorDetails}";
                            }
                        }
                    }
                    catch
                    {
                        // 如果解析失敗，使用原始錯誤訊息
                        if (responseContent.Contains("Access is denied", StringComparison.OrdinalIgnoreCase))
                        {
                            errorMessage = "權限不足。請在 Azure Portal 中為應用程序添加 'Mail.Send' 應用程序權限（Application Permission），並由管理員同意。";
                        }
                        else
                        {
                            errorMessage = $"發送郵件失敗: {response.StatusCode} - {responseContent}";
                        }
                    }
                    
                    throw new Exception(errorMessage);
                }

                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sending Microsoft Graph email");
                throw;
            }
        }

        private Guid GetCurrentCompanyId()
        {
            try
            {
                var companyIdClaim = User?.FindFirst("company_id") ?? User?.FindFirst(ClaimTypes.GroupSid) ?? User?.FindFirst(ClaimTypes.PrimaryGroupSid);
                if (companyIdClaim != null && Guid.TryParse(companyIdClaim.Value, out var companyId))
                {
                    return companyId;
                }

                if (User?.Identity?.IsAuthenticated ?? false)
                {
                    foreach (var claim in User.Claims)
                    {
                        if (claim.Type.EndsWith("companyid", StringComparison.OrdinalIgnoreCase) && Guid.TryParse(claim.Value, out var id))
                        {
                            return id;
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to resolve company id from claims");
            }

            return Guid.Empty;
        }
    }

    public class TestEmailRequest
    {
        public string TenantId { get; set; }
        public string ClientId { get; set; }
        public string ClientSecret { get; set; }
        public string FromEmail { get; set; }
        public string ToEmail { get; set; }
        public string ReplyTo { get; set; }
        public string Subject { get; set; }
        public string Body { get; set; }
    }
}

