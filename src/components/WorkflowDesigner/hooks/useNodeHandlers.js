import { useCallback } from 'react';
import { message } from 'antd';
import { useNodeData } from './useNodeData';

// 節點處理函數管理 Hook
export const useNodeHandlers = (nodeTypes, setNodes, setSelectedNode, selectedNode, handleNodeDataChange, isReady, t) => {
  const { defaultNodeData } = useNodeData(isReady, t);
  
  // 刪除節點（Start 節點不可刪）
  const handleDeleteNode = useCallback((nodeId) => {
    setNodes(nds => nds.filter(n => n.id !== nodeId || n.data.type === 'start'));
    setSelectedNode(null);
  }, [setNodes, setSelectedNode]);

  // 修改添加節點函數以支持位置參數
  const handleAddNode = useCallback((nodeType, position = null) => {
    const nodeTypeConfig = nodeTypes.find(nt => nt.type === nodeType);
    if (!nodeTypeConfig) return;

    const defaultPosition = position || { x: Math.random() * 400 + 200, y: Math.random() * 300 + 100 };
    
    // 確定節點的 React Flow 類型
    let reactFlowType;
    if (nodeType === 'start') {
      reactFlowType = 'input';
    } else if (nodeType === 'end') {
      reactFlowType = 'output';
    } else {
      reactFlowType = 'default';
    }
    
    const newNode = {
      id: `${nodeType}_${Date.now()}`,
      type: reactFlowType,
      position: defaultPosition,
      data: {
        ...defaultNodeData(nodeType),
        type: nodeType,
        icon: nodeTypeConfig.icon,
        label: nodeTypeConfig.label,
        onDelete: handleDeleteNode
      }
    };

    setNodes(nds => [...nds, newNode]);
  }, [nodeTypes, setNodes, defaultNodeData]);

  // 拖放處理函數
  const onDragStart = useCallback((event, nodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  }, []);

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((event, reactFlowInstanceRef) => {
    event.preventDefault();
    const nodeType = event.dataTransfer.getData('application/reactflow');
    if (!nodeType) return;

    // 檢查 React Flow 實例是否存在
    if (!reactFlowInstanceRef.current) {
      console.error('React Flow 實例不存在');
      return;
    }

    // 獲取拖放位置
    let position;
    try {
      const flowInstance = reactFlowInstanceRef.current;
      
      // 調試信息
      console.log('React Flow 實例:', flowInstance);
      console.log('可用方法:', Object.getOwnPropertyNames(flowInstance));
      
      // 檢查 screenToFlowPosition 方法
      if (typeof flowInstance.screenToFlowPosition === 'function') {
        console.log('使用 screenToFlowPosition 方法');
        position = flowInstance.screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });
      } else if (typeof flowInstance.project === 'function') {
        console.log('使用 project 方法');
        position = flowInstance.project({
          x: event.clientX,
          y: event.clientY,
        });
      } else {
        console.warn('無法找到位置轉換方法，使用默認位置');
        // 計算相對位置
        const rect = event.currentTarget.getBoundingClientRect();
        position = {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top
        };
      }
      
      console.log('計算的位置:', position);
    } catch (error) {
      console.error('獲取拖放位置失敗:', error);
      // 如果失敗，使用默認位置
      position = { x: 100, y: 100 };
    }

    if (position) {
      handleAddNode(nodeType, position);
    }
  }, [handleAddNode]);

  // 處理模板選擇
  const handleSelectTemplate = useCallback((template) => {
    if (selectedNode) {
      handleNodeDataChange({
        templateId: template.id,
        templateName: template.name,
        templateDescription: template.description
      });
    }
  }, [selectedNode, handleNodeDataChange]);

  // 處理用戶選擇
  const handleSelectUser = useCallback((user) => {
    if (selectedNode) {
      handleNodeDataChange({
        to: user.phone,
        selectedUserName: user.name
      });
    }
  }, [selectedNode, handleNodeDataChange]);

  // 處理 EForm 選擇
  const handleSelectEForm = useCallback((eform) => {
    if (selectedNode) {
      handleNodeDataChange({
        formId: eform.id,
        formName: eform.name,
        formDescription: eform.description
      });
    }
  }, [selectedNode, handleNodeDataChange]);

  return {
    handleDeleteNode,
    handleAddNode,
    onDragStart,
    onDragOver,
    onDrop,
    handleSelectTemplate,
    handleSelectUser,
    handleSelectEForm,
  };
};
