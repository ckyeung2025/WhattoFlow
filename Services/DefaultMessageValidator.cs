using System;
using System.Text.Json;
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

        public async Task<ValidationResult> ValidateMessageAsync(string userMessage, WorkflowExecution execution, WorkflowStepExecution? stepExecution)
        {
            var defaultResult = new ValidationResult
            {
                IsValid = true,
                ProcessedData = string.IsNullOrWhiteSpace(userMessage) ? "[媒體訊息]" : userMessage,
                ValidatorType = "default"
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

            var validatorType = (validationConfig.ValidatorType ?? "default").ToLowerInvariant();
            if (validatorType == "openai" || validatorType == "xai")
            {
                if (string.IsNullOrWhiteSpace(validationConfig.AiProviderKey))
                {
                    validationConfig.AiProviderKey = validatorType;
                }
                validatorType = "ai";
            }

            switch (validatorType)
            {
                case "ai":
                    return await ValidateWithAiAsync(userMessage, execution, stepExecution, validationConfig);
                case "custom":
                case "default":
                default:
                    return defaultResult;
            }
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
            string userMessage,
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
                    ProcessedData = null
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
                    ProcessedData = null,
                    ProviderKey = providerKey
                };
            }

            var systemPrompt = BuildAiValidationPrompt(validationConfig.Prompt);
            var aiResult = await _aiCompletionClient.SendChatAsync(
                companyId,
                providerKey,
                systemPrompt,
                new[]
                {
                    new AiMessage("user", userMessage ?? string.Empty)
                });

            if (!aiResult.Success || string.IsNullOrWhiteSpace(aiResult.Content))
            {
                _logger.LogWarning($"AI provider '{providerKey}' returned error: {aiResult.ErrorMessage}");
                return new ValidationResult
                {
                    IsValid = false,
                    ErrorMessage = validationConfig.RetryMessage ?? aiResult.ErrorMessage ?? "AI 驗證失敗，請稍後再試。",
                    ValidatorType = "ai",
                    ProcessedData = null,
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
                    ProcessedData = null,
                    ProviderKey = aiResult.ProviderKey ?? providerKey
                };
            }

            var isValid = parsedOutcome.IsValid ?? false;
            var processed = string.IsNullOrWhiteSpace(parsedOutcome.Processed)
                ? (isValid ? userMessage : null)
                : parsedOutcome.Processed;

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
                ValidatorType = "ai",
                ProviderKey = aiResult.ProviderKey ?? providerKey
            };
        }

        private string BuildAiValidationPrompt(string? customPrompt)
        {
            var instructions = string.IsNullOrWhiteSpace(customPrompt)
                ? "請根據流程需求判斷使用者回覆是否有效。"
                : customPrompt;

            return
                "你是一個輸入驗證助手，請閱讀使用者的訊息並判斷是否符合需求。\n" +
                "請遵守以下規則：\n" +
                $"{instructions}\n" +
                "輸出格式必須是 JSON，包含欄位：\n" +
                "isValid (布林值)、processed (若驗證通過，請輸出整理後的值，否則為空字串)、reason (若未通過，請說明原因)、suggestion (給使用者的建議，可留空)。\n" +
                "請僅回傳 JSON，不要包含任何額外文字。";
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
