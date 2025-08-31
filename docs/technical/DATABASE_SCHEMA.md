# 數據庫架構設計

## 🏗️ **系統概述**

WhattoFlow 採用多數據庫架構，主要包含兩個數據庫：
- **PurpleRice**: 系統核心數據庫，存儲工作流、用戶、公司等核心信息
- **ERP**: 企業資源規劃數據庫，存儲業務相關數據

## 📊 **PurpleRice 數據庫**

### **核心表結構**

#### **1. 工作流相關表**

##### **workflow_definitions**
工作流定義表，存儲工作流的基本信息和流程圖配置。

| 欄位 | 類型 | 說明 | 約束 |
|------|------|------|------|
| id | INT | 主鍵，自增 | PRIMARY KEY, IDENTITY(1,1) |
| company_id | UNIQUEIDENTIFIER | 公司ID | NOT NULL, FOREIGN KEY |
| name | NVARCHAR(200) | 工作流名稱 | NOT NULL |
| description | NVARCHAR(1000) | 工作流描述 | NULL |
| json | NVARCHAR(MAX) | 流程圖JSON配置 | NULL |
| status | NVARCHAR(50) | 狀態 | DEFAULT 'Active' |
| created_at | DATETIME2 | 創建時間 | DEFAULT GETDATE() |
| updated_at | DATETIME2 | 更新時間 | NULL |
| created_by | NVARCHAR(100) | 創建者 | NOT NULL |
| updated_by | NVARCHAR(100) | 更新者 | NULL |

**索引**:
```sql
CREATE INDEX IX_WorkflowDefinitions_CompanyId ON workflow_definitions(company_id);
CREATE INDEX IX_WorkflowDefinitions_Status ON workflow_definitions(status);
CREATE INDEX IX_WorkflowDefinitions_CreatedAt ON workflow_definitions(created_at);
```

##### **workflow_executions**
工作流執行實例表，記錄每次工作流執行的狀態和結果。

| 欄位 | 類型 | 說明 | 約束 |
|------|------|------|------|
| id | INT | 主鍵，自增 | PRIMARY KEY, IDENTITY(1,1) |
| workflow_definition_id | INT | 工作流定義ID | NOT NULL, FOREIGN KEY |
| status | NVARCHAR(50) | 執行狀態 | DEFAULT 'Running' |
| current_step | INT | 當前步驟 | NULL |
| input_json | NVARCHAR(MAX) | 輸入數據JSON | NULL |
| output_json | NVARCHAR(MAX) | 輸出數據JSON | NULL |
| started_at | DATETIME2 | 開始時間 | DEFAULT GETDATE() |
| ended_at | DATETIME2 | 結束時間 | NULL |
| created_by | NVARCHAR(100) | 創建者 | NOT NULL |
| error_message | NVARCHAR(MAX) | 錯誤信息 | NULL |
| is_waiting | BIT | 是否等待中 | DEFAULT 0 |
| waiting_since | DATETIME2 | 等待開始時間 | NULL |
| last_user_activity | DATETIME2 | 最後用戶活動時間 | NULL |
| current_waiting_step | INT | 當前等待步驟 | NULL |
| waiting_for_user | NVARCHAR(100) | 等待的用戶 | NULL |

**索引**:
```sql
CREATE INDEX IX_WorkflowExecutions_DefinitionId ON workflow_executions(workflow_definition_id);
CREATE INDEX IX_WorkflowExecutions_Status ON workflow_executions(status);
CREATE INDEX IX_WorkflowExecutions_StartedAt ON workflow_executions(started_at);
CREATE INDEX IX_WorkflowExecutions_Waiting ON workflow_executions(is_waiting, waiting_since);
```

##### **workflow_step_executions**
工作流步驟執行記錄表，詳細記錄每個步驟的執行情況。

| 欄位 | 類型 | 說明 | 約束 |
|------|------|------|------|
| id | INT | 主鍵，自增 | PRIMARY KEY, IDENTITY(1,1) |
| workflow_execution_id | INT | 工作流執行ID | NOT NULL, FOREIGN KEY |
| step_name | NVARCHAR(200) | 步驟名稱 | NOT NULL |
| step_type | NVARCHAR(100) | 步驟類型 | NOT NULL |
| status | NVARCHAR(50) | 步驟狀態 | DEFAULT 'Pending' |
| input_data | NVARCHAR(MAX) | 輸入數據 | NULL |
| output_data | NVARCHAR(MAX) | 輸出數據 | NULL |
| started_at | DATETIME2 | 開始時間 | DEFAULT GETDATE() |
| completed_at | DATETIME2 | 完成時間 | NULL |
| error_message | NVARCHAR(MAX) | 錯誤信息 | NULL |
| retry_count | INT | 重試次數 | DEFAULT 0 |
| max_retries | INT | 最大重試次數 | DEFAULT 3 |

