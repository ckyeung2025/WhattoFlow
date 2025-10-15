# Meta Template 參數格式修復指南

## 🐛 問題描述

創建 Meta WhatsApp Template 時，如果有 **2 個或以上參數**，會出現錯誤：
```
訊息範本「元件」參數缺少預期的欄位
「BODY」類型的元件缺少預期欄位（example）
```

## 🔍 根本原因

Meta API 對參數示例的格式要求：

### ❌ 錯誤格式（修復前）
```javascript
{
  body_text: ["示例1", "示例2", "示例3"]
}
```

### ✅ 正確格式（修復後）
```javascript
{
  body_text: [["示例1", "示例2", "示例3"]]
}
```

**關鍵差異**：所有參數示例必須包裝在 **外層數組** 中！

## 📋 Meta Template 參數規則

| 參數數量 | 是否需要 example | 格式要求 |
|---------|----------------|---------|
| 0 個 | ❌ 不需要 | 無 |
| 1 個 | ⚠️ 可選（建議提供） | `[["示例值"]]` |
| 2+ 個 | ✅ **必須提供** | `[["示例1", "示例2", ...]]` |

## 🎯 完整示例

### 範例 1：無參數模板
```javascript
{
  type: 'BODY',
  text: '您好！歡迎使用我們的服務。'
  // 不需要 example
}
```

### 範例 2：單參數模板
```javascript
{
  type: 'BODY',
  text: '您好 {{1}}！',
  example: {
    body_text: [["張三"]]  // 單個參數也要雙層數組
  }
}
```

### 範例 3：多參數模板 ⭐
```javascript
{
  type: 'BODY',
  text: '您好 {{1}}，您的訂單 {{2}} 已準備就緒，請點擊：{{3}}',
  example: {
    body_text: [["張三", "ORDER123", "https://example.com"]]
  }
}
```

## 🔧 已修復的代碼

**文件**：`src/pages/MetaTemplatePanel.js`

**修復前**（第 169 行）：
```javascript
body_text: bodyVariables.map(v => v.example || '示例值')
```

**修復後**（第 169 行）：
```javascript
body_text: [bodyVariables.map(v => v.example || '示例值')]
```

**關鍵改動**：在 `map` 結果外面包裝一層數組 `[]`

## 🚀 使用步驟

### 1. 創建帶參數的 Meta Template

在前端 Meta Template 管理面板中：

1. **輸入模板內容**：
   ```
   您好 {{1}}，您的 {{2}} 已準備就緒，請點擊鏈接：{{3}}
   ```

2. **添加參數示例**：
   - 參數 {{1}}：`張三`
   - 參數 {{2}}：`假期申請表單`
   - 參數 {{3}}：`https://example.com/form/123`

3. **提交創建**：系統會自動將示例值格式化為正確的格式

### 2. 在工作流程中使用

```json
{
  "messageMode": "template",
  "templateName": "form_notification",
  "isMetaTemplate": true,
  "templateLanguage": "zh_TW",
  "templateVariables": {
    "1": "張三",
    "2": "假期申請表單",
    "3": "https://example.com/form/123"
  }
}
```

## ⚠️ 常見錯誤

### 錯誤 1：忘記外層數組
```javascript
❌ body_text: ["示例1", "示例2"]
✅ body_text: [["示例1", "示例2"]]
```

### 錯誤 2：參數數量不匹配
```javascript
// 模板有 3 個參數
text: '您好 {{1}}，{{2}} {{3}}'

// ❌ 錯誤：只提供 2 個示例
example: { body_text: [["示例1", "示例2"]] }

// ✅ 正確：提供 3 個示例
example: { body_text: [["示例1", "示例2", "示例3"]] }
```

### 錯誤 3：Header 和 Body 混淆
```javascript
// 如果 Header 也有參數
{
  type: 'HEADER',
  format: 'TEXT',
  text: '訂單 {{1}}',
  example: {
    header_text: [["ORDER123"]]  // 注意是 header_text
  }
}

// Body 參數
{
  type: 'BODY',
  text: '您好 {{1}}',
  example: {
    body_text: [["張三"]]  // 注意是 body_text
  }
}
```

## 📝 測試清單

創建 Meta Template 後，請驗證：

- [ ] 模板成功提交到 Meta API
- [ ] 在 Meta Business Manager 中可以看到模板
- [ ] 模板狀態為 PENDING 或 APPROVED
- [ ] 參數數量與示例值數量一致
- [ ] 在工作流程中可以正常使用

## 🔗 相關資源

- [Meta WhatsApp Business API 文檔](https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates/)
- [Message Template Examples](https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates/components)

---

## ✅ 修復完成

- ✅ **代碼已修復**：`src/pages/MetaTemplatePanel.js` 第 169 行
- ✅ **格式正確**：參數示例使用雙層數組結構
- ✅ **支持多參數**：現在可以創建 2 個以上參數的模板

**下一步**：
1. 重新編譯前端：`npm run build`
2. 重新啟動應用
3. 創建新的 Meta Template 測試
4. 在 Manual Fill 流程中使用新模板

---

**最後更新**：2025-10-12
**相關問題**：Meta Template 創建失敗，參數格式錯誤
**影響範圍**：所有使用 2 個以上參數的 Meta Template

