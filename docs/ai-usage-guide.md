# 表格頁面代碼生成器 - AI 使用指南

## 🤖 給 AI 的提示模板

當用戶需要創建新的表格頁面時，使用以下提示模板：

### 基礎提示模板

```
請使用表格頁面代碼生成器為我創建一個新的頁面：

頁面名稱: {pageName}
API 端點: {apiEndpoint}
功能需求: {features}
列配置: {columns}

請使用以下工具：
1. 導入代碼片段庫: import { ... } from '../snippets/tableSnippets.js'
2. 導入代碼生成器: import { ... } from '../tools/tablePageGenerator.js'
3. 導入配置模板: import { ... } from '../configs/tableConfigs.js'

根據需求選擇合適的生成方法：
- 簡單頁面: quickGenerators.simpleCrud()
- 可搜索頁面: quickGenerators.searchableCrud()
- 批量操作頁面: quickGenerators.batchCrud()
- 企業級頁面: quickGenerators.enterprise()
- 自定義頁面: generateCompletePage()
```

### 具體使用示例

#### 示例 1: 創建簡單的產品管理頁面

```javascript
import { quickGenerators } from '../tools/tablePageGenerator.js';

const productPageCode = quickGenerators.simpleCrud(
  'ProductManagementPage',
  '/api/products',
  [
    { key: 'name', titleKey: 'product.name', width: 200 },
    { key: 'price', titleKey: 'product.price', type: 'number', width: 100 },
    { key: 'category', titleKey: 'product.category', width: 150 },
    { key: 'status', titleKey: 'product.status', type: 'status', width: 100 },
    { key: 'createdAt', titleKey: 'product.createdAt', type: 'date', width: 150 }
  ]
);
```

#### 示例 2: 創建基於現有頁面的配置

```javascript
import { existingPageConfigs } from '../configs/tableConfigs.js';
import { generateCompletePage } from '../tools/tablePageGenerator.js';

const customConfig = {
  ...existingPageConfigs.hashtags,
  pageName: 'TagManagementPage',
  apiEndpoint: '/api/tags',
  languageKeys: {
    ...existingPageConfigs.hashtags.languageKeys,
    'hashtags.name': 'Tag Name',
    'hashtags.add': 'Add Tag'
  }
};

const tagPageCode = generateCompletePage(customConfig);
```

#### 示例 3: 創建企業級頁面

```javascript
import { generateWithDefaultConfig } from '../tools/tablePageGenerator.js';

const enterprisePageCode = generateWithDefaultConfig('enterprise', {
  pageName: 'AdvancedUserPage',
  apiEndpoint: '/api/advanced-users',
  columns: [
    { key: 'name', titleKey: 'user.name', width: 150 },
    { key: 'email', titleKey: 'user.email', width: 200 },
    { key: 'role', titleKey: 'user.role', type: 'tag', width: 100 },
    { key: 'status', titleKey: 'user.status', type: 'status', width: 100 },
    { key: 'lastLogin', titleKey: 'user.lastLogin', type: 'date', width: 150 },
    { key: 'createdAt', titleKey: 'user.createdAt', type: 'date', width: 150 }
  ]
});
```

## 🔧 配置選項說明

### 列配置選項

```javascript
const columnConfig = {
  key: 'fieldName',              // 數據字段名（必需）
  titleKey: 'table.fieldName',   // 語言鍵（推薦）
  title: 'Field Name',           // 直接標題（可選）
  width: 150,                    // 列寬度
  type: 'text',                  // 列類型
  sortable: true,                // 是否可排序
  ellipsis: false,              // 是否省略長文本
  format: 'MM-DD HH:mm'         // 日期格式（僅日期類型）
};
```

### 功能配置選項

```javascript
const featuresConfig = {
  search: true,                  // 搜索功能
  batchOperations: true,         // 批量操作
  resizable: true,              // 可調整大小
  timezone: true,               // 時區處理
  modal: true,                  // 模態框
  filters: false,               // 篩選功能
  pagination: true,             // 分頁功能
  export: false                 // 導出功能
};
```

### 語言鍵配置

```javascript
const languageKeys = {
  'table.add': 'Add',
  'table.edit': 'Edit',
  'table.delete': 'Delete',
  'table.name': 'Name',
  'table.createdAt': 'Created At',
  'table.updatedAt': 'Updated At',
  'table.actions': 'Actions',
  'table.searchPlaceholder': 'Search...',
  'table.refresh': 'Refresh',
  'table.batchDelete': 'Batch Delete',
  'table.confirmDelete': 'Confirm Delete',
  'table.deleteConfirmMessage': 'Are you sure you want to delete {name}?',
  'table.batchDeleteConfirmMessage': 'Are you sure you want to delete {count} items?',
  'table.addSuccess': 'Added successfully',
  'table.updateSuccess': 'Updated successfully',
  'table.deleteSuccess': 'Deleted successfully',
  'table.batchDeleteSuccess': 'Batch deleted successfully',
  'table.loadError': 'Failed to load data',
  'table.saveError': 'Failed to save data',
  'table.deleteError': 'Failed to delete data',
  'table.batchDeleteError': 'Failed to batch delete data',
  'table.nameRequired': 'Name is required',
  'table.namePlaceholder': 'Enter name',
  'common.confirm': 'Confirm',
  'common.cancel': 'Cancel'
};
```

