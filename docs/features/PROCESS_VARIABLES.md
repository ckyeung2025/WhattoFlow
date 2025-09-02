# 流程變量系統 (Process Variables)

## 🎯 **功能概述**

流程變量系統是 WhattoFlow 的核心功能之一，它允許在工作流執行過程中動態管理數據，實現數據在不同節點之間的傳遞和轉換。系統支持多種數據類型，包括基本類型和複雜的 JSON 結構，並提供強大的映射和轉換能力。

## 🏗️ **系統架構**

### **核心組件**
- **ProcessVariableDefinitions**: 流程變量定義表
- **ProcessVariableValues**: 流程變量值表
- **VariableMappings**: 變量映射配置表
- **ProcessVariableService**: 變量管理服務
- **VariableMappingEngine**: 變量映射引擎

### **數據流程**
```
外部數據源 → 變量映射 → 流程變量 → 節點使用 → 變量更新 → 輸出映射
```

## 📊 **數據模型**

### **1. 流程變量定義 (ProcessVariableDefinitions)**

| 欄位 | 類型 | 說明 |
|------|------|------|
| id | UNIQUEIDENTIFIER | 主鍵 |
| workflow_definition_id | INT | 工作流定義ID |
| variable_name | NVARCHAR(100) | 變量名稱 |
| display_name | NVARCHAR(200) | 顯示名稱 |
| data_type | NVARCHAR(50) | 數據類型 |
| description | NVARCHAR(500) | 描述 |
| is_required | BIT | 是否必填 |
| default_value | NVARCHAR(500) | 默認值 |
| validation_rules | NVARCHAR(1000) | 驗證規則(JSON) |
| json_schema | NVARCHAR(MAX) | JSON Schema |

### **2. 流程變量值 (ProcessVariableValues)**

| 欄位 | 類型 | 說明 |
|------|------|------|
| id | UNIQUEIDENTIFIER | 主鍵 |
| workflow_execution_id | INT | 工作流執行ID |
| variable_name | NVARCHAR(100) | 變量名稱 |
| data_type | NVARCHAR(50) | 數據類型 |
| string_value | NVARCHAR(500) | 字串值 |
| numeric_value | DECIMAL(18,4) | 數值 |
| date_value | DATETIME2(7) | 日期值 |
| boolean_value | BIT | 布林值 |
| text_value | NVARCHAR(MAX) | 長文本值 |
| json_value | NVARCHAR(MAX) | JSON值 |
| set_at | DATETIME2 | 設置時間 |
| set_by | NVARCHAR(100) | 設置者 |
| source_type | NVARCHAR(50) | 來源類型 |
| source_reference | NVARCHAR(500) | 來源參考 |

### **3. 變量映射配置 (VariableMappings)**

| 欄位 | 類型 | 說明 |
|------|------|------|
| id | UNIQUEIDENTIFIER | 主鍵 |
| workflow_definition_id | INT | 工作流定義ID |
| source_type | NVARCHAR(50) | 來源類型 |
| source_id | NVARCHAR(100) | 來源ID |
| source_field | NVARCHAR(100) | 來源欄位 |
| target_variable | NVARCHAR(100) | 目標變量 |
| mapping_type | NVARCHAR(50) | 映射類型 |
| transformation_rules | NVARCHAR(1000) | 轉換規則(JSON) |

## 🔧 **功能特性**

### **1. 多數據類型支持**

#### **基本類型**
- **string**: 字串類型，最大長度 500 字符
- **int**: 整數類型
- **decimal**: 小數類型，精度 18,4
- **datetime**: 日期時間類型
- **boolean**: 布林類型

#### **JSON 類型**
- **json**: 複雜數據結構，支持嵌套對象和數組
- **JSON Schema**: 可選的結構驗證
- **動態查詢**: 支持 JSON 路徑查詢

### **2. 變量映射能力**

#### **映射類型**
- **input**: 從外部數據源到流程變量
- **output**: 從流程變量到外部數據源
- **bidirectional**: 雙向數據映射

#### **數據源支持**
- **DataSet**: 系統內部的數據集
- **eForm**: 電子表單數據
- **External API**: 外部 API 數據
- **QR Code**: QR Code 掃描結果

### **3. 轉換規則**

#### **數據類型轉換**
```json
{
  "type": "type_conversion",
  "from": "string",
  "to": "datetime",
  "format": "yyyy-MM-dd"
}
```

#### **數據格式化**
```json
{
  "type": "formatting",
  "format": "currency",
  "locale": "zh-TW",
  "currency": "TWD"
}
```

#### **條件轉換**
```json
{
  "type": "conditional",
  "condition": "${amount} > 1000",
  "true_value": "high",
  "false_value": "low"
}
```

## 🎨 **用戶介面**

### **1. 變量定義管理**

