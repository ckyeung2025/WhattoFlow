# QR Code 菜單設置清理總結

## 📋 背景

根據用戶需求，QR Code 相關的訊息應該在 WorkflowDesigner XML 中設置，而不是放在數據庫的公司設置中。本次更改移除了數據庫中的 QR Code 相關字段，並使用硬編碼默認值作為回退。

## 🔄 主要更改

### 1. ✅ 數據庫結構清理

**文件**: `Database/add_whatsapp_menu_settings_to_companies.sql`

**移除的字段**:
- `WA_QRCodeSuccessMessage` - QR Code 掃描成功訊息
- `WA_QRCodeErrorMessage` - QR Code 掃描失敗訊息  
- `WA_QRCodeUploadErrorMessage` - QR Code 上傳失敗訊息
- `WA_QRCodeProcessErrorMessage` - QR Code 處理錯誤訊息

**保留的字段**: 僅保留通用的菜單設置字段，如歡迎訊息、菜單標題等。

### 2. ✅ 模型類清理

**文件**: `Models/Company.cs`

移除了所有 QR Code 相關的屬性：
- `WA_QRCodeSuccessMessage`
- `WA_QRCodeErrorMessage` 
- `WA_QRCodeUploadErrorMessage`
- `WA_QRCodeProcessErrorMessage`

### 3. ✅ 服務邏輯優化

**文件**: `Services/WebhookServices/WebhookMessageProcessingService.cs`

#### 更改內容:

1. **WhatsAppMenuSettings 類清理**
   - 移除 QR Code 相關屬性
   - 簡化 `GetDefaults()` 方法
   - 更新 `FromCompany()` 方法

2. **QR Code 訊息處理邏輯**
   - 優先使用 WorkflowDesigner XML 中的節點設置
   - 沒有節點設置時使用硬編碼默認值
   - 移除對 `menuSettings` 中 QR Code 訊息的依賴

#### 硬編碼默認值:
```csharp
// 上傳失敗
"無法獲取圖片信息，請重新上傳。"
"無法處理您上傳的圖片，請重新上傳。"

// 掃描失敗  
"無法識別圖片中的 QR Code，請確保圖片清晰且包含有效的 QR Code。"

// 處理成功
"QR Code 掃描成功！流程將繼續執行。"

// 處理失敗
"QR Code 處理失敗，請重新上傳。"

// 系統錯誤
"處理您的 QR Code 時發生錯誤，請稍後再試。"
```

## 🎯 設計邏輯

### QR Code 訊息優先級

1. **第一優先**: WorkflowDesigner XML 中的節點自定義設置
   - `nodeInfo.QrCodeSuccessMessage`
   - `nodeInfo.QrCodeErrorMessage`

2. **第二優先**: 硬編碼的合理默認值
   - 不再從數據庫公司設置讀取
   - 確保功能完整性

### 程式碼邏輯示例

```csharp
// 優先使用節點設置，沒有設置時使用硬編碼默認值
var errorMessage = !string.IsNullOrEmpty(nodeInfo.QrCodeErrorMessage) 
    ? nodeInfo.QrCodeErrorMessage 
    : "無法獲取圖片信息，請重新上傳。";
```

## 🔍 WorkflowDesigner 中的 QR Code 設置

根據檢查 `src/components/WorkflowDesigner/components/NodePropertyDrawer.js`，確認：

### ✅ 節點類型存在
- `waitForQRCode` 節點類型已實現
- 在 `constants.js` 中有完整配置

### ✅ 可設置的屬性
```javascript
// 在 NodePropertyDrawer.js 中可設置
qrCodeSuccessMessage: // QR Code 掃描成功訊息
qrCodeErrorMessage:   // QR Code 掃描失敗訊息
qrCodeVariable:       // 保存 QR Code 值的變量
```

### ✅ 多語言支持
```javascript
t('workflowDesigner.qrCodeSuccessMessage')
t('workflowDesigner.qrCodeErrorMessage')
t('workflowDesigner.qrCodeDescription1')
t('workflowDesigner.qrCodeDescription2')
t('workflowDesigner.qrCodeDescription3')
```

## 📊 測試建議

### 1. 基本功能測試
- [ ] QR Code 節點在 WorkflowDesigner 中正常顯示
- [ ] 可以設置自定義的成功/失敗訊息
- [ ] 流程執行時正確使用節點設置

### 2. 回退邏輯測試  
- [ ] 節點沒有設置訊息時使用默認值
- [ ] 默認值文字合理且用戶友好

### 3. 邊界情況測試
- [ ] 圖片上傳失敗場景
- [ ] QR Code 掃描失敗場景
- [ ] 系統處理錯誤場景

## 🎉 優勢

### 1. **架構清晰**
- QR Code 訊息屬於流程級設置，在 Designer 中管理
- 公司級設置專注於通用菜單文字
- 職責分離更清晰

### 2. **維護簡化**
- 減少數據庫字段和模型複雜度
- QR Code 功能的配置集中在一處
- 避免設置分散在多個地方

### 3. **向後兼容**
- 現有的 QR Code 功能完全不受影響
- 節點自定義設置繼續有效
- 沒有節點設置時有合理默認值

## 🚀 部署步驟

1. **執行數據庫更新**
   ```sql
   -- 執行修改後的 add_whatsapp_menu_settings_to_companies.sql
   ```

2. **重新編譯項目**
   ```bash
   dotnet build
   ```

3. **重啟服務**
   - 重啟 WhatsApp Webhook 處理服務
   - 確保新的邏輯生效

## 📝 注意事項

- ✅ 不影響現有 QR Code 流程的運行
- ✅ WorkflowDesigner 中的 QR Code 設置功能保持不變  
- ✅ 減少了數據庫結構的複雜性
- ✅ 提供了合理的默認值回退機制

---

**更新日期**: 2025-10-25  
**影響範圍**: 數據庫結構、Company 模型、WebhookMessageProcessingService  
**向後兼容**: ✅ 完全兼容
