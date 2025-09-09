import React, { useEffect } from 'react';
import { ReactFlow, MiniMap, Controls, Background } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Button, Tooltip } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';

// 定義空的 edgeTypes 對象，避免每次渲染重新創建
const emptyEdgeTypes = {};

// React Flow 畫布組件
const WorkflowCanvas = ({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onDrop,
  onDragOver,
  onNodeClick,
  onNodeDoubleClick,
  onEdgeClick,
  onEdgeMouseEnter,
  onEdgeMouseLeave,
  nodeTypes,
  nodeTypesComponents,
  edgeTypes,
  onEdgeSwitch,
  onMove,
  handleInit,
  selectedEdge,
  hoveredEdge,
  nodes: allNodes,
  onEdgeDelete,
  reactFlowInstanceRef,
  onNodeSelect,
  onCanvasClick,
  onKeyDown,
  onSelectionChange,
  t
}) => {
  // 添加鍵盤事件監聽
  useEffect(() => {
    const handleKeyDown = (event) => {
      onKeyDown(event);
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onKeyDown]);


  // 包裝節點點擊處理
  const handleNodeClick = (event, node) => {
    console.log('WorkflowCanvas handleNodeClick called:', { 
      nodeId: node.id, 
      hasOnNodeSelect: !!onNodeSelect,
      hasOnNodeClick: !!onNodeClick,
      eventType: event.type,
      ctrlKey: event.ctrlKey || event.metaKey
    });
    
    // 調用 onNodeClick 來處理其他邏輯（如設置 selectedNode）
    if (onNodeClick) {
      onNodeClick(event, node);
    }
    
    // 調用 onNodeSelect 來記錄事件（但不處理選擇邏輯）
    if (onNodeSelect) {
      onNodeSelect(event, node);
    }
  };

  // 包裝節點雙擊處理
  const handleNodeDoubleClick = (event, node) => {
    console.log('WorkflowCanvas handleNodeDoubleClick called:', { 
      nodeId: node.id, 
      hasOnNodeDoubleClick: !!onNodeDoubleClick,
      eventType: event.type
    });
    
    if (onNodeDoubleClick) {
      onNodeDoubleClick(event, node);
    }
  };

  // 處理畫布右鍵點擊 - 觸發 fit view
  const handlePaneContextMenu = (event) => {
    event.preventDefault();
    if (reactFlowInstanceRef?.current) {
      reactFlowInstanceRef.current.fitView({ padding: 0.1 });
    }
  };


  return (
    <div style={{ flex: 1, position: 'relative' }}>
      <ReactFlow
        onInit={handleInit}
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectStart={(event, { nodeId, handleId, handleType }) => {
          console.log('🚀 onConnectStart:', { nodeId, handleId, handleType });
        }}
        onConnectEnd={(event, { nodeId, handleId, handleType }) => {
          console.log('🏁 onConnectEnd:', { nodeId, handleId, handleType });
        }}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeClick={handleNodeClick}
        onNodeDoubleClick={handleNodeDoubleClick}
        onPaneClick={onCanvasClick}
        onPaneContextMenu={handlePaneContextMenu}
        onEdgeClick={onEdgeClick}
        onEdgeMouseEnter={onEdgeMouseEnter}
        onEdgeMouseLeave={onEdgeMouseLeave}
        nodeTypes={nodeTypesComponents}
        edgeTypes={edgeTypes || emptyEdgeTypes}
        style={{ height: '100%', width: '100%' }}
        onMove={onMove}
        selectionOnDrag={false}
        panOnDrag={[0]}
        selectionMode="partial"
        selectionKeyCode="Shift"
        multiSelectionKeyCode="Control"
        onSelectionChange={onSelectionChange}
        panOnScroll={false}
        zoomOnScroll={true}
        zoomOnPinch={true}
        zoomActivationKeyCode={null}
        zoomOnDoubleClick={false}
        onDoubleClick={(e) => {
          // 明確阻止雙擊縮放
          e.preventDefault();
          e.stopPropagation();
        }}
        nodesDraggable={true}
        nodesConnectable={true}
        elementsSelectable={true}
        preventScrolling={false}
        defaultEdgeOptions={{
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
        }}
      >
        <MiniMap />
        <Controls />
        <Background />
        
        {/* 選中連接線的刪除按鈕 */}
        {selectedEdge && (() => {
          const sourceNode = allNodes.find(n => n.id === selectedEdge.source);
          const targetNode = allNodes.find(n => n.id === selectedEdge.target);
          if (!sourceNode || !targetNode) return null;
          
          // 獲取 React Flow 實例
          const reactFlowInstance = reactFlowInstanceRef?.current;
          if (!reactFlowInstance) return null;
          
          // 獲取視圖的變換信息
          const viewport = reactFlowInstance.getViewport();
          
          // 計算節點在視圖中的實際位置（考慮節點大小）
          const sourceX = (sourceNode.position.x * viewport.zoom) + viewport.x + (120 * viewport.zoom / 2); // 節點寬度的一半
          const sourceY = (sourceNode.position.y * viewport.zoom) + viewport.y + (40 * viewport.zoom / 2); // 節點高度的一半
          const targetX = (targetNode.position.x * viewport.zoom) + viewport.x + (120 * viewport.zoom / 2);
          const targetY = (targetNode.position.y * viewport.zoom) + viewport.y + (40 * viewport.zoom / 2);
          
          // 計算連接線中點
          const centerX = (sourceX + targetX) / 2;
          const centerY = (sourceY + targetY) / 2;
          
          return (
            <div
              style={{
                position: 'absolute',
                left: centerX - 30,
                top: centerY - 15,
                zIndex: 1000,
                pointerEvents: 'auto',
                transform: 'translate(-50%, -50%)'
              }}
            >
              <Tooltip title={t('workflowDesigner.delete')} placement="top">
                <Button
                  danger
                  size="small"
                  onClick={() => onEdgeDelete(selectedEdge.id)}
                  icon={<DeleteOutlined />}
                  style={{
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                    border: '2px solid #fff',
                    backgroundColor: '#ff4d4f',
                    color: '#fff',
                    fontWeight: 'bold',
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0'
                  }}
                />
              </Tooltip>
            </div>
          );
        })()}
        
        {/* 懸停提示 */}
        {hoveredEdge && !selectedEdge && (() => {
          const sourceNode = allNodes.find(n => n.id === hoveredEdge.source);
          const targetNode = allNodes.find(n => n.id === hoveredEdge.target);
          if (!sourceNode || !targetNode) return null;
          
          // 獲取 React Flow 實例
          const reactFlowInstance = reactFlowInstanceRef?.current;
          if (!reactFlowInstance) return null;
          
          // 獲取視圖的變換信息
          const viewport = reactFlowInstance.getViewport();
          
          // 計算節點在視圖中的實際位置（考慮節點大小）
          const sourceX = (sourceNode.position.x * viewport.zoom) + viewport.x + (120 * viewport.zoom / 2);
          const sourceY = (sourceNode.position.y * viewport.zoom) + viewport.y + (40 * viewport.zoom / 2);
          const targetX = (targetNode.position.x * viewport.zoom) + viewport.x + (120 * viewport.zoom / 2);
          const targetY = (targetNode.position.y * viewport.zoom) + viewport.y + (40 * viewport.zoom / 2);
          
          // 計算連接線中點
          const centerX = (sourceX + targetX) / 2;
          const centerY = (sourceY + targetY) / 2;
          
          return (
            <div
              style={{
                position: 'absolute',
                left: centerX - 40,
                top: centerY - 20,
                zIndex: 999,
                pointerEvents: 'none',
                transform: 'translate(-50%, -50%)'
              }}
            >
              <div
                style={{
                  backgroundColor: 'rgba(0,0,0,0.8)',
                  color: '#fff',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                }}
              >
                {t('workflowDesigner.clickToSelectConnection')}
              </div>
            </div>
          );
        })()}
      </ReactFlow>
    </div>
  );
};

export default WorkflowCanvas;
