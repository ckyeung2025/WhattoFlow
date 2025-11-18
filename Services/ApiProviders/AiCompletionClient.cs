using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using PurpleRice.Models.Dto.ApiProviders;

namespace PurpleRice.Services.ApiProviders
{
    public record AiMessage(string Role, string Content);

    public class AiRequestOptions
    {
        public string? ModelOverride { get; set; }
        public double? Temperature { get; set; }
        public double? TopP { get; set; }
        public double? TopK { get; set; }
        public int? MaxTokens { get; set; }
        public int? MaxOutputTokens { get; set; }
        public int? CandidateCount { get; set; }
        public bool? Stream { get; set; }
        public IEnumerable<string>? StopSequences { get; set; }
        public Dictionary<string, object>? AdditionalParameters { get; set; }
    }

    public class AiCompletionResult
    {
        public bool Success { get; set; }
        public string? Content { get; set; }
        public string? RawResponse { get; set; }
        public string? ErrorMessage { get; set; }
        public string? ProviderKey { get; set; }
    }

    public interface IAiCompletionClient
    {
        Task<AiCompletionResult> SendChatAsync(
            Guid companyId,
            string? providerKey,
            string? systemPrompt,
            IReadOnlyList<AiMessage> messages,
            AiRequestOptions? options = null,
            CancellationToken cancellationToken = default);
    }

    public class AiCompletionClient : IAiCompletionClient
    {
        private readonly IApiProviderService _apiProviderService;
        private readonly Func<string, LoggingService> _loggerFactory;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly LoggingService _logger;

        public AiCompletionClient(
            IApiProviderService apiProviderService,
            Func<string, LoggingService> loggerFactory,
            IHttpClientFactory httpClientFactory)
        {
            _apiProviderService = apiProviderService;
            _loggerFactory = loggerFactory;
            _httpClientFactory = httpClientFactory;
            _logger = loggerFactory("AiCompletionClient");
        }

        public async Task<AiCompletionResult> SendChatAsync(
            Guid companyId,
            string? providerKey,
            string? systemPrompt,
            IReadOnlyList<AiMessage> messages,
            AiRequestOptions? options = null,
            CancellationToken cancellationToken = default)
        {
            if (messages == null || messages.Count == 0)
            {
                return new AiCompletionResult
                {
                    Success = false,
                    ErrorMessage = "No messages specified for AI completion request."
                };
            }

            try
            {
                var runtimeProvider = await ResolveRuntimeProviderAsync(companyId, providerKey);
                if (runtimeProvider == null)
                {
                    return new AiCompletionResult
                    {
                        Success = false,
                        ErrorMessage = "No active AI provider configured for current company."
                    };
                }

                var httpClient = _httpClientFactory.CreateClient("AiCompletionClient");

                var endpoint = BuildEndpoint(runtimeProvider.ApiUrl ?? runtimeProvider.DefaultApiUrl, runtimeProvider.DefaultApiUrl, runtimeProvider.DefaultModel, options?.ModelOverride ?? runtimeProvider.DefaultModel ?? runtimeProvider.Model ?? options?.ModelOverride);
                if (endpoint == null)
                {
                    return new AiCompletionResult
                    {
                        Success = false,
                        ErrorMessage = "AI provider endpoint is not configured."
                    };
                }

                var request = new HttpRequestMessage(HttpMethod.Post, endpoint);
                PrepareAuthentication(request, runtimeProvider);
                ApplyExtraHeaders(request, runtimeProvider);

                var requestBody = BuildRequestBody(runtimeProvider, systemPrompt, messages, options);
                if (requestBody == null)
                {
                    return new AiCompletionResult
                    {
                        Success = false,
                        ErrorMessage = $"Provider '{runtimeProvider.ProviderKey}' is not supported yet."
                    };
                }

                var payload = JsonSerializer.Serialize(requestBody, new JsonSerializerOptions
                {
                    PropertyNamingPolicy = null,
                    WriteIndented = false
                });

                // 記錄請求內容（如果是多模態，記錄圖片信息）
                var payloadPreview = payload.Length > 500 ? payload.Substring(0, 500) + "..." : payload;
                _logger.LogInformation($"📤 發送 AI 請求到 '{runtimeProvider.ProviderKey}' -> {endpoint}");
                _logger.LogDebug($"請求內容預覽: {payloadPreview}");
                
                // 檢查是否包含圖片
                if (payload.Contains("image_url") || payload.Contains("inline_data"))
                {
                    _logger.LogInformation($"✅ 請求包含圖片內容（多模態）");
                }

                request.Content = new StringContent(payload, Encoding.UTF8, "application/json");

                var response = await httpClient.SendAsync(request, cancellationToken);
                var responseContent = await response.Content.ReadAsStringAsync(cancellationToken);

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning($"AI provider '{runtimeProvider.ProviderKey}' returned error {(int)response.StatusCode}: {responseContent}");
                    return new AiCompletionResult
                    {
                        Success = false,
                        ErrorMessage = responseContent,
                        RawResponse = responseContent,
                        ProviderKey = runtimeProvider.ProviderKey
                    };
                }

                var parsedResult = ParseResponse(runtimeProvider.ProviderKey, responseContent);
                parsedResult.ProviderKey = runtimeProvider.ProviderKey;
                return parsedResult;
            }
            catch (TaskCanceledException ex)
            {
                _logger.LogError("AI request timed out", ex);
                return new AiCompletionResult { Success = false, ErrorMessage = "AI request timed out." };
            }
            catch (Exception ex)
            {
                _logger.LogError("AI request failed", ex);
                return new AiCompletionResult { Success = false, ErrorMessage = ex.Message };
            }
        }

