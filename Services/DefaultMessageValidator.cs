using System;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using PurpleRice.Models;
using PurpleRice.Services.ApiProviders;

namespace PurpleRice.Services
{
    public class MessageValidator : IMessageValidator
    {
        private readonly IAiCompletionClient _aiCompletionClient;
        private readonly IApiProviderService _apiProviderService;
        private readonly LoggingService _logger;

        public MessageValidator(
            IAiCompletionClient aiCompletionClient,
            IApiProviderService apiProviderService,
            Func<string, LoggingService> loggerFactory)
        {
            _aiCompletionClient = aiCompletionClient;
            _apiProviderService = apiProviderService;
            _logger = loggerFactory("MessageValidator");
        }

        public async Task<ValidationResult> ValidateMessageAsync(WhatsAppMessageData messageData, WorkflowExecution execution, WorkflowStepExecution? stepExecution)
        {
            messageData ??= new WhatsAppMessageData();
            var defaultProcessed = string.IsNullOrWhiteSpace(messageData.MessageText)
                ? "[媒體訊息]"
                : messageData.MessageText;

            var defaultResult = new ValidationResult
            {
                IsValid = true,
                ProcessedData = defaultProcessed,
                ValidatorType = "default",
                AdditionalData = BuildMessageContext(messageData, prompt: null, nodeData: null)
            };

            if (execution?.WorkflowDefinition == null || stepExecution == null)
            {
                return defaultResult;
            }

            var validationConfig = ParseValidationConfig(stepExecution.ValidationConfig);
            if (validationConfig == null || validationConfig.Enabled == false)
            {
                return defaultResult;
            }

            var rawValidatorType = (validationConfig.ValidatorType ?? "default").ToLowerInvariant();
            var aiValidatorAliases = new[] { "ai", "openai", "xai" };
            var aiActive = validationConfig.AiIsActive ?? Array.Exists(aiValidatorAliases, alias => string.Equals(rawValidatorType, alias, StringComparison.OrdinalIgnoreCase));

            if (aiActive)
            {
                if ((string.Equals(rawValidatorType, "openai", StringComparison.OrdinalIgnoreCase) ||
                     string.Equals(rawValidatorType, "xai", StringComparison.OrdinalIgnoreCase)) &&
                    string.IsNullOrWhiteSpace(validationConfig.AiProviderKey))
                {
                    validationConfig.AiProviderKey = rawValidatorType;
                }

                validationConfig.ValidatorType = "ai";
                return await ValidateWithAiAsync(messageData, execution, stepExecution, validationConfig);
            }

            return defaultResult;
        }

        private ValidationConfig? ParseValidationConfig(string? json)
        {
            if (string.IsNullOrWhiteSpace(json))
            {
                return null;
            }

            try
            {
                return JsonSerializer.Deserialize<ValidationConfig>(json, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });
            }
            catch (Exception ex)
            {
                _logger.LogWarning($"Unable to parse validation config JSON: {ex.Message}");
                return null;
            }
        }

