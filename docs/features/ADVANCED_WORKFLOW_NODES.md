# 高級工作流節點系統

## 🎯 **功能概述**

高級工作流節點系統是 WhattoFlow 的擴展功能，提供了更智能和靈活的業務流程控制能力。系統包括 QR Code 處理節點、Switch 條件分支節點、DataSet 查詢/更新節點等，這些節點能夠處理複雜的業務邏輯和數據操作。

## 🏗️ **系統架構**

### **核心組件**
- **QRCodeNodeHandler**: QR Code 處理節點
- **SwitchNodeHandler**: Switch 條件分支節點
- **DataSetQueryNodeHandler**: DataSet 查詢節點
- **DataSetUpdateNodeHandler**: DataSet 更新節點
- **WorkflowNodeTypeRegistry**: 節點類型註冊器

### **節點類型**
```
基礎節點 → 高級節點 → 智能節點
    ↓           ↓         ↓
  Start     Switch    QR Code
  End       Gateway   DataSet
  Task      Decision  External API
```

## 🔧 **節點詳解**

### **1. QR Code 處理節點 (waitQRCode)**

#### **功能描述**
專門處理用戶發送的包含 QR Code 的圖片，自動識別 QR Code 內容，提取關鍵信息，並可選擇性地查詢相關數據集。

#### **節點配置**
```json
{
  "type": "waitQRCode",
  "label": "Wait for QR Code Image",
  "data": {
    "taskName": "Wait for QR Code Image",
    "qrCodeConfig": {
      "expectedFormat": "DN*{invoiceNo}",
      "validationRules": {
        "pattern": "^DN\\*[A-Z0-9]+$",
        "requiredFields": ["invoiceNo"]
      },
      "fieldMappings": [
        {
          "sourceField": "invoiceNo",
          "targetVariable": "invoice_number",
          "dataType": "string",
          "required": true
        }
      ],
      "datasetLookup": {
        "enabled": true,
        "datasetId": "orders_dataset",
        "lookupQuery": "SELECT * FROM orders WHERE invoice_no = @invoiceNo",
        "resultMapping": {
          "customerName": "customer_name",
          "orderAmount": "order_amount"
        }
      }
    },
    "timeout": 3600,
    "retryCount": 3
  }
}
```

#### **處理流程**
1. **等待圖片**: 等待用戶發送包含 QR Code 的圖片
2. **圖片識別**: 使用 ZXing 庫識別 QR Code 內容
3. **格式驗證**: 根據預期格式驗證 QR Code 內容
4. **字段提取**: 提取關鍵字段並映射到流程變量
5. **數據查詢**: 可選的數據集查詢和結果映射
6. **流程繼續**: 將提取的數據傳遞給後續節點

#### **使用場景**
- 送貨單據掃描和處理
- 產品條碼識別和庫存查詢
- 客戶身份識別和資料獲取
- 訂單追蹤和狀態更新

### **2. Switch 節點 (switch)**

#### **功能描述**
類似 BPMN Gateway 的條件分支節點，支持多種條件類型，能夠根據流程變量、表達式或數據集查詢結果決定流程的執行路徑。

#### **節點配置**
```json
{
  "type": "switch",
  "label": "Switch / Gateway",
  "data": {
    "taskName": "Conditional Branch",
    "switchType": "exclusive",
    "conditions": [
      {
        "id": "condition_1",
        "name": "Order Status Check",
        "type": "variable_check",
        "config": {
          "variable": "order_status",
          "operator": "equals",
          "value": "pending"
        },
        "targetNode": "approve_order_node"
      },
      {
        "id": "condition_2",
        "name": "Amount Check",
        "type": "expression",
        "config": {
          "expression": "${order_amount} > 10000"
        },
        "targetNode": "manager_approval_node"
      },
      {
        "id": "condition_3",
        "name": "Customer Credit Check",
        "type": "dataset_query",
        "config": {
          "datasetId": "customer_credit_dataset",
          "query": "SELECT credit_limit FROM customers WHERE customer_id = @{customer_id}",
          "condition": "${credit_limit} >= ${order_amount}",
          "targetNode": "auto_approve_node"
        }
      },
      {
        "id": "default_condition",
        "name": "Default Path",
        "type": "default",
        "targetNode": "manual_review_node",
        "isDefault": true
      }
    ]
  }
}
```

#### **條件類型**

##### **變量檢查 (variable_check)**
- 支持的操作符: equals, not_equals, greater_than, less_than, contains, starts_with, ends_with
- 支持多個條件的邏輯組合 (AND, OR)
- 支持數值、字串、日期、布林等數據類型

