# WhatsApp 工作流系統

## 🎯 **功能概述**

WhattoFlow 系統的 WhatsApp 工作流模組是一個完整的 WhatsApp 業務流程自動化平台，支持工作流設計、執行、監控和優化，並整合了 Meta Webhook 和 AI 輔助功能。

## ��️ **系統架構**

### **1. 核心組件**
- **工作流設計器**: 基於 React Flow 的視覺化設計工具
- **工作流引擎**: 執行和調度工作流實例
- **WhatsApp 集成**: Meta Webhook 和消息處理
- **AI 輔助**: 智能工作流優化建議

### **2. 技術棧**
- **前端**: React Flow + Ant Design
- **後端**: .NET 8.0 Web API
- **數據庫**: SQL Server + Entity Framework
- **集成**: Meta WhatsApp Business API

## �� **工作流設計器**

### **1. 節點類型**
```javascript
// 基本節點類型
const nodeTypes = {
  'start': StartNode,           // 開始節點
  'end': EndNode,               // 結束節點
  'message': MessageNode,       // 消息發送節件
  'condition': ConditionNode,   // 條件判斷節件
  'delay': DelayNode,           // 延遲節件
  'webhook': WebhookNode,       // Webhook 調用節件
  'ai': AINode,                 // AI 處理節件
  'form': FormNode              // 表單收集節件
};
```

### **2. 邊類型**
```javascript
// 邊的類型定義
const edgeTypes = {
  'default': DefaultEdge,       // 默認邊
  'conditional': ConditionalEdge, // 條件邊
  'success': SuccessEdge,       // 成功邊
  'failure': FailureEdge        // 失敗邊
};
```

### **3. 工作流定義結構**
```json
{
  "id": "workflow-001",
  "name": "客戶服務工作流",
  "description": "自動化客戶服務流程",
  "version": "1.0",
  "nodes": [
    {
      "id": "start-1",
      "type": "start",
      "position": { "x": 100, "y": 100 },
      "data": { "label": "開始" }
    },
    {
      "id": "message-1",
      "type": "message",
      "position": { "x": 300, "y": 100 },
      "data": {
        "label": "歡迎消息",
        "message": "您好！歡迎使用我們的服務。",
        "template": "welcome_template"
      }
    }
  ],
  "edges": [
    {
      "id": "edge-1",
      "source": "start-1",
      "target": "message-1",
      "type": "default"
    }
  ]
}
```

## 📱 **WhatsApp 集成**

### **1. Meta Webhook 處理**
```csharp
[ApiController]
[Route("api/webhook")]
public class MetaWebhookController : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> HandleWebhook([FromBody] WebhookRequest request)
    {
        try
        {
            // 驗證 Webhook 簽名
            if (!VerifyWebhookSignature(request))
            {
                return Unauthorized();
            }
            
            // 處理消息
            foreach (var entry in request.Entry)
            {
                foreach (var change in entry.Changes)
                {
                    if (change.Value.Messages != null)
                    {
                        foreach (var message in change.Value.Messages)
                        {
                            await ProcessWhatsAppMessage(message);
                        }
                    }
                }
            }
            
            return Ok("OK");
        }
        catch (Exception ex)
        {
            _loggingService.LogError(ex, "Webhook 處理失敗");
            return BadRequest();
        }
    }
}
```

### **2. 消息處理流程**
```javascript
const processMessage = async (message) => {
  try {
    // 1. 解析消息內容
    const parsedMessage = parseWhatsAppMessage(message);
    
    // 2. 查找相關工作流
    const workflow = await findActiveWorkflow(parsedMessage.phoneNumber);
    
    // 3. 執行工作流
    if (workflow) {
      await executeWorkflow(workflow, parsedMessage);
    } else {
      // 4. 發送默認回覆
      await sendDefaultResponse(parsedMessage.phoneNumber);
    }
    
  } catch (error) {
    console.error('消息處理失敗:', error);
  }
};
```

## 🤖 **AI 輔助功能**

### **1. 智能回覆建議**
```javascript
const getAIResponse = async (userMessage, context) => {
  try {
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: userMessage,
        context: context,
        model: 'grok-3'
      })
    });
    
    const result = await response.json();
    return result.response;
  } catch (error) {
    console.error('AI 回覆獲取失敗:', error);
    return null;
  }
};
```

### **2. 工作流優化建議**
```javascript
const analyzeWorkflowPerformance = async (workflowId) => {
  try {
    const response = await fetch(`/api/workflows/${workflowId}/analyze`, {
      method: 'POST'
    });
    
    const analysis = await response.json();
    return {
      bottlenecks: analysis.bottlenecks,
      suggestions: analysis.suggestions,
      metrics: analysis.metrics
    };
  } catch (error) {
    console.error('工作流分析失敗:', error);
    return null;
  }
};
```

