# 節點選中功能實現說明

## 功能概述

實現了 React Flow 節點的選中效果，支援單選和多選功能，參考 React Flow 官方方法。

## 實現的功能

### 1. 單擊選中
- **操作**: 點擊節點
- **效果**: 節點會顯示選中狀態的視覺效果
- **視覺效果**:
  - 藍色外框 (`outline: 2px solid #1890ff`)
  - 增強陰影效果
  - 平滑過渡動畫

### 2. 多選功能
- **操作**: 按住 `Ctrl` 鍵 + 點擊節點
- **效果**: 可以同時選中多個節點
- **支援**: 所有節點類型（除了 Start 節點）

### 3. 選中狀態管理
- **清除選擇**: 點擊空白區域清除所有選擇
- **全選**: 使用 `Ctrl+A` 選中所有節點
- **取消選擇**: 再次點擊已選中的節點可以取消選擇

## 技術實現

### 文件結構
```
src/components/WorkflowDesigner/
├── hooks/
│   ├── useNodeSelection.js      # 節點選中狀態管理
│   ├── useAdvancedFeatures.js   # 高級功能（複製貼上等）
│   └── useWorkflowState.js      # 工作流程狀態（更新支援選中）
└── WhatsAppWorkflowDesigner.js  # 主組件整合
```

### 核心組件

#### useNodeSelection Hook
```javascript
const {
  selectedNodes,        // 選中的節點 ID 數組
  setSelectedNodes,     // 設置選中節點
  isNodeSelected,       // 檢查節點是否被選中
  handleNodeSelect,     // 處理節點選擇事件
  handleCanvasClick,    // 處理畫布點擊（清除選擇）
  clearSelection,       // 清除所有選擇
  selectAllNodes        // 選中所有節點
} = useNodeSelection();
```

#### 節點選中視覺效果
```javascript
// 選中狀態的樣式
{
  boxShadow: selected || isMultiSelected ? '0 0 8px #52c41a88' : '0 1px 4px #0001',
  border: selected || isMultiSelected ? '2px solid #52c41a' : '2px solid #52c41a',
  outline: selected || isMultiSelected ? '2px solid #1890ff' : 'none',
  outlineOffset: selected || isMultiSelected ? '2px' : '0px',
  transition: 'box-shadow 0.2s'
}
```

## 使用方式

### 基本操作
1. **單選節點**: 直接點擊節點
2. **多選節點**: 按住 `Ctrl` 鍵並點擊多個節點
3. **取消選擇**: 再次點擊已選中的節點
4. **清除選擇**: 點擊空白區域
5. **全選節點**: 按 `Ctrl+A`

### 與其他功能的整合
- **複製貼上**: 選中節點後可以使用複製貼上功能
- **對齊功能**: 選中多個節點後可以使用對齊功能
- **刪除節點**: 選中節點後按 `Delete` 鍵刪除

## 視覺效果說明

### 選中狀態指示
- **外框**: 藍色 2px 外框 (`#1890ff`)
- **陰影**: 增強陰影效果，顏色根據節點類型變化
- **過渡**: 平滑的 0.2s 過渡動畫

### 節點類型顏色
- **Start 節點**: 綠色 (`#52c41a`)
- **End 節點**: 紅色 (`#ff4d4f`) 
- **其他節點**: 藍色 (`#1890ff`)

## 注意事項

1. **Start 節點**: 不能被選中或刪除
2. **性能優化**: 使用 `useCallback` 和 `useMemo` 優化性能
3. **狀態同步**: 選中狀態與 React Flow 的內建選中狀態同步
4. **鍵盤支援**: 完全支援鍵盤操作
5. **響應式**: 支援不同螢幕尺寸

## 擴展性

這個實現為後續功能提供了良好的基礎：
- 批量操作（複製、貼上、刪除）
- 節點對齊功能
- 節點分組功能
- 拖拽多選功能

所有功能都遵循 React Flow 官方最佳實踐，確保與 React Flow 生態系統的兼容性。
