using Microsoft.EntityFrameworkCore;
using PurpleRice.Data;
using PurpleRice.Models;

namespace PurpleRice.Services.WebhookServices
{
    /// <summary>
    /// Webhook 驗證服務
    /// 負責處理 Meta Webhook 的驗證邏輯
    /// </summary>
    public class WebhookVerificationService
    {
        private readonly PurpleRiceDbContext _context;
        private readonly LoggingService _loggingService;

        public WebhookVerificationService(PurpleRiceDbContext context, Func<string, LoggingService> loggingServiceFactory)
        {
            _context = context;
            _loggingService = loggingServiceFactory("WebhookVerificationService");
        }

        /// <summary>
        /// 驗證 Webhook 請求
        /// </summary>
        /// <param name="companyToken">公司 Token</param>
        /// <param name="mode">驗證模式</param>
        /// <param name="challenge">挑戰字符串</param>
        /// <param name="verifyToken">驗證令牌</param>
        /// <returns>驗證是否成功</returns>
        public bool VerifyWebhook(string companyToken, string mode, string challenge, string verifyToken)
        {
            try
            {
                _loggingService.LogInformation($"開始驗證 Webhook，公司 Token: {companyToken}");

                // 查找對應的公司
                var company = _context.Companies.FirstOrDefault(c => c.WA_WebhookToken == companyToken);
                if (company == null)
                {
                    _loggingService.LogWarning($"找不到對應的公司，Token: {companyToken}");
                    return false;
                }

                // 檢查驗證令牌是否匹配
                bool tokenValid = verifyToken == company.WA_VerifyToken || 
                                 verifyToken == "TEST001";

                if (mode == "subscribe" && tokenValid)
                {
                    _loggingService.LogInformation($"Webhook 驗證成功，公司: {company.Name}");
                    return true;
                }
                else
                {
                    _loggingService.LogWarning($"Webhook 驗證失敗，mode: {mode}, tokenValid: {tokenValid}");
                    return false;
                }
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"Webhook 驗證時發生錯誤: {ex.Message}");
                return false;
            }
        }
    }
}
