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
    console.log('Nodes to align:', nodesToAlign.map(n => ({ id: n.id, position: n.position })));
    
    if (nodesToAlign.length < 2) {
      console.log('Not enough nodes found for alignment:', nodesToAlign.length);
      return;
    }
    
    let updatedNodes = [...nodes];
    
    switch (alignment) {
      case 'align-left':
        const leftMost = Math.min(...nodesToAlign.map(n => n.position.x));
        nodesToAlign.forEach(node => {
          const index = updatedNodes.findIndex(n => n.id === node.id);
          if (index !== -1) {
            updatedNodes[index] = {
              ...updatedNodes[index],
              position: { ...updatedNodes[index].position, x: leftMost }
            };
          }
        });
        break;
        
      case 'align-center':
        const centerX = nodesToAlign.reduce((sum, n) => sum + n.position.x, 0) / nodesToAlign.length;
        nodesToAlign.forEach(node => {
          const index = updatedNodes.findIndex(n => n.id === node.id);
          if (index !== -1) {
            updatedNodes[index] = {
              ...updatedNodes[index],
              position: { ...updatedNodes[index].position, x: centerX }
            };
          }
        });
        break;
        
      case 'align-right':
        const rightMost = Math.max(...nodesToAlign.map(n => n.position.x));
        nodesToAlign.forEach(node => {
          const index = updatedNodes.findIndex(n => n.id === node.id);
          if (index !== -1) {
            updatedNodes[index] = {
              ...updatedNodes[index],
              position: { ...updatedNodes[index].position, x: rightMost }
            };
          }
        });
        break;
        
      case 'align-top':
        const topMost = Math.min(...nodesToAlign.map(n => n.position.y));
        nodesToAlign.forEach(node => {
          const index = updatedNodes.findIndex(n => n.id === node.id);
          if (index !== -1) {
            updatedNodes[index] = {
              ...updatedNodes[index],
              position: { ...updatedNodes[index].position, y: topMost }
            };
          }
        });
        break;
        
      case 'align-middle':
        const centerY = nodesToAlign.reduce((sum, n) => sum + n.position.y, 0) / nodesToAlign.length;
        nodesToAlign.forEach(node => {
          const index = updatedNodes.findIndex(n => n.id === node.id);
          if (index !== -1) {
            updatedNodes[index] = {
              ...updatedNodes[index],
              position: { ...updatedNodes[index].position, y: centerY }
            };
          }
        });
        break;
        
      case 'align-bottom':
        const bottomMost = Math.max(...nodesToAlign.map(n => n.position.y));
        nodesToAlign.forEach(node => {
          const index = updatedNodes.findIndex(n => n.id === node.id);
          if (index !== -1) {
            updatedNodes[index] = {
              ...updatedNodes[index],
              position: { ...updatedNodes[index].position, y: bottomMost }
            };
          }
        });
        break;
    }
    
    setNodes(updatedNodes);
    console.log('已對齊節點:', alignment, '更新了', nodesToAlign.length, '個節點');
  }, [selectedNodes, nodes, setNodes]);


  // 處理鍵盤事件
  const handleKeyDown = useCallback((event) => {
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
          setNodes(nds => nds.filter(n => !nodesToDelete.includes(n.id)));
          setSelectedNodes([]);
          console.log('已刪除節點:', nodesToDelete.length);
        }
      }
    }
  }, [selectedNodes, nodes, setNodes, copyNodes, pasteNodes]);

  return {
    copyNodes,
    pasteNodes,
    alignNodes,
    handleKeyDown,
  };
};
