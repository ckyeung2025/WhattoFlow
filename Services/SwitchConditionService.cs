using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using PurpleRice.Data;
using PurpleRice.Models;
using Microsoft.EntityFrameworkCore;

namespace PurpleRice.Services
{
    public interface ISwitchConditionService
    {
        Task<string> EvaluateConditionsAsync(int workflowExecutionId, List<SwitchCondition> conditions, string defaultPath);
        Task<bool> EvaluateConditionAsync(int workflowExecutionId, SwitchCondition condition);
        Task<bool> EvaluateConditionGroupAsync(int workflowExecutionId, SwitchConditionGroup group);
        Task<string> EvaluateConditionGroupsAsync(int workflowExecutionId, List<SwitchConditionGroup> groups, string defaultPath);
    }

    public class SwitchConditionService : ISwitchConditionService
    {
        private readonly PurpleRiceDbContext _context;
        private readonly ILogger<SwitchConditionService> _logger;

        public SwitchConditionService(
            PurpleRiceDbContext context,
            ILogger<SwitchConditionService> logger)
        {
            _context = context;
            _logger = logger;
        }

        public async Task<string> EvaluateConditionsAsync(int workflowExecutionId, List<SwitchCondition> conditions, string defaultPath)
        {
            try
            {
                if (conditions == null || !conditions.Any())
                {
                    _logger.LogInformation("No conditions provided, using default path: {DefaultPath}", defaultPath);
                    return defaultPath;
                }

                // 按順序評估每個條件
                foreach (var condition in conditions)
                {
                    if (await EvaluateConditionAsync(workflowExecutionId, condition))
                    {
                        _logger.LogInformation("Condition met for execution {ExecutionId}, condition: {Condition}", 
                            workflowExecutionId, condition.Label);
                        return condition.Label;
                    }
                }

                _logger.LogInformation("No conditions met for execution {ExecutionId}, using default path: {DefaultPath}", 
                    workflowExecutionId, defaultPath);
                return defaultPath;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error evaluating conditions for execution {ExecutionId}", workflowExecutionId);
                return defaultPath; // 發生錯誤時使用默認路徑
            }
        }

