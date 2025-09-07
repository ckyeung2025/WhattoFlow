// 工作流程設計器樣式定義
export const purpleButtonStyle = `
  .purple-back-button:hover {
    background-color: #8c4dd4 !important;
    border-color: #8c4dd4 !important;
  }
  
  /* 確保 React Flow 容器填滿父容器高度 */
  .react-flow {
    height: 100% !important;
    width: 100% !important;
  }
  
  .react-flow__pane,
  .react-flow__container {
    height: 100% !important;
    width: 100% !important;
  }
  
  .react-flow__viewport {
    height: 100% !important;
    width: 100% !important;
  }
  
  .react-flow__background {
    height: 100% !important;
    width: 100% !important;
  }
  
  /* 確保主容器填滿 main-content-panel */
  .main-content-panel {
    height: 100% !important;
    display: flex !important;
    flex-direction: column !important;
  }
  
  .main-content-panel > div {
    height: 100% !important;
    display: flex !important;
    flex-direction: column !important;
  }
  
  /* 設置 React Flow 連結字體顏色為 #FAFBFC */
  .react-flow__controls-attribution a,
  .react-flow__controls a[href*="reactflow"],
  .react-flow__controls a[href*="reactflow.dev"] {
    color: #FAFBFC !important;
  }
  
  /* 改善連接線的可點擊性和視覺效果 */
  .react-flow__edge-path {
    stroke-width: 3px !important;
    cursor: pointer !important;
    transition: stroke-width 0.2s ease, stroke 0.2s ease !important;
  }
  
  .react-flow__edge-path:hover {
    stroke-width: 5px !important;
    stroke: #1890ff !important;
  }
  
  .react-flow__edge.selected .react-flow__edge-path {
    stroke: #ff4d4f !important;
    stroke-width: 4px !important;
  }
  
  /* 增加連接線的可見性 */
  .react-flow__edge {
    pointer-events: all !important;
  }
  
  /* 連接線標籤樣式 */
  .react-flow__edge-text {
    font-size: 12px !important;
    font-weight: bold !important;
    fill: #333 !important;
  }
  
  /* 箭頭樣式 - 使用 React Flow 內建箭頭 */
  .react-flow__edge-marker {
    fill: #b1b1b7 !important;
  }
  
  .react-flow__edge:hover .react-flow__edge-marker {
    fill: #1890ff !important;
  }
  
  .react-flow__edge.selected .react-flow__edge-marker {
    fill: #ff4d4f !important;
  }
  
  /* 連接點樣式優化 */
  .react-flow__handle {
    transition: all 0.2s ease !important;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2) !important;
  }
  
  .react-flow__handle:hover {
    transform: scale(1.2) !important;
    box-shadow: 0 4px 8px rgba(0,0,0,0.3) !important;
  }
  
  /* 連接點連接時的視覺反饋 */
  .react-flow__handle.connecting {
    background: #52c41a !important;
    border-color: #52c41a !important;
    transform: scale(1.3) !important;
  }
  
  /* 節點懸停時的連接點高亮 */
  .custom-node:hover .react-flow__handle {
    opacity: 1 !important;
  }
  
  /* 連接點脈衝動畫效果 */
  @keyframes pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.1); }
    100% { transform: scale(1); }
  }
  
  .react-flow__handle.connecting {
    animation: pulse 0.6s ease-in-out !important;
  }
  
  /* 移除 ReactFlow 預設的節點外框 */
  .react-flow__node {
    border: none !important;
    background: transparent !important;
    box-shadow: none !important;
    outline: none !important;
  }
  
  .react-flow__node:focus {
    outline: none !important;
  }
  
  .react-flow__node:focus-visible {
    outline: none !important;
  }
  
  /* 統一的刪除按鈕樣式 */
  .delete-button {
    box-shadow: 0 2px 8px rgba(0,0,0,0.3) !important;
    border: 2px solid #fff !important;
    background-color: #ff4d4f !important;
    color: #fff !important;
    font-weight: bold !important;
    border-radius: 4px !important;
    padding: 4px 8px !important;
    font-size: 12px !important;
    transition: all 0.2s ease !important;
  }
  
  .delete-button:hover {
    background-color: #ff7875 !important;
    transform: scale(1.05) !important;
    box-shadow: 0 4px 12px rgba(0,0,0,0.4) !important;
  }
  
  .delete-button:active {
    transform: scale(0.95) !important;
  }
`;
