using Microsoft.EntityFrameworkCore;
using PurpleRice.Data;
using PurpleRice.Models;
using System.Text.Json;

namespace PurpleRice.Services
{
    public interface IProcessVariableService
    {
        // 流程變量定義管理
        Task<IEnumerable<ProcessVariableDefinition>> GetVariableDefinitionsAsync(int workflowDefinitionId);
        Task<ProcessVariableDefinition?> GetVariableDefinitionAsync(Guid id);
        Task<ProcessVariableDefinition> CreateVariableDefinitionAsync(ProcessVariableDefinition definition);
        Task<ProcessVariableDefinition> UpdateVariableDefinitionAsync(ProcessVariableDefinition definition);
        Task<bool> DeleteVariableDefinitionAsync(Guid id);

        // 流程變量值管理
        Task<IEnumerable<ProcessVariableValue>> GetVariableValuesAsync(int workflowExecutionId);
        Task<ProcessVariableValue?> GetVariableValueAsync(int workflowExecutionId, string variableName);
        Task<ProcessVariableValue> SetVariableValueAsync(int workflowExecutionId, string variableName, object value, string? setBy = null, string? sourceType = null, string? sourceReference = null);
        Task<bool> DeleteVariableValueAsync(int workflowExecutionId, string variableName);

        // 批量操作
        Task<Dictionary<string, object?>> GetVariableValuesAsDictionaryAsync(int workflowExecutionId);
        Task SetMultipleVariableValuesAsync(int workflowExecutionId, Dictionary<string, object> values, string? setBy = null, string? sourceType = null);

        // 驗證和轉換
        Task<bool> ValidateVariableValueAsync(string dataType, object value, string? validationRules = null);
        Task<object?> ConvertValueAsync(string dataType, object value);

        // 獲取流程變量實例值（包含定義信息）
        Task<IEnumerable<ProcessVariableInstanceValue>> GetProcessVariableInstanceValuesAsync(int workflowExecutionId);
    }

    public class ProcessVariableService : IProcessVariableService
    {
        private readonly PurpleRiceDbContext _context;
        private readonly LoggingService _loggingService;

        public ProcessVariableService(PurpleRiceDbContext context, Func<string, LoggingService> loggingServiceFactory)
        {
            _context = context;
            _loggingService = loggingServiceFactory("ProcessVariableService");
        }

        #region 流程變量定義管理

        public async Task<IEnumerable<ProcessVariableDefinition>> GetVariableDefinitionsAsync(int workflowDefinitionId)
        {
            try
            {
                return await _context.ProcessVariableDefinitions
                    .Where(p => p.WorkflowDefinitionId == workflowDefinitionId)
                    .OrderBy(p => p.VariableName)
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取流程變量定義失敗: {ex.Message}", ex);
                throw;
            }
        }

        public async Task<ProcessVariableDefinition?> GetVariableDefinitionAsync(Guid id)
        {
            try
            {
                return await _context.ProcessVariableDefinitions
                    .FirstOrDefaultAsync(p => p.Id == id);
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取流程變量定義失敗: {ex.Message}", ex);
                throw;
            }
        }

        public async Task<ProcessVariableDefinition> CreateVariableDefinitionAsync(ProcessVariableDefinition definition)
        {
            try
            {
                // 檢查變量名稱是否已存在
                var existing = await _context.ProcessVariableDefinitions
                    .FirstOrDefaultAsync(p => p.WorkflowDefinitionId == definition.WorkflowDefinitionId 
                                           && p.VariableName == definition.VariableName);
                
                if (existing != null)
                {
                    throw new InvalidOperationException($"變量名稱 '{definition.VariableName}' 已存在於工作流定義中");
                }

                definition.Id = Guid.NewGuid();
                definition.CreatedAt = DateTime.UtcNow;

                _context.ProcessVariableDefinitions.Add(definition);
                await _context.SaveChangesAsync();

                _loggingService.LogInformation($"創建流程變量定義成功: {definition.VariableName}");
                return definition;
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"創建流程變量定義失敗: {ex.Message}", ex);
                throw;
            }
        }

