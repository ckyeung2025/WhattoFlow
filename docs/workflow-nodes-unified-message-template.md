# 工作流程節點統一訊息模板功能

## 概述
為以下四個發送訊息的節點統一添加 Tab 切換功能，讓所有節點都可以選擇 "直接輸入訊息" 或 "使用模板"：
1. **Send WhatsApp Node** - 發送 WhatsApp 訊息
2. **Wait Reply Node** - 等待回覆節點
3. **Wait for QR Code Node** - 等待 QR Code 掃描
4. **Form Node (sendEForm)** - 發送電子表單

## 變更日期
2025-01-07

---

## 修改文件列表

### 前端修改

#### 1. `src/components/WorkflowDesigner/components/NodePropertyDrawer.js`

**所有四個節點都添加了相同的 Tab 結構**：

```javascript
<Tabs
  activeKey={selectedNode.data.messageMode || 'direct'}
  onChange={(key) => handleNodeDataChange({ messageMode: key })}
  items={[
    {
      key: 'direct',
      label: <span><MessageOutlined /> 直接輸入訊息</span>,
      children: <直接訊息編輯界面>
    },
    {
      key: 'template',
      label: <span><FileTextOutlined /> 使用模板</span>,
      children: <模板選擇和變量編輯界面>
    }
  ]}
/>
```

**修改的節點區域**：
- **sendWhatsApp**: Line 644-838
- **waitReply**: Line 968-1170
- **waitForQRCode**: Line 1219-1433
- **sendEForm**: Line 1991-2143

#### 2. 語言資源文件

**zh-TC.js**, **zh-SC.js**, **en.js** 都已添加：
```javascript
directMessage: '直接輸入訊息',
useTemplate: '使用模板',
```

---

### 後端修改

#### 1. `Services/WorkflowEngine.cs`

**修改的方法**：

##### a) `ExecuteSendWhatsApp` (Line 732-870)
- 通過 `messageMode` 判斷使用直接訊息或模板
- 支持內部模板和 Meta 模板

##### b) `ExecuteWaitReply` (Line 959-1099)
- 添加訊息模式判斷
- 模板模式：調用 `SendWhatsAppTemplateMessageWithTrackingAsync`
- 直接訊息模式：調用 `SendWhatsAppMessageWithTrackingAsync`

##### c) `ExecuteWaitForQRCode` (Line 1102-1247)
- 添加訊息模式判斷
- 支持模板和直接訊息兩種模式

##### d) `ExecuteSendEForm` (Line 1600-1927)
- 添加訊息模式判斷
- 模板模式：自動將 `formUrl` 和 `formName` 添加為模板變數
- 直接訊息模式：保持原有的自定義訊息和預設訊息邏輯

#### 2. `WorkflowNodeData` 類 (Line 2551-2640)

**已有的屬性**（之前添加的）：
```csharp
[JsonPropertyName("messageMode")]
public string MessageMode { get; set; } // "direct" 或 "template"

[JsonPropertyName("isMetaTemplate")]
public bool IsMetaTemplate { get; set; } // 標記是否為 Meta 官方模板
```

---

## 功能特點

### 🎯 統一體驗
所有發送訊息的節點都使用相同的 Tab 切換界面：
- 🟢 **直接輸入訊息**: 適用於簡單文字訊息
- 🔵 **使用模板**: 適用於結構化模板訊息（內部模板或 Meta 模板）

### 📋 節點功能對照表

| 節點類型 | 直接訊息模式 | 模板模式 | 特殊功能 |
|---------|------------|---------|---------|
| **Send WhatsApp** | 輸入訊息內容 | 選擇模板 + 變數編輯 | - |
| **Wait Reply** | 輸入提示訊息 | 選擇模板 + 變數編輯 | 等待用戶回覆 |
| **Wait for QR Code** | 輸入提示訊息 | 選擇模板 + 變數編輯 | 等待 QR Code 掃描 |
| **Form Node** | 預設/自定義訊息 | 選擇模板 + 變數編輯 | 自動添加 formUrl/formName 變數 |

---

## 節點數據結構

### 1. Send WhatsApp Node

#### 直接訊息模式
```json
{
  "type": "sendWhatsApp",
  "messageMode": "direct",
  "to": "85296366318",
  "message": "您好！歡迎使用我們的服務。",
  "recipientDetails": {...}
}
```

#### 模板模式
```json
{
  "type": "sendWhatsApp",
  "messageMode": "template",
  "to": "85296366318",
  "templateId": "abc123",
  "templateName": "welcome_message",
  "isMetaTemplate": false,
  "variables": {
    "customer_name": "${customerName}"
  },
  "recipientDetails": {...}
}
```

### 2. Wait Reply Node

