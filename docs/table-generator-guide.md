# 表格頁面代碼生成器使用指南

## 📋 概述

這個代碼生成器基於您現有的成熟頁面（HashtagsPage、BroadcastGroupsPage、ContactListPage、WorkflowListPage）綜合而來，可以快速生成標準化的表格頁面代碼。

## 🚀 快速開始

### 1. 使用快速生成器

> **💡 最新更新**: 現在支持服務器端排序功能！所有生成的頁面都包含完整的排序、分頁和列寬調整功能。

### 1. 使用快速生成器

```javascript
import { quickGenerators } from '../tools/tablePageGenerator.js';

// 生成簡單的 CRUD 頁面
const simplePageCode = quickGenerators.simpleCrud(
  'MyPage', 
  '/api/mydata',
  [
    { key: 'name', titleKey: 'table.name', width: 200 },
    { key: 'email', titleKey: 'table.email', width: 200 },
    { key: 'createdAt', titleKey: 'table.createdAt', type: 'date', width: 150 }
  ]
);

// 生成帶搜索的頁面
const searchablePageCode = quickGenerators.searchableCrud(
  'SearchablePage', 
  '/api/searchable'
);

// 生成帶批量操作的頁面
const batchPageCode = quickGenerators.batchCrud(
  'BatchPage', 
  '/api/batch'
);

// 生成企業級頁面（包含所有功能）
const enterprisePageCode = quickGenerators.enterprise(
  'EnterprisePage', 
  '/api/enterprise'
);
```

### 2. 使用預設配置

```javascript
import { generateWithDefaultConfig } from '../tools/tablePageGenerator.js';

// 使用預設配置生成頁面
const pageCode = generateWithDefaultConfig('enterprise', {
  pageName: 'MyCustomPage',
  apiEndpoint: '/api/mycustom',
  languageKeys: {
    'table.name': 'My Custom Name',
    'table.description': 'My Custom Description'
  }
});
```

### 3. 使用現有頁面配置

```javascript
import { existingPageConfigs } from '../configs/tableConfigs.js';
import { generateCompletePage } from '../tools/tablePageGenerator.js';

// 基於 HashtagsPage 的配置生成新頁面
const hashtagLikePageCode = generateCompletePage({
  ...existingPageConfigs.hashtags,
  pageName: 'MyHashtagPage',
  apiEndpoint: '/api/myhashtags'
});
```

## ⚙️ 詳細配置

### 配置對象結構

```javascript
const config = {
  // 必需字段
  pageName: 'YourPageName',           // 頁面組件名稱
  apiEndpoint: '/api/your-endpoint',  // API 端點
  
  // 列配置
  columns: [
    {
      key: 'name',                    // 數據字段名
      titleKey: 'table.name',         // 語言鍵
      width: 200,                     // 列寬度
      type: 'text',                   // 列類型
      sortable: true,                 // 是否可排序
      ellipsis: false                 // 是否省略
    }
  ],
  
  // 功能配置
  features: {
    search: true,                     // 搜索功能
    batchOperations: true,           // 批量操作
    resizable: true,                 // 可調整大小
    timezone: true,                  // 時區處理
    modal: true,                     // 模態框
    filters: false,                  // 篩選功能
    pagination: true,                // 分頁功能
    export: false                    // 導出功能
  },
  
  // 語言鍵配置
  languageKeys: {
    'table.name': 'Name',
    'table.add': 'Add',
    'table.edit': 'Edit'
  }
};
```

### 列類型說明

| 類型 | 描述 | 示例 |
|------|------|------|
| `text` | 普通文本 | `{ key: 'name', type: 'text' }` |
| `date` | 日期時間 | `{ key: 'createdAt', type: 'date', format: 'MM-DD HH:mm' }` |
| `status` | 狀態標籤 | `{ key: 'status', type: 'status', activeValue: 'active' }` |
| `tag` | 單個標籤 | `{ key: 'priority', type: 'tag', color: 'blue' }` |
| `tags` | 多個標籤 | `{ key: 'hashtags', type: 'tags' }` |
| `color` | 顏色顯示 | `{ key: 'color', type: 'color' }` |
| `number` | 數字 | `{ key: 'count', type: 'number' }` |
| `actions` | 操作按鈕 | `{ key: 'actions', type: 'actions' }` |

