# 工作流程設計器組件分拆說明

## 概述
原本的 `WhatsAppWorkflowDesigner.js` 文件過於龐大（3317行），難以維護和 AI 讀取。現已將其分拆為多個模塊，提高代碼的可維護性和可讀性。

## 目錄結構
```
src/components/WorkflowDesigner/
├── components/           # 通用組件
│   ├── CommonHandle.js      # 連接點組件
│   ├── DeleteButton.js      # 刪除按鈕組件
│   ├── NodeContent.js       # 節點內容組件
│   ├── NodeTypes.js         # 節點類型定義
│   ├── UserSelectInput.js   # 用戶選擇輸入組件
│   └── VariableTags.js      # 變量標籤組件
├── constants.js          # 常量和配置
├── hooks/               # 自定義 Hooks
│   ├── useConditionGroups.js  # 條件群組管理 Hook
│   └── useNodeData.js        # 節點數據管理 Hook
├── modals/              # Modal 組件
│   ├── ConditionGroupModal.js    # 條件群組編輯 Modal
│   ├── ConditionModal.js         # 條件編輯 Modal
│   ├── DefaultPathModal.js       # 默認路徑選擇 Modal
│   ├── EFormModal.js             # EForm 選擇 Modal
│   ├── ProcessVariablesModal.js  # 流程變量管理 Modal
│   ├── TemplateModal.js          # 模板選擇 Modal
│   └── UserModal.js              # 用戶選擇 Modal
├── services/            # 服務層
│   └── apiService.js        # API 服務類
├── styles.js            # 樣式定義
├── utils.js             # 工具函數
├── WhatsAppWorkflowDesigner.js  # 主組件（重構後）
├── index.js             # 導出文件
└── README.md            # 說明文檔
```

## 分拆詳情

### 1. 常量和配置 (constants.js)
- `NODE_STYLES`: 節點樣式配置
- `HANDLE_STYLES`: 連接點樣式配置
- `DELETE_BUTTON_STYLES`: 刪除按鈕樣式配置
- `MOCK_DATA`: 模擬數據
- `NODE_TYPE_CONFIGS`: 節點類型配置

### 2. 樣式定義 (styles.js)
- `purpleButtonStyle`: 紫色按鈕和 React Flow 相關樣式

### 3. 工具函數 (utils.js)
- `handleApiError`: 通用錯誤處理
- `processVariableReferences`: 變量引用語法處理
- `generateUniqueTaskName`: 生成唯一任務名稱
- `generateWebhookToken`: 生成 Webhook Token
- `validateWorkflowLogic`: 驗證工作流程邏輯
- `getAvailableOutputPaths`: 獲取可用輸出路徑

### 4. 自定義 Hooks
#### useConditionGroups.js
- 條件群組管理相關功能
- 提供增刪改查條件群組的方法

#### useNodeData.js
- 節點數據管理
- 提供默認節點數據生成功能

### 5. 通用組件
#### CommonHandle.js
- 統一的連接點組件
- 支持不同類型的連接點樣式

#### DeleteButton.js
- 統一的刪除按鈕組件
- 可復用的刪除功能

#### UserSelectInput.js
- 用戶選擇輸入組件
- 支持單選和多選模式

#### VariableTags.js
- 變量標籤組件
- 用於顯示和選擇流程變量

#### NodeContent.js
- 節點內容顯示組件
- 統一的節點內容格式

#### NodeTypes.js
- 節點類型定義和創建
- 包含不同類型節點的渲染邏輯

### 6. Modal 組件
每個 Modal 都是獨立的組件，負責特定的功能：
- `TemplateModal`: WhatsApp 模板選擇
- `UserModal`: 用戶選擇
- `EFormModal`: EForm 選擇
- `ProcessVariablesModal`: 流程變量管理
- `ConditionModal`: 條件編輯
- `ConditionGroupModal`: 條件群組編輯
- `DefaultPathModal`: 默認路徑選擇

### 7. 服務層 (apiService.js)
- `ApiService` 類：封裝所有 API 調用
- 提供統一的錯誤處理和數據轉換
- 支持模板、用戶、EForm、流程變量等數據的 CRUD 操作

## 使用方式

### 導入分拆後的組件
```javascript
import { WhatsAppWorkflowDesigner } from './components/WorkflowDesigner';
```

### 導入特定模塊
```javascript
import { 
  CommonHandle, 
  DeleteButton, 
  UserSelectInput,
  apiService,
  validateWorkflowLogic 
} from './components/WorkflowDesigner';
```

## 優勢

1. **可維護性**: 每個文件職責單一，易於理解和修改
2. **可復用性**: 組件和工具函數可以在其他地方復用
3. **可測試性**: 每個模塊可以獨立測試
4. **AI 友好**: 代碼結構清晰，便於 AI 理解和維護
5. **團隊協作**: 不同開發者可以同時修改不同模塊而不會衝突

## 注意事項

1. 主組件 `WhatsAppWorkflowDesigner.js` 需要進一步完善，目前只包含基本結構
2. 所有組件都使用相同的 props 接口，保持向後兼容
3. 樣式和常數集中管理，便於主題切換和樣式調整
4. API 服務層統一管理，便於後端接口變更

## 後續改進

1. 添加 TypeScript 支持
2. 增加單元測試
3. 優化性能（使用 React.memo 等）
4. 添加錯誤邊界處理
5. 完善文檔和示例
