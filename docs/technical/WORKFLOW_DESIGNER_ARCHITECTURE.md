# 工作流程設計器架構文檔

## 📋 概述

工作流程設計器是一個基於 React Flow 的可視化工作流程編輯器，支持拖拽式節點創建、連接線管理、屬性編輯等功能。該組件已完全重構為模塊化架構，提高可維護性和可擴展性。

## 🏗️ 架構設計

### 核心架構原則
- **模塊化**：每個功能獨立為單一文件
- **可復用**：組件和 Hooks 可在其他地方使用
- **可測試**：每個模塊可獨立測試
- **可維護**：清晰的代碼結構和職責分離

### 分層架構
```
┌─────────────────────────────────────┐
│           主組件層                    │
│    WhatsAppWorkflowDesigner.js      │
├─────────────────────────────────────┤
│           組件層                     │
│  Toolbar, Sidebar, WorkflowCanvas   │
├─────────────────────────────────────┤
│           Hooks 層                   │
│  useWorkflowState, useNodeHandlers  │
├─────────────────────────────────────┤
│           服務層                     │
│         apiService.js               │
├─────────────────────────────────────┤
│           工具層                     │
│    utils.js, constants.js           │
└─────────────────────────────────────┘
```

## 📁 目錄結構詳解

### components/ - 核心組件
| 組件 | 職責 | 依賴 |
|------|------|------|
| `WorkflowCanvas.js` | React Flow 畫布容器 | React Flow, 事件處理 |
| `Toolbar.js` | 頂部工具欄 | 保存、設置、對齊功能 |
| `Sidebar.js` | 左側工具欄 | 節點類型、工作流程信息 |
| `NodePropertyDrawer.js` | 右側屬性編輯 | 表單、模態框 |
| `NodeTypes.js` | 節點類型定義 | 節點渲染邏輯 |
| `CommonHandle.js` | 統一連接點 | 連接點樣式 |
| `DeleteButton.js` | 刪除按鈕 | 刪除功能 |
| `NodeContent.js` | 節點內容顯示 | 節點數據 |
| `UserSelectInput.js` | 用戶選擇輸入 | 用戶選擇邏輯 |
| `VariableTags.js` | 變量標籤 | 變量顯示 |
| `ProcessVariableSelect.js` | 流程變量選擇 | 變量選擇邏輯 |
| `CustomConnectionLine.js` | 自定義連接線 | 連接線樣式 |
| `FloatingEdge.js` | 浮動邊 | 邊顯示邏輯 |
| `EasyConnectNode.js` | 簡化連接節點 | 快速連接 |

### hooks/ - 自定義 Hooks
| Hook | 職責 | 狀態管理 |
|------|------|----------|
| `useWorkflowState.js` | 工作流程狀態管理 | nodes, edges, selectedNode |
| `useNodeHandlers.js` | 節點事件處理 | 節點增刪改查 |
| `useEdgeHandlers.js` | 邊事件處理 | 邊增刪改查 |
| `useNodeSelection.js` | 節點選擇管理 | 多選、全選 |
| `useAdvancedFeatures.js` | 高級功能 | 複製貼上、對齊 |
| `useDataFetching.js` | 數據獲取 | API 數據管理 |
| `useWorkflowSave.js` | 工作流程保存 | 保存邏輯 |
| `useConditionGroups.js` | 條件群組管理 | 條件邏輯 |
| `useNodeData.js` | 節點數據管理 | 節點數據生成 |

### modals/ - 模態框組件
| 模態框 | 職責 | 功能 |
|--------|------|------|
| `TemplateModal.js` | WhatsApp 模板選擇 | 模板選擇和預覽 |
| `UserModal.js` | 用戶選擇 | 用戶選擇和分配 |
| `EFormModal.js` | EForm 選擇 | 電子表單選擇 |
| `ProcessVariablesModal.js` | 流程變量管理 | 變量 CRUD 操作 |
| `ConditionModal.js` | 條件編輯 | 條件創建和編輯 |
| `ConditionGroupModal.js` | 條件群組編輯 | 條件群組管理 |
| `DefaultPathModal.js` | 默認路徑選擇 | 路徑選擇邏輯 |

### services/ - 服務層
| 服務 | 職責 | API 端點 |
|------|------|----------|
| `apiService.js` | API 調用服務 | 統一的 API 管理 |

## 🔧 核心功能實現

### 1. 節點管理系統
```javascript
// 節點類型配置
const NODE_TYPE_CONFIGS = [
  { type: 'start', label: 'Start', icon: PlayCircleOutlined },
  { type: 'sendWhatsApp', label: 'Send WhatsApp', icon: SendOutlined },
  { type: 'switch', label: 'Switch', icon: CheckCircleOutlined },
  // ... 更多節點類型
];

// 節點創建
const handleAddNode = (nodeType, position) => {
  const newNode = {
    id: generateId(),
    type: nodeType,
    position,
    data: getDefaultNodeData(nodeType)
  };
  setNodes(prev => [...prev, newNode]);
};
```

### 2. 連接系統
```javascript
// 連接處理
const onConnect = (connection) => {
  const newEdge = {
    id: generateId(),
    source: connection.source,
    target: connection.target,
    type: 'smoothstep',
    animated: true
  };
  setEdges(prev => [...prev, newEdge]);
};
```

