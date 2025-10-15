# 語言包更新 - 拒絕原因功能

## 📋 更新概述

為 Meta Template 拒絕原因顯示功能添加了完整的英文語言包支持，確保國際化用戶能夠獲得一致的體驗。

## 🔧 新增的語言包條目

### 英文語言包 (`src/locales/en.js`)

在 `whatsappTemplate.metaTemplate` 部分新增了以下條目：

```javascript
// Rejection reason related
rejectionReason: "Rejection Reason:",
apiNoRejectionReason: "API did not provide rejection reason",
apiLimitationNote: "Due to Meta API limitations, detailed rejection reasons cannot be retrieved.",
suggestion: "Suggestion:",
suggestionText: "Please modify template content based on common rejection reasons and resubmit. You can delete this template and create a new version.",
commonRejectionReasons: "Common Rejection Reasons:",
floatingParameters: "Floating Parameters:",
floatingParametersDesc: "Parameters lack sufficient contextual description",
marketingContent: "Marketing Content:",
marketingContentDesc: "Content is too commercial or exaggerated",
policyViolation: "Policy Violation:",
policyViolationDesc: "Content violates WhatsApp policies",
wrongCategory: "Wrong Category:",
wrongCategoryDesc: "Selected incorrect template category"
```

## 🌍 語言對比

### 繁體中文（默認）
```
❌ 拒絕原因：
API 未提供拒絕原因
由於 Meta API 限制，無法獲取詳細的拒絕原因。

💡 建議：請根據常見拒絕原因修改模板內容後重新提交。

常見拒絕原因：
• 浮動參數：參數缺乏足夠上下文描述
• 營銷內容：內容過於商業化或誇大
• 政策違規：內容違反 WhatsApp 政策
• 類別不當：選擇了錯誤的模板類別
```

### 英文
```
❌ Rejection Reason:
API did not provide rejection reason
Due to Meta API limitations, detailed rejection reasons cannot be retrieved.

💡 Suggestion: Please modify template content based on common rejection reasons and resubmit.

Common Rejection Reasons:
• Floating Parameters: Parameters lack sufficient contextual description
• Marketing Content: Content is too commercial or exaggerated
• Policy Violation: Content violates WhatsApp policies
• Wrong Category: Selected incorrect template category
```

## 🔄 前端代碼更新

### 修改文件：`src/pages/MetaTemplatePanel.js`

**更新前（硬編碼中文）：**
```javascript
<p><strong style={{ color: '#ff4d4f' }}>❌ 拒絕原因：</strong></p>
<div><strong>API 未提供拒絕原因</strong></div>
<div>由於 Meta API 限制，無法獲取詳細的拒絕原因。</div>
```

**更新後（使用語言包）：**
```javascript
<p><strong style={{ color: '#ff4d4f' }}>❌ {t('whatsappTemplate.metaTemplate.rejectionReason')}</strong></p>
<div><strong>{t('whatsappTemplate.metaTemplate.apiNoRejectionReason')}</strong></div>
<div>{t('whatsappTemplate.metaTemplate.apiLimitationNote')}</div>
```

## 📊 功能效果

### 用戶體驗改進
- ✅ **國際化支持**：英文用戶能看到完整的英文界面
- ✅ **一致性**：所有文字都通過語言包管理
- ✅ **可維護性**：未來添加其他語言更容易

### 開發優勢
- ✅ **標準化**：遵循項目的國際化規範
- ✅ **可擴展**：容易添加其他語言支持
- ✅ **統一管理**：所有文字集中管理

## 🚀 使用方式

### 語言切換
用戶可以通過語言切換功能在繁體中文和英文之間切換，拒絕原因顯示會自動適配當前語言。

### 添加新語言
如需添加其他語言（如簡體中文），只需在對應的語言包文件中添加相同的條目即可。

## 📋 測試建議

### 功能測試
1. **繁體中文模式**：確認所有文字顯示正確
2. **英文模式**：確認所有文字顯示正確
3. **語言切換**：確認切換語言後界面正確更新

### 內容測試
1. **有拒絕原因**：確認 API 提供的拒絕原因正確顯示
2. **無拒絕原因**：確認 API 限制提示正確顯示
3. **常見原因指導**：確認所有常見拒絕原因描述正確

## 🔧 技術細節

### 語言包結構
```javascript
whatsappTemplate: {
  metaTemplate: {
    // ... 其他條目
    rejectionReason: "Rejection Reason:",
    apiNoRejectionReason: "API did not provide rejection reason",
    // ... 更多條目
  }
}
```

### 前端使用
```javascript
// 使用 t() 函數獲取翻譯
{t('whatsappTemplate.metaTemplate.rejectionReason')}
```

## 📈 未來擴展

### 可能的改進
1. **動態內容**：根據實際拒絕原因提供更精確的建議
2. **多語言支持**：添加更多語言包（日文、韓文等）
3. **智能建議**：基於模板內容提供個性化的修改建議

### 維護建議
1. **定期檢查**：確保語言包條目與功能同步
2. **用戶反饋**：收集國際化用戶的反饋並改進翻譯
3. **一致性**：保持所有界面元素的語言包使用

---

*語言包更新完成，現在支持完整的國際化體驗！* 🌍✨
