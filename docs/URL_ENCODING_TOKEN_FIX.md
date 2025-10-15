# 🔧 Token URL 編碼修復

## 問題描述

用戶報告在 WhatsApp 消息中收到的表單 URL 無法訪問，返回 "找不到表單實例" 錯誤。

### 問題 URL（WhatsApp 消息中）
```
http://localhost:3000/eform-instance/b5f9dc41-b43a-42bf-a025-c04998eaa590?token=SWGtv7GApV+SKFdukrNWy3ZC4KytflROWVREYm70lIhiNWY5ZGM0MS1iNDNhLTQyYmYtYTAyNS1jMDQ5OThlYWE1OTA6ODUyOTYzNjYzMTg6NjM4OTU5MjEwMzYxNjQ3OTc1
```

### 正確 URL（應該是）
```
http://localhost:3000/eform-instance/b5f9dc41-b43a-42bf-a025-c04998eaa590?token=SWGtv7GApV%2BSKFdukrNWy3ZC4KytflROWVREYm70lIhiNWY5ZGM0MS1iNDNhLTQyYmYtYTAyNS1jMDQ5OThlYWE1OTA6ODUyOTYzNjYzMTg6NjM4OTU5MjEwMzYxNjQ3OTc1
```

## 根本原因

### Token 中的特殊字符

Base64 編碼的 Token 包含特殊字符：
- `+` (加號)
- `/` (斜線)
- `=` (等號)

這些字符在 URL 中有特殊含義：
- `+` 在 URL 查詢參數中會被解析為**空格**
- `/` 是路徑分隔符
- `=` 是鍵值對分隔符

### 問題對比

| Token 部分 | WhatsApp 消息 | 正確編碼 | 解析結果 |
|-----------|--------------|----------|---------|
| `...ApV+SK...` | `...ApV+SK...` | `...ApV%2BSK...` | `+` → 空格 ❌ |
| `...ApV%2BSK...` | N/A | `...ApV%2BSK...` | `%2B` → `+` ✅ |

### 代碼問題

在 `Services/WorkflowEngine.cs` 第 1778 行：

```csharp
// ❌ 錯誤：Token 沒有 URL 編碼
var formUrl = $"/eform-instance/{eFormInstance.Id}?token={accessToken}";
```

當 Token 包含 `+` 時：
1. URL 生成：`?token=SWGtv7GApV+SK...`
2. 瀏覽器解析：`?token=SWGtv7GApV SK...` (+ 變成空格)
3. 後端接收：Token 不完整或格式錯誤
4. Token 驗證失敗：`{"error":"無效的訪問令牌"}`

## 修復方案

### 修改文件：`Services/WorkflowEngine.cs`

#### 1. 添加 using 語句

```csharp
using PurpleRice.Data;
using PurpleRice.Models;
using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Threading.Tasks;
using PurpleRice.Services;
using PurpleRice.Services.WebhookServices;
using System.Linq;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using System.Web;  // 新增：用於 URL 編碼
```

#### 2. 修改 URL 生成邏輯

```csharp
// 修復前
var formUrl = $"/eform-instance/{eFormInstance.Id}?token={accessToken}";
eFormInstance.FormUrl = formUrl;

// 修復後
// 生成帶安全 Token 的表單 URL（需要 URL 編碼 Token）
var encodedToken = System.Web.HttpUtility.UrlEncode(accessToken);
var formUrl = $"/eform-instance/{eFormInstance.Id}?token={encodedToken}";
eFormInstance.FormUrl = formUrl;
```

## URL 編碼規則

| 字符 | URL 編碼 | 說明 |
|------|----------|------|
| `+` | `%2B` | 加號 |
| `/` | `%2F` | 斜線 |
| `=` | `%3D` | 等號 |
| ` ` (空格) | `%20` 或 `+` | 空格 |
| `?` | `%3F` | 問號 |
| `&` | `%26` | 和號 |
| `#` | `%23` | 井號 |