### 功能配置說明

| 功能 | 描述 | 包含的組件 |
|------|------|------------|
| `search` | 搜索功能 | 搜索欄、搜索處理函數 |
| `batchOperations` | 批量操作 | 行選擇、批量刪除模態框 |
| `resizable` | 可調整大小 | ResizableTitle、列寬度管理 |
| `timezone` | 時區處理 | TimezoneUtils、時區狀態 |
| `modal` | 模態框 | 新增/編輯模態框、表單 |
| `filters` | 篩選功能 | 篩選器組件 |
| `pagination` | 分頁功能 | 分頁組件、分頁狀態 |
| `export` | 導出功能 | 導出按鈕、導出函數 |

## 📝 使用示例

### 示例 1: 創建簡單的用戶管理頁面

```javascript
import { generateCompletePage } from '../tools/tablePageGenerator.js';

const userPageCode = generateCompletePage({
  pageName: 'UserManagementPage',
  apiEndpoint: '/api/users',
  columns: [
    { key: 'name', titleKey: 'user.name', width: 150, sortable: true },
    { key: 'email', titleKey: 'user.email', width: 200, ellipsis: true },
    { key: 'role', titleKey: 'user.role', type: 'tag', width: 100 },
    { key: 'status', titleKey: 'user.status', type: 'status', width: 100 },
    { key: 'createdAt', titleKey: 'user.createdAt', type: 'date', width: 150 }
  ],
  features: {
    search: true,
    batchOperations: true,
    resizable: false,
    timezone: true,
    modal: true
  },
  languageKeys: {
    'user.name': 'Name',
    'user.email': 'Email',
    'user.role': 'Role',
    'user.status': 'Status',
    'user.createdAt': 'Created At',
    'user.add': 'Add User',
    'user.edit': 'Edit User',
    'user.delete': 'Delete User'
  }
});
```

### 示例 2: 創建基於現有頁面的配置

```javascript
import { existingPageConfigs, createCustomConfig } from '../configs/tableConfigs.js';
import { generateCompletePage } from '../tools/tablePageGenerator.js';

// 基於 ContactListPage 創建新的聯絡人管理頁面
const customContactConfig = createCustomConfig(
  existingPageConfigs.contactList,
  {
    pageName: 'AdvancedContactPage',
    apiEndpoint: '/api/advanced-contacts',
    columns: [
      ...existingPageConfigs.contactList.columns,
      { key: 'lastContact', titleKey: 'contact.lastContact', type: 'date', width: 150 }
    ],
    features: {
      ...existingPageConfigs.contactList.features,
      export: true,
      resizable: true
    }
  }
);

const advancedContactPageCode = generateCompletePage(customContactConfig);
```

### 示例 3: 使用推薦配置

```javascript
import { getRecommendedConfig } from '../configs/tableConfigs.js';
import { generateCompletePage } from '../tools/tablePageGenerator.js';

// 獲取企業級頁面的推薦配置
const recommendedConfig = getRecommendedConfig('enterprise', {
  timezone: true,
  resizable: true,
  batchOperations: true
});

const enterprisePageCode = generateCompletePage(recommendedConfig);
```

## 🔧 自定義擴展

### 添加自定義列渲染

```javascript
// 在生成的代碼中，你可以修改列定義來添加自定義渲染
const customColumns = [
  {
    key: 'customField',
    titleKey: 'table.customField',
    width: 150,
    render: (text, record) => (
      <div style={{ color: record.status === 'active' ? 'green' : 'red' }}>
        {text}
      </div>
    )
  }
];
```

### 添加自定義操作