#### **變量列表**
- 顯示所有流程變量
- 支持搜索和篩選
- 顯示變量類型和狀態

#### **變量編輯器**
- 基本信息設置
- 數據類型選擇
- 驗證規則配置
- JSON Schema 編輯器

### **2. 變量映射配置**

#### **映射列表**
- 顯示所有映射配置
- 支持按來源類型篩選
- 顯示映射狀態

#### **映射編輯器**
- 來源配置
- 目標變量選擇
- 轉換規則設置
- 映射測試

### **3. 變量監控**

#### **實時值顯示**
- 當前變量值
- 數據類型標識
- 最後更新時間

#### **歷史記錄**
- 變量值變更歷史
- 來源追蹤
- 操作者記錄

## 💻 **API 接口**

### **1. 變量定義管理**

#### **創建變量定義**
```http
POST /api/processvariables/definitions
Content-Type: application/json

{
  "workflowDefinitionId": 1,
  "variableName": "customer_name",
  "displayName": "客戶名稱",
  "dataType": "string",
  "description": "客戶的完整名稱",
  "isRequired": true,
  "defaultValue": "",
  "validationRules": "{\"maxLength\": 100}",
  "jsonSchema": null
}
```

#### **更新變量定義**
```http
PUT /api/processvariables/definitions/{id}
Content-Type: application/json

{
  "displayName": "客戶全名",
  "description": "客戶的完整姓名",
  "validationRules": "{\"maxLength\": 150, \"pattern\": \"^[\\u4e00-\\u9fa5a-zA-Z\\s]+$\"}"
}
```

### **2. 變量值操作**

#### **設置變量值**
```http
POST /api/processvariables/values
Content-Type: application/json

{
  "workflowExecutionId": 123,
  "variableName": "customer_name",
  "dataType": "string",
  "stringValue": "張三",
  "sourceType": "user_input",
  "sourceReference": "form_field_customer_name"
}
```

#### **獲取變量值**
```http
GET /api/processvariables/values/{workflowExecutionId}/{variableName}
```

#### **批量獲取變量值**
```http
GET /api/processvariables/values/{workflowExecutionId}
```

### **3. 變量映射**

#### **創建映射配置**
```http
POST /api/processvariables/mappings
Content-Type: application/json

{
  "workflowDefinitionId": 1,
  "sourceType": "dataset",
  "sourceId": "customer_dataset",
  "sourceField": "customer_name",
  "targetVariable": "customer_name",
  "mappingType": "input",
  "transformationRules": "{\"type\": \"uppercase\"}"
}
```

## 🔍 **使用場景**

### **1. 客戶訂單處理**

#### **流程描述**
1. 用戶通過 WhatsApp 發送訂單信息
2. 系統提取訂單號碼
3. 查詢客戶數據庫獲取客戶信息
4. 將客戶信息映射到流程變量
5. 在後續節點中使用客戶信息

#### **變量配置**
```json
{
  "variables": [
    {
      "name": "order_number",
      "type": "string",
      "source": "whatsapp_message"
    },
    {
      "name": "customer_info",
      "type": "json",
      "source": "customer_database",
      "mapping": {
        "customer_name": "name",
        "customer_phone": "phone",
        "customer_address": "address"
      }
    }
  ]
}
```

### **2. 審批流程**

#### **流程描述**
1. 員工提交請假申請
2. 系統根據請假天數決定審批路徑
3. 將申請信息映射到流程變量
4. 根據變量值選擇審批者

#### **變量配置**
```json
{
  "variables": [
    {
      "name": "leave_days",
      "type": "int",
      "source": "form_input"
    },
    {
      "name": "approver_level",
      "type": "string",
      "source": "calculated",
      "calculation": "leave_days > 3 ? 'manager' : 'supervisor'"
    }
  ]
}
```

## 🚀 **最佳實踐**

### **1. 變量命名規範**
- 使用小寫字母和下劃線
- 名稱要具有描述性
- 避免使用保留字

### **2. 數據類型選擇**
- 基本類型用於簡單數據
- JSON 類型用於複雜結構
- 考慮數據的查詢和索引需求

### **3. 映射配置**
- 明確定義數據來源
- 設置適當的轉換規則
- 測試映射邏輯

### **4. 性能優化**
- 合理設置索引
- 避免過多的變量
- 定期清理歷史數據

## 🔮 **未來規劃**

### **1. 短期目標**
- 增強驗證規則引擎
- 支持更多數據源類型
- 改進變量監控介面

### **2. 中期目標**
- 支持變量版本控制
- 實現變量依賴關係
- 添加變量模板功能

### **3. 長期目標**
- 支持機器學習預測
- 實現智能變量推薦
- 集成更多外部系統

---

**文檔版本**: 1.0.0  
**最後更新**: 2025年8月31日  
**維護者**: 開發團隊