#### 直接訊息模式
```json
{
  "type": "waitReply",
  "messageMode": "direct",
  "replyType": "initiator",
  "message": "請輸入您的回覆",
  "validation": {...}
}
```

#### 模板模式
```json
{
  "type": "waitReply",
  "messageMode": "template",
  "replyType": "initiator",
  "templateId": "xyz789",
  "templateName": "request_feedback",
  "isMetaTemplate": true,
  "variables": {
    "topic": "${topicName}"
  },
  "validation": {...}
}
```

### 3. Wait for QR Code Node

#### 直接訊息模式
```json
{
  "type": "waitForQRCode",
  "messageMode": "direct",
  "replyType": "initiator",
  "qrCodeVariable": "qrData",
  "message": "請上傳包含 QR Code 的圖片",
  "timeout": 300
}
```

#### 模板模式
```json
{
  "type": "waitForQRCode",
  "messageMode": "template",
  "replyType": "initiator",
  "qrCodeVariable": "qrData",
  "templateId": "qr123",
  "templateName": "request_qr_code",
  "variables": {
    "instruction": "請掃描收到的 QR Code"
  },
  "timeout": 300
}
```

### 4. Form Node (sendEForm)

#### 直接訊息模式
```json
{
  "type": "sendEForm",
  "messageMode": "direct",
  "formId": "form123",
  "formName": "請假申請表",
  "to": "85296366318",
  "useCustomMessage": true,
  "messageTemplate": "請填寫{formName}：\n{formUrl}",
  "sendEFormMode": "integrateWaitReply",
  "recipientDetails": {...}
}
```

#### 模板模式
```json
{
  "type": "sendEForm",
  "messageMode": "template",
  "formId": "form123",
  "formName": "請假申請表",
  "to": "85296366318",
  "templateId": "form456",
  "templateName": "form_notification",
  "variables": {
    "deadline": "2024-12-31"
  },
  "sendEFormMode": "integrateWaitReply",
  "recipientDetails": {...}
}
```

> **注意**: Form Node 在模板模式下會自動添加以下變數：
> - `formUrl`: 表單填寫連結
> - `formName`: 表單名稱

---

## 後端執行邏輯

### 訊息模式判斷邏輯（所有節點統一）

```csharp
// 獲取訊息模式（默認為 direct）
string messageMode = nodeData.MessageMode ?? "direct";

// 判斷是否應該發送訊息
bool shouldSendMessage = (messageMode == "direct" && !string.IsNullOrEmpty(nodeData.Message)) ||
                        (messageMode == "template" && !string.IsNullOrEmpty(nodeData.TemplateName));

if (shouldSendMessage)
{
    if (messageMode == "template")
    {
        // 處理模板變數
        var processedVariables = new Dictionary<string, string>();
        if (nodeData.Variables != null)
        {
            foreach (var kvp in nodeData.Variables)
            {
                var processedValue = await _variableReplacementService.ReplaceVariablesAsync(kvp.Value, execution.Id);
                processedVariables[kvp.Key] = processedValue;
            }
        }
        
        // 發送模板訊息
        await _whatsAppWorkflowService.SendWhatsAppTemplateMessageWithTrackingAsync(...);
    }
    else
    {
        // 發送直接訊息
        await _whatsAppWorkflowService.SendWhatsAppMessageWithTrackingAsync(...);
    }
}
```

---

## 向後兼容性

### 默認行為
- 當 `messageMode` 為 `null` 或 `undefined` 時，**默認使用 `direct` 模式**
- 所有舊的流程會自動使用直接訊息模式，無需修改

### 舊節點處理
| 節點類型 | 舊數據結構 | 新結構行為 |
|---------|----------|----------|
| 所有節點 | 只有 `message` 字段 | 自動使用 `direct` 模式 |
| 所有節點 | 沒有 `messageMode` | 默認為 `direct` |

---

## 使用場景示例

### 1. Send WhatsApp Node
**場景**: 發送訂單確認
- **直接訊息**: "您的訂單 #12345 已確認，預計 3-5 個工作天送達。"
- **模板訊息**: 使用 Meta 審核通過的 "order_confirmation" 模板

### 2. Wait Reply Node
**場景**: 詢問用戶選擇
- **直接訊息**: "請輸入您想要的服務類型 (A/B/C)"
- **模板訊息**: 使用帶按鈕的互動模板

### 3. Wait for QR Code Node
**場景**: 請求掃描收據
- **直接訊息**: "請上傳您的收據 QR Code 圖片"
- **模板訊息**: 使用包含範例圖片的模板

### 4. Form Node
**場景**: 發送請假表單
- **直接訊息**: "請填寫請假申請表：[連結]"
- **模板訊息**: 使用帶有公司 Logo 和說明的官方模板
  - 自動提供變數: `{formUrl}`, `{formName}`

---

## 測試建議

