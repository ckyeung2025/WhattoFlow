# 工作流程節點合併 - Send WhatsApp 與 Send Template

## 概述
將 "Send WhatsApp Template" 節點的功能合併到 "Send WhatsApp" 節點中，通過 Tab 切換來選擇 "直接輸入訊息" 或 "使用模板" 兩種模式。

## 變更日期
2025-01-07

## 修改文件列表

### 前端修改

#### 1. `src/components/WorkflowDesigner/components/NodePropertyDrawer.js`
**功能**: 節點屬性編輯器

**主要修改**:
- 添加 `Tabs` 和圖標導入
- 在 `sendWhatsApp` 節點中添加 Tab 組件
- Tab 有兩個選項：
  - **直接輸入訊息** (`direct`): 顯示訊息輸入框和流程變量
  - **使用模板** (`template`): 顯示模板選擇和模板變量編輯

**數據結構**:
- 添加 `messageMode` 字段來標記當前模式 (`'direct'` 或 `'template'`)
- 保留所有原有字段（`message`, `templateId`, `templateName`, `variables` 等）

#### 2. `src/components/WorkflowDesigner/hooks/useWorkflowState.js`
**功能**: 工作流程狀態管理

**主要修改**:
- 從 `nodeTypes` 數組中移除 `sendWhatsAppTemplate`
- 更新 `sendWhatsApp` 的標籤為 `sendWhatsAppNode`

#### 3. `src/locales/zh-TC.js`, `src/locales/zh-SC.js`, `src/locales/en.js`
**功能**: 語言資源文件

**添加翻譯**:
```javascript
// 繁體中文
directMessage: '直接輸入訊息',
useTemplate: '使用模板',

// 簡體中文
directMessage: '直接输入讯息',
useTemplate: '使用模板',

// 英文
directMessage: 'Direct Message',
useTemplate: 'Use Template',
```

### 後端修改

#### 1. `Services/WorkflowEngine.cs`

**a) `ExecuteSendWhatsApp` 方法修改** (Line 732-870)

**功能**: 合併直接訊息和模板功能

**主要邏輯**:
```csharp
// 檢查 messageMode 字段
string messageMode = nodeData.MessageMode ?? "direct"; // 默認為直接訊息

if (messageMode == "template")
{
    // 模板模式邏輯
    // - 處理模板變量替換
    // - 調用 SendWhatsAppTemplateMessageWithTrackingAsync
}
else
{
    // 直接訊息模式邏輯
    // - 處理訊息變量替換
    // - 調用 SendWhatsAppMessageWithTrackingAsync
}
```

**b) `WorkflowNodeData` 類修改** (Line 2551-2640)

**添加屬性**:
```csharp
[System.Text.Json.Serialization.JsonPropertyName("messageMode")]
public string MessageMode { get; set; } // "direct" 或 "template"

[System.Text.Json.Serialization.JsonPropertyName("isMetaTemplate")]
public bool IsMetaTemplate { get; set; } // 標記是否為 Meta 官方模板
```

## 數據結構

### 節點數據示例

#### 直接訊息模式
```json
{
  "type": "sendWhatsApp",
  "taskName": "發送歡迎訊息",
  "messageMode": "direct",
  "to": "85296366318",
  "message": "你好！歡迎使用我們的服務。",
  "recipientDetails": {
    "users": [],
    "contacts": [],
    "groups": [],
    "hashtags": [],
    "useInitiator": false,
    "phoneNumbers": []
  }
}
```

#### 模板模式
```json
{
  "type": "sendWhatsApp",
  "taskName": "發送訂單確認",
  "messageMode": "template",
  "to": "85296366318",
  "templateId": "abc123",
  "templateName": "order_confirmation",
  "isMetaTemplate": false,
  "variables": {
    "order_number": "${orderNumber}",
    "customer_name": "${customerName}"
  },
  "recipientDetails": {
    "users": [],
    "contacts": [],
    "groups": [],
    "hashtags": [],
    "useInitiator": false,
    "phoneNumbers": []
  }
}
```

## 向後兼容性

### 1. 舊有的 `sendWhatsApp` 節點
- **兼容**: 當 `messageMode` 為 `null` 或 `undefined` 時，默認使用 `direct` 模式
- **行為**: 保持原有的直接訊息發送功能不變

### 2. 舊有的 `sendWhatsAppTemplate` 節點
- **處理方式**: 舊的 `sendWhatsAppTemplate` 節點在載入時可以通過以下方式處理：
  1. 手動轉換：用戶打開流程設計器時，可以將舊節點替換為新的 `sendWhatsApp` 節點（模板模式）
  2. 後端支持：`ExecuteSendWhatsAppTemplate` 方法仍保留在代碼中，確保舊流程可以繼續執行
  3. 逐步遷移：建議用戶逐步將舊流程更新為新結構

## 功能特點

### 1. 統一節點類型
- 只需一個 "Send WhatsApp" 節點
- 減少節點選擇的複雜性
- 更符合直覺的使用方式

### 2. Tab 切換
- 🟢 **直接輸入訊息**: 適用於簡單的文字訊息發送
- 🔵 **使用模板**: 適用於結構化的模板訊息

### 3. 界面保持不變
- 直接訊息的編輯界面完全不變
- 模板選擇的界面完全不變
- 只是通過 Tab 來組織這兩種模式

