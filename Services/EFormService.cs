using System;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using PurpleRice.Data;
using PurpleRice.Models;
using PurpleRice.Services.ApiProviders;
using PurpleRice.Services;

namespace PurpleRice.Services
{
    /// <summary>
    /// eForm 服務
    /// 負責處理 eForm 的創建、AI 填充、發送等相關功能
    /// </summary>
    public class EFormService
    {
        private readonly PurpleRiceDbContext _context;
        private readonly LoggingService _loggingService;
        private readonly WhatsAppWorkflowService _whatsAppWorkflowService;
        private readonly IConfiguration _configuration;
        private readonly IAiCompletionClient _aiCompletionClient;

        public EFormService(
            PurpleRiceDbContext context,
            Func<string, LoggingService> loggingServiceFactory,
            WhatsAppWorkflowService whatsAppWorkflowService,
            IConfiguration configuration,
            IAiCompletionClient aiCompletionClient)
        {
            _context = context;
            _loggingService = loggingServiceFactory("EFormService");
            _whatsAppWorkflowService = whatsAppWorkflowService;
            _configuration = configuration;
            _aiCompletionClient = aiCompletionClient;
        }


        /// <summary>
        /// 使用 AI 填充表單
        /// </summary>
        /// <param name="companyId">公司識別碼</param>
        /// <param name="providerKey">AI 供應商 Key</param>
        /// <param name="originalHtml">原始 HTML 表單</param>
        /// <param name="userMessage">用戶輸入消息</param>
        /// <returns>填充後的 HTML 表單</returns>
        public async Task<string> FillFormWithAIAsync(Guid companyId, string? providerKey, string originalHtml, string userMessage)
        {
            try
            {
                _loggingService.LogInformation("=== EFormService.FillFormWithAIAsync 開始 ===");
                _loggingService.LogInformation($"開始時間: {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss.fff}");
                _loggingService.LogInformation($"原始 HTML 長度: {originalHtml?.Length ?? 0}");
                _loggingService.LogInformation($"用戶消息: {userMessage}");

                var formAnalysisPrompt = _configuration["Fill-Form-Prompt:FormAnalysisPrompt"] ?? string.Empty;
                var systemPrompt = _configuration["Fill-Form-Prompt:DefaultSystemPrompt"] ?? string.Empty;

                var promptBuilder = new StringBuilder();
                if (!string.IsNullOrWhiteSpace(formAnalysisPrompt))
                {
                    promptBuilder.AppendLine(formAnalysisPrompt);
                    promptBuilder.AppendLine();
                }

                promptBuilder.AppendLine("HTML 表單內容：");
                promptBuilder.AppendLine(originalHtml);
                promptBuilder.AppendLine();
                promptBuilder.AppendLine("用戶輸入消息：");
                promptBuilder.AppendLine(userMessage);
                promptBuilder.AppendLine();
                promptBuilder.AppendLine("請分析用戶輸入，並將對應的值填充到 HTML 表單的相應欄位中。只返回完整的 HTML 代碼，不要包含任何解釋文字。");

                var messages = new[]
                {
                    new AiMessage("user", promptBuilder.ToString())
                };

                var result = await _aiCompletionClient.SendChatAsync(
                    companyId,
                    providerKey,
                    systemPrompt,
                    messages);

                if (result.Success && !string.IsNullOrWhiteSpace(result.Content))
                {
                    _loggingService.LogInformation($"AI 填充完成，新 HTML 長度: {result.Content.Length}");
                    _loggingService.LogInformation("=== FillFormWithAI 成功完成 ===");
                    return result.Content;
                }

                var providerLabel = string.IsNullOrWhiteSpace(result.ProviderKey) ? providerKey ?? "(unspecified)" : result.ProviderKey;
                _loggingService.LogWarning($"AI 填充失敗 (Provider: {providerLabel})，錯誤: {result.ErrorMessage ?? "Unknown"}");
                return originalHtml;
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"FillFormWithAIAsync 發生錯誤: {ex.Message}");
                _loggingService.LogError($"錯誤堆疊: {ex.StackTrace}");
                return originalHtml;
            }
        }
    }
}
