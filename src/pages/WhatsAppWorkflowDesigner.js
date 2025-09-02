import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import ReactFlow, {
  MiniMap, Controls, Background, addEdge, useNodesState, useEdgesState, Handle, Position, useReactFlow, getBezierPath
} from 'react-flow-renderer';
import { Button, Drawer, Form, Input, Select, message, Tooltip, Modal, Card, Tag, Space, Typography } from 'antd';
import { SaveOutlined, ArrowLeftOutlined, MessageOutlined, SendOutlined, ClockCircleOutlined, DatabaseOutlined, ApiOutlined, FormOutlined, CheckCircleOutlined, StopOutlined, PlayCircleOutlined, UpOutlined } from '@ant-design/icons';
import { useSearchParams, useNavigate } from 'react-router-dom';

const { Title } = Typography;

// 添加紫色返回按鈕的 hover 樣式
const purpleButtonStyle = `
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
`;



const initialEdges = [];

const WhatsAppWorkflowDesigner = () => {
  const { t, isReady } = useLanguage(); // 使用專案的語言系統，並檢查是否準備好
  const [form] = Form.useForm(); // 添加表單實例
  
  // 在組件內部定義 initialNodes，這樣可以使用 t() 函數
  const initialNodes = useMemo(() => [
    {
      id: 'start',
      type: 'input',
      position: { x: 120, y: 200 },
      data: { label: isReady ? t('workflowDesigner.defaultStartNode') : 'Start', type: 'start' },
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
        { type: 'dbQuery', label: 'Database Query/Update', icon: DatabaseOutlined },
        { type: 'callApi', label: 'Trigger External API', icon: ApiOutlined },
        { type: 'sendEForm', label: 'Send eForm', icon: FormOutlined },
        { type: 'eFormResult', label: 'eForm Approved/Rejected', icon: CheckCircleOutlined },
        { type: 'end', label: 'End', icon: StopOutlined },
      ];
    }
    
    return [
      { type: 'start', label: t('workflowDesigner.startNode'), icon: PlayCircleOutlined },
      { type: 'sendWhatsApp', label: t('workflowDesigner.sendMessageNode'), icon: SendOutlined },
      { type: 'sendWhatsAppTemplate', label: t('workflowDesigner.sendTemplateNode'), icon: MessageOutlined },
      { type: 'waitReply', label: t('workflowDesigner.waitReplyNode'), icon: ClockCircleOutlined },
      { type: 'dbQuery', label: t('workflowDesigner.dbQueryNode'), icon: DatabaseOutlined },
      { type: 'callApi', label: t('workflowDesigner.webhookNode'), icon: ApiOutlined },
      { type: 'sendEForm', label: t('workflowDesigner.formNode'), icon: FormOutlined },
      { type: 'eFormResult', label: t('workflowDesigner.eFormResultNode'), icon: CheckCircleOutlined },
      { type: 'end', label: t('workflowDesigner.endNode'), icon: StopOutlined },
    ];
  }, [isReady, t]);
  
  // 調試語言系統 - 只在開發模式下輸出
  if (process.env.NODE_ENV === 'development') {
    console.log('WhatsAppWorkflowDesigner: 當前語言系統狀態');
    console.log('isReady:', isReady);
    console.log('t function available:', typeof t === 'function');
    console.log('startNode translation:', t('workflowDesigner.startNode'));
    console.log('nodeTypes:', nodeTypes);
    console.log('nodeTypes[0].label:', nodeTypes[0]?.label);
    console.log('nodeTypes[1].label:', nodeTypes[1]?.label);
    console.log('nodeTypes[2].label:', nodeTypes[2]?.label);
  }
  
  // 在組件內部定義 nodeTypeLabel 函數，這樣可以使用 nodeTypes
  const nodeTypeLabel = useCallback((type) => nodeTypes.find(n => n.type === type)?.label || type, [nodeTypes]);
  
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [searchParams] = useSearchParams();
  const workflowId = searchParams.get('id');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [createdAt, setCreatedAt] = useState('');
  const [updatedAt, setUpdatedAt] = useState('');
  const [createdBy, setCreatedBy] = useState('');
  const [updatedBy, setUpdatedBy] = useState('');
  const [status, setStatus] = useState('');
  const [templates, setTemplates] = useState([]);
  const [isTemplateModalVisible, setIsTemplateModalVisible] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [users, setUsers] = useState([]);
  const [isUserModalVisible, setIsUserModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [hoveredEdge, setHoveredEdge] = useState(null);
  const [eforms, setEforms] = useState([]);
  const [isEFormModalVisible, setIsEFormModalVisible] = useState(false);
  const [selectedEForm, setSelectedEForm] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStart, setConnectionStart] = useState(null);
  const [isToolbarCollapsed, setIsToolbarCollapsed] = useState(false);
  
  // 從後端獲取節點類型定義
  const [nodeTypeDefinitions, setNodeTypeDefinitions] = useState([]);
  const [loadingNodeTypes, setLoadingNodeTypes] = useState(true);
  
  const navigate = useNavigate();
  const reactFlowInstanceRef = useRef();
  
  // 工具欄收合切換
  const toggleToolbar = () => {
    setIsToolbarCollapsed(!isToolbarCollapsed);
  };
  
  // 在組件內部定義 defaultNodeData 函數，這樣可以使用 t() 函數
  const defaultNodeData = useCallback((type) => {
    if (!isReady) {
      // 語言系統未準備好時使用英文
      switch (type) {
        case 'start':
          return { 
            taskName: 'Start',
            activationType: 'manual',
            webhookToken: '',
            webhookUrl: '',
            scheduledTable: '',
            scheduledQuery: '',
            scheduledInterval: 300
          };
        case 'end':
          return { taskName: 'End' };
        case 'sendWhatsApp':
          return { taskName: 'Send WhatsApp Message', message: '', to: '' };
        case 'sendWhatsAppTemplate':
          return { taskName: 'Send WhatsApp Template', templateId: '', templateName: '', variables: {} };
        case 'waitReply':
          return { 
            taskName: 'Wait for User Reply', 
            replyType: 'initiator',
            specifiedUsers: '',
            message: 'Please enter your reply',
            validation: {
              enabled: true,
              validatorType: 'default',
              prompt: 'Please enter valid content',
              retryMessage: 'Input incorrect, please retry',
              maxRetries: 3
            }
          };
        case 'dbQuery':
          return { taskName: 'Database Query/Update', sql: '' };
        case 'callApi':
          return { taskName: 'Trigger External API', url: '' };
        case 'sendEForm':
          return { taskName: 'Send eForm', formName: '', formId: '', formDescription: '', to: '' };
        case 'eFormResult':
          return { taskName: 'eForm Approved/Rejected', result: '' };
        default:
          return { taskName: type };
      }
    }
    
    // 語言系統準備好時使用翻譯
    switch (type) {
      case 'start':
        return { 
          taskName: t('workflowDesigner.defaultStartNode'),
          activationType: 'manual', // manual, webhook, scheduled
          webhookToken: '',
          webhookUrl: '',
          scheduledTable: '',
          scheduledQuery: '',
          scheduledInterval: 300 // 5分鐘
        };
      case 'end':
        return { taskName: t('workflowDesigner.defaultEndNode') };
      case 'sendWhatsApp':
        return { taskName: t('workflowDesigner.defaultSendWhatsAppNode'), message: '', to: '' };
      case 'sendWhatsAppTemplate':
        return { taskName: t('workflowDesigner.defaultSendTemplateNode'), templateId: '', templateName: '', variables: {} };
      case 'waitReply':
        return { 
          taskName: t('workflowDesigner.defaultWaitReplyNode'), 
          replyType: 'initiator', // initiator, specified
          specifiedUsers: '', // 指定人員的電話號碼，用逗號分隔
          message: t('workflowDesigner.defaultReplyMessage'),
          validation: {
            enabled: true,
            validatorType: 'default',
            prompt: t('workflowDesigner.defaultValidationPrompt'),
            retryMessage: t('workflowDesigner.defaultRetryMessage'),
            maxRetries: 3
          }
        };
      case 'dbQuery':
        return { taskName: t('workflowDesigner.defaultDbQueryNode'), sql: '' };
      case 'callApi':
        return { taskName: t('workflowDesigner.defaultCallApiNode'), url: '' };
      case 'sendEForm':
        return { taskName: t('workflowDesigner.defaultSendEFormNode'), formName: '', formId: '', formDescription: '', to: '' };
      case 'eFormResult':
        return { taskName: t('workflowDesigner.defaultEFormResultNode'), result: '' };
      default:
        return { taskName: type };
    }
  }, [isReady, t]);
  
  // 在組件內部定義 createNodeTypesObj 函數，這樣可以使用 t() 函數
  const createNodeTypesObj = useCallback((onDelete) => {
    if (!isReady) {
      // 語言系統未準備好時使用英文
      return {
        default: ({ id, data, selected }) => (
          <div
            style={{
              padding: 8,
              background: selected ? '#e6f7ff' : '#fff',
              border: '1.5px solid #1890ff',
              borderRadius: 6,
              minWidth: 120,
              position: 'relative',
              boxShadow: selected ? '0 0 8px #1890ff55' : '0 1px 4px #0001',
              transition: 'box-shadow 0.2s',
            }}
            className="custom-node"
          >
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
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {data.icon && React.createElement(data.icon, { style: { fontSize: '14px', color: '#666' } })}
              <span>{data.taskName || data.label}</span>
            </div>
            
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
              <button style={{ position: 'absolute', top: 2, right: 2, zIndex: 2 }} onClick={() => onDelete(id)}>Delete</button>
            )}
          </div>
        ),
        input: ({ id, data, selected }) => (
          <div
            style={{
              padding: 8,
              background: '#f6ffed',
              border: '2px solid #52c41a',
              borderRadius: 6,
              minWidth: 80,
              position: 'relative',
              boxShadow: selected ? '0 0 8px #52c41a88' : '0 1px 4px #0001',
              transition: 'box-shadow 0.2s',
            }}
            className="custom-node"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {data.icon && React.createElement(data.icon, { style: { fontSize: '14px', color: '#666' } })}
              <span>{data.taskName || data.label}</span>
            </div>
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
          </div>
        ),
        output: ({ id, data, selected }) => (
          <div
            style={{
              padding: 8,
              background: '#fffbe6',
              border: '2px solid #faad14',
              borderRadius: 6,
              minWidth: 80,
              position: 'relative',
              boxShadow: selected ? '0 0 8px #faad1488' : '0 1px 4px #0001',
              transition: 'box-shadow 0.2s',
            }}
            className="custom-node"
          >
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
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {data.icon && React.createElement(data.icon, { style: { fontSize: '14px', color: '#666' } })}
              <span>{data.taskName || data.label}</span>
            </div>
            
            {selected && (
              <button style={{ position: 'absolute', top: 2, right: 2, zIndex: 2 }} onClick={() => onDelete(id)}>Delete</button>
            )}
          </div>
        ),
      };
    }
    
    // 語言系統準備好時使用翻譯
    return {
    default: ({ id, data, selected }) => (
      <div
        style={{
          padding: 8,
          background: selected ? '#e6f7ff' : '#fff',
          border: '1.5px solid #1890ff',
          borderRadius: 6,
          minWidth: 120,
          position: 'relative',
          boxShadow: selected ? '0 0 8px #1890ff55' : '0 1px 4px #0001',
          transition: 'box-shadow 0.2s',
        }}
        className="custom-node"
      >
        {/* 一般節點 - 上方接入點，下方接出點 */}
        {/* 上方接入點 - 橙色 */}
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
          title={t('workflowDesigner.clickToSelectConnection')}
        />
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {data.icon && React.createElement(data.icon, { style: { fontSize: '14px', color: '#666' } })}
          <span>{data.taskName || data.label}</span>
        </div>
        
        {/* 下方接出點 - 綠色 */}
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
          title={t('workflowDesigner.clickToSelectConnection')}
        />
        
        {selected && data.type !== 'start' && (
          <button style={{ position: 'absolute', top: 2, right: 2, zIndex: 2 }} onClick={() => onDelete(id)}>{t('workflowDesigner.delete')}</button>
        )}
      </div>
    ),
    input: ({ id, data, selected }) => (
      <div
        style={{
          padding: 8,
          background: '#f6ffed',
          border: '2px solid #52c41a',
          borderRadius: 6,
          minWidth: 80,
          position: 'relative',
          boxShadow: selected ? '0 0 8px #52c41a88' : '0 1px 4px #0001',
          transition: 'box-shadow 0.2s',
        }}
        className="custom-node"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {data.icon && React.createElement(data.icon, { style: { fontSize: '14px', color: '#666' } })}
          <span>{data.taskName || data.label}</span>
        </div>
        {/* Start 節點 - 只有下方接出點 - 綠色 */}
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
          title={t('workflowDesigner.clickToSelectConnection')}
        />
      </div>
    ),
    output: ({ id, data, selected }) => (
      <div
        style={{
          padding: 8,
          background: '#fffbe6',
          border: '2px solid #faad14',
          borderRadius: 6,
          minWidth: 80,
          position: 'relative',
          boxShadow: selected ? '0 0 8px #faad1488' : '0 1px 4px #0001',
          transition: 'box-shadow 0.2s',
        }}
        className="custom-node"
      >
        {/* End 節點 - 只有上方接入點 - 橙色 */}
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
          title={t('workflowDesigner.clickToSelectConnection')}
        />
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {data.icon && React.createElement(data.icon, { style: { fontSize: '14px', color: '#666' } })}
          <span>{data.taskName || data.label}</span>
        </div>
        
        {selected && (
          <button style={{ position: 'absolute', top: 2, right: 2, zIndex: 2 }} onClick={() => onDelete(id)}>{t('workflowDesigner.delete')}</button>
        )}
      </div>
    ),
  };
  }, [isReady, t]);
  
  const handleInit = (instance) => {
    reactFlowInstanceRef.current = instance;
    // 只在初始載入時自動 fitView
    if (instance && instance.getNodes().length === 1 && instance.getNodes()[0].id === 'start') {
      setTimeout(() => {
        instance.fitView({ padding: 0.1 });
      }, 100);
    }
  };

  // 獲取模板列表
  const fetchTemplates = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/whatsapptemplates?status=Active', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setTemplates(result.data);
          console.log('WhatsApp 模板已載入:', result.data);
        } else {
          console.error(t('workflowDesigner.getTemplatesFailed'), result.message || t('workflowDesigner.unknownError'));
          // 使用模擬數據作為後備
          setTemplates([
            { id: 'template1', name: '歡迎訊息', description: '新用戶歡迎訊息模板', category: 'Marketing', templateType: 'Text', language: 'zh-TW', status: 'Active' },
            { id: 'template2', name: '訂單確認', description: '訂單確認通知模板', category: 'Notification', templateType: 'Text', language: 'zh-TW', status: 'Active' },
            { id: 'template3', name: '活動邀請', description: '活動邀請通知模板', category: 'Marketing', templateType: 'Text', language: 'zh-TW', status: 'Active' },
            { id: 'template4', name: '系統通知', description: '系統重要通知模板', category: 'Notification', templateType: 'Text', language: 'zh-TW', status: 'Active' },
            { id: 'template5', name: '客戶服務', description: '客戶服務回覆模板', category: 'Service', templateType: 'Text', language: 'zh-TW', status: 'Active' }
          ]);
        }
      } else {
        console.error(t('workflowDesigner.getTemplatesFailed'), response.statusText);
        // 使用模擬數據作為後備
        setTemplates([
          { id: 'template1', name: '歡迎訊息', description: '新用戶歡迎訊息模板', category: 'Marketing', templateType: 'Text', language: 'zh-TW', status: 'Active' },
          { id: 'template2', name: '訂單確認', description: '訂單確認通知模板', category: 'Notification', templateType: 'Text', language: 'zh-TW', status: 'Active' },
          { id: 'template3', name: '活動邀請', description: '活動邀請通知模板', category: 'Marketing', templateType: 'Text', language: 'zh-TW', status: 'Active' },
          { id: 'template4', name: '系統通知', description: '系統重要通知模板', category: 'Notification', templateType: 'Text', language: 'zh-TW', status: 'Active' },
          { id: 'template5', name: '客戶服務', description: '客戶服務回覆模板', category: 'Service', templateType: 'Text', language: 'zh-TW', status: 'Active' }
        ]);
      }
    } catch (error) {
      console.error('獲取模板列表錯誤:', error);
      // 使用模擬數據作為後備
      setTemplates([
        { id: 'template1', name: '歡迎訊息', description: '新用戶歡迎訊息模板', category: 'Marketing', templateType: 'Text', language: 'zh-TW', status: 'Active' },
        { id: 'template2', name: '訂單確認', description: '訂單確認通知模板', category: 'Notification', templateType: 'Text', language: 'zh-TW', status: 'Active' },
        { id: 'template3', name: '活動邀請', description: '活動邀請通知模板', category: 'Marketing', templateType: 'Text', language: 'zh-TW', status: 'Active' },
        { id: 'template4', name: '系統通知', description: '系統重要通知模板', category: 'Notification', templateType: 'Text', language: 'zh-TW', status: 'Active' },
        { id: 'template5', name: '客戶服務', description: '客戶服務回覆模板', category: 'Service', templateType: 'Text', language: 'zh-TW', status: 'Active' }
        ]);
    }
  };



  // 獲取用戶列表
  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users');
      if (response.ok) {
        const users = await response.json();
        // 過濾出有電話號碼的活躍用戶
        const activeUsers = users.filter(user => user.phone && user.isActive);
        setUsers(activeUsers);
      } else {
        // 如果 API 不存在，使用模擬數據
        setUsers([
          { id: 'user1', name: '張三', phone: '85291234567', email: 'zhang@example.com' },
          { id: 'user2', name: '李四', phone: '85298765432', email: 'li@example.com' },
          { id: 'user3', name: '王五', phone: '85295556666', email: 'wang@example.com' },
          { id: 'user4', name: '趙六', phone: '85294448888', email: 'zhao@example.com' },
          { id: 'user5', name: '錢七', phone: '85293337777', email: 'qian@example.com' }
        ]);
      }
    } catch (error) {
      console.error('獲取用戶列表錯誤:', error);
      // 使用模擬數據作為後備
      setUsers([
        { id: 'user1', name: '張三', phone: '85291234567', email: 'zhang@example.com' },
        { id: 'user2', name: '李四', phone: '85298765432', email: 'li@example.com' },
        { id: 'user3', name: '王五', phone: '85295556666', email: 'wang@example.com' },
        { id: 'user4', name: '趙六', phone: '85294448888', email: 'zhao@example.com' },
        { id: 'user5', name: '錢七', phone: '85293337777', email: 'qian@example.com' }
      ]);
    }
  };

  // 獲取 EForm 列表
  const fetchEForms = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/eforms?status=A', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        // 確保 data 是數組並過濾啟用的表單
        let forms = Array.isArray(result.data) ? result.data : [];
        forms = forms.filter(form => form.status === 'A' || form.status === 'Active');
        setEforms(forms);
      } else {
        console.error('獲取 EForm 列表失敗:', response.statusText);
        // 使用模擬數據作為後備
        setEforms([
          { id: 'form1', name: '請假申請表', description: '員工請假申請表單', status: 'A' },
          { id: 'form2', name: '採購申請表', description: '部門採購申請表單', status: 'A' },
          { id: 'form3', name: '報銷申請表', description: '員工報銷申請表單', status: 'A' },
          { id: 'form4', name: '設備申請表', description: 'IT設備申請表單', status: 'A' },
          { id: 'form5', name: '會議申請表', description: '會議室預約申請表單', status: 'A' }
        ]);
      }
    } catch (error) {
      console.error('獲取 EForm 列表錯誤:', error);
      // 使用模擬數據作為後備
      setEforms([
        { id: 'form1', name: '請假申請表', description: '員工請假申請表單', status: 'A' },
        { id: 'form2', name: '採購申請表', description: '部門採購申請表單', status: 'A' },
        { id: 'form3', name: '報銷申請表', description: '員工報銷申請表單', status: 'A' },
        { id: 'form4', name: '設備申請表', description: 'IT設備申請表單', status: 'A' },
        { id: 'form5', name: '會議申請表', description: '會議室預約申請表單', status: 'A' }
      ]);
    }
  };

  // 獲取節點類型定義
  const fetchNodeTypeDefinitions = async () => {
    try {
      setLoadingNodeTypes(true);
      const token = localStorage.getItem('token');
      const response = await fetch('/api/workflownodetypes', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // 將後端數據與本地翻譯合併
          const mergedData = result.data.map(backendNodeType => {
            const localNodeType = nodeTypes.find(nt => nt.type === backendNodeType.type);
            return {
              ...backendNodeType,
              label: localNodeType ? localNodeType.label : backendNodeType.label
            };
          });
          setNodeTypeDefinitions(mergedData);
          console.log('節點類型定義已載入 (已合併翻譯):', mergedData);
        }
      } else {
        console.error('獲取節點類型定義失敗:', response.statusText);
        // 如果 API 不可用，使用本地定義
        setNodeTypeDefinitions(nodeTypes.map(nt => ({
          type: nt.type,
          label: nt.label,
          category: 'Default',
          description: nt.label,
          isImplemented: true,
          hasExecution: nt.type !== 'start' && nt.type !== 'end',
          defaultData: {}
        })));
      }
    } catch (error) {
      console.error('獲取節點類型定義錯誤:', error);
      // 使用本地定義作為後備
      setNodeTypeDefinitions(nodeTypes.map(nt => ({
        type: nt.type,
        label: nt.label,
        category: 'Default',
        description: nt.label,
        isImplemented: true,
        hasExecution: nt.type !== 'start' && nt.type !== 'end',
        defaultData: {}
      })));
    } finally {
      setLoadingNodeTypes(false);
    }
  };

  // 若有 id，載入現有流程資料
  useEffect(() => {
    // 設置初始狀態 - 使用空字符串，避免在語言系統未準備好時調用 t()
    setStatus('');
    
    fetchNodeTypeDefinitions();
    fetchTemplates();
    fetchUsers();
    fetchEForms();
    
    if (workflowId) {
      const token = localStorage.getItem('token');
      fetch(`/api/workflowdefinitions/${workflowId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
        .then(res => {
          if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          }
          return res.json();
        })
        .then(data => {
          setName(data.name || '');
          setDescription(data.description || '');
          setCreatedAt(data.createdAt || '');
          setUpdatedAt(data.updatedAt || '');
          setCreatedBy(data.createdBy || '');
          setUpdatedBy(data.updatedBy || '');
          setStatus(data.status || 'Enabled');
          if (data.json) {
            try {
              const flow = JSON.parse(data.json);
              if (flow.nodes) {
                // 重新添加圖標組件
                const nodesWithIcons = flow.nodes.map(node => {
                  const nodeType = nodeTypes.find(n => n.type === node.data.type);
                  return {
                    ...node,
                    data: {
                      ...node.data,
                      icon: nodeType ? nodeType.icon : null,
                      label: node.data.label || nodeType?.label || node.data.type
                    }
                  };
                });
                setNodes(nodesWithIcons);
              }
              if (flow.edges) {
                setEdges(flow.edges);
              }
            } catch {}
          }
        })
        .catch(error => {
          console.error('載入流程定義失敗:', error);
          message.error('載入流程定義失敗');
        });
    }
    }, [workflowId]);
  
  // 語言系統準備好後設置狀態 - 統一使用英文
  useEffect(() => {
    if (t && typeof t === 'function') {
      setStatus('Enabled');
    }
  }, [t]);
  
  // 刪除節點（Start 節點不可刪）
  const handleDeleteNode = useCallback((nodeId) => {
    setNodes(nds => nds.filter(n => n.id !== nodeId || n.data.type === 'start'));
    setEdges(eds => eds.filter(e => e.source !== nodeId && e.target !== nodeId));
    setSelectedNode(null);
  }, [setNodes, setEdges]);

  // 刪除連線
  const handleDeleteEdge = (edgeId) => {
    setEdges(eds => eds.filter(e => e.id !== edgeId));
    setSelectedEdge(null);
  };

  // 監聽視圖變化，當用戶縮放或平移時清除選中的連接線
  const onMove = useCallback(() => {
    if (selectedEdge) {
      setSelectedEdge(null);
    }
  }, [selectedEdge]);

  const onZoom = useCallback(() => {
    if (selectedEdge) {
      setSelectedEdge(null);
    }
  }, [selectedEdge]);

  // 處理連接線刪除
  const onEdgeDelete = (edgeId) => {
    setEdges(eds => eds.filter(e => e.id !== edgeId));
    setSelectedEdge(null);
  };

  // 驗證工作流程連接邏輯
  const validateWorkflowLogic = () => {
    const errors = [];
    const warnings = [];
    
    // 檢查是否有 Start 和 End 節點
    const hasStart = nodes.some(n => n.data.type === 'start');
    const hasEnd = nodes.some(n => n.data.type === 'end');
    
    if (!hasStart) {
      errors.push(t('workflowDesigner.missingStartNode'));
    }
    if (!hasEnd) {
      errors.push(t('workflowDesigner.missingEndNode'));
    }
    
    // 檢查是否有連接
    if (edges.length === 0) {
      errors.push(t('workflowDesigner.noConnections'));
      return { errors, warnings };
    }
    
    // 檢查循環連接
    const visited = new Set();
    const recursionStack = new Set();
    
    const hasCycle = (nodeId, parentId = null) => {
      if (recursionStack.has(nodeId)) {
        return true; // 發現循環
      }
      if (visited.has(nodeId)) {
        return false; // 已經訪問過，沒有循環
      }
      
      visited.add(nodeId);
      recursionStack.add(nodeId);
      
      // 找到從當前節點出發的所有邊
      const outgoingEdges = edges.filter(edge => edge.source === nodeId);
      
      for (const edge of outgoingEdges) {
        if (edge.target === parentId) {
          continue; // 跳過回到父節點的邊
        }
        
        if (hasCycle(edge.target, nodeId)) {
          return true;
        }
      }
      
      recursionStack.delete(nodeId);
      return false;
    };
    
    // 檢查每個節點是否有循環
    for (const node of nodes) {
      if (hasCycle(node.id)) {
        errors.push(t('workflowDesigner.circularConnection', { nodeName: node.data.taskName || node.data.label }));
        break;
      }
    }
    
    // 檢查孤立節點（沒有輸入或輸出的節點）
    const connectedNodes = new Set();
    edges.forEach(edge => {
      connectedNodes.add(edge.source);
      connectedNodes.add(edge.target);
    });
    
    const isolatedNodes = nodes.filter(node => 
      node.data.type !== 'start' && 
      node.data.type !== 'end' && 
      !connectedNodes.has(node.id)
    );
    
    if (isolatedNodes.length > 0) {
      warnings.push(t('workflowDesigner.isolatedNodes', { nodeNames: isolatedNodes.map(n => n.data.taskName || n.data.label).join(', ') }));
    }
    
    // 檢查 Start 節點是否有輸出
    const startNodes = nodes.filter(n => n.data.type === 'start');
    for (const startNode of startNodes) {
      const hasOutput = edges.some(edge => edge.source === startNode.id);
      if (!hasOutput) {
        warnings.push(t('workflowDesigner.startNodeNoOutput', { nodeName: startNode.data.taskName || startNode.data.label }));
      }
    }
    
    // 檢查 End 節點是否有輸入
    const endNodes = nodes.filter(n => n.data.type === 'end');
    for (const endNode of endNodes) {
      const hasInput = edges.some(edge => edge.target === endNode.id);
      if (!hasInput) {
        warnings.push(t('workflowDesigner.endNodeNoInput', { nodeName: endNode.data.taskName || endNode.data.label }));
      }
    }
    
    return { errors, warnings };
  };

  // 儲存流程（驗證至少有 Start/End 並有連線）
  const handleSave = async () => {
    // 驗證工作流程邏輯
    const { errors, warnings } = validateWorkflowLogic();
    
    if (errors.length > 0) {
      message.error(`工作流程驗證失敗：\n${errors.join('\n')}`);
      return;
    }
    
    if (warnings.length > 0) {
      const warningMessage = `工作流程警告：\n${warnings.join('\n')}\n\n是否繼續保存？`;
      const shouldContinue = window.confirm(warningMessage);
      if (!shouldContinue) {
        return;
      }
    }
    
    if (!name) {
      message.error(t('workflow.nameRequired'));
      return;
    }
    
    // 清理節點數據，移除圖標組件避免序列化問題
    const cleanNodes = nodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        icon: undefined // 移除圖標組件
      }
    }));
    
    const flowJson = JSON.stringify({ nodes: cleanNodes, edges });
    try {
      const token = localStorage.getItem('token');
      const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
      let companyId = userInfo.company_id;
      
      // 如果從 userInfo 中無法獲取，嘗試從 JWT token 中解析
      if (!companyId && token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          companyId = payload.company_id;
          console.log('從 JWT token 中獲取到 company_id:', companyId);
        } catch (error) {
          console.error('解析 JWT token 失敗:', error);
        }
      }
      
      if (!companyId) {
        console.error('無法獲取用戶的公司信息，userInfo:', userInfo);
        message.error('無法獲取用戶的公司信息，請重新登入');
        return;
      }
      
      if (workflowId) {
        // 更新，補齊所有必填欄位
        const response = await fetch(`/api/workflowdefinitions/${workflowId}`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            name: name,
            description: description,
            json: flowJson,
            status: status || 'Enabled',
            createdBy: createdBy || t('workflowDesigner.designer'),
            updatedBy: updatedBy || t('workflowDesigner.designer'),
            executions: []
          }),
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`${t('workflowDesigner.updateFailed')}: ${errorText}`);
        }
        
        message.success(t('workflow.saveSuccess'), 2);
        // 儲存成功後延遲 1 秒再導航，讓用戶看到成功訊息
        setTimeout(() => {
          navigate('/workflow-list');
        }, 1000);
      } else {
        // 新增
        const response = await fetch('/api/workflowdefinitions', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            name: name,
            description: description,
            json: flowJson,
            status: status || 'Enabled',
            createdBy: createdBy || t('workflowDesigner.designer'),
            updatedBy: updatedBy || t('workflowDesigner.designer'),
            executions: []
          }),
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`${t('workflowDesigner.createFailed')}: ${errorText}`);
        }
        
        message.success(t('workflow.saveSuccess'), 2);
        // 儲存成功後延遲 1 秒再導航，讓用戶看到成功訊息
        setTimeout(() => {
          navigate('/workflow-list');
        }, 1000);
      }
    } catch (error) {
      console.error(t('workflowDesigner.saveFailed'), error);
      message.error('❌ ' + t('workflowDesigner.saveFailed') + ': ' + error.message);
    }
  };

  // nodeTypesObj 用 useMemo，依賴 handleDeleteNode
  const nodeTypesObj = useMemo(() => createNodeTypesObj(handleDeleteNode), [handleDeleteNode, createNodeTypesObj]);

  // 拖拉節點到畫布
  const onDragStart = (event, nodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const onDrop = useCallback((event) => {
    event.preventDefault();
    const type = event.dataTransfer.getData('application/reactflow');
    // Start 節點只能有一個
    if (type === 'start' && nodes.some(n => n.data.type === 'start')) return;
    const position = { x: event.clientX - 300, y: event.clientY - 80 };
    
    // 獲取節點類型的默認標籤
    const nodeType = nodeTypes.find(n => n.type === type);
    const baseName = nodeType ? nodeType.label : type;
    const uniqueTaskName = generateUniqueTaskName(baseName);
    
    // 創建默認數據，包含正確的 taskName
    const defaultData = {
      ...defaultNodeData(type),
      taskName: uniqueTaskName
    };
    
    const newNode = {
      id: `${type}_${+new Date()}`,
      type: type === 'start' ? 'input' : (type === 'end' ? 'output' : 'default'),
      position,
      data: { 
        label: baseName, 
        type, 
        taskName: uniqueTaskName,
        icon: nodeType ? nodeType.icon : null,
        ...defaultData, 
        onDelete: handleDeleteNode 
      },
    };
    setNodes((nds) => nds.concat(newNode));
  }, [setNodes, nodes, handleDeleteNode]);

  // Start 節點預設也要有 onDelete
  React.useEffect(() => {
    setNodes(nds => nds.map(n => n.data.type === 'start' && !n.data.onDelete ? { ...n, data: { ...n.data, onDelete: handleDeleteNode } } : n));
  }, [handleDeleteNode, setNodes]);

  const onDragOver = (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  // 點選節點顯示屬性編輯
  const onNodeClick = (event, node) => {
    setSelectedNode(node);
    setDrawerOpen(true);
    setSelectedEdge(null);
  };

  // 點選連線
  const onEdgeClick = (event, edge) => {
    event.stopPropagation();
    setSelectedEdge(edge);
    setSelectedNode(null);
    setDrawerOpen(false);
  };

  // 連接線懸停事件
  const onEdgeMouseEnter = (event, edge) => {
    setHoveredEdge(edge);
  };

  const onEdgeMouseLeave = (event, edge) => {
    setHoveredEdge(null);
  };

  // 編輯節點屬性
  const handleNodeDataChange = (changed) => {
    // 處理嵌套的驗證配置
    let updatedData = { ...changed };
    
    // 如果更改包含驗證配置，需要合併現有的驗證配置
    if (changed.validation && selectedNode) {
      const existingValidation = selectedNode.data.validation || {};
      updatedData.validation = { ...existingValidation, ...changed.validation };
    }
    
    setNodes((nds) => nds.map(n => n.id === selectedNode.id ? { ...n, data: { ...n.data, ...updatedData } } : n));
    setSelectedNode((n) => ({ ...n, data: { ...n.data, ...updatedData } }));
  };

  // 選擇模板
  const handleSelectTemplate = (template) => {
    setSelectedTemplate(template);
    handleNodeDataChange({
      templateId: template.id,
      templateName: template.name,
      variables: {}
    });
    setIsTemplateModalVisible(false);
  };

  // 選擇用戶
  const handleSelectUser = (user) => {
    setSelectedUser(user);
    const phoneNumber = user.phone || '';
    
    if (selectedNode && selectedNode.data.type === 'waitReply' && selectedNode.data.replyType === 'specified') {
      // 對於 waitReply 節點的指定人員，支援多選
      const currentUsers = selectedNode.data.specifiedUsers || '';
      const userList = currentUsers ? currentUsers.split(',').map(u => u.trim()) : [];
      
      if (!userList.includes(phoneNumber)) {
        userList.push(phoneNumber);
      }
      
      const newUsersString = userList.join(', ');
      handleNodeDataChange({
        specifiedUsers: newUsersString
      });
    } else {
      // 對於其他節點，單選
      handleNodeDataChange({
        to: phoneNumber
      });
    }
    
    setIsUserModalVisible(false);
    console.log('選中用戶:', user.name, '電話:', phoneNumber);
    
    // 更新表單的值以即時顯示
    if (selectedNode) {
      if (selectedNode.data.type === 'waitReply' && selectedNode.data.replyType === 'specified') {
        form.setFieldsValue({
          specifiedUsers: selectedNode.data.specifiedUsers
        });
      } else {
        form.setFieldsValue({
          to: phoneNumber
        });
      }
    }
  };

  // 選擇 EForm
  const handleSelectEForm = (selectedForm) => {
    setSelectedEForm(selectedForm);
    handleNodeDataChange({
      formName: selectedForm.name,
      formId: selectedForm.id,
      formDescription: selectedForm.description
    });
    setIsEFormModalVisible(false);
    console.log('選中表單:', selectedForm.name, 'ID:', selectedForm.id);
    
    // 更新表單的值以即時顯示
    if (selectedNode) {
      form.setFieldsValue({
        formName: selectedForm.name
      });
    }
  };

  // 生成唯一的任務名稱
  const generateUniqueTaskName = (baseName) => {
    const existingNames = nodes.map(node => node.data.taskName);
    let counter = 1;
    let newName = baseName;
    
    while (existingNames.includes(newName)) {
      counter++;
      newName = `${baseName} (${counter})`;
    }
    
    return newName;
  };

  // 生成 Webhook Token
  const generateWebhookToken = () => {
    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    return token;
  };

  useEffect(() => {
    if (reactFlowInstanceRef.current && nodes.length > 0) {
      // 只在初始載入時自動 fitView，避免在用戶操作時干擾
      const isInitialLoad = nodes.length === 1 && nodes[0].id === 'start';
      if (isInitialLoad) {
        setTimeout(() => {
          reactFlowInstanceRef.current.fitView({ padding: 0.1 });
        }, 200);
      }
    }
  }, [nodes, edges]);

  // 當選中的節點改變時，更新表單的值
  useEffect(() => {
    if (selectedNode && form) {
      const initialValues = {
        taskName: selectedNode.data.taskName || '',
        to: selectedNode.data.to || '',
        message: selectedNode.data.message || '',
        templateName: selectedNode.data.templateName || '',
        timeout: selectedNode.data.timeout || '',
        sql: selectedNode.data.sql || '',
        url: selectedNode.data.url || '',
        formName: selectedNode.data.formName || '',
        formId: selectedNode.data.formId || '',
        formDescription: selectedNode.data.formDescription || '',
        result: selectedNode.data.result || '',
        activationType: selectedNode.data.activationType || 'manual',
        webhookToken: selectedNode.data.webhookToken || '',
        scheduledTable: selectedNode.data.scheduledTable || '',
        scheduledQuery: selectedNode.data.scheduledQuery || '',
        scheduledInterval: selectedNode.data.scheduledInterval || 300,
        replyType: selectedNode.data.replyType || 'initiator',
        specifiedUsers: selectedNode.data.specifiedUsers || '',
        validation: selectedNode.data.validation || {
          enabled: true,
          validatorType: 'default',
          prompt: t('workflowDesigner.defaultValidationPrompt'),
          retryMessage: t('workflowDesigner.defaultRetryMessage'),
          maxRetries: 3
        }
      };
      
      form.setFieldsValue(initialValues);
    }
  }, [selectedNode, form]);

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <style>{purpleButtonStyle}</style>
      
      {/* 頂部工具欄 */}
      <div style={{
        padding: '16px', 
        borderBottom: '1px solid #e8e8e8',
        backgroundColor: 'white',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Button 
            icon={<ArrowLeftOutlined />} 
            onClick={() => navigate('/workflow-list')} 
            className="purple-back-button"
            style={{ 
              backgroundColor: '#722ed1', 
              borderColor: '#722ed1',
              color: 'white',
              height: '32px',
              width: '32px',
              padding: '0'
            }}
          />
          <Button
            icon={<SaveOutlined />}
            type="primary"
            onClick={handleSave}
            style={{
              height: '32px',
              width: '32px',
              padding: '0'
            }}
          />
        </div>
        
        <Title level={4} style={{ margin: 0 }}>{t('workflowDesigner.title')}</Title>
      </div>

      {/* 主要內容區域 */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* 左側工具欄 */}
        <div style={{ 
          width: isToolbarCollapsed ? '0px' : '250px', 
          borderRight: isToolbarCollapsed ? 'none' : '1px solid #e8e8e8',
          backgroundColor: '#fafafa',
          padding: isToolbarCollapsed ? '0px' : '16px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          transition: 'all 0.3s ease',
          opacity: isToolbarCollapsed ? 0 : 1,
          visibility: isToolbarCollapsed ? 'hidden' : 'visible',
          height: '100%'
        }}>
          <div style={{ marginBottom: '20px' }}>
            <h4>{t('workflowDesigner.workflowInfo')}</h4>
            <div style={{ marginBottom: '12px' }}>
              <label>{t('workflowDesigner.workflowName')}:</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('workflowDesigner.workflowNamePlaceholder')}
                style={{ marginTop: '4px' }}
              />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label>{t('workflowDesigner.workflowDescription')}:</label>
              <Input.TextArea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('workflowDesigner.workflowDescriptionPlaceholder')}
                rows={3}
                style={{ marginTop: '4px' }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <h4>{t('workflow.nodeTypes')}</h4>

            {loadingNodeTypes ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <div>{t('workflowDesigner.loadingNodeTypes')}</div>
              </div>
            ) : (
              <>
                {/* 按類別分組顯示節點類型 */}
                {Object.entries(
                  nodeTypeDefinitions.reduce((acc, nodeType) => {
                    const category = nodeType.category || 'Other';
                    if (!acc[category]) acc[category] = [];
                    acc[category].push(nodeType);
                    return acc;
                  }, {})
                ).map(([category, types]) => (
                  <div key={category} style={{ marginBottom: '16px' }}>
                    <h5 style={{ margin: '8px 0', fontSize: '12px', color: '#666', textTransform: 'uppercase' }}>
                      {category}
                    </h5>
                    {types.map(nodeType => {
                      const iconComponent = nodeTypes.find(n => n.type === nodeType.type)?.icon;
                      const isDisabled = nodeType.type === 'start' && nodes.some(nd => nd.data.type === 'start');
                      
                      return (
                        <div
                          key={nodeType.type}
                          style={{ 
                            margin: '4px 0', 
                            padding: 8, 
                            background: nodeType.isImplemented ? '#fff' : '#f5f5f5', 
                            border: `1px solid ${nodeType.isImplemented ? '#ddd' : '#ccc'}`, 
                            borderRadius: 4, 
                            cursor: isDisabled ? 'not-allowed' : 'grab', 
                            opacity: isDisabled ? 0.5 : (nodeType.isImplemented ? 1 : 0.6),
                            position: 'relative'
                          }}
                          draggable={nodeType.isImplemented && !isDisabled}
                          onDragStart={e => nodeType.isImplemented && !isDisabled ? onDragStart(e, nodeType.type) : null}
                          title={nodeType.description}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {iconComponent && React.createElement(iconComponent, { 
                              style: { fontSize: '16px', color: nodeType.isImplemented ? '#666' : '#999' } 
                            })}
                            <span style={{ 
                              fontSize: '12px', 
                              color: nodeType.isImplemented ? '#333' : '#999' 
                            }}>
                              {nodeType.label}
                            </span>
                          </div>
                          {!nodeType.isImplemented && (
                            <div style={{
                              position: 'absolute',
                              top: 2,
                              right: 2,
                              fontSize: '10px',
                              color: '#999',
                              backgroundColor: '#f0f0f0',
                              padding: '1px 4px',
                              borderRadius: '2px'
                            }}>
                              {t('workflowDesigner.inDevelopment')}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>


        
        {/* 編輯器區域 */}
        <div style={{ flex: 1, position: 'relative' }}>
          <ReactFlow
            onInit={handleInit}
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={useCallback((params) => {
              // 允許所有連接，只在保存時驗證
              const sourceNode = nodes.find(n => n.id === params.source);
              const targetNode = nodes.find(n => n.id === params.target);
              
              if (sourceNode && targetNode) {
                // 防止自連接
                if (params.source === params.target) {
                  message.warning('不能連接節點到自己');
                  return;
                }
                
                // 防止重複連接
                const existingEdge = edges.find(e => 
                  e.source === params.source && e.target === params.target
                );
                if (existingEdge) {
                  message.warning('節點之間已經存在連接');
                  return;
                }
                
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
                }, eds));
                
                console.log(`✅ 連接成功: ${sourceNode.data.taskName || sourceNode.data.label} → ${targetNode.data.taskName || targetNode.data.label}`);
              }
            }, [setEdges, nodes, edges])}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            onEdgeMouseEnter={onEdgeMouseEnter}
            onEdgeMouseLeave={onEdgeMouseLeave}
            nodeTypes={nodeTypesObj}
            style={{ height: '100%', width: '100%' }}
            onMove={onMove}
            onZoom={onZoom}
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
            }}
          >
            <MiniMap />
            <Controls />
            <Background />
            {/* 選中連接線的刪除按鈕 */}
            {selectedEdge && (() => {
              const sourceNode = nodes.find(n => n.id === selectedEdge.source);
              const targetNode = nodes.find(n => n.id === selectedEdge.target);
              if (!sourceNode || !targetNode) return null;
              
              // 獲取 React Flow 實例
              const reactFlowInstance = reactFlowInstanceRef.current;
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
                  <Button
                    danger
                    size="small"
                    onClick={() => onEdgeDelete(selectedEdge.id)}
                    style={{
                      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                      border: '2px solid #fff',
                      backgroundColor: '#ff4d4f',
                      color: '#fff',
                      fontWeight: 'bold'
                    }}
                  >
                    {t('workflowDesigner.delete')}
                  </Button>
                </div>
              );
            })()}
            
            {/* 懸停提示 */}
            {hoveredEdge && !selectedEdge && (() => {
              const sourceNode = nodes.find(n => n.id === hoveredEdge.source);
              const targetNode = nodes.find(n => n.id === hoveredEdge.target);
              if (!sourceNode || !targetNode) return null;
              
              // 獲取 React Flow 實例
              const reactFlowInstance = reactFlowInstanceRef.current;
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
        {/* 右側屬性編輯 */}
        <Drawer
          title={selectedNode ? nodeTypeLabel(selectedNode.data.type) : ''}
          placement="right"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          width={340}
        >
          {selectedNode && selectedNode.data.type !== 'start' && (
            <Form
              key={selectedNode.id} // 添加 key 強制重新渲染
              layout="vertical"
              initialValues={{
                taskName: selectedNode.data.taskName || selectedNode.data.label,
                to: selectedNode.data.to || '',
                message: selectedNode.data.message || '',
                templateName: selectedNode.data.templateName || '',
                timeout: selectedNode.data.timeout || '',
                sql: selectedNode.data.sql || '',
                url: selectedNode.data.url || '',
                formName: selectedNode.data.formName || '',
                result: selectedNode.data.result || '',
                ...selectedNode.data
              }}
              onValuesChange={(_, all) => handleNodeDataChange(all)}
            >
              <Form.Item label={t('workflowDesigner.taskNameLabel')} name="taskName">
                <Input placeholder={t('workflowDesigner.taskNamePlaceholder')} />
              </Form.Item>
              
                            {selectedNode.data.type === 'sendWhatsApp' && (
                <>
                  <Form.Item label={t('workflow.to')}>
                    <Input 
                      value={selectedNode.data.to || ''}
                      placeholder={t('workflowDesigner.phoneNumberPlaceholder')}
                      readOnly
                      onClick={() => setIsUserModalVisible(true)}
                      suffix={
                        <Space>
                          {selectedNode.data.to && (
                            <Button 
                              type="text" 
                              size="small" 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleNodeDataChange({ to: '' });
                              }}
                            >
                              {t('workflowDesigner.clear')}
                            </Button>
                          )}
                          <Button 
                            type="text" 
                            size="small" 
                            onClick={() => setIsUserModalVisible(true)}
                          >
                            {t('workflowDesigner.selectUser')}
                          </Button>
                        </Space>
                      }
                      style={{
                        color: selectedNode.data.to ? '#000' : '#999',
                        backgroundColor: selectedNode.data.to ? '#fff' : '#f5f5f5',
                        width: '100%',
                        minWidth: '300px'
                      }}
                    />
                  </Form.Item>
                  <Form.Item label={t('workflow.message')} name="message">
                    <Input.TextArea rows={3} />
                  </Form.Item>
                </>
              )}
                            {selectedNode.data.type === 'sendWhatsAppTemplate' && (
                <>
                  <Form.Item label={t('workflow.to')}>
                    <Input 
                      value={selectedNode.data.to || ''}
                      placeholder={t('workflowDesigner.phoneNumberPlaceholder')}
                      readOnly
                      onClick={() => setIsUserModalVisible(true)}
                      suffix={
                        <Space>
                          {selectedNode.data.to && (
                            <Button 
                              type="text" 
                              size="small" 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleNodeDataChange({ to: '' });
                              }}
                            >
                              {t('workflowDesigner.clear')}
                            </Button>
                          )}
                          <Button 
                            type="text" 
                            size="small" 
                            onClick={() => setIsUserModalVisible(true)}
                          >
                            {t('workflowDesigner.selectUser')}
                          </Button>
                        </Space>
                      }
                      style={{
                        color: selectedNode.data.to ? '#000' : '#999',
                        backgroundColor: selectedNode.data.to ? '#fff' : '#f5f5f5',
                        width: '100%',
                        minWidth: '300px'
                      }}
                    />
                  </Form.Item>
                  <Form.Item label="模板">
                    <Input 
                      value={selectedNode.data.templateName || ''}
                      placeholder={t('workflowDesigner.selectTemplate')} 
                      readOnly 
                      onClick={() => setIsTemplateModalVisible(true)}
                      suffix={<MessageOutlined />}
                    />
                  </Form.Item>
                  {selectedNode.data.templateId && (
                    <Card size="small" title={t('workflowDesigner.templateInfo')} style={{ marginBottom: 16 }}>
                                              <p><strong>{t('workflowDesigner.templateId')}</strong>{selectedNode.data.templateId}</p>
                        <p><strong>{t('workflowDesigner.templateName')}</strong>{selectedNode.data.templateName}</p>
                    </Card>
                  )}
                </>
              )}
              {selectedNode.data.type === 'waitReply' && (
                <>
                  <Form.Item label={t('workflowDesigner.replyType')} name="replyType">
                    <Select
                      options={[
                        { value: 'initiator', label: t('workflowDesigner.initiator') },
                        { value: 'specified', label: t('workflowDesigner.specifiedPerson') }
                      ]}
                    />
                  </Form.Item>
                  
                  {selectedNode.data.replyType === 'specified' && (
                    <Form.Item label={t('workflowDesigner.specifiedPerson')}>
                      <Input 
                        value={selectedNode.data.specifiedUsers || ''}
                        placeholder={t('workflowDesigner.selectSpecifiedPerson')} 
                        readOnly 
                        onClick={() => setIsUserModalVisible(true)}
                        suffix={
                          <Space>
                            {selectedNode.data.specifiedUsers && (
                              <Button 
                                type="text" 
                                size="small" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleNodeDataChange({ specifiedUsers: '' });
                                }}
                              >
                                清除
                              </Button>
                            )}
                                                      <Button 
                            type="text" 
                            size="small" 
                            onClick={() => setIsUserModalVisible(true)}
                          >
                            {t('workflowDesigner.selectPerson')}
                          </Button>
                          </Space>
                        }
                        style={{
                          color: selectedNode.data.specifiedUsers ? '#000' : '#999',
                          backgroundColor: selectedNode.data.specifiedUsers ? '#fff' : '#f5f5f5',
                          width: '100%',
                          minWidth: '300px'
                        }}
                      />
                    </Form.Item>
                  )}
                  
                  <Form.Item label={t('workflowDesigner.promptMessage')} name="message">
                    <Input.TextArea 
                      rows={3} 
                      placeholder={t('workflowDesigner.waitReplyMessagePlaceholder')}
                    />
                  </Form.Item>
                  <Form.Item label={t('workflowDesigner.validationConfig')}>
                    <Card size="small" title={t('workflowDesigner.validationSettings')} style={{ marginBottom: 16 }}>
                      <Form.Item label={t('workflowDesigner.enableValidation')} name={['validation', 'enabled']}>
                        <Select
                          options={[
                            { value: true, label: t('workflowDesigner.yes') },
                            { value: false, label: t('workflowDesigner.no') }
                          ]}
                        />
                      </Form.Item>
                      <Form.Item label={t('workflowDesigner.validatorType')} name={['validation', 'validatorType']}>
                        <Select
                          options={[
                            { value: 'default', label: t('workflowDesigner.defaultValidator') },
                            { value: 'custom', label: t('workflowDesigner.customValidator') },
                            { value: 'openai', label: t('workflowDesigner.openaiValidation') },
                            { value: 'xai', label: t('workflowDesigner.xaiValidation') }
                          ]}
                        />
                      </Form.Item>
                      <Form.Item label={t('workflowDesigner.promptText')} name={['validation', 'prompt']}>
                        <Input placeholder={t('workflowDesigner.dateFormatExample')} />
                      </Form.Item>
                      <Form.Item label={t('workflowDesigner.retryMessage')} name={['validation', 'retryMessage']}>
                        <Input placeholder={t('workflowDesigner.formatExample')} />
                      </Form.Item>
                      <Form.Item label={t('workflowDesigner.maxRetries')} name={['validation', 'maxRetries']}>
                        <Input type="number" min="1" max="10" />
                      </Form.Item>
                    </Card>
                  </Form.Item>
                  <Card size="small" title={t('workflowDesigner.functionDescription')} style={{ marginTop: 16 }}>
                    <p style={{ fontSize: '12px', margin: '4px 0' }}>
                      {t('workflowDesigner.waitReplyDescription1')}
                    </p>
                    <p style={{ fontSize: '12px', margin: '4px 0' }}>
                      {t('workflowDesigner.waitReplyDescription2')}
                    </p>
                    <p style={{ fontSize: '12px', margin: '4px 0' }}>
                      {t('workflowDesigner.waitReplyDescription3')}
                    </p>
                    <p style={{ fontSize: '12px', margin: '4px 0', color: '#1890ff' }}>
                      {t('workflowDesigner.waitReplyDescription4')}
                    </p>
                  </Card>
                </>
              )}
              {selectedNode.data.type === 'dbQuery' && (
                <Form.Item label={t('workflow.sql')} name="sql"><Input.TextArea rows={3} /></Form.Item>
              )}
              {selectedNode.data.type === 'callApi' && (
                <Form.Item label={t('workflow.apiUrl')} name="url"><Input /></Form.Item>
              )}
              {selectedNode.data.type === 'sendEForm' && (
                <>
                  <Form.Item label="選擇表單">
                    <Input 
                      value={selectedNode.data.formName || ''}
                                              placeholder={t('workflowDesigner.selectEFormPlaceholder')} 
                      readOnly 
                      onClick={() => setIsEFormModalVisible(true)}
                      suffix={
                        <Space>
                          {selectedNode.data.formName && (
                            <Button 
                              type="text" 
                              size="small" 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleNodeDataChange({ 
                                  formName: '', 
                                  formId: '', 
                                  formDescription: '' 
                                });
                              }}
                            >
                              清除
                            </Button>
                          )}
                          <Button 
                            type="text" 
                            size="small" 
                            onClick={() => setIsEFormModalVisible(true)}
                          >
                            {t('workflowDesigner.selectForm')}
                          </Button>
                        </Space>
                      }
                      style={{
                        color: selectedNode.data.formName ? '#000' : '#999',
                        backgroundColor: selectedNode.data.formName ? '#fff' : '#f5f5f5',
                        width: '100%',
                        minWidth: '300px'
                      }}
                    />
                  </Form.Item>
                  
                                    <Form.Item label={t('workflow.to')}>
                    <Input 
                      value={selectedNode.data.to || ''}
                      placeholder={t('workflowDesigner.phoneNumberPlaceholder')}
                      readOnly
                      onClick={() => setIsUserModalVisible(true)}
                      suffix={
                        <Space>
                          {selectedNode.data.to && (
                            <Button 
                              type="text" 
                              size="small" 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleNodeDataChange({ to: '' });
                              }}
                            >
                              {t('workflowDesigner.clear')}
                            </Button>
                          )}
                          <Button 
                            type="text" 
                            size="small" 
                            onClick={() => setIsUserModalVisible(true)}
                          >
                            {t('workflowDesigner.selectUser')}
                          </Button>
                        </Space>
                      }
                      style={{
                        color: selectedNode.data.to ? '#000' : '#999',
                        backgroundColor: selectedNode.data.to ? '#fff' : '#f5f5f5',
                        width: '100%',
                        minWidth: '300px'
                      }}
                    />
                  </Form.Item>
                  
                  {selectedNode.data.formId && (
                    <Card size="small" title={t('workflowDesigner.formInfo')} style={{ marginBottom: 16 }}>
                      <p><strong>{t('workflowDesigner.formId')}</strong>{selectedNode.data.formId}</p>
                      <p><strong>{t('workflowDesigner.formName')}</strong>{selectedNode.data.formName}</p>
                      {selectedNode.data.formDescription && (
                        <p><strong>{t('workflowDesigner.formDescription')}</strong>{selectedNode.data.formDescription}</p>
                      )}
                    </Card>
                  )}
                  
                  <Card size="small" title={t('workflowDesigner.functionDescription')} style={{ marginTop: 16 }}>
                    <p style={{ fontSize: '12px', margin: '4px 0' }}>
                      {t('workflowDesigner.eFormDescription1')}
                    </p>
                    <p style={{ fontSize: '12px', margin: '4px 0' }}>
                      {t('workflowDesigner.eFormDescription2')}
                    </p>
                    <p style={{ fontSize: '12px', margin: '4px 0' }}>
                      {t('workflowDesigner.eFormDescription3')}
                    </p>
                    <p style={{ fontSize: '12px', margin: '4px 0' }}>
                      {t('workflowDesigner.eFormDescription4')}
                    </p>
                    <p style={{ fontSize: '12px', margin: '4px 0', color: '#1890ff' }}>
                      {t('workflowDesigner.eFormDescription5')}
                    </p>
                  </Card>
                </>
              )}
              {selectedNode.data.type === 'eFormResult' && (
                <Form.Item label={t('workflow.result')} name="result"><Select options={[
                  { value: 'approved', label: t('workflow.approved') },
                  { value: 'rejected', label: t('workflow.rejected') },
                ]} />
                </Form.Item>
              )}
            </Form>
          )}
          {selectedNode && selectedNode.data.type === 'start' && (
            <div style={{ color: '#888' }}>
                                <h4>{t('workflowDesigner.activationConfig')}</h4>
              <Form
                layout="vertical"
                size="small"
                initialValues={{
                  activationType: selectedNode.data.activationType || 'manual',
                  webhookToken: selectedNode.data.webhookToken || '',
                  scheduledTable: selectedNode.data.scheduledTable || '',
                  scheduledQuery: selectedNode.data.scheduledQuery || '',
                  scheduledInterval: selectedNode.data.scheduledInterval || 300
                }}
                onValuesChange={(_, all) => handleNodeDataChange(all)}
              >
                <Form.Item label={t('workflowDesigner.activationType')} name="activationType">
                                      <Select
                      options={[
                        { value: 'manual', label: t('workflowDesigner.manualActivation') },
                        { value: 'webhook', label: t('workflowDesigner.metaWebhookCall') },
                        { value: 'scheduled', label: t('workflowDesigner.scheduledTableWatch') }
                      ]}
                    />
                </Form.Item>
                
                {selectedNode.data.activationType === 'webhook' && (
                  <>
                    <Card size="small" title={t('workflowDesigner.metaWebhookConfigTitle')} style={{ marginTop: 16 }}>
                      <p style={{ fontSize: '12px', margin: '4px 0' }}>
                        {t('workflowDesigner.metaWebhookConfig1')}
                      </p>
                      <p style={{ fontSize: '12px', margin: '4px 0' }}>
                        {t('workflowDesigner.metaWebhookConfig2')}
                      </p>
                      <p style={{ fontSize: '12px', margin: '4px 0' }}>
                        {t('workflowDesigner.metaWebhookConfig3')}
                      </p>
                      <p style={{ fontSize: '12px', margin: '4px 0', color: '#1890ff' }}>
                        {t('workflowDesigner.metaWebhookConfig4')}
                      </p>
                    </Card>
                  </>
                )}
                
                {selectedNode.data.activationType === 'scheduled' && (
                  <>
                    <Form.Item label={t('workflowDesigner.watchTable')} name="scheduledTable">
                      <Input placeholder={t('workflowDesigner.tableExample')} />
                    </Form.Item>
                    <Form.Item label={t('workflowDesigner.queryCondition')} name="scheduledQuery">
                      <Input.TextArea 
                        rows={3} 
                        placeholder={t('workflowDesigner.queryExample')}
                      />
                    </Form.Item>
                    <Form.Item label={t('workflowDesigner.checkInterval')} name="scheduledInterval">
                      <Input type="number" min="60" max="3600" />
                    </Form.Item>
                    <Card size="small" title={t('workflowDesigner.scheduledWatchTitle')} style={{ marginTop: 16 }}>
                      <p style={{ fontSize: '12px', margin: '4px 0' }}>
                        {t('workflowDesigner.scheduledWatchDescription')}
                      </p>
                    </Card>
                  </>
                )}
              </Form>
            </div>
          )}
        </Drawer>
      </div>

      {/* 模板選擇 Modal */}
      <Modal
        title={t('workflowDesigner.selectWhatsAppTemplate')}
        open={isTemplateModalVisible}
        onCancel={() => setIsTemplateModalVisible(false)}
        footer={null}
        width={800}
      >
        <div style={{ maxHeight: '400px', overflow: 'auto' }}>
          {templates.map(template => (
            <Card
              key={template.id}
              size="small"
              style={{ marginBottom: 8, cursor: 'pointer' }}
              onClick={() => handleSelectTemplate(template)}
              hoverable
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ margin: 0 }}>{template.name}</h4>
                  <p style={{ margin: '4px 0', color: '#666' }}>{template.description}</p>
                  <Space>
                    <Tag color="blue">{template.category}</Tag>
                    <Tag color="green">{template.templateType}</Tag>
                    <Tag color="orange">{template.language}</Tag>
                  </Space>
                </div>
                <Button type="primary" size="small">選擇</Button>
              </div>
            </Card>
          ))}
          {templates.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
              {t('workflowDesigner.noTemplatesAvailable')}
            </div>
          )}
        </div>
      </Modal>

      {/* 用戶選擇 Modal */}
      <Modal
        title={t('workflowDesigner.selectUser')}
        open={isUserModalVisible}
        onCancel={() => setIsUserModalVisible(false)}
        footer={null}
        width={400}
      >
        <div style={{ maxHeight: '300px', overflow: 'auto' }}>
          {users.map(user => (
            <Card
              key={user.id}
              size="small"
              style={{ marginBottom: 8, cursor: 'pointer' }}
              onClick={() => handleSelectUser(user)}
              hoverable
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ margin: 0 }}>{user.name}</h4>
                  <p style={{ margin: '4px 0', color: '#666' }}>{user.phone}</p>
                </div>
                <Button type="primary" size="small">選擇</Button>
              </div>
            </Card>
          ))}
          {users.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
              {t('workflowDesigner.noUsersAvailable')}
            </div>
          )}
        </div>
      </Modal>

      {/* EForm 選擇 Modal */}
      <Modal
        title={t('workflowDesigner.selectEForm')}
        open={isEFormModalVisible}
        onCancel={() => setIsEFormModalVisible(false)}
        footer={null}
        width={600}
      >
        <div style={{ maxHeight: '400px', overflow: 'auto' }}>
          {eforms.map(form => (
            <Card
              key={form.id}
              size="small"
              style={{ marginBottom: 8, cursor: 'pointer' }}
              onClick={() => handleSelectEForm(form)}
              hoverable
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: 0 }}>{form.name}</h4>
                  {form.description && (
                    <p style={{ margin: '4px 0', color: '#666' }}>{form.description}</p>
                  )}
                  <Space>
                    <Tag color="blue">e-Form</Tag>
                    <Tag color="green">{t('workflowDesigner.statusEnabled')}</Tag>
                    {form.created_at && (
                      <Tag color="orange">
                        {new Date(form.created_at).toLocaleDateString('zh-TW')}
                      </Tag>
                    )}
                  </Space>
                </div>
                <Button type="primary" size="small">選擇</Button>
              </div>
            </Card>
          ))}
          {eforms.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
              {t('workflowDesigner.noEFormsAvailable')}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default WhatsAppWorkflowDesigner; 