## 📋 常用配置模板

### 1. 簡單 CRUD 頁面

```javascript
const simpleConfig = {
  pageName: 'SimplePage',
  apiEndpoint: '/api/simple',
  columns: [
    { key: 'name', titleKey: 'table.name', width: 200 },
    { key: 'description', titleKey: 'table.description', width: 250 },
    { key: 'createdAt', titleKey: 'table.createdAt', type: 'date', width: 150 }
  ],
  features: {
    search: false,
    batchOperations: false,
    resizable: false,
    timezone: true,
    modal: true
  }
};
```

### 2. 可搜索頁面

```javascript
const searchableConfig = {
  pageName: 'SearchablePage',
  apiEndpoint: '/api/searchable',
  columns: [
    { key: 'name', titleKey: 'table.name', width: 200 },
    { key: 'status', titleKey: 'table.status', type: 'status', width: 100 },
    { key: 'createdAt', titleKey: 'table.createdAt', type: 'date', width: 150 }
  ],
  features: {
    search: true,
    batchOperations: false,
    resizable: false,
    timezone: true,
    modal: true
  }
};
```

### 3. 批量操作頁面

```javascript
const batchConfig = {
  pageName: 'BatchPage',
  apiEndpoint: '/api/batch',
  columns: [
    { key: 'name', titleKey: 'table.name', width: 200 },
    { key: 'status', titleKey: 'table.status', type: 'status', width: 100 },
    { key: 'createdAt', titleKey: 'table.createdAt', type: 'date', width: 150 }
  ],
  features: {
    search: true,
    batchOperations: true,
    resizable: false,
    timezone: true,
    modal: true
  }
};
```

### 4. 企業級頁面

```javascript
const enterpriseConfig = {
  pageName: 'EnterprisePage',
  apiEndpoint: '/api/enterprise',
  columns: [
    { key: 'name', titleKey: 'table.name', width: 200 },
    { key: 'status', titleKey: 'table.status', type: 'status', width: 100 },
    { key: 'priority', titleKey: 'table.priority', type: 'tag', width: 100 },
    { key: 'createdBy', titleKey: 'table.createdBy', width: 120 },
    { key: 'createdAt', titleKey: 'table.createdAt', type: 'date', width: 150 }
  ],
  features: {
    search: true,
    batchOperations: true,
    resizable: true,
    timezone: true,
    modal: true,
    filters: true,
    pagination: true,
    export: true
  }
};
```

## 🎯 使用流程

### 步驟 1: 分析需求
- 確定頁面功能需求
- 確定列配置
- 確定 API 端點

### 步驟 2: 選擇生成方法
- 簡單需求：使用 `quickGenerators`
- 複雜需求：使用 `generateCompletePage`
- 基於現有頁面：使用 `existingPageConfigs`

### 步驟 3: 生成代碼
```javascript
import { quickGenerators } from '../tools/tablePageGenerator.js';

const pageCode = quickGenerators.enterprise(
  'YourPageName',
  '/api/your-endpoint',
  yourColumns
);
```

### 步驟 4: 保存和測試
- 將生成的代碼保存到 `src/pages/YourPageName.js`
- 添加必要的語言鍵到語言包
- 測試頁面功能

## 💡 AI 提示技巧

### 1. 理解用戶需求
- 詢問頁面的具體功能
- 確定需要的列
- 確定 API 端點

### 2. 選擇合適的配置
- 簡單列表：使用 `simpleCrud`
- 需要搜索：使用 `searchableCrud`
- 需要批量操作：使用 `batchCrud`
- 企業級功能：使用 `enterprise`

### 3. 提供完整代碼
- 包含所有必要的導入
- 提供完整的配置對象
- 包含語言鍵配置

### 4. 給出使用建議
- 說明如何保存文件
- 說明如何添加語言鍵
- 說明如何測試功能

## 🔍 常見問題處理

### 問題 1: 用戶不知道需要什麼功能
**解決方案**: 提供功能選項說明，讓用戶選擇

### 問題 2: 用戶需要自定義列
**解決方案**: 提供列配置模板，說明各種列類型

### 問題 3: 用戶需要特殊的 API 格式
**解決方案**: 說明如何修改生成的代碼來適配不同的 API

### 問題 4: 用戶需要多語言支持
**解決方案**: 提供完整的語言鍵配置模板

## 📚 參考資源

- 代碼片段庫：`src/snippets/tableSnippets.js`
- 代碼生成器：`src/tools/tablePageGenerator.js`
- 配置模板：`src/configs/tableConfigs.js`
- 使用文檔：`docs/table-generator-guide.md`

## 🎉 總結

這個代碼生成器可以幫助用戶快速創建標準化的表格頁面，減少重複代碼，提高開發效率。AI 應該：

1. 理解用戶需求
2. 選擇合適的生成方法
3. 提供完整的代碼
4. 給出使用建議
5. 提供後續支持
