# API 參考文檔

## �� **概述**

WhattoFlow 系統提供完整的 RESTful API 接口，支持所有核心功能的操作。本文檔詳細描述了所有可用的 API 端點、請求格式、響應結構和錯誤處理。

## 🔐 **認證**

### **JWT Token 認證**
所有 API 請求都需要在 Header 中包含有效的 JWT Token：

```http
Authorization: Bearer <your-jwt-token>
```

### **Token 獲取**
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "your_username",
  "password": "your_password"
}
```

**響應示例：**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "username": "your_username",
    "email": "user@example.com",
    "companyId": "123e4567-e89b-12d3-a456-426614174001",
    "role": "CompanyAdmin"
  }
}
```

## �� **數據集管理 API**

### **獲取數據集列表**
```http
GET /api/datasets
Authorization: Bearer <token>
```

**查詢參數：**
- `page`: 頁碼 (默認: 1)
- `pageSize`: 每頁大小 (默認: 20)
- `search`: 搜索關鍵字
- `status`: 狀態篩選

**響應示例：**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "123e4567-e89b-12d3-a456-426614174000",
        "name": "客戶資料",
        "description": "客戶基本信息數據集",
        "type": "SQL",
        "status": "Active",
        "createdAt": "2024-12-19T10:00:00Z",
        "updatedAt": "2024-12-19T10:00:00Z"
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 20
  }
}
```

### **創建數據集**
```http
POST /api/datasets
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "新數據集",
  "description": "數據集描述",
  "type": "SQL",
  "connectionString": "Server=localhost;Database=testdb;",
  "query": "SELECT * FROM Users",
  "parameters": [
    {
      "name": "CompanyId",
      "type": "Guid",
      "defaultValue": null
    }
  ]
}
```

### **更新數據集**
```http
PUT /api/datasets/{id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "更新後的數據集名稱",
  "description": "更新後的描述",
  "query": "SELECT * FROM Users WHERE CompanyId = @CompanyId"
}
```

### **刪除數據集**
```http
DELETE /api/datasets/{id}
Authorization: Bearer <token>
```

## 📋 **E-Form 表單 API**

### **獲取表單定義列表**
```http
GET /api/eforms
Authorization: Bearer <token>
```

**響應示例：**
```json
{
  "success": true,
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "name": "客戶註冊表",
      "description": "新客戶註冊表單",
      "status": "Active",
      "createdAt": "2024-12-19T10:00:00Z",
      "updatedAt": "2024-12-19T10:00:00Z"
    }
  ]
}
```

### **創建表單定義**
```http
POST /api/eforms
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "新表單",
  "description": "表單描述",
  "htmlCode": "<!DOCTYPE html><html>...</html>"
}
```

### **獲取表單實例**
```http
GET /api/eforms/{id}/instances
Authorization: Bearer <token>
```

### **提交表單數據**
```http
POST /api/eforms/{id}/submit
Authorization: Bearer <token>
Content-Type: application/json

{
  "formData": {
    "name": "張三",
    "email": "zhangsan@example.com",
    "phone": "13800138000"
  }
}
```

## �� **WhatsApp 工作流 API**

### **獲取工作流定義列表**
```http
GET /api/workflows
Authorization: Bearer <token>
```

### **創建工作流定義**
```http
POST /api/workflows
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "客戶服務工作流",
  "description": "自動化客戶服務流程",
  "workflowData": {
    "nodes": [...],
    "edges": [...]
  }
}
```

### **執行工作流**
```http
POST /api/workflows/{id}/execute
Authorization: Bearer <token>
Content-Type: application/json

{
  "phoneNumber": "+8613800138000",
  "variables": {
    "customerName": "張三",
    "orderId": "ORD001"
  }
}
```

### **獲取工作流實例狀態**
```http
GET /api/workflows/instances/{instanceId}
Authorization: Bearer <token>
```

## 👥 **用戶管理 API**

### **獲取用戶列表**
```http
GET /api/users
Authorization: Bearer <token>
```

**查詢參數：**
- `page`: 頁碼
- `pageSize`: 每頁大小
- `search`: 搜索關鍵字
- `role`: 角色篩選
- `status`: 狀態篩選

### **創建用戶**
```http
POST /api/users
Authorization: Bearer <token>
Content-Type: application/json

