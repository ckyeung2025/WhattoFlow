# 📝 表單提交修復 - FilledHtmlCode 保存問題

## 問題描述

用戶報告在 Manual Fill 表單提交後：
1. ✅ 表單狀態變為 "Submitted"
2. ❌ 數據庫中的 `FilledHtmlCode` 字段為空
3. ❌ 用戶填寫的數據沒有被保存

## 根本原因

### 前端提交邏輯錯誤

在 `src/pages/EFormInstancePage.js` 的 `handleSubmitForm` 函數中（第 303 行）：

```javascript
// ❌ 錯誤：只是提交原始 HTML，沒有獲取用戶填寫的數據
const formContent = instance.filledHtmlCode || instance.originalHtmlCode;
```

**問題分析**：
1. `instance.filledHtmlCode` 初始為 `null`（Manual Fill 不預填）
2. 回退到 `instance.originalHtmlCode`（原始空白表單）
3. 提交的是**空白表單**，不包含用戶填寫的數據
4. 後端保存的也是空白表單

### 正確的做法

需要從 **DOM** 中獲取用戶實際填寫的表單內容：

```javascript
// ✅ 正確：從 DOM 中獲取填寫後的 HTML
const formContainer = document.querySelector('.form-content-inner');
const filledHtmlCode = formContainer.innerHTML;
```

**注意**：表單是使用 `dangerouslySetInnerHTML` 直接渲染在頁面中，不是在 iframe 中。

## 修復方案

### 修改文件：`src/pages/EFormInstancePage.js`

#### 修復前的代碼

