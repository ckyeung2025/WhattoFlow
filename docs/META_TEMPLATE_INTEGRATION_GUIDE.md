# Meta 模板管理整合指南

## 📋 已完成的工作

### 1. 後端實現 ✅
- ✅ `Services/WhatsAppMetaTemplateService.cs` - Meta 模板管理服務
- ✅ `Controllers/WhatsAppMetaTemplatesController.cs` - Meta 模板 API 控制器
- ✅ `Controllers/WhatsAppTokenValidationController.cs` - Token 權限驗證控制器
- ✅ `Program.cs` - 服務註冊

### 2. 前端實現 ✅
- ✅ `src/pages/MetaTemplatePanel.js` - Meta 模板管理面板（新建）
- ✅ `src/pages/InternalTemplatePanel.js` - 內部模板管理面板（待遷移）
- ✅ `src/pages/WhatsAppTemplateListNew.js` - 使用 Tabs 的主頁面（新建）

### 3. 功能特性 ✅
- ✅ 從 Meta API 獲取模板列表
- ✅ 創建 Meta 模板並提交審核
- ✅ 刪除 Meta 模板
- ✅ 同步模板狀態
- ✅ Token 權限驗證
- ✅ Tabs 分頁管理（內部模板 / Meta 模板）

---

## 🔧 下一步操作

### 步驟 1: 遷移內部模板功能

將 `WhatsAppTemplateList.js` 的內容遷移到 `InternalTemplatePanel.js`：

```javascript
// src/pages/InternalTemplatePanel.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
// ... 複製所有 import

const InternalTemplatePanel = () => {
  // 複製 WhatsAppTemplateList.js 中的所有狀態和函數
  const [templates, setTemplates] = useState([]);
  // ... 其他狀態
  
  // 複製所有函數
  const fetchTemplates = async () => { /* ... */ };
  // ... 其他函數
  
  // 返回原有的 JSX（去掉最外層的 Card 和標題）
  return (
    <div>
      {/* 搜索和篩選 */}
      <Card style={{ marginBottom: '16px' }}>
        {/* ... */}
      </Card>
      
      {/* 表格 */}
      <Table />
      
      {/* Modal 等 */}
    </div>
  );
};

export default InternalTemplatePanel;
```

### 步驟 2: 更新路由配置

修改您的路由文件（通常是 `App.js` 或 `routes.js`）：

```javascript
// 舊的
import WhatsAppTemplateList from './pages/WhatsAppTemplateList';

// 改為新的
import WhatsAppTemplateList from './pages/WhatsAppTemplateListNew';
```

或者直接將 `WhatsAppTemplateListNew.js` 重命名為 `WhatsAppTemplateList.js`：

```bash
# 備份原文件
mv src/pages/WhatsAppTemplateList.js src/pages/WhatsAppTemplateList.old.js

# 使用新文件
mv src/pages/WhatsAppTemplateListNew.js src/pages/WhatsAppTemplateList.js
```

### 步驟 3: 確保 Companies 表有必要欄位

確認您的 `Companies` 表包含以下欄位：

```sql
-- 檢查欄位
SELECT 
    COLUMN_NAME, 
    DATA_TYPE, 
    IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'Companies'
AND COLUMN_NAME IN ('WA_API_Key', 'WA_Business_Account_ID', 'WA_PhoneNo_ID');

-- 如果缺少欄位，請添加：
ALTER TABLE Companies
ADD WA_Business_Account_ID NVARCHAR(200) NULL;
```

---

## 🚀 使用說明

### 1. 驗證 Token 權限

在模板管理頁面點擊「驗證 Token 權限」按鈕，確認您的 Token 具備以下權限：
- ✅ `whatsapp_business_messaging`
- ✅ `whatsapp_business_management`
- ✅ `business_management` （可選）

### 2. 創建 Meta 模板

1. 切換到「Meta 官方模板」標籤
2. 點擊「創建 Meta 模板」
3. 填寫模板信息：
   - **名稱**：只能使用小寫字母、數字和下劃線（例如：`welcome_message_001`）
   - **類別**：
     - MARKETING：營銷訊息
     - UTILITY：實用訊息（客服、通知等）
     - AUTHENTICATION：驗證碼
   - **語言**：選擇模板語言
4. 配置內容組件：
   - **標題**（可選）：最多 60 字元
   - **正文**：必填，使用 `{{1}}`, `{{2}}` 表示變數
   - **頁腳**（可選）：最多 60 字元
   - **按鈕**（可選）：最多 3 個按鈕
5. 點擊「提交到 Meta 審核」

### 3. 模板審核狀態

