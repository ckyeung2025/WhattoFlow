# WhatsApp 菜單自定義設置指南

## 📋 概述

本功能允許每個公司自定義其 WhatsApp 聊天機器人的菜單文字和提示訊息，實現個性化的用戶體驗。

## 🗄️ 數據庫結構

### 新增字段 (companies 表)

| 字段名 | 類型 | 長度 | 說明 |
|--------|------|------|------|
| `WA_WelcomeMessage` | NVARCHAR | 1000 | 主要歡迎訊息 |
| `WA_NoFunctionMessage` | NVARCHAR | 1000 | 無功能時顯示的訊息 |
| `WA_MenuTitle` | NVARCHAR | 100 | WhatsApp 列表菜單標題 |
| `WA_MenuFooter` | NVARCHAR | 200 | WhatsApp 列表菜單底部文字 |
| `WA_MenuButton` | NVARCHAR | 50 | 查看選項按鈕文字 |
| `WA_SectionTitle` | NVARCHAR | 100 | 服務選項區段標題 |
| `WA_DefaultOptionDescription` | NVARCHAR | 200 | 預設選項描述 |
| `WA_InputErrorMessage` | NVARCHAR | 500 | 輸入錯誤提示訊息 |
| `WA_FallbackMessage` | NVARCHAR | 500 | 回退到純文字時的提示 |
| `WA_SystemErrorMessage` | NVARCHAR | 500 | 系統錯誤訊息 |

## 🚀 部署步驟

### 1. 執行數據庫腳本

```sql
-- 執行主要的結構變更腳本
exec sp_executesql @sql = N'...' -- 執行 add_whatsapp_menu_settings_to_companies.sql
```

### 2. 重新編譯應用程序

由於修改了 `Company` 模型類，需要重新編譯項目：

```bash
dotnet build
```

### 3. 重啟服務

重啟 WhatsApp Webhook 處理服務，使新設置生效。

## 📝 使用方法

### 默認行為

如果公司沒有設置自定義文字（字段為 NULL），系統將使用內建的默認值：

| 項目 | 默認文字 |
|------|----------|
| 歡迎訊息 | "歡迎使用我們的服務！\n\n請選擇您需要的功能：" |
| 無功能訊息 | "歡迎使用我們的服務！\n\n目前沒有可用的功能，請聯繫管理員。" |
| 菜單標題 | "服務選單" |
| 菜單底部 | "請選擇您需要的服務" |
| 查看按鈕 | "查看選項" |

### 自定義設置

通過更新 `companies` 表的相應字段來自定義文字：

```sql
UPDATE companies 
SET 
    WA_WelcomeMessage = N'您的自定義歡迎訊息',
    WA_MenuTitle = N'您的菜單標題',
    WA_MenuFooter = N'您的底部提示'
WHERE Id = 'your-company-id';
```

## 🎨 實際效果

### WhatsApp 菜單顯示

```
🏢 企業服務中心              ← WA_MenuTitle
                         
🎉 歡迎來到我們的智能服務平台！  ← WA_WelcomeMessage

✨ 請從以下選項中選擇您需要的服務：

💡 點擊下方按鈕查看所有可用服務    ← WA_MenuFooter

[📋 瀏覽服務]                ← WA_MenuButton
```

## 🔧 代碼結構

### WhatsAppMenuSettings 類

新增的輔助類負責管理菜單設置和默認值：

```csharp
public class WhatsAppMenuSettings
{
    // 獲取默認設置
    public static WhatsAppMenuSettings GetDefaults()
    
    // 從公司設置創建（自動回退到默認值）
    public static WhatsAppMenuSettings FromCompany(Company company)
}
```

### 主要修改的方法

- `SendWhatsAppMenu()` - 發送主菜單
- `SendWhatsAppListMessage()` - 發送列表消息
- `HandleWaitingWorkflowReply()` - 處理用戶輸入驗證
- `HandleQRCodeWorkflowReply()` - 處理 QR Code 相關流程

## 📊 測試建議

### 1. 測試默認值

創建一個新公司（不設置自定義文字），驗證默認值是否正確顯示。

### 2. 測試自定義設置

為現有公司設置自定義文字，驗證 WhatsApp 菜單是否顯示自定義內容。

### 3. 測試回退機制

設置部分字段為 NULL，驗證系統是否正確回退到默認值。

### 4. 測試各種場景

- 正常菜單顯示
- 無工作流程時的提示
- 輸入驗證失敗
- QR Code 掃描各種狀態
- 系統錯誤處理

## 🚨 注意事項

### WhatsApp 限制

- 菜單標題最多 60 個字符
- 選項標題最多 24 個字符  
- 選項描述最多 72 個字符
- 底部文字最多 60 個字符

### 安全考慮

- 所有用戶輸入都會被自動轉義
- 不要在自定義文字中包含敏感信息
- 建議定期審查自定義設置

### 性能優化

- 菜單設置在每次消息處理時載入
- 考慮在高並發場景下增加缓存機制

## 🔮 未來擴展

### 可能的改進

1. **多語言支持** - 根據用戶語言顯示不同文字
2. **模板系統** - 支持變量替換（如公司名、用戶名等）
3. **A/B 測試** - 支持多版本文字測試
4. **富媒體支持** - 支持 Emoji、圖片等
5. **管理界面** - 提供 Web 界面進行設置管理

### 代碼改進

1. **缓存機制** - 避免每次都查詢數據庫
2. **驗證機制** - 增加字符長度和格式驗證
3. **日誌改進** - 記錄自定義設置的使用情況

---

📞 **技術支持**：如有問題，請聯繫開發團隊
📅 **更新日期**：2025-10-25
