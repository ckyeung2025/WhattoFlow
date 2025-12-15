# 🧪 Manual Fill 快速測試指南

## 當前狀態

✅ **所有修復已完成**：
1. ✅ Token 實例 ID 匹配
2. ✅ 前端路由匿名訪問
3. ✅ Token URL 編碼
4. ✅ 表單數據保存（將 DOM property 寫入 HTML attribute）

## 🚀 快速測試步驟

### 1. 重啟後端服務

```bash
# 停止當前運行的後端（Ctrl+C）
cd C:\GIT\WhattoFlow
dotnet run
```

### 2. 前端會自動重新編譯

前端服務會檢測到文件變更並自動重新編譯。如果沒有，請：
```bash
# 停止前端（Ctrl+C）
npm start
```

### 3. 創建新的工作流程執行

- 在系統中觸發一個新的 Manual Fill 工作流程
- 例如：流程 2491 或更新的流程

### 4. 檢查 WhatsApp 消息

確認收到的 URL 格式正確：
```
✅ 正確: /eform-instance/{id}?token=...%2B...%2F...
❌ 錯誤: /eform-instance/{id}?token=...+.../...  (沒有編碼)
```

### 5. 訪問表單（匿名）

在**無痕窗口**中打開完整 URL：
```
http://localhost:3000/eform-instance/{id}?token=...
```

**預期結果**：
- ✅ 直接顯示表單（無需登入）
- ✅ 沒有側邊欄和導航
- ✅ 看到 "Beauty Plus – New Member Offer" 表單

### 6. 填寫表單

填寫所有字段：
- **Full Name**: `測試用戶`
- **WhatsApp Number**: `85296366318`
- **Preferred Date**: `2025-10-15`
- **Preferred Time**: `Morning`
- **Skin Concern**: `Dryness`
- **同意**: ✅ 勾選

### 7. 提交表單

點擊 **"Register Now 立即註冊"** 或 **"提交表單"** 按鈕。

**查看 Console**（F12），應該看到：
```
提交按鈕被點擊！
handleSubmitForm 被調用
設置 input name value: 測試用戶
設置 input whatsapp value: 85296366318
設置 input date value: 2025-10-15
設置 select time selected: morning
設置 select concern selected: dryness
設置 checkbox 同意 checked
提交表單，FilledHtmlCode 長度: 5234
FilledHtmlCode 前 500 字符: <html lang="en">...
提交響應狀態: 200
提交成功，結果: {success: true, ...}
```

**預期結果**：
- ✅ 顯示 "表單提交成功！"
- ✅ 狀態變為 "Submitted"（藍色標籤）

### 8. 驗證數據庫

運行 SQL 查詢：
```sql
SELECT 
    Id,
    InstanceName,
    Status,
    LEN(FilledHtmlCode) as HtmlLength,
    RecipientWhatsAppNo,
    CreatedAt
FROM eFormInstances
WHERE Id = '{your_instance_id}'
ORDER BY CreatedAt DESC;
```

**預期結果**：
- ✅ `Status`: `Submitted`
- ✅ `HtmlLength`: > 0（例如 5000+）

### 9. 檢查 FilledHtmlCode 內容

```sql
SELECT 
    FilledHtmlCode
FROM eFormInstances
WHERE Id = '{your_instance_id}';
```

**預期內容**（應該包含用戶填寫的值）：
```html
<input type="text" id="name" name="name" value="測試用戶" required="">
<input type="tel" id="whatsapp" name="whatsapp" value="85296366318" required="">
<input type="date" id="date" name="date" value="2025-10-15">
<select id="time" name="time" required="">
    <option value="morning" selected="selected">Morning 早上</option>
    <option value="afternoon">Afternoon 下午</option>
    <option value="evening">Evening 晚上</option>
</select>
<select id="concern" name="concern" required="">
    <option value="dryness" selected="selected">Dryness 乾燥</option>
    <option value="dullness">Dullness 暗啞</option>
    ...
</select>
<input type="checkbox" name="同意" checked="checked" required="">
```

### 10. 在 Workflow Monitor 中查看

- 登入系統
- 進入 Workflow Monitor
- 查看流程執行記錄
- 點擊 "View Form Instance"
- **預期結果**：
  - ✅ 看到用戶填寫的完整數據
  - ✅ 表單字段顯示用戶輸入的值

