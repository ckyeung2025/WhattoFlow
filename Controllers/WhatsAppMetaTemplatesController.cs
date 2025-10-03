using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PurpleRice.Data;
using PurpleRice.Services;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace PurpleRice.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class WhatsAppMetaTemplatesController : ControllerBase
    {
        private readonly PurpleRiceDbContext _context;
        private readonly IWhatsAppMetaTemplateService _metaTemplateService;
        private readonly LoggingService _loggingService;

        public WhatsAppMetaTemplatesController(
            PurpleRiceDbContext context,
            IWhatsAppMetaTemplateService metaTemplateService,
            Func<string, LoggingService> loggingServiceFactory)
        {
            _context = context;
            _metaTemplateService = metaTemplateService;
            _loggingService = loggingServiceFactory("WhatsAppMetaTemplatesController");
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

        /// <summary>
        /// 獲取 Meta 模板列表（支持查詢參數）
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetMetaTemplates(
            [FromQuery] string name = null,
            [FromQuery] string status = null,
            [FromQuery] string category = null,
            [FromQuery] string language = null)
        {
            try
            {
                _loggingService.LogInformation("📋 [GetMetaTemplates] 開始獲取 Meta 模板列表");
                _loggingService.LogInformation($"   查詢參數 - Name: {name}, Status: {status}, Category: {category}, Language: {language}");

                var companyId = GetCurrentUserCompanyId();
                if (!companyId.HasValue)
                {
                    return Unauthorized(new { error = "無法識別用戶公司" });
                }

                var result = await _metaTemplateService.GetMetaTemplatesAsync(
                    companyId.Value, 
                    name, 
                    status, 
                    category, 
                    language);

                _loggingService.LogInformation($"✅ [GetMetaTemplates] 成功返回 {result.Data?.Count ?? 0} 個模板");

                return Ok(new
                {
                    success = true,
                    data = result.Data,
                    total = result.Data?.Count ?? 0,
                    paging = result.Paging
                });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"❌ [GetMetaTemplates] 獲取失敗: {ex.Message}", ex);
                return StatusCode(500, new { 
                    success = false,
                    error = "獲取 Meta 模板列表失敗", 
                    message = ex.Message 
                });
            }
        }

        /// <summary>
        /// 創建 Meta 模板
        /// </summary>
        [HttpPost]
        public async Task<IActionResult> CreateMetaTemplate([FromBody] MetaTemplateCreateRequest request)
        {
            try
            {
                _loggingService.LogInformation($"📝 [CreateMetaTemplate] 收到創建請求");
                
                // 檢查請求是否為 null
                if (request == null)
                {
                    _loggingService.LogError("❌ [CreateMetaTemplate] 請求體為 null");
                    return BadRequest(new { 
                        success = false,
                        error = "請求數據為空",
                        message = "Request body is null" 
                    });
                }

                // 記錄請求數據
                _loggingService.LogInformation($"📝 [CreateMetaTemplate] 模板名稱: {request.Name}");
                _loggingService.LogInformation($"📝 [CreateMetaTemplate] 類別: {request.Category}");
                _loggingService.LogInformation($"📝 [CreateMetaTemplate] 語言: {request.Language}");
                _loggingService.LogInformation($"📝 [CreateMetaTemplate] 組件數量: {request.Components?.Count ?? 0}");

                var companyId = GetCurrentUserCompanyId();
                if (!companyId.HasValue)
                {
                    _loggingService.LogWarning("❌ [CreateMetaTemplate] 無法識別用戶公司");
                    return Unauthorized(new { 
                        success = false,
                        error = "無法識別用戶公司" 
                    });
                }

                _loggingService.LogInformation($"📝 [CreateMetaTemplate] 公司ID: {companyId.Value}");

                var result = await _metaTemplateService.CreateMetaTemplateAsync(companyId.Value, request);

                _loggingService.LogInformation($"✅ [CreateMetaTemplate] 創建成功 - ID: {result.Id}");

                return Ok(new
                {
                    success = true,
                    data = result,
                    message = "Meta 模板已提交審核"
                });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"❌ [CreateMetaTemplate] 創建失敗: {ex.Message}", ex);
                _loggingService.LogError($"❌ [CreateMetaTemplate] Stack Trace: {ex.StackTrace}");
                return StatusCode(500, new { 
                    success = false,
                    error = "創建 Meta 模板失敗", 
                    message = ex.Message 
                });
            }
        }

        /// <summary>
        /// 刪除 Meta 模板
        /// </summary>
        [HttpDelete("{templateName}")]
        public async Task<IActionResult> DeleteMetaTemplate(string templateName)
        {
            try
            {
                _loggingService.LogInformation($"🗑️ [DeleteMetaTemplate] 開始刪除模板: {templateName}");

                var companyId = GetCurrentUserCompanyId();
                if (!companyId.HasValue)
                {
                    return Unauthorized(new { error = "無法識別用戶公司" });
                }

                await _metaTemplateService.DeleteMetaTemplateAsync(companyId.Value, templateName);

                _loggingService.LogInformation($"✅ [DeleteMetaTemplate] 刪除成功");

                return Ok(new
                {
                    success = true,
                    message = "Meta 模板刪除成功"
                });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"❌ [DeleteMetaTemplate] 刪除失敗: {ex.Message}", ex);
                return StatusCode(500, new { 
                    success = false,
                    error = "刪除 Meta 模板失敗", 
                    message = ex.Message 
                });
            }
        }

        /// <summary>
        /// 同步 Meta 模板狀態
        /// </summary>
        [HttpPost("sync")]
        public async Task<IActionResult> SyncMetaTemplates()
        {
            try
            {
                _loggingService.LogInformation("🔄 [SyncMetaTemplates] 開始同步模板狀態");

                var companyId = GetCurrentUserCompanyId();
                if (!companyId.HasValue)
                {
                    return Unauthorized(new { error = "無法識別用戶公司" });
                }

                await _metaTemplateService.SyncMetaTemplatesAsync(companyId.Value);

                _loggingService.LogInformation("✅ [SyncMetaTemplates] 同步完成");

                return Ok(new
                {
                    success = true,
                    message = "Meta 模板狀態同步完成"
                });
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"❌ [SyncMetaTemplates] 同步失敗: {ex.Message}", ex);
                return StatusCode(500, new { 
                    success = false,
                    error = "同步失敗", 
                    message = ex.Message 
                });
            }
        }
    }
}