```javascript
const handleSubmitForm = async () => {
  try {
    if (!instance?.urlToken) {
      message.error('缺少訪問令牌');
      return;
    }

    // ❌ 錯誤：只獲取原始 HTML
    const formContent = instance.filledHtmlCode || instance.originalHtmlCode;
    
    const response = await fetch(`/api/eforminstances/${id}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        token: instance.urlToken,
        filledHtmlCode: formContent  // 提交的是空白表單
      })
    });

    // ...
  } catch (error) {
    console.error('提交表單錯誤:', error);
    message.error('提交失敗: ' + error.message);
  }
};
```

#### 修復後的代碼

```javascript
const handleSubmitForm = async () => {
  try {
    console.log('handleSubmitForm 被調用');
    
    if (!instance?.urlToken) {
      message.error('缺少訪問令牌');
      return;
    }

    // ✅ 正確：從 DOM 中獲取填寫後的表單內容
    const formContainer = document.querySelector('.form-content-inner');
    if (!formContainer) {
      console.error('找不到表單容器 .form-content-inner');
      message.error('無法獲取表單內容');
      return;
    }

    // 獲取表單容器的完整 HTML（包含用戶填寫的數據）
    const filledHtmlCode = formContainer.innerHTML;
    
    console.log('提交表單，FilledHtmlCode 長度:', filledHtmlCode.length);
    console.log('FilledHtmlCode 前 200 字符:', filledHtmlCode.substring(0, 200));
    
    const response = await fetch(`/api/eforminstances/${id}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        token: instance.urlToken,
        filledHtmlCode: filledHtmlCode  // 提交包含用戶數據的 HTML
      })
    });

    console.log('提交響應狀態:', response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }));
      console.error('提交失敗，錯誤:', errorData);
      throw new Error(errorData.error || `提交失敗: ${response.status}`);
    }

    const result = await response.json();
    console.log('提交成功，結果:', result);
    message.success('表單提交成功！');
    
    // 更新實例狀態
    setInstance(prev => ({
      ...prev,
      status: 'Submitted',
      filledHtmlCode: filledHtmlCode  // 同時更新本地狀態
    }));
    
  } catch (error) {
    console.error('提交表單錯誤:', error);
    message.error('提交失敗: ' + error.message);
  }
};
```

## 技術細節

### DOM 訪問（非 iframe）

```javascript
// 獲取表單容器元素
const formContainer = document.querySelector('.form-content-inner');

// 獲取容器的 innerHTML（包含用戶填寫的數據）
const filledHtmlCode = formContainer.innerHTML;
```

**重要**：表單是使用 `dangerouslySetInnerHTML` 直接渲染在頁面中，不是在 iframe 中。

### 為什麼使用 innerHTML？

- `innerHTML` 獲取容器內的所有 HTML 內容
- 保留所有 CSS 樣式和 JavaScript
- 保留用戶填寫的表單數據（`value` 屬性會被更新）
- 可以完整還原用戶看到的表單

### 表單數據如何保存？

當用戶在 `<input>` 或 `<select>` 中輸入數據時：

```html
<!-- 原始 HTML -->
<input type="text" id="name" name="name" value="" />

<!-- 用戶填寫後，DOM 的 value 屬性（property）會更新，但 HTML 屬性（attribute）不會自動更新 -->
<!-- 我們需要手動將 property 的值寫入 attribute -->

<!-- 處理後的 HTML -->
<input type="text" id="name" name="name" value="張三" />
```

### DOM Property vs HTML Attribute

**關鍵概念**：
- **DOM Property**：`input.value`（用戶輸入時會自動更新）
- **HTML Attribute**：`input.getAttribute('value')`（不會自動更新）

**解決方案**：
```javascript
// 將 DOM property 的值寫入 HTML attribute
input.setAttribute('value', input.value);
```

### 完整的表單元素處理

```javascript
// 1. Text inputs
inputs.forEach(input => {
  if (input.value) {
    input.setAttribute('value', input.value);
  }
});

// 2. Textareas
textareas.forEach(textarea => {
  if (textarea.value) {
    textarea.textContent = textarea.value;
  }
});

// 3. Select dropdowns
selects.forEach(select => {
  const selectedOption = select.options[select.selectedIndex];
  if (selectedOption) {
    Array.from(select.options).forEach(opt => opt.removeAttribute('selected'));
    selectedOption.setAttribute('selected', 'selected');
  }
});

// 4. Checkboxes and radios
checkboxes.forEach(checkbox => {
  if (checkbox.checked) {
    checkbox.setAttribute('checked', 'checked');
  } else {
    checkbox.removeAttribute('checked');
  }
});
```

## 測試驗證

### 測試步驟

1. **訪問表單**：
   ```
   http://localhost:3000/eform-instance/b5f9dc41-b43a-42bf-a025-c04998eaa590?token=...
   ```

2. **填寫表單**：
   - 填寫姓名：`測試用戶`
   - 填寫 WhatsApp：`85296366318`
   - 選擇日期：`2025-10-15`
   - 選擇時間：`Morning`
   - 選擇皮膚問題：`Dryness`
   - 勾選同意框

3. **提交表單**：
   - 點擊 "Register Now 立即註冊" 按鈕
   - 應該顯示 "表單提交成功！"

4. **驗證數據庫**：
   ```sql
   SELECT 
       Id,
       InstanceName,
       Status,
       LEN(FilledHtmlCode) as FilledHtmlCodeLength,
       FilledHtmlCode
   FROM eFormInstances
   WHERE Id = 'b5f9dc41-b43a-42bf-a025-c04998eaa590';
   ```

   **預期結果**：
   - `Status`: `Submitted`
   - `FilledHtmlCodeLength`: > 0（例如 5000+ 字符）
   - `FilledHtmlCode`: 包含完整的 HTML，其中 `<input>` 的 `value` 屬性包含用戶填寫的數據

5. **重新查看表單**：
   - 在 Workflow Monitor 中點擊 "View Form Instance"
   - 應該能看到用戶填寫的數據

## 後端驗證

後端代碼已經正確（`Controllers/EFormInstancesController.cs` 第 596 行）：

```csharp
// 更新表單內容
instance.FilledHtmlCode = request.FilledHtmlCode;
instance.Status = "Submitted";
instance.UpdatedAt = DateTime.UtcNow;

await _db.SaveChangesAsync();
```

只要前端發送正確的 `FilledHtmlCode`，後端就會正確保存。

## 相關問題

### 問題 1: iframe 跨域限制

如果表單 HTML 來自不同域名，可能會遇到跨域限制：

```javascript
// 可能的錯誤
// Uncaught DOMException: Blocked a frame with origin "http://localhost:3000" 
// from accessing a cross-origin frame.
```

**解決方案**：
- 確保表單 HTML 通過同源的 API 加載
- 使用 `sandbox` 屬性時要小心（會限制 DOM 訪問）

### 問題 2: 表單驗證

在提交前，可以添加表單驗證：

```javascript
// 檢查必填字段
const inputs = iframeDoc.querySelectorAll('input[required], select[required]');
for (const input of inputs) {
  if (!input.value) {
    message.error(`請填寫必填字段: ${input.name || input.id}`);
    return;
  }
}
```

### 問題 3: 大型表單

如果表單非常大（例如包含大量圖片），`FilledHtmlCode` 可能會很大：

**建議**：
- 考慮只保存表單數據（JSON 格式），而不是完整的 HTML
- 或者壓縮 HTML 後再保存
- 或者將圖片等資源單獨存儲

## 相關文件

- `src/pages/EFormInstancePage.js` - 前端表單頁面（主要修復）
- `Controllers/EFormInstancesController.cs` - 後端提交端點（無需修改）
- `Models/EFormInstance.cs` - 數據模型（無需修改）

## 修復日期

2025-10-13

## 修復人員

AI Assistant (Claude Sonnet 4.5)

## 用戶反饋

用戶報告表單提交後，數據庫中的 `FilledHtmlCode` 字段為空，用戶填寫的數據沒有被保存。經過分析發現前端只提交了原始空白表單，沒有從 iframe DOM 中獲取實際填寫的數據。

