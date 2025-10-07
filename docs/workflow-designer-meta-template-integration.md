# 流程設計器 - Meta 模板整合文檔

## 概述
在流程設計器的 "發送 WhatsApp 模板" 節點中添加了 Tab 功能，用於區分 "內部模板" 和 "Meta 官方模板"。

## 修改文件列表

### 1. 前端組件修改

#### 1.1 `src/components/WorkflowDesigner/modals/TemplateModal.js`
**功能**: 模板選擇 Modal 組件

**主要修改**:
- 添加了 `Tabs` 組件，用於區分內部模板和 Meta 模板
- 新增 `metaTemplates` prop 用於接收 Meta 模板列表
- 修改 `onSelectTemplate` 回調，添加 `isMetaTemplate` 參數標識模板類型
- 為 Meta 模板添加了狀態標記（已審核、審核中、已拒絕）
- 在每個 Tab 上顯示模板數量的 Badge

**新增參數**:
- `metaTemplates`: Meta 模板列表
- `onSelectTemplate(template, isMetaTemplate)`: 選擇模板的回調函數

#### 1.2 `src/components/WorkflowDesigner/services/apiService.js`
**功能**: API 服務層

**主要修改**:
- 添加了 `fetchMetaTemplates()` 方法，用於從後端獲取 Meta 模板
- 該方法會自動過濾，只返回狀態為 `APPROVED` 的 Meta 模板

**新增方法**:
```javascript
async fetchMetaTemplates() {
  // 從 /api/whatsappmetatemplates 獲取已審核通過的 Meta 模板
}
```

#### 1.3 `src/components/WorkflowDesigner/hooks/useDataFetching.js`
**功能**: 數據獲取管理 Hook

**主要修改**:
- 添加 `metaTemplates` 狀態
- 添加 `setMetaTemplates` 狀態更新函數
- 添加 `fetchMetaTemplates` 獲取函數
- 在 `initializeData` 中調用 `fetchMetaTemplates`
- 在返回值中導出相關狀態和方法

**新增狀態**:
- `metaTemplates`: Meta 模板列表
- `setMetaTemplates`: 更新 Meta 模板列表的函數

**新增方法**:
- `fetchMetaTemplates`: 獲取 Meta 模板的異步函數

#### 1.4 `src/components/WorkflowDesigner/hooks/useNodeHandlers.js`
**功能**: 節點處理函數管理 Hook

**主要修改**:
- 修改 `handleSelectTemplate` 函數，添加 `isMetaTemplate` 參數
- 在選擇模板時，保存模板類型信息（`isMetaTemplate` 和 `templateType`）

**更新函數簽名**:
```javascript
const handleSelectTemplate = useCallback((template, isMetaTemplate = false) => {
  if (selectedNode) {
    handleNodeDataChange({
      templateId: template.id,
      templateName: template.name,
      templateDescription: template.description,
      isMetaTemplate: isMetaTemplate,
      templateType: isMetaTemplate ? 'META' : 'INTERNAL'
    });
  }
}, [selectedNode, handleNodeDataChange]);
```

#### 1.5 `src/components/WorkflowDesigner/WhatsAppWorkflowDesigner.js`
**功能**: 主設計器組件

**主要修改**:
- 從 `useDataFetching` Hook 中解構 `metaTemplates` 和 `setMetaTemplates`
- 將 `metaTemplates` 傳遞給 `TemplateModal` 組件
- 更新 `onSelectTemplate` 回調，傳遞 `isMetaTemplate` 參數

### 2. 語言資源文件修改

#### 2.1 `src/locales/zh-TC.js` (繁體中文)
添加了以下翻譯鍵:
```javascript
internalTemplate: '內部模板',
metaTemplate: {
  title: 'Meta 官方模板',
  approved: '已審核',
  pending: '審核中',
  rejected: '已拒絕',
},
```

#### 2.2 `src/locales/zh-SC.js` (簡體中文)
添加了以下翻譯鍵:
```javascript
internalTemplate: '内部模板',
metaTemplate: {
  title: 'Meta 官方模板',
  approved: '已审核',
  pending: '审核中',
  rejected: '已拒绝',
},
```

#### 2.3 `src/locales/en.js` (英文)
添加了以下翻譯鍵:
```javascript
internalTemplate: 'Internal Templates',
metaTemplate: {
  title: 'Meta Official Templates',
  approved: 'Approved',
  pending: 'Pending',
  rejected: 'Rejected',
},
```

