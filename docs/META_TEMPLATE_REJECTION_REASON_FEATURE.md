# Meta Template 拒絕原因顯示功能

## 📋 功能概述

為 Meta WhatsApp Template 預覽界面添加了**拒絕原因顯示功能**，讓用戶能夠清楚了解模板被拒絕的具體原因，便於修改和重新提交。

## ✨ 新增功能

### 1. 後端 API 增強

#### 📝 修改的文件：`Services/WhatsAppMetaTemplateService.cs`

**新增字段到 `MetaTemplateData` 類：**

```csharp
public class MetaTemplateData
{
    // ... 現有字段 ...
    
    // 新增：拒絕原因相關字段
    [System.Text.Json.Serialization.JsonPropertyName("rejected_reason")]
    public string? RejectedReason { get; set; }
    
    [System.Text.Json.Serialization.JsonPropertyName("quality_rating")]
    public string? QualityRating { get; set; }
    
    [System.Text.Json.Serialization.JsonPropertyName("created_time")]
    public DateTime? CreatedTime { get; set; }
    
    [System.Text.Json.Serialization.JsonPropertyName("updated_time")]
    public DateTime? UpdatedTime { get; set; }
}
```

### 2. 前端界面增強

#### 📝 修改的文件：`src/pages/MetaTemplatePanel.js`

### 🎨 預覽 Modal 增強

**新增顯示內容：**

1. **拒絕原因區塊**（僅當 `status === 'REJECTED'` 時顯示）
   - 紅色背景的提示框
   - 顯示具體的拒絕原因
   - 提供修改建議

2. **質量評級**（如果 Meta 提供）
   - HIGH（綠色）
   - MEDIUM（橙色）  
   - LOW（紅色）

3. **時間信息**
   - 創建時間
   - 更新時間

### 🎯 表格狀態優化

**狀態顏色優化：**
   - APPROVED：綠色
   - REJECTED：紅色
   - PENDING：橙色

## 🖼️ 界面效果

### 預覽 Modal 中的拒絕原因顯示

```
基本信息
├── 名稱：promotion_broadcast_009
├── 類別：MARKETING
├── 語言：zh_TW
├── 狀態：REJECTED [紅色標籤]
│
❌ 拒絕原因：
┌─────────────────────────────────────────┐
│ 此範本已被拒絕 因為顧客舉報範本內容違反   │
│ WhatsApp 政策中有關浮動參數 - 懸垂參數的  │
│ 規則，因此範本已被拒絕。                │
└─────────────────────────────────────────┘

💡 建議：請根據拒絕原因修改模板內容後重新提交。
   您可以刪除此模板並創建新版本。

質量評級：MEDIUM [橙色標籤]
創建時間：2024-01-15 14:30:25
更新時間：2024-01-15 16:45:12
```

### 表格操作

```
操作列：
├── 👁️ 預覽（所有模板）- 點擊可查看拒絕原因
└── 🗑️ 刪除（所有模板）
```

## 🔧 技術實現

### Meta API 響應結構

Meta WhatsApp Business API 返回的模板數據包含以下字段：

```json
{
  "data": [
    {
      "name": "template_name",
      "status": "REJECTED",
      "rejected_reason": "具體拒絕原因...",
      "quality_rating": "MEDIUM",
      "created_time": "2024-01-15T14:30:25Z",
      "updated_time": "2024-01-15T16:45:12Z",
      "components": [...]
    }
  ]
}
```

### 前端處理邏輯

```javascript
// 條件顯示拒絕原因
{previewTemplate.status === 'REJECTED' && previewTemplate.rejected_reason && (
  <div style={{ marginTop: 12 }}>
    <p><strong style={{ color: '#ff4d4f' }}>❌ 拒絕原因：</strong></p>
    <div style={{ 
      padding: 12, 
      background: '#fff2f0', 
      border: '1px solid #ffccc7',
      borderRadius: 6,
      color: '#ff4d4f'
    }}>
      {previewTemplate.rejected_reason}
    </div>
    <div style={{ marginTop: 8, fontSize: '12px', color: '#999' }}>
      💡 <strong>建議：</strong>請根據拒絕原因修改模板內容後重新提交。
    </div>
  </div>
)}
```

## 📚 常見拒絕原因及解決方案

### 1. 浮動參數（懸垂參數）

**問題：** 參數沒有足夠的上下文描述

**錯誤示例：**
```
您好 {{1}}，您的 {{2}} 已準備就緒，請點擊：{{3}}
```

**正確示例：**
```
您好 {{1}}，

您的 {{2}} 已準備完成，請您查看並填寫。

請點擊以下鏈接訪問表單：
{{3}}

⚠️ 此鏈接為您專屬，請勿分享給他人。
```

### 2. 營銷內容過於明顯

**解決方案：**
- 使用 UTILITY 類別而非 MARKETING
- 減少促銷語言
- 增加實用性描述

### 3. 內容違反政策

**解決方案：**
- 移除誇大宣傳用詞
- 避免使用過多表情符號
- 確保內容真實可信

## 🚀 使用建議

### 1. 快速處理被拒絕的模板

1. 點擊表格中的 👁️ 預覽按鈕查看拒絕原因
2. 根據原因修改模板內容
3. 刪除舊模板
4. 創建新版本（建議使用版本號：`template_name_v2`）

### 2. 預防被拒絕的最佳實踐

1. **參數使用：** 為每個參數提供清晰的上下文
2. **類別選擇：** 根據實際用途選擇正確的類別
3. **內容質量：** 確保內容真實、有用、符合政策
4. **測試提交：** 先用簡單內容測試，再添加複雜功能

## 🔄 版本歷史

- **v1.1** (2024-01-15)
  - 簡化表格操作，移除額外的拒絕原因按鈕
  - 拒絕原因僅在預覽 Modal 中顯示

- **v1.0** (2024-01-15)
  - 新增拒絕原因顯示功能
  - 新增質量評級顯示
  - 新增時間信息顯示
  - 優化表格狀態顏色

## 📞 技術支持

如果在使用過程中遇到問題，請檢查：

1. Meta API 是否返回 `rejected_reason` 字段
2. 前端是否能正確解析 JSON 響應
3. 樣式是否正確顯示

---

*此功能已完全實現並可立即使用！* 🎉
