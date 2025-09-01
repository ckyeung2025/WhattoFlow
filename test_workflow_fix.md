# 工作流程 "發送公司地址" 步驟修復

## 問題描述
在工作流程中，"發送公司地址" 步驟（taskName: "發送公司地址"）沒有執行，而其他步驟如 "eForm 結果通知 - Approve" 和 "eForm 結果通知 - Reject" 都成功執行了。

## 問題分析
從日誌分析發現兩個主要問題：

### 1. 第一次執行（執行ID: 239）的問題
- 系統顯示 "不支援的步驟類型: sendWhatsAppTemplate"
- 但實際上 `ExecuteStep` 方法中已經支援 `sendWhatsAppTemplate` 步驟類型

### 2. 第二次執行（執行ID: 241）的問題
- 錯誤：`The given key was not present in the dictionary`
- 發生在 `ExecuteSendWhatsAppTemplateStep` 方法第 733 行
- 嘗試從 `inputData` 中獲取 `templateId` 屬性時失敗

## 根本原因
`EFormInstancesController.cs` 中的 `WorkflowNode` 類別缺少正確的 JSON 序列化屬性設置：

1. **缺少 `templateId` 屬性**：`WorkflowNode` 類別中沒有 `templateId` 屬性
2. **缺少 `JsonPropertyName` 屬性**：屬性沒有正確的 JSON 序列化設置，導致序列化後的 JSON 與預期不符

## 修復內容

### 1. 添加 `templateId` 屬性
```csharp
public string templateId { get; set; } = "";
```

### 2. 添加正確的 JSON 序列化屬性
```csharp
[JsonPropertyName("message")]
public string message { get; set; } = "";

[JsonPropertyName("to")]
public string to { get; set; } = "";

[JsonPropertyName("templateName")]
public string templateName { get; set; } = "";

[JsonPropertyName("templateId")]
public string templateId { get; set; } = "";

[JsonPropertyName("formName")]
public string formName { get; set; } = "";

[JsonPropertyName("formId")]
public string formId { get; set; } = "";
```

### 3. 添加必要的 using 語句
```csharp
using System.Text.Json.Serialization;
```

### 4. 改進錯誤處理
在 `ExecuteSendWhatsAppTemplateStep` 方法中使用更安全的屬性訪問方式：
```csharp
if (inputData.TryGetProperty("to", out var toElement))
{
    to = toElement.GetString() ?? "";
}

if (inputData.TryGetProperty("templateId", out var templateIdElement))
{
    templateId = templateIdElement.GetString() ?? "";
}
```

## 預期結果
修復後，"發送公司地址" 步驟應該能夠：
1. 正確識別為支援的步驟類型
2. 成功從步驟數據中提取 `templateId` 和 `to` 參數
3. 成功發送 WhatsApp 模板消息

## 測試建議
1. 重新執行工作流程
2. 檢查日誌確認步驟執行成功
3. 確認 WhatsApp 模板消息已發送
