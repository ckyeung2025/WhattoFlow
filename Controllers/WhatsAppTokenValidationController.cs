using Microsoft.AspNetCore.Mvc;
using PurpleRice.Data;
using PurpleRice.Services;
using System.Text.Json;

namespace PurpleRice.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class WhatsAppTokenValidationController : ControllerBase
    {
        private readonly PurpleRiceDbContext _context;
        private readonly LoggingService _loggingService;
        private readonly HttpClient _httpClient;
        
        public WhatsAppTokenValidationController(
            PurpleRiceDbContext context, 
            Func<string, LoggingService> loggingServiceFactory,
            IHttpClientFactory httpClientFactory)
        {
            _context = context;
            _loggingService = loggingServiceFactory("WhatsAppTokenValidation");
            _httpClient = httpClientFactory.CreateClient();
        }

        /// <summary>
        /// 驗證 WhatsApp Access Token 的權限範圍
        /// </summary>
        [HttpGet("validate-permissions")]
        public async Task<IActionResult> ValidateTokenPermissions()
        {
            try
            {
                _loggingService.LogInformation("🔍 開始驗證 WhatsApp Token 權限");

                // 獲取當前用戶的公司配置
                var companyId = GetCurrentUserCompanyId();
                if (!companyId.HasValue)
                {
                    return Unauthorized(new { error = "無法識別用戶公司" });
                }

                var company = await _context.Companies.FindAsync(companyId.Value);
                if (company == null || string.IsNullOrEmpty(company.WA_API_Key))
                {
                    return BadRequest(new { error = "未配置 WhatsApp API Key" });
                }

                var accessToken = company.WA_API_Key;
                
                // 1. 檢查 Token 基本信息
                var debugUrl = $"https://graph.facebook.com/{WhatsAppApiConfig.GetApiVersion()}/debug_token?input_token={accessToken}&access_token={accessToken}";
                var debugResponse = await _httpClient.GetAsync(debugUrl);
                var debugContent = await debugResponse.Content.ReadAsStringAsync();
                
                _loggingService.LogInformation($"Token Debug Response: {debugContent}");

                // 2. 檢查權限範圍
                var permissionsUrl = $"https://graph.facebook.com/{WhatsAppApiConfig.GetApiVersion()}/me/permissions?access_token={accessToken}";
                var permissionsResponse = await _httpClient.GetAsync(permissionsUrl);
                
                if (!permissionsResponse.IsSuccessStatusCode)
                {
                    var errorContent = await permissionsResponse.Content.ReadAsStringAsync();
                    _loggingService.LogError($"❌ 權限檢查失敗: {errorContent}");
                    return BadRequest(new { error = "Token 驗證失敗", details = errorContent });
                }

                var permissionsContent = await permissionsResponse.Content.ReadAsStringAsync();
                _loggingService.LogInformation($"✅ Permissions Response: {permissionsContent}");

                var permissionsData = JsonSerializer.Deserialize<PermissionsResponse>(permissionsContent);
                
                // 3. 檢查關鍵權限
                var hasMessaging = permissionsData?.Data?.Any(p => 
                    p.Permission == "whatsapp_business_messaging" && p.Status == "granted") ?? false;
                var hasManagement = permissionsData?.Data?.Any(p => 
                    p.Permission == "whatsapp_business_management" && p.Status == "granted") ?? false;
                var hasBusinessManagement = permissionsData?.Data?.Any(p => 
                    p.Permission == "business_management" && p.Status == "granted") ?? false;

                // 4. 功能檢查
                var capabilities = new
                {
                    canSendMessages = hasMessaging,
                    canReceiveWebhooks = hasMessaging,
                    canManageTemplates = hasManagement,
                    canCreateFlows = hasManagement,
                    canManageBusinessAssets = hasBusinessManagement
                };

                // 5. 建議
                var recommendations = new List<string>();
                if (!hasMessaging)
                {
                    recommendations.Add("⚠️ 缺少 whatsapp_business_messaging 權限，無法發送訊息");
                }
                if (!hasManagement)
                {
                    recommendations.Add("⚠️ 缺少 whatsapp_business_management 權限，無法管理範本和 Flow");
                }
                if (hasMessaging && hasManagement)
                {
                    recommendations.Add("✅ Token 權限完整，可使用所有功能！");
                }

                _loggingService.LogInformation($"✅ Token 驗證完成");
                _loggingService.LogInformation($"   - 發送訊息: {capabilities.canSendMessages}");
                _loggingService.LogInformation($"   - 管理範本: {capabilities.canManageTemplates}");
                _loggingService.LogInformation($"   - 建立 Flow: {capabilities.canCreateFlows}");

                return Ok(new
                {
                    success = true,
                    tokenValid = true,
                    company = new
                    {
                        name = company.Name,
                        phoneNumberId = company.WA_PhoneNo_ID,
                        businessAccountId = company.WA_Business_Account_ID
                    },
                    capabilities,
                    permissions = permissionsData?.Data?.Select(p => new 
                    { 
                        permission = p.Permission, 
                        status = p.Status 
                    }).ToList(),
                    recommendations
                });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"❌ Token 驗證錯誤: {ex.Message}", ex);
                return StatusCode(500, new { error = "Token 驗證失敗", message = ex.Message });
            }
        }

        /// <summary>
        /// 測試模板管理 API 是否可用
        /// </summary>
        [HttpGet("test-template-api")]
        public async Task<IActionResult> TestTemplateManagementApi()
        {
            try
            {
                _loggingService.LogInformation("🧪 開始測試模板管理 API");

                var companyId = GetCurrentUserCompanyId();
                if (!companyId.HasValue)
                {
                    return Unauthorized(new { error = "無法識別用戶公司" });
                }

                var company = await _context.Companies.FindAsync(companyId.Value);
                if (company == null || string.IsNullOrEmpty(company.WA_API_Key) || 
                    string.IsNullOrEmpty(company.WA_Business_Account_ID))
                {
                    return BadRequest(new { error = "未配置完整的 WhatsApp API 信息" });
                }

                // 測試讀取模板列表
                var url = $"https://graph.facebook.com/{WhatsAppApiConfig.GetApiVersion()}/{company.WA_Business_Account_ID}/message_templates";
                
                _httpClient.DefaultRequestHeaders.Clear();
                _httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {company.WA_API_Key}");

                _loggingService.LogInformation($"📡 請求 URL: {url}");
                
                var response = await _httpClient.GetAsync(url);
                var content = await response.Content.ReadAsStringAsync();

                _loggingService.LogInformation($"📨 Response Status: {response.StatusCode}");
                _loggingService.LogInformation($"📨 Response Content: {content}");

                if (response.IsSuccessStatusCode)
                {
                    var templatesData = JsonSerializer.Deserialize<MetaTemplatesResponse>(content);
                    
                    return Ok(new
                    {
                        success = true,
                        message = "✅ 模板管理 API 可用！",
                        canManageTemplates = true,
                        templatesCount = templatesData?.Data?.Count ?? 0,
                        templates = templatesData?.Data?.Select(t => new
                        {
                            name = t.Name,
                            status = t.Status,
                            category = t.Category,
                            language = t.Language
                        }).ToList()
                    });
                }
                else
                {
                    return BadRequest(new
                    {
                        success = false,
                        message = "❌ 模板管理 API 不可用",
                        canManageTemplates = false,
                        error = content
                    });
                }
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"❌ 模板 API 測試錯誤: {ex.Message}", ex);
                return StatusCode(500, new { error = "測試失敗", message = ex.Message });
            }
        }

        private Guid? GetCurrentUserCompanyId()
        {
            var companyIdClaim = User.Claims.FirstOrDefault(c => c.Type == "company_id");
            if (companyIdClaim != null && Guid.TryParse(companyIdClaim.Value, out var companyId))
            {
                return companyId;
            }
            
            var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == "user_id");
            if (userIdClaim != null && Guid.TryParse(userIdClaim.Value, out var userId))
            {
                var user = _context.Users.FirstOrDefault(u => u.Id == userId);
                if (user != null)
                {
                    return user.CompanyId;
                }
            }
            
            return null;
        }
    }

    // DTO 類
    public class PermissionsResponse
    {
        public List<PermissionItem> Data { get; set; }
    }

    public class PermissionItem
    {
        public string Permission { get; set; }
        public string Status { get; set; }
    }

    public class MetaTemplatesResponse
    {
        public List<MetaTemplate> Data { get; set; }
        public PagingInfo Paging { get; set; }
    }

    public class MetaTemplate
    {
        public string Name { get; set; }
        public string Status { get; set; }
        public string Category { get; set; }
        public string Language { get; set; }
        public string Id { get; set; }
    }

    public class PagingInfo
    {
        public string Next { get; set; }
    }
}

