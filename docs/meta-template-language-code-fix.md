# Meta 模板語言代碼修復文檔

## 問題描述

### 錯誤信息
```
Meta API 發送失敗: NotFound - {
  "error": {
    "message": "(#132001) Template name does not exist in the translation",
    "type": "OAuthException",
    "code": 132001,
    "error_data": {
      "messaging_product": "whatsapp",
      "details": "template name (dn_notify) does not exist in zh_TW"
    }
  }
}
```

### 問題原因

**模板語言不匹配**：
- Meta 模板 `dn_notify` 創建時使用的語言是 **Chinese (HKG)**，對應語言代碼應為 `zh_HK`
- 但代碼中**硬編碼為 `zh_TW`**（台灣繁體中文）
- Meta API 找不到 `zh_TW` 版本的 `dn_notify` 模板，因此返回錯誤

### 原代碼問題

**文件**：`Services/WhatsAppWorkflowService.cs`  
**位置**：Line 907（修復前）

```csharp
language = new
{
    code = "zh_TW"  // ❌ 硬編碼！無論什麼模板都使用 zh_TW
}
```

---

## 解決方案

### ✅ 修復內容

#### 1. 前端保存模板語言代碼

**文件**：`src/components/WorkflowDesigner/hooks/useNodeHandlers.js`  
**位置**：Line 137-148

```javascript
const handleSelectTemplate = useCallback((template, isMetaTemplate = false) => {
  if (selectedNode) {
    handleNodeDataChange({
      templateId: template.id,
      templateName: template.name,
      templateDescription: template.description,
      isMetaTemplate: isMetaTemplate,
      templateType: isMetaTemplate ? 'META' : 'INTERNAL',
      templateLanguage: template.language || null  // ⭐ 保存模板語言
    });
  }
}, [selectedNode, handleNodeDataChange]);
```

#### 2. 數據模型添加語言字段

**文件**：`Services/WorkflowEngine.cs`  
**位置**：Line 2693-2694

```csharp
[System.Text.Json.Serialization.JsonPropertyName("templateLanguage")]
public string TemplateLanguage { get; set; } // Meta 模板的語言代碼
```

#### 3. 後端使用動態語言代碼

**文件**：`Services/WhatsAppWorkflowService.cs`  
**位置**：Line 896-912

```csharp
// 使用提供的語言代碼，如果沒有則默認為 zh_TW
var finalLanguageCode = languageCode ?? "zh_TW";
_loggingService.LogInformation($"使用語言代碼: {finalLanguageCode}");

// 構建 Meta API 請求
var payload = new
{
    messaging_product = "whatsapp",
    to = formattedTo,
    type = "template",
    template = new
    {
        name = templateName,
        language = new
        {
            code = finalLanguageCode  // ⭐ 使用從節點數據傳入的語言代碼
        },
        components = components.ToArray()
    }
};
```

#### 4. 更新所有調用點傳遞語言代碼

**文件**：`Services/WorkflowEngine.cs`

所有 5 個調用點都添加了 `nodeData.TemplateLanguage` 參數：
- `ExecuteSendWhatsApp` - Line 792
- `ExecuteSendWhatsAppTemplate` - Line 909
- `ExecuteWaitReply` - Line 1049
- `ExecuteWaitForQRCode` - Line 1190
- `ExecuteSendEForm` - Line 1874

---

## Meta 語言代碼對照表

### WhatsApp 支持的語言代碼

| 顯示名稱 | Meta 語言代碼 | 說明 |
|---------|-------------|------|
| Chinese (HKG) | `zh_HK` | 繁體中文（香港）|
| Chinese (Taiwan) | `zh_TW` | 繁體中文（台灣）|
| Chinese (Simplified) | `zh_CN` | 簡體中文（中國）|
| English (US) | `en_US` | 英文（美國）|
| English (UK) | `en_GB` | 英文（英國）|
| Japanese | `ja` | 日文 |
| Korean | `ko` | 韓文 |

### 常見語言代碼格式

Meta 使用 **語言_地區** 格式：
- 語言：ISO 639-1 兩字母代碼（如 `zh`, `en`, `ja`）
- 地區：ISO 3166-1 兩字母代碼（如 `TW`, `HK`, `CN`, `US`）
- 連接符：下劃線 `_`

**示例**：
- `zh_HK`: 中文-香港
- `zh_TW`: 中文-台灣
- `zh_CN`: 中文-中國
- `en_US`: 英文-美國

---

## 執行流程

### 修復後的執行流程

