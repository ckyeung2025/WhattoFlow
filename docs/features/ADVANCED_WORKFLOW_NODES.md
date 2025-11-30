# 工作流節點系統

## 🎯 **功能概述**

WhattoFlow 系統支持多種工作流節點，這些節點提供了豐富的業務邏輯處理能力，支持複雜的業務流程自動化。

## 📋 **支持的節點類型**

根據實際代碼實現（`Models/WorkflowNodeTypes.cs`），系統支持以下 9 種節點類型：

### **1. 控制節點 (Control)**

#### **Start 節點**
- **類型**: `start`
- **分類**: Control
- **功能**: 工作流程的起始點
- **特性**:
  - 標記工作流開始
  - 支持手動激活和自動激活
  - 不執行任何業務邏輯（HasExecution = false）
- **配置**:
  ```json
  {
    "taskName": "Start",
    "activationType": "manual"
  }
  ```

#### **End 節點**
- **類型**: `end`
- **分類**: Control
- **功能**: 工作流程的終點
- **特性**:
  - 標記工作流結束
  - 自動完成工作流執行
  - 不執行任何業務邏輯（HasExecution = false）
- **配置**:
  ```json
  {
    "taskName": "End"
  }
  ```

#### **Wait Reply 節點**
- **類型**: `waitReply`
- **分類**: Control
- **功能**: 暫停流程等待用戶輸入
- **特性**:
  - 支持等待指定用戶回覆（initiator 或 specifiedUsers）
  - 支持消息驗證
  - 支持超時設置
  - 支持直接訊息和模板兩種模式
- **配置**:
  ```json
  {
    "taskName": "Wait for User Reply",
    "replyType": "initiator",
    "specifiedUsers": "",
    "message": "請輸入您的回覆",
    "messageMode": "direct",
    "validation": {
      "enabled": true,
      "validatorType": "default"
    }
  }
  ```

#### **Wait for QR Code 節點**
- **類型**: `waitForQRCode`
- **分類**: Control
- **功能**: 等待用戶上傳包含 QR Code 的圖片並掃描
- **特性**:
  - 自動識別 QR Code
  - 提取 QR Code 數據到流程變量
  - 支持超時設置
  - 支持直接訊息和模板兩種模式
- **配置**:
  ```json
  {
    "taskName": "Wait for QR Code",
    "qrCodeVariable": "qrData",
    "message": "請上傳包含 QR Code 的圖片",
    "messageMode": "direct",
    "timeout": 300
  }
  ```

#### **Switch 節點**
- **類型**: `switch`
- **分類**: Control
- **功能**: 根據條件選擇不同的執行路徑
- **特性**:
  - 支持多個條件分支
  - 支持默認路徑
  - 支持變數比較（equals, not_equals, greater_than 等）
  - 支持流程變數引用
- **配置**:
  ```json
  {
    "taskName": "Switch",
    "conditions": [
      {
        "id": "condition1",
        "variableName": "orderAmount",
        "operator": "greaterThan",
        "value": "1000",
        "label": "大額訂單"
      }
    ],
    "defaultPath": "default"
  }
  ```

### **2. 通信節點 (Communication)**

#### **Send WhatsApp 節點**
- **類型**: `sendWhatsApp`
- **分類**: Communication
- **功能**: 發送 WhatsApp 訊息或模板
- **特性**:
  - 支持直接訊息模式（messageMode = "direct"）
  - 支持模板模式（messageMode = "template"）
  - 支持內部模板和 Meta 官方模板
  - 支持流程變數替換（${variableName}）
  - 支持收件人選擇（to 字段）
- **配置**:
  ```json
  {
    "taskName": "Send WhatsApp",
    "messageMode": "direct",
    "message": "您好 ${customerName}，您的訂單已確認",
    "to": "85296366318",
    "templateId": "",
    "templateName": "",
    "isMetaTemplate": false,
    "templateVariables": []
  }
  ```

### **3. 數據節點 (Data)**

#### **DataSet Query/Update 節點**
- **類型**: `dataSetQuery`
- **分類**: Data
- **功能**: DataSet 查詢、插入、更新或刪除
- **特性**:
  - 支持 SELECT 查詢
  - 支持 INSERT 操作
  - 支持 UPDATE 操作
  - 支持 DELETE 操作
  - 支持條件查詢（queryConditionGroups）
  - 支持字段映射（mappedFields）
