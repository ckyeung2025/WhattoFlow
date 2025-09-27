using System.Collections.Generic;

namespace PurpleRice.Models
{
    /// <summary>
    /// 工作流程節點類型定義
    /// 用於統一管理前後端的節點類型
    /// </summary>
    public static class WorkflowNodeTypes
    {
        /// <summary>
        /// 所有支援的節點類型定義
        /// </summary>
        public static readonly Dictionary<string, WorkflowNodeTypeDefinition> SupportedTypes = new()
        {
            ["start"] = new WorkflowNodeTypeDefinition
            {
                Type = "start",
                Label = "Start",
                Category = "Control",
                Description = "工作流程的起始點",
                IsImplemented = true,
                HasExecution = false, // 不需要執行
                DefaultData = new { taskName = "Start", activationType = "manual" }
            },
            
            ["sendwhatsapp"] = new WorkflowNodeTypeDefinition
            {
                Type = "sendWhatsApp",
                Label = "Send WhatsApp Message",
                Category = "Communication",
                Description = "發送自定義 WhatsApp 訊息",
                IsImplemented = true,
                HasExecution = true,
                DefaultData = new { taskName = "Send WhatsApp Message", message = "", to = "" }
            },
            
            ["sendwhatsapptemplate"] = new WorkflowNodeTypeDefinition
            {
                Type = "sendWhatsAppTemplate",
                Label = "Send WhatsApp Template",
                Category = "Communication",
                Description = "發送預設的 WhatsApp 模板訊息",
                IsImplemented = true,
                HasExecution = true,
                DefaultData = new { taskName = "Send WhatsApp Template", templateId = "", templateName = "", variables = new { } }
            },
            
            ["waitreply"] = new WorkflowNodeTypeDefinition
            {
                Type = "waitReply",
                Label = "Wait for User Reply",
                Category = "Interaction",
                Description = "暫停流程等待用戶輸入",
                IsImplemented = true,
                HasExecution = true,
                DefaultData = new { 
                    taskName = "Wait for User Reply", 
                    replyType = "initiator",
                    specifiedUsers = "",
                    message = "請輸入您的回覆",
                    validation = new { enabled = true, validatorType = "default" }
                }
            },
            
            ["datasetquery"] = new WorkflowNodeTypeDefinition
            {
                Type = "dataSetQuery",
                Label = "DataSet Query/Update",
                Category = "Data",
                Description = "DataSet 查詢、插入、更新或刪除",
                IsImplemented = true,
                HasExecution = true,
                DefaultData = new { taskName = "DataSet Query/Update", dataSetId = "", operationType = "SELECT", queryConditionGroups = new object[] { }, operationData = new { }, mappedFields = new object[] { } }
            },
            
            ["callapi"] = new WorkflowNodeTypeDefinition
            {
                Type = "callApi",
                Label = "Trigger External API",
                Category = "Integration",
                Description = "呼叫外部 API 服務",
                IsImplemented = true,
                HasExecution = true,
                DefaultData = new { taskName = "Trigger External API", url = "" }
            },
            
            ["sendeform"] = new WorkflowNodeTypeDefinition
            {
                Type = "sendEForm",
                Label = "Send eForm",
                Category = "Form",
                Description = "發送電子表單給用戶填寫",
                IsImplemented = true,
                HasExecution = true,
                DefaultData = new { taskName = "Send eForm", formName = "", formId = "", formDescription = "", to = "" }
            },
            
            ["waitforqrcode"] = new WorkflowNodeTypeDefinition
            {
                Type = "waitForQRCode",
                Label = "Wait for QR Code",
                Category = "Interaction",
                Description = "等待用戶上傳包含 QR Code 的圖片並掃描",
                IsImplemented = true,
                HasExecution = true,
                DefaultData = new { 
                    taskName = "Wait for QR Code", 
                    qrCodeVariable = "",
                    message = "請上傳包含 QR Code 的圖片",
                    timeout = 300
                }
            },
            
            ["switch"] = new WorkflowNodeTypeDefinition
            {
                Type = "switch",
                Label = "Switch",
                Category = "Control",
                Description = "根據條件選擇不同的執行路徑",
                IsImplemented = true,
                HasExecution = true,
                DefaultData = new { 
                    taskName = "Switch", 
                    conditions = new[] { 
                        new { 
                            id = "condition1",
                            variableName = "",
                            @operator = "equals",
                            value = "",
                            label = "條件1"
                        }
                    },
                    defaultPath = "default"
                }
            },

            
            ["end"] = new WorkflowNodeTypeDefinition
            {
                Type = "end",
                Label = "End",
                Category = "Control",
                Description = "工作流程的終點",
                IsImplemented = true,
                HasExecution = false, // 不需要執行
                DefaultData = new { taskName = "End" }
            }
        };

        /// <summary>
        /// 獲取所有支援的節點類型
        /// </summary>
        public static IEnumerable<string> GetAllTypes()
        {
            return SupportedTypes.Keys;
        }

        /// <summary>
        /// 檢查節點類型是否支援
        /// </summary>
        public static bool IsSupported(string nodeType)
        {
            return SupportedTypes.ContainsKey(nodeType?.ToLower());
        }

        /// <summary>
        /// 獲取節點類型定義
        /// </summary>
        public static WorkflowNodeTypeDefinition GetDefinition(string nodeType)
        {
            return SupportedTypes.TryGetValue(nodeType?.ToLower(), out var definition) ? definition : null;
        }

        /// <summary>
        /// 獲取所有已實現的節點類型
        /// </summary>
        public static IEnumerable<string> GetImplementedTypes()
        {
            return SupportedTypes.Where(kvp => kvp.Value.IsImplemented).Select(kvp => kvp.Key);
        }

        /// <summary>
        /// 獲取需要執行的節點類型
        /// </summary>
        public static IEnumerable<string> GetExecutableTypes()
        {
            return SupportedTypes.Where(kvp => kvp.Value.HasExecution).Select(kvp => kvp.Key);
        }

        /// <summary>
        /// 按類別獲取節點類型
        /// </summary>
        public static IEnumerable<string> GetTypesByCategory(string category)
        {
            return SupportedTypes.Where(kvp => kvp.Value.Category == category).Select(kvp => kvp.Key);
        }
    }

    /// <summary>
    /// 工作流程節點類型定義
    /// </summary>
    public class WorkflowNodeTypeDefinition
    {
        /// <summary>
        /// 節點類型名稱
        /// </summary>
        public string Type { get; set; }

        /// <summary>
        /// 顯示標籤
        /// </summary>
        public string Label { get; set; }

        /// <summary>
        /// 分類
        /// </summary>
        public string Category { get; set; }

        /// <summary>
        /// 描述
        /// </summary>
        public string Description { get; set; }

        /// <summary>
        /// 是否已實現
        /// </summary>
        public bool IsImplemented { get; set; }

        /// <summary>
        /// 是否需要執行
        /// </summary>
        public bool HasExecution { get; set; }

        /// <summary>
        /// 預設數據
        /// </summary>
        public object DefaultData { get; set; }
    }
} 