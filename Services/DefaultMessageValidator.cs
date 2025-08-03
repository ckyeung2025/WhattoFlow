using System;
using System.Threading.Tasks;
using PurpleRice.Models;

namespace PurpleRice.Services
{
    public class DefaultMessageValidator : IMessageValidator
    {
        public async Task<ValidationResult> ValidateMessageAsync(string userMessage, WorkflowExecution execution, int stepIndex)
        {
            // 預設驗證器：接受任何非空訊息
            if (string.IsNullOrWhiteSpace(userMessage))
            {
                return new ValidationResult
                {
                    IsValid = false,
                    ErrorMessage = "請輸入有效的訊息內容。",
                    SuggestionMessage = "請重新輸入您的回覆。"
                };
            }

            // 預設情況下，任何非空訊息都視為有效
            return new ValidationResult
            {
                IsValid = true,
                ProcessedData = userMessage,
                ErrorMessage = null,
                SuggestionMessage = null
            };
        }
    }
} 