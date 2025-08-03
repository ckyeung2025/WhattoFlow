using System.Threading.Tasks;

namespace PurpleRice.Models
{
    public interface IMessageValidator
    {
        Task<ValidationResult> ValidateMessageAsync(string userMessage, WorkflowExecution execution, int stepIndex);
    }

    public class ValidationResult
    {
        public bool IsValid { get; set; }
        public string ErrorMessage { get; set; }
        public string SuggestionMessage { get; set; }
        public object ProcessedData { get; set; } // 驗證通過後的處理數據
    }
} 