```
1. 用戶在流程設計器選擇 Meta 模板
   ├─ 模板名稱: dn_notify
   ├─ 模板語言: zh_HK (Chinese HKG)  ← 從 Meta API 獲取
   └─ 保存到節點數據: templateLanguage = "zh_HK"

2. 執行流程時
   ├─ WorkflowEngine 讀取 nodeData.TemplateLanguage
   ├─ 傳遞給 SendWhatsAppTemplateMessageWithTrackingAsync
   └─ 傳遞給 SendMetaTemplateMessageAsync

3. 發送到 Meta API
   ├─ 使用正確的語言代碼: zh_HK
   ├─ Meta API 查找: dn_notify (zh_HK 版本)
   └─ 發送成功 ✅
```

---

## 測試步驟

### 1. 確認模板語言

在 Meta 模板管理頁面查看您的模板：
```
模板名稱: dn_notify
語言: Chinese (HKG)  ← 對應 zh_HK
狀態: APPROVED ✅
```

### 2. 重新選擇模板

**重要**：之前選擇的模板沒有保存語言信息，需要重新選擇：

1. 打開流程設計器
2. 雙擊 Send WhatsApp 節點
3. 切換到"使用模板" Tab
4. **重新選擇** `dn_notify` 模板（這次會保存 language 字段）
5. 保存流程

### 3. 執行並檢查日誌

執行流程後，日誌應該顯示：

```
[info] === 使用 Meta 官方模板發送消息 ===
[info] Meta 模板名稱: dn_notify
[info] Meta 模板語言: zh_HK  ← 應該是 zh_HK，不再是 zh_TW
[info] 使用語言代碼: zh_HK
[info] Meta Template API Payload: {
  "type": "template",
  "template": {
    "name": "dn_notify",
    "language": {
      "code": "zh_HK"  ← 正確的語言代碼
    }
  }
}
[info] ✅ Meta 模板消息發送成功
```

---

## 常見 Meta 語言代碼問題

### 問題 1：語言代碼大小寫

**Meta 要求**：
- ✅ 正確：`zh_HK`, `zh_TW`, `en_US`
- ❌ 錯誤：`zh_hk`, `ZH_HK`, `en_us`

### 問題 2：語言代碼格式

**Meta 要求**：
- ✅ 正確：使用下劃線 `_`（如 `zh_HK`）
- ❌ 錯誤：使用連字符 `-`（如 `zh-HK`）

### 問題 3：模板必須存在該語言版本

如果您的 Meta 模板只創建了 `zh_HK` 版本：
- ✅ 發送時使用 `zh_HK` - 成功
- ❌ 發送時使用 `zh_TW` - 失敗（找不到模板）
- ❌ 發送時使用 `en_US` - 失敗（找不到模板）

---

## 創建多語言 Meta 模板

如果需要支持多種語言，需要為每種語言創建單獨的模板：

### 方法 1：創建不同名稱的模板
```
dn_notify_zh_hk (zh_HK)
dn_notify_zh_tw (zh_TW)
dn_notify_en_us (en_US)
```

### 方法 2：使用相同名稱但不同語言
```
dn_notify (zh_HK)  ← 創建香港版本
dn_notify (zh_TW)  ← 創建台灣版本
dn_notify (en_US)  ← 創建英文版本
```

**注意**：Meta 允許同一模板名稱有多個語言版本，發送時通過 `language.code` 指定使用哪個版本。

---

## 調試建議

### 檢查模板語言代碼

在 Meta Business Manager 中查看模板詳情：
1. 進入 WhatsApp Manager
2. 找到 Message Templates
3. 查看模板的 Language 欄位
4. 確認語言代碼（如 `zh_HK`, `zh_TW`）

### 查看執行日誌

執行流程後，檢查日誌中的語言代碼：
```bash
# 搜索關鍵字
"使用語言代碼"
"Meta 模板語言"

# 確認輸出
使用語言代碼: zh_HK  ← 應該與 Meta 模板的語言匹配
```

---

## 總結

### ❌ 原問題
- 硬編碼 `zh_TW`
- 無法適應不同語言的 Meta 模板
- `dn_notify` 是 `zh_HK` 模板，但發送時使用 `zh_TW`，導致失敗

### ✅ 修復後
- 動態讀取模板的語言代碼
- 前端保存 `templateLanguage` 字段
- 後端從節點數據讀取並使用正確的語言代碼
- 支持所有 Meta 支持的語言

### 🎯 下次測試

1. **重新選擇模板**（重要！）- 讓前端保存語言信息
2. 保存流程
3. 執行流程
4. 檢查日誌確認使用正確的語言代碼（應該是 `zh_HK`）

**現在應該可以成功發送了！** ✅