        public async Task<bool> EvaluateConditionAsync(int workflowExecutionId, SwitchCondition condition)
        {
            try
            {
                if (string.IsNullOrEmpty(condition.VariableName))
                {
                    _logger.LogWarning("Variable name is empty for condition: {Condition}", condition.Label);
                    return false;
                }

                // 獲取變量值
                var variableValue = await _context.ProcessVariableValues
                    .FirstOrDefaultAsync(pvv => pvv.WorkflowExecutionId == workflowExecutionId 
                                             && pvv.VariableName == condition.VariableName);

                if (variableValue == null)
                {
                    _logger.LogWarning("Variable not found: {VariableName} for execution {ExecutionId}", 
                        condition.VariableName, workflowExecutionId);
                    return false;
                }

                // 根據操作符評估條件
                return condition.Operator.ToLower() switch
                {
                    "equals" => EvaluateEquals(variableValue, condition.Value),
                    "notequals" => !EvaluateEquals(variableValue, condition.Value),
                    "greaterthan" => EvaluateGreaterThan(variableValue, condition.Value),
                    "lessthan" => EvaluateLessThan(variableValue, condition.Value),
                    "contains" => EvaluateContains(variableValue, condition.Value),
                    "isempty" => EvaluateIsEmpty(variableValue),
                    _ => false
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error evaluating condition: {Condition}", condition.Label);
                return false;
            }
        }

        private bool EvaluateEquals(Models.ProcessVariableValue variableValue, string expectedValue)
        {
            return variableValue.DataType.ToLower() switch
            {
                "string" => variableValue.StringValue == expectedValue,
                "int" or "decimal" => decimal.TryParse(expectedValue, out var expected) && variableValue.NumericValue == expected,
                "boolean" => bool.TryParse(expectedValue, out var expected) && variableValue.BooleanValue == expected,
                "datetime" => DateTime.TryParse(expectedValue, out var expected) && variableValue.DateValue == expected,
                _ => variableValue.StringValue == expectedValue
            };
        }

        private bool EvaluateGreaterThan(Models.ProcessVariableValue variableValue, string expectedValue)
        {
            return variableValue.DataType.ToLower() switch
            {
                "int" or "decimal" => decimal.TryParse(expectedValue, out var expected) && variableValue.NumericValue > expected,
                "datetime" => DateTime.TryParse(expectedValue, out var expected) && variableValue.DateValue > expected,
                _ => false
            };
        }

        private bool EvaluateLessThan(Models.ProcessVariableValue variableValue, string expectedValue)
        {
            return variableValue.DataType.ToLower() switch
            {
                "int" or "decimal" => decimal.TryParse(expectedValue, out var expected) && variableValue.NumericValue < expected,
                "datetime" => DateTime.TryParse(expectedValue, out var expected) && variableValue.DateValue < expected,
                _ => false
            };
        }

        private bool EvaluateContains(Models.ProcessVariableValue variableValue, string expectedValue)
        {
            return variableValue.DataType.ToLower() switch
            {
                "string" => !string.IsNullOrEmpty(variableValue.StringValue) && 
                           variableValue.StringValue.Contains(expectedValue),
                _ => false
            };
        }

        private bool EvaluateIsEmpty(Models.ProcessVariableValue variableValue)
        {
            return variableValue.DataType.ToLower() switch
            {
                "string" => string.IsNullOrEmpty(variableValue.StringValue),
                "int" or "decimal" => variableValue.NumericValue == null,
                "boolean" => variableValue.BooleanValue == null,
                "datetime" => variableValue.DateValue == null,
                "json" => string.IsNullOrEmpty(variableValue.JsonValue),
                _ => true
            };
        }

        // 評估條件群組
        public async Task<bool> EvaluateConditionGroupAsync(int workflowExecutionId, SwitchConditionGroup group)
        {
            try
            {
                if (group.Conditions == null || !group.Conditions.Any())
                {
                    _logger.LogInformation("Condition group {GroupId} has no conditions", group.Id);
                    return false;
                }

                _logger.LogInformation("Evaluating condition group {GroupId} with {ConditionCount} conditions, relation: {Relation}", 
                    group.Id, group.Conditions.Count, group.Relation);

                if (group.Relation?.ToLower() == "and")
                {
                    // AND 關係：所有條件都必須滿足
                    foreach (var condition in group.Conditions)
                    {
                        bool conditionResult = await EvaluateConditionAsync(workflowExecutionId, condition);
                        _logger.LogInformation("Condition {VariableName} {Operator} {Value}: {Result}", 
                            condition.VariableName, condition.Operator, condition.Value, conditionResult);
                        
                        if (!conditionResult)
                        {
                            _logger.LogInformation("Condition group {GroupId} AND relation not satisfied", group.Id);
                            return false;
                        }
                    }
                    _logger.LogInformation("Condition group {GroupId} AND relation satisfied", group.Id);
                    return true;
                }
                else
                {
                    // OR 關係：任一條件滿足即可
                    foreach (var condition in group.Conditions)
                    {
                        bool conditionResult = await EvaluateConditionAsync(workflowExecutionId, condition);
                        _logger.LogInformation("Condition {VariableName} {Operator} {Value}: {Result}", 
                            condition.VariableName, condition.Operator, condition.Value, conditionResult);
                        
                        if (conditionResult)
                        {
                            _logger.LogInformation("Condition group {GroupId} OR relation satisfied", group.Id);
                            return true;
                        }
                    }
                    _logger.LogInformation("Condition group {GroupId} OR relation not satisfied", group.Id);
                    return false;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error evaluating condition group {GroupId}", group.Id);
                return false;
            }
        }

        // 評估條件群組列表
        public async Task<string> EvaluateConditionGroupsAsync(int workflowExecutionId, List<SwitchConditionGroup> groups, string defaultPath)
        {
            try
            {
                if (groups == null || !groups.Any())
                {
                    _logger.LogInformation("No condition groups provided, using default path: {DefaultPath}", defaultPath);
                    return defaultPath;
                }

                // 按順序評估每個條件群組
                foreach (var group in groups)
                {
                    if (await EvaluateConditionGroupAsync(workflowExecutionId, group))
                    {
                        _logger.LogInformation("Condition group {GroupId} satisfied, using output path: {OutputPath}", 
                            group.Id, group.OutputPath);
                        return group.OutputPath;
                    }
                }

                _logger.LogInformation("No condition groups satisfied, using default path: {DefaultPath}", defaultPath);
                return defaultPath;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error evaluating condition groups for execution {ExecutionId}", workflowExecutionId);
                return defaultPath;
            }
        }
    }
}