## �� **監控和分析**

### **1. 實時監控**
```javascript
const WorkflowMonitor = () => {
  const [activeWorkflows, setActiveWorkflows] = useState([]);
  const [metrics, setMetrics] = useState({});
  
  useEffect(() => {
    // 建立 WebSocket 連接
    const ws = new WebSocket('/ws/workflow-monitor');
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'workflow_update') {
        setActiveWorkflows(data.workflows);
      } else if (data.type === 'metrics_update') {
        setMetrics(data.metrics);
      }
    };
    
    return () => ws.close();
  }, []);
  
  return (
    <div className="workflow-monitor">
      <ActiveWorkflowsList workflows={activeWorkflows} />
      <MetricsDashboard metrics={metrics} />
    </div>
  );
};
```

### **2. 性能指標**
```javascript
const workflowMetrics = {
  executionTime: '平均執行時間',
  successRate: '成功率',
  messageDeliveryRate: '消息送達率',
  responseTime: '平均響應時間',
  userSatisfaction: '用戶滿意度',
  costPerMessage: '每條消息成本'
};
```

## �� **數據存儲**

### **1. 工作流定義表**
```sql
CREATE TABLE WorkflowDefinitions (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    company_id UNIQUEIDENTIFIER NOT NULL,
    name NVARCHAR(100) NOT NULL,
    description NVARCHAR(500),
    workflow_data NVARCHAR(MAX) NOT NULL, -- JSON 格式的工作流定義
    version NVARCHAR(20) DEFAULT '1.0',
    status NVARCHAR(20) DEFAULT 'Draft',
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME,
    created_user_id UNIQUEIDENTIFIER NOT NULL,
    updated_user_id UNIQUEIDENTIFIER
);
```

### **2. 工作流實例表**
```sql
CREATE TABLE WorkflowInstances (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    workflow_definition_id UNIQUEIDENTIFIER NOT NULL,
    company_id UNIQUEIDENTIFIER NOT NULL,
    phone_number NVARCHAR(20) NOT NULL,
    current_node_id NVARCHAR(100),
    status NVARCHAR(20) DEFAULT 'Running',
    started_at DATETIME DEFAULT GETDATE(),
    completed_at DATETIME,
    variables NVARCHAR(MAX) -- JSON 格式的變量
);
```

### **3. 消息記錄表**
```sql
CREATE TABLE WhatsAppMessages (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    company_id UNIQUEIDENTIFIER NOT NULL,
    phone_number NVARCHAR(20) NOT NULL,
    message_type NVARCHAR(20) NOT NULL, -- 'incoming' 或 'outgoing'
    content NVARCHAR(MAX),
    timestamp DATETIME DEFAULT GETDATE(),
    workflow_instance_id UNIQUEIDENTIFIER,
    status NVARCHAR(20) DEFAULT 'Sent'
);
```

## 📋 **模板管理系統**

### **1. 內部模板 vs Meta 模板**

| 特性 | 內部模板 | Meta 模板 |
|-----|---------|----------|
| **審核** | ❌ 無需審核 | ✅ 需要 Meta 審核 |
| **使用限制** | 無限制 | 24小時對話窗口 |
| **適用場景** | 開發測試、內部通知 | 正式營銷、官方通知 |
| **變更速度** | 即時生效 | 需重新審核 |
| **模板類型** | Text, Media, Interactive, Location, Contact | TEXT (含按鈕) |
| **按鈕類型** | Quick Reply, URL, Phone | Quick Reply, URL, Phone |
| **發送限制** | 依帳號等級 | 依帳號等級 |

### **2. Meta 模板管理**

#### **功能特性**
- ✅ 從 Meta API 獲取模板列表
- ✅ 創建 Meta 模板並提交審核
- ✅ 刪除 Meta 模板
- ✅ 同步模板狀態
- ✅ Token 權限驗證

#### **模板審核狀態**
- 🟡 **PENDING**: 審核中（通常 24 小時內）
- 🟢 **APPROVED**: 已通過，可以使用
- 🔴 **REJECTED**: 已拒絕，需要修改後重新提交
- 🟠 **PAUSED**: 已暫停

#### **創建 Meta 模板步驟**
1. 切換到「Meta 官方模板」標籤
2. 點擊「創建 Meta 模板」
3. 填寫模板信息：
   - **名稱**：只能使用小寫字母、數字和下劃線（例如：`welcome_message_001`）
   - **類別**：MARKETING、UTILITY、AUTHENTICATION
   - **語言**：選擇模板語言
4. 配置內容組件：
   - **標題**（可選）：最多 60 字元
   - **正文**：必填，使用 `{{1}}`, `{{2}}` 表示變數
   - **頁腳**（可選）：最多 60 字元
   - **按鈕**（可選）：最多 3 個按鈕