##### **表達式 (expression)**
- 支持 JavaScript 風格的表達式
- 可以使用流程變量引用 (${variable_name})
- 支持數學運算、邏輯運算、字串操作

##### **數據集查詢 (dataset_query)**
- 執行 SQL 查詢或預定義查詢
- 根據查詢結果決定分支路徑
- 支持參數化查詢和結果驗證

##### **默認分支 (default)**
- 當所有條件都不滿足時的默認路徑
- 確保流程不會卡住

#### **使用場景**
- 訂單金額審批流程
- 客戶信用等級判斷
- 庫存狀態檢查
- 權限級別驗證

### **3. DataSet 查詢節點 (datasetQuery)**

#### **功能描述**
在工作流中查詢系統內部的數據集，支持複雜的查詢條件、結果映射和數據轉換，實現數據驅動的流程控制。

#### **節點配置**
```json
{
  "type": "datasetQuery",
  "label": "DataSet Query",
  "data": {
    "taskName": "Query Customer Data",
    "operationType": "query",
    "datasetId": "customer_dataset",
    "queryConfig": {
      "type": "simple",
      "conditions": [
        {
          "field": "customer_id",
          "operator": "equals",
          "value": "${customer_id}",
          "logicalOperator": "AND"
        },
        {
          "field": "status",
          "operator": "in",
          "value": ["active", "pending"]
        }
      ],
      "selectFields": ["customer_name", "credit_limit", "order_count"],
      "orderBy": [
        { "field": "created_at", "direction": "DESC" }
      ],
      "limit": 100
    },
    "resultMapping": {
      "targetVariables": [
        { "sourceField": "customer_name", "targetVariable": "customer_name" },
        { "sourceField": "credit_limit", "targetVariable": "credit_limit" }
      ],
      "arrayMapping": {
        "enabled": true,
        "targetVariable": "customer_orders",
        "itemMapping": {
          "order_id": "id",
          "order_date": "created_at"
        }
      }
    }
  }
}
```

#### **查詢功能**
- **條件查詢**: 支持多種操作符和邏輯組合
- **字段選擇**: 可選擇需要的字段，優化查詢性能
- **排序和分頁**: 支持結果排序和數量限制
- **參數化查詢**: 使用流程變量作為查詢參數

#### **結果映射**
- **直接映射**: 將查詢結果直接映射到流程變量
- **數組映射**: 處理多行查詢結果
- **JSON 映射**: 將複雜查詢結果轉換為 JSON 格式
- **數據轉換**: 支持數據類型轉換和格式化

### **4. DataSet 更新節點 (datasetUpdate)**

#### **功能描述**
在工作流中更新系統內部的數據集，支持條件更新、批量操作和結果驗證，實現數據驅動的流程執行。

#### **節點配置**
```json
{
  "type": "datasetUpdate",
  "label": "DataSet Update",
  "data": {
    "taskName": "Update Order Status",
    "operationType": "update",
    "datasetId": "orders_dataset",
    "updateConfig": {
      "conditions": [
        {
          "field": "order_id",
          "operator": "equals",
          "value": "${order_id}"
        }
      ],
      "updateFields": [
        {
          "field": "status",
          "value": "approved",
          "valueType": "static"
        },
        {
          "field": "approved_by",
          "value": "${user_id}",
          "valueType": "variable"
        },
        {
          "field": "approved_at",
          "value": "NOW()",
          "valueType": "function"
        }
      ]
    },
    "validationRules": {
      "preUpdateCheck": {
        "enabled": true,
        "query": "SELECT status FROM orders WHERE order_id = @{order_id}",
        "expectedResult": "pending"
      }
    }
  }
}
```

#### **更新功能**
- **條件更新**: 根據條件選擇要更新的記錄
- **字段更新**: 支持靜態值、變量值、函數值
- **批量操作**: 支持一次更新多條記錄
- **預更新檢查**: 更新前的數據驗證

#### **安全特性**
- **權限驗證**: 檢查用戶是否有更新權限
- **數據驗證**: 更新前的數據完整性檢查
- **審計日誌**: 記錄所有更新操作
- **回滾支持**: 支持更新失敗時的回滾操作

## 🎨 **用戶介面**

### **1. 節點配置面板**

#### **QR Code 節點配置**
- QR Code 格式設置
- 字段映射配置
- 數據集查詢設置
- 超時和重試配置

#### **Switch 節點配置**
- 條件列表管理
- 條件類型選擇
- 目標節點設置
- 默認分支配置