**索引**:
```sql
CREATE INDEX IX_WorkflowStepExecutions_ExecutionId ON workflow_step_executions(workflow_execution_id);
CREATE INDEX IX_WorkflowStepExecutions_Status ON workflow_step_executions(status);
CREATE INDEX IX_WorkflowStepExecutions_StartedAt ON workflow_step_executions(started_at);
```

#### **2. 流程變量相關表**

##### **process_variable_definitions**
流程變量定義表，定義工作流中可使用的變量。

| 欄位 | 類型 | 說明 | 約束 |
|------|------|------|------|
| id | UNIQUEIDENTIFIER | 主鍵 | PRIMARY KEY, DEFAULT NEWID() |
| workflow_definition_id | INT | 工作流定義ID | NOT NULL, FOREIGN KEY |
| variable_name | NVARCHAR(100) | 變量名稱 | NOT NULL |
| display_name | NVARCHAR(200) | 顯示名稱 | NULL |
| data_type | NVARCHAR(50) | 數據類型 | NOT NULL |
| description | NVARCHAR(500) | 描述 | NULL |
| is_required | BIT | 是否必填 | DEFAULT 0 |
| default_value | NVARCHAR(500) | 默認值 | NULL |
| validation_rules | NVARCHAR(1000) | 驗證規則(JSON) | NULL |
| json_schema | NVARCHAR(MAX) | JSON Schema | NULL |
| created_at | DATETIME2 | 創建時間 | DEFAULT GETDATE() |
| updated_at | DATETIME2 | 更新時間 | NULL |
| created_by | NVARCHAR(100) | 創建者 | NOT NULL |
| updated_by | NVARCHAR(100) | 更新者 | NULL |

**索引**:
```sql
CREATE INDEX IX_ProcessVariableDefinitions_WorkflowId ON process_variable_definitions(workflow_definition_id);
CREATE INDEX IX_ProcessVariableDefinitions_Name ON process_variable_definitions(variable_name);
CREATE INDEX IX_ProcessVariableDefinitions_DataType ON process_variable_definitions(data_type);
```

##### **process_variable_values**
流程變量值表，存儲工作流執行時的變量實際值。

| 欄位 | 類型 | 說明 | 約束 |
|------|------|------|------|
| id | UNIQUEIDENTIFIER | 主鍵 | PRIMARY KEY, DEFAULT NEWID() |
| workflow_execution_id | INT | 工作流執行ID | NOT NULL, FOREIGN KEY |
| variable_name | NVARCHAR(100) | 變量名稱 | NOT NULL |
| data_type | NVARCHAR(50) | 數據類型 | NOT NULL |
| string_value | NVARCHAR(500) | 字串值 | NULL |
| numeric_value | DECIMAL(18,4) | 數值 | NULL |
| date_value | DATETIME2(7) | 日期值 | NULL |
| boolean_value | BIT | 布林值 | NULL |
| text_value | NVARCHAR(MAX) | 長文本值 | NULL |
| json_value | NVARCHAR(MAX) | JSON值 | NULL |
| set_at | DATETIME2 | 設置時間 | DEFAULT GETDATE() |
| set_by | NVARCHAR(100) | 設置者 | NULL |
| source_type | NVARCHAR(50) | 來源類型 | NULL |
| source_reference | NVARCHAR(500) | 來源參考 | NULL |

**索引**:
```sql
CREATE INDEX IX_ProcessVariableValues_ExecutionId ON process_variable_values(workflow_execution_id);
CREATE INDEX IX_ProcessVariableValues_Name ON process_variable_values(variable_name);
CREATE INDEX IX_ProcessVariableValues_SetAt ON process_variable_values(set_at);
CREATE INDEX IX_ProcessVariableValues_SourceType ON process_variable_values(source_type);
```

##### **variable_mappings**
變量映射配置表，定義數據源到流程變量的映射關係。