5. 點擊「提交到 Meta 審核」

#### **模板變數配置**

系統支持兩種變數配置方式：

**數字參數（推薦）**：
- 格式：`{{1}}`, `{{2}}`, `{{3}}`...
- 符合 WhatsApp 標準格式
- 適用於所有 Meta 官方模板

**命名參數**：
- 格式：`{{customer_name}}`, `{{order_id}}`
- 更易讀，但需要正確的變數名映射

**變數來源**：
- **流程變數**：從工作流程定義的流程變數中選擇
- **數據集欄位**：從 DataSet Query 節點的查詢結果中選擇

### **3. 統一訊息模板功能**

所有發送訊息的節點都支持 Tab 切換功能，可以選擇「直接輸入訊息」或「使用模板」：

#### **支持的節點**
1. **Send WhatsApp Node** - 發送 WhatsApp 訊息
2. **Wait Reply Node** - 等待回覆節點
3. **Wait for QR Code Node** - 等待 QR Code 掃描
4. **Form Node (sendEForm)** - 發送電子表單

#### **訊息模式**

**直接訊息模式 (direct)**：
- 適用於簡單文字訊息
- 支持流程變數語法 `${variableName}`
- 即時生效，無需審核

**模板模式 (template)**：
- 適用於結構化模板訊息
- 支持內部模板和 Meta 模板
- 提供變數編輯界面
- Form Node 會自動添加 `formUrl` 和 `formName` 變數

### **4. WhatsApp 菜單自定義**

每個公司可以自定義其 WhatsApp 聊天機器人的菜單文字和提示訊息。

#### **可自定義的字段**
- `WA_WelcomeMessage`: 主要歡迎訊息
- `WA_NoFunctionMessage`: 無功能時顯示的訊息
- `WA_MenuTitle`: WhatsApp 列表菜單標題
- `WA_MenuFooter`: WhatsApp 列表菜單底部文字
- `WA_MenuButton`: 查看選項按鈕文字
- `WA_SectionTitle`: 服務選項區段標題
- `WA_DefaultOptionDescription`: 預設選項描述
- `WA_InputErrorMessage`: 輸入錯誤提示訊息
- `WA_FallbackMessage`: 回退到純文字時的提示
- `WA_SystemErrorMessage`: 系統錯誤訊息

#### **默認行為**
如果公司沒有設置自定義文字（字段為 NULL），系統將使用內建的默認值。

#### **WhatsApp 限制**
- 菜單標題最多 60 個字符
- 選項標題最多 24 個字符
- 選項描述最多 72 個字符
- 底部文字最多 60 個字符

## ⚙️ **配置和設定**

### **1. WhatsApp Business API 配置**
```json
{
  "whatsapp": {
    "accessToken": "your_access_token",
    "phoneNumberId": "your_phone_number_id",
    "businessAccountId": "your_business_account_id",
    "webhookVerifyToken": "your_webhook_verify_token",
    "apiVersion": "v18.0"
  },
  "webhook": {
    "url": "https://your-domain.com/api/webhook",
    "verifyToken": "your_webhook_verify_token"
  }
}
```

### **2. 工作流引擎配置**
```json
{
  "workflowEngine": {
    "maxConcurrentExecutions": 100,
    "executionTimeout": 300,
    "retryAttempts": 3,
    "retryDelay": 5000,
    "enableLogging": true,
    "logLevel": "Info"
  }
}
```

## �� **部署和維護**

### **1. 部署檢查清單**
- [ ] WhatsApp Business API 配置完成
- [ ] Webhook URL 可公開訪問
- [ ] 數據庫連接正常
- [ ] 工作流引擎啟動
- [ ] 監控系統運行
- [ ] 日誌記錄正常

### **2. 性能優化建議**
- 使用 Redis 緩存工作流定義
- 實現工作流實例的異步處理
- 定期清理過期的實例數據
- 監控 API 調用限制和配額
- 緩存 Meta 模板列表，減少 API 調用

### **3. 常見問題**

**Q1: Token 權限不足怎麼辦？**
A: 前往 Meta Business Suite 重新生成系統用戶 Token，確保勾選 `whatsapp_business_management` 權限。

**Q2: 模板被拒絕了？**
A: 查看拒絕原因，常見原因：
- 內容違反 WhatsApp 商業政策
- 變數使用不當
- 包含敏感信息
- 格式不符合規範

**Q3: 如何查看模板審核狀態？**
A: 點擊「同步狀態」按鈕，系統會從 Meta API 獲取最新狀態。

**Q4: 內部模板和 Meta 模板可以同時使用嗎？**
A: 可以！在不同場景使用不同類型的模板：
- 測試環境、快速迭代 → 使用內部模板
- 正式營銷、官方通知 → 使用 Meta 模板

---

**最後更新**: 2025年1月
**系統版本**: v2.1
