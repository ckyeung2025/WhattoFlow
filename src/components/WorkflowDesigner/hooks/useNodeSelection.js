import { useState, useCallback, useMemo } from 'react';

// 節點選中狀態管理 Hook
export const useNodeSelection = () => {
  const [selectedNodes, setSelectedNodes] = useState([]);

  // 檢查節點是否被選中
  const isNodeSelected = useCallback((nodeId) => {
    return selectedNodes.includes(nodeId);
  }, [selectedNodes]);

  // 處理節點選擇（讓 React Flow 處理多選邏輯）
  const handleNodeSelect = useCallback((event, node) => {
    console.log('useNodeSelection handleNodeSelect called:', { 
      nodeId: node.id, 
      eventType: event.type,
      ctrlKey: event.ctrlKey || event.metaKey
    });
    
    // 不處理選擇邏輯，讓 React Flow 的原生選擇和 onSelectionChange 處理
    // 這裡只做日誌記錄，實際選擇狀態由 handleSelectionChange 同步
  }, []);

  // 處理畫布點擊（清除選擇）
  const handleCanvasClick = useCallback(() => {
    setSelectedNodes([]);
  }, []);

  // 清除所有選擇
  const clearSelection = useCallback(() => {
    setSelectedNodes([]);
  }, []);

  // 選中所有節點（除了 start 節點）
  const selectAllNodes = useCallback((nodes) => {
    const allNodeIds = nodes.filter(n => n.data.type !== 'start').map(n => n.id);
    setSelectedNodes(allNodeIds);
  }, []);

  // 處理 React Flow 的選擇變化事件
  const handleSelectionChange = useCallback(({ nodes: selectedNodeObjects }) => {
    console.log('React Flow selection changed:', selectedNodeObjects.map(n => ({ id: n.id, selected: n.selected })));
    const selectedNodeIds = selectedNodeObjects.map(node => node.id);
    console.log('Setting selectedNodes to:', selectedNodeIds, 'count:', selectedNodeIds.length);
    
    // 添加延遲來確保狀態更新完成
    setTimeout(() => {
      console.log('selectedNodes state after update:', selectedNodeIds);
    }, 0);
    
    setSelectedNodes(selectedNodeIds);
  }, []);

  // 同步選擇狀態到 React Flow（用於程序化選擇）
  const syncSelectionToReactFlow = useCallback((reactFlowInstance, nodeIds) => {
    if (!reactFlowInstance) return;
    
    // 獲取所有節點
    const allNodes = reactFlowInstance.getNodes();
    
    // 更新節點的選中狀態
    const updatedNodes = allNodes.map(node => ({
      ...node,
      selected: nodeIds.includes(node.id)
    }));
    
    // 應用更新
    reactFlowInstance.setNodes(updatedNodes);
  }, []);

  return {
    selectedNodes,
    setSelectedNodes,
    isNodeSelected,
    handleNodeSelect,
    handleCanvasClick,
    clearSelection,
    selectAllNodes,
    handleSelectionChange,
    syncSelectionToReactFlow
  };
};
