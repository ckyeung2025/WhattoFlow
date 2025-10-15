# 修復變數示例數據被清空問題

## 🐛 問題描述

用戶在 Meta Template 創建過程中遇到以下問題：

1. **輸入變數示例數據**：在變數示例輸入框中輸入數據（如 "John", "12345" 等）
2. **切換到其他元素**：點擊 Body Textarea 或其他元素
3. **失去焦點**：Body Textarea 失去焦點時觸發變數解析
4. **數據被清空**：所有已輸入的變數示例數據都被清空

## 🔍 問題根因

在 `parseBodyVariables` 函數中，每次解析變數時都會創建新的變數對象並重置 `example` 為空字符串：

```javascript
// 問題代碼
const variables = matches.map(match => {
  const index = parseInt(match.replace(/\{\{|\}\}/g, ''));
  return { index, example: '' }; // ❌ 總是重置為空字符串
});
```

這導致即使用戶已經輸入了示例數據，也會在每次變數解析時被清空。

## ✅ 解決方案

### 修復邏輯

修改 `parseBodyVariables` 函數，保留現有的示例數據：

```javascript
// 修復後的代碼
const variables = matches.map(match => {
  const index = parseInt(match.replace(/\{\{|\}\}/g, ''));
  // ✅ 保留現有的示例數據，如果沒有則為空
  const existingVariable = bodyVariables.find(v => v.index === index);
  return { index, example: existingVariable?.example || '' };
});
```

### 關鍵改進

1. **數據保留**：檢查現有的 `bodyVariables` 中是否已有該變數的示例數據
2. **智能合併**：如果有現有數據則保留，沒有則設為空字符串
3. **依賴更新**：在 `useCallback` 的依賴數組中添加 `bodyVariables`

## 🔄 工作流程

### 修復前的工作流程：
```
1. 用戶輸入變數示例 → 保存到 bodyVariables
2. 用戶點擊 Body Textarea → 觸發 parseBodyVariables
3. parseBodyVariables 創建新對象 → example: '' (清空數據)
4. 用戶看到所有示例數據被清空 ❌
```

### 修復後的工作流程：
```
1. 用戶輸入變數示例 → 保存到 bodyVariables
2. 用戶點擊 Body Textarea → 觸發 parseBodyVariables
3. parseBodyVariables 檢查現有數據 → 保留現有 example 值
4. 用戶看到示例數據保持不變 ✅
```

## 🧪 測試場景

### 測試步驟：
1. **創建模板**：進入 Meta Template 創建頁面
2. **輸入 Body 內容**：輸入包含變數的內容，如 `Hello {{1}}, your order {{2}} is ready`
3. **輸入變數示例**：在變數示例框中輸入 "John" 和 "12345"
4. **切換焦點**：點擊 Body Textarea 或其他元素
5. **驗證數據**：確認變數示例數據沒有被清空

### 預期結果：
- ✅ 變數示例數據保持不變
- ✅ 用戶可以繼續編輯示例數據
- ✅ 變數解析功能正常工作

## 🔧 技術細節

### 代碼變更

**文件**：`src/pages/MetaTemplatePanel.js`

**修改前**：
```javascript
const parseBodyVariables = useCallback((text) => {
  const matches = text.match(/\{\{(\d+)\}\}/g);
  if (matches) {
    const variables = matches.map(match => {
      const index = parseInt(match.replace(/\{\{|\}\}/g, ''));
      return { index, example: '' }; // 問題：總是重置
    });
    setBodyVariables(variables);
  } else {
    setBodyVariables([]);
  }
}, []); // 問題：缺少 bodyVariables 依賴
```

**修改後**：
```javascript
const parseBodyVariables = useCallback((text) => {
  const matches = text.match(/\{\{(\d+)\}\}/g);
  if (matches) {
    const variables = matches.map(match => {
      const index = parseInt(match.replace(/\{\{|\}\}/g, ''));
      // 保留現有的示例數據，如果沒有則為空
      const existingVariable = bodyVariables.find(v => v.index === index);
      return { index, example: existingVariable?.example || '' };
    });
    setBodyVariables(variables);
  } else {
    setBodyVariables([]);
  }
}, [bodyVariables]); // 修復：添加 bodyVariables 依賴
```

### 關鍵改進點

1. **數據保留邏輯**：`existingVariable?.example || ''`
2. **依賴管理**：在 `useCallback` 依賴數組中添加 `bodyVariables`
3. **向後兼容**：對於新變數仍然設為空字符串

## 📊 影響評估

### 正面影響：
- ✅ **用戶體驗改善**：不再丟失已輸入的數據
- ✅ **功能穩定性**：變數解析功能更加可靠
- ✅ **開發效率**：減少用戶重複輸入的時間

### 潛在風險：
- ⚠️ **性能影響**：每次解析時需要查找現有變數（影響很小）
- ⚠️ **內存使用**：保留更多狀態數據（影響很小）

### 風險緩解：
- 變數數量通常很少（< 10個），性能影響可忽略
- 使用 `find()` 方法查找效率足夠高
- 數據量小，內存影響可忽略

## 🚀 部署建議

### 測試策略：
1. **功能測試**：確認變數示例數據不再被清空
2. **回歸測試**：確認其他功能正常工作
3. **用戶測試**：讓實際用戶驗證修復效果

### 監控指標：
1. **用戶反饋**：是否還有相關問題報告
2. **功能使用**：變數示例功能的使用率
3. **錯誤日誌**：是否有新的錯誤產生

---

*這個修復確保了用戶的輸入數據不會意外丟失，大大改善了用戶體驗！* ✨
