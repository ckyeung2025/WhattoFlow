import React, { useState, useMemo, useRef, useCallback } from 'react';
import { useNodesState, useEdgesState, Handle, Position } from 'react-flow-renderer';
import { Form } from 'antd';
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
  StopOutlined 
} from '@ant-design/icons';

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
      draggable: false,
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
          overflow: 'hidden'
        }}
        onMouseDown={(e) => {
          console.log('Node onMouseDown:', { nodeId: id, eventType: e.type });
          // 簡化：讓 React Flow 處理拖拽
          if (globalDragHandler) {
            globalDragHandler(e, { id, data, selected });
          }
        }}
        // 移除 onDoubleClick，使用單擊直接打開屬性視窗
      >
        {data.icon && React.createElement(data.icon, { style: { fontSize: '18px', marginBottom: '4px' } })}
        <div style={{ fontSize: '12px', fontWeight: 'bold', lineHeight: '1.2' }}>{data.taskName || data.label}</div>
        <Handle
          type="source"
          position={Position.Bottom}
          id="bottom-source"
          style={{ 
            background: '#52c41a', 
            width: 14, 
            height: 14, 
            borderRadius: 7, 
            bottom: -7, 
            left: '50%', 
            opacity: 0.9, 
            border: '2px solid #fff',
            cursor: 'crosshair',
            transform: 'translateX(-50%)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
          }}
          title="Click to select connection"
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
          overflow: 'hidden'
        }}
        onMouseDown={(e) => {
          console.log('Node onMouseDown:', { nodeId: id, eventType: e.type });
          // 簡化：讓 React Flow 處理拖拽
          if (globalDragHandler) {
            globalDragHandler(e, { id, data, selected });
          }
        }}
        // 移除 onDoubleClick，使用單擊直接打開屬性視窗
      >
        {data.icon && React.createElement(data.icon, { style: { fontSize: '18px', marginBottom: '4px' } })}
        <div style={{ fontSize: '12px', fontWeight: 'bold', lineHeight: '1.2' }}>{data.taskName || data.label}</div>
        <Handle
          type="target"
          position={Position.Top}
          id="top-target"
          style={{ 
            background: '#ff4d4f', 
            width: 14, 
            height: 14, 
            borderRadius: 7, 
            top: -7, 
            left: '50%', 
            opacity: 0.9, 
            border: '2px solid #fff',
            cursor: 'crosshair',
            transform: 'translateX(-50%)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
          }}
          title="Click to select connection"
        />
        
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
          overflow: 'hidden'
        }}
        onMouseDown={(e) => {
          console.log('Node onMouseDown:', { nodeId: id, eventType: e.type });
          // 簡化：讓 React Flow 處理拖拽
          if (globalDragHandler) {
            globalDragHandler(e, { id, data, selected });
          }
        }}
        // 移除 onDoubleClick，使用單擊直接打開屬性視窗
      >
        {data.icon && React.createElement(data.icon, { style: { fontSize: '18px', marginBottom: '4px' } })}
        <div style={{ fontSize: '12px', fontWeight: 'bold', lineHeight: '1.2' }}>{data.taskName || data.label}</div>
        <Handle
          type="target"
          position={Position.Top}
          id="top-target"
          style={{ 
            background: '#faad14', 
            width: 14, 
            height: 14, 
            borderRadius: 7, 
            top: -7, 
            left: '50%', 
            opacity: 0.9, 
            border: '2px solid #fff',
            cursor: 'crosshair',
            transform: 'translateX(-50%)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
          }}
          title="Click to select connection"
        />
        <Handle
          type="source"
          position={Position.Bottom}
          id="bottom-source"
          style={{ 
            background: '#52c41a', 
            width: 14, 
            height: 14, 
            borderRadius: 7, 
            bottom: -7, 
            left: '50%', 
            opacity: 0.9, 
            border: '2px solid #fff',
            cursor: 'crosshair',
            transform: 'translateX(-50%)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
          }}
          title="Click to select connection"
        />
        {selected && data.type !== 'start' && (
          <button 
            style={{ 
              position: 'absolute', 
              top: 2, 
              right: 2, 
              zIndex: 2,
              background: '#ff4d4f',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '2px 6px',
              fontSize: '10px',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
            }} 
            onClick={(e) => {
              e.stopPropagation();
              if (data.onDelete) {
                data.onDelete(id);
              }
            }}
          >
            刪除
          </button>
        )}
        
        {/* 移除 resize 手柄 */}
      </div>
      );
    }
  }), [globalDragHandler]);
  
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  
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
  const handleNodeDataChange = (newData) => {
    if (!selectedNode) return;
    
    const updatedNode = { ...selectedNode, data: { ...selectedNode.data, ...newData } };
    
    setNodes(nds => nds.map(node => 
      node.id === selectedNode.id 
        ? updatedNode
        : node
    ));
    
    // 更新 selectedNode 以反映最新的數據
    setSelectedNode(updatedNode);
  };
  
  // 單擊節點選擇節點（不打開屬性抽屜）
  const onNodeClick = (event, node) => {
    console.log('useWorkflowState onNodeClick called:', { nodeId: node.id, nodeType: node.data.type });
    setSelectedNode(node);
    setSelectedEdge(null);
  };

  // 雙擊節點打開屬性編輯抽屜
  const onNodeDoubleClick = (event, node) => {
    console.log('useWorkflowState onNodeDoubleClick called:', { nodeId: node.id, nodeType: node.data.type });
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
    
    // 拖拽處理
    setGlobalDragHandler,
  };
};
