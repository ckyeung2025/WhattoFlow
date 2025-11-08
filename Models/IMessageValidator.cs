using System.Threading.Tasks;

namespace PurpleRice.Models
{
    public interface IMessageValidator
    {
        Task<ValidationResult> ValidateMessageAsync(string userMessage, WorkflowExecution execution, WorkflowStepExecution? stepExecution);
    }

    public class ValidationResult
    {
        public bool IsValid { get; set; }
        public string? ErrorMessage { get; set; }
        public string? SuggestionMessage { get; set; }
        public object? ProcessedData { get; set; } // 驗證通過後的處理數據
        public string? ValidatorType { get; set; }
        public string? ProviderKey { get; set; }
    }
} 