        private WorkflowNodeData? ExtractNodeData(WorkflowStepExecution stepExecution)
        {
            if (string.IsNullOrWhiteSpace(stepExecution.InputJson))
            {
                return null;
            }

            try
            {
                using var document = JsonDocument.Parse(stepExecution.InputJson);
                if (document.RootElement.TryGetProperty("Data", out var dataElement))
                {
                    return JsonSerializer.Deserialize<WorkflowNodeData>(dataElement.GetRawText(), new JsonSerializerOptions
                    {
                        PropertyNameCaseInsensitive = true
                    });
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning($"Failed to extract node data from step input: {ex.Message}");
            }

            return null;
        }

        private async Task<ValidationResult> ValidateWithAiAsync(
            WhatsAppMessageData messageData,
            WorkflowExecution execution,
            WorkflowStepExecution stepExecution,
            ValidationConfig validationConfig)
        {
            var nodeData = ExtractNodeData(stepExecution);
            var providerKey = validationConfig.AiProviderKey ?? nodeData?.AiProviderKey;

            if (string.IsNullOrWhiteSpace(providerKey))
            {
                _logger.LogWarning("AI validation requested but provider key is missing.");
                return new ValidationResult
                {
                    IsValid = false,
                    ErrorMessage = validationConfig.RetryMessage ?? "AI 驗證器未設定，請聯絡系統管理員。",
                    ValidatorType = "ai",
                    ProcessedData = messageData.MessageText,
                    AdditionalData = BuildMessageContext(messageData, validationConfig.Prompt, nodeData)
                };
            }

            var companyId = execution.WorkflowDefinition.CompanyId;
            if (companyId == Guid.Empty)
            {
                _logger.LogWarning("AI validation requested but company id is empty.");
                return new ValidationResult
                {
                    IsValid = false,
                    ErrorMessage = validationConfig.RetryMessage ?? "系統無法辨識公司資訊，請稍後再試。",
                    ValidatorType = "ai",
                    ProcessedData = messageData.MessageText,
                    AdditionalData = BuildMessageContext(messageData, validationConfig.Prompt, nodeData),
                    ProviderKey = providerKey
                };
            }

            var systemPrompt = BuildAiValidationPrompt(validationConfig.Prompt);
            
            // 獲取 API provider 設置以確定最大文檔長度
            var maxDocumentLength = await GetMaxDocumentLengthAsync(companyId, providerKey);
            var messageContext = BuildMessageContext(messageData, validationConfig.Prompt, nodeData, maxDocumentLength);
            var serializedPayload = JsonSerializer.Serialize(messageContext, new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
            });

            var aiResult = await _aiCompletionClient.SendChatAsync(
                companyId,
                providerKey,
                systemPrompt,
                new[]
                {
                    new AiMessage("user", serializedPayload)
                });

            if (!aiResult.Success || string.IsNullOrWhiteSpace(aiResult.Content))
            {
                _logger.LogWarning($"AI provider '{providerKey}' returned error: {aiResult.ErrorMessage}");
                
                // 檢查是否為圖片不支持錯誤，且消息類型是圖片
                var errorMessage = aiResult.ErrorMessage ?? string.Empty;
                var isImageNotSupported = errorMessage.Contains("Image inputs are not supported", StringComparison.OrdinalIgnoreCase) ||
                                         errorMessage.Contains("image", StringComparison.OrdinalIgnoreCase) && errorMessage.Contains("not supported", StringComparison.OrdinalIgnoreCase);
                
                if (isImageNotSupported && string.Equals(messageData.MessageType, "image", StringComparison.OrdinalIgnoreCase))
                {
                    // 對於圖片消息，如果 provider 不支持圖片，嘗試回退到純文本驗證
                    _logger.LogInformation($"Provider '{providerKey}' 不支持圖片輸入，嘗試回退到純文本驗證");
                    
                    // 移除圖片，只保留文本內容
                    var textOnlyContext = new
                    {
                        messageType = messageData.MessageType,
                        text = string.IsNullOrWhiteSpace(messageData.MessageText) ? "[圖片消息]" : messageData.MessageText,
                        caption = string.IsNullOrWhiteSpace(messageData.Caption) ? null : messageData.Caption,
                        prompt = validationConfig.Prompt,
                        node = nodeData == null ? null : new
                        {
                            nodeData.Type,
                            nodeData.TaskName,
                            nodeData.AiProviderKey
                        }
                    };
                    
                    var textOnlyPayload = JsonSerializer.Serialize(textOnlyContext, new JsonSerializerOptions
                    {
                        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
                    });
                    
                    // 重新發送純文本請求
                    var textOnlyResult = await _aiCompletionClient.SendChatAsync(
                        companyId,
                        providerKey,
                        systemPrompt,
                        new[]
                        {
                            new AiMessage("user", textOnlyPayload)
                        });
                    
                    if (textOnlyResult.Success && !string.IsNullOrWhiteSpace(textOnlyResult.Content))
                    {
                        var textParsedOutcome = ParseAiValidationResponse(textOnlyResult.Content);
                        if (textParsedOutcome != null)
                        {
                            var textIsValid = textParsedOutcome.IsValid ?? false;
                            // 根據流程定義，如果提示說"只要收到圖片就是 IsValid = true"，則直接通過
                            if (!textIsValid && validationConfig.Prompt?.Contains("只要收到圖片就是 IsValid = true", StringComparison.OrdinalIgnoreCase) == true)
                            {
                                _logger.LogInformation("根據流程定義，收到圖片應直接通過驗證");
                                textIsValid = true;
                            }
                            
                            return new ValidationResult
                            {
                                IsValid = textIsValid,
                                ErrorMessage = textIsValid ? null : (validationConfig.RetryMessage ?? textParsedOutcome.Reason ?? "輸入內容未通過驗證，請重新輸入。"),
                                SuggestionMessage = textParsedOutcome.Suggestion,
                                ProcessedData = textParsedOutcome.Processed ?? messageData.MessageText,
                                AdditionalData = new { original = messageContext, fallback = "圖片驗證回退到文本驗證", ai = textParsedOutcome },
                                ValidatorType = "ai",
                                ProviderKey = textOnlyResult.ProviderKey ?? providerKey,
                                TargetProcessVariable = validationConfig.AiResultVariable
                            };
                        }
                    }
                    
                    // 如果純文本驗證也失敗，但流程定義說圖片應該通過，則直接通過
                    if (validationConfig.Prompt?.Contains("只要收到圖片就是 IsValid = true", StringComparison.OrdinalIgnoreCase) == true)
                    {
                        _logger.LogInformation("Provider 不支持圖片，但根據流程定義，收到圖片應直接通過驗證");
                        return new ValidationResult
                        {
                            IsValid = true,
                            ErrorMessage = null,
                            ProcessedData = messageData.MessageText ?? "[圖片消息]",
                            AdditionalData = new { original = messageContext, fallback = "圖片驗證回退，根據流程定義直接通過" },
                            ValidatorType = "ai",
                            ProviderKey = providerKey,
                            TargetProcessVariable = validationConfig.AiResultVariable
                        };
                    }
                }
                
                return new ValidationResult
                {
                    IsValid = false,
                    ErrorMessage = validationConfig.RetryMessage ?? aiResult.ErrorMessage ?? "AI 驗證失敗，請稍後再試。",
                    ValidatorType = "ai",
                    ProcessedData = messageData.MessageText,
                    AdditionalData = messageContext,
                    ProviderKey = aiResult.ProviderKey ?? providerKey
                };
            }

            var parsedOutcome = ParseAiValidationResponse(aiResult.Content);
            if (parsedOutcome == null)
            {
                _logger.LogWarning($"AI response could not be parsed into expected JSON structure. Response content: {aiResult.Content?.Substring(0, Math.Min(500, aiResult.Content?.Length ?? 0))}");
                
                // 如果無法解析，但流程定義說圖片應該通過，則直接通過
                if (string.Equals(messageData.MessageType, "image", StringComparison.OrdinalIgnoreCase) &&
                    validationConfig.Prompt?.Contains("只要收到圖片就是 IsValid = true", StringComparison.OrdinalIgnoreCase) == true)
                {
                    _logger.LogInformation("AI 回應無法解析，但根據流程定義，收到圖片應直接通過驗證");
                    return new ValidationResult
                    {
                        IsValid = true,
                        ErrorMessage = null,
                        ProcessedData = messageData.MessageText ?? "[圖片消息]",
                        AdditionalData = new { original = messageContext, fallback = "AI 回應無法解析，根據流程定義直接通過", rawResponse = aiResult.Content },
                        ValidatorType = "ai",
                        ProviderKey = aiResult.ProviderKey ?? providerKey,
                        TargetProcessVariable = validationConfig.AiResultVariable
                    };
                }
                
                return new ValidationResult
                {
                    IsValid = false,
                    ErrorMessage = validationConfig.RetryMessage ?? "AI 回應格式無法解析，請重新輸入。",
                    ValidatorType = "ai",
                    ProcessedData = messageData.MessageText,
                    AdditionalData = messageContext,
                    ProviderKey = aiResult.ProviderKey ?? providerKey
                };
            }

            var isValid = parsedOutcome.IsValid ?? false;
            
            // 根據流程定義的特殊規則處理
            // 如果 prompt 中說"只要收到圖片就是 IsValid = true"，則圖片消息直接通過
            if (!isValid && string.Equals(messageData.MessageType, "image", StringComparison.OrdinalIgnoreCase))
            {
                if (validationConfig.Prompt?.Contains("只要收到圖片就是 IsValid = true", StringComparison.OrdinalIgnoreCase) == true)
                {
                    _logger.LogInformation("根據流程定義，收到圖片應直接通過驗證");
                    isValid = true;
                }
            }
            
            var processed = string.IsNullOrWhiteSpace(parsedOutcome.Processed)
                ? (isValid ? messageData.MessageText : null)
                : parsedOutcome.Processed;

            var combinedPayload = new
            {
                original = messageContext,
                ai = new
                {
                    parsedOutcome.IsValid,
                    parsedOutcome.Processed,
                    parsedOutcome.Reason,
                    parsedOutcome.Suggestion,
                    raw = aiResult.Content
                }
            };

            return new ValidationResult
            {
                IsValid = isValid,
                ErrorMessage = isValid
                    ? null
                    : validationConfig.RetryMessage
                        ?? parsedOutcome.Reason
                        ?? "輸入內容未通過驗證，請重新輸入。",
                SuggestionMessage = parsedOutcome.Suggestion,
                ProcessedData = processed,
                AdditionalData = combinedPayload,
                ValidatorType = "ai",
                ProviderKey = aiResult.ProviderKey ?? providerKey,
                TargetProcessVariable = validationConfig.AiResultVariable
            };
        }

