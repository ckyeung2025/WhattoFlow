using Microsoft.AspNetCore.Mvc;
using PurpleRice.Services.WebhookServices;
using PurpleRice.Services;

namespace PurpleRice.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class MetaWebhookController : ControllerBase
    {
        private readonly WebhookVerificationService _verificationService;
        private readonly WebhookMessageProcessingService _messageProcessingService;
        private readonly LoggingService _loggingService;

        public MetaWebhookController(
            WebhookVerificationService verificationService,
            WebhookMessageProcessingService messageProcessingService,
            Func<string, LoggingService> loggingServiceFactory)
        {
            _verificationService = verificationService;
            _messageProcessingService = messageProcessingService;
            _loggingService = loggingServiceFactory("MetaWebhookController");
        }

        /// <summary>
        /// 驗證 Meta Webhook
        /// </summary>
        /// <param name="companyToken">公司 Token</param>
        /// <param name="mode">驗證模式</param>
        /// <param name="challenge">挑戰字符串</param>
        /// <param name="verifyToken">驗證令牌</param>
        /// <returns>驗證結果</returns>
        [HttpGet("{companyToken}")]
        public IActionResult VerifyWebhook(string companyToken, [FromQuery(Name = "hub.mode")] string mode,
                                           [FromQuery(Name = "hub.challenge")] string challenge,
                                           [FromQuery(Name = "hub.verify_token")] string verifyToken)
        {
            try
            {
                var isValid = _verificationService.VerifyWebhook(companyToken, mode, challenge, verifyToken);
                return isValid ? Content(challenge) : Unauthorized("Invalid verification");
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"Webhook 驗證失敗: {ex.Message}");
                return Unauthorized("Verification failed");
            }
        }

        /// <summary>
        /// 處理 Meta Webhook 消息
        /// </summary>
        /// <param name="companyToken">公司 Token</param>
        /// <param name="payload">Webhook 數據</param>
        /// <returns>處理結果</returns>
        [HttpPost("{companyToken}")]
        public async Task<IActionResult> HandleWebhook(string companyToken, [FromBody] object payload)
        {
            try
            {
                // 快速檢查基本參數
                if (string.IsNullOrEmpty(companyToken) || payload == null)
                {
                    return BadRequest("Invalid parameters");
                }

                // 使用服務處理 Webhook
                var result = await _messageProcessingService.ProcessWebhookAsync(companyToken, payload);
                
                return Ok(result);
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"Webhook 處理失敗: {ex.Message}");
                // 即使失敗也要返回 200，避免 Meta 重發
                return Ok(new { success = false, error = ex.Message });
            }
        }
    }
}
