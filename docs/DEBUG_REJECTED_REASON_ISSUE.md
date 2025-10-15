# 調試 Meta Template 拒絕原因顯示問題

## 🔍 問題描述

用戶報告在預覽 `promotion_broadcast_009` 被拒絕的模板時，沒有看到拒絕原因顯示。

## 🛠️ 已實施的調試措施

### 1. 後端調試增強

#### 📝 修改文件：`Services/WhatsAppMetaTemplateService.cs`

**新增功能：**

1. **添加 fields 參數**
   ```csharp
   // 添加 fields 參數以獲取完整信息（包括拒絕原因）
   queryParams.Add("fields=name,status,category,id,language,components,rejected_reason,quality_rating,created_time,updated_time");
   ```

2. **增強日誌記錄**
   ```csharp
   // 調試：檢查被拒絕的模板
   if (result?.Data != null)
   {
       var rejectedTemplates = result.Data.Where(t => t.Status == "REJECTED").ToList();
       if (rejectedTemplates.Any())
       {
           _loggingService.LogInformation($"🔍 發現 {rejectedTemplates.Count} 個被拒絕的模板:");
           foreach (var template in rejectedTemplates)
           {
               _loggingService.LogInformation($"  - 模板: {template.Name}, 拒絕原因: {template.RejectedReason ?? "未提供"}, 質量評級: {template.QualityRating ?? "未提供"}");
           }
       }
   }
   ```

### 2. 前端調試增強

#### 📝 修改文件：`src/pages/MetaTemplatePanel.js`

**新增調試日誌：**
```javascript
const handlePreviewTemplate = (template) => {
  console.log('🔍 [DEBUG] 預覽模板數據:', {
    name: template.name,
    status: template.status,
    rejected_reason: template.rejected_reason,
    quality_rating: template.quality_rating,
    created_time: template.created_time,
    updated_time: template.updated_time
  });
  setPreviewTemplate(template);
  setIsPreviewModalVisible(true);
};
```

## 🔍 調試步驟

### 步驟 1：檢查後端日誌

運行應用後，查看日誌中是否有以下信息：
```
🔍 發現 X 個被拒絕的模板:
  - 模板: promotion_broadcast_009, 拒絕原因: [具體原因或"未提供"], 質量評級: [評級或"未提供"]
```

### 步驟 2：檢查前端控制台

打開瀏覽器開發者工具，點擊預覽被拒絕的模板，查看控制台輸出：
```javascript
🔍 [DEBUG] 預覽模板數據: {
  name: "promotion_broadcast_009",
  status: "REJECTED",
  rejected_reason: "具體原因或 null/undefined",
  quality_rating: "評級或 null/undefined",
  created_time: "時間或 null/undefined",
  updated_time: "時間或 null/undefined"
}
```

## 🎯 可能的問題原因

### 1. Meta API 限制

**可能原因：** Meta API 可能不返回 `rejected_reason` 字段，或者需要特殊權限。

**解決方案：**
- 檢查 Meta API 文檔
- 確認 Business Account 權限
- 嘗試使用不同的 API 端點

### 2. 字段名稱不匹配

**可能原因：** Meta API 返回的字段名稱可能與我們定義的不同。

**常見的字段名稱：**
- `rejected_reason` vs `rejection_reason`
- `quality_rating` vs `quality_score`
- `created_time` vs `created_at`

### 3. API 版本問題

**可能原因：** 不同的 Meta API 版本可能有不同的字段。

**檢查：** 確認 `GetMetaApiVersion()` 返回的版本是否支持這些字段。

## 🚀 測試方案

### 方案 1：手動測試 API

使用 Postman 或 curl 直接調用 Meta API：

```bash
curl -X GET \
  "https://graph.facebook.com/v18.0/{business-account-id}/message_templates?fields=name,status,category,id,language,components,rejected_reason,quality_rating,created_time,updated_time" \
  -H "Authorization: Bearer {access-token}"
```

### 方案 2：添加臨時測試數據

在 `MetaTemplatePanel.js` 中添加測試數據：

```javascript
// 臨時測試：模擬被拒絕的模板數據
const testRejectedTemplate = {
  name: "test_rejected_template",
  status: "REJECTED",
  rejected_reason: "此範本已被拒絕 因為顧客舉報範本內容違反 WhatsApp 政策中有關浮動參數 - 懸垂參數的規則",
  quality_rating: "LOW",
  created_time: "2024-01-15T14:30:25Z",
  updated_time: "2024-01-15T16:45:12Z",
  category: "MARKETING",
  language: "zh_TW",
  components: [...]
};

// 在 handlePreviewTemplate 中使用測試數據
const handlePreviewTemplate = (template) => {
  const templateToShow = template.name === "promotion_broadcast_009" ? testRejectedTemplate : template;
  setPreviewTemplate(templateToShow);
  setIsPreviewModalVisible(true);
};
```

## 📋 下一步行動

1. **運行應用並檢查日誌**
2. **查看前端控制台輸出**
3. **根據日誌結果決定下一步**
4. **如果需要，實施臨時測試數據方案**

## 🔧 快速修復（如果需要）

如果 Meta API 確實不提供拒絕原因，我們可以：

1. **手動維護拒絕原因數據庫表**
2. **提供通用的拒絕原因說明**
3. **添加「查看 Meta 管理後台」的鏈接**

---

*請先運行應用並檢查日誌，然後告訴我結果！* 🔍