---

## 🔍 故障排除

### 問題 A: 按鈕沒有反應

**檢查 Console**：
- 如果看到 "提交按鈕被點擊！" → 按鈕事件正常
- 如果什麼都沒有 → 按鈕可能沒有被渲染

**解決方案**：
- 刷新頁面（Ctrl+R）
- 檢查 `instance.isManualFill` 是否為 `true`

### 問題 B: 找不到表單容器

**Console 錯誤**：
```
找不到表單容器 .form-content-inner
```

**解決方案**：
- 檢查表單是否已加載
- 等待幾秒後再點擊提交按鈕

### 問題 C: FilledHtmlCode 沒有 value

**檢查 Console**：
```
設置 input name value: 測試用戶
設置 input whatsapp value: 85296366318
...
```

如果看不到這些日誌，說明：
- 表單元素沒有被正確選擇
- 用戶沒有填寫數據

**解決方案**：
- 確認填寫了所有字段
- 檢查 Console 的完整輸出

### 問題 D: Token 驗證失敗

**Console 錯誤**：
```
提交響應狀態: 401
提交失敗，錯誤: {error: "無效的訪問令牌"}
```

**解決方案**：
- 使用新生成的工作流程（舊的 Token 可能無效）
- 確認 Token 已正確 URL 編碼

---

## 📋 完整的測試檢查清單

- [ ] 後端服務正在運行
- [ ] 前端服務正在運行
- [ ] 創建了新的工作流程執行
- [ ] WhatsApp 消息中的 Token 已正確編碼（包含 `%2B`, `%2F`）
- [ ] 在無痕窗口中訪問 URL
- [ ] 表單正常顯示
- [ ] 填寫了所有必填字段
- [ ] 點擊提交按鈕
- [ ] Console 顯示完整的調試日誌
- [ ] 看到 "表單提交成功！" 消息
- [ ] 數據庫中的 `FilledHtmlCode` 有值
- [ ] `FilledHtmlCode` 中包含 `value="用戶輸入"` 屬性
- [ ] 在 Workflow Monitor 中可以查看提交的數據

---

## 🎯 預期的 Console 輸出

```
EFormInstancePage useEffect 被調用，id: 421b4265-bea5-4f58-9645-ed54f2d3d468
URL Token: LlbygVqmEtx0+ZHA0IfuCRGzcqXOdFBjyK0Ia5ZW1bU0MjFiNDI2NS1iZWE1LTRmNTgtOTY0NS1lZDU0ZjJkM2Q0Njg6ODUyOTYzNjYzMTg6NjM4OTU5MjI5MzAxMTk4ODAz
validateTokenAndFetchInstance 被調用，token: ...
獲取到的實例數據: {id: '...', instanceName: '...', ...}
當前實例狀態: Pending 是否為 Manual Fill: true
按鈕條件檢查: true
進入 Space，isManualFill: true
渲染 Manual Fill 提交按鈕
--- 用戶點擊提交按鈕 ---
提交按鈕被點擊！
handleSubmitForm 被調用
設置 input name value: 測試用戶
設置 input whatsapp value: 85296366318
設置 input date value: 2025-10-15
設置 select time selected: morning
設置 select concern selected: dryness
設置 checkbox 同意 checked
提交表單，FilledHtmlCode 長度: 5234
FilledHtmlCode 前 500 字符: <html lang="en"><head>...
提交響應狀態: 200
提交成功，結果: {success: true, message: '表單提交成功', instanceId: '...', status: 'Submitted'}
```

---

## 🎉 成功標誌

如果看到以下情況，說明一切正常：

1. ✅ Console 顯示 "設置 input ... value: ..." 日誌
2. ✅ Console 顯示 "提交響應狀態: 200"
3. ✅ 頁面顯示 "表單提交成功！"
4. ✅ 數據庫中的 `FilledHtmlCode` 包含 `value="用戶輸入"` 屬性
5. ✅ 在 Workflow Monitor 中可以看到用戶填寫的數據

---

**測試日期**: 2025-10-13  
**功能狀態**: ✅ 已完成，等待測試驗證

