# 數據庫結構設計

## ��️ **數據庫概覽**

WhattoFlow 系統使用 Microsoft SQL Server 作為主要數據庫，支持多租戶架構和複雜的業務邏輯。

## ��️ **核心表結構**

### **1. 用戶和認證相關**
```sql
-- 用戶表
CREATE TABLE Users (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    Account NVARCHAR(100) NOT NULL UNIQUE,
    Name NVARCHAR(100) NOT NULL,
    Email NVARCHAR(255),
    Phone NVARCHAR(20),
    CompanyId UNIQUEIDENTIFIER NOT NULL,
    CreatedAt DATETIME DEFAULT GETDATE(),
    UpdatedAt DATETIME
);

-- 公司表
CREATE TABLE Companies (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    Name NVARCHAR(100) NOT NULL,
    LogoUrl NVARCHAR(500),
    WA_WebhookToken NVARCHAR(100),
    WA_VerifyToken NVARCHAR(100),
    CreatedAt DATETIME DEFAULT GETDATE()
);
```

### **2. 數據集相關**
```sql
-- 數據集表
CREATE TABLE DataSets (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    Name NVARCHAR(100) NOT NULL,
    Description NVARCHAR(500),
    DataSourceType NVARCHAR(50),
    CompanyId UNIQUEIDENTIFIER NOT NULL,
    Status NVARCHAR(20) DEFAULT 'Active',
    CreatedAt DATETIME DEFAULT GETDATE(),
    CreatedBy NVARCHAR(100),
    UpdatedAt DATETIME,
    UpdatedBy NVARCHAR(100)
);

-- 數據集欄位表
CREATE TABLE DataSetColumns (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    DataSetId UNIQUEIDENTIFIER NOT NULL,
    ColumnName NVARCHAR(100) NOT NULL,
    DisplayName NVARCHAR(100),
    DataType NVARCHAR(50) NOT NULL,
    MaxLength INT,
    IsRequired BIT DEFAULT 0,
    IsPrimaryKey BIT DEFAULT 0,
    IsSearchable BIT DEFAULT 1,
    IsSortable BIT DEFAULT 1,
    IsIndexed BIT DEFAULT 0,
    DefaultValue NVARCHAR(500),
    SortOrder INT DEFAULT 0
);
```

### **3. 工作流相關**
```sql
-- 工作流定義表
CREATE TABLE WorkflowDefinitions (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    Name NVARCHAR(100) NOT NULL,
    Description NVARCHAR(500),
    Definition NVARCHAR(MAX), -- JSON 格式
    CompanyId UNIQUEIDENTIFIER NOT NULL,
    Status NVARCHAR(20) DEFAULT 'Active',
    CreatedAt DATETIME DEFAULT GETDATE(),
    CreatedBy NVARCHAR(100)
);

-- 工作流執行表
CREATE TABLE WorkflowExecutions (
    Id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    WorkflowDefinitionId UNIQUEIDENTIFIER NOT NULL,
    Status NVARCHAR(20) DEFAULT 'Running',
    StartedAt DATETIME DEFAULT GETDATE(),
    CompletedAt DATETIME,
    Result NVARCHAR(MAX) -- JSON 格式
);
```

## �� **索引設計**

### **1. 主要索引**
```sql
-- 用戶表索引
CREATE INDEX IX_Users_CompanyId ON Users(CompanyId);
CREATE INDEX IX_Users_Account ON Users(Account);

-- 數據集表索引
CREATE INDEX IX_DataSets_CompanyId ON DataSets(CompanyId);
CREATE INDEX IX_DataSets_Status ON DataSets(Status);

-- 工作流表索引
CREATE INDEX IX_WorkflowDefinitions_CompanyId ON WorkflowDefinitions(CompanyId);
CREATE INDEX IX_WorkflowExecutions_WorkflowDefinitionId ON WorkflowExecutions(WorkflowDefinitionId);
```

### **2. 複合索引**
```sql
-- 數據集記錄複合索引
CREATE INDEX IX_DataSetRecords_DataSetId_Status ON DataSetRecords(DataSetId, Status);

-- 工作流執行複合索引
CREATE INDEX IX_WorkflowExecutions_Status_StartedAt ON WorkflowExecutions(Status, StartedAt);
```

## �� **安全設計**

### **1. 數據隔離**
- 所有表都包含 `CompanyId` 字段
- 查詢時必須過濾 `CompanyId`
- 使用數據庫視圖限制跨公司訪問

### **2. 權限控制**
- 基於角色的訪問控制 (RBAC)
- 行級安全策略
- 敏感數據加密存儲

## �� **性能優化**

### **1. 查詢優化**
- 使用適當的索引
- 避免 N+1 查詢問題
- 使用分頁查詢處理大數據集

### **2. 數據分區**
- 大表按時間分區
- 歷史數據歸檔策略
- 讀寫分離準備

---

**最後更新**: 2025年8月20日
**系統版本**: v2.0
