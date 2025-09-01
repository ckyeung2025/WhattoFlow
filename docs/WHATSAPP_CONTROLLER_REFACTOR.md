# WhatsAppController 重構說明

## 重構目標
- ❌ 移除重複的 `SendWhatsAppMessage` 方法實現
- ❌ 消除與 `WhatsAppWorkflowService` 的功能重複
- ✅ 使用現有的服務而不是重新實現
- ✅ 保持 `WhatsAppController` 處理前端請求的功能

## 重構內容

### 1. 依賴注入更新
**之前：**
```csharp
private readonly HttpClient _httpClient;

public WhatsAppController(PurpleRiceDbContext db, IConfiguration configuration, HttpClient httpClient)
```

**之後：**
```csharp
private readonly WhatsAppWorkflowService _whatsAppService;
private readonly LoggingService _loggingService;

public WhatsAppController(
    PurpleRiceDbContext db, 
    IConfiguration configuration, 
    WhatsAppWorkflowService whatsAppService,
    LoggingService loggingService)
```

### 2. 移除重複的 API 調用實現
**移除的方法：**
- `SendWhatsAppMessage()` - 完整的 150+ 行重複實現
- 包含公司配置查詢、HTTP 請求、錯誤處理等

**替換為：**
- 使用現有的 `WhatsAppWorkflowService.SendWhatsAppMessageAsync()`
- 保留簡化的 `SendSimpleWhatsAppMessage()` 用於無工作流程實例的情況

### 3. 服務註冊更新 (Program.cs)
```csharp
// 註冊 WhatsAppWorkflowService
builder.Services.AddScoped<WhatsAppWorkflowService>();

// 註冊 LoggingService 實例（用於控制器）
builder.Services.AddScoped<LoggingService>(provider =>
{
    var configuration = provider.GetRequiredService<IConfiguration>();
    var logger = provider.GetRequiredService<ILogger<LoggingService>>();
    return new LoggingService(configuration, logger, "WhatsAppController");
});
```

### 4. 發送消息邏輯優化
**新的發送邏輯：**
```csharp
if (request.WorkflowInstanceId.HasValue)
{
    // 使用完整的 WhatsAppWorkflowService
    var workflowExecution = await _db.WorkflowExecutions
        .FirstOrDefaultAsync(we => we.Id == request.WorkflowInstanceId.Value);
    
    if (workflowExecution != null)
    {
        await _whatsAppService.SendWhatsAppMessageAsync(
            request.WaId, 
            request.Message, 
            workflowExecution, 
            _db
        );
        whatsappSent = true;
    }
}
else
{
    // 使用簡化方法（無工作流程實例）
    whatsappSent = await SendSimpleWhatsAppMessage(request.WaId, request.Message);
}
```

### 5. 日誌記錄改進
- 使用統一的 `LoggingService` 替代 `Console.WriteLine`
- 添加詳細的錯誤日誌記錄
- 保持與現有服務一致的日誌格式

## 重構優勢

### ✅ 代碼重用
- 使用現有的 `WhatsAppWorkflowService` 而不是重複實現
- 減少代碼維護成本

### ✅ 一致性
- API 版本統一使用 `v19.0`
- 錯誤處理和日誌記錄格式一致
- 公司配置查詢邏輯統一

### ✅ 可維護性
- 單一職責原則：控制器只負責處理 HTTP 請求
- 業務邏輯集中在服務層
- 更容易測試和擴展

### ✅ 功能保持
- 保持所有現有的 API 端點
- 前端 `WhatsAppChat.js` 無需修改
- 向後兼容現有的請求格式

## API 端點保持不變

| 端點 | 方法 | 功能 |
|------|------|------|
| `/api/whatsapp/chat-history/{waId}` | GET | 獲取聊天歷史 |
| `/api/whatsapp/send-message` | POST | 發送消息 |
| `/api/whatsapp/test-config` | GET | 測試配置 |
| `/api/whatsapp/test-send` | POST | 測試發送 |
| `/api/whatsapp/messages/{workflowInstanceId}` | GET | 獲取工作流程實例消息 |

## 測試建議

1. **功能測試**
   - 測試所有 API 端點是否正常工作
   - 驗證消息發送功能
   - 檢查聊天歷史載入

2. **錯誤處理測試**
   - 測試無效的工作流程實例 ID
   - 測試缺失的公司配置
   - 測試網絡錯誤情況

3. **日誌驗證**
   - 檢查日誌文件是否正確記錄
   - 驗證錯誤日誌的詳細程度

## 注意事項

- 確保 `WhatsAppWorkflowService` 已正確註冊
- 檢查 `LoggingService` 配置是否正確
- 驗證公司 WhatsApp API 配置的完整性