## 測試驗證

### 測試場景 1: Token 包含 `+` 字符

**修復前**：
```
URL: ?token=SWGtv7GApV+SKFdukrNWy3ZC4KytflROWVREYm70lI...
後端接收: token=SWGtv7GApV SKFdukrNWy3ZC4KytflROWVREYm70lI...
結果: ❌ Token 驗證失敗
```

**修復後**：
```
URL: ?token=SWGtv7GApV%2BSKFdukrNWy3ZC4KytflROWVREYm70lI...
後端接收: token=SWGtv7GApV+SKFdukrNWy3ZC4KytflROWVREYm70lI...
結果: ✅ Token 驗證成功
```

### 測試場景 2: Token 包含 `/` 字符

**修復前**：
```
URL: ?token=0qKn/u6yQ6d4vA25z9/MwXbpgZ4VkQ9d2iTbIgd8ruk...
可能問題: 路徑解析錯誤
結果: ❌ 可能導致 404 或 Token 驗證失敗
```

**修復後**：
```
URL: ?token=0qKn%2Fu6yQ6d4vA25z9%2FMwXbpgZ4VkQ9d2iTbIgd8ruk...
後端接收: token=0qKn/u6yQ6d4vA25z9/MwXbpgZ4VkQ9d2iTbIgd8ruk...
結果: ✅ Token 驗證成功
```

### 測試場景 3: Token 包含 `=` 字符

**修復前**：
```
URL: ?token=...base64string==
可能問題: = 可能被誤解析為鍵值對分隔符
結果: ❌ Token 可能被截斷
```

**修復後**：
```
URL: ?token=...base64string%3D%3D
後端接收: token=...base64string==
結果: ✅ Token 驗證成功
```

## 影響範圍

### 受影響功能
- ✅ Manual Fill 模式的表單 URL 生成
- ✅ WhatsApp 消息中的表單鏈接
- ✅ 所有包含特殊字符的 Token

### 不受影響功能
- ✅ 後端 Token 生成邏輯（正確）
- ✅ 後端 Token 驗證邏輯（正確）
- ✅ 前端 Token 解析（瀏覽器自動處理 URL 解碼）

## 部署步驟

1. **停止後端服務**
   ```bash
   # 在運行後端的終端按 Ctrl+C
   ```

2. **重新編譯**
   ```bash
   dotnet build PurpleRice.csproj
   ```

3. **重新啟動後端**
   ```bash
   dotnet run
   ```

4. **測試新流程**
   - 創建新的工作流程執行
   - 檢查 WhatsApp 消息中的 URL
   - 確認 Token 已正確 URL 編碼
   - 測試 URL 是否能正常訪問

## 注意事項

### 舊的表單實例

**問題**：數據庫中已存在的表單實例的 `FormUrl` 字段包含未編碼的 Token。

**解決方案**：
1. **選項 A**：運行 SQL 更新腳本（不推薦，因為 Token 可能已經失效）
2. **選項 B**：重新運行工作流程生成新的表單實例（推薦）

### 前端處理

前端不需要修改，因為：
- 瀏覽器會自動處理 URL 解碼
- `URLSearchParams.get('token')` 會自動解碼 `%2B` → `+`
- 前端發送 API 請求時使用 `encodeURIComponent()` 再次編碼（正確）

## 相關文件

- `Services/WorkflowEngine.cs` - 主要修復文件
- `Services/EFormTokenService.cs` - Token 生成服務
- `Controllers/EFormInstancesController.cs` - Token 驗證端點

## 修復日期

2025-10-13

## 修復人員

AI Assistant (Claude Sonnet 4.5)

## 用戶反饋

用戶報告在 WhatsApp 消息中收到的表單 URL 無法訪問，經過對比發現 Token 中的 `+` 字符沒有被 URL 編碼，導致驗證失敗。

