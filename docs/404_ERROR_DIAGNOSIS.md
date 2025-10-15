# 404 錯誤診斷報告

## ❌ 問題描述

用戶報告訪問以下 URL 時出現 404 錯誤：
```
https://dddd41661f3c.ngrok-free.app/eform-instance/34de77a4-e50a-4475-912a-f5fce747df43?token=OTFlMTkyYWItNDg5ZS00YmQyLWE3NmQtY2Y2NTQxNzMyNTc0Ojg1Mjk2MzY2MzE4OjYzODk1ODQ2NDIyNjkyMjcxMuZ+ZXaSxev7szvCIiAuJzZOV9pSRj76nczsgsldi39X
```

## 🔍 問題分析

### 1. 前端路由配置檢查 ✅

**文件**: `src/App.js`
```javascript
// 第 139 行和第 348 行
<Route path="/eform-instance/:id" element={<EFormInstancePage />} />
```

路由配置正確，應該能匹配 `/eform-instance/34de77a4-e50a-4475-912a-f5fce747df43` 路徑。

### 2. EFormInstancePage 組件檢查 ✅

**文件**: `src/pages/EFormInstancePage.js`

組件正確處理 URL 參數：
```javascript
const { id } = useParams(); // 獲取 :id 參數
const urlParams = new URLSearchParams(window.location.search);
const urlToken = urlParams.get('token'); // 獲取 token 參數
```

### 3. API 調用檢查 ✅

組件正確調用後端 API：
```javascript
const instanceResponse = await fetch(`/api/eforminstances/${id}/public?token=${encodeURIComponent(urlToken)}`);
```

### 4. 後端 API 端點檢查 ✅

**文件**: `Controllers/EFormInstancesController.cs`

已添加匿名訪問端點：
```csharp
[HttpGet("{id}/public")]
[AllowAnonymous]
public async Task<IActionResult> GetPublic(Guid id, [FromQuery] string token)
```

## 🚨 可能的原因

### 1. 後端服務器問題
- **C# 後端服務器未運行**
- **API 端點未正確註冊**
- **依賴注入配置問題**

### 2. ngrok 配置問題
- **ngrok 隧道未正確配置**
- **端口映射問題**
- **HTTPS 證書問題**

### 3. 前端路由問題
- **React Router 配置問題**
- **SPA 路由回退問題**

## 🔧 診斷步驟

### 步驟 1: 檢查後端服務器狀態

1. **確認 C# 服務器運行狀態**：
   ```bash
   # 檢查服務器是否在運行
   netstat -an | findstr :5000
   # 或
   netstat -an | findstr :5001
   ```

2. **測試基本 API 端點**：
   ```bash
   curl http://localhost:5000/api/eforminstances
   # 或
   curl http://localhost:5001/api/eforminstances
   ```

### 步驟 2: 檢查 ngrok 配置

1. **確認 ngrok 隧道狀態**：
   ```bash
   ngrok http 5000
   # 或
   ngrok http 5001
   ```

2. **測試 ngrok URL**：
   ```bash
   curl https://dddd41661f3c.ngrok-free.app/api/eforminstances
   ```

### 步驟 3: 檢查前端路由

1. **測試前端路由**：
   - 訪問 `https://dddd41661f3c.ngrok-free.app/`
   - 確認前端應用正常加載
   - 檢查瀏覽器開發者工具的 Network 標籤

2. **檢查 React Router 配置**：
   - 確認 `BrowserRouter` 正確配置
   - 檢查是否有路由衝突

## 🛠️ 解決方案

### 方案 1: 檢查後端服務器

1. **重啟 C# 服務器**：
   ```bash
   cd C:\GIT\WhattoFlow
   dotnet run
   ```

2. **檢查 Program.cs 中的服務註冊**：
   ```csharp
   builder.Services.AddScoped<IEFormTokenService, EFormTokenService>();
   ```

### 方案 2: 檢查 ngrok 配置

1. **重新配置 ngrok**：
   ```bash
   ngrok http 5000 --host-header=localhost:5000
   ```

2. **確認 ngrok 版本**：
   ```bash
   ngrok version
   ```

### 方案 3: 添加調試信息

在 `EFormInstancePage.js` 中添加更多調試信息：

```javascript
useEffect(() => {
  console.log('EFormInstancePage useEffect 被調用');
  console.log('當前 URL:', window.location.href);
  console.log('URL 路徑:', window.location.pathname);
  console.log('URL 參數:', window.location.search);
  console.log('ID 參數:', id);
  
  const urlParams = new URLSearchParams(window.location.search);
  const urlToken = urlParams.get('token');
  console.log('Token 參數:', urlToken);
  
  // ... 其餘代碼
}, [id, navigate, t]);
```

### 方案 4: 檢查 API 端點

1. **測試 API 端點**：
   ```bash
   # 測試基本端點
   curl -X GET "https://dddd41661f3c.ngrok-free.app/api/eforminstances" \
        -H "accept: application/json"
   
   # 測試公共端點
   curl -X GET "https://dddd41661f3c.ngrok-free.app/api/eforminstances/34de77a4-e50a-4475-912a-f5fce747df43/public?token=OTFlMTkyYWItNDg5ZS00YmQyLWE3NmQtY2Y2NTQxNzMyNTc0Ojg1Mjk2MzY2MzE4OjYzODk1ODQ2NDIyNjkyMjcxMuZ+ZXaSxev7szvCIiAuJzZOV9pSRj76nczsgsldi39X" \
        -H "accept: application/json"
   ```

## 📋 檢查清單

- [ ] 後端 C# 服務器正在運行
- [ ] ngrok 隧道正常工作
- [ ] API 端點 `/api/eforminstances/{id}/public` 可訪問
- [ ] 前端路由 `/eform-instance/:id` 正確配置
- [ ] Token 參數正確傳遞
- [ ] 數據庫連接正常
- [ ] 依賴注入配置正確

## 🎯 預期結果

修復後，用戶應該能夠：
1. 成功訪問帶 token 的表單實例 URL
2. 看到表單實例的詳細信息
3. 在 Manual Fill 模式下提交表單

## 📞 下一步行動

1. **立即檢查**：確認後端服務器運行狀態
2. **測試 API**：使用 curl 測試 API 端點
3. **檢查日誌**：查看後端和前端控制台日誌
4. **重新配置**：如有必要，重新配置 ngrok

---

**注意**: 這個問題很可能是後端服務器未運行或 ngrok 配置問題導致的，而不是代碼問題。