- 🟡 **PENDING**：審核中（通常 24 小時內）
- 🟢 **APPROVED**：已通過，可以使用
- 🔴 **REJECTED**：已拒絕，需要修改後重新提交
- 🟠 **PAUSED**：已暫停

### 4. 使用已審核模板

在工作流程中使用已通過審核的 Meta 模板：

```javascript
// 發送 Meta 模板訊息
await sendWhatsAppTemplateMessage({
  to: '+85212345678',
  templateName: 'welcome_message_001',
  languageCode: 'zh_TW',
  parameters: {
    '1': '張三',
    '2': 'ORDER12345'
  }
});
```

---

## 📊 內部模板 vs Meta 模板

| 特性 | 內部模板 | Meta 模板 |
|-----|---------|----------|
| **審核** | ❌ 無需審核 | ✅ 需要 Meta 審核 |
| **使用限制** | 無限制 | 24小時對話窗口 |
| **適用場景** | 開發測試、內部通知 | 正式營銷、官方通知 |
| **變更速度** | 即時生效 | 需重新審核 |
| **模板類型** | Text, Media, Interactive, Location, Contact | TEXT (含按鈕) |
| **按鈕類型** | Quick Reply, URL, Phone | Quick Reply, URL, Phone |
| **發送限制** | 依帳號等級 | 依帳號等級 |

---

## 🔍 API 端點

### Meta 模板管理

```http
# 獲取 Meta 模板列表
GET /api/whatsappmetatemplates
Authorization: Bearer {token}

# 創建 Meta 模板
POST /api/whatsappmetatemplates
Content-Type: application/json
Authorization: Bearer {token}

{
  "name": "welcome_message",
  "category": "UTILITY",
  "language": "zh_TW",
  "components": [...]
}

# 刪除 Meta 模板
DELETE /api/whatsappmetatemplates/{templateName}
Authorization: Bearer {token}

# 同步模板狀態
POST /api/whatsappmetatemplates/sync
Authorization: Bearer {token}
```

### Token 驗證

```http
# 驗證 Token 權限
GET /api/whatsapptokenvalidation/validate-permissions
Authorization: Bearer {token}

# 測試模板管理 API
GET /api/whatsapptokenvalidation/test-template-api
Authorization: Bearer {token}
```

---

## ⚠️ 注意事項

1. **模板命名規則**
   - 只能使用小寫字母、數字和下劃線
   - 不能使用空格、特殊符號
   - 範例：`order_confirmation_v2`

2. **變數使用**
   - 變數從 `{{1}}` 開始，依序遞增
   - 必須提供變數示例值用於審核
   - 變數數量不要超過 10 個

3. **內容限制**
   - 標題：最多 60 字元
   - 正文：最多 1024 字元
   - 頁腳：最多 60 字元
   - 按鈕文字：最多 20 字元

4. **審核時間**
   - 通常 24 小時內完成
   - 高峰期可能需要 48 小時
   - 被拒絕後修改重新提交需要再次等待

5. **測試環境限制**
   - 測試帳號每天最多創建 10 個模板
   - 測試模板自動通過審核
   - 生產環境需要真實審核

---

## 🐛 常見問題

### Q1: Token 權限不足怎麼辦？
**A:** 前往 Meta Business Suite 重新生成系統用戶 Token，確保勾選 `whatsapp_business_management` 權限。

### Q2: 模板被拒絕了？
**A:** 查看拒絕原因，常見原因：
- 內容違反 WhatsApp 商業政策
- 變數使用不當
- 包含敏感信息
- 格式不符合規範

### Q3: 如何查看模板審核狀態？
**A:** 點擊「同步狀態」按鈕，系統會從 Meta API 獲取最新狀態。

### Q4: 內部模板和 Meta 模板可以同時使用嗎？
**A:** 可以！在不同場景使用不同類型的模板：
- 測試環境、快速迭代 → 使用內部模板
- 正式營銷、官方通知 → 使用 Meta 模板

---

## 📚 參考資源

- [WhatsApp Business Platform API 文檔](https://developers.facebook.com/docs/whatsapp/)
- [Message Templates 指南](https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates/)
- [Meta Business Suite](https://business.facebook.com/)

---

## ✅ 測試清單

- [ ] 後端服務正常啟動
- [ ] Token 權限驗證通過
- [ ] 可以獲取 Meta 模板列表
- [ ] 可以創建新的 Meta 模板
- [ ] 可以刪除 Meta 模板
- [ ] 可以同步模板狀態
- [ ] Tabs 切換正常工作
- [ ] 內部模板功能遷移完成
- [ ] 所有按鈕和操作正常
- [ ] 錯誤處理友好

---

*最後更新：2025-10-02*