        private string BuildAiValidationPrompt(string? customPrompt)
        {
            var instructions = string.IsNullOrWhiteSpace(customPrompt)
                ? "請根據流程需求判斷使用者回覆是否有效。"
                : customPrompt;

            return
                "你是一個輸入驗證助手，請閱讀使用者的訊息並判斷是否符合需求。\n" +
                "訊息內容將以 JSON 形式提供，可能包含文字、圖片（Base64）或文件資料。\n" +
                "請遵守以下規則：\n" +
                $"{instructions}\n" +
                "輸出格式必須是 JSON，包含欄位：\n" +
                "isValid (布林值)、processed (若驗證通過，請輸出整理後的值，否則為空字串)、reason (若未通過，請說明原因)、suggestion (給使用者的建議，可留空)。\n" +
                "請僅回傳 JSON，不要包含任何額外文字。";
        }

        private object BuildMessageContext(WhatsAppMessageData messageData, string? prompt, WorkflowNodeData? nodeData, int? maxDocumentLength = null)
        {
            JsonElement? documentElement = null;
            object? documentFallback = null;
            if (!string.IsNullOrWhiteSpace(messageData.DocumentStructuredJson))
            {
                try
                {
                    documentElement = JsonSerializer.Deserialize<JsonElement>(messageData.DocumentStructuredJson);
                }
                catch
                {
                    documentFallback = messageData.DocumentStructuredJson;
                }
            }