### 4. 支持 Meta 模板
- 在模板模式下，顯示是否為 Meta 官方模板的標記
- 與之前實現的 Meta 模板功能完全兼容

## 使用流程

### 創建新節點
1. 從左側工具欄拖拽 "Send WhatsApp" 節點到畫布
2. 雙擊節點打開屬性編輯
3. 選擇收件人
4. 切換 Tab 選擇模式：
   - **直接輸入訊息**: 在文字框中輸入訊息內容
   - **使用模板**: 點擊選擇模板按鈕，選擇內部模板或 Meta 模板
5. 配置完成後保存

### 編輯現有節點
- 舊的 `sendWhatsApp` 節點：打開後默認在 "直接輸入訊息" Tab
- 舊的 `sendWhatsAppTemplate` 節點：仍然可以正常執行，建議手動轉換為新格式

## 後端執行邏輯

### 1. 節點識別
```csharp
// 在 ExecuteNodeLogic 中
if (nodeData.Type == "sendWhatsApp")
{
    return await ExecuteSendWhatsApp(nodeData, stepExec, execution);
}
```

### 2. 模式判斷
```csharp
// 在 ExecuteSendWhatsApp 中
string messageMode = nodeData.MessageMode ?? "direct";

if (messageMode == "template")
{
    // 執行模板邏輯
}
else
{
    // 執行直接訊息邏輯
}
```

### 3. 訊息發送
- **直接訊息**: 調用 `SendWhatsAppMessageWithTrackingAsync`
- **模板訊息**: 調用 `SendWhatsAppTemplateMessageWithTrackingAsync`

## 測試建議

### 1. 前端測試
- ✅ 創建新的 `sendWhatsApp` 節點，測試 Tab 切換
- ✅ 在 "直接輸入訊息" Tab 中發送訊息
- ✅ 在 "使用模板" Tab 中選擇內部模板
- ✅ 在 "使用模板" Tab 中選擇 Meta 模板
- ✅ 測試流程變量在直接訊息中的替換
- ✅ 測試模板變量的編輯和替換

### 2. 後端測試
- ✅ 測試 `messageMode = "direct"` 的訊息發送
- ✅ 測試 `messageMode = "template"` 的模板訊息發送
- ✅ 測試 `messageMode = null` 時的默認行為（應該是 direct）
- ✅ 測試變量替換功能
- ✅ 測試收件人解析功能

### 3. 兼容性測試
- ✅ 載入含有舊 `sendWhatsApp` 節點的流程
- ✅ 執行含有舊 `sendWhatsApp` 節點的流程
- ⚠️ 載入含有舊 `sendWhatsAppTemplate` 節點的流程（建議手動轉換）
- ⚠️ 執行含有舊 `sendWhatsAppTemplate` 節點的流程（應該仍然可以執行）

## 遷移指南

### 將舊的 sendWhatsAppTemplate 節點轉換為新格式

#### 手動轉換步驟：
1. 打開流程設計器
2. 找到所有 `sendWhatsAppTemplate` 節點
3. 對於每個節點：
   - 記錄節點的模板配置（templateId, templateName, variables）
   - 刪除舊節點
   - 添加新的 `sendWhatsApp` 節點
   - 切換到 "使用模板" Tab
   - 重新配置模板選擇和變量
4. 保存流程

#### 未來可以實現的自動轉換（建議）：
```javascript
// 在載入流程時自動轉換
function convertOldTemplateNodes(nodes) {
  return nodes.map(node => {
    if (node.data.type === 'sendWhatsAppTemplate') {
      return {
        ...node,
        data: {
          ...node.data,
          type: 'sendWhatsApp',
          messageMode: 'template'
        }
      };
    }
    return node;
  });
}
```

## 未來清理工作

### 可以移除的代碼（在確保所有流程都已遷移後）：
1. `Services/WorkflowEngine.cs` 中的 `ExecuteSendWhatsAppTemplate` 方法
2. `src/components/WorkflowDesigner/components/NodePropertyDrawer.js` 中的 `sendWhatsAppTemplate` 節點編輯器
3. `Models/WorkflowNodeTypes.cs` 中的 `sendwhatsapptemplate` 定義

### 清理步驟：
1. 確認所有生產環境的流程都已更新
2. 運行數據庫查詢，確認沒有流程使用 `sendWhatsAppTemplate` 類型
3. 移除相關代碼
4. 更新文檔

## 總結

這次合併成功地將兩個功能相似的節點統一為一個節點，通過 Tab 切換來提供更好的用戶體驗：

### ✅ 優點：
1. **簡化節點選擇**: 減少節點類型，降低學習成本
2. **統一體驗**: 發送 WhatsApp 訊息只需要一個節點
3. **保持兼容**: 舊流程可以繼續運行
4. **易於擴展**: 未來可以添加更多訊息模式（如媒體訊息、位置訊息等）

### ⚠️ 注意事項：
1. 建議逐步遷移舊流程
2. 保留 `ExecuteSendWhatsAppTemplate` 方法以支持舊流程
3. 提供遷移文檔給用戶

### 📊 影響範圍：
- **前端**: 節點編輯器、節點類型定義、語言資源
- **後端**: WorkflowEngine 執行邏輯、數據模型
- **用戶**: 需要了解新的 Tab 切換方式（但界面本身沒有變化）