### 前端測試

#### 1. Send WhatsApp Node
- ✅ Tab 切換正常
- ✅ 直接訊息模式：輸入訊息，流程變數顯示和點擊插入
- ✅ 模板模式：選擇內部模板，編輯變數
- ✅ 模板模式：選擇 Meta 模板，顯示審核狀態

#### 2. Wait Reply Node
- ✅ Tab 切換正常
- ✅ 直接訊息模式：輸入提示訊息
- ✅ 模板模式：選擇模板，編輯變數
- ✅ 驗證配置功能正常

#### 3. Wait for QR Code Node
- ✅ Tab 切換正常
- ✅ 直接訊息模式：輸入提示訊息
- ✅ 模板模式：選擇模板，編輯變數
- ✅ QR Code 變數選擇正常

#### 4. Form Node
- ✅ Tab 切換正常
- ✅ 直接訊息模式：預設訊息/自定義訊息切換
- ✅ 模板模式：選擇模板，自動添加 formUrl/formName 變數
- ✅ 三種填表模式正常運作

### 後端測試

#### 1. 直接訊息模式測試
- ✅ Send WhatsApp: 發送直接訊息
- ✅ Wait Reply: 發送提示訊息並等待
- ✅ Wait for QR Code: 發送提示訊息並等待 QR Code
- ✅ Form Node: 發送表單連結訊息

#### 2. 模板模式測試
- ✅ Send WhatsApp: 發送內部模板訊息
- ✅ Send WhatsApp: 發送 Meta 模板訊息
- ✅ Wait Reply: 發送模板提示訊息
- ✅ Wait for QR Code: 發送模板提示訊息
- ✅ Form Node: 發送模板通知（帶 formUrl/formName 變數）

#### 3. 變數替換測試
- ✅ 直接訊息中的流程變數 `${variableName}` 替換
- ✅ 模板變數的流程變數替換
- ✅ Form Node 的自動變數注入（formUrl, formName）

#### 4. 向後兼容測試
- ✅ 載入舊流程（沒有 messageMode 字段）
- ✅ 執行舊流程（默認為 direct 模式）
- ✅ 確認舊數據不會丟失

---

## 實現細節

### 前端 Tab 組件結構

每個節點的 Tab 都包含兩個選項：

#### 1. 直接輸入訊息 (direct)
- 顯示訊息輸入框
- 顯示可用的流程變數（可點擊插入）
- 支持變數語法 `${variableName}`

#### 2. 使用模板 (template)
- 模板選擇輸入框（只讀，點擊打開 TemplateModal）
- 顯示已選模板信息（ID、名稱、是否為 Meta 模板）
- 模板變數編輯器：
  - 添加變數按鈕
  - 變數名稱 + 變數值配對
  - 刪除變數按鈕
  - 支持流程變數語法 `${variableName}`

### 後端執行邏輯

所有節點使用統一的判斷邏輯：

```csharp
// 1. 確定訊息模式
string messageMode = nodeData.MessageMode ?? "direct";

// 2. 檢查是否需要發送訊息
bool shouldSendMessage = 
    (messageMode == "direct" && !string.IsNullOrEmpty(nodeData.Message)) ||
    (messageMode == "template" && !string.IsNullOrEmpty(nodeData.TemplateName));

// 3. 根據模式發送
if (messageMode == "template")
{
    // 處理模板變數替換
    var processedVariables = ProcessTemplateVariables(nodeData.Variables);
    
    // 發送模板訊息
    await SendWhatsAppTemplateMessageWithTrackingAsync(...);
}
else
{
    // 處理訊息變數替換
    var processedMessage = await ReplaceVariablesAsync(nodeData.Message);
    
    // 發送直接訊息
    await SendWhatsAppMessageWithTrackingAsync(...);
}
```

---

## 特殊處理

### Form Node 的特殊變數

在 Form Node 的模板模式下，系統會自動添加兩個變數：

```csharp
// 自動添加表單相關變數
processedVariables["formUrl"] = formUrl;
processedVariables["formName"] = nodeData.FormName ?? "";
```

這樣在模板中可以使用：
- `{{formUrl}}`: 表單填寫連結
- `{{formName}}`: 表單名稱

**使用示例**：
```
親愛的客戶，

請填寫 {{formName}}：
{{formUrl}}

如有問題請聯繫客服。
```

---

## 用戶指南

### 如何在節點中使用模板

1. **拖拽節點** 到畫布（Send WhatsApp / Wait Reply / Wait for QR Code / Form）
2. **雙擊節點** 打開屬性編輯
3. **配置收件人** （對於有收件人配置的節點）
4. **切換到 "使用模板" Tab**
5. **點擊模板選擇框**
6. **選擇模板**：
   - 內部模板 Tab: 自定義創建的模板
   - Meta 官方模板 Tab: Meta 審核通過的官方模板