        public async Task<ProcessVariableDefinition> UpdateVariableDefinitionAsync(ProcessVariableDefinition definition)
        {
            try
            {
                var existing = await _context.ProcessVariableDefinitions
                    .FirstOrDefaultAsync(p => p.Id == definition.Id);

                if (existing == null)
                {
                    throw new InvalidOperationException("流程變量定義不存在");
                }

                // 檢查變量名稱是否與其他變量衝突
                var nameConflict = await _context.ProcessVariableDefinitions
                    .FirstOrDefaultAsync(p => p.WorkflowDefinitionId == definition.WorkflowDefinitionId 
                                           && p.VariableName == definition.VariableName 
                                           && p.Id != definition.Id);
                
                if (nameConflict != null)
                {
                    throw new InvalidOperationException($"變量名稱 '{definition.VariableName}' 已存在於工作流定義中");
                }

                existing.VariableName = definition.VariableName;
                existing.DisplayName = definition.DisplayName;
                existing.DataType = definition.DataType;
                existing.Description = definition.Description;
                existing.IsRequired = definition.IsRequired;
                existing.DefaultValue = definition.DefaultValue;
                existing.ValidationRules = definition.ValidationRules;
                existing.JsonSchema = definition.JsonSchema;
                existing.UpdatedAt = DateTime.UtcNow;
                existing.UpdatedBy = definition.UpdatedBy;

                // 使用事務來處理數據庫觸發器問題
                using var transaction = await _context.Database.BeginTransactionAsync();
                try
                {
                    await _context.SaveChangesAsync();
                    await transaction.CommitAsync();
                }
                catch (Exception ex) when (ex.Message.Contains("database triggers"))
                {
                    await transaction.RollbackAsync();
                    // 嘗試使用原始 SQL 更新
                    await _context.Database.ExecuteSqlRawAsync(@"
                        UPDATE process_variable_definitions 
                        SET variable_name = {0}, display_name = {1}, data_type = {2}, 
                            description = {3}, is_required = {4}, default_value = {5}, 
                            validation_rules = {6}, json_schema = {7}, updated_at = {8}, updated_by = {9}
                        WHERE id = {10}",
                        existing.VariableName, existing.DisplayName, existing.DataType,
                        existing.Description, existing.IsRequired, existing.DefaultValue,
                        existing.ValidationRules, existing.JsonSchema, existing.UpdatedAt, existing.UpdatedBy,
                        existing.Id);
                }

                _loggingService.LogInformation($"更新流程變量定義成功: {definition.VariableName}");
                return existing;
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"更新流程變量定義失敗: {ex.Message}", ex);
                throw;
            }
        }

        public async Task<bool> DeleteVariableDefinitionAsync(Guid id)
        {
            try
            {
                var definition = await _context.ProcessVariableDefinitions
                    .FirstOrDefaultAsync(p => p.Id == id);

                if (definition == null)
                {
                    return false;
                }

                // 使用事務來處理數據庫觸發器問題
                using var transaction = await _context.Database.BeginTransactionAsync();
                try
                {
                    _context.ProcessVariableDefinitions.Remove(definition);
                    await _context.SaveChangesAsync();
                    await transaction.CommitAsync();
                }
                catch (Exception ex) when (ex.Message.Contains("database triggers"))
                {
                    await transaction.RollbackAsync();
                    // 嘗試使用原始 SQL 刪除
                    await _context.Database.ExecuteSqlRawAsync(
                        "DELETE FROM process_variable_definitions WHERE id = {0}", id);
                }

                _loggingService.LogInformation($"刪除流程變量定義成功: {definition.VariableName}");
                return true;
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"刪除流程變量定義失敗: {ex.Message}", ex);
                throw;
            }
        }

        #endregion

        #region 流程變量值管理

        public async Task<IEnumerable<ProcessVariableValue>> GetVariableValuesAsync(int workflowExecutionId)
        {
            try
            {
                return await _context.ProcessVariableValues
                    .Where(p => p.WorkflowExecutionId == workflowExecutionId)
                    .OrderBy(p => p.VariableName)
                    .ToListAsync();
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取流程變量值失敗: {ex.Message}", ex);
                throw;
            }
        }

        public async Task<ProcessVariableValue?> GetVariableValueAsync(int workflowExecutionId, string variableName)
        {
            try
            {
                return await _context.ProcessVariableValues
                    .FirstOrDefaultAsync(p => p.WorkflowExecutionId == workflowExecutionId 
                                           && p.VariableName == variableName);
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取流程變量值失敗: {ex.Message}", ex);
                throw;
            }
        }

        public async Task<ProcessVariableValue> SetVariableValueAsync(int workflowExecutionId, string variableName, object value, string? setBy = null, string? sourceType = null, string? sourceReference = null)
        {
            try
            {
                // 獲取變量定義以確定數據類型
                var definition = await _context.ProcessVariableDefinitions
                    .FirstOrDefaultAsync(p => p.WorkflowDefinitionId == 
                        _context.WorkflowExecutions
                            .Where(we => we.Id == workflowExecutionId)
                            .Select(we => we.WorkflowDefinitionId)
                            .FirstOrDefault()
                        && p.VariableName == variableName);

                if (definition == null)
                {
                    throw new InvalidOperationException($"變量定義不存在: {variableName}");
                }

                // 驗證值
                if (!await ValidateVariableValueAsync(definition.DataType, value, definition.ValidationRules))
                {
                    throw new InvalidOperationException($"變量值驗證失敗: {variableName}");
                }

                // 查找現有值
                var existingValue = await _context.ProcessVariableValues
                    .FirstOrDefaultAsync(p => p.WorkflowExecutionId == workflowExecutionId 
                                           && p.VariableName == variableName);

                if (existingValue != null)
                {
                    // 更新現有值
                    existingValue.DataType = definition.DataType;
                    existingValue.SetValue(value);
                    existingValue.SetAt = DateTime.UtcNow;
                    existingValue.SetBy = setBy;
                    existingValue.SourceType = sourceType;
                    existingValue.SourceReference = sourceReference;
                }
                else
                {
                    // 創建新值
                    existingValue = new ProcessVariableValue
                    {
                        Id = Guid.NewGuid(),
                        WorkflowExecutionId = workflowExecutionId,
                        VariableName = variableName,
                        DataType = definition.DataType,
                        SetBy = setBy,
                        SourceType = sourceType,
                        SourceReference = sourceReference,
                        SetAt = DateTime.UtcNow
                    };
                    existingValue.SetValue(value);
                    _context.ProcessVariableValues.Add(existingValue);
                }

                await _context.SaveChangesAsync();

                _loggingService.LogInformation($"設置流程變量值成功: {variableName} = {value}");
                return existingValue;
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"設置流程變量值失敗: {ex.Message}", ex);
                throw;
            }
        }

        public async Task<bool> DeleteVariableValueAsync(int workflowExecutionId, string variableName)
        {
            try
            {
                var value = await _context.ProcessVariableValues
                    .FirstOrDefaultAsync(p => p.WorkflowExecutionId == workflowExecutionId 
                                           && p.VariableName == variableName);

                if (value == null)
                {
                    return false;
                }

                _context.ProcessVariableValues.Remove(value);
                await _context.SaveChangesAsync();

                _loggingService.LogInformation($"刪除流程變量值成功: {variableName}");
                return true;
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"刪除流程變量值失敗: {ex.Message}", ex);
                throw;
            }
        }

        #endregion

        #region 批量操作

        public async Task<Dictionary<string, object?>> GetVariableValuesAsDictionaryAsync(int workflowExecutionId)
        {
            try
            {
                var values = await GetVariableValuesAsync(workflowExecutionId);
                return values.ToDictionary(v => v.VariableName, v => v.GetValue());
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取流程變量值字典失敗: {ex.Message}", ex);
                throw;
            }
        }

        public async Task SetMultipleVariableValuesAsync(int workflowExecutionId, Dictionary<string, object> values, string? setBy = null, string? sourceType = null)
        {
            try
            {
                foreach (var kvp in values)
                {
                    await SetVariableValueAsync(workflowExecutionId, kvp.Key, kvp.Value, setBy, sourceType);
                }

                _loggingService.LogInformation($"批量設置流程變量值成功: {values.Count} 個變量");
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"批量設置流程變量值失敗: {ex.Message}", ex);
                throw;
            }
        }

        #endregion

        #region 驗證和轉換

        public async Task<bool> ValidateVariableValueAsync(string dataType, object value, string? validationRules = null)
        {
            try
            {
                if (value == null) return true; // 允許空值

                // 基本數據類型驗證
                switch (dataType.ToLower())
                {
                    case "string":
                        return value is string;
                    case "int":
                        return int.TryParse(value.ToString(), out _);
                    case "decimal":
                        return decimal.TryParse(value.ToString(), out _);
                    case "datetime":
                        return DateTime.TryParse(value.ToString(), out _);
                    case "boolean":
                        return bool.TryParse(value.ToString(), out _);
                    case "text":
                        return value is string;
                    case "json":
                        try
                        {
                            JsonSerializer.Deserialize<object>(value.ToString() ?? "");
                            return true;
                        }
                        catch
                        {
                            return false;
                        }
                    default:
                        return true;
                }
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"驗證變量值失敗: {ex.Message}", ex);
                return false;
            }
        }

        public async Task<object?> ConvertValueAsync(string dataType, object value)
        {
            try
            {
                if (value == null) return null;

                switch (dataType.ToLower())
                {
                    case "string":
                        return value.ToString();
                    case "int":
                        return int.TryParse(value.ToString(), out var intVal) ? intVal : null;
                    case "decimal":
                        return decimal.TryParse(value.ToString(), out var decVal) ? decVal : null;
                    case "datetime":
                        return DateTime.TryParse(value.ToString(), out var dateVal) ? dateVal : null;
                    case "boolean":
                        return bool.TryParse(value.ToString(), out var boolVal) ? boolVal : null;
                    case "text":
                        return value.ToString();
                    case "json":
                        return value.ToString();
                    default:
                        return value.ToString();
                }
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"轉換變量值失敗: {ex.Message}", ex);
                return null;
            }
        }

        public async Task<IEnumerable<ProcessVariableInstanceValue>> GetProcessVariableInstanceValuesAsync(int workflowExecutionId)
        {
            try
            {
                // 首先獲取工作流執行記錄以獲取工作流定義ID
                var workflowExecution = await _context.WorkflowExecutions
                    .FirstOrDefaultAsync(we => we.Id == workflowExecutionId);

                if (workflowExecution == null)
                {
                    return new List<ProcessVariableInstanceValue>();
                }

                // 獲取所有變量定義
                var variableDefinitions = await _context.ProcessVariableDefinitions
                    .Where(pvd => pvd.WorkflowDefinitionId == workflowExecution.WorkflowDefinitionId)
                    .ToListAsync();

                // 獲取所有變量值
                var variableValues = await _context.ProcessVariableValues
                    .Where(pvv => pvv.WorkflowExecutionId == workflowExecutionId)
                    .ToListAsync();

                // 創建變量值字典以便快速查找
                var valueDict = variableValues.ToDictionary(v => v.VariableName, v => v);

                // 合併定義和值
                var result = new List<ProcessVariableInstanceValue>();

                foreach (var definition in variableDefinitions)
                {
                    var instanceValue = new ProcessVariableInstanceValue
                    {
                        VariableName = definition.VariableName,
                        DisplayName = definition.DisplayName,
                        DataType = definition.DataType,
                        Description = definition.Description,
                        IsRequired = definition.IsRequired,
                        DefaultValue = definition.DefaultValue
                    };

                    // 如果有對應的值，則設置值相關信息
                    if (valueDict.TryGetValue(definition.VariableName, out var value))
                    {
                        instanceValue.Value = value.GetValue();
                        instanceValue.SetAt = value.SetAt;
                        instanceValue.SetBy = value.SetBy;
                        instanceValue.SourceType = value.SourceType;
                        instanceValue.SourceReference = value.SourceReference;
                    }

                    result.Add(instanceValue);
                }

                return result.OrderBy(r => r.VariableName);
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取流程變量實例值失敗: {ex.Message}", ex);
                throw;
            }
        }

        #endregion
    }
}