            // 處理文檔文本，如果太長則截斷
            string? documentText = null;
            bool isTruncated = false;
            if (!string.IsNullOrWhiteSpace(messageData.DocumentPlainText))
            {
                documentText = messageData.DocumentPlainText;
                
                // 如果設置了最大長度且文檔文本超過限制，則截斷
                if (maxDocumentLength.HasValue && documentText.Length > maxDocumentLength.Value)
                {
                    documentText = documentText.Substring(0, maxDocumentLength.Value);
                    isTruncated = true;
                    _logger.LogWarning($"文檔文本過長 ({messageData.DocumentPlainText.Length} 字符)，已截斷至 {maxDocumentLength.Value} 字符");
                }
            }

            // 如果文檔文本被截斷，在末尾添加註釋
            if (isTruncated && !string.IsNullOrWhiteSpace(documentText))
            {
                documentText += $"\n\n[注意：文檔內容已截斷，原始長度為 {messageData.DocumentPlainText!.Length} 字符]";
            }

            // 對於圖片消息，即使沒有文本也要確保有 messageType 標識
            var textValue = string.IsNullOrWhiteSpace(messageData.MessageText) 
                ? (string.Equals(messageData.MessageType, "image", StringComparison.OrdinalIgnoreCase) ? "[圖片消息]" : null)
                : messageData.MessageText;

            return new
            {
                messageType = messageData.MessageType,
                text = textValue,
                caption = string.IsNullOrWhiteSpace(messageData.Caption) ? null : messageData.Caption,
                media = string.IsNullOrWhiteSpace(messageData.MediaContentBase64)
                    ? null
                    : new
                    {
                        mimeType = messageData.MediaMimeType,
                        fileName = messageData.MediaFileName,
                        base64 = messageData.MediaContentBase64
                    },
                document = documentElement ?? (documentFallback ?? (object?)null),
                documentText = documentText,
                prompt,
                node = nodeData == null ? null : new
                {
                    nodeData.Type,
                    nodeData.TaskName,
                    nodeData.AiProviderKey
                }
            };
        }