| 欄位 | 類型 | 說明 | 約束 |
|------|------|------|------|
| id | UNIQUEIDENTIFIER | 主鍵 | PRIMARY KEY, DEFAULT NEWID() |
| workflow_definition_id | INT | 工作流定義ID | NOT NULL, FOREIGN KEY |
| source_type | NVARCHAR(50) | 來源類型 | NOT NULL |
| source_id | NVARCHAR(100) | 來源ID | NULL |
| source_field | NVARCHAR(100) | 來源欄位 | NULL |
| target_variable | NVARCHAR(100) | 目標變量 | NOT NULL |
| mapping_type | NVARCHAR(50) | 映射類型 | NOT NULL |
| transformation_rules | NVARCHAR(1000) | 轉換規則(JSON) | NULL |
| created_at | DATETIME2 | 創建時間 | DEFAULT GETDATE() |

**索引**:
```sql
CREATE INDEX IX_VariableMappings_WorkflowId ON variable_mappings(workflow_definition_id);
CREATE INDEX IX_VariableMappings_SourceType ON variable_mappings(source_type);
CREATE INDEX IX_VariableMappings_TargetVariable ON variable_mappings(target_variable);
```

##### **switch_node_conditions**
Switch 節點條件配置表，存儲條件分支的配置信息。

| 欄位 | 類型 | 說明 | 約束 |
|------|------|------|------|
| id | UNIQUEIDENTIFIER | 主鍵 | PRIMARY KEY, DEFAULT NEWID() |
| workflow_definition_id | INT | 工作流定義ID | NOT NULL, FOREIGN KEY |
| node_id | NVARCHAR(100) | 節點ID | NOT NULL |
| condition_order | INT | 條件順序 | NOT NULL |
| condition_name | NVARCHAR(200) | 條件名稱 | NULL |
| condition_type | NVARCHAR(50) | 條件類型 | NOT NULL |
| condition_config | NVARCHAR(MAX) | 條件配置(JSON) | NULL |
| target_node_id | NVARCHAR(100) | 目標節點ID | NULL |
| is_default | BIT | 是否默認分支 | DEFAULT 0 |
| created_at | DATETIME2 | 創建時間 | DEFAULT GETDATE() |

**索引**:
```sql
CREATE INDEX IX_SwitchNodeConditions_WorkflowId ON switch_node_conditions(workflow_definition_id);
CREATE INDEX IX_SwitchNodeConditions_NodeId ON switch_node_conditions(node_id);
CREATE INDEX IX_SwitchNodeConditions_Order ON switch_node_conditions(condition_order);
```

#### **3. 數據集相關表**

##### **data_sets**
數據集定義表，存儲數據集的基本信息和配置。

| 欄位 | 類型 | 說明 | 約束 |
|------|------|------|------|
| id | UNIQUEIDENTIFIER | 主鍵 | PRIMARY KEY, DEFAULT NEWID() |
| name | NVARCHAR(200) | 數據集名稱 | NOT NULL |
| description | NVARCHAR(500) | 描述 | NULL |
| data_source_type | NVARCHAR(50) | 數據源類型 | NOT NULL |
| company_id | UNIQUEIDENTIFIER | 公司ID | NOT NULL, FOREIGN KEY |
| status | NVARCHAR(50) | 狀態 | DEFAULT 'Active' |
| is_scheduled | BIT | 是否定時更新 | DEFAULT 0 |
| update_interval_minutes | INT | 更新間隔(分鐘) | NULL |
| last_update_time | DATETIME2 | 最後更新時間 | NULL |
| next_update_time | DATETIME2 | 下次更新時間 | NULL |
| total_records | INT | 總記錄數 | DEFAULT 0 |
| last_data_sync_time | DATETIME2 | 最後數據同步時間 | NULL |
| created_by | NVARCHAR(100) | 創建者 | NOT NULL |
| created_at | DATETIME2 | 創建時間 | DEFAULT GETDATE() |
| updated_by | NVARCHAR(100) | 更新者 | NULL |
| updated_at | DATETIME2 | 更新時間 | NULL |

**索引**:
```sql
CREATE INDEX IX_DataSets_CompanyId ON data_sets(company_id);
CREATE INDEX IX_DataSets_Status ON data_sets(status);
CREATE INDEX IX_DataSets_DataSourceType ON data_sets(data_source_type);
```

##### **data_set_columns**
數據集欄位定義表，定義數據集的結構。

