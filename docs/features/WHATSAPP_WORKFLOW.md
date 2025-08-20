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

---

**最後更新**: 2025年8月20日
**系統版本**: v2.0
