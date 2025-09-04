using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using PurpleRice.Data;
using Microsoft.EntityFrameworkCore;

namespace PurpleRice.Services
{
    public interface IVariableReplacementService
    {
        Task<string> ReplaceVariablesAsync(string text, int workflowExecutionId);
        Task<string> ReplaceVariablesAsync(string text, Dictionary<string, object> variables);
    }

    public class VariableReplacementService : IVariableReplacementService
    {
        private readonly PurpleRiceDbContext _context;
        private readonly ILogger<VariableReplacementService> _logger;

        public VariableReplacementService(
            PurpleRiceDbContext context,
            ILogger<VariableReplacementService> logger)
        {
            _context = context;
            _logger = logger;
        }

        public async Task<string> ReplaceVariablesAsync(string text, int workflowExecutionId)
        {
            if (string.IsNullOrEmpty(text))
                return text;

            try
            {
                // 獲取工作流執行中的所有變量值
                var variableValues = await _context.ProcessVariableValues
                    .Where(pvv => pvv.WorkflowExecutionId == workflowExecutionId)
                    .ToListAsync();

                var variables = new Dictionary<string, object>();
                foreach (var vv in variableValues)
                {
                    // 根據數據類型獲取對應的值
                    object value = vv.DataType.ToLower() switch
                    {
                        "string" => vv.StringValue,
                        "int" or "decimal" => vv.NumericValue,
                        "boolean" => vv.BooleanValue,
                        "datetime" => vv.DateValue,
                        "json" => vv.JsonValue,
                        _ => vv.StringValue
                    };

                    if (value != null)
                    {
                        variables[vv.VariableName] = value;
                    }
                }

                return await ReplaceVariablesAsync(text, variables);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error replacing variables for workflow execution {ExecutionId}", workflowExecutionId);
                return text; // 返回原始文本
            }
        }

        public Task<string> ReplaceVariablesAsync(string text, Dictionary<string, object> variables)
        {
            if (string.IsNullOrEmpty(text) || variables == null || !variables.Any())
                return Task.FromResult(text);

            try
            {
                // 匹配 ${variable_name} 格式的變量引用
                var pattern = @"\$\{([^}]+)\}";
                var regex = new Regex(pattern);

                var result = regex.Replace(text, match =>
                {
                    var variableName = match.Groups[1].Value.Trim();
                    
                    if (variables.TryGetValue(variableName, out var value))
                    {
                        // 根據值的類型進行格式化
                        return value switch
                        {
                            string str => str,
                            int intVal => intVal.ToString(),
                            double doubleVal => doubleVal.ToString(),
                            decimal decimalVal => decimalVal.ToString(),
                            bool boolVal => boolVal.ToString().ToLower(),
                            DateTime dateVal => dateVal.ToString("yyyy-MM-dd HH:mm:ss"),
                            _ => value?.ToString() ?? ""
                        };
                    }
                    else
                    {
                        _logger.LogWarning("Variable not found: {VariableName}", variableName);
                        return match.Value; // 保持原始格式
                    }
                });
                
                return Task.FromResult(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error replacing variables in text");
                return Task.FromResult(text); // 返回原始文本
            }
        }
    }
}
