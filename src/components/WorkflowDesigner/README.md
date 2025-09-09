# 工作流程設計器 (WorkflowDesigner)

## 📋 概述

工作流程設計器是一個基於 React Flow 的可視化工作流程編輯器，支持拖拽式節點創建、連接線管理、屬性編輯等功能。該組件已完全重構為模塊化架構，提供高度可維護性和可擴展性。

## ✨ 主要功能

- 🎯 **10種節點類型**：Start, Send WhatsApp, Switch, DB Query, API Call, EForm, End 等
- 🔗 **拖拽連接**：直觀的節點連接和編輯
- ⚙️ **屬性編輯**：右側屬性面板，支持實時預覽
- 📋 **模態框系統**：模板選擇、用戶選擇、變量管理等
- ⌨️ **快捷鍵支持**：Ctrl+C/V, Delete, Ctrl+A 等
- 🎨 **對齊功能**：多選節點對齊
- 🔄 **複製貼上**：節點複製和貼上功能
- 🌐 **國際化**：支持多語言
- 📱 **響應式設計**：適配不同屏幕尺寸

## 🏗️ 架構設計

### 目錄結構
```
src/components/WorkflowDesigner/
├── components/           # 核心組件 (14個文件)
│   ├── WorkflowCanvas.js    # React Flow 畫布
│   ├── Toolbar.js           # 頂部工具欄
│   ├── Sidebar.js           # 左側工具欄
│   ├── NodePropertyDrawer.js # 屬性編輯抽屜
│   ├── NodeTypes.js         # 節點類型定義
│   └── ...                  # 其他組件
├── hooks/               # 自定義 Hooks (9個文件)
│   ├── useWorkflowState.js  # 工作流程狀態管理
│   ├── useNodeHandlers.js   # 節點事件處理
│   ├── useAdvancedFeatures.js # 高級功能
│   └── ...                  # 其他 Hooks
├── modals/              # 模態框組件 (7個文件)
│   ├── ProcessVariablesModal.js # 流程變量管理
│   ├── TemplateModal.js        # 模板選擇
│   └── ...                     # 其他模態框
├── services/            # 服務層
│   └── apiService.js        # API 服務類
├── constants.js          # 常量和配置
├── styles.js            # 樣式定義
├── utils.js             # 工具函數
└── WhatsAppWorkflowDesigner.js # 主組件
```

## 🚀 快速開始

### 基本使用
```javascript
import { WhatsAppWorkflowDesigner } from './components/WorkflowDesigner';

const MyPage = () => {
  return <WhatsAppWorkflowDesigner />;
};
```

### 自定義配置
```javascript
import { 
  WhatsAppWorkflowDesigner,
  NODE_STYLES,
  apiService 
} from './components/WorkflowDesigner';

// 自定義樣式
const customStyles = {
  ...NODE_STYLES,
  custom: { /* 自定義樣式 */ }
};
```

## 📚 文檔

- [架構文檔](./ARCHITECTURE.md) - 詳細的架構設計和技術實現
- [功能清單](./FEATURES.md) - 完整的功能列表和特性說明

## 🎯 核心特性

### 節點管理
- 拖拽創建節點
- 多選和全選
- 複製貼上功能
- 節點對齊

### 連接系統
- 拖拽創建連接
- 連接線樣式和動畫
- 連接線選擇和刪除

### 屬性編輯
- 右側屬性面板
- 動態表單
- 實時預覽
- 表單驗證

### 模態框系統
- 模板選擇
- 用戶選擇
- 流程變量管理
- 條件編輯

## 🔧 技術棧

- **React 18** - 前端框架
- **React Flow** - 流程圖庫
- **Ant Design** - UI 組件庫
- **React Hooks** - 狀態管理
- **JavaScript ES6+** - 編程語言

## 🎨 樣式系統

### 節點樣式
- 不同類型節點不同顏色
- 選中和懸停效果
- 統一的視覺風格

### 連接線樣式
- 動畫效果
- 箭頭標記
- 懸停提示

## 🔌 API 集成

### 支持的 API
- 工作流程定義 CRUD
- 流程變量管理
- 模板和用戶數據
- EForm 數據

### 錯誤處理
- 統一的錯誤處理機制
- 用戶友好的錯誤提示
- 自動重試機制

## 🧪 測試

### 測試策略
- 單元測試：每個 Hook 和組件
- 集成測試：組件間交互
- 端到端測試：完整用戶流程

## 📈 性能優化

- React.memo 優化渲染
- useMemo 避免不必要計算
- useCallback 避免不必要渲染
- 虛擬化長列表

## 🔒 安全考慮

- 輸入驗證和清理
- XSS 防護
- API 認證
- 數據加密

## 🤝 貢獻

歡迎提交 Issue 和 Pull Request！

## 📄 許可證

MIT License