- **配置**:
  ```json
  {
    "taskName": "DataSet Query/Update",
    "dataSetId": "customer_dataset",
    "operationType": "SELECT",
    "queryConditionGroups": [
      {
        "conditions": [
          {
            "field": "customer_id",
            "operator": "equals",
            "value": "${customerId}"
          }
        ]
      }
    ],
    "operationData": {},
    "mappedFields": [
      {
        "sourceField": "customer_name",
        "targetVariable": "customerName"
      }
    ]
  }
  ```

### **4. 集成節點 (Integration)**

#### **Trigger External API 節點**
- **類型**: `callApi`
- **分類**: Integration
- **功能**: 呼叫外部 API 服務
- **特性**:
  - 支持 HTTP GET/POST/PUT/DELETE 方法
  - 支持請求頭配置
  - 支持請求體配置
  - 支持響應處理
  - 支持流程變數在 URL 和請求體中使用
- **配置**:
  ```json
  {
    "taskName": "Trigger External API",
    "url": "https://api.example.com/orders",
    "method": "POST",
    "headers": {
      "Content-Type": "application/json",
      "Authorization": "Bearer ${apiToken}"
    },
    "body": {
      "orderId": "${orderId}",
      "status": "confirmed"
    }
  }
  ```

### **5. 表單節點 (Form)**

#### **Send eForm 節點**
- **類型**: `sendEForm`
- **分類**: Form
- **功能**: 發送電子表單給用戶填寫
- **特性**:
  - 支持表單選擇（formId）
  - 支持收件人選擇（to）
  - 支持自定義消息
  - 支持直接訊息和模板兩種模式
  - 模板模式下自動添加 formUrl 和 formName 變數
- **配置**:
  ```json
  {
    "taskName": "Send eForm",
    "formName": "請假申請表",
    "formId": "form_123",
    "formDescription": "請填寫請假申請表",
    "to": "85296366318",
    "messageMode": "direct",
    "useCustomMessage": true,
    "messageTemplate": "請填寫{formName}：\n{formUrl}",
    "sendEFormMode": "integrateWaitReply"
  }
  ```

## 🎨 **節點分類統計**

| 分類 | 節點類型 | 數量 | 說明 |
|------|---------|------|------|
| **Control** | start, end, waitReply, waitForQRCode, switch | 5 | 流程控制節點 |
| **Communication** | sendWhatsApp | 1 | 通信節點 |
| **Data** | dataSetQuery | 1 | 數據操作節點 |
| **Integration** | callApi | 1 | 外部集成節點 |
| **Form** | sendEForm | 1 | 表單節點 |
| **總計** | | **9** | |

## 🔧 **節點屬性說明**

### **通用屬性**
- `taskName`: 節點名稱（必填）
- `description`: 節點描述（可選）
- `category`: 節點分類（自動設置）

### **執行屬性**
- `IsImplemented`: 是否已實現（所有節點均為 true）
- `HasExecution`: 是否需要執行
  - `false`: start, end
  - `true`: 其他所有節點

### **訊息模式屬性**（適用於 sendWhatsApp, waitReply, waitForQRCode, sendEForm）
- `messageMode`: 訊息模式
  - `"direct"`: 直接輸入訊息
  - `"template"`: 使用模板
- `message`: 直接訊息內容（messageMode = "direct" 時使用）
- `templateId`: 模板 ID（messageMode = "template" 時使用）
- `templateName`: 模板名稱（messageMode = "template" 時使用）
- `isMetaTemplate`: 是否為 Meta 官方模板
- `templateVariables`: 模板變數配置

## 💻 **API 接口**

### **獲取所有節點類型**

```http
GET /api/workflownodetypes
Authorization: Bearer {token}

Response:
{
  "success": true,
  "data": {
    "start": {
      "type": "start",
      "label": "Start",
      "category": "Control",
      "description": "工作流程的起始點",
      "isImplemented": true,
      "hasExecution": false
    },
    ...
  }
}
```

### **獲取特定節點類型定義**

```http
GET /api/workflownodetypes/start
Authorization: Bearer {token}

Response:
{
  "success": true,
  "data": {
    "type": "start",
    "label": "Start",
    "category": "Control",
    "description": "工作流程的起始點",
    "isImplemented": true,
    "hasExecution": false,
    "defaultData": {
      "taskName": "Start",
      "activationType": "manual"
    }
  }
}
```

## 🚀 **使用示例**

### **示例 1: 簡單歡迎流程**

