using Microsoft.EntityFrameworkCore;
using PurpleRice.Data;
using PurpleRice.Models;
using PurpleRice.Models.DTOs;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;

namespace PurpleRice.Services
{
    public class DataSetQueryService
    {
        private readonly PurpleRiceDbContext _context;
        private readonly LoggingService _loggingService;
        private readonly IConfiguration _configuration;

        public DataSetQueryService(PurpleRiceDbContext context, Func<string, LoggingService> loggingServiceFactory, IConfiguration configuration)
        {
            _context = context;
            _loggingService = loggingServiceFactory("DataSetQueryService");
            _configuration = configuration;
        }

        public async Task<DataSetQueryResult> ExecuteDataSetQueryAsync(
            int workflowExecutionId,
            int stepExecutionId,
            DataSetQueryRequest request)
        {
            try
            {
                _loggingService.LogInformation($"開始執行 DataSet 查詢，DataSet ID: {request.DataSetId}, 操作類型: {request.OperationType}");

                // 1. 獲取 DataSet 信息
                var dataSet = await _context.DataSets
                    .Include(ds => ds.Columns)
                    .Include(ds => ds.DataSources)
                    .FirstOrDefaultAsync(ds => ds.Id == request.DataSetId);

                if (dataSet == null)
                {
                    throw new Exception($"DataSet 不存在: {request.DataSetId}");
                }

                // 2. 替換查詢條件中的流程變量
                _loggingService.LogInformation($"處理前查詢條件組數量: {request.QueryConditionGroups.Count}");
                foreach (var group in request.QueryConditionGroups)
                {
                    _loggingService.LogInformation($"查詢條件組: {JsonSerializer.Serialize(group)}");
                    _loggingService.LogInformation($"條件組 ID: {group.Id}, Relation: {group.Relation}, Conditions 數量: {group.Conditions.Count}");
                    foreach (var condition in group.Conditions)
                    {
                        _loggingService.LogInformation($"條件: Id={condition.Id}, FieldName={condition.FieldName}, Operator={condition.Operator}, Value={condition.Value}");
                    }
                }
                
                var processedConditionGroups = ProcessQueryConditions(request.QueryConditionGroups, request.ProcessVariableValues);
                
                _loggingService.LogInformation($"處理後查詢條件組數量: {processedConditionGroups.Count}");
                foreach (var group in processedConditionGroups)
                {
                    _loggingService.LogInformation($"處理後查詢條件組: {JsonSerializer.Serialize(group)}");
                }

                // 3. 根據操作類型執行相應的邏輯
                var result = request.OperationType.ToUpper() switch
                {
                    "SELECT" => await ExecuteSelectQuery(dataSet, processedConditionGroups, request),
                    "INSERT" => await ExecuteInsertQuery(dataSet, request),
                    "UPDATE" => await ExecuteUpdateQuery(dataSet, processedConditionGroups, request),
                    "DELETE" => await ExecuteDeleteQuery(dataSet, processedConditionGroups, request),
                    _ => throw new Exception($"不支持的操作類型: {request.OperationType}")
                };

                // 4. 保存查詢結果到數據庫
                var queryResult = new WorkflowDataSetQueryResult
                {
                    WorkflowExecutionId = workflowExecutionId,
                    StepExecutionId = stepExecutionId,
                    DataSetId = request.DataSetId,
                    OperationType = request.OperationType,
                    QueryConditions = JsonSerializer.Serialize(processedConditionGroups),
                    QueryResult = JsonSerializer.Serialize(result.Data),
                    MappedFields = JsonSerializer.Serialize(request.MappedFields),
                    ProcessVariablesUsed = JsonSerializer.Serialize(request.ProcessVariableValues),
                    Status = result.Success ? "Success" : "Failed",
                    ErrorMessage = result.Success ? null : result.Message,
                    TotalRecords = result.TotalCount,
                    RecordsProcessed = result.Data.Count
                };

                _context.WorkflowDataSetQueryResults.Add(queryResult);
                await _context.SaveChangesAsync();

                result.QueryResultId = queryResult.Id;

                // 5. 處理欄位映射到流程變量（無論是否有映射都要創建記錄關聯）
                if (result.Success)
                {
                    await ProcessFieldMappings(queryResult.Id, result.Data, request.MappedFields, workflowExecutionId);
                }

                _loggingService.LogInformation($"DataSet 查詢執行完成，結果 ID: {queryResult.Id}");
                return result;
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"DataSet 查詢執行失敗: {ex.Message}", ex);
                return new DataSetQueryResult
                {
                    Success = false,
                    Message = ex.Message
                };
            }
        }

