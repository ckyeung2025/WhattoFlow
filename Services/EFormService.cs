using System;
using System.IO;
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
        private readonly DocumentConverterService _documentConverterService;

        public EFormService(
            PurpleRiceDbContext context,
            Func<string, LoggingService> loggingServiceFactory,
            WhatsAppWorkflowService whatsAppWorkflowService,
            IConfiguration configuration,
            IAiCompletionClient aiCompletionClient,
            DocumentConverterService documentConverterService)
        {
            _context = context;
            _loggingService = loggingServiceFactory("EFormService");
            _whatsAppWorkflowService = whatsAppWorkflowService;
            _configuration = configuration;
            _aiCompletionClient = aiCompletionClient;
            _documentConverterService = documentConverterService;
        }


        /// <summary>
        /// 使用 AI 填充表單
        /// </summary>
        /// <param name="companyId">公司識別碼</param>
        /// <param name="providerKey">AI 供應商 Key</param>
        /// <param name="originalHtml">原始 HTML 表單</param>
        /// <param name="userMessage">用戶輸入消息</param>
        /// <param name="mediaUrl">媒體文件路徑（可選）</param>
        /// <param name="mediaType">媒體類型（image/document，可選）</param>
        /// <returns>填充後的 HTML 表單</returns>
        public async Task<string> FillFormWithAIAsync(
            Guid companyId, 
            string? providerKey, 
            string originalHtml, 
            string userMessage,
            string? mediaUrl = null,
            string? mediaType = null)
        {
            try
            {
                _loggingService.LogInformation("=== EFormService.FillFormWithAIAsync 開始 ===");
                _loggingService.LogInformation($"開始時間: {DateTime.UtcNow:yyyy-MM-dd HH:mm:ss.fff}");
                _loggingService.LogInformation($"原始 HTML 長度: {originalHtml?.Length ?? 0}");
                _loggingService.LogInformation($"用戶消息: {userMessage}");
                
                if (!string.IsNullOrWhiteSpace(mediaUrl))
                {
                    _loggingService.LogInformation($"🔍 [EFormService] 媒體文件路徑: {mediaUrl}");
                    _loggingService.LogInformation($"🔍 [EFormService] 媒體類型: {mediaType}");
                }

                var formAnalysisPrompt = _configuration["Fill-Form-Prompt:FormAnalysisPrompt"] ?? string.Empty;
                var systemPrompt = _configuration["Fill-Form-Prompt:DefaultSystemPrompt"] ?? string.Empty;

                // 🔍 如果有媒體文件，需要特殊處理
                if (!string.IsNullOrWhiteSpace(mediaUrl))
                {
                    // 將相對 URL 路徑轉換為實際的文件系統路徑
                    var actualFilePath = ConvertMediaUrlToFilePath(mediaUrl);
                    _loggingService.LogInformation($"📎 [EFormService] 原始 MediaUrl: {mediaUrl}");
                    _loggingService.LogInformation($"📎 [EFormService] 轉換後的文件路徑: {actualFilePath}");
                    
                    if (!File.Exists(actualFilePath))
                    {
                        _loggingService.LogWarning($"⚠️ [EFormService] 媒體文件不存在: {actualFilePath}");
                        // 文件不存在時，使用文本模式
                        mediaUrl = null;
                    }
                    else
                    {
                        _loggingService.LogInformation($"📎 [EFormService] 開始處理媒體文件: {actualFilePath}");
                        mediaUrl = actualFilePath; // 更新為實際路徑
                    }
                }
                
                if (!string.IsNullOrWhiteSpace(mediaUrl) && File.Exists(mediaUrl))
                {
                    var fileExtension = Path.GetExtension(mediaUrl).ToLowerInvariant();
                    var isImage = string.Equals(mediaType, "image", StringComparison.OrdinalIgnoreCase) ||
                                 new[] { ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp" }.Contains(fileExtension);
                    
                    if (isImage)
                    {
                        // 📸 處理圖片：轉換為 base64，構建多模態消息
                        _loggingService.LogInformation($"📸 [EFormService] 處理圖片文件");
                        
                        var fileBytes = await File.ReadAllBytesAsync(mediaUrl);
                        _loggingService.LogInformation($"📸 [EFormService] 圖片文件大小: {fileBytes.Length} bytes");
                        
                        var base64Image = Convert.ToBase64String(fileBytes);
                        var mimeType = GetMimeTypeFromExtension(fileExtension);
                        
                        _loggingService.LogInformation($"📸 [EFormService] 圖片已轉換為 base64，大小: {base64Image.Length} characters, MIME: {mimeType}");
                        
                        // 構建更詳細的提示詞，明確要求 AI 分析圖片並填充表單
                        var imageAnalysisPrompt = string.IsNullOrWhiteSpace(userMessage) || userMessage == "[媒體訊息]" || userMessage == "[圖片消息]"
                            ? "請仔細分析這張圖片中的訂單或表單內容，識別所有可用的信息，包括但不限於：\n" +
                              "- 公司名稱、地址、電話\n" +
                              "- 日期、訂單編號\n" +
                              "- 商品項目、描述、數量\n" +
                              "- 金額、總計\n" +
                              "- 其他任何相關的表單字段數據\n\n" +
                              "然後將識別出的信息準確填充到 HTML 表單的相應欄位中。確保：\n" +
                              "1. 所有字段都根據圖片內容填充，不要留空\n" +
                              "2. 數值和文本都要準確匹配圖片中的內容\n" +
                              "3. 只返回完整的 HTML 代碼，不要包含任何解釋文字或 Markdown 標記"
                            : $"{userMessage}\n\n請仔細分析這張圖片中的訂單或表單內容，識別所有可用的信息，然後將識別出的信息準確填充到 HTML 表單的相應欄位中。只返回完整的 HTML 代碼，不要包含任何解釋文字。";

                        // 構建多模態消息內容（JSON 格式）
                        var fullPrompt = $"{formAnalysisPrompt}\n\nHTML 表單內容：\n{originalHtml}\n\n用戶輸入消息：\n{imageAnalysisPrompt}\n\n請仔細分析圖片內容和用戶輸入，識別圖片中的所有表單數據，並將對應的值填充到 HTML 表單的相應欄位中。確保所有欄位都根據圖片內容正確填充，不要留空。只返回完整的 HTML 代碼，不要包含任何解釋文字或 Markdown 標記（如 ```html 或 ```）。";
                        
                        var multimodalContent = new
                        {
                            mediaArray = new[]
                            {
                                new
                                {
                                    base64 = base64Image,
                                    mimeType = mimeType
                                }
                            },
                            prompt = fullPrompt
                        };

                        var serializedContent = JsonSerializer.Serialize(multimodalContent, new JsonSerializerOptions
                        {
                            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
                        });
                        _loggingService.LogInformation($"📸 [EFormService] 多模態內容構建完成，長度: {serializedContent.Length}");
                        
                        var messages = new[]
                        {
                            new AiMessage("user", serializedContent)
                        };

                        var result = await _aiCompletionClient.SendChatAsync(
                            companyId,
                            providerKey,
                            systemPrompt,
                            messages);

                        if (result.Success && !string.IsNullOrWhiteSpace(result.Content))
                        {
                            _loggingService.LogInformation($"✅ [EFormService] AI 填充完成（圖片模式），新 HTML 長度: {result.Content.Length}");
                            _loggingService.LogInformation("=== FillFormWithAI 成功完成（圖片模式） ===");
                            return result.Content;
                        }

                        var providerLabel = string.IsNullOrWhiteSpace(result.ProviderKey) ? providerKey ?? "(unspecified)" : result.ProviderKey;
                        _loggingService.LogWarning($"❌ [EFormService] AI 填充失敗（圖片模式）(Provider: {providerLabel})，錯誤: {result.ErrorMessage ?? "Unknown"}");
                        return originalHtml;
                    }
                    else
                    {
                        // 📄 處理文檔（Excel、Word、PDF）：先用 LibreOffice 轉換為 HTML
                        _loggingService.LogInformation($"📄 [EFormService] 處理文檔文件: {fileExtension}");
                        
                        try
                        {
                            // 檢查是否支持該格式
                            if (!_documentConverterService.IsSupportedFormat(mediaUrl))
                            {
                                _loggingService.LogWarning($"⚠️ [EFormService] 文檔格式不支持 LibreOffice 轉換: {fileExtension}");
                                
                                // 如果不支持轉換，嘗試直接使用文件內容作為文本
                                var fileBytes = await File.ReadAllBytesAsync(mediaUrl);
                                var fileSize = fileBytes.Length;
                                _loggingService.LogInformation($"📄 [EFormService] 文件大小: {fileSize} bytes");
                                
                                // 對於不支持的文件，只能使用文件名和用戶消息
                                var fallbackPrompt = $"用戶上傳了一個文檔文件（{Path.GetFileName(mediaUrl)}），" +
                                                   $"請根據用戶輸入的消息填充表單。";
                                
                                userMessage = string.IsNullOrWhiteSpace(userMessage) 
                                    ? fallbackPrompt 
                                    : $"{userMessage}\n\n{fallbackPrompt}";
                            }
                            else
                            {
                                // 使用 LibreOffice 轉換為 HTML
                                _loggingService.LogInformation($"📄 [EFormService] 開始使用 LibreOffice 轉換文檔為 HTML");
                                var documentHtml = await _documentConverterService.ConvertToHtml(mediaUrl);
                                _loggingService.LogInformation($"📄 [EFormService] 文檔轉換為 HTML 成功，長度: {documentHtml.Length}");
                                
                                var prompt = string.IsNullOrWhiteSpace(userMessage)
                                    ? "請仔細分析文檔內容，識別所有表單字段和數據（如姓名、地址、日期、數量、金額等），然後將對應的值填充到 HTML 表單的相應欄位中。只返回完整的 HTML 代碼，不要包含任何解釋文字。"
                                    : userMessage;

                                var promptBuilder = new StringBuilder();
                                if (!string.IsNullOrWhiteSpace(formAnalysisPrompt))
                                {
                                    promptBuilder.AppendLine(formAnalysisPrompt);
                                    promptBuilder.AppendLine();
                                }

                                promptBuilder.AppendLine("HTML 表單內容：");
                                promptBuilder.AppendLine(originalHtml);
                                promptBuilder.AppendLine();
                                promptBuilder.AppendLine("用戶上傳的文檔內容（已轉換為 HTML）：");
                                promptBuilder.AppendLine(documentHtml);
                                promptBuilder.AppendLine();
                                promptBuilder.AppendLine("用戶輸入消息：");
                                promptBuilder.AppendLine(prompt);
                                promptBuilder.AppendLine();
                                promptBuilder.AppendLine("請分析文檔內容和用戶輸入，並將對應的值填充到 HTML 表單的相應欄位中。只返回完整的 HTML 代碼，不要包含任何解釋文字。");

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
                                    _loggingService.LogInformation($"✅ [EFormService] AI 填充完成（文檔模式），新 HTML 長度: {result.Content.Length}");
                                    _loggingService.LogInformation("=== FillFormWithAI 成功完成（文檔模式） ===");
                                    return result.Content;
                                }

                                var providerLabel = string.IsNullOrWhiteSpace(result.ProviderKey) ? providerKey ?? "(unspecified)" : result.ProviderKey;
                                _loggingService.LogWarning($"❌ [EFormService] AI 填充失敗（文檔模式）(Provider: {providerLabel})，錯誤: {result.ErrorMessage ?? "Unknown"}");
                                return originalHtml;
                            }
                        }
                        catch (Exception docEx)
                        {
                            _loggingService.LogError($"❌ [EFormService] 處理文檔文件時發生錯誤: {docEx.Message}");
                            _loggingService.LogError($"錯誤堆疊: {docEx.StackTrace}");
                            
                            // 轉換失敗時，使用文件名作為提示
                            userMessage = string.IsNullOrWhiteSpace(userMessage) 
                                ? $"用戶上傳了文檔文件：{Path.GetFileName(mediaUrl)}，請根據用戶輸入填充表單。"
                                : userMessage;
                        }
                    }
                }

                // 📝 處理純文本消息（原有邏輯）
                var textPromptBuilder = new StringBuilder();
                if (!string.IsNullOrWhiteSpace(formAnalysisPrompt))
                {
                    textPromptBuilder.AppendLine(formAnalysisPrompt);
                    textPromptBuilder.AppendLine();
                }

                textPromptBuilder.AppendLine("HTML 表單內容：");
                textPromptBuilder.AppendLine(originalHtml);
                textPromptBuilder.AppendLine();
                textPromptBuilder.AppendLine("用戶輸入消息：");
                textPromptBuilder.AppendLine(userMessage);
                textPromptBuilder.AppendLine();
                textPromptBuilder.AppendLine("請分析用戶輸入，並將對應的值填充到 HTML 表單的相應欄位中。只返回完整的 HTML 代碼，不要包含任何解釋文字。");

                var textMessages = new[]
                {
                    new AiMessage("user", textPromptBuilder.ToString())
                };

                var textResult = await _aiCompletionClient.SendChatAsync(
                    companyId,
                    providerKey,
                    systemPrompt,
                    textMessages);

                if (textResult.Success && !string.IsNullOrWhiteSpace(textResult.Content))
                {
                    _loggingService.LogInformation($"✅ [EFormService] AI 填充完成（文本模式），新 HTML 長度: {textResult.Content.Length}");
                    _loggingService.LogInformation("=== FillFormWithAI 成功完成（文本模式） ===");
                    return textResult.Content;
                }

                var textProviderLabel = string.IsNullOrWhiteSpace(textResult.ProviderKey) ? providerKey ?? "(unspecified)" : textResult.ProviderKey;
                _loggingService.LogWarning($"❌ [EFormService] AI 填充失敗（文本模式）(Provider: {textProviderLabel})，錯誤: {textResult.ErrorMessage ?? "Unknown"}");
                return originalHtml;
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"❌ [EFormService] FillFormWithAIAsync 發生錯誤: {ex.Message}");
                _loggingService.LogError($"錯誤堆疊: {ex.StackTrace}");
                return originalHtml;
            }
        }

        /// <summary>
        /// 根據文件擴展名獲取 MIME 類型
        /// </summary>
        private string GetMimeTypeFromExtension(string extension)
        {
            return extension.ToLowerInvariant() switch
            {
                ".jpg" or ".jpeg" => "image/jpeg",
                ".png" => "image/png",
                ".gif" => "image/gif",
                ".bmp" => "image/bmp",
                ".webp" => "image/webp",
                _ => "image/jpeg"
            };
        }

        /// <summary>
        /// 將相對 URL 路徑轉換為實際的文件系統路徑
        /// </summary>
        /// <param name="mediaUrl">相對 URL 路徑（如 /Uploads/Whatsapp_Images/123/file.jpg）</param>
        /// <returns>實際的文件系統路徑</returns>
        private string ConvertMediaUrlToFilePath(string mediaUrl)
        {
            if (string.IsNullOrWhiteSpace(mediaUrl))
            {
                return mediaUrl;
            }

            // 檢查是否以 / 開頭（相對 URL 路徑）或是否包含驅動器符號（Windows 絕對路徑）
            // 在 Windows 上，Path.IsPathRooted("/path") 會返回 true，但這不是真正的絕對路徑
            var isAbsolutePath = Path.IsPathRooted(mediaUrl) && 
                                (mediaUrl.Length > 1 && mediaUrl[1] == ':' || // Windows 驅動器路徑 (C:\...)
                                 mediaUrl.StartsWith("\\\\")); // UNC 路徑 (\\server\...)
            
            if (isAbsolutePath)
            {
                _loggingService.LogInformation($"🔍 [EFormService] 路徑已是絕對路徑，直接返回: '{mediaUrl}'");
                return mediaUrl;
            }

            // 移除前導斜線並轉換為文件系統路徑
            var pathWithoutLeadingSlash = mediaUrl.TrimStart('/');
            
            // 將正斜線轉換為系統路徑分隔符
            var normalizedPath = pathWithoutLeadingSlash.Replace('/', Path.DirectorySeparatorChar);
            
            // 組合當前目錄和路徑
            var fullPath = Path.Combine(Directory.GetCurrentDirectory(), normalizedPath);
            
            _loggingService.LogInformation($"🔍 [EFormService] 路徑轉換: '{mediaUrl}' -> '{fullPath}'");
            
            return fullPath;
        }
    }
}
