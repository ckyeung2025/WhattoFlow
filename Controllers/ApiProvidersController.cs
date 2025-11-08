using System;
using System.Security.Claims;
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
}