| 欄位 | 類型 | 說明 | 約束 |
|------|------|------|------|
| id | UNIQUEIDENTIFIER | 主鍵 | PRIMARY KEY, DEFAULT NEWID() |
| data_set_id | UNIQUEIDENTIFIER | 數據集ID | NOT NULL, FOREIGN KEY |
| column_name | NVARCHAR(100) | 欄位名稱 | NOT NULL |
| display_name | NVARCHAR(100) | 顯示名稱 | NULL |
| data_type | NVARCHAR(50) | 數據類型 | NOT NULL |
| max_length | INT | 最大長度 | NULL |
| is_required | BIT | 是否必填 | DEFAULT 0 |
| is_primary_key | BIT | 是否主鍵 | DEFAULT 0 |
| is_searchable | BIT | 是否可搜索 | DEFAULT 0 |
| is_sortable | BIT | 是否可排序 | DEFAULT 0 |
| is_indexed | BIT | 是否建索引 | DEFAULT 0 |
| default_value | NVARCHAR(500) | 默認值 | NULL |
| sort_order | INT | 排序順序 | DEFAULT 0 |

**索引**:
```sql
CREATE INDEX IX_DataSetColumns_DataSetId ON data_set_columns(data_set_id);
CREATE INDEX IX_DataSetColumns_ColumnName ON data_set_columns(column_name);
CREATE INDEX IX_DataSetColumns_DataType ON data_set_columns(data_type);
```

##### **data_set_records**
數據集記錄表，存儲數據集的實際數據。

| 欄位 | 類型 | 說明 | 約束 |
|------|------|------|------|
| id | UNIQUEIDENTIFIER | 主鍵 | PRIMARY KEY, DEFAULT NEWID() |
| data_set_id | UNIQUEIDENTIFIER | 數據集ID | NOT NULL, FOREIGN KEY |
| primary_key_value | NVARCHAR(500) | 主鍵值 | NULL |
| status | NVARCHAR(50) | 狀態 | DEFAULT 'Active' |
| created_at | DATETIME2 | 創建時間 | DEFAULT GETDATE() |
| updated_at | DATETIME2 | 更新時間 | NULL |

**索引**:
```sql
CREATE INDEX IX_DataSetRecords_DataSetId ON data_set_records(data_set_id);
CREATE INDEX IX_DataSetRecords_PrimaryKey ON data_set_records(primary_key_value);
CREATE INDEX IX_DataSetRecords_Status ON data_set_records(status);
```

##### **data_set_record_values**
數據集記錄值表，採用 EAV 模式存儲不同類型的值。

| 欄位 | 類型 | 說明 | 約束 |
|------|------|------|------|
| id | UNIQUEIDENTIFIER | 主鍵 | PRIMARY KEY, DEFAULT NEWID() |
| record_id | UNIQUEIDENTIFIER | 記錄ID | NOT NULL, FOREIGN KEY |
| column_name | NVARCHAR(100) | 欄位名稱 | NOT NULL |
| string_value | NVARCHAR(500) | 字串值 | NULL |
| numeric_value | DECIMAL(18,4) | 數值 | NULL |
| date_value | DATETIME2(7) | 日期值 | NULL |
| boolean_value | BIT | 布林值 | NULL |
| text_value | NVARCHAR(MAX) | 長文本值 | NULL |

**索引**:
```sql
CREATE INDEX IX_DataSetRecordValues_RecordId ON data_set_record_values(record_id);
CREATE INDEX IX_DataSetRecordValues_ColumnName ON data_set_record_values(column_name);
CREATE INDEX IX_DataSetRecordValues_StringValue ON data_set_record_values(string_value);
CREATE INDEX IX_DataSetRecordValues_NumericValue ON data_set_record_values(numeric_value);
CREATE INDEX IX_DataSetRecordValues_DateValue ON data_set_record_values(date_value);
```

#### **4. 其他核心表**

##### **companies**
公司信息表，支持多租戶架構。

| 欄位 | 類型 | 說明 | 約束 |
|------|------|------|------|
| id | UNIQUEIDENTIFIER | 主鍵 | PRIMARY KEY, DEFAULT NEWID() |
| name | NVARCHAR(200) | 公司名稱 | NOT NULL |
| description | NVARCHAR(500) | 描述 | NULL |
| status | NVARCHAR(50) | 狀態 | DEFAULT 'Active' |
| wa_webhook_token | NVARCHAR(100) | WhatsApp Webhook Token | NULL |
| wa_verify_token | NVARCHAR(100) | WhatsApp 驗證 Token | NULL |
| wa_api_key | NVARCHAR(500) | WhatsApp API Key | NULL |
| wa_phone_no_id | NVARCHAR(100) | WhatsApp Phone Number ID | NULL |
| created_at | DATETIME2 | 創建時間 | DEFAULT GETDATE() |
| updated_at | DATETIME2 | 更新時間 | NULL |

