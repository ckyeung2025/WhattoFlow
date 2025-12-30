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
            DataSetQueryRequest request,
            bool skipSave = false)
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

                // 4. 保存查詢結果到數據庫（測試操作時跳過）
                if (!skipSave && workflowExecutionId > 0)
                {
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
                }
                else
                {
                    _loggingService.LogInformation($"DataSet 查詢完成（測試模式，跳過保存）");
                }
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

                // ✅ 修復：始終使用內部同步後的表查詢，不查詢外部數據源
                // 這樣可以避免連接外部數據庫的問題，提高查詢速度和穩定性
                _loggingService.LogInformation($"使用內部 DataSet 記錄查詢（data_set_records 和 data_set_record_values）");
                
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
            try
            {
                _loggingService.LogInformation($"開始執行 INSERT 操作: {dataSet.Name} (ID: {dataSet.Id})");
                _loggingService.LogInformation($"操作數據字段數量: {request.OperationDataFields.Count}");

                if (request.OperationDataFields.Count == 0)
                {
                    return new DataSetQueryResult
                    {
                        Success = false,
                        Message = "INSERT 操作需要至少一個操作數據字段"
                    };
                }

                // 檢查是否有 JSON 數組類型的 PV（需要為數組中的每個元素創建記錄）
                var jsonArrayInfo = DetectJsonArrayInOperationData(request.OperationDataFields, request.ProcessVariableValues);
                
                if (jsonArrayInfo != null && jsonArrayInfo.ArrayLength > 0)
                {
                    _loggingService.LogInformation($"檢測到 JSON 數組 PV: {jsonArrayInfo.VariableName}, 數組長度: {jsonArrayInfo.ArrayLength}，將為每個元素創建記錄");
                    return await ExecuteInsertForJsonArray(dataSet, request, jsonArrayInfo);
                }
                else
                {
                    // 普通情況：只創建一條記錄
                    return await ExecuteInsertSingleRecord(dataSet, request);
                }
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"執行 INSERT 操作失敗: {ex.Message}", ex);
                return new DataSetQueryResult
                {
                    Success = false,
                    Message = $"INSERT 操作失敗: {ex.Message}"
                };
            }
        }

        /// <summary>
        /// 檢測操作數據中是否有 JSON 數組類型的 PV
        /// </summary>
        private JsonArrayInfo? DetectJsonArrayInOperationData(
            List<OperationDataField> operationDataFields, 
            Dictionary<string, object> processVariables)
        {
            if (operationDataFields.Count == 0)
                return null;

            // 檢查第一個有 jsonKey 的字段
            var firstFieldWithJsonKey = operationDataFields.FirstOrDefault(f => !string.IsNullOrEmpty(f.JsonKey));
            if (firstFieldWithJsonKey == null)
                return null;

            try
            {
                var match = Regex.Match(firstFieldWithJsonKey.Value, @"\$\{([^}]+)\}");
                if (!match.Success)
                    return null;

                var variableName = match.Groups[1].Value;
                if (!processVariables.ContainsKey(variableName))
                    return null;

                var variableValue = processVariables[variableName];
                JsonElement rootElement;

                if (variableValue is JsonElement jsonElement)
                {
                    rootElement = jsonElement;
                }
                else if (variableValue is string jsonString)
                {
                    var jsonDoc = JsonDocument.Parse(jsonString);
                    rootElement = jsonDoc.RootElement;
                }
                else
                {
                    return null;
                }

                if (rootElement.ValueKind == System.Text.Json.JsonValueKind.Array)
                {
                    return new JsonArrayInfo
                    {
                        VariableName = variableName,
                        ArrayElement = rootElement,
                        ArrayLength = rootElement.GetArrayLength()
                    };
                }
            }
            catch (Exception ex)
            {
                _loggingService.LogWarning($"檢測 JSON 數組時發生錯誤: {ex.Message}");
            }

            return null;
        }

        /// <summary>
        /// 為 JSON 數組中的每個元素創建記錄
        /// </summary>
        private async Task<DataSetQueryResult> ExecuteInsertForJsonArray(
            DataSet dataSet, 
            DataSetQueryRequest request, 
            JsonArrayInfo jsonArrayInfo)
        {
            var createdRecords = new List<DataSetRecord>();
            var resultData = new List<Dictionary<string, object>>();

            _loggingService.LogInformation($"開始為 JSON 數組創建記錄，數組長度: {jsonArrayInfo.ArrayLength}");

            // 遍歷數組中的每個元素
            for (int arrayIndex = 0; arrayIndex < jsonArrayInfo.ArrayLength; arrayIndex++)
            {
                _loggingService.LogInformation($"處理數組元素 {arrayIndex + 1}/{jsonArrayInfo.ArrayLength}");

                // 創建新的 DataSet 記錄
                var newRecord = new DataSetRecord
                {
                    Id = Guid.NewGuid(),
                    DataSetId = dataSet.Id,
                    CreatedAt = DateTime.UtcNow,
                    Status = "Active"
                };

                // 處理每個操作數據字段
                foreach (var field in request.OperationDataFields)
                {
                    _loggingService.LogInformation($"處理字段配置 [數組索引 {arrayIndex}]: Name={field.Name}, Value={field.Value}, JsonKey={field.JsonKey ?? "null"}");
                    
                    if (string.IsNullOrEmpty(field.Name))
                    {
                        _loggingService.LogWarning($"跳過空欄位名稱的字段");
                        continue;
                    }

                    // 獲取欄位定義
                    var column = dataSet.Columns.FirstOrDefault(c => c.ColumnName == field.Name);
                    if (column == null)
                    {
                        _loggingService.LogWarning($"找不到欄位定義: {field.Name}");
                        continue;
                    }
                    
                    _loggingService.LogInformation($"欄位定義: ColumnName={column.ColumnName}, DataType={column.DataType}, DisplayName={column.DisplayName ?? "N/A"}");

                    // 從流程變量中獲取值（支持 JSON PV 2級 mapping，並指定數組索引）
                    _loggingService.LogInformation($"開始從流程變量獲取值 [數組索引 {arrayIndex}]: VariableReference={field.Value}, JsonKey={field.JsonKey ?? "null"}");
                    var fieldValue = GetFieldValueFromProcessVariableWithArrayIndex(
                        field.Value, 
                        field.JsonKey, 
                        request.ProcessVariableValues, 
                        column.DataType,
                        arrayIndex);
                    
                    if (fieldValue == null)
                    {
                        _loggingService.LogWarning($"無法從流程變量獲取欄位值 [數組索引 {arrayIndex}]: {field.Name}");
                        continue;
                    }
                    
                    _loggingService.LogInformation($"成功獲取欄位值 [數組索引 {arrayIndex}]: {field.Name} = {fieldValue} (原始類型: {fieldValue.GetType().Name})");

                    // 創建欄位值記錄
                    var recordValue = new DataSetRecordValue
                    {
                        Id = Guid.NewGuid(),
                        RecordId = newRecord.Id,
                        ColumnName = field.Name
                    };

                    // 根據欄位數據類型設置值
                    var beforeValue = GetRecordValueString(recordValue);
                    SetRecordValueByDataType(recordValue, fieldValue, column.DataType);
                    var afterValue = GetRecordValueString(recordValue);
                    
                    newRecord.Values.Add(recordValue);
                    _loggingService.LogInformation($"設置欄位 [數組索引 {arrayIndex}] {field.Name}: 轉換前={beforeValue}, 轉換後={afterValue}, 目標類型={column.DataType}");
                }

                // 保存記錄
                _loggingService.LogInformation($"準備保存記錄 [數組索引 {arrayIndex}]: RecordId={newRecord.Id}, DataSetId={newRecord.DataSetId}, ValuesCount={newRecord.Values.Count}");
                _context.DataSetRecords.Add(newRecord);
                createdRecords.Add(newRecord);

                // 構建返回結果
                var resultRecord = new Dictionary<string, object>
                {
                    ["__record_id"] = newRecord.Id,
                    ["__primary_key"] = newRecord.PrimaryKeyValue ?? string.Empty,
                    ["__status"] = newRecord.Status ?? string.Empty,
                    ["__created_at"] = newRecord.CreatedAt
                };

                foreach (var value in newRecord.Values)
                {
                    object val = value.StringValue ?? 
                                (value.NumericValue?.ToString()) ?? 
                                (value.DateValue?.ToString()) ?? 
                                (value.BooleanValue?.ToString()) ?? 
                                value.TextValue ?? 
                                string.Empty;
                    resultRecord[value.ColumnName] = val;
                }

                resultData.Add(resultRecord);
            }

            // 批量保存所有記錄
            await _context.SaveChangesAsync();

            _loggingService.LogInformation($"INSERT 操作成功，為 JSON 數組創建了 {createdRecords.Count} 條記錄");

            return new DataSetQueryResult
            {
                Success = true,
                Data = resultData,
                TotalCount = createdRecords.Count,
                DataSetName = dataSet.Name,
                Message = $"INSERT 操作成功，創建了 {createdRecords.Count} 條記錄"
            };
        }

        /// <summary>
        /// 創建單條記錄（普通情況）
        /// </summary>
        private async Task<DataSetQueryResult> ExecuteInsertSingleRecord(DataSet dataSet, DataSetQueryRequest request)
        {
            // 創建新的 DataSet 記錄
            var newRecord = new DataSetRecord
            {
                Id = Guid.NewGuid(),
                DataSetId = dataSet.Id,
                CreatedAt = DateTime.UtcNow,
                Status = "Active"
            };

            // 處理每個操作數據字段
            foreach (var field in request.OperationDataFields)
            {
                _loggingService.LogInformation($"處理字段配置: Name={field.Name}, Value={field.Value}, JsonKey={field.JsonKey ?? "null"}");
                
                if (string.IsNullOrEmpty(field.Name))
                {
                    _loggingService.LogWarning($"跳過空欄位名稱的字段");
                    continue;
                }

                // 獲取欄位定義
                var column = dataSet.Columns.FirstOrDefault(c => c.ColumnName == field.Name);
                if (column == null)
                {
                    _loggingService.LogWarning($"找不到欄位定義: {field.Name}");
                    continue;
                }
                
                _loggingService.LogInformation($"欄位定義: ColumnName={column.ColumnName}, DataType={column.DataType}, DisplayName={column.DisplayName ?? "N/A"}");

                // 從流程變量中獲取值（支持 JSON PV 2級 mapping）
                _loggingService.LogInformation($"開始從流程變量獲取值: VariableReference={field.Value}, JsonKey={field.JsonKey ?? "null"}");
                var fieldValue = GetFieldValueFromProcessVariable(field.Value, field.JsonKey, request.ProcessVariableValues, column.DataType);
                
                if (fieldValue == null)
                {
                    _loggingService.LogWarning($"無法從流程變量獲取欄位值: {field.Name}");
                    continue;
                }
                
                _loggingService.LogInformation($"成功獲取欄位值: {field.Name} = {fieldValue} (原始類型: {fieldValue.GetType().Name})");

                // 創建欄位值記錄
                var recordValue = new DataSetRecordValue
                {
                    Id = Guid.NewGuid(),
                    RecordId = newRecord.Id,
                    ColumnName = field.Name
                };

                // 根據欄位數據類型設置值
                var beforeValue = GetRecordValueString(recordValue);
                SetRecordValueByDataType(recordValue, fieldValue, column.DataType);
                var afterValue = GetRecordValueString(recordValue);
                
                newRecord.Values.Add(recordValue);
                _loggingService.LogInformation($"設置欄位 {field.Name}: 轉換前={beforeValue}, 轉換後={afterValue}, 目標類型={column.DataType}");
            }

            // 保存記錄
            _loggingService.LogInformation($"準備保存記錄: RecordId={newRecord.Id}, DataSetId={newRecord.DataSetId}, ValuesCount={newRecord.Values.Count}");
            _context.DataSetRecords.Add(newRecord);
            await _context.SaveChangesAsync();

            _loggingService.LogInformation($"INSERT 操作成功，創建記錄 ID: {newRecord.Id}, PrimaryKey={newRecord.PrimaryKeyValue ?? "N/A"}, Status={newRecord.Status ?? "N/A"}");

            // 構建返回結果
            var resultData = new List<Dictionary<string, object>>
            {
                new Dictionary<string, object>
                {
                    ["__record_id"] = newRecord.Id,
                    ["__primary_key"] = newRecord.PrimaryKeyValue ?? string.Empty,
                    ["__status"] = newRecord.Status ?? string.Empty,
                    ["__created_at"] = newRecord.CreatedAt
                }
            };

            // 添加所有欄位值
            foreach (var value in newRecord.Values)
            {
                object val = value.StringValue ?? 
                            (value.NumericValue?.ToString()) ?? 
                            (value.DateValue?.ToString()) ?? 
                            (value.BooleanValue?.ToString()) ?? 
                            value.TextValue ?? 
                            string.Empty;
                resultData[0][value.ColumnName] = val;
            }

            return new DataSetQueryResult
            {
                Success = true,
                Data = resultData,
                TotalCount = 1,
                DataSetName = dataSet.Name,
                Message = $"INSERT 操作成功，創建了 1 條記錄"
            };
        }

        private async Task<DataSetQueryResult> ExecuteUpdateQuery(DataSet dataSet, List<QueryConditionGroup> conditionGroups, DataSetQueryRequest request)
        {
            try
            {
                _loggingService.LogInformation($"開始執行 UPDATE 操作: {dataSet.Name} (ID: {dataSet.Id})");
                _loggingService.LogInformation($"查詢條件組數量: {conditionGroups.Count}");
                _loggingService.LogInformation($"操作數據字段數量: {request.OperationDataFields.Count}");

                if (request.OperationDataFields.Count == 0)
                {
                    return new DataSetQueryResult
                    {
                        Success = false,
                        Message = "UPDATE 操作需要至少一個操作數據字段"
                    };
                }

                // 1. 查詢要更新的記錄
                var records = await _context.DataSetRecords
                    .Where(r => r.DataSetId == dataSet.Id)
                    .Include(r => r.Values)
                    .ToListAsync();

                _loggingService.LogInformation($"找到 {records.Count} 條 DataSet 記錄");

                // 2. 根據條件過濾記錄
                var filteredRecords = FilterRecordsByConditions(records, conditionGroups);
                _loggingService.LogInformation($"條件過濾後剩餘 {filteredRecords.Count} 條記錄");

                if (filteredRecords.Count == 0)
                {
                    return new DataSetQueryResult
                    {
                        Success = true,
                        Data = new List<Dictionary<string, object>>(),
                        TotalCount = 0,
                        DataSetName = dataSet.Name,
                        Message = "UPDATE 操作完成，沒有找到符合條件的記錄"
                    };
                }

                // 3. 更新每條記錄
                int updatedCount = 0;
                var resultData = new List<Dictionary<string, object>>();

                foreach (var record in filteredRecords)
                {
                    bool recordUpdated = false;

                    foreach (var field in request.OperationDataFields)
                    {
                        _loggingService.LogInformation($"處理記錄 {record.Id} 的字段配置: Name={field.Name}, Value={field.Value}, JsonKey={field.JsonKey ?? "null"}");
                        
                        if (string.IsNullOrEmpty(field.Name))
                        {
                            _loggingService.LogWarning($"跳過空欄位名稱的字段");
                            continue;
                        }

                        // 獲取欄位定義
                        var column = dataSet.Columns.FirstOrDefault(c => c.ColumnName == field.Name);
                        if (column == null)
                        {
                            _loggingService.LogWarning($"找不到欄位定義: {field.Name}");
                            continue;
                        }
                        
                        _loggingService.LogInformation($"欄位定義: ColumnName={column.ColumnName}, DataType={column.DataType}, DisplayName={column.DisplayName ?? "N/A"}");

                        // 從流程變量中獲取值（支持 JSON PV 2級 mapping）
                        _loggingService.LogInformation($"開始從流程變量獲取值: VariableReference={field.Value}, JsonKey={field.JsonKey ?? "null"}");
                        var fieldValue = GetFieldValueFromProcessVariable(field.Value, field.JsonKey, request.ProcessVariableValues, column.DataType);
                        
                        if (fieldValue == null)
                        {
                            _loggingService.LogWarning($"無法從流程變量獲取欄位值: {field.Name}");
                            continue;
                        }
                        
                        _loggingService.LogInformation($"成功獲取欄位值: {field.Name} = {fieldValue} (原始類型: {fieldValue.GetType().Name})");

                        // 查找或創建欄位值記錄
                        var recordValue = record.Values.FirstOrDefault(v => v.ColumnName == field.Name);
                        if (recordValue == null)
                        {
                            _loggingService.LogInformation($"創建新欄位值記錄: {field.Name}");
                            recordValue = new DataSetRecordValue
                            {
                                Id = Guid.NewGuid(),
                                RecordId = record.Id,
                                ColumnName = field.Name
                            };
                            record.Values.Add(recordValue);
                        }
                        else
                        {
                            _loggingService.LogInformation($"找到現有欄位值記錄: {field.Name}, RecordValueId={recordValue.Id}");
                        }

                        // 根據欄位數據類型設置值
                        var beforeValue = GetRecordValueString(recordValue);
                        SetRecordValueByDataType(recordValue, fieldValue, column.DataType);
                        var afterValue = GetRecordValueString(recordValue);
                        recordUpdated = true;
                        _loggingService.LogInformation($"更新記錄 {record.Id} 的欄位 {field.Name}: 轉換前={beforeValue}, 轉換後={afterValue}, 目標類型={column.DataType}");
                    }

                    if (recordUpdated)
                    {
                        record.UpdatedAt = DateTime.UtcNow;
                        updatedCount++;

                        // 構建返回結果
                        var resultRecord = new Dictionary<string, object>
                        {
                            ["__record_id"] = record.Id,
                            ["__primary_key"] = record.PrimaryKeyValue ?? string.Empty,
                            ["__status"] = record.Status ?? string.Empty,
                            ["__updated_at"] = record.UpdatedAt
                        };

                        foreach (var value in record.Values)
                        {
                            object val = value.StringValue ?? 
                                        (value.NumericValue?.ToString()) ?? 
                                        (value.DateValue?.ToString()) ?? 
                                        (value.BooleanValue?.ToString()) ?? 
                                        value.TextValue ?? 
                                        string.Empty;
                            resultRecord[value.ColumnName] = val;
                        }

                        resultData.Add(resultRecord);
                    }
                }

                // 4. 保存更改
                _loggingService.LogInformation($"準備保存更改: 將更新 {updatedCount} 條記錄");
                await _context.SaveChangesAsync();

                _loggingService.LogInformation($"UPDATE 操作成功，更新了 {updatedCount} 條記錄");

                return new DataSetQueryResult
                {
                    Success = true,
                    Data = resultData,
                    TotalCount = updatedCount,
                    DataSetName = dataSet.Name,
                    Message = $"UPDATE 操作成功，更新了 {updatedCount} 條記錄"
                };
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"執行 UPDATE 操作失敗: {ex.Message}", ex);
                return new DataSetQueryResult
                {
                    Success = false,
                    Message = $"UPDATE 操作失敗: {ex.Message}"
                };
            }
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
                    // ✅ 修復：移除註釋後檢查是否包含 WHERE
                    var queryWithoutComments = RemoveSqlComments(baseQuery);
                    if (queryWithoutComments.ToUpper().Contains("WHERE"))
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

        // 移除 SQL 註釋的輔助方法
        private string RemoveSqlComments(string sql)
        {
            if (string.IsNullOrEmpty(sql))
                return sql;

            var result = sql;
            
            // 移除 /* ... */ 格式的多行註釋
            result = System.Text.RegularExpressions.Regex.Replace(
                result, 
                @"/\*[\s\S]*?\*/", 
                "", 
                System.Text.RegularExpressions.RegexOptions.Multiline
            );
            
            // 移除 -- 格式的單行註釋
            result = System.Text.RegularExpressions.Regex.Replace(
                result, 
                @"--.*?$", 
                "", 
                System.Text.RegularExpressions.RegexOptions.Multiline
            );
            
            return result;
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

        /// <summary>
        /// 從流程變量中獲取欄位值，支持 JSON PV 的 2級 mapping
        /// </summary>
        private object? GetFieldValueFromProcessVariable(
            string variableReference, 
            string? jsonKey, 
            Dictionary<string, object> processVariables, 
            string columnDataType)
        {
            try
            {
                // 提取變量名稱（從 ${variableName} 格式中）
                var match = Regex.Match(variableReference, @"\$\{([^}]+)\}");
                if (!match.Success)
                {
                    _loggingService.LogWarning($"無法解析流程變量引用: {variableReference}");
                    return null;
                }

                var variableName = match.Groups[1].Value;
                
                _loggingService.LogInformation($"解析流程變量引用: VariableName={variableName}, 可用流程變量數量={processVariables.Count}");
                
                if (!processVariables.ContainsKey(variableName))
                {
                    _loggingService.LogWarning($"流程變量不存在: {variableName}, 可用變量: {string.Join(", ", processVariables.Keys)}");
                    return null;
                }

                var variableValue = processVariables[variableName];
                _loggingService.LogInformation($"找到流程變量: {variableName}, 值類型={variableValue?.GetType().Name ?? "null"}, 值={GetVariableValueString(variableValue)}");
                
                // 如果有 jsonKey，說明是 JSON PV，需要提取特定鍵的值
                if (!string.IsNullOrEmpty(jsonKey))
                {
                    _loggingService.LogInformation($"從 JSON PV {variableName} 中提取鍵 {jsonKey}");
                    
                    JsonElement rootElement;
                    
                    // 處理 JsonElement 類型
                    if (variableValue is JsonElement jsonElement)
                    {
                        rootElement = jsonElement;
                    }
                    // 處理字符串類型的 JSON
                    else if (variableValue is string jsonString)
                    {
                        try
                        {
                            var jsonDoc = JsonDocument.Parse(jsonString);
                            rootElement = jsonDoc.RootElement;
                        }
                        catch (Exception ex)
                        {
                            _loggingService.LogError($"解析 JSON 字符串失敗: {ex.Message}");
                            return null;
                        }
                    }
                    else
                    {
                        _loggingService.LogWarning($"不支持的 JSON PV 類型: {variableValue?.GetType().Name ?? "null"}");
                        return null;
                    }
                    
                    // 處理 JSON 對象
                    if (rootElement.ValueKind == System.Text.Json.JsonValueKind.Object)
                    {
                        if (rootElement.TryGetProperty(jsonKey, out var keyValue))
                        {
                            _loggingService.LogInformation($"成功從 JSON 對象中提取鍵 {jsonKey}");
                            return ExtractJsonValue(keyValue, columnDataType);
                        }
                        else
                        {
                            _loggingService.LogWarning($"JSON 對象中不存在鍵 {jsonKey}，可用鍵: {string.Join(", ", rootElement.EnumerateObject().Select(p => p.Name))}");
                        }
                    }
                    // 處理 JSON 數組 - 取第一個元素
                    else if (rootElement.ValueKind == System.Text.Json.JsonValueKind.Array)
                    {
                        _loggingService.LogInformation($"檢測到 JSON 數組，元素數量: {rootElement.GetArrayLength()}");
                        
                        if (rootElement.GetArrayLength() > 0)
                        {
                            var firstElement = rootElement[0];
                            _loggingService.LogInformation($"使用數組第一個元素 (索引 0)，元素類型: {firstElement.ValueKind}");
                            
                            if (firstElement.ValueKind == System.Text.Json.JsonValueKind.Object)
                            {
                                if (firstElement.TryGetProperty(jsonKey, out var keyValue))
                                {
                                    _loggingService.LogInformation($"成功從數組第一個元素的 JSON 對象中提取鍵 {jsonKey}");
                                    return ExtractJsonValue(keyValue, columnDataType);
                                }
                                else
                                {
                                    _loggingService.LogWarning($"數組第一個元素的 JSON 對象中不存在鍵 {jsonKey}，可用鍵: {string.Join(", ", firstElement.EnumerateObject().Select(p => p.Name))}");
                                }
                            }
                            else
                            {
                                _loggingService.LogWarning($"數組第一個元素不是對象類型: {firstElement.ValueKind}");
                            }
                        }
                        else
                        {
                            _loggingService.LogWarning($"JSON 數組為空");
                        }
                    }
                    else
                    {
                        _loggingService.LogWarning($"不支持的 JSON 類型: {rootElement.ValueKind}");
                    }
                    
                    _loggingService.LogWarning($"無法從 JSON PV {variableName} 中提取鍵 {jsonKey}");
                    return null;
                }
                else
                {
                    // 普通流程變量，直接返回值
                    _loggingService.LogInformation($"處理普通流程變量: {variableName}, 目標數據類型={columnDataType}");
                    var convertedValue = ConvertValueToDataType(variableValue, columnDataType);
                    _loggingService.LogInformation($"類型轉換完成: {variableName}, 轉換後值={convertedValue}, 轉換後類型={convertedValue?.GetType().Name ?? "null"}");
                    return convertedValue;
                }
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取流程變量值失敗: {ex.Message}", ex);
                return null;
            }
        }

        /// <summary>
        /// 從 JsonElement 中提取值並轉換為指定數據類型
        /// </summary>
        private object? ExtractJsonValue(JsonElement jsonElement, string dataType)
        {
            try
            {
                return jsonElement.ValueKind switch
                {
                    System.Text.Json.JsonValueKind.String => ConvertValueToDataType(jsonElement.GetString(), dataType),
                    System.Text.Json.JsonValueKind.Number => ConvertValueToDataType(jsonElement.GetDecimal(), dataType),
                    System.Text.Json.JsonValueKind.True => ConvertValueToDataType(true, dataType),
                    System.Text.Json.JsonValueKind.False => ConvertValueToDataType(false, dataType),
                    System.Text.Json.JsonValueKind.Null => null,
                    _ => jsonElement.ToString()
                };
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"提取 JSON 值失敗: {ex.Message}");
                return jsonElement.ToString();
            }
        }

        /// <summary>
        /// 將值轉換為指定數據類型
        /// </summary>
        private object? ConvertValueToDataType(object? value, string dataType)
        {
            if (value == null)
                return null;

            try
            {
                var type = dataType.ToLower();
                return type switch
                {
                    "int" or "integer" => Convert.ToInt32(value),
                    "decimal" or "numeric" or "float" or "double" => Convert.ToDecimal(value),
                    "datetime" or "date" => Convert.ToDateTime(value),
                    "boolean" or "bool" => Convert.ToBoolean(value),
                    "text" or "string" or "nvarchar" or "varchar" => value.ToString(),
                    _ => value.ToString()
                };
            }
            catch (Exception ex)
            {
                _loggingService.LogWarning($"類型轉換失敗，使用原始值: {ex.Message}");
                return value.ToString();
            }
        }

        /// <summary>
        /// 根據數據類型設置 DataSetRecordValue 的值
        /// </summary>
        private void SetRecordValueByDataType(DataSetRecordValue recordValue, object? value, string dataType)
        {
            if (value == null)
                return;

            // 清空所有值
            recordValue.StringValue = null;
            recordValue.NumericValue = null;
            recordValue.DateValue = null;
            recordValue.BooleanValue = null;
            recordValue.TextValue = null;

            try
            {
                var type = dataType.ToLower();
                switch (type)
                {
                    case "int":
                    case "integer":
                        if (int.TryParse(value.ToString(), out var intVal))
                            recordValue.NumericValue = intVal;
                        break;
                    case "decimal":
                    case "numeric":
                    case "float":
                    case "double":
                        if (decimal.TryParse(value.ToString(), out var decVal))
                            recordValue.NumericValue = decVal;
                        break;
                    case "datetime":
                    case "date":
                        if (DateTime.TryParse(value.ToString(), out var dateVal))
                            recordValue.DateValue = dateVal;
                        break;
                    case "boolean":
                    case "bool":
                        if (bool.TryParse(value.ToString(), out var boolVal))
                            recordValue.BooleanValue = boolVal;
                        break;
                    case "text":
                    case "nvarchar(max)":
                        recordValue.TextValue = value.ToString();
                        break;
                    default:
                        // 默認使用 StringValue
                        var strValue = value.ToString();
                        if (strValue != null && strValue.Length > 500)
                            recordValue.TextValue = strValue;
                        else
                            recordValue.StringValue = strValue;
                        break;
                }
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"設置記錄值失敗: {ex.Message}", ex);
                // 失敗時使用字符串值
                recordValue.StringValue = value.ToString();
            }
        }

        /// <summary>
        /// 獲取記錄值的字符串表示（用於 logging）
        /// </summary>
        private string GetRecordValueString(DataSetRecordValue recordValue)
        {
            if (recordValue.StringValue != null) return $"StringValue={recordValue.StringValue}";
            if (recordValue.NumericValue.HasValue) return $"NumericValue={recordValue.NumericValue}";
            if (recordValue.DateValue.HasValue) return $"DateValue={recordValue.DateValue}";
            if (recordValue.BooleanValue.HasValue) return $"BooleanValue={recordValue.BooleanValue}";
            if (recordValue.TextValue != null) return $"TextValue={recordValue.TextValue?.Substring(0, Math.Min(100, recordValue.TextValue.Length))}...";
            return "null";
        }

        /// <summary>
        /// 從流程變量中獲取欄位值，支持 JSON PV 的 2級 mapping 和數組索引
        /// </summary>
        private object? GetFieldValueFromProcessVariableWithArrayIndex(
            string variableReference, 
            string? jsonKey, 
            Dictionary<string, object> processVariables, 
            string columnDataType,
            int arrayIndex)
        {
            try
            {
                // 提取變量名稱（從 ${variableName} 格式中）
                var match = Regex.Match(variableReference, @"\$\{([^}]+)\}");
                if (!match.Success)
                {
                    _loggingService.LogWarning($"無法解析流程變量引用: {variableReference}");
                    return null;
                }

                var variableName = match.Groups[1].Value;
                
                _loggingService.LogInformation($"解析流程變量引用 [數組索引 {arrayIndex}]: VariableName={variableName}, 可用流程變量數量={processVariables.Count}");
                
                if (!processVariables.ContainsKey(variableName))
                {
                    _loggingService.LogWarning($"流程變量不存在: {variableName}, 可用變量: {string.Join(", ", processVariables.Keys)}");
                    return null;
                }

                var variableValue = processVariables[variableName];
                _loggingService.LogInformation($"找到流程變量 [數組索引 {arrayIndex}]: {variableName}, 值類型={variableValue?.GetType().Name ?? "null"}, 值={GetVariableValueString(variableValue)}");
                
                // 如果有 jsonKey，說明是 JSON PV，需要提取特定鍵的值
                if (!string.IsNullOrEmpty(jsonKey))
                {
                    _loggingService.LogInformation($"從 JSON PV {variableName} 中提取鍵 {jsonKey} [數組索引 {arrayIndex}]");
                    
                    JsonElement rootElement;
                    
                    // 處理 JsonElement 類型
                    if (variableValue is JsonElement jsonElement)
                    {
                        rootElement = jsonElement;
                    }
                    // 處理字符串類型的 JSON
                    else if (variableValue is string jsonString)
                    {
                        try
                        {
                            var jsonDoc = JsonDocument.Parse(jsonString);
                            rootElement = jsonDoc.RootElement;
                        }
                        catch (Exception ex)
                        {
                            _loggingService.LogError($"解析 JSON 字符串失敗: {ex.Message}");
                            return null;
                        }
                    }
                    else
                    {
                        _loggingService.LogWarning($"不支持的 JSON PV 類型: {variableValue?.GetType().Name ?? "null"}");
                        return null;
                    }
                    
                    // 處理 JSON 對象
                    if (rootElement.ValueKind == System.Text.Json.JsonValueKind.Object)
                    {
                        if (rootElement.TryGetProperty(jsonKey, out var keyValue))
                        {
                            _loggingService.LogInformation($"成功從 JSON 對象中提取鍵 {jsonKey}");
                            return ExtractJsonValue(keyValue, columnDataType);
                        }
                        else
                        {
                            _loggingService.LogWarning($"JSON 對象中不存在鍵 {jsonKey}，可用鍵: {string.Join(", ", rootElement.EnumerateObject().Select(p => p.Name))}");
                        }
                    }
                    // 處理 JSON 數組 - 使用指定的數組索引
                    else if (rootElement.ValueKind == System.Text.Json.JsonValueKind.Array)
                    {
                        _loggingService.LogInformation($"檢測到 JSON 數組，元素數量: {rootElement.GetArrayLength()}, 使用索引: {arrayIndex}");
                        
                        if (arrayIndex >= 0 && arrayIndex < rootElement.GetArrayLength())
                        {
                            var arrayElement = rootElement[arrayIndex];
                            _loggingService.LogInformation($"使用數組元素 (索引 {arrayIndex})，元素類型: {arrayElement.ValueKind}");
                            
                            if (arrayElement.ValueKind == System.Text.Json.JsonValueKind.Object)
                            {
                                if (arrayElement.TryGetProperty(jsonKey, out var keyValue))
                                {
                                    _loggingService.LogInformation($"成功從數組元素 {arrayIndex} 的 JSON 對象中提取鍵 {jsonKey}");
                                    return ExtractJsonValue(keyValue, columnDataType);
                                }
                                else
                                {
                                    _loggingService.LogWarning($"數組元素 {arrayIndex} 的 JSON 對象中不存在鍵 {jsonKey}，可用鍵: {string.Join(", ", arrayElement.EnumerateObject().Select(p => p.Name))}");
                                }
                            }
                            else
                            {
                                _loggingService.LogWarning($"數組元素 {arrayIndex} 不是對象類型: {arrayElement.ValueKind}");
                            }
                        }
                        else
                        {
                            _loggingService.LogWarning($"數組索引 {arrayIndex} 超出範圍，數組長度: {rootElement.GetArrayLength()}");
                        }
                    }
                    else
                    {
                        _loggingService.LogWarning($"不支持的 JSON 類型: {rootElement.ValueKind}");
                    }
                    
                    _loggingService.LogWarning($"無法從 JSON PV {variableName} 中提取鍵 {jsonKey} [數組索引 {arrayIndex}]");
                    return null;
                }
                else
                {
                    // 普通流程變量，直接返回值
                    _loggingService.LogInformation($"處理普通流程變量 [數組索引 {arrayIndex}]: {variableName}, 目標數據類型={columnDataType}");
                    var convertedValue = ConvertValueToDataType(variableValue, columnDataType);
                    _loggingService.LogInformation($"類型轉換完成 [數組索引 {arrayIndex}]: {variableName}, 轉換後值={convertedValue}, 轉換後類型={convertedValue?.GetType().Name ?? "null"}");
                    return convertedValue;
                }
            }
            catch (Exception ex)
            {
                _loggingService.LogError($"獲取流程變量值失敗 [數組索引 {arrayIndex}]: {ex.Message}", ex);
                return null;
            }
        }

        /// <summary>
        /// 獲取流程變量值的字符串表示（用於 logging）
        /// </summary>
        private string GetVariableValueString(object? value)
        {
            if (value == null) return "null";
            
            try
            {
                if (value is JsonElement jsonElement)
                {
                    return $"JsonElement({jsonElement.ValueKind}): {jsonElement.GetRawText().Substring(0, Math.Min(200, jsonElement.GetRawText().Length))}...";
                }
                
                if (value is string str && str.Length > 200)
                {
                    return $"{value.GetType().Name}: {str.Substring(0, 200)}...";
                }
                
                return $"{value.GetType().Name}: {value}";
            }
            catch
            {
                return $"{value.GetType().Name}: [無法轉換為字符串]";
            }
        }

        /// <summary>
        /// JSON 數組信息
        /// </summary>
        private class JsonArrayInfo
        {
            public string VariableName { get; set; } = string.Empty;
            public JsonElement ArrayElement { get; set; }
            public int ArrayLength { get; set; }
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