        private async Task<ApiProviderRuntimeDto?> ResolveRuntimeProviderAsync(Guid companyId, string? providerKey)
        {
            ApiProviderRuntimeDto? runtime = null;

            if (!string.IsNullOrWhiteSpace(providerKey))
            {
                runtime = await _apiProviderService.GetRuntimeProviderAsync(companyId, providerKey);
                if (runtime != null && runtime.Active)
                {
                    return runtime;
                }
            }

            var providers = await _apiProviderService.GetCompanyProvidersAsync(companyId, "AI");
            var fallback = providers.FirstOrDefault(p => p.Active) ?? providers.FirstOrDefault();

            if (fallback == null)
            {
                return null;
            }

            runtime = await _apiProviderService.GetRuntimeProviderAsync(companyId, fallback.ProviderKey);
            return runtime?.Active == true ? runtime : null;
        }

        private static Uri? BuildEndpoint(string? apiUrl, string? defaultUrl, string? providerDefaultModel, string? resolvedModel)
        {
            var endpoint = apiUrl ?? defaultUrl;
            if (string.IsNullOrWhiteSpace(endpoint))
            {
                return null;
            }

            var modelPlaceholder = resolvedModel ?? providerDefaultModel;
            if (!string.IsNullOrWhiteSpace(modelPlaceholder))
            {
                endpoint = endpoint.Replace("{model}", modelPlaceholder);
            }

            if (!Uri.TryCreate(endpoint, UriKind.Absolute, out var uri))
            {
                return null;
            }

            return uri;
        }

        private static void PrepareAuthentication(HttpRequestMessage request, ApiProviderRuntimeDto runtime)
        {
            var apiKey = runtime.ApiKey;
            if (string.IsNullOrWhiteSpace(apiKey))
            {
                return;
            }

            switch ((runtime.AuthType ?? "apiKey").ToLowerInvariant())
            {
                case "apikey":
                case "bearertoken":
                    request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
                    break;
                default:
                    // 其他認證方式留給 ExtraHeaders 處理
                    break;
            }
        }

        private static void ApplyExtraHeaders(HttpRequestMessage request, ApiProviderRuntimeDto runtime)
        {
            if (runtime.ExtraHeaders == null)
            {
                return;
            }

            foreach (var kvp in runtime.ExtraHeaders)
            {
                if (!request.Headers.TryAddWithoutValidation(kvp.Key, kvp.Value))
                {
                    request.Content ??= new StringContent(string.Empty);
                    request.Content.Headers.TryAddWithoutValidation(kvp.Key, kvp.Value);
                }
            }
        }

        private static Dictionary<string, JsonElement> ParseSettings(string? settingsJson)
        {
            if (string.IsNullOrWhiteSpace(settingsJson))
            {
                return new Dictionary<string, JsonElement>(StringComparer.OrdinalIgnoreCase);
            }

            try
            {
                using var document = JsonDocument.Parse(settingsJson);
                if (document.RootElement.ValueKind != JsonValueKind.Object)
                {
                    return new Dictionary<string, JsonElement>(StringComparer.OrdinalIgnoreCase);
                }

                var result = new Dictionary<string, JsonElement>(StringComparer.OrdinalIgnoreCase);
                foreach (var property in document.RootElement.EnumerateObject())
                {
                    result[property.Name] = property.Value.Clone();
                }

                return result;
            }
            catch
            {
                return new Dictionary<string, JsonElement>(StringComparer.OrdinalIgnoreCase);
            }
        }