        private List<QueryConditionGroup> ProcessQueryConditions(
            List<QueryConditionGroup> conditionGroups, 
            Dictionary<string, object> processVariables)
        {
            return conditionGroups.Select(group => new QueryConditionGroup
            {
                Id = group.Id,
                Relation = group.Relation,
                Conditions = group.Conditions.Select(condition => new QueryCondition
                {
                    Id = condition.Id,
                    FieldName = condition.FieldName,
                    Operator = condition.Operator,
                    Value = ReplaceProcessVariables(condition.Value, processVariables),
                    Label = condition.Label
                }).ToList()
            }).ToList();
        }

        private string ReplaceProcessVariables(string value, Dictionary<string, object> processVariables)
        {
            return Regex.Replace(value, @"\$\{([^}]+)\}", match =>
            {
                var variableName = match.Groups[1].Value;
                return processVariables.ContainsKey(variableName) 
                    ? processVariables[variableName]?.ToString() ?? match.Value
                    : match.Value;
            });
        }

        private async Task<DataSetQueryResult> ExecuteSelectQuery(DataSet dataSet, List<QueryConditionGroup> conditionGroups, DataSetQueryRequest request)
        {
            try
            {
                _loggingService.LogInformation($"開始執行 SELECT 查詢: {dataSet.Name} (ID: {dataSet.Id})");
                _loggingService.LogInformation($"查詢條件組數量: {conditionGroups.Count}");
                _loggingService.LogInformation($"欄位映射數量: {request.MappedFields.Count}");

                List<Dictionary<string, object>> results;

                // 檢查是否有外部數據源
                var dataSource = dataSet.DataSources?.FirstOrDefault();
                
                if (dataSource != null && (dataSource.SourceType == "Database" || dataSource.SourceType == "SQL"))
                {
                    _loggingService.LogInformation($"使用外部數據源查詢: {dataSource.SourceType}");
                    
                    // 生成 WHERE 子句
                    var whereClause = GenerateWhereClause(conditionGroups);
                    _loggingService.LogInformation($"生成的 WHERE 子句: {whereClause}");
                    
                    // 查詢外部數據庫
                    results = await ExecuteDatabaseQuery(dataSource, whereClause, 1000);
                    _loggingService.LogInformation($"外部數據庫查詢成功，找到 {results.Count} 條記錄");
                }
                else if (dataSource != null && dataSource.SourceType == "Excel")
                {
                    _loggingService.LogInformation($"使用 Excel 數據源查詢");
                    
                    // 生成 WHERE 子句
                    var whereClause = GenerateWhereClause(conditionGroups);
                    
                    // 查詢 Excel（目前未實現，使用內部記錄）
                    results = await ExecuteExcelQuery(dataSource, whereClause);
                    _loggingService.LogInformation($"Excel 查詢成功，找到 {results.Count} 條記錄");
                }
                else
                {
                    _loggingService.LogInformation($"使用內部 DataSet 記錄查詢");
                    
                    // 1. 查詢 data_set_records 表
                    var records = await _context.DataSetRecords
                        .Where(r => r.DataSetId == dataSet.Id)
                        .Include(r => r.Values)
                        .ToListAsync();

                    _loggingService.LogInformation($"找到 {records.Count} 條 DataSet 記錄");

                    // 2. 根據條件過濾記錄
                    var filteredRecords = FilterRecordsByConditions(records, conditionGroups);
                    _loggingService.LogInformation($"條件過濾後剩餘 {filteredRecords.Count} 條記錄");

                    // 3. 轉換為結果格式
                    results = ConvertRecordsToResultFormat(filteredRecords);
                    _loggingService.LogInformation($"轉換為結果格式，共 {results.Count} 條記錄");
                }

                return new DataSetQueryResult
                {
                    Success = true,
                    Data = results,
                    TotalCount = results.Count,
                    DataSetName = dataSet.Name,
                    Message = $"查詢成功，找到 {results.Count} 條記錄"
                };
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"執行 SELECT 查詢失敗: {ex.Message}", ex);
                return new DataSetQueryResult
                {
                    Success = false,
                    Message = $"SELECT 查詢失敗: {ex.Message}"
                };
            }
        }

        private async Task<DataSetQueryResult> ExecuteInsertQuery(DataSet dataSet, DataSetQueryRequest request)
        {
            // TODO: 實現 INSERT 邏輯
            return new DataSetQueryResult
            {
                Success = false,
                Message = "INSERT 操作尚未實現"
            };
        }

        private async Task<DataSetQueryResult> ExecuteUpdateQuery(DataSet dataSet, List<QueryConditionGroup> conditionGroups, DataSetQueryRequest request)
        {
            // TODO: 實現 UPDATE 邏輯
            return new DataSetQueryResult
            {
                Success = false,
                Message = "UPDATE 操作尚未實現"
            };
        }

        private async Task<DataSetQueryResult> ExecuteDeleteQuery(DataSet dataSet, List<QueryConditionGroup> conditionGroups, DataSetQueryRequest request)
        {
            // TODO: 實現 DELETE 邏輯
            return new DataSetQueryResult
            {
                Success = false,
                Message = "DELETE 操作尚未實現"
            };
        }

        private string GenerateWhereClause(List<QueryConditionGroup> conditionGroups)
        {
            if (!conditionGroups.Any())
                return string.Empty;

            var groupClauses = conditionGroups.Select(group =>
            {
                if (!group.Conditions.Any())
                    return string.Empty;

                var groupConditions = group.Conditions.Select(condition =>
                {
                    var safeFieldName = $"[{condition.FieldName}]";
                    var rawValue = condition.Value?.ToString() ?? "";
                    var safeValue = rawValue.Replace("'", "''");
                    
                    // ✅ 修復：總是加引號，讓 SQL Server 自動處理類型轉換
                    // 這樣可以避免 "converting nvarchar to int" 錯誤
                    string conditionClause = condition.Operator.ToLower() switch
                    {
                        "equals" => $"{safeFieldName} = '{safeValue}'",
                        "notequals" => $"{safeFieldName} != '{safeValue}'",
                        "greaterthan" => $"{safeFieldName} > '{safeValue}'",
                        "lessthan" => $"{safeFieldName} < '{safeValue}'",
                        "greaterthanorequal" => $"{safeFieldName} >= '{safeValue}'",
                        "lessthanorequal" => $"{safeFieldName} <= '{safeValue}'",
                        "contains" => $"{safeFieldName} LIKE '%{safeValue}%'",
                        "startswith" => $"{safeFieldName} LIKE '{safeValue}%'",
                        "endswith" => $"{safeFieldName} LIKE '%{safeValue}'",
                        "isempty" => $"({safeFieldName} IS NULL OR {safeFieldName} = '')",
                        "isnotempty" => $"({safeFieldName} IS NOT NULL AND {safeFieldName} != '')",
                        "in" => $"{safeFieldName} IN ({string.Join(", ", safeValue.Split(',').Select(v => $"'{v.Trim()}'"))})",
                        "notin" => $"{safeFieldName} NOT IN ({string.Join(", ", safeValue.Split(',').Select(v => $"'{v.Trim()}'"))})",
                        _ => $"{safeFieldName} = '{safeValue}'"
                    };
                    
                    _loggingService.LogInformation($"生成條件: {conditionClause}");
                    return conditionClause;
                });

                var relation = group.Relation.ToUpper();
                var groupClause = $"({string.Join($" {relation} ", groupConditions)})";
                _loggingService.LogInformation($"條件組: {groupClause}");
                return groupClause;
            }).Where(c => !string.IsNullOrEmpty(c));

            var finalWhereClause = string.Join(" AND ", groupClauses);
            _loggingService.LogInformation($"最終 WHERE 子句: {finalWhereClause}");
            return finalWhereClause;
        }

        private async Task<List<Dictionary<string, object>>> ExecuteDatabaseQuery(DataSetDataSource dataSource, string whereClause, int limit = 1000)
        {
            var results = new List<Dictionary<string, object>>();

            try
            {
                var baseQuery = dataSource.SqlQuery;
                if (string.IsNullOrEmpty(baseQuery))
                {
                    throw new Exception("數據源沒有配置 SQL 查詢");
                }

                var fullQuery = baseQuery;
                if (!string.IsNullOrEmpty(whereClause))
                {
                    if (baseQuery.ToUpper().Contains("WHERE"))
                    {
                        fullQuery += $" AND ({whereClause})";
                    }
                    else
                    {
                        fullQuery += $" WHERE {whereClause}";
                    }
                }

                // 添加 TOP 限制
                var upperQuery = fullQuery.ToUpper();
                if (!upperQuery.Contains(" TOP "))
                {
                    var selectIndex = fullQuery.IndexOf("SELECT", StringComparison.OrdinalIgnoreCase);
                    if (selectIndex >= 0)
                    {
                        var afterSelectIndex = selectIndex + 6;
                        while (afterSelectIndex < fullQuery.Length && char.IsWhiteSpace(fullQuery[afterSelectIndex]))
                        {
                            afterSelectIndex++;
                        }
                        fullQuery = fullQuery.Substring(0, afterSelectIndex) + $"TOP {limit} " + fullQuery.Substring(afterSelectIndex);
                    }
                }

                _loggingService.LogInformation($"執行數據庫查詢: {fullQuery}");

                // 獲取連接字符串
                string connectionString = GetConnectionString(dataSource);

                using var connection = new SqlConnection(connectionString);
                await connection.OpenAsync();
                using var command = new SqlCommand(fullQuery, connection);
                using var reader = await command.ExecuteReaderAsync();

                while (await reader.ReadAsync())
                {
                    var row = new Dictionary<string, object>();
                    for (int i = 0; i < reader.FieldCount; i++)
                    {
                        var columnName = reader.GetName(i);
                        var value = reader.IsDBNull(i) ? null : reader.GetValue(i);
                        row[columnName] = value;
                    }
                    results.Add(row);
                }
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"執行數據庫查詢失敗: {ex.Message}", ex);
                throw;
            }

            return results;
        }

        private async Task<List<Dictionary<string, object>>> ExecuteExcelQuery(DataSetDataSource dataSource, string whereClause)
        {
            // TODO: 實現 Excel 查詢邏輯
            return new List<Dictionary<string, object>>();
        }

        private string GetConnectionString(DataSetDataSource dataSource)
        {
            if (!string.IsNullOrEmpty(dataSource.AuthenticationConfig))
            {
                try
                {
                    var config = JsonSerializer.Deserialize<SqlConnectionConfig>(dataSource.AuthenticationConfig);
                    if (config?.ConnectionType == "preset")
                    {
                        return GetPresetConnectionString(config.PresetName);
                    }
                    else if (config?.ConnectionType == "custom")
                    {
                        return BuildCustomConnectionString(config);
                    }
                }
                catch (Exception ex)
                {
                    _loggingService.LogError($"解析連接配置失敗: {ex.Message}");
                }
            }

            return GetPresetConnectionString(dataSource.DatabaseConnection);
        }

        private string GetPresetConnectionString(string presetName)
        {
            try
            {
                // 從配置文件讀取連接字符串
                var connectionString = _configuration.GetConnectionString(presetName);
                
                if (!string.IsNullOrEmpty(connectionString))
                {
                    _loggingService.LogInformation($"使用預設連接: {presetName}");
                    return connectionString;
                }
                
                // 如果找不到指定的預設名稱，嘗試使用 ErpDatabase 作為默認值
                _loggingService.LogWarning($"找不到預設連接 '{presetName}'，使用 ErpDatabase 作為默認值");
                connectionString = _configuration.GetConnectionString("ErpDatabase");
                
                if (!string.IsNullOrEmpty(connectionString))
                {
                    return connectionString;
                }
                
                // 如果還是找不到，返回硬編碼的默認值
                _loggingService.LogWarning($"無法從配置文件獲取連接字符串，使用硬編碼默認值");
                return "Server=127.0.0.1;Database=erp_awh;User Id=sa;Password=sql!Q@W3e;TrustServerCertificate=true;";
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取預設連接字符串失敗: {ex.Message}", ex);
                return "Server=127.0.0.1;Database=erp_awh;User Id=sa;Password=sql!Q@W3e;TrustServerCertificate=true;";
            }
        }

        private string BuildCustomConnectionString(SqlConnectionConfig config)
        {
            try
            {
                // 構建自定義連接字符串
                var builder = new SqlConnectionStringBuilder
                {
                    DataSource = config.ServerName,
                    InitialCatalog = config.DatabaseName,
                    UserID = config.UserName,
                    Password = config.Password,
                    TrustServerCertificate = true,
                    Encrypt = false
                };
                
                var connectionString = builder.ConnectionString;
                _loggingService.LogInformation($"構建自定義連接字符串: Server={config.ServerName}, Database={config.DatabaseName}");
                
                return connectionString;
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"構建自定義連接字符串失敗: {ex.Message}", ex);
                throw new Exception($"無法構建數據庫連接字符串: {ex.Message}");
            }
        }

        private async Task ProcessFieldMappings(
            Guid queryResultId, 
            List<Dictionary<string, object>> queryData, 
            List<FieldMapping> mappedFields, 
            int workflowExecutionId)
        {
            try
            {
                _loggingService.LogInformation($"開始處理欄位映射，查詢結果 ID: {queryResultId}，記錄數量: {queryData.Count}，映射欄位數量: {mappedFields.Count}");
                
                // 如果沒有映射欄位，只創建記錄關聯
                if (mappedFields.Count == 0)
                {
                    _loggingService.LogInformation("沒有配置欄位映射，跳過流程變量寫入");
                    foreach (var record in queryData)
                    {
                        // 只有內部 DataSet 記錄才有 __record_id
                        Guid? recordId = record.ContainsKey("__record_id") ? (Guid)record["__record_id"] : null;
                        var queryRecord = new WorkflowDataSetQueryRecord
                        {
                            QueryResultId = queryResultId,
                            DataSetRecordId = recordId, // 可以為 null（外部數據源）
                            RecordPrimaryKey = record.ContainsKey("__primary_key") ? record["__primary_key"]?.ToString() : string.Empty,
                            RecordStatus = record.ContainsKey("__status") ? record["__status"]?.ToString() : string.Empty,
                            MappedVariableName = string.Empty,
                            MappedVariableValue = string.Empty
                        };
                        _context.WorkflowDataSetQueryRecords.Add(queryRecord);
                    }
                    await _context.SaveChangesAsync();
                    return;
                }
                
                // 處理欄位映射 - 策略：只映射第一條記錄的值到流程變量
                // 這是最常見的場景，因為通常我們只需要一條記錄的值
                if (queryData.Count > 0)
                {
                    var firstRecord = queryData[0];
                    _loggingService.LogInformation($"使用第一條記錄進行欄位映射（共 {queryData.Count} 條記錄）");
                    
                    foreach (var mapping in mappedFields)
                    {
                        if (firstRecord.ContainsKey(mapping.FieldName))
                        {
                            var value = firstRecord[mapping.FieldName];
                            _loggingService.LogInformation($"映射欄位: {mapping.FieldName} → {mapping.VariableName} = {value}");
                            
                            // 保存到流程變量
                            await SaveProcessVariable(workflowExecutionId, mapping.VariableName, mapping.DataType, value);
                        }
                        else
                        {
                            _loggingService.LogWarning($"記錄中找不到欄位: {mapping.FieldName}");
                        }
                    }
                }
                
                // 為所有記錄創建關聯記錄（用於審計和追蹤）
                int recordIndex = 0;
                foreach (var record in queryData)
                {
                    // 只有當記錄來自 data_set_records 表時才有 __record_id
                    Guid? recordId = record.ContainsKey("__record_id") ? (Guid)record["__record_id"] : null;
                    
                    // 收集這條記錄的所有映射信息
                    var mappedVariables = new List<string>();
                    var mappedValues = new List<string>();
                    
                    foreach (var mapping in mappedFields)
                    {
                        if (record.ContainsKey(mapping.FieldName))
                        {
                            mappedVariables.Add(mapping.VariableName);
                            mappedValues.Add(record[mapping.FieldName]?.ToString() ?? "");
                        }
                    }
                    
                    var queryRecord = new WorkflowDataSetQueryRecord
                    {
                        QueryResultId = queryResultId,
                        DataSetRecordId = recordId, // 可以為 null（外部數據源）
                        RecordPrimaryKey = record.ContainsKey("__primary_key") ? record["__primary_key"]?.ToString() : string.Empty,
                        RecordStatus = record.ContainsKey("__status") ? record["__status"]?.ToString() : string.Empty,
                        MappedVariableName = string.Join(", ", mappedVariables),
                        MappedVariableValue = string.Join(", ", mappedValues)
                    };
                    
                    _context.WorkflowDataSetQueryRecords.Add(queryRecord);
                    
                    _loggingService.LogInformation($"記錄 {recordIndex + 1}: DataSetRecordId={recordId}, 映射變量={queryRecord.MappedVariableName}, 值={queryRecord.MappedVariableValue}");
                    recordIndex++;
                }
                
                await _context.SaveChangesAsync();
                _loggingService.LogInformation($"欄位映射處理完成，共創建 {queryData.Count} 條記錄關聯，寫入 {mappedFields.Count} 個流程變量");
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"處理欄位映射失敗: {ex.Message}", ex);
                throw;
            }
        }

        private async Task SaveProcessVariable(int workflowExecutionId, string variableName, string dataType, object value)
        {
            try
            {
                var existingVariable = await _context.ProcessVariableValues
                    .FirstOrDefaultAsync(pv => pv.WorkflowExecutionId == workflowExecutionId && pv.VariableName == variableName);

                if (existingVariable != null)
                {
                    existingVariable.SetValue(value);
                    existingVariable.SetAt = DateTime.UtcNow;
                    existingVariable.SourceType = "DataSetQuery";
                }
                else
                {
                    var newVariable = new ProcessVariableValue
                    {
                        WorkflowExecutionId = workflowExecutionId,
                        VariableName = variableName,
                        DataType = dataType,
                        SourceType = "DataSetQuery"
                    };
                    newVariable.SetValue(value);
                    
                    _context.ProcessVariableValues.Add(newVariable);
                }
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"保存流程變量失敗: {ex.Message}", ex);
            }
        }

        private List<DataSetRecord> FilterRecordsByConditions(List<DataSetRecord> records, List<QueryConditionGroup> conditionGroups)
        {
            if (!conditionGroups.Any())
                return records;

            return records.Where(record =>
            {
                foreach (var group in conditionGroups)
                {
                    var groupResult = group.Relation.ToUpper() == "OR" ? false : true;
                    
                    foreach (var condition in group.Conditions)
                    {
                        var recordValue = GetRecordValue(record, condition.FieldName);
                        var conditionResult = EvaluateCondition(recordValue, condition.Operator, condition.Value);
                        
                        if (group.Relation.ToUpper() == "OR")
                        {
                            groupResult = groupResult || conditionResult;
                        }
                        else
                        {
                            groupResult = groupResult && conditionResult;
                        }
                    }
                    
                    if (!groupResult)
                        return false;
                }
                
                return true;
            }).ToList();
        }

        private string GetRecordValue(DataSetRecord record, string fieldName)
        {
            var value = record.Values.FirstOrDefault(v => v.ColumnName == fieldName);
            if (value == null)
                return string.Empty;

            // 根據數據類型返回對應的值
            if (value.StringValue != null)
                return value.StringValue;
            if (value.NumericValue.HasValue)
                return value.NumericValue.Value.ToString();
            if (value.DateValue.HasValue)
                return value.DateValue.Value.ToString("yyyy-MM-dd HH:mm:ss");
            if (value.BooleanValue.HasValue)
                return value.BooleanValue.Value.ToString();
            if (value.TextValue != null)
                return value.TextValue;

            return string.Empty;
        }

        private bool EvaluateCondition(string recordValue, string operatorType, string conditionValue)
        {
            return operatorType.ToLower() switch
            {
                "equals" => recordValue.Equals(conditionValue, StringComparison.OrdinalIgnoreCase),
                "notEquals" => !recordValue.Equals(conditionValue, StringComparison.OrdinalIgnoreCase),
                "contains" => recordValue.Contains(conditionValue, StringComparison.OrdinalIgnoreCase),
                "startsWith" => recordValue.StartsWith(conditionValue, StringComparison.OrdinalIgnoreCase),
                "endsWith" => recordValue.EndsWith(conditionValue, StringComparison.OrdinalIgnoreCase),
                "isEmpty" => string.IsNullOrEmpty(recordValue),
                "isNotEmpty" => !string.IsNullOrEmpty(recordValue),
                "greaterThan" => CompareValues(recordValue, conditionValue) > 0,
                "lessThan" => CompareValues(recordValue, conditionValue) < 0,
                "greaterThanOrEqual" => CompareValues(recordValue, conditionValue) >= 0,
                "lessThanOrEqual" => CompareValues(recordValue, conditionValue) <= 0,
                "in" => conditionValue.Split(',').Any(v => recordValue.Equals(v.Trim(), StringComparison.OrdinalIgnoreCase)),
                "notIn" => !conditionValue.Split(',').Any(v => recordValue.Equals(v.Trim(), StringComparison.OrdinalIgnoreCase)),
                _ => recordValue.Equals(conditionValue, StringComparison.OrdinalIgnoreCase)
            };
        }

        private int CompareValues(string value1, string value2)
        {
            // 嘗試數字比較
            if (decimal.TryParse(value1, out var num1) && decimal.TryParse(value2, out var num2))
            {
                return num1.CompareTo(num2);
            }
            
            // 嘗試日期比較
            if (DateTime.TryParse(value1, out var date1) && DateTime.TryParse(value2, out var date2))
            {
                return date1.CompareTo(date2);
            }
            
            // 字串比較
            return string.Compare(value1, value2, StringComparison.OrdinalIgnoreCase);
        }

        private List<Dictionary<string, object>> ConvertRecordsToResultFormat(List<DataSetRecord> records)
        {
            var results = new List<Dictionary<string, object>>();
            
            foreach (var record in records)
            {
                var result = new Dictionary<string, object>
                {
                    ["__record_id"] = record.Id,
                    ["__primary_key"] = record.PrimaryKeyValue ?? string.Empty,
                    ["__status"] = record.Status ?? string.Empty,
                    ["__created_at"] = record.CreatedAt,
                    ["__updated_at"] = record.UpdatedAt
                };
                
                // 添加所有欄位值
                foreach (var value in record.Values)
                {
                    object fieldValue = value.StringValue ?? 
                                      (value.NumericValue?.ToString()) ?? 
                                      (value.DateValue?.ToString()) ?? 
                                      (value.BooleanValue?.ToString()) ?? 
                                      value.TextValue ?? 
                                      string.Empty;
                    
                    result[value.ColumnName] = fieldValue;
                }
                
                results.Add(result);
            }
            
            return results;
        }
    }

    public class SqlConnectionConfig
    {
        public string ConnectionType { get; set; } = string.Empty;
        public string PresetName { get; set; } = string.Empty;
        public string ServerName { get; set; } = string.Empty;
        public string DatabaseName { get; set; } = string.Empty;
        public string UserName { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
    }
}
