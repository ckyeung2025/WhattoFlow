import { useCallback } from 'react';
import { addEdge } from '@xyflow/react';
import { notification } from 'antd';

// 邊處理函數管理 Hook
export const useEdgeHandlers = (nodes, edges, setEdges, setSelectedEdge, setHoveredEdge, onEdgeSwitch) => {
  
  // 處理連接
  const onConnect = useCallback((params) => {
    console.log('🔗 onConnect called with params:', params);
    
    const sourceNode = nodes.find(n => n.id === params.source);
    const targetNode = nodes.find(n => n.id === params.target);
    
    console.log('🔍 Found nodes:', { 
      sourceNode: sourceNode ? { id: sourceNode.id, label: sourceNode.data.taskName || sourceNode.data.label } : null,
      targetNode: targetNode ? { id: targetNode.id, label: targetNode.data.taskName || targetNode.data.label } : null
    });
    
    console.log('🔍 Handle details:', {
      sourceHandle: params.sourceHandle,
      targetHandle: params.targetHandle,
      sourceHandleType: params.sourceHandleType,
      targetHandleType: params.targetHandleType
    });
    
    if (sourceNode && targetNode) {
      // 防止自連接
      if (params.source === params.target) {
        console.log('❌ Self-connection blocked');
        notification.warning({
          message: '不能連接節點到自己',
          duration: 3
        });
        return;
      }
      
      // 防止重複連接
      const existingEdge = edges.find(e => 
        e.source === params.source && e.target === params.target
      );
      if (existingEdge) {
        console.log('❌ Duplicate connection blocked:', existingEdge);
        notification.warning({
          message: '節點之間已經存在連接',
          duration: 3
        });
        return;
      }
      
      console.log('✅ Creating new edge...');
      
      // 添加動畫連接線
      setEdges((eds) => addEdge({
        ...params,
        type: 'smoothstep',
        animated: true,
        style: { 
          strokeWidth: 3,
          stroke: '#1890ff'
        },
        markerEnd: {
          type: 'arrowclosed',
          width: 12,
          height: 12,
          color: '#1890ff',
        },
        data: { onEdgeSwitch },
      }, eds));
      
      console.log(`✅ 連接成功: ${sourceNode.data.taskName || sourceNode.data.label} → ${targetNode.data.taskName || targetNode.data.label}`);
    } else {
      console.log('❌ Nodes not found for connection');
    }
  }, [nodes, edges, setEdges]);

  // 刪除連線
  const handleDeleteEdge = useCallback((edgeId) => {
    setEdges(eds => eds.filter(e => e.id !== edgeId));
    setSelectedEdge(null);
  }, [setEdges, setSelectedEdge]);

  // 處理連接線刪除
  const onEdgeDelete = useCallback((edgeId) => {
    setEdges(eds => eds.filter(e => e.id !== edgeId));
    setSelectedEdge(null);
  }, [setEdges, setSelectedEdge]);

  // 邊的懸停處理
  const onEdgeMouseEnter = useCallback((event, edge) => {
    setHoveredEdge(edge);
  }, [setHoveredEdge]);

  const onEdgeMouseLeave = useCallback(() => {
    setHoveredEdge(null);
  }, [setHoveredEdge]);

  // 監聽視圖變化，當用戶縮放或平移時清除選中的連接線
  const onMove = useCallback((selectedEdge) => {
    if (selectedEdge) {
      setSelectedEdge(null);
    }
  }, [setSelectedEdge]);

  return {
    onConnect,
    handleDeleteEdge,
    onEdgeDelete,
    onEdgeMouseEnter,
    onEdgeMouseLeave,
    onMove,
    onEdgeSwitch,
  };
};
