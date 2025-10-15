# 🐛 關鍵 Bug 修復：Token 實例 ID 不匹配問題

## 問題描述

在 Manual Fill 模式下，生成的訪問 Token 與表單實例 ID 不匹配，導致所有帶 Token 的表單 URL 都無法訪問，返回 `{"error":"令牌與表單不匹配"}` 或 `{"error":"無效的訪問令牌"}`。

## 根本原因

在 `Services/WorkflowEngine.cs` 的 `ExecuteSendEForm` 方法中（第 1747 行），生成 Token 時使用了錯誤的實例 ID：

### 錯誤代碼（修復前）

```csharp
foreach (var recipient in resolvedRecipients)
{
    // ❌ 使用隨機生成的 GUID，不是實際的實例 ID
    var accessToken = _eFormTokenService.GenerateAccessToken(Guid.NewGuid(), recipient.PhoneNumber);
    
    // 創建獨立的表單實例
    var eFormInstance = new EFormInstance
    {
        Id = Guid.NewGuid(), // 這是另一個不同的 GUID！
        ...
    };
}
```

### 問題分析

1. **Token 生成**：使用了一個隨機的 `Guid.NewGuid()` 作為實例 ID
2. **實例創建**：又使用了另一個不同的 `Guid.NewGuid()` 作為實際的實例 ID
3. **結果**：Token 中嵌入的實例 ID 與數據庫中的實例 ID **完全不匹配**

### 數據庫證據

查詢數據庫發現：
- 實際實例 ID：`53153057-912D-4915-A530-F691444D1698`
- Token 中的實例 ID：`0ecc59e9-f7a5-42ba-b0ce-de68dd04be6a`（不存在於數據庫）

## 修復方案

### 正確代碼（修復後）

```csharp
foreach (var recipient in resolvedRecipients)
{
    // ✅ 先創建實例 ID
    var instanceId = Guid.NewGuid();
    
    // ✅ 使用實際的實例 ID 生成安全 Token
    var accessToken = _eFormTokenService.GenerateAccessToken(instanceId, recipient.PhoneNumber);
    
    // ✅ 創建獨立的表單實例，使用同一個 ID
    var eFormInstance = new EFormInstance
    {
        Id = instanceId, // 使用相同的 ID
        ...
        AccessToken = accessToken,
        ...
    };
}
```

## 影響範圍

### 受影響功能
- ✅ Manual Fill (Independent) 模式的所有表單實例
- ✅ 所有通過 WhatsApp 發送的表單 URL
- ✅ Token 驗證機制

### 不受影響功能
- ✅ Integrate Wait Reply Node (AI Fill) - 使用不同的訪問控制
- ✅ Integrate DataSet Query Node (Data Fill) - 使用不同的訪問控制
- ✅ Token 生成和驗證的核心邏輯本身是正確的

## 測試驗證

### 測試前（Bug 存在）
```bash
# 請求
GET http://localhost:64213/api/eforminstances/53153057-912d-4915-a530-f691444d1698/public?token=ehrCBfkHKAUoCCnSDZLzfEnSTZrRQsmGzERz1pGXRTIwZWNjNTllOS1mN2E1LTQyYmEtYjBjZS1kZTY4ZGQwNGJlNmE6ODUyOTYzNjYzMTg6NjM4OTU4NTM5Mzk3NjE4Nzgz

# 響應
{"error":"令牌與表單不匹配"}

# 調試日誌
[DEBUG] Token 中的 InstanceId: 0ecc59e9-f7a5-42ba-b0ce-de68dd04be6a
[DEBUG] URL 中的 InstanceId: 53153057-912d-4915-a530-f691444d1698
[DEBUG] Hash 驗證失敗
```

### 測試後（Bug 修復）
修復後，需要重新運行工作流程生成新的表單實例和 Token，然後：

```bash
# 請求
GET http://localhost:64213/api/eforminstances/{NEW_INSTANCE_ID}/public?token={NEW_TOKEN}

# 預期響應
{
  "id": "...",
  "instanceName": "...",
  "formName": "...",
  "status": "Pending",
  "htmlCode": "...",
  "isManualFill": true,
  ...
}
```

## 相關文件

- `Services/WorkflowEngine.cs` - 主要修復文件
- `Services/EFormTokenService.cs` - Token 生成和驗證服務
- `Controllers/EFormInstancesController.cs` - 表單實例 API 控制器
- `check_workflow_2484.sql` - 數據庫診斷查詢

## 後續步驟

1. ✅ 重新編譯後端 C# 代碼
2. ✅ 重新運行工作流程（例如流程 2484）生成新的表單實例
3. ✅ 使用新生成的 URL 和 Token 進行測試
4. ✅ 驗證 Token 驗證邏輯正常工作
5. ✅ 驗證前端表單頁面能夠正常顯示

## 經驗教訓

1. **變量作用域**：當同一個值需要在多個地方使用時，應該先定義變量，而不是多次調用生成函數
2. **Token 安全性**：Token 必須包含正確的實體 ID，這是驗證的基礎
3. **調試日誌**：詳細的調試日誌對於定位這類問題至關重要
4. **數據庫驗證**：當遇到 ID 不匹配問題時，查詢數據庫是快速定位問題的有效方法

## 修復日期

2025-10-13

## 修復人員

AI Assistant (Claude Sonnet 4.5)

## 用戶報告

流程 2484 的表單 URL 無法訪問，經過詳細調試和數據庫查詢後發現此 Bug。