```javascript
// 在生成的代碼中添加自定義操作函數
const handleCustomAction = async (record) => {
  try {
    const response = await fetch(`/api/custom-action/${record.id}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    
    if (response.ok) {
      message.success('Custom action completed');
      loadData();
    }
  } catch (error) {
    message.error('Custom action failed');
  }
};
```

## 📚 最佳實踐

### 1. 命名規範
- 頁面名稱使用 PascalCase：`UserManagementPage`
- API 端點使用 kebab-case：`/api/user-management`
- 語言鍵使用點分隔：`user.name`、`user.email`

### 2. 列配置
- 總是為日期字段設置 `type: 'date'`
- 為狀態字段設置 `type: 'status'`
- 為長文本設置 `ellipsis: true`
- 為操作列設置固定寬度 `width: 120`

### 3. 功能選擇
- 簡單列表：只使用 `modal: true`
- 搜索列表：添加 `search: true`
- 管理頁面：添加 `batchOperations: true`
- 企業級頁面：使用 `resizable: true`

### 4. 語言鍵管理
- 使用有意義的鍵名：`user.name` 而不是 `name`
- 保持一致性：所有頁面使用相同的基礎鍵
- 提供完整的翻譯：包括所有 UI 文本

## 🐛 故障排除

### 常見問題

1. **生成的代碼有語法錯誤**
   - 檢查配置對象的語法
   - 確保所有必需字段都已提供
   - 使用 `validateConfig` 驗證配置

2. **列不顯示**
   - 檢查 `key` 字段是否與 API 返回的數據匹配
   - 確保 `titleKey` 在語言包中存在

3. **功能不工作**
   - 檢查 `features` 配置是否正確
   - 確保相關的依賴組件已導入

4. **時區顯示不正確**
   - 確保 `features.timezone: true`
   - 檢查 `userTimezoneOffset` 狀態是否正確設置

### 調試技巧

```javascript
// 使用配置驗證
import { validateConfig } from '../configs/tableConfigs.js';

const validation = validateConfig(yourConfig);
if (!validation.valid) {
  console.error('配置錯誤:', validation.errors);
}
if (validation.warnings.length > 0) {
  console.warn('配置警告:', validation.warnings);
}
```

## 📖 API 參考

### 生成器函數

- `generateBasicTablePage(config)` - 生成基礎表格頁面
- `generateCompletePage(config)` - 生成完整頁面（包含語言鍵）
- `generateWithDefaultConfig(type, customConfig)` - 使用預設配置生成
- `quickGenerators.simpleCrud(name, endpoint, columns)` - 快速生成簡單 CRUD
- `quickGenerators.searchableCrud(name, endpoint, columns)` - 快速生成可搜索 CRUD
- `quickGenerators.batchCrud(name, endpoint, columns)` - 快速生成批量操作 CRUD
- `quickGenerators.enterprise(name, endpoint, columns)` - 快速生成企業級頁面

### 配置函數

- `createCustomConfig(baseConfig, customConfig)` - 創建自定義配置
- `validateConfig(config)` - 驗證配置
- `getRecommendedConfig(pageType, requirements)` - 獲取推薦配置

### 預設配置

- `existingPageConfigs` - 基於現有頁面的配置
- `commonConfigs` - 通用配置模板
- `defaultConfigs` - 默認配置
- `columnTypes` - 列類型定義
- `featureOptions` - 功能選項
- `languageKeyTemplates` - 語言鍵模板

## 🎯 下一步

1. 根據您的需求選擇合適的配置
2. 使用生成器創建頁面代碼
3. 將生成的代碼保存到 `src/pages/` 目錄
4. 添加必要的語言鍵到語言包
5. 測試頁面功能
6. 根據需要進行自定義調整

## 💡 提示

- 生成的代碼是標準化的，可以根據需要進行修改
- 建議先使用簡單配置測試，然後逐步添加複雜功能
- 所有生成的代碼都遵循您現有項目的代碼風格
- 可以將生成的代碼作為模板，複製並修改用於其他頁面
