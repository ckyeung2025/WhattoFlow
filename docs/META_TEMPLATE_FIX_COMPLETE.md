# Meta Template 完整修復指南

## 🎯 問題總結

創建帶有多個參數的 Meta WhatsApp Template 時出現格式錯誤。

## 🔧 需要修復的兩個地方

### 1. 前端：`src/pages/MetaTemplatePanel.js`

**問題**：參數示例格式不正確

**修復前** (第 169 行)：
```javascript
body_text: bodyVariables.map(v => v.example || '示例值')
```

**修復後** (第 169 行)：
```javascript
body_text: [bodyVariables.map(v => v.example || '示例值')]
```

**說明**：在 `map` 結果外包裝一層數組 `[]`

---

### 2. 後端：`Services/WhatsAppMetaTemplateService.cs`

**問題**：C# 模型定義與 Meta API 格式不匹配

**修復前** (第 353-354 行)：
```csharp
[JsonPropertyName("body_text")]
public List<string>? BodyText { get; set; }  // ❌ 錯誤
```

**修復後** (第 353-354 行)：
```csharp
[JsonPropertyName("body_text")]
public List<List<string>>? BodyText { get; set; }  // ✅ 正確
```

**說明**：改為嵌套的 `List<List<string>>`

---

## 📋 完整的數據流轉

### 前端發送的數據
```javascript
{
  "name": "test_template",
  "category": "MARKETING",
  "language": "zh_TW",
  "components": [
    {
      "type": "BODY",
      "text": "您好 {{1}}，您的 {{2}} 已準備：{{3}}",
      "example": {
        "body_text": [["張三", "假期申請表單", "https://example.com"]]
      }
    }
  ]
}
```

### 後端 C# 模型接收
```csharp
public class MetaExampleRequest
{
    [JsonPropertyName("body_text")]
    public List<List<string>>? BodyText { get; set; }
    // BodyText[0] = ["張三", "假期申請表單", "https://example.com"]
}
```

### 發送到 Meta API
```json
{
  "name": "test_template",
  "category": "MARKETING",
  "language": "zh_TW",
  "components": [
    {
      "type": "BODY",
      "text": "您好 {{1}}，您的 {{2}} 已準備：{{3}}",
      "example": {
        "body_text": [["張三", "假期申請表單", "https://example.com"]]
      }
    }
  ]
}
```

---

## 🚀 測試步驟

### 步驟 1：重新編譯後端
```powershell
# 停止應用
Ctrl+C

# 編譯
dotnet build
```

### 步驟 2：重新編譯前端
```powershell
npm run build
```

### 步驟 3：啟動應用
```powershell
dotnet run
```

### 步驟 4：創建測試模板

在 Meta Template 管理面板：

1. **模板名稱**：`test_manual_fill_v1`
2. **類別**：MARKETING 或 UTILITY
3. **語言**：zh_TW
4. **Body 內容**：
   ```
   您好 {{1}}，您的 {{2}} 已準備就緒，請點擊鏈接填寫：{{3}}
   ```
5. **參數示例**：
   - {{1}}: `張三`
   - {{2}}: `假期申請表單`
   - {{3}}: `https://example.com/form/123`

### 步驟 5：驗證創建成功

- ✅ 前端顯示成功消息
- ✅ 後端日誌顯示 Meta API 回應成功
- ✅ 在 Meta Business Manager 中可以看到模板
- ✅ 模板狀態為 PENDING 或 APPROVED

---

## 📝 參數數量與格式對照表

| 參數數量 | Body Text 內容 | Example 格式 |
|---------|---------------|-------------|
| 0 個 | `歡迎使用` | 無需 example |
| 1 個 | `您好 {{1}}` | `[["張三"]]` |
| 2 個 | `您好 {{1}}，訂單 {{2}}` | `[["張三", "ORDER123"]]` |
| 3 個 | `您好 {{1}}，{{2}}：{{3}}` | `[["張三", "表單", "URL"]]` |

**關鍵規則**：
- 外層數組 `[]` 只有一個元素
- 內層數組包含所有參數的示例值
- 參數按順序排列

---

## 🎯 在 Manual Fill 流程中使用

創建模板成功後，在工作流程中配置：

```json
{
  "nodes": [
    {
      "id": "sendEForm_1",
      "type": "sendEForm",
      "data": {
        "sendEFormMode": "manualFill",
        "messageMode": "template",
        "isMetaTemplate": true,
        "templateName": "test_manual_fill_v1",
        "templateLanguage": "zh_TW",
        "formName": "假期申請表單",
        "formId": "YOUR_FORM_ID",
        "recipientDetails": {
          "groups": ["GROUP_ID"]
        }
      }
    }
  ]
}
```

**注意**：
- `templateName` 必須與創建的模板名稱一致
- `templateLanguage` 必須與模板語言一致
- 系統會自動填充參數：
  - {{1}} = recipientName
  - {{2}} = formName
  - {{3}} = formUrl (帶 Token)

---

## ⚠️ 常見錯誤

### 錯誤 1：JSON 反序列化失敗
```
The JSON value could not be converted to System.String
```
**原因**：後端期望 `List<string>` 但收到 `List<List<string>>`  
**解決**：✅ 已修復，後端改為 `List<List<string>>`

### 錯誤 2：Meta API 拒絕參數
```
Number of parameters does not match
```
**原因**：前端發送的參數格式錯誤  
**解決**：✅ 已修復，前端包裝外層數組

### 錯誤 3：缺少 example 欄位
```
BODY 類型的元件缺少預期欄位（example）
```
**原因**：2 個以上參數必須提供 example  
**解決**：✅ 前端自動生成 example

---

## ✅ 完整修復清單

- [x] **前端修復**：`MetaTemplatePanel.js` 第 169 行
- [x] **後端修復**：`WhatsAppMetaTemplateService.cs` 第 353-354 行
- [x] **數據庫修復**：`Quick_Fix_RecipientType_Only.sql`
- [x] **代碼修復**：`RecipientResolverService.cs` (Unknown → PhoneNumber)
- [x] **文檔更新**：此修復指南

---

## 🎉 測試結果

修復後應該看到：

```
✅ 模板創建成功
✅ Meta API 接受請求
✅ 模板顯示在列表中
✅ 可以在工作流程中使用
✅ Manual Fill 流程正常運行
```

---

**最後更新**：2025-10-12  
**影響範圍**：所有 Meta Template 創建功能  
**版本**：v1.0 - 完整修復

