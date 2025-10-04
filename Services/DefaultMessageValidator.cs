using System;
using System.Threading.Tasks;
using PurpleRice.Models;

namespace PurpleRice.Services
{
    public class DefaultMessageValidator : IMessageValidator
    {
        public async Task<ValidationResult> ValidateMessageAsync(string userMessage, WorkflowExecution execution, int stepIndex)
        {
            // ✅ 修改：默認驗證器接受任何消息（包括空文本，因為可能是圖片/媒體消息）
            // 圖片消息的 userMessage 為空字符串，但仍然是有效的回覆
            
            // 預設情況下，任何消息都視為有效（文本或媒體）
            return new ValidationResult
            {
                IsValid = true,
                ProcessedData = string.IsNullOrWhiteSpace(userMessage) ? "[媒體消息]" : userMessage,
                ErrorMessage = null,
                SuggestionMessage = null
            };
        }
    }
} 