{
  "username": "newuser",
  "email": "newuser@example.com",
  "password": "SecurePassword123!",
  "role": "User",
  "companyId": "123e4567-e89b-12d3-a456-426614174001"
}
```

### **更新用戶**
```http
PUT /api/users/{id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "email": "updated@example.com",
  "role": "Manager"
}
```

### **刪除用戶**
```http
DELETE /api/users/{id}
Authorization: Bearer <token>
```

## 📄 **文檔轉換 API**

### **上傳文檔**
```http
POST /api/forms-upload/document
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <document_file>
```

**支持的文件格式：**
- Word: .doc, .docx
- Excel: .xls, .xlsx
- PowerPoint: .ppt, .pptx
- PDF: .pdf
- 圖片: .jpg, .png, .gif
- 文本: .txt

### **轉換文檔**
```http
POST /api/document-converter/convert
Authorization: Bearer <token>
Content-Type: application/json

{
  "sourceFormat": "docx",
  "targetFormat": "pdf",
  "filePath": "/uploads/document.docx"
}
```

## �� **AI 服務 API**

### **AI 聊天**
```http
POST /api/ai/chat
Authorization: Bearer <token>
Content-Type: application/json

{
  "message": "用戶消息",
  "context": "對話上下文",
  "model": "grok-3"
}
```

### **AI 表單生成**
```http
POST /api/ai/generate-form
Authorization: Bearer <token>
Content-Type: application/json

{
  "description": "請創建一個客戶註冊表單",
  "systemPrompt": "你是一個專業的HTML表單設計師..."
}
```

## 📊 **數據查詢 API**

### **執行數據集查詢**
```http
POST /api/datasets/{id}/query
Authorization: Bearer <token>
Content-Type: application/json

{
  "parameters": {
    "CompanyId": "123e4567-e89b-12d3-a456-426614174001",
    "StartDate": "2024-01-01",
    "EndDate": "2024-12-31"
  }
}
```

### **獲取查詢結果**
```http
GET /api/datasets/{id}/results?queryId={queryId}
Authorization: Bearer <token>
```

## ⚠️ **錯誤處理**

### **錯誤響應格式**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "驗證失敗",
    "details": [
      {
        "field": "email",
        "message": "電子郵件格式無效"
      }
    ]
  }
}
```

### **常見錯誤代碼**
- `UNAUTHORIZED`: 未授權訪問
- `FORBIDDEN`: 權限不足
- `NOT_FOUND`: 資源不存在
- `VALIDATION_ERROR`: 驗證失敗
- `INTERNAL_ERROR`: 內部服務錯誤
- `RATE_LIMIT_EXCEEDED`: 請求頻率超限

### **HTTP 狀態碼**
- `200 OK`: 請求成功
- `201 Created`: 資源創建成功
- `400 Bad Request`: 請求參數錯誤
- `401 Unauthorized`: 未授權
- `403 Forbidden`: 權限不足
- `404 Not Found`: 資源不存在
- `429 Too Many Requests`: 請求頻率超限
- `500 Internal Server Error`: 內部服務錯誤

## �� **分頁和排序**

### **分頁參數**
- `page`: 頁碼 (從 1 開始)
- `pageSize`: 每頁大小 (默認 20，最大 100)

### **排序參數**
- `sortBy`: 排序字段
- `sortOrder`: 排序方向 (`asc` 或 `desc`)

**示例：**
```http
GET /api/datasets?page=1&pageSize=10&sortBy=createdAt&sortOrder=desc
```

## 🔍 **搜索和篩選**

### **搜索參數**
- `search`: 全局搜索關鍵字
- `status`: 狀態篩選
- `type`: 類型篩選
- `dateFrom`: 開始日期
- `dateTo`: 結束日期

**示例：**
```http
GET /api/datasets?search=客戶&status=Active&type=SQL&dateFrom=2024-01-01
```

## 📝 **API 版本控制**

當前 API 版本：`v1`

在 URL 中包含版本號：
```http
GET /api/v1/datasets
```

## 🚀 **速率限制**

為了保護系統穩定性，API 實施了速率限制：

- **認證用戶**: 1000 請求/小時
- **未認證用戶**: 100 請求/小時
- **文件上傳**: 10 文件/小時

超過限制時會返回 `429 Too Many Requests` 狀態碼。

## 📚 **SDK 和示例**

### **C# 客戶端示例**
```csharp
using var client = new HttpClient();
client.DefaultRequestHeaders.Authorization = 
    new AuthenticationHeaderValue("Bearer", token);

var response = await client.GetAsync("/api/datasets");
var datasets = await response.Content.ReadFromJsonAsync<ApiResponse<List<Dataset>>>();
```

### **JavaScript 客戶端示例**
```javascript
const response = await fetch('/api/datasets', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

const datasets = await response.json();
```

---

**最後更新**: 2025年8月20日
**API 版本**: v1