7. **編輯模板變數**（如果模板有變數）：
   - 點擊 "添加變數" 按鈕
   - 輸入變數名稱和值
   - 值可以使用流程變數語法：`${variableName}`
8. **保存並測試**

---

## 向後兼容策略

### 自動處理舊節點
- 舊節點沒有 `messageMode` 字段
- 後端自動默認為 `"direct"` 模式
- 舊的直接訊息功能完全不受影響

### 數據遷移（可選）
如果需要為舊節點顯式添加 `messageMode` 字段：

```javascript
// 在載入流程時
function normalizeNodeData(nodes) {
  return nodes.map(node => ({
    ...node,
    data: {
      ...node.data,
      messageMode: node.data.messageMode || 'direct'
    }
  }));
}
```

---

## API 依賴

### 模板相關 API

#### 1. 獲取內部模板
- **端點**: `GET /api/whatsapptemplates?status=Active`
- **用途**: 獲取可用的內部模板列表

#### 2. 獲取 Meta 模板
- **端點**: `GET /api/whatsappmetatemplates`
- **用途**: 獲取已審核通過的 Meta 官方模板

#### 3. 發送模板訊息
- **Service**: `WhatsAppWorkflowService.SendWhatsAppTemplateMessageWithTrackingAsync`
- **用途**: 發送模板訊息並記錄追蹤

---

## 優勢

### 1. 統一體驗
- 所有節點使用相同的 Tab 切換模式
- 降低學習成本
- 提高用戶體驗一致性

### 2. 功能增強
- 所有發送訊息的節點都支持模板
- 靈活性大幅提升
- 支持 Meta 官方模板的豐富功能

### 3. 維護性
- 代碼結構統一
- 便於未來擴展（如添加媒體訊息模式）
- 容易理解和維護

### 4. 向後兼容
- 舊流程無需修改
- 自動默認為直接訊息模式
- 平滑升級

---

## 注意事項

1. **必選字段檢查**:
   - 直接訊息模式: 必須填寫 `message`
   - 模板模式: 必須選擇 `templateName`

2. **Form Node 特殊處理**:
   - 在模板模式下，`formUrl` 和 `formName` 會自動添加到變數中
   - 用戶不需要手動設置這兩個變數

3. **Meta 模板限制**:
   - 只顯示狀態為 `APPROVED` 的 Meta 模板
   - Meta 模板必須符合 Meta 的格式要求

4. **訊息追蹤**:
   - 所有發送的訊息都會記錄到 `WorkflowMessageSends` 表
   - 節點類型欄位仍保持原節點類型（sendWhatsApp, waitReply 等）

---

## 測試腳本建議

### 前端測試流程

```javascript
// 測試流程 1: Send WhatsApp - 直接訊息
1. 創建 Send WhatsApp 節點
2. 選擇收件人
3. 確認默認在 "直接輸入訊息" Tab
4. 輸入訊息 "測試訊息 ${customerName}"
5. 點擊流程變數插入
6. 保存並執行

// 測試流程 2: Send WhatsApp - 模板
1. 創建 Send WhatsApp 節點
2. 選擇收件人
3. 切換到 "使用模板" Tab
4. 選擇內部模板
5. 添加變數並設置值
6. 保存並執行

// 測試流程 3: Wait Reply - 模板
1. 創建 Wait Reply 節點
2. 設置 replyType 為 "initiator"
3. 切換到 "使用模板" Tab
4. 選擇 Meta 模板
5. 編輯模板變數
6. 保存並執行

// 測試流程 4: Form Node - 模板
1. 創建 Form 節點
2. 選擇表單
3. 選擇收件人
4. 切換到 "使用模板" Tab
5. 選擇通知模板
6. 確認 formUrl 和 formName 自動添加
7. 保存並執行
```

---

## 總結

這次更新成功地將模板功能統一應用到所有發送訊息的節點：

### ✅ 完成的工作：
1. ✅ **Send WhatsApp Node**: 合併了直接訊息和模板功能
2. ✅ **Wait Reply Node**: 添加了模板支持
3. ✅ **Wait for QR Code Node**: 添加了模板支持
4. ✅ **Form Node**: 添加了模板支持（帶自動變數注入）
5. ✅ 前端 UI 統一使用 Tab 切換
6. ✅ 後端執行邏輯統一處理
7. ✅ 向後兼容舊流程
8. ✅ 多語言支持（繁中、簡中、英文）

### 🎯 用戶受益：
- 更統一的操作體驗
- 更強大的模板功能
- 支持 Meta 官方模板
- 無需學習新概念（界面沒有變化）

### 📈 系統改進：
- 代碼結構更統一
- 便於未來擴展
- 降低維護成本
- 提高代碼複用性

