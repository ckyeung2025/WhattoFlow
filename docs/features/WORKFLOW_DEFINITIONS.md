# 工作流定義系統

## 🎯 **功能概述**

WhattoFlow 系統的工作流定義模組是一個強大的業務流程設計和管理平台，支持視覺化工作流設計、版本控制、模板管理和協作編輯等功能。

## ��️ **系統架構**

### **1. 核心組件**
- **工作流設計器**: 基於 React Flow 的視覺化設計工具
- **工作流引擎**: 執行和調度工作流實例
- **版本管理**: 工作流定義的版本控制和回滾
- **模板系統**: 預設工作流模板庫
- **協作編輯**: 多用戶協作設計工作流

### **2. 技術棧**
- **前端**: React Flow + Ant Design + Monaco Editor
- **後端**: .NET 10.0 Web API
- **數據庫**: SQL Server + Entity Framework
- **實時協作**: SignalR WebSocket
- **版本控制**: Git-like 版本管理

## �� **工作流設計器**

### **1. 節點類型系統**

根據實際實現（`Models/WorkflowNodeTypes.cs`），系統支持以下 9 種節點類型：

```javascript
// 控制節點 (Control)
const controlNodes = {
  'start': StartNode,              // 開始節點
  'end': EndNode,                  // 結束節點
  'waitReply': WaitReplyNode,      // 等待用戶回覆
  'waitForQRCode': WaitForQRCodeNode, // 等待 QR Code 掃描
  'switch': SwitchNode             // 條件分支
};

// 通信節點 (Communication)
const communicationNodes = {
  'sendWhatsApp': SendWhatsAppNode  // 發送 WhatsApp（支持直接訊息和模板兩種模式）
};

// 數據節點 (Data)
const dataNodes = {
  'dataSetQuery': DataSetQueryNode  // DataSet 查詢/更新
};

// 集成節點 (Integration)
const integrationNodes = {
  'callApi': CallApiNode           // 調用外部 API
};

// 表單節點 (Form)
const formNodes = {
  'sendEForm': SendEFormNode       // 發送電子表單
};
```

**注意**: 系統實際支持的是上述 9 種節點類型，不包含文檔中提到的 task, decision, parallel, subprocess, approval, calculation, ai, delay, timer, loop, error, compensation 等節點類型。

### **2. 邊類型定義**
```javascript
// 邊的類型定義
const edgeTypes = {
  'default': DefaultEdge,       // 默認邊
  'conditional': ConditionalEdge, // 條件邊
  'success': SuccessEdge,       // 成功邊
  'failure': FailureEdge,       // 失敗邊
  'timeout': TimeoutEdge,       // 超時邊
  'compensation': CompensationEdge // 補償邊
};

// 條件邊配置
const conditionalEdgeConfig = {
  condition: 'userRole === "Manager"',
  priority: 1,
  metadata: {
    description: '只有經理才能執行此流程',
    businessRule: 'ROLE_BASED_APPROVAL'
  }
};
```

### **3. 工作流定義結構**
```json
{
  "id": "workflow-001",
  "name": "採購審批流程",
  "description": "標準採購申請審批流程",
  "version": "1.2.0",
  "category": "Approval",
  "tags": ["採購", "審批", "財務"],
  "metadata": {
    "estimatedDuration": "3-5天",
    "complexity": "Medium",
    "department": "財務部",
    "owner": "財務經理"
  },
  "nodes": [
    {
      "id": "start-1",
      "type": "start",
      "position": { "x": 100, "y": 100 },
      "data": {
        "label": "開始",
        "description": "採購申請提交"
      }
    },
    {
      "id": "approval-1",
      "type": "approval",
      "position": { "x": 300, "y": 100 },
      "data": {
        "label": "部門經理審批",
        "approvers": ["dept_manager"],
        "timeout": "24h",
        "escalation": "supervisor"
      }
    },
    {
      "id": "decision-1",
      "type": "decision",
      "position": { "x": 500, "y": 100 },
      "data": {
        "label": "金額判斷",
        "condition": "amount > 10000",
        "truePath": "finance_approval",
        "falsePath": "auto_approve"
      }
    }
  ],
  "edges": [
    {
      "id": "edge-1",
      "source": "start-1",
      "target": "approval-1",
      "type": "default",
      "data": {
        "label": "提交審批"
      }
    },
    {
      "id": "edge-2",
      "source": "approval-1",
      "target": "decision-1",
      "type": "success",
      "data": {
        "label": "審批通過"
      }
    }
  ],
  "variables": [
    {
      "name": "amount",
      "type": "decimal",
      "description": "採購金額",
      "required": true
    },
```