**索引**:
```sql
CREATE INDEX IX_Companies_Status ON companies(status);
CREATE INDEX IX_Companies_WebhookToken ON companies(wa_webhook_token);
```

##### **users**
用戶信息表，存儲系統用戶的基本信息。

| 欄位 | 類型 | 說明 | 約束 |
|------|------|------|------|
| id | UNIQUEIDENTIFIER | 主鍵 | PRIMARY KEY, DEFAULT NEWID() |
| company_id | UNIQUEIDENTIFIER | 公司ID | NOT NULL, FOREIGN KEY |
| username | NVARCHAR(100) | 用戶名 | NOT NULL, UNIQUE |
| email | NVARCHAR(200) | 電子郵件 | NOT NULL, UNIQUE |
| phone | NVARCHAR(50) | 電話號碼 | NULL |
| full_name | NVARCHAR(200) | 全名 | NOT NULL |
| role | NVARCHAR(50) | 角色 | DEFAULT 'User' |
| status | NVARCHAR(50) | 狀態 | DEFAULT 'Active' |
| created_at | DATETIME2 | 創建時間 | DEFAULT GETDATE() |
| updated_at | DATETIME2 | 更新時間 | NULL |

**索引**:
```sql
CREATE INDEX IX_Users_CompanyId ON users(company_id);
CREATE INDEX IX_Users_Username ON users(username);
CREATE INDEX IX_Users_Email ON users(email);
CREATE INDEX IX_Users_Status ON users(status);
```

## 🔗 **ERP 數據庫**

### **主要表結構**

#### **so_order_manage**
銷售訂單管理表，存儲訂單的基本信息。

| 欄位 | 類型 | 說明 | 約束 |
|------|------|------|------|
| within_code | NVARCHAR(10) | 公司代碼 | PRIMARY KEY |
| id | NVARCHAR(20) | 訂單ID | PRIMARY KEY |
| invoiceno | NVARCHAR(20) | 發票號碼 | NOT NULL |
| customerno | NVARCHAR(20) | 客戶編號 | NOT NULL |
| order_date | DATETIME2 | 訂單日期 | NULL |
| status | NVARCHAR(20) | 訂單狀態 | NULL |
| total_amount | DECIMAL(18,2) | 訂單總額 | NULL |

#### **it_customer**
客戶信息表，存儲客戶的基本資料。

| 欄位 | 類型 | 說明 | 約束 |
|------|------|------|------|
| within_code | NVARCHAR(10) | 公司代碼 | PRIMARY KEY |
| id | NVARCHAR(20) | 客戶ID | PRIMARY KEY |
| customerno | NVARCHAR(20) | 客戶編號 | NOT NULL |
| customername1 | NVARCHAR(100) | 客戶名稱1 | NULL |
| customername2 | NVARCHAR(100) | 客戶名稱2 | NULL |
| contacttel1 | NVARCHAR(30) | 聯繫電話1 | NULL |
| contacttel2 | NVARCHAR(30) | 聯繫電話2 | NULL |
| peaddress1 | NVARCHAR(100) | 主要地址1 | NULL |

## 🔐 **安全設計**

### **數據隔離**
- 公司級別的數據隔離
- 用戶只能訪問所屬公司的數據
- 數據庫級別的權限控制

### **審計日誌**
- 所有重要操作都記錄審計日誌
- 用戶操作追蹤
- 數據變更歷史記錄

### **加密存儲**
- 敏感信息加密存儲
- API Key 等機密信息加密
- 密碼哈希存儲

## 📈 **性能優化**

### **索引策略**
- 主鍵和唯一索引
- 外鍵關聯索引
- 查詢頻繁欄位的複合索引
- 時間範圍查詢的索引

### **分區策略**
- 大表按時間分區
- 歷史數據歸檔
- 讀寫分離準備

### **緩存策略**
- 熱點數據緩存
- 查詢結果緩存
- 配置信息緩存

---

**文檔版本**: 2.1.0  
**最後更新**: 2025年8月31日  
**維護者**: 開發團隊