        private Dictionary<string, object>? BuildRequestBody(ApiProviderRuntimeDto runtime, string? systemPrompt, IReadOnlyList<AiMessage> messages, AiRequestOptions? options)
        {
            var settings = ParseSettings(runtime.SettingsJson ?? runtime.DefaultSettingsJson);

            var providerKey = runtime.ProviderKey?.ToLowerInvariant();
            if (providerKey == "gemini" || (runtime.ApiUrl ?? runtime.DefaultApiUrl ?? string.Empty).Contains("generativelanguage.googleapis.com", StringComparison.OrdinalIgnoreCase))
            {
                return BuildGeminiRequest(runtime, systemPrompt, messages, options, settings);
            }

            // 預設使用 OpenAI 相容格式
            return BuildOpenAiRequest(runtime, systemPrompt, messages, options, settings);
        }

        private Dictionary<string, object>? BuildOpenAiRequest(
            ApiProviderRuntimeDto runtime,
            string? systemPrompt,
            IReadOnlyList<AiMessage> messages,
            AiRequestOptions? options,
            Dictionary<string, JsonElement> settings)
        {
            var model = options?.ModelOverride ?? runtime.Model ?? runtime.DefaultModel;
            var requestBody = new Dictionary<string, object>();

            if (!string.IsNullOrWhiteSpace(model))
            {
                requestBody["model"] = model;
            }

            var messageList = new List<Dictionary<string, object>>();

            if (!string.IsNullOrWhiteSpace(systemPrompt))
            {
                messageList.Add(new Dictionary<string, object>
                {
                    ["role"] = "system",
                    ["content"] = systemPrompt!
                });
            }

            foreach (var message in messages)
            {
                if (string.IsNullOrWhiteSpace(message.Content))
                {
                    continue;
                }

                var role = string.IsNullOrWhiteSpace(message.Role) ? "user" : message.Role;
                
                // 嘗試解析 JSON 內容，檢查是否包含圖片
                var contentParts = ParseMultimodalContent(message.Content, runtime, settings);
                
                if (contentParts != null && contentParts.Count > 0)
                {
                    // 多模態內容（包含圖片）
                    messageList.Add(new Dictionary<string, object>
                    {
                        ["role"] = role,
                        ["content"] = contentParts
                    });
                }
                else
                {
                    // 純文本內容
                    messageList.Add(new Dictionary<string, object>
                    {
                        ["role"] = role,
                        ["content"] = message.Content
                    });
                }
            }

            if (messageList.Count == 0)
            {
                return null;
            }

            requestBody["messages"] = messageList;

            var temperature = options?.Temperature ?? GetDouble(settings, "temperature");
            if (temperature.HasValue)
            {
                requestBody["temperature"] = temperature.Value;
            }

            var topP = options?.TopP ?? GetDouble(settings, "top_p");
            if (topP.HasValue)
            {
                requestBody["top_p"] = topP.Value;
            }

            var maxTokens = options?.MaxTokens ?? GetInt(settings, "max_tokens");
            if (maxTokens.HasValue)
            {
                requestBody["max_tokens"] = maxTokens.Value;
            }

            var stream = options?.Stream ?? GetBool(settings, "stream");
            if (stream.HasValue)
            {
                requestBody["stream"] = stream.Value;
            }

            if (options?.AdditionalParameters != null)
            {
                foreach (var kvp in options.AdditionalParameters)
                {
                    requestBody[kvp.Key] = kvp.Value;
                }
            }

            return requestBody;
        }