### 3. 狀態管理
```javascript
// 使用 React Flow 的狀態管理
const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
const [edges, setEdges, onEdgesChange] = useEdgesState([]);

// 自定義狀態
const [selectedNode, setSelectedNode] = useState(null);
const [selectedNodes, setSelectedNodes] = useState([]);
const [drawerOpen, setDrawerOpen] = useState(false);
```

### 4. 事件處理
```javascript
// 節點點擊處理
const onNodeClick = (event, node) => {
  setSelectedNode(node);
  setSelectedEdge(null);
};

// 節點雙擊處理
const onNodeDoubleClick = (event, node) => {
  setSelectedNode(node);
  setDrawerOpen(true);
};

// 鍵盤事件處理
const handleKeyDown = (event) => {
  if (event.ctrlKey || event.metaKey) {
    switch (event.key) {
      case 'c': copyNodes(); break;
      case 'v': pasteNodes(); break;
      case 'a': selectAllNodes(); break;
    }
  }
  if (event.key === 'Delete') {
    deleteSelectedNodes();
  }
};
```

## 🎨 樣式系統

### 節點樣式
```javascript
const NODE_STYLES = {
  default: {
    padding: 8,
    background: '#fff',
    border: '1.5px solid #1890ff',
    borderRadius: 6,
    minWidth: 140,
    boxShadow: '0 1px 4px #0001'
  },
  input: {
    background: '#f6ffed',
    border: '2px solid #52c41a'
  },
  output: {
    background: '#fffbe6',
    border: '2px solid #faad14'
  }
};
```

### 連接點樣式
```javascript
const HANDLE_STYLES = {
  source: {
    background: '#52c41a',
    border: '2px solid #389e0d',
    width: 12,
    height: 12,
    borderRadius: '50%'
  },
  target: {
    background: '#1890ff',
    border: '2px solid #096dd9',
    width: 12,
    height: 12,
    borderRadius: '50%'
  }
};
```

## 🔌 API 集成

### API 服務類
```javascript
export class ApiService {
  async fetchTemplates() { /* 獲取模板 */ }
  async fetchUsers() { /* 獲取用戶 */ }
  async fetchEForms() { /* 獲取表單 */ }
  async fetchProcessVariables(workflowId) { /* 獲取流程變量 */ }
  async saveWorkflowDefinition(data) { /* 保存工作流程 */ }
  // ... 更多 API 方法
}
```

### 錯誤處理
```javascript
const handleApiError = (error, fallbackData, setter, errorMessage) => {
  console.error(errorMessage, error);
  setter(fallbackData);
};
```

## 🧪 測試策略

### 單元測試
- 每個 Hook 獨立測試
- 每個組件獨立測試
- 工具函數測試

### 集成測試
- 組件間交互測試
- 用戶流程測試
- API 集成測試

### 測試工具
- Jest (單元測試)
- React Testing Library (組件測試)
- Cypress (端到端測試)

## 🚀 性能優化

### React 優化
- 使用 `useMemo` 避免不必要的重新計算
- 使用 `useCallback` 避免不必要的重新渲染
- 使用 `React.memo` 優化組件渲染

### 渲染優化
- 虛擬化長列表
- 延遲加載非關鍵組件
- 優化重渲染邏輯

## 📈 擴展性

### 添加新節點類型
1. 在 `constants.js` 中添加節點配置
2. 在 `NodeTypes.js` 中添加渲染邏輯
3. 在 `useNodeData.js` 中添加默認數據
4. 在 `Sidebar.js` 中添加拖拽支持

### 添加新模態框
1. 在 `modals/` 目錄創建新組件
2. 在主組件中導入和使用
3. 在 `NodePropertyDrawer.js` 中添加觸發邏輯

### 添加新 API 端點
1. 在 `apiService.js` 中添加新方法
2. 在相應的 Hook 中調用
3. 添加錯誤處理和數據驗證

## 🔒 安全考慮

### 輸入驗證
- 所有用戶輸入都經過驗證
- 使用正則表達式驗證格式
- 防止 XSS 攻擊

### 數據安全
- API 調用使用認證令牌
- 敏感數據不存儲在本地
- 使用 HTTPS 傳輸

## 📚 使用指南

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

// 自定義 API 服務
const customApiService = new ApiService();
```

## 🐛 故障排除

### 常見問題
1. **節點無法拖拽**：檢查 `draggable` 屬性
2. **連接線無法創建**：檢查 `onConnect` 處理函數
3. **屬性編輯器不顯示**：檢查 `drawerOpen` 狀態
4. **API 調用失敗**：檢查認證令牌和端點

### 調試工具
- React DevTools
- Redux DevTools (如果使用)
- 瀏覽器開發者工具
- 控制台日誌

## 📝 更新日誌

### v2.0.0 (當前版本)
- ✅ 完全重構為模塊化架構
- ✅ 分拆為 20+ 個獨立文件
- ✅ 實現所有核心功能
- ✅ 添加高級功能 (複製貼上、對齊)
- ✅ 完善錯誤處理和驗證

### v1.0.0 (原始版本)
- ✅ 基本工作流程編輯功能
- ✅ 節點拖拽和連接
- ✅ 屬性編輯
- ❌ 代碼結構混亂
- ❌ 難以維護

## 🤝 貢獻指南

### 代碼規範
- 使用 ESLint 和 Prettier
- 遵循 React 最佳實踐
- 添加適當的註釋和文檔

### 提交流程
1. Fork 項目
2. 創建功能分支
3. 提交更改
4. 創建 Pull Request

## 📞 支持

如有問題或建議，請聯繫開發團隊或提交 Issue。
