import React, { useState, useMemo, useRef, useCallback } from 'react';
import { useNodesState, useEdgesState, Handle, Position } from '@xyflow/react';
import { Form, Tooltip } from 'antd';
import { useLanguage } from '../../../contexts/LanguageContext';
import { 
  PlayCircleOutlined, 
  SendOutlined, 
  MessageOutlined, 
  ClockCircleOutlined, 
  CheckCircleOutlined, 
  DatabaseOutlined, 
  ApiOutlined, 
  FormOutlined, 
  StopOutlined,
  DeleteOutlined 
} from '@ant-design/icons';
import CommonHandle from '../components/CommonHandle';
import EdgeWithSwitch from '../components/EdgeWithSwitch';

// 工作流程狀態管理 Hook
export const useWorkflowState = (isNodeSelected) => {
  const { t, isReady } = useLanguage();
  const [form] = Form.useForm();
  
  // 全局拖拽處理函數引用
  const [globalDragHandler, setGlobalDragHandler] = React.useState(null);
  
  // 在組件內部定義 initialNodes，這樣可以使用 t() 函數
  const initialNodes = useMemo(() => [
    {
      id: 'start',
      type: 'input',
      position: { x: 120, y: 200 },
      data: { 
        label: isReady ? t('workflowDesigner.defaultStartNode') : 'Start', 
        type: 'start',
        onDelete: null // Start 節點不能刪除
      },
      draggable: true,
    },
  ], [isReady, t]);
  
  // 在組件內部定義 nodeTypes，這樣可以使用 t() 函數
  const nodeTypes = useMemo(() => {
    if (!isReady) {
      return [
        { type: 'start', label: 'Start', icon: PlayCircleOutlined },
        { type: 'sendWhatsApp', label: 'Send WhatsApp Message', icon: SendOutlined },
        { type: 'sendWhatsAppTemplate', label: 'Send WhatsApp Template', icon: MessageOutlined },
        { type: 'waitReply', label: 'Wait for User Reply', icon: ClockCircleOutlined },
        { type: 'waitForQRCode', label: 'Wait for QR Code', icon: ClockCircleOutlined },
        { type: 'switch', label: 'Switch', icon: CheckCircleOutlined },
        { type: 'dbQuery', label: 'Database Query/Update', icon: DatabaseOutlined },
        { type: 'callApi', label: 'Trigger External API', icon: ApiOutlined },
        { type: 'sendEForm', label: 'Send eForm', icon: FormOutlined },
        { type: 'end', label: 'End', icon: StopOutlined },
      ];
    }
    
    return [
      { type: 'start', label: t('workflowDesigner.startNode'), icon: PlayCircleOutlined },
      { type: 'sendWhatsApp', label: t('workflowDesigner.sendMessageNode'), icon: SendOutlined },
      { type: 'sendWhatsAppTemplate', label: t('workflowDesigner.sendTemplateNode'), icon: MessageOutlined },
      { type: 'waitReply', label: t('workflowDesigner.waitReplyNode'), icon: ClockCircleOutlined },
      { type: 'waitForQRCode', label: t('workflowDesigner.waitForQRCodeNode'), icon: ClockCircleOutlined },
      { type: 'switch', label: t('workflowDesigner.switchNode'), icon: CheckCircleOutlined },
      { type: 'dbQuery', label: t('workflowDesigner.dbQueryNode'), icon: DatabaseOutlined },
      { type: 'callApi', label: t('workflowDesigner.webhookNode'), icon: ApiOutlined },
      { type: 'sendEForm', label: t('workflowDesigner.formNode'), icon: FormOutlined },
      { type: 'end', label: t('workflowDesigner.endNode'), icon: StopOutlined },
    ];
  }, [isReady, t]);

  // 雙擊節點打開屬性編輯抽屜

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  
  // 初始化節點的 handle 層級狀態
  const initializeHandleLayers = useCallback((nodeId) => {
    setNodes(nodes => nodes.map(node => {
      if (node.id === nodeId) {
        return {
          ...node,
          data: {
            ...node.data,
            handleLayers: {
              top: 'target',    // 默認 target 在上層
              right: 'source',  // 默認 source 在上層
              bottom: 'source', // 默認 source 在上層
              left: 'target'    // 默認 target 在上層
            }
          }
        };
      }
      return node;
    }));
  }, [setNodes]);
  
  // Handle 映射表 - 根據位置和類型找到對應的 handle
  // 現在每個面都有 source 和 target handle，可以直接映射
  const getHandleMapping = useCallback((position, type) => {
    const mapping = {
      'top': {
        'source': 'top-source',
        'target': 'top-target'
      },
      'right': {
        'source': 'right-source', 
        'target': 'right-target'
      },
      'bottom': {
        'source': 'bottom-source',
        'target': 'bottom-target'
      },
      'left': {
        'source': 'left-source',
        'target': 'left-target'
      }
    };
    
    return mapping[position]?.[type] || null;
  }, []);

  // 根據 handle ID 獲取位置和類型
  const getHandleInfo = useCallback((handleId) => {
    if (handleId.includes('top-')) return { position: 'top', type: handleId.split('-')[1] };
    if (handleId.includes('right-')) return { position: 'right', type: handleId.split('-')[1] };
    if (handleId.includes('bottom-')) return { position: 'bottom', type: handleId.split('-')[1] };
    if (handleId.includes('left-')) return { position: 'left', type: handleId.split('-')[1] };
    return null;
  }, []);

  // Edge 方向切換處理函數
  const handleEdgeSwitch = useCallback((edgeId) => {
    setEdges(edges => edges.map(edge => {
      if (edge.id === edgeId) {
        // 獲取原始 handle 的位置信息
        const sourceHandleInfo = getHandleInfo(edge.sourceHandle);
        const targetHandleInfo = getHandleInfo(edge.targetHandle);
        
        if (!sourceHandleInfo || !targetHandleInfo) {
          console.error('❌ Cannot determine handle info for edge switching');
          return edge;
        }
        
        // 交換 source 和 target，並在同一面找到對應的 handle
        // 如果原本是 right-source → right-target，切換後應該是 right-target → right-source
        const newSourceHandle = getHandleMapping(targetHandleInfo.position, 'source');
        const newTargetHandle = getHandleMapping(sourceHandleInfo.position, 'target');
        
         if (!newSourceHandle || !newTargetHandle) {
           console.error('❌ Cannot find corresponding handles for edge switching');
           return edge;
         }
         
         // 更新節點的 handle 層級狀態 - 交換 z-index
         setNodes(nodes => nodes.map(node => {
           if (node.id === edge.source || node.id === edge.target) {
             const position = node.id === edge.source ? sourceHandleInfo.position : targetHandleInfo.position;
             const currentLayer = node.data.handleLayers?.[position];
             const newLayer = currentLayer === 'source' ? 'target' : 'source';
             
             return {
               ...node,
               data: {
                 ...node.data,
                 handleLayers: {
                   ...node.data.handleLayers,
                   [position]: newLayer
                 }
               }
             };
           }
           return node;
         }));
         
         const newEdge = {
           ...edge,
           source: edge.target,
           target: edge.source,
           sourceHandle: newSourceHandle,
           targetHandle: newTargetHandle,
           // 更新箭頭方向
           markerEnd: {
             ...edge.markerEnd,
             type: 'arrowclosed',
             width: 12,
             height: 12,
             color: '#1890ff'
           }
         };
         
         return newEdge;
      }
      return edge;
    }));
  }, [setEdges, getHandleMapping, getHandleInfo, nodes, setNodes]);

  // React Flow 節點類型組件定義 - 使用 useMemo 避免重新創建
  const nodeTypesComponents = useMemo(() => ({
    input: ({ id, data, selected }) => {
      const isMultiSelected = isNodeSelected ? isNodeSelected(id) : false;
      return (
      <div 
        style={{ 
          padding: '12px 16px', 
          border: '2px solid #52c41a', 
          borderRadius: '8px', 
          backgroundColor: '#f6ffed',
          width: data.width || 120,
          height: data.height || 60,
          minWidth: '120px',
          minHeight: '60px',
          textAlign: 'center',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: selected || isMultiSelected ? '0 0 8px #52c41a88' : '0 1px 4px #0001',
          border: selected || isMultiSelected ? '2px solid #52c41a' : '2px solid #52c41a',
          outline: selected || isMultiSelected ? '2px solid #1890ff' : 'none',
          outlineOffset: selected || isMultiSelected ? '2px' : '0px',
          transition: 'box-shadow 0.2s',
          cursor: 'move'
        }}
        onMouseDown={(e) => {
          // 讓 React Flow 處理拖拽，不阻止默認行為
          // 不要阻止事件傳播，讓雙擊事件能正常工作
        }}
        // 移除節點上的 onDoubleClick，讓 React Flow 處理
      >
         {data.icon && React.createElement(data.icon, { style: { fontSize: '18px', marginBottom: '4px' } })}
         <div style={{ fontSize: '12px', fontWeight: 'bold', lineHeight: '1.2' }}>{data.taskName || data.label}</div>
         
         {/* 左側 handles - 重疊在同一位置，使用 z-index 控制層級 */}
         <CommonHandle
           type="target"
           position={Position.Left}
           id="left-target"
           style={{ left: -7, top: '50%' }}
           t={t}
           nodeId={id}
           nodeData={data}
           zIndex={data.handleLayers?.left === 'target' ? 1001 : 1000}
         />
         <CommonHandle
           type="source"
           position={Position.Left}
           id="left-source"
           style={{ left: -7, top: '50%' }}
           t={t}
           nodeId={id}
           nodeData={data}
           zIndex={data.handleLayers?.left === 'source' ? 1001 : 1000}
         />
         
         {/* 右側 handles - 重疊在同一位置，使用 z-index 控制層級 */}
         <CommonHandle
           type="target"
           position={Position.Right}
           id="right-target"
           style={{ right: -7, top: '50%' }}
           t={t}
           nodeId={id}
           nodeData={data}
           zIndex={data.handleLayers?.right === 'target' ? 1001 : 1000}
         />
         <CommonHandle
           type="source"
           position={Position.Right}
           id="right-source"
           style={{ right: -7, top: '50%' }}
           t={t}
           nodeId={id}
           nodeData={data}
           zIndex={data.handleLayers?.right === 'source' ? 1001 : 1000}
         />
         
         {/* 底部 handles - 重疊在同一位置，使用 z-index 控制層級 */}
         <CommonHandle
           type="target"
           position={Position.Bottom}
           id="bottom-target"
           style={{ bottom: -7, left: '50%' }}
           t={t}
           nodeId={id}
           nodeData={data}
           zIndex={data.handleLayers?.bottom === 'target' ? 1001 : 1000}
         />
         <CommonHandle
           type="source"
           position={Position.Bottom}
           id="bottom-source"
           style={{ bottom: -7, left: '50%' }}
           t={t}
           nodeId={id}
           nodeData={data}
           zIndex={data.handleLayers?.bottom === 'source' ? 1001 : 1000}
         />
        
        {/* 移除 resize 手柄 */}
      </div>
      );
    },
     output: ({ id, data, selected }) => {
       const isMultiSelected = isNodeSelected ? isNodeSelected(id) : false;
       return (
       <div 
         style={{ 
           padding: '12px 16px', 
           border: '2px solid #ff4d4f', 
           borderRadius: '8px', 
           backgroundColor: '#fff2f0',
           width: data.width || 120,
           height: data.height || 60,
           minWidth: '120px',
           minHeight: '60px',
           textAlign: 'center',
           position: 'relative',
           display: 'flex',
           flexDirection: 'column',
           alignItems: 'center',
           justifyContent: 'center',
           boxShadow: selected || isMultiSelected ? '0 0 8px #ff4d4f88' : '0 1px 4px #0001',
           border: selected || isMultiSelected ? '2px solid #ff4d4f' : '2px solid #ff4d4f',
           outline: selected || isMultiSelected ? '2px solid #1890ff' : 'none',
           outlineOffset: selected || isMultiSelected ? '2px' : '0px',
           transition: 'box-shadow 0.2s',
           cursor: 'move'
         }}
         onMouseDown={(e) => {
           console.log('Node onMouseDown:', { nodeId: id, eventType: e.type });
           // 讓 React Flow 處理拖拽，不阻止默認行為
           // 不要阻止事件傳播，讓雙擊事件能正常工作
         }}
         // 移除節點上的 onDoubleClick，讓 React Flow 處理
       >
         {data.icon && React.createElement(data.icon, { style: { fontSize: '18px', marginBottom: '4px' } })}
         <div style={{ fontSize: '12px', fontWeight: 'bold', lineHeight: '1.2' }}>{data.taskName || data.label}</div>
         
         {/* 頂部 handles - 重疊在同一位置，使用 z-index 控制層級 */}
         <CommonHandle
           type="target"
           position={Position.Top}
           id="top-target"
           style={{ top: -7, left: '50%' }}
           t={t}
           nodeId={id}
           nodeData={data}
           zIndex={data.handleLayers?.top === 'target' ? 1001 : 1000}
         />
         <CommonHandle
           type="source"
           position={Position.Top}
           id="top-source"
           style={{ top: -7, left: '50%' }}
           t={t}
           nodeId={id}
           nodeData={data}
           zIndex={data.handleLayers?.top === 'source' ? 1001 : 1000}
         />
         
         {/* 左側 handles - 重疊在同一位置，使用 z-index 控制層級 */}
         <CommonHandle
           type="target"
           position={Position.Left}
           id="left-target"
           style={{ left: -7, top: '50%' }}
           t={t}
           nodeId={id}
           nodeData={data}
           zIndex={data.handleLayers?.left === 'target' ? 1001 : 1000}
         />
         <CommonHandle
           type="source"
           position={Position.Left}
           id="left-source"
           style={{ left: -7, top: '50%' }}
           t={t}
           nodeId={id}
           nodeData={data}
           zIndex={data.handleLayers?.left === 'source' ? 1001 : 1000}
         />
         
         {/* 右側 handles - 重疊在同一位置，使用 z-index 控制層級 */}
         <CommonHandle
           type="target"
           position={Position.Right}
           id="right-target"
           style={{ right: -7, top: '50%' }}
           t={t}
           nodeId={id}
           nodeData={data}
           zIndex={data.handleLayers?.right === 'target' ? 1001 : 1000}
         />
         <CommonHandle
           type="source"
           position={Position.Right}
           id="right-source"
           style={{ right: -7, top: '50%' }}
           t={t}
           nodeId={id}
           nodeData={data}
           zIndex={data.handleLayers?.right === 'source' ? 1001 : 1000}
         />
        
        {selected && (
          <Tooltip title={t('workflowDesigner.delete')} placement="top">
            <button 
              style={{ 
                position: 'absolute', 
                top: -8, 
                right: -8, 
                zIndex: 1000,
                background: '#ff4d4f',
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                width: 24,
                height: 24,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                padding: '0'
              }} 
              onClick={(e) => {
                e.stopPropagation();
                if (data.onDelete) {
                  data.onDelete(id);
                }
              }}
            >
              <DeleteOutlined style={{ fontSize: '12px' }} />
            </button>
          </Tooltip>
        )}
        
        {/* 移除 resize 手柄 */}
      </div>
      );
    },
    default: ({ id, data, selected }) => {
      const isMultiSelected = isNodeSelected ? isNodeSelected(id) : false;
      return (
      <div 
        style={{ 
          padding: '12px 16px', 
          border: '2px solid #1890ff', 
          borderRadius: '8px', 
          backgroundColor: '#f0f9ff',
          width: data.width || 160,
          height: data.height || 60,
          minWidth: '160px',
          minHeight: '60px',
          textAlign: 'center',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: selected || isMultiSelected ? '0 0 8px #1890ff88' : '0 1px 4px #0001',
          border: selected || isMultiSelected ? '2px solid #1890ff' : '2px solid #1890ff',
          outline: selected || isMultiSelected ? '2px solid #1890ff' : 'none',
          outlineOffset: selected || isMultiSelected ? '2px' : '0px',
          transition: 'box-shadow 0.2s',
          cursor: 'move'
        }}
        onMouseDown={(e) => {
          // 讓 React Flow 處理拖拽，不阻止默認行為
          // 不要阻止事件傳播，讓雙擊事件能正常工作
        }}
        // 移除節點上的 onDoubleClick，讓 React Flow 處理
      >
         {data.icon && React.createElement(data.icon, { style: { fontSize: '18px', marginBottom: '4px' } })}
         <div style={{ fontSize: '12px', fontWeight: 'bold', lineHeight: '1.2' }}>{data.taskName || data.label}</div>
         
         {/* 頂部 handles - 重疊在同一位置，使用 z-index 控制層級 */}
         <CommonHandle
           type="target"
           position={Position.Top}
           id="top-target"
           style={{ top: -7, left: '50%' }}
           t={t}
           nodeId={id}
           nodeData={data}
           zIndex={data.handleLayers?.top === 'target' ? 1001 : 1000}
         />
         <CommonHandle
           type="source"
           position={Position.Top}
           id="top-source"
           style={{ top: -7, left: '50%' }}
           t={t}
           nodeId={id}
           nodeData={data}
           zIndex={data.handleLayers?.top === 'source' ? 1001 : 1000}
         />
         
         {/* 左側 handles - 重疊在同一位置，使用 z-index 控制層級 */}
         <CommonHandle
           type="target"
           position={Position.Left}
           id="left-target"
           style={{ left: -7, top: '50%' }}
           t={t}
           nodeId={id}
           nodeData={data}
           zIndex={data.handleLayers?.left === 'target' ? 1001 : 1000}
         />
         <CommonHandle
           type="source"
           position={Position.Left}
           id="left-source"
           style={{ left: -7, top: '50%' }}
           t={t}
           nodeId={id}
           nodeData={data}
           zIndex={data.handleLayers?.left === 'source' ? 1001 : 1000}
         />
         
         {/* 右側 handles - 重疊在同一位置，使用 z-index 控制層級 */}
         <CommonHandle
           type="target"
           position={Position.Right}
           id="right-target"
           style={{ right: -7, top: '50%' }}
           t={t}
           nodeId={id}
           nodeData={data}
           zIndex={data.handleLayers?.right === 'target' ? 1001 : 1000}
         />
         <CommonHandle
           type="source"
           position={Position.Right}
           id="right-source"
           style={{ right: -7, top: '50%' }}
           t={t}
           nodeId={id}
           nodeData={data}
           zIndex={data.handleLayers?.right === 'source' ? 1001 : 1000}
         />
         
         {/* 底部 handles - 重疊在同一位置，使用 z-index 控制層級 */}
         <CommonHandle
           type="target"
           position={Position.Bottom}
           id="bottom-target"
           style={{ bottom: -7, left: '50%' }}
           t={t}
           nodeId={id}
           nodeData={data}
           zIndex={data.handleLayers?.bottom === 'target' ? 1001 : 1000}
         />
         <CommonHandle
           type="source"
           position={Position.Bottom}
           id="bottom-source"
           style={{ bottom: -7, left: '50%' }}
           t={t}
           nodeId={id}
           nodeData={data}
           zIndex={data.handleLayers?.bottom === 'source' ? 1001 : 1000}
         />
        {selected && data.type !== 'start' && (
          <Tooltip title={t('workflowDesigner.delete')} placement="top">
            <button 
              style={{ 
                position: 'absolute', 
                top: -8, 
                right: -8, 
                zIndex: 1000,
                background: '#ff4d4f',
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                width: 24,
                height: 24,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                padding: '0'
              }} 
              onClick={(e) => {
                e.stopPropagation();
                if (data.onDelete) {
                  data.onDelete(id);
                }
              }}
            >
              <DeleteOutlined style={{ fontSize: '12px' }} />
            </button>
          </Tooltip>
        )}
        
        {/* 移除 resize 手柄 */}
      </div>
      );
    }
  }), [isNodeSelected, t]);

  // Edge 類型定義
  const edgeTypes = useMemo(() => ({
    default: EdgeWithSwitch,
    smoothstep: EdgeWithSwitch,
  }), []);
  
  // 選中狀態
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [hoveredEdge, setHoveredEdge] = useState(null);
  
  // 抽屜狀態
  const [drawerOpen, setDrawerOpen] = useState(false);
  
  // 工具欄狀態
  const [isToolbarCollapsed, setIsToolbarCollapsed] = useState(false);
  
  // 連接狀態
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStart, setConnectionStart] = useState(null);
  
  // React Flow 實例引用
  const reactFlowInstanceRef = useRef();
  
  // 節點類型標籤函數
  const nodeTypeLabel = useCallback((type) => nodeTypes.find(n => n.type === type)?.label || type, [nodeTypes]);
  
  // 工具欄收合切換
  const toggleToolbar = () => {
    setIsToolbarCollapsed(!isToolbarCollapsed);
  };
  
  // 處理節點數據變更
  const handleNodeDataChange = useCallback((newData) => {
    if (!selectedNode) return;
    
    const updatedNode = { ...selectedNode, data: { ...selectedNode.data, ...newData } };
    
    setNodes(nds => nds.map(node => 
      node.id === selectedNode.id 
        ? updatedNode
        : node
    ));
    
    // 更新 selectedNode 以反映最新的數據
    setSelectedNode(updatedNode);
  }, [selectedNode, setNodes, setSelectedNode]);
  
  // 單擊節點選擇節點（不打開屬性抽屜）
  const onNodeClick = (event, node) => {
    setSelectedNode(node);
    setSelectedEdge(null);
  };

  // 雙擊節點打開屬性編輯抽屜
  const onNodeDoubleClick = (event, node) => {
    setSelectedNode(node);
    setDrawerOpen(true);
    setSelectedEdge(null);
  };

  // 處理邊選擇
  const onEdgeClick = (event, edge) => {
    setSelectedEdge(edge);
  };
  
  // 邊的懸停處理
  const onEdgeMouseEnter = (event, edge) => {
    setHoveredEdge(edge);
  };

  const onEdgeMouseLeave = () => {
    setHoveredEdge(null);
  };
  
  // 監聽視圖變化，當用戶縮放或平移時清除選中的連接線
  const onMove = useCallback(() => {
    if (selectedEdge) {
      setSelectedEdge(null);
    }
  }, [selectedEdge]);
  
  // 初始化 React Flow
  const handleInit = (instance) => {
    reactFlowInstanceRef.current = instance;
    // 只在初始載入時自動 fitView
    if (instance && instance.getNodes().length === 1 && instance.getNodes()[0].id === 'start') {
      setTimeout(() => {
        instance.fitView({ padding: 0.1 });
      }, 100);
    }
  };
  
  return {
    // 狀態
    nodes,
    setNodes,
    onNodesChange,
    edges,
    setEdges,
    onEdgesChange,
    selectedNode,
    setSelectedNode,
    selectedEdge,
    setSelectedEdge,
    hoveredEdge,
    setHoveredEdge,
    drawerOpen,
    setDrawerOpen,
    isToolbarCollapsed,
    setIsToolbarCollapsed,
    isConnecting,
    setIsConnecting,
    connectionStart,
    setConnectionStart,
    reactFlowInstanceRef,
    form,
    
    // 計算值
    nodeTypes,
    nodeTypesComponents,
    nodeTypeLabel,
    
    // 處理函數
    handleNodeDataChange,
    onNodeClick,
    onNodeDoubleClick,
    onEdgeClick,
    onEdgeMouseEnter,
    onEdgeMouseLeave,
    onMove,
    handleInit,
    toggleToolbar,
    handleEdgeSwitch,
    edgeTypes,
    
    // 拖拽處理
    setGlobalDragHandler,
  };
};