        private AiValidationPayload? ParseAiValidationResponse(string content)
        {
            if (string.IsNullOrWhiteSpace(content))
            {
                return null;
            }

            var trimmed = content.Trim();
            if (trimmed.StartsWith("```", StringComparison.Ordinal))
            {
                var firstLineEnd = trimmed.IndexOf('\n');
                var lastFence = trimmed.LastIndexOf("```", StringComparison.Ordinal);
                if (firstLineEnd >= 0 && lastFence > firstLineEnd)
                {
                    trimmed = trimmed.Substring(firstLineEnd + 1, lastFence - firstLineEnd - 1);
                }
            }

            try
            {
                using var document = JsonDocument.Parse(trimmed);
                var root = document.RootElement;
                var payload = new AiValidationPayload
                {
                    IsValid = TryGetBoolean(root, "isValid"),
                    Processed = TryGetString(root, "processed"),
                    Reason = TryGetString(root, "reason"),
                    Suggestion = TryGetString(root, "suggestion")
                };
                return payload;
            }
            catch (Exception ex)
            {
                _logger.LogWarning($"Failed to parse AI validation response: {ex.Message}");
                return null;
            }
        }

        private static bool? TryGetBoolean(JsonElement root, string propertyName)
        {
            if (!root.TryGetProperty(propertyName, out var element))
            {
                return null;
            }

            return element.ValueKind switch
            {
                JsonValueKind.True => true,
                JsonValueKind.False => false,
                JsonValueKind.Number => element.TryGetInt32(out var numberValue) ? numberValue != 0 : (bool?)null,
                JsonValueKind.String => bool.TryParse(element.GetString(), out var boolValue) ? boolValue : (bool?)null,
                _ => null
            };
        }

        private static string? TryGetString(JsonElement root, string propertyName)
        {
            if (!root.TryGetProperty(propertyName, out var element))
            {
                return null;
            }

            return element.ValueKind switch
            {
                JsonValueKind.String => element.GetString(),
                JsonValueKind.Number => element.GetRawText(),
                JsonValueKind.True => "true",
                JsonValueKind.False => "false",
                _ => null
            };
        }

        private async Task<int?> GetMaxDocumentLengthAsync(Guid companyId, string? providerKey)
        {
            try
            {
                // 默認值：假設 1 token ≈ 4 字符，131072 tokens ≈ 524288 字符
                // 為了安全起見，設置為 400000 字符（約 100000 tokens），為其他內容留出空間
                const int defaultMaxLength = 400000;

                if (string.IsNullOrWhiteSpace(providerKey))
                {
                    return defaultMaxLength;
                }

                // 嘗試從 API provider 設置中讀取 max_input_tokens 或 maxDocumentLength
                var runtimeProvider = await _apiProviderService.GetRuntimeProviderAsync(companyId, providerKey);
                if (runtimeProvider?.SettingsJson != null)
                {
                    try
                    {
                        using var document = JsonDocument.Parse(runtimeProvider.SettingsJson);
                        var root = document.RootElement;

                        // 優先讀取 max_input_tokens（以 tokens 為單位）
                        if (root.TryGetProperty("max_input_tokens", out var maxInputTokensElement))
                        {
                            if (maxInputTokensElement.ValueKind == JsonValueKind.Number &&
                                maxInputTokensElement.TryGetInt32(out var maxInputTokens))
                            {
                                // 將 tokens 轉換為字符（1 token ≈ 4 字符）
                                var maxLength = maxInputTokens * 4;
                                // 留出 20% 的空間給其他內容（system prompt、JSON 結構等）
                                maxLength = (int)(maxLength * 0.8);
                                _logger.LogInformation($"從設置中讀取 max_input_tokens: {maxInputTokens} tokens，轉換為最大文檔長度: {maxLength} 字符");
                                return maxLength;
                            }
                        }

                        // 其次讀取 maxDocumentLength（以字符為單位）
                        if (root.TryGetProperty("maxDocumentLength", out var maxDocumentLengthElement))
                        {
                            if (maxDocumentLengthElement.ValueKind == JsonValueKind.Number &&
                                maxDocumentLengthElement.TryGetInt32(out var maxDocumentLength))
                            {
                                _logger.LogInformation($"從設置中讀取 maxDocumentLength: {maxDocumentLength} 字符");
                                return maxDocumentLength;
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning($"解析 API provider 設置時發生錯誤: {ex.Message}");
                    }
                }

                return defaultMaxLength;
            }
            catch (Exception ex)
            {
                _logger.LogWarning($"無法獲取最大文檔長度設置，使用默認值: {ex.Message}");
                return 400000; // 默認值
            }
        }

        private class AiValidationPayload
        {
            public bool? IsValid { get; set; }
            public string? Processed { get; set; }
            public string? Reason { get; set; }
            public string? Suggestion { get; set; }
        }
    }
}
