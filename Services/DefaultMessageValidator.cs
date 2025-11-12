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
        private readonly LoggingService _logger;

        public MessageValidator(IAiCompletionClient aiCompletionClient, Func<string, LoggingService> loggerFactory)
        {
            _aiCompletionClient = aiCompletionClient;
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
            var messageContext = BuildMessageContext(messageData, validationConfig.Prompt, nodeData);
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
                _logger.LogWarning("AI response could not be parsed into expected JSON structure.");
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

        private object BuildMessageContext(WhatsAppMessageData messageData, string? prompt, WorkflowNodeData? nodeData)
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

            return new
            {
                messageType = messageData.MessageType,
                text = string.IsNullOrWhiteSpace(messageData.MessageText) ? null : messageData.MessageText,
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
                documentText = string.IsNullOrWhiteSpace(messageData.DocumentPlainText) ? null : messageData.DocumentPlainText,
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

        private class AiValidationPayload
        {
            public bool? IsValid { get; set; }
            public string? Processed { get; set; }
            public string? Reason { get; set; }
            public string? Suggestion { get; set; }
        }
    }
}