```json
{
  "nodes": [
    {
      "id": "start-1",
      "type": "start",
      "position": { "x": 100, "y": 100 },
      "data": { "taskName": "Start" }
    },
    {
      "id": "send-1",
      "type": "sendWhatsApp",
      "position": { "x": 300, "y": 100 },
      "data": {
        "taskName": "Send Welcome",
        "messageMode": "direct",
        "message": "歡迎使用我們的服務！您的訂單 ${orderNumber} 已確認。",
        "to": "${customerPhone}"
      }
    },
    {
      "id": "end-1",
      "type": "end",
      "position": { "x": 500, "y": 100 },
      "data": { "taskName": "End" }
    }
  ],
  "edges": [
    { "id": "e1", "source": "start-1", "target": "send-1" },
    { "id": "e2", "source": "send-1", "target": "end-1" }
  ]
}
```

### **示例 2: 條件分支訂單處理**

```json
{
  "nodes": [
    {
      "id": "start-1",
      "type": "start"
    },
    {
      "id": "query-order",
      "type": "dataSetQuery",
      "data": {
        "taskName": "Query Order",
        "dataSetId": "orders_dataset",
        "operationType": "SELECT",
        "queryConditionGroups": [
          {
            "conditions": [
              {
                "field": "order_id",
                "operator": "equals",
                "value": "${orderId}"
              }
            ]
          }
        ],
        "mappedFields": [
          { "sourceField": "order_amount", "targetVariable": "orderAmount" }
        ]
      }
    },
    {
      "id": "switch-1",
      "type": "switch",
      "data": {
        "taskName": "Check Order Amount",
        "conditions": [
          {
            "id": "high-amount",
            "variableName": "orderAmount",
            "operator": "greaterThan",
            "value": "10000",
            "label": "大額訂單"
          },
          {
            "id": "normal-amount",
            "variableName": "orderAmount",
            "operator": "lessThanOrEqual",
            "value": "10000",
            "label": "普通訂單"
          }
        ],
        "defaultPath": "normal-amount"
      }
    },
    {
      "id": "send-high",
      "type": "sendWhatsApp",
      "data": {
        "messageMode": "template",
        "templateName": "high_amount_notification",
        "isMetaTemplate": true
      }
    },
    {
      "id": "send-normal",
      "type": "sendWhatsApp",
      "data": {
        "messageMode": "direct",
        "message": "您的訂單已確認，感謝您的購買！"
      }
    }
  ]
}
```

### **示例 3: QR Code 掃描流程**

```json
{
  "nodes": [
    {
      "id": "start-1",
      "type": "start"
    },
    {
      "id": "wait-qr",
      "type": "waitForQRCode",
      "data": {
        "taskName": "Wait for QR Code",
        "qrCodeVariable": "qrData",
        "message": "請上傳包含 QR Code 的圖片",
        "timeout": 300
      }
    },
    {
      "id": "query-data",
      "type": "dataSetQuery",
      "data": {
        "taskName": "Query by QR Code",
        "dataSetId": "delivery_dataset",
        "operationType": "SELECT",
        "queryConditionGroups": [
          {
            "conditions": [
              {
                "field": "delivery_no",
                "operator": "equals",
                "value": "${qrData.deliveryNo}"
              }
            ]
          }
        ]
      }
    },
    {
      "id": "send-confirm",
      "type": "sendWhatsApp",
      "data": {
        "messageMode": "direct",
        "message": "QR Code 掃描成功！訂單 ${orderNumber} 已確認。"
      }
    }
  ]
}
```

## 🔍 **節點執行流程**

### **執行順序**
1. **Start 節點**: 標記流程開始，不執行任何邏輯
2. **業務節點**: 按順序執行各個業務節點
3. **Switch 節點**: 根據條件選擇執行路徑
4. **End 節點**: 標記流程結束，不執行任何邏輯

### **執行狀態**
- **Pending**: 等待執行
- **Running**: 正在執行
- **Completed**: 執行完成
- **Failed**: 執行失敗
- **Waiting**: 等待外部輸入（waitReply, waitForQRCode）

## 🚀 **最佳實踐**

### **1. 節點命名**
- 使用清晰、描述性的節點名稱
- 遵循統一的命名規範
- 避免使用縮寫和特殊字符

### **2. 流程設計**
- 保持流程邏輯簡單清晰
- 避免過深的嵌套
- 合理使用 Switch 節點進行分支

### **3. 變數使用**
- 使用流程變數傳遞數據
- 變數命名要有意義
- 避免變數名稱衝突

### **4. 錯誤處理**
- 為關鍵節點設置錯誤處理
- 使用 Switch 節點處理異常情況
- 記錄詳細的執行日誌

---

**文檔版本**: 2.0.0  
**最後更新**: 2025年1月  
**維護者**: 開發團隊