        private Dictionary<string, object>? BuildGeminiRequest(
            ApiProviderRuntimeDto runtime,
            string? systemPrompt,
            IReadOnlyList<AiMessage> messages,
            AiRequestOptions? options,
            Dictionary<string, JsonElement> settings)
        {
            var parts = new List<Dictionary<string, object>>();
            
            // 添加 system prompt 作為文本
            if (!string.IsNullOrWhiteSpace(systemPrompt))
            {
                parts.Add(new Dictionary<string, object>
                {
                    ["text"] = systemPrompt!
                });
            }

            // 處理消息內容
            foreach (var message in messages)
            {
                if (string.IsNullOrWhiteSpace(message.Content))
                {
                    continue;
                }

                // 嘗試解析多模態內容
                var geminiParts = ParseGeminiMultimodalContent(message.Content);
                if (geminiParts != null && geminiParts.Count > 0)
                {
                    parts.AddRange(geminiParts);
                }
                else
                {
                    // 純文本內容
                    parts.Add(new Dictionary<string, object>
                    {
                        ["text"] = message.Content
                    });
                }
            }

            if (parts.Count == 0)
            {
                return null;
            }

            var contents = new List<Dictionary<string, object>>
            {
                new Dictionary<string, object>
                {
                    ["role"] = "user",
                    ["parts"] = parts
                }
            };

            var requestBody = new Dictionary<string, object>
            {
                ["contents"] = contents
            };

            var generationConfig = new Dictionary<string, object>();

            var temperature = options?.Temperature ?? GetDouble(settings, "temperature");
            if (temperature.HasValue)
            {
                generationConfig["temperature"] = temperature.Value;
            }

            var topP = options?.TopP ?? GetDouble(settings, "topP");
            if (topP.HasValue)
            {
                generationConfig["topP"] = topP.Value;
            }

            var topK = options?.TopK ?? GetDouble(settings, "topK");
            if (topK.HasValue)
            {
                generationConfig["topK"] = topK.Value;
            }

            var maxOutputTokens = options?.MaxOutputTokens ?? GetInt(settings, "maxOutputTokens");
            if (maxOutputTokens.HasValue)
            {
                generationConfig["maxOutputTokens"] = maxOutputTokens.Value;
            }

            var candidateCount = options?.CandidateCount ?? GetInt(settings, "candidateCount");
            if (candidateCount.HasValue)
            {
                generationConfig["candidateCount"] = candidateCount.Value;
            }

            var stopSequences = options?.StopSequences ?? GetStringArray(settings, "stopSequences");
            if (stopSequences != null && stopSequences.Any())
            {
                generationConfig["stopSequences"] = stopSequences.ToArray();
            }

            if (generationConfig.Count > 0)
            {
                requestBody["generationConfig"] = generationConfig;
            }

            return requestBody;
        }

        private static double? GetDouble(Dictionary<string, JsonElement> settings, string propertyName)
        {
            if (settings.TryGetValue(propertyName, out var value))
            {
                if (value.ValueKind == JsonValueKind.Number && value.TryGetDouble(out var result))
                {
                    return result;
                }
                if (value.ValueKind == JsonValueKind.String && double.TryParse(value.GetString(), out var parsed))
                {
                    return parsed;
                }
            }
            return null;
        }

        private static int? GetInt(Dictionary<string, JsonElement> settings, string propertyName)
        {
            if (settings.TryGetValue(propertyName, out var value))
            {
                if (value.ValueKind == JsonValueKind.Number && value.TryGetInt32(out var result))
                {
                    return result;
                }
                if (value.ValueKind == JsonValueKind.String && int.TryParse(value.GetString(), out var parsed))
                {
                    return parsed;
                }
            }
            return null;
        }

        private static bool? GetBool(Dictionary<string, JsonElement> settings, string propertyName)
        {
            if (settings.TryGetValue(propertyName, out var value))
            {
                if (value.ValueKind == JsonValueKind.True || value.ValueKind == JsonValueKind.False)
                {
                    return value.GetBoolean();
                }
                if (value.ValueKind == JsonValueKind.String && bool.TryParse(value.GetString(), out var parsed))
                {
                    return parsed;
                }
            }
            return null;
        }

        private static IEnumerable<string>? GetStringArray(Dictionary<string, JsonElement> settings, string propertyName)
        {
            if (settings.TryGetValue(propertyName, out var value))
            {
                if (value.ValueKind == JsonValueKind.Array)
                {
                    return value.EnumerateArray()
                        .Where(e => e.ValueKind == JsonValueKind.String)
                        .Select(e => e.GetString())
                        .Where(s => !string.IsNullOrWhiteSpace(s))!
                        .ToArray();
                }

                if (value.ValueKind == JsonValueKind.String)
                {
                    var raw = value.GetString();
                    if (!string.IsNullOrWhiteSpace(raw))
                    {
                        return raw.Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries)
                                  .Select(s => s.Trim());
                    }
                }
            }

