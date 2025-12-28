using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace PurpleRice.Models
{
    // Meta Flow 創建請求
    // 注意：字段順序很重要，Meta API 可能對字段順序敏感
    // 順序：version, data_api_version, routing_model, screens, name, categories（與官方例子一致）
    public class MetaFlowCreateRequest
    {
        [JsonPropertyName("version")]
        [JsonPropertyOrder(1)]
        public string? Version { get; set; }

        // 當 Flow 中有任何屏幕使用 data_exchange action 時，必須添加 data_api_version
        // 根據官方文檔：data_api_version 應該在 Flow JSON 的頂層，在 version 之後
        [JsonPropertyName("data_api_version")]
        [JsonPropertyOrder(2)]
        public string? DataApiVersion { get; set; }

        // 當使用 data_exchange action 時，通常也需要 routing_model
        [JsonPropertyName("routing_model")]
        [JsonPropertyOrder(3)]
        public Dictionary<string, object>? RoutingModel { get; set; }

        [JsonPropertyName("screens")]
        [JsonPropertyOrder(4)]
        public List<MetaFlowScreen> Screens { get; set; } = new List<MetaFlowScreen>();

        [JsonPropertyName("name")]
        [JsonPropertyOrder(5)]
        public string Name { get; set; } = string.Empty;

        [JsonPropertyName("categories")]
        [JsonPropertyOrder(6)]
        public List<string> Categories { get; set; } = new List<string>();
    }

    // Meta Flow 更新請求
    public class MetaFlowUpdateRequest
    {
        [JsonPropertyName("name")]
        public string? Name { get; set; }

        [JsonPropertyName("categories")]
        public List<string>? Categories { get; set; }

        [JsonPropertyName("screens")]
        public List<MetaFlowScreen>? Screens { get; set; }

        [JsonPropertyName("version")]
        public string? Version { get; set; }
    }

    // Meta Flow API 響應
    public class MetaFlowResponse
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = string.Empty;

        [JsonPropertyName("name")]
        public string Name { get; set; } = string.Empty;

        [JsonPropertyName("categories")]
        public List<string> Categories { get; set; } = new List<string>();

        [JsonPropertyName("screens")]
        public List<MetaFlowScreen> Screens { get; set; } = new List<MetaFlowScreen>();

        [JsonPropertyName("version")]
        public string? Version { get; set; }

        [JsonPropertyName("status")]
        public string? Status { get; set; }

        [JsonPropertyName("created_time")]
        public DateTime? CreatedTime { get; set; }

        [JsonPropertyName("updated_time")]
        public DateTime? UpdatedTime { get; set; }

        // Meta API 創建/更新響應可能包含的額外字段
        [JsonPropertyName("success")]
        public bool? Success { get; set; }

        [JsonPropertyName("validation_errors")]
        public List<object>? ValidationErrors { get; set; }

        [JsonPropertyName("warnings")]
        public List<object>? Warnings { get; set; }

        [JsonPropertyName("error")]
        public MetaFlowError? Error { get; set; }
    }

    // Meta Flow Screen
    // 注意：字段順序很重要，必須與 Meta API 要求一致：id, title, layout, terminal, data
    public class MetaFlowScreen
    {
        [JsonPropertyName("id")]
        [JsonPropertyOrder(1)]
        public string Id { get; set; } = string.Empty;

        [JsonPropertyName("title")]
        [JsonPropertyOrder(2)]
        public string? Title { get; set; }

        [JsonPropertyName("layout")]
        [JsonPropertyOrder(3)]
        public MetaFlowScreenLayout? Layout { get; set; }

        [JsonPropertyName("terminal")]
        [JsonPropertyOrder(4)]
        public bool? Terminal { get; set; }

        // 使用 Dictionary<string, object> 來保留所有數據模型字段（如 dropdown_select、checkbox_checkbox 等）
        // 這樣可以保留 __example__ 等動態字段
        // 重要：data 必須在 layout 和 terminal 之後
        [JsonPropertyName("data")]
        [JsonPropertyOrder(5)]
        public Dictionary<string, object>? Data { get; set; }

        [JsonPropertyName("success")]
        [JsonPropertyOrder(7)]
        public bool? Success { get; set; }
    }

    // Meta Flow Screen Layout
    public class MetaFlowScreenLayout
    {
        [JsonPropertyName("type")]
        public string Type { get; set; } = "SingleColumnLayout";

        [JsonPropertyName("children")]
        public List<object>? Children { get; set; }
    }

    // Meta Flow Screen Data
    public class MetaFlowScreenData
    {
        [JsonPropertyName("body")]
        public MetaFlowBody? Body { get; set; }

        [JsonPropertyName("footer")]
        public MetaFlowFooter? Footer { get; set; }

        [JsonPropertyName("header")]
        public MetaFlowHeader? Header { get; set; }

        [JsonPropertyName("actions")]
        public List<MetaFlowAction>? Actions { get; set; }
    }

    // Meta Flow Body
    public class MetaFlowBody
    {
        [JsonPropertyName("type")]
        public string Type { get; set; } = "body";

        [JsonPropertyName("text")]
        public string? Text { get; set; }
    }

    // Meta Flow Footer
    public class MetaFlowFooter
    {
        [JsonPropertyName("type")]
        public string Type { get; set; } = "footer";

        [JsonPropertyName("text")]
        public string? Text { get; set; }
    }

    // Meta Flow Header
    public class MetaFlowHeader
    {
        [JsonPropertyName("type")]
        public string Type { get; set; } = "header";

        [JsonPropertyName("format")]
        public string? Format { get; set; } // TEXT, IMAGE, VIDEO, DOCUMENT

        [JsonPropertyName("text")]
        public string? Text { get; set; }

        [JsonPropertyName("media")]
        public MetaFlowMedia? Media { get; set; }
    }

    // Meta Flow Media
    public class MetaFlowMedia
    {
        [JsonPropertyName("url")]
        public string? Url { get; set; }

        [JsonPropertyName("handle")]
        public string? Handle { get; set; }
    }

    // Meta Flow Action
    public class MetaFlowAction
    {
        [JsonPropertyName("type")]
        public string Type { get; set; } = string.Empty; // button, text_input, etc.

        [JsonPropertyName("id")]
        public string Id { get; set; } = string.Empty;

        [JsonPropertyName("title")]
        public string? Title { get; set; }

        [JsonPropertyName("action")]
        public MetaFlowActionData? Action { get; set; }

        [JsonPropertyName("data")]
        public Dictionary<string, object>? Data { get; set; }
    }

    // Meta Flow Action Data
    public class MetaFlowActionData
    {
        [JsonPropertyName("type")]
        public string Type { get; set; } = string.Empty; // navigate, submit, etc.

        [JsonPropertyName("next")]
        public string? Next { get; set; } // Screen ID

        [JsonPropertyName("payload")]
        public string? Payload { get; set; }

        [JsonPropertyName("method")]
        public string? Method { get; set; } // GET, POST

        [JsonPropertyName("endpoint")]
        public string? Endpoint { get; set; }
    }

    // Meta Flow 組件類型枚舉
    public static class MetaFlowComponentTypes
    {
        public const string Button = "button";
        public const string TextInput = "text_input";
        public const string TextArea = "textarea";
        public const string Select = "select";
        public const string Checkbox = "checkbox";
        public const string Radio = "radio";
        public const string Image = "image";
    }

    // Meta Flow 操作類型枚舉
    public static class MetaFlowActionTypes
    {
        public const string Navigate = "navigate";
        public const string Submit = "submit";
        public const string Call = "call";
        public const string Url = "url";
    }

    // Meta Flow 錯誤響應
    public class MetaFlowErrorResponse
    {
        [JsonPropertyName("error")]
        public MetaFlowError? Error { get; set; }
    }

    // Meta Flow 錯誤
    public class MetaFlowError
    {
        [JsonPropertyName("message")]
        public string? Message { get; set; }

        [JsonPropertyName("type")]
        public string? Type { get; set; }

        [JsonPropertyName("code")]
        public int? Code { get; set; }

        [JsonPropertyName("error_subcode")]
        public int? ErrorSubcode { get; set; }

        [JsonPropertyName("fbtrace_id")]
        public string? FbtraceId { get; set; }
    }

}

