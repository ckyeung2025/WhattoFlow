using System;
using System.Linq;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using PurpleRice.Data;
using PurpleRice.Models;
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
        private readonly HttpClient _httpClient;

        public EFormService(
            PurpleRiceDbContext context,
            Func<string, LoggingService> loggingServiceFactory,
            WhatsAppWorkflowService whatsAppWorkflowService,
            IConfiguration configuration)
        {
            _context = context;
            _loggingService = loggingServiceFactory("EFormService");
            _whatsAppWorkflowService = whatsAppWorkflowService;
            _configuration = configuration;
            _httpClient = new HttpClient();
            _httpClient.Timeout = TimeSpan.FromMinutes(5);
        }


        /// <summary>
        /// 使用 AI 填充表單
        /// </summary>
        /// <param name="originalHtml">原始 HTML 表單</param>
        /// <param name="userMessage">用戶輸入消息</param>
        /// <returns>填充後的 HTML 表單</returns>
        public async Task<string> FillFormWithAIAsync(string originalHtml, string userMessage)
        {
            try
            {
                _loggingService.LogInformation($"=== EFormService.FillFormWithAIAsync 開始 ===");
                _loggingService.LogInformation($"開始時間: {DateTime.Now:yyyy-MM-dd HH:mm:ss.fff}");
                _loggingService.LogInformation($"原始 HTML 長度: {originalHtml?.Length ?? 0}");
                _loggingService.LogInformation($"用戶消息: {userMessage}");

                // 從配置中獲取 AI 提示詞
                var formAnalysisPrompt = _configuration["XAI:FormAnalysisPrompt"] ?? "";

                // 構建 AI 提示詞
                var prompt = $@"{formAnalysisPrompt}

HTML 表單內容：
{originalHtml}

用戶輸入消息：
{userMessage}

請分析用戶輸入，並將對應的值填充到 HTML 表單的相應欄位中。只返回完整的 HTML 代碼，不要包含任何解釋文字。";

                // 獲取 X.AI 配置
                var apiKey = _configuration["XAI:ApiKey"];
                var model = _configuration["XAI:Model"] ?? "grok-3";
                var temperature = _configuration.GetValue<double>("XAI:Temperature", 0.8);
                var maxTokens = _configuration.GetValue<int>("XAI:MaxTokens", 15000);

                _loggingService.LogDebug($"XAI 配置 - Model: {model}, Temperature: {temperature}, MaxTokens: {maxTokens}");
                _loggingService.LogDebug($"API Key 前10字符: {apiKey?.Substring(0, Math.Min(10, apiKey?.Length ?? 0))}...");

                if (string.IsNullOrEmpty(apiKey))
                {
                    _loggingService.LogWarning("X.AI API Key 未配置，返回原始 HTML");
                    return originalHtml;
                }

                // 構建 AI 請求
                var aiRequest = new
                {
                    messages = new[]
                    {
                        new { role = "user", content = prompt }
                    },
                    model = model,
                    temperature = temperature,
                    max_tokens = maxTokens
                };

                _httpClient.DefaultRequestHeaders.Clear();
                _httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {apiKey}");

                var jsonContent = JsonSerializer.Serialize(aiRequest);
                var content = new StringContent(jsonContent, System.Text.Encoding.UTF8, "application/json");

                _loggingService.LogInformation($"發送 AI 請求...");
                _loggingService.LogDebug($"請求 URL: https://api.x.ai/v1/chat/completions");
                _loggingService.LogDebug($"請求內容長度: {jsonContent.Length}");
                _loggingService.LogDebug($"提示詞長度: {prompt.Length}");
                _loggingService.LogDebug($"HTTP 客戶端超時設置: {_httpClient.Timeout.TotalMinutes} 分鐘");

                var stopwatch = System.Diagnostics.Stopwatch.StartNew();
                
                try
                {
                    var response = await _httpClient.PostAsync("https://api.x.ai/v1/chat/completions", content);
                    stopwatch.Stop();
                    
                    _loggingService.LogInformation($"AI 請求完成，耗時: {stopwatch.ElapsedMilliseconds}ms ({stopwatch.ElapsedMilliseconds / 1000.0:F2}秒)");
                    _loggingService.LogDebug($"響應狀態碼: {response.StatusCode}");
                    
                    var responseContent = await response.Content.ReadAsStringAsync();
                    _loggingService.LogDebug($"響應內容長度: {responseContent.Length}");
                    
                    if (responseContent.Length > 0)
                    {
                        _loggingService.LogDebug($"響應內容前500字符: {responseContent.Substring(0, Math.Min(500, responseContent.Length))}");
                    }

                    if (!response.IsSuccessStatusCode)
                    {
                        _loggingService.LogError($"AI 請求失敗: {response.StatusCode} - {responseContent}");
                        _loggingService.LogWarning("=== FillFormWithAI 失敗 - HTTP 錯誤 ===");
                        return originalHtml;
                    }

                    // 解析 AI 響應
                    try
                    {
                        var aiResponse = JsonSerializer.Deserialize<JsonElement>(responseContent);
                        var filledHtml = aiResponse.GetProperty("choices")[0].GetProperty("message").GetProperty("content").GetString();

                        _loggingService.LogInformation($"AI 填充完成，新 HTML 長度: {filledHtml?.Length ?? 0}");
                        _loggingService.LogInformation("=== FillFormWithAI 成功完成 ===");
                        return filledHtml;
                    }
                    catch (Exception parseEx)
                    {
                        _loggingService.LogError($"解析 AI 響應失敗: {parseEx.Message}");
                        _loggingService.LogWarning("=== FillFormWithAI 失敗 - 響應解析錯誤 ===");
                        return originalHtml;
                    }
                }
                catch (TaskCanceledException timeoutEx)
                {
                    _loggingService.LogError($"AI 請求超時: {timeoutEx.Message}");
                    _loggingService.LogWarning("=== FillFormWithAI 失敗 - 請求超時 ===");
                    return originalHtml;
                }
                catch (HttpRequestException httpEx)
                {
                    _loggingService.LogError($"HTTP 請求錯誤: {httpEx.Message}");
                    _loggingService.LogWarning("=== FillFormWithAI 失敗 - HTTP 請求錯誤 ===");
                    return originalHtml;
                }
                catch (Exception ex)
                {
                    _loggingService.LogError($"AI 請求發生未預期錯誤: {ex.Message}");
                    _loggingService.LogWarning("=== FillFormWithAI 失敗 - 未預期錯誤 ===");
                    return originalHtml;
                }
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"FillFormWithAIAsync 發生錯誤: {ex.Message}");
                _loggingService.LogError($"錯誤堆疊: {ex.StackTrace}");
                return originalHtml;
            }
        }



        /// <summary>
        /// 釋放資源
        /// </summary>
        public void Dispose()
        {
            _httpClient?.Dispose();
        }
    }
}