            return null;
        }

        private AiCompletionResult ParseResponse(string? providerKey, string responseContent)
        {
            try
            {
                using var document = JsonDocument.Parse(responseContent);

                if (string.Equals(providerKey, "gemini", StringComparison.OrdinalIgnoreCase))
                {
                    if (document.RootElement.TryGetProperty("candidates", out var candidates) && candidates.ValueKind == JsonValueKind.Array && candidates.GetArrayLength() > 0)
                    {
                        var candidate = candidates[0];
                        if (candidate.TryGetProperty("content", out var contentElement) && contentElement.TryGetProperty("parts", out var parts) && parts.ValueKind == JsonValueKind.Array && parts.GetArrayLength() > 0)
                        {
                            var text = parts[0].GetProperty("text").GetString();
                            return new AiCompletionResult
                            {
                                Success = !string.IsNullOrWhiteSpace(text),
                                Content = text,
                                RawResponse = responseContent
                            };
                        }
                    }
                }
                else
                {
                    if (document.RootElement.TryGetProperty("choices", out var choices) && choices.ValueKind == JsonValueKind.Array && choices.GetArrayLength() > 0)
                    {
                        var choice = choices[0];
                        if (choice.TryGetProperty("message", out var message) && message.TryGetProperty("content", out var contentElement))
                        {
                            var text = contentElement.GetString();
                            return new AiCompletionResult
                            {
                                Success = !string.IsNullOrWhiteSpace(text),
                                Content = text,
                                RawResponse = responseContent
                            };
                        }
                        else if (choice.TryGetProperty("text", out var legacyText))
                        {
                            var text = legacyText.GetString();
                            return new AiCompletionResult
                            {
                                Success = !string.IsNullOrWhiteSpace(text),
                                Content = text,
                                RawResponse = responseContent
                            };
                        }
                    }
                }

                return new AiCompletionResult
                {
                    Success = false,
                    ErrorMessage = "Unable to parse AI provider response.",
                    RawResponse = responseContent
                };
            }
            catch (Exception ex)
            {
                _logger.LogError("Failed to parse AI response", ex);
                return new AiCompletionResult
                {
                    Success = false,
                    ErrorMessage = ex.Message,
                    RawResponse = responseContent
                };
            }
        }

        /// <summary>
        /// 解析多模態內容，從 JSON 中提取圖片和文本
        /// </summary>
        private List<Dictionary<string, object>>? ParseMultimodalContent(
            string content, 
            ApiProviderRuntimeDto? runtime = null, 
            Dictionary<string, JsonElement>? settings = null)
        {
            if (string.IsNullOrWhiteSpace(content))
            {
                return null;
            }

            try
            {
                // 嘗試解析為 JSON
                using var document = JsonDocument.Parse(content);
                var root = document.RootElement;

                var contentParts = new List<Dictionary<string, object>>();

                // 檢查是否有 media 對象包含 base64 圖片
                if (root.TryGetProperty("media", out var mediaElement) && mediaElement.ValueKind == JsonValueKind.Object)
                {
                    if (mediaElement.TryGetProperty("base64", out var base64Element) && 
                        base64Element.ValueKind == JsonValueKind.String)
                    {
                        var base64 = base64Element.GetString();
                        var mimeType = "image/jpeg"; // 默認值
                        
                        if (mediaElement.TryGetProperty("mimeType", out var mimeTypeElement) && 
                            mimeTypeElement.ValueKind == JsonValueKind.String)
                        {
                            mimeType = mimeTypeElement.GetString() ?? mimeType;
                        }

                        if (!string.IsNullOrWhiteSpace(base64))
                        {
                            // 驗證 base64 格式
                            var base64Preview = base64.Length > 50 ? base64.Substring(0, 50) + "..." : base64;
                            _logger.LogInformation($"🔍 檢測到圖片，MIME 類型: {mimeType}, Base64 長度: {base64.Length}, 預覽: {base64Preview}");
                            
                            // 檢查 base64 是否有效（應該只包含 base64 字符）
                            var isValidBase64 = System.Text.RegularExpressions.Regex.IsMatch(base64, @"^[A-Za-z0-9+/=]+$");
                            if (!isValidBase64)
                            {
                                _logger.LogWarning($"⚠️ Base64 格式可能無效，包含非 base64 字符");
                            }
                            
                            // 構建圖片 URL（OpenAI vision API 格式）
                            var imageUrl = $"data:{mimeType};base64,{base64}";
                            var imageUrlDict = new Dictionary<string, object>
                            {
                                ["url"] = imageUrl
                            };
                            
                            // 為 xai 和其他支持 detail 的 provider 添加 detail 參數
                            var providerKey = runtime?.ProviderKey?.ToLowerInvariant();
                            if (providerKey == "xai" || providerKey == "openai")
                            {
                                // 從 settings 讀取 imageDetail，默認使用 "high"
                                var imageDetail = "high";
                                if (settings != null && settings.TryGetValue("imageDetail", out var detailElement))
                                {
                                    if (detailElement.ValueKind == JsonValueKind.String)
                                    {
                                        imageDetail = detailElement.GetString() ?? "high";
                                    }
                                }
                                imageUrlDict["detail"] = imageDetail;
                            }
                            
                            contentParts.Add(new Dictionary<string, object>
                            {
                                ["type"] = "image_url",
                                ["image_url"] = imageUrlDict
                            });

                            var detailInfo = imageUrlDict.ContainsKey("detail") ? $", detail: {imageUrlDict["detail"]}" : "";
                            _logger.LogInformation($"✅ 已添加圖片到多模態內容，圖片 URL 長度: {imageUrl.Length}{detailInfo}");
                        }
                    }
                }

                // 添加文本內容（優先級：prompt > text > caption）
                var textParts = new List<string>();
                
                // 優先添加 prompt（驗證規則）
                if (root.TryGetProperty("prompt", out var promptElement) && promptElement.ValueKind == JsonValueKind.String)
                {
                    var prompt = promptElement.GetString();
                    if (!string.IsNullOrWhiteSpace(prompt))
                    {
                        textParts.Add(prompt);
                    }
                }

                // 添加用戶輸入的文本
                if (root.TryGetProperty("text", out var textElement) && textElement.ValueKind == JsonValueKind.String)
                {
                    var text = textElement.GetString();
                    if (!string.IsNullOrWhiteSpace(text) && text != "[圖片消息]")
                    {
                        textParts.Add(text);
                    }
                }

                // 添加圖片說明（如果有）
                if (root.TryGetProperty("caption", out var captionElement) && captionElement.ValueKind == JsonValueKind.String)
                {
                    var caption = captionElement.GetString();
                    if (!string.IsNullOrWhiteSpace(caption))
                    {
                        textParts.Add($"圖片說明: {caption}");
                    }
                }

                // 如果沒有找到文本，但有圖片，添加一個默認提示
                if (textParts.Count == 0 && contentParts.Any(p => p.ContainsKey("type") && p["type"]?.ToString() == "image_url"))
                {
                    // 檢查是否有 prompt
                    if (root.TryGetProperty("prompt", out var promptCheck) && promptCheck.ValueKind == JsonValueKind.String)
                    {
                        var promptText = promptCheck.GetString();
                        if (!string.IsNullOrWhiteSpace(promptText))
                        {
                            textParts.Add(promptText);
                        }
                    }
                    
                    // 如果還是沒有文本，添加一個默認提示（用於圖片驗證）
                    if (textParts.Count == 0)
                    {
                        textParts.Add("請分析這張圖片");
                    }
                }
                else if (textParts.Count == 0)
                {
                    // 沒有圖片也沒有文本，使用整個 JSON 作為文本（向後兼容）
                    textParts.Add(content);
                }

                // 添加文本部分
                foreach (var text in textParts)
                {
                    if (!string.IsNullOrWhiteSpace(text))
                    {
                        contentParts.Add(new Dictionary<string, object>
                        {
                            ["type"] = "text",
                            ["text"] = text
                        });
                    }
                }

                // 只有在找到圖片時才返回多模態格式，否則返回 null（使用純文本）
                return contentParts.Any(p => p.ContainsKey("type") && p["type"]?.ToString() == "image_url") 
                    ? contentParts 
                    : null;
            }
            catch (JsonException)
            {
                // 不是有效的 JSON，返回 null（使用純文本）
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogWarning($"解析多模態內容時發生錯誤: {ex.Message}");
                return null;
            }
        }

        /// <summary>
        /// 解析 Gemini 多模態內容，從 JSON 中提取圖片和文本
        /// </summary>
        private List<Dictionary<string, object>>? ParseGeminiMultimodalContent(string content)
        {
            if (string.IsNullOrWhiteSpace(content))
            {
                return null;
            }

            try
            {
                // 嘗試解析為 JSON
                using var document = JsonDocument.Parse(content);
                var root = document.RootElement;

                var parts = new List<Dictionary<string, object>>();
                bool hasImage = false;

                // 檢查是否有 media 對象包含 base64 圖片
                if (root.TryGetProperty("media", out var mediaElement) && mediaElement.ValueKind == JsonValueKind.Object)
                {
                    if (mediaElement.TryGetProperty("base64", out var base64Element) && 
                        base64Element.ValueKind == JsonValueKind.String)
                    {
                        var base64 = base64Element.GetString();
                        var mimeType = "image/jpeg"; // 默認值
                        
                        if (mediaElement.TryGetProperty("mimeType", out var mimeTypeElement) && 
                            mimeTypeElement.ValueKind == JsonValueKind.String)
                        {
                            mimeType = mimeTypeElement.GetString() ?? mimeType;
                        }

                        if (!string.IsNullOrWhiteSpace(base64))
                        {
                            // 驗證 base64 格式
                            var base64Preview = base64.Length > 50 ? base64.Substring(0, 50) + "..." : base64;
                            _logger.LogInformation($"🔍 Gemini: 檢測到圖片，MIME 類型: {mimeType}, Base64 長度: {base64.Length}, 預覽: {base64Preview}");
                            
                            // 檢查 base64 是否有效
                            var isValidBase64 = System.Text.RegularExpressions.Regex.IsMatch(base64, @"^[A-Za-z0-9+/=]+$");
                            if (!isValidBase64)
                            {
                                _logger.LogWarning($"⚠️ Gemini: Base64 格式可能無效，包含非 base64 字符");
                            }
                            
                            // Gemini API 格式：inline_data
                            parts.Add(new Dictionary<string, object>
                            {
                                ["inline_data"] = new Dictionary<string, object>
                                {
                                    ["mime_type"] = mimeType,
                                    ["data"] = base64
                                }
                            });
                            hasImage = true;
                            _logger.LogInformation($"✅ Gemini: 已添加圖片到多模態內容");
                        }
                    }
                }

                // 添加文本內容（優先級：prompt > text > caption）
                var textParts = new List<string>();
                
                // 優先添加 prompt（驗證規則）
                if (root.TryGetProperty("prompt", out var promptElement) && promptElement.ValueKind == JsonValueKind.String)
                {
                    var prompt = promptElement.GetString();
                    if (!string.IsNullOrWhiteSpace(prompt))
                    {
                        textParts.Add(prompt);
                    }
                }

                // 添加用戶輸入的文本
                if (root.TryGetProperty("text", out var textElement) && textElement.ValueKind == JsonValueKind.String)
                {
                    var text = textElement.GetString();
                    if (!string.IsNullOrWhiteSpace(text) && text != "[圖片消息]")
                    {
                        textParts.Add(text);
                    }
                }

                // 添加圖片說明（如果有）
                if (root.TryGetProperty("caption", out var captionElement) && captionElement.ValueKind == JsonValueKind.String)
                {
                    var caption = captionElement.GetString();
                    if (!string.IsNullOrWhiteSpace(caption))
                    {
                        textParts.Add($"圖片說明: {caption}");
                    }
                }

                // 如果沒有找到文本，但有圖片，添加一個默認提示
                if (textParts.Count == 0 && hasImage)
                {
                    textParts.Add("請分析這張圖片");
                }
                else if (textParts.Count == 0)
                {
                    // 沒有圖片也沒有文本，使用整個 JSON 作為文本（向後兼容）
                    textParts.Add(content);
                }

                // 添加文本部分
                foreach (var text in textParts)
                {
                    if (!string.IsNullOrWhiteSpace(text))
                    {
                        parts.Add(new Dictionary<string, object>
                        {
                            ["text"] = text
                        });
                    }
                }

                // 只有在找到圖片時才返回多模態格式，否則返回 null（使用純文本）
                return hasImage ? parts : null;
            }
            catch (JsonException)
            {
                // 不是有效的 JSON，返回 null（使用純文本）
                return null;
            }
            catch (Exception ex)
            {
                _logger.LogWarning($"解析 Gemini 多模態內容時發生錯誤: {ex.Message}");
                return null;
            }
        }
    }
}