## 功能說明

### 使用流程

1. **打開流程設計器**: 進入工作流程設計頁面
2. **添加發送模板節點**: 從左側工具欄拖拽 "發送 WhatsApp 模板" 節點到畫布
3. **雙擊節點**: 打開節點屬性編輯抽屜
4. **選擇模板**: 點擊模板選擇按鈕
5. **切換 Tab**: 在彈出的 Modal 中可以看到兩個 Tab:
   - **內部模板**: 系統內部創建的自定義模板
   - **Meta 官方模板**: 通過 Meta API 創建並審核通過的官方模板
6. **選擇模板**: 點擊任一模板卡片即可選擇

### 特點

1. **自動過濾**: Meta 模板列表只顯示已審核通過（APPROVED）的模板
2. **狀態顯示**: Meta 模板會顯示審核狀態標記
3. **數量統計**: 每個 Tab 標籤上顯示該類別的模板數量
4. **類型標識**: 選中的模板會記錄其類型（INTERNAL / META），便於後續流程執行時區分處理

## 後端 API 依賴

此功能依賴以下後端 API:

### 1. 獲取 Meta 模板列表
- **端點**: `GET /api/whatsappmetatemplates`
- **認證**: Bearer Token
- **響應格式**:
```json
{
  "success": true,
  "data": [
    {
      "id": "string",
      "name": "string",
      "description": "string",
      "category": "string",
      "language": "string",
      "status": "APPROVED | PENDING | REJECTED",
      "components": []
    }
  ],
  "total": 0
}
```

### 2. 現有的內部模板 API
- **端點**: `GET /api/whatsapptemplates?status=Active`
- **認證**: Bearer Token

## 數據流程

```
初始化流程設計器
  ↓
調用 initializeData()
  ↓
並行獲取數據:
  - fetchTemplates() → 內部模板
  - fetchMetaTemplates() → Meta 模板
  ↓
用戶點擊節點選擇模板按鈕
  ↓
打開 TemplateModal
  ↓
顯示兩個 Tab (內部模板 / Meta 模板)
  ↓
用戶選擇模板
  ↓
調用 handleSelectTemplate(template, isMetaTemplate)
  ↓
更新節點數據:
  - templateId
  - templateName
  - templateDescription
  - isMetaTemplate (布爾值)
  - templateType ('INTERNAL' 或 'META')
```

## 測試建議

1. **基本功能測試**:
   - 驗證兩個 Tab 是否正常顯示
   - 確認內部模板列表正常載入
   - 確認 Meta 模板列表正常載入

2. **選擇功能測試**:
   - 選擇內部模板，檢查節點數據是否正確保存
   - 選擇 Meta 模板，檢查節點數據是否正確保存
   - 驗證 `isMetaTemplate` 和 `templateType` 字段是否正確

3. **UI/UX 測試**:
   - Tab 切換流暢性
   - 模板卡片懸停效果
   - Badge 數量顯示
   - Meta 模板狀態標記顯示

4. **錯誤處理測試**:
   - API 調用失敗時的處理
   - 空模板列表的顯示
   - 網絡異常的處理

## 注意事項

1. **Meta 模板過濾**: 當前實現只顯示狀態為 `APPROVED` 的 Meta 模板，如需調整可修改 `apiService.js` 中的過濾邏輯

2. **模板類型標識**: 選中的模板會在節點數據中添加 `isMetaTemplate` 和 `templateType` 字段，請確保後端工作流程執行引擎能正確識別和處理這些字段

3. **兼容性**: 該修改向後兼容，不會影響現有的內部模板功能

4. **多語言支持**: 已添加繁體中文、簡體中文和英文的翻譯，如需添加其他語言，請在對應的語言文件中添加相同的翻譯鍵

## 未來擴展建議

1. **模板預覽**: 可以添加模板預覽功能，在選擇前查看模板內容
2. **模板搜索**: 當模板數量較多時，可以添加搜索過濾功能
3. **模板排序**: 支持按名稱、創建時間等排序
4. **模板收藏**: 允許用戶收藏常用模板，快速訪問
5. **批量操作**: 支持批量導入或同步 Meta 模板

## 版本記錄

- **v1.0** (2025-01-06): 初始版本，添加 Tab 區分內部模板和 Meta 模板

