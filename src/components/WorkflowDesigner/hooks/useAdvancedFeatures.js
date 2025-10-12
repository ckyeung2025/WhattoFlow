import { useState, useCallback, useRef } from 'react';

// 高級功能 Hook - 處理多選、對齊、複製貼上等功能
export const useAdvancedFeatures = (nodes, setNodes, edges, setEdges, selectedNodes, setSelectedNodes) => {
  // 複製狀態
  const [copiedNodes, setCopiedNodes] = useState([]);
  
  // 多選移動狀態
  const [dragStartPosition, setDragStartPosition] = useState(null);
  const [initialNodePositions, setInitialNodePositions] = useState({});
  
  // 複製節點功能
  const copyNodes = useCallback(() => {
    if (selectedNodes.length === 0) return;
    
    const nodesToCopy = nodes.filter(node => selectedNodes.includes(node.id));
    setCopiedNodes(nodesToCopy);
    console.log('已複製節點:', nodesToCopy.length);
  }, [selectedNodes, nodes]);

  // 貼上節點功能
  const pasteNodes = useCallback(() => {
    if (copiedNodes.length === 0) return;
    
    const newNodes = copiedNodes.map((node, index) => {
      const newId = `${node.id}_copy_${Date.now()}_${index}`;
      return {
        ...node,
        id: newId,
        position: {
          x: node.position.x + 50 + (index * 20),
          y: node.position.y + 50 + (index * 20)
        },
        selected: false,
        data: {
          ...node.data,
          // 清除一些不應該複製的屬性
          onDelete: node.data.type !== 'start' ? (id) => {
            setNodes(nds => nds.filter(n => n.id !== id));
          } : null
        }
      };
    });
    
    setNodes(nds => [...nds, ...newNodes]);
    setSelectedNodes(newNodes.map(n => n.id));
    console.log('已貼上節點:', newNodes.length);
  }, [copiedNodes, setNodes]);

  // 對齊節點功能
  const alignNodes = useCallback((alignment) => {
    console.log('alignNodes called:', { 
      alignment, 
      selectedNodesCount: selectedNodes.length, 
      selectedNodes: selectedNodes,
      totalNodesCount: nodes.length 
    });
    
    if (selectedNodes.length < 2) {
      console.log('Not enough selected nodes for alignment:', selectedNodes.length);
      return;
    }
    
    const nodesToAlign = nodes.filter(node => selectedNodes.includes(node.id));
    console.log('Nodes to align with dimensions:', nodesToAlign.map(n => ({ 
      id: n.id, 
      position: n.position, 
      width: n.data.width || 160, 
      height: n.data.height || 60 
    })));
    
    if (nodesToAlign.length < 2) {
      console.log('Not enough nodes found for alignment:', nodesToAlign.length);
      return;
    }
    
    let updatedNodes = [...nodes];
    
    switch (alignment) {
      case 'align-left':
        // 左對齊：所有節點的左邊緣對齊到最左邊節點的位置
        const leftMost = Math.min(...nodesToAlign.map(n => n.position.x));
        console.log('=== 左對齊開始 ===');
        console.log('Left alignment - leftmost position:', leftMost);
        nodesToAlign.forEach(node => {
          const index = updatedNodes.findIndex(n => n.id === node.id);
          if (index !== -1) {
            const oldX = node.position.x;
            console.log(`節點 ${node.id}: 舊位置 x=${oldX}, 新位置 x=${leftMost}, 差異=${leftMost - oldX}`);
            updatedNodes[index] = {
              ...updatedNodes[index],
              position: { ...updatedNodes[index].position, x: leftMost }
            };
          }
        });
        break;
        
      case 'align-center':
        // 居中對齊：所有節點的中軸線對齊到一條共同的垂直線
        console.log('=== 居中對齊開始 ===');
        const currentCenters = nodesToAlign.map(n => n.position.x + (n.data.width || 160) / 2);
        const leftMostCenter = Math.min(...currentCenters);
        const rightMostCenter = Math.max(...currentCenters);
        const targetCenterX = (leftMostCenter + rightMostCenter) / 2;
        console.log('當前中心點:', currentCenters);
        console.log('最左中心:', leftMostCenter, '最右中心:', rightMostCenter, '目標中心線:', targetCenterX);
        
        nodesToAlign.forEach(node => {
          const index = updatedNodes.findIndex(n => n.id === node.id);
          if (index !== -1) {
            const nodeWidth = node.data.width || 160;
            const oldX = node.position.x;
            const oldCenter = oldX + nodeWidth / 2;
            // 將節點的中軸線對齊到目標線：newX + width/2 = targetCenterX
            const newX = targetCenterX - nodeWidth / 2;
            console.log(`節點 ${node.id}: 寬度=${nodeWidth}, 舊位置=${oldX}, 舊中心=${oldCenter}, 新位置=${newX}, 新中心=${targetCenterX}, 移動距離=${newX - oldX}`);
            updatedNodes[index] = {
              ...updatedNodes[index],
              position: { ...updatedNodes[index].position, x: newX }
            };
          }
        });
        break;
        
      case 'align-right':
        // 右對齊：所有節點的右邊緣對齊到一條共同的垂直線
        console.log('=== 右對齊開始 ===');
        const rightEdges = nodesToAlign.map(n => n.position.x + (n.data.width || 160));
        const rightMostEdge = Math.max(...rightEdges);
        console.log('當前右邊緣:', rightEdges, '最右邊緣:', rightMostEdge);
        
        nodesToAlign.forEach(node => {
          const index = updatedNodes.findIndex(n => n.id === node.id);
          if (index !== -1) {
            const nodeWidth = node.data.width || 160;
            const oldX = node.position.x;
            const oldRightEdge = oldX + nodeWidth;
            // 將節點的右邊緣對齊到目標線：newX + width = rightMostEdge
            const newX = rightMostEdge - nodeWidth;
            console.log(`節點 ${node.id}: 寬度=${nodeWidth}, 舊位置=${oldX}, 舊右邊緣=${oldRightEdge}, 新位置=${newX}, 新右邊緣=${rightMostEdge}, 移動距離=${newX - oldX}`);
            updatedNodes[index] = {
              ...updatedNodes[index],
              position: { ...updatedNodes[index].position, x: newX }
            };
          }
        });
        break;
        
      case 'align-top':
        // 頂部對齊：所有節點的頂部對齊到最頂部節點的位置
        const topMost = Math.min(...nodesToAlign.map(n => n.position.y));
        console.log('Top alignment - topmost position:', topMost);
        nodesToAlign.forEach(node => {
          const index = updatedNodes.findIndex(n => n.id === node.id);
          if (index !== -1) {
            console.log(`Node ${node.id}: old y=${node.position.y}, new y=${topMost}`);
            updatedNodes[index] = {
              ...updatedNodes[index],
              position: { ...updatedNodes[index].position, y: topMost }
            };
          }
        });
        break;
        
      case 'align-middle':
        // 垂直居中：所有節點的中軸線對齊到一條共同的水平線
        // 計算所有節點當前中心點的平均位置作為目標中軸線
        const currentCentersY = nodesToAlign.map(n => n.position.y + (n.data.height || 60) / 2);
        const targetCenterY = currentCentersY.reduce((sum, center) => sum + center, 0) / currentCentersY.length;
        console.log('Middle alignment - current centers Y:', currentCentersY, 'target center line Y:', targetCenterY);
        
        nodesToAlign.forEach(node => {
          const index = updatedNodes.findIndex(n => n.id === node.id);
          if (index !== -1) {
            const nodeHeight = node.data.height || 60;
            // 將節點的中軸線對齊到目標線：newY + height/2 = targetCenterY
            const newY = targetCenterY - nodeHeight / 2;
            console.log(`Node ${node.id}: old center=${currentCentersY[nodesToAlign.indexOf(node)]}, new center=${targetCenterY}, height=${nodeHeight}, newY=${newY}`);
            updatedNodes[index] = {
              ...updatedNodes[index],
              position: { ...updatedNodes[index].position, y: newY }
            };
          }
        });
        break;
        
      case 'align-bottom':
        // 底部對齊：所有節點的底部邊緣對齊到一條共同的水平線
        // 計算所有節點當前底部邊緣的平均位置作為目標底部邊緣線
        const bottomEdges = nodesToAlign.map(n => n.position.y + (n.data.height || 60));
        const targetBottomEdge = bottomEdges.reduce((sum, edge) => sum + edge, 0) / bottomEdges.length;
        console.log('Bottom alignment - current bottom edges:', bottomEdges, 'target bottom edge line:', targetBottomEdge);
        
        nodesToAlign.forEach(node => {
          const index = updatedNodes.findIndex(n => n.id === node.id);
          if (index !== -1) {
            const nodeHeight = node.data.height || 60;
            // 將節點的底部邊緣對齊到目標線：newY + height = targetBottomEdge
            const newY = targetBottomEdge - nodeHeight;
            console.log(`Node ${node.id}: old bottom edge=${bottomEdges[nodesToAlign.indexOf(node)]}, new bottom edge=${targetBottomEdge}, height=${nodeHeight}, newY=${newY}`);
            updatedNodes[index] = {
              ...updatedNodes[index],
              position: { ...updatedNodes[index].position, y: newY }
            };
          }
        });
        break;
    }
    
    // 強制更新節點位置
    console.log('=== 對齊前後的節點位置對比 ===');
    nodesToAlign.forEach(node => {
      const oldNode = nodes.find(n => n.id === node.id);
      const newNode = updatedNodes.find(n => n.id === node.id);
      if (oldNode && newNode) {
        console.log(`節點 ${node.id}:`, {
          對齊前: { x: oldNode.position.x, y: oldNode.position.y },
          對齊後: { x: newNode.position.x, y: newNode.position.y },
          寬度: node.data.width || 160,
          高度: node.data.height || 60
        });
      }
    });
    
    // 強制更新節點位置
    console.log('=== 正在更新節點位置 ===');
    console.log('更新前的節點數量:', nodes.length);
    console.log('更新後的節點數量:', updatedNodes.length);
    
    // 使用強制更新
    setNodes([...updatedNodes]);
    
    // 驗證更新是否生效
    setTimeout(() => {
      console.log('=== 驗證更新結果 ===');
      console.log('已對齊節點:', alignment, '更新了', nodesToAlign.length, '個節點');
      
      // 檢查更新後的節點位置
      nodesToAlign.forEach(node => {
        const updatedNode = updatedNodes.find(n => n.id === node.id);
        if (updatedNode) {
          console.log(`驗證節點 ${node.id}: 位置已更新為 x=${updatedNode.position.x}, y=${updatedNode.position.y}`);
        }
      });
    }, 100);
  }, [selectedNodes, nodes, setNodes]);


  // 處理鍵盤事件
  const handleKeyDown = useCallback((event) => {
    // 檢查是否在輸入框、文本區域或可編輯元素中
    const target = event.target;
    const isInputElement = target.tagName === 'INPUT' || 
                          target.tagName === 'TEXTAREA' || 
                          target.contentEditable === 'true' ||
                          target.isContentEditable ||
                          // 檢查是否在 Ant Design 的輸入組件中
                          target.closest('.ant-input') ||
                          target.closest('.ant-input-affix-wrapper') ||
                          target.closest('.ant-select-selector') ||
                          target.closest('.ant-cascader-picker') ||
                          target.closest('.ant-picker') ||
                          target.closest('.ant-mentions') ||
                          target.closest('.ant-upload');
    
    // 如果在輸入元素中，不攔截 Ctrl+C 和 Ctrl+V
    if (isInputElement && (event.key === 'c' || event.key === 'v')) {
      return; // 讓瀏覽器處理複製/貼上
    }
    
    if (event.ctrlKey || event.metaKey) {
      switch (event.key) {
        case 'c':
          event.preventDefault();
          copyNodes();
          break;
        case 'v':
          event.preventDefault();
          pasteNodes();
          break;
      }
    }
    
    if (event.key === 'Delete' || event.key === 'Backspace') {
      if (selectedNodes.length > 0) {
        event.preventDefault();
        // 刪除選中的節點（除了 start 節點）
        const nodesToDelete = selectedNodes.filter(id => {
          const node = nodes.find(n => n.id === id);
          return node && node.data.type !== 'start';
        });
        
        if (nodesToDelete.length > 0) {
          // 刪除節點
          setNodes(nds => nds.filter(n => !nodesToDelete.includes(n.id)));
          
          // 同時刪除所有連接到這些節點的 edges
          setEdges(eds => eds.filter(e => !nodesToDelete.includes(e.source) && !nodesToDelete.includes(e.target)));
          
          setSelectedNodes([]);
          console.log('已刪除節點:', nodesToDelete.length);
        }
      }
    }
  }, [selectedNodes, nodes, setNodes, setEdges, copyNodes, pasteNodes]);

  return {
    copyNodes,
    pasteNodes,
    alignNodes,
    handleKeyDown,
  };
};