#### **DataSet 節點配置**
- 數據集選擇
- 查詢條件設置
- 結果映射配置
- 驗證規則設置

### **2. 流程設計器集成**

#### **拖拽支持**
- 從工具欄拖拽節點到畫布
- 節點之間的連接線繪製
- 節點屬性的即時編輯

#### **視覺化配置**
- 節點類型的圖標顯示
- 條件分支的可視化表示
- 數據流的動態展示

### **3. 實時監控**

#### **執行狀態**
- 節點執行狀態的實時顯示
- 條件評估結果的即時反饋
- 數據查詢和更新的進度顯示

#### **錯誤處理**
- 節點執行錯誤的詳細信息
- 條件評估失敗的原因分析
- 數據操作的錯誤日誌

## 💻 **API 接口**

### **1. 節點執行**

#### **QR Code 節點執行**
```http
POST /api/workflow/nodes/qrcode/execute
Content-Type: application/json

{
  "workflowExecutionId": 123,
  "nodeId": "qrcode_node_1",
  "inputData": {
    "imageUrl": "https://example.com/qrcode.jpg",
    "userId": "user_123"
  }
}
```

#### **Switch 節點執行**
```http
POST /api/workflow/nodes/switch/execute
Content-Type: application/json

{
  "workflowExecutionId": 123,
  "nodeId": "switch_node_1",
  "variables": {
    "order_amount": 15000,
    "customer_status": "active"
  }
}
```

### **2. 節點配置**

#### **獲取節點配置**
```http
GET /api/workflow/nodes/{nodeId}/config
```

#### **更新節點配置**
```http
PUT /api/workflow/nodes/{nodeId}/config
Content-Type: application/json

{
  "qrCodeConfig": {
    "expectedFormat": "INV*{orderNo}",
    "fieldMappings": [
      {
        "sourceField": "orderNo",
        "targetVariable": "order_number"
      }
    ]
  }
}
```

## 🔍 **使用場景**

### **1. 電子商務訂單處理**

#### **流程描述**
1. 客戶通過 WhatsApp 發送訂單信息
2. QR Code 節點識別訂單號碼
3. DataSet 查詢節點獲取訂單詳情
4. Switch 節點根據訂單金額決定審批路徑
5. DataSet 更新節點更新訂單狀態

#### **節點配置示例**
```json
{
  "workflow": {
    "nodes": [
      {
        "id": "start",
        "type": "start",
        "next": "qrcode_node"
      },
      {
        "id": "qrcode_node",
        "type": "waitQRCode",
        "next": "query_order"
      },
      {
        "id": "query_order",
        "type": "datasetQuery",
        "next": "amount_check"
      },
      {
        "id": "amount_check",
        "type": "switch",
        "conditions": [
          {
            "condition": "${order_amount} > 10000",
            "targetNode": "manager_approval"
          },
          {
            "condition": "default",
            "targetNode": "auto_approve"
          }
        ]
      }
    ]
  }
}
```

### **2. 客戶服務流程**

#### **流程描述**
1. 客戶發送服務請求
2. 系統識別客戶身份
3. 查詢客戶歷史記錄
4. 根據客戶等級分配服務人員
5. 更新服務請求狀態

## 🚀 **最佳實踐**

### **1. 節點設計原則**
- **單一職責**: 每個節點只負責一個特定功能
- **可重用性**: 設計通用的節點配置
- **錯誤處理**: 完善的錯誤處理和恢復機制
- **性能優化**: 避免不必要的數據查詢和更新

### **2. 條件設計**
- **清晰邏輯**: 條件表達式要清晰易懂
- **覆蓋完整**: 確保所有可能的情況都有對應分支
- **默認處理**: 設置合理的默認分支
- **測試驗證**: 充分測試各種條件組合

### **3. 數據操作**
- **事務處理**: 使用數據庫事務確保數據一致性
- **權限控制**: 嚴格控制數據訪問權限
- **審計日誌**: 記錄所有數據操作
- **備份恢復**: 定期備份重要數據

## 🔮 **未來規劃**

### **1. 短期目標**
- 支持更多條件類型
- 增強數據驗證能力
- 改進錯誤處理機制

### **2. 中期目標**
- 支持機器學習預測
- 實現智能路由推薦
- 添加更多數據源支持

### **3. 長期目標**
- 支持自然語言條件描述
- 實現自動化流程優化
- 集成 AI 決策引擎

---

**文檔版本**: 1.0.0  
**最後更新**: 2025年8月31日  
**維護者**: 開發團隊


