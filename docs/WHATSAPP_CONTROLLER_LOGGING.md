# WhatsAppController 調試日誌配置

## 日誌配置概述

`WhatsAppController` 現在包含詳細的調試日誌，可以幫助您追蹤和調試 WhatsApp 相關的 API 調用。

## 日誌文件位置

```
logs/whatsapp_controller_YYYYMMDD.log
```

例如：`logs/whatsapp_controller_20241201.log`

## 日誌級別配置

```json
"WhatsAppController": {
  "LogLevel": "Debug",
  "EnableFileLogging": true,
  "LogFilePath": "logs/whatsapp_controller_{0:yyyyMMdd}.log"
}
```

## 詳細日誌記錄

### 1. 聊天歷史獲取 (`GET /api/whatsapp/chat-history/{waId}`)

**開始日誌：**
```
[INFO] === 開始獲取聊天歷史 ===
[INFO] WaId: 85212345678, Page: 1, PageSize: 50
```

**查詢結果：**
```
[INFO] 找到總消息數: 25
[INFO] 返回消息數: 25
[INFO] === 聊天歷史獲取完成 ===
```

### 2. 發送消息 (`POST /api/whatsapp/send-message`)

**請求處理：**
```
[INFO] === 開始處理發送消息請求 ===
[INFO] WaId: 85212345678, Message: 您好！我是客服人員，有什麼可以幫助您的嗎？..., WorkflowInstanceId: 123
[INFO] 生成消息ID: 550e8400-e29b-41d4-a716-446655440000, 時間戳: 2024-12-01 10:30:00
```

**數據庫操作：**
```
[INFO] 消息已保存到數據庫，ID: 456
```

**發送邏輯：**
```
[INFO] 使用工作流程實例發送消息，WorkflowInstanceId: 123
[INFO] 找到工作流程實例: 123, 定義ID: 789
[INFO] 使用 WhatsAppWorkflowService 發送消息成功
```

**狀態更新：**
```
[INFO] 消息狀態已更新: sent
[INFO] === 發送消息處理完成，結果: 成功 ===
```

### 3. 配置測試 (`GET /api/whatsapp/test-config`)

**配置檢查：**
```
[INFO] === 開始測試 WhatsApp 配置 ===
[INFO] 找到公司: 測試公司, ID: 1
[INFO] API Key 長度: 200
[INFO] Phone Number ID: 690383010830837
[INFO] API 版本: v19.0
[INFO] === WhatsApp 配置測試完成 ===
```

### 4. 測試發送 (`POST /api/whatsapp/test-send`)

**測試過程：**
```
[INFO] 測試發送 WhatsApp 消息到: 85212345678
[INFO] 使用工作流程實例 ID: 123
[INFO] 使用簡化方法發送消息（無工作流程實例）
```

### 5. 工作流程實例消息 (`GET /api/whatsapp/messages/{workflowInstanceId}`)

**消息查詢：**
```
[INFO] === 開始獲取工作流程實例消息 ===
[INFO] WorkflowInstanceId: 123
[INFO] 找到消息數: 5
[INFO] === 工作流程實例消息獲取完成 ===
```

### 6. 簡化發送方法 (`SendSimpleWhatsAppMessage`)

**發送過程：**
```
[INFO] === 開始簡化發送 WhatsApp 消息 ===
[INFO] WaId: 85212345678, Message: 這是一條測試消息...
[INFO] 使用公司: 測試公司, ID: 1
[INFO] API URL: https://graph.facebook.com/v19.0/690383010830837/messages
[INFO] 簡化發送 WhatsApp 消息: https://graph.facebook.com/v19.0/690383010830837/messages
[INFO] 請求內容: {"messaging_product":"whatsapp","to":"85212345678","type":"text","text":{"body":"這是一條測試消息"}}
[INFO] HTTP 響應狀態碼: 200
[INFO] HTTP 響應內容: {"messaging_product":"whatsapp","messages":[{"id":"wamid.HBgM..."]}
[INFO] WhatsApp 消息發送成功: {"messaging_product":"whatsapp","messages":[{"id":"wamid.HBgM..."]}
[INFO] === 簡化發送 WhatsApp 消息完成 ===
```

## 錯誤日誌記錄

### 1. 參數驗證錯誤
```
[WARN] 請求參數驗證失敗: WaId=, Message=測試消息
```

### 2. 工作流程實例錯誤
```
[WARN] 找不到工作流程實例: 999
```

### 3. 公司配置錯誤
```
[ERROR] 找不到有效的公司配置
[ERROR] 公司 WhatsApp API 配置缺失
[ERROR] API Key 是否為空: True
[ERROR] Phone Number ID 是否為空: False
```

### 4. API 調用錯誤
```
[ERROR] WhatsApp 消息發送失敗: 400 - {"error":{"message":"Invalid phone number","code":100,"error_subcode":33}}
[ERROR] 簡化發送 WhatsApp 消息時發生錯誤: System.Net.Http.HttpRequestException: 連接超時
```

### 5. 數據庫錯誤
```
[ERROR] 獲取聊天歷史失敗: System.Data.SqlClient.SqlException: 無法連接到數據庫
[ERROR] 處理發送消息請求失敗: System.InvalidOperationException: 實體已被跟蹤
```

## 調試建議

### 1. 檢查日誌文件
```bash
# 查看今天的日誌
tail -f logs/whatsapp_controller_$(date +%Y%m%d).log

# 搜索錯誤
grep "ERROR" logs/whatsapp_controller_*.log

# 搜索特定 WaId
grep "85212345678" logs/whatsapp_controller_*.log
```

### 2. 常見問題排查

**消息發送失敗：**
1. 檢查 API Key 和 Phone Number ID 配置
2. 驗證 WaId 格式是否正確
3. 查看 HTTP 響應狀態碼和內容

**工作流程實例問題：**
1. 確認工作流程實例 ID 是否存在
2. 檢查工作流程定義是否有效
3. 驗證公司配置是否正確

**數據庫問題：**
1. 檢查數據庫連接
2. 驗證表結構是否正確
3. 確認權限設置

### 3. 性能監控

**日誌分析：**
- 統計 API 調用次數
- 監控響應時間
- 追蹤錯誤率

**關鍵指標：**
- 消息發送成功率
- 平均響應時間
- 錯誤類型分布

## 日誌格式

```
[時間戳] [日誌級別] [服務名稱] 消息內容
```

例如：
```
[2024-12-01 10:30:15.123] [INFO] [WhatsAppController] === 開始處理發送消息請求 ===
[2024-12-01 10:30:15.456] [ERROR] [WhatsAppController] WhatsApp 消息發送失敗: 400 - Invalid phone number
```

## 注意事項

1. **敏感信息保護**：日誌中會截斷長消息（最多顯示前50個字符）
2. **日誌輪轉**：每天創建新的日誌文件
3. **磁盤空間**：定期清理舊的日誌文件
4. **性能影響**：Debug 級別日誌會影響性能，生產環境可考慮調整為 Info 級別
