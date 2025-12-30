using System;
using System.Collections.Generic;

namespace PurpleRice.Models.DTOs
{
    public class DataSetQueryRequest
    {
        public Guid DataSetId { get; set; }
        public string OperationType { get; set; } = string.Empty; // SELECT, INSERT, UPDATE, DELETE
        public List<QueryConditionGroup> QueryConditionGroups { get; set; } = new List<QueryConditionGroup>();
        public Dictionary<string, object> OperationData { get; set; } = new Dictionary<string, object>();
        public List<OperationDataField> OperationDataFields { get; set; } = new List<OperationDataField>(); // 包含 jsonKey 的完整字段信息
        public List<FieldMapping> MappedFields { get; set; } = new List<FieldMapping>();
        public Dictionary<string, object> ProcessVariableValues { get; set; } = new Dictionary<string, object>();
    }

    public class QueryConditionGroup
    {
        [System.Text.Json.Serialization.JsonPropertyName("id")]
        public string Id { get; set; } = string.Empty;
        
        [System.Text.Json.Serialization.JsonPropertyName("relation")]
        public string Relation { get; set; } = "and"; // and, or
        
        [System.Text.Json.Serialization.JsonPropertyName("conditions")]
        public List<QueryCondition> Conditions { get; set; } = new List<QueryCondition>();
    }

    public class QueryCondition
    {
        [System.Text.Json.Serialization.JsonPropertyName("id")]
        public string Id { get; set; } = string.Empty;
        
        [System.Text.Json.Serialization.JsonPropertyName("fieldName")]
        public string FieldName { get; set; } = string.Empty;
        
        [System.Text.Json.Serialization.JsonPropertyName("operator")]
        public string Operator { get; set; } = string.Empty; // equals, notEquals, greaterThan, etc.
        
        [System.Text.Json.Serialization.JsonPropertyName("value")]
        public string Value { get; set; } = string.Empty;
        
        [System.Text.Json.Serialization.JsonPropertyName("label")]
        public string Label { get; set; } = string.Empty;
    }

    public class FieldMapping
    {
        [System.Text.Json.Serialization.JsonPropertyName("fieldName")]
        public string FieldName { get; set; } = string.Empty;
        
        [System.Text.Json.Serialization.JsonPropertyName("variableName")]
        public string VariableName { get; set; } = string.Empty;
        
        [System.Text.Json.Serialization.JsonPropertyName("dataType")]
        public string DataType { get; set; } = "string";
    }

    public class OperationDataField
    {
        [System.Text.Json.Serialization.JsonPropertyName("name")]
        public string Name { get; set; } = string.Empty; // DataSet 欄位名稱
        
        [System.Text.Json.Serialization.JsonPropertyName("value")]
        public string Value { get; set; } = string.Empty; // 流程變量引用，如 "${variableName}"
        
        [System.Text.Json.Serialization.JsonPropertyName("jsonKey")]
        public string? JsonKey { get; set; } // JSON 鍵名（當流程變量為 JSON 類型時使用）
    }

    public class DataSetQueryResult
    {
        public bool Success { get; set; }
        public string Message { get; set; } = string.Empty;
        public List<Dictionary<string, object>> Data { get; set; } = new List<Dictionary<string, object>>();
        public int TotalCount { get; set; }
        public string DataSetName { get; set; } = string.Empty;
        public Guid QueryResultId { get; set; } // 保存到數據庫後的 ID
    }
}
