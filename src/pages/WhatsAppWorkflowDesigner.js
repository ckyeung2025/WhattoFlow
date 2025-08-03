import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import ReactFlow, {
  MiniMap, Controls, Background, addEdge, useNodesState, useEdgesState, Handle, Position, useReactFlow, getBezierPath
} from 'react-flow-renderer';
import { Button, Drawer, Form, Input, Select, message, Tooltip, Modal, Card, Tag, Space } from 'antd';
import { SaveOutlined, ArrowLeftOutlined, MessageOutlined, SendOutlined, ClockCircleOutlined, DatabaseOutlined, ApiOutlined, FormOutlined, CheckCircleOutlined, StopOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';

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

const nodeTypes = [
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

const initialNodes = [
  {
    id: 'start',
    type: 'input',
    position: { x: 120, y: 200 },
    data: { label: 'Start', type: 'start' },
    draggable: false,
  },
];
const initialEdges = [];

const nodeTypeLabel = type => nodeTypes.find(n => n.type === type)?.label || type;

const defaultNodeData = type => {
  switch (type) {
    case 'start':
      return { 
        taskName: 'Start',
        activationType: 'manual', // manual, webhook, scheduled
        webhookToken: '',
        webhookUrl: '',
        scheduledTable: '',
        scheduledQuery: '',
        scheduledInterval: 300 // 5分鐘
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
        replyType: 'initiator', // initiator, specified
        specifiedUsers: '', // 指定人員的電話號碼，用逗號分隔
        message: '請輸入您的回覆',
        validation: {
          enabled: true,
          validatorType: 'default',
          prompt: '請輸入有效內容',
          retryMessage: '輸入不正確，請重新輸入',
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
};

// nodeTypesObj 搬到 component 外部，onDelete 由 props 傳入
const createNodeTypesObj = (onDelete) => ({
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
        title="輸入連接點"
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
        title="輸出連接點"
      />
      
      {selected && data.type !== 'start' && (
        <button style={{ position: 'absolute', top: 2, right: 2, zIndex: 2 }} onClick={() => onDelete(id)}>刪除</button>
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
        title="輸出連接點"
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
        title="輸入連接點"
      />
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {data.icon && React.createElement(data.icon, { style: { fontSize: '14px', color: '#666' } })}
        <span>{data.taskName || data.label}</span>
      </div>
      

      
      {selected && (
        <button style={{ position: 'absolute', top: 2, right: 2, zIndex: 2 }} onClick={() => onDelete(id)}>刪除</button>
      )}
    </div>
  ),
});

const WhatsAppWorkflowDesigner = () => {
  const [form] = Form.useForm(); // 添加表單實例
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
  const [status, setStatus] = useState('啟用');
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
  
  // 從後端獲取節點類型定義
  const [nodeTypeDefinitions, setNodeTypeDefinitions] = useState([]);
  const [loadingNodeTypes, setLoadingNodeTypes] = useState(true);
  
  const navigate = useNavigate();
  const { t } = useLanguage();
  const reactFlowInstanceRef = useRef();
  
  // 創建動態的節點標籤函數
  const getNodeTypeLabel = useCallback((type) => {
    // 使用本地定義
    const nodeType = nodeTypes.find(n => n.type === type);
    return nodeType ? nodeType.label : type;
  }, [nodeTypes]);
  
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
      const response = await fetch('/api/whatsapptemplates?status=Active');
      const result = await response.json();
      if (result.success) {
        setTemplates(result.data);
      }
    } catch (error) {
      console.error('獲取模板列表錯誤:', error);
    }
  };

  // 獲取 Meta 模板列表
  const fetchMetaTemplates = async () => {
    try {
      const response = await fetch('/api/whatsapptemplates/meta-templates');
      const result = await response.json();
      if (result.success) {
        // 將 Meta 模板轉換為本地格式
        const metaTemplates = result.data.map(template => ({
          id: template.id,
          name: template.name,
          description: `Meta 模板: ${template.name}`,
          category: template.category || 'Meta',
          templateType: 'Text',
          status: template.status,
          language: template.language,
          isMetaTemplate: true
        }));
        setTemplates(prev => [...prev, ...metaTemplates]);
      }
    } catch (error) {
      console.error('獲取 Meta 模板列表錯誤:', error);
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
          setNodeTypeDefinitions(result.data);
          console.log('節點類型定義已載入:', result.data);
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
    fetchNodeTypeDefinitions();
    fetchTemplates();
    fetchMetaTemplates();
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
          setStatus(data.status || '啟用');
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
      errors.push('缺少開始節點 (Start)');
    }
    if (!hasEnd) {
      errors.push('缺少結束節點 (End)');
    }
    
    // 檢查是否有連接
    if (edges.length === 0) {
      errors.push('沒有連接線');
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
        errors.push(`發現循環連接：節點 "${node.data.taskName || node.data.label}" 參與循環`);
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
      warnings.push(`發現孤立節點：${isolatedNodes.map(n => n.data.taskName || n.data.label).join(', ')}`);
    }
    
    // 檢查 Start 節點是否有輸出
    const startNodes = nodes.filter(n => n.data.type === 'start');
    for (const startNode of startNodes) {
      const hasOutput = edges.some(edge => edge.source === startNode.id);
      if (!hasOutput) {
        warnings.push(`開始節點 "${startNode.data.taskName || startNode.data.label}" 沒有輸出連接`);
      }
    }
    
    // 檢查 End 節點是否有輸入
    const endNodes = nodes.filter(n => n.data.type === 'end');
    for (const endNode of endNodes) {
      const hasInput = edges.some(edge => edge.target === endNode.id);
      if (!hasInput) {
        warnings.push(`結束節點 "${endNode.data.taskName || endNode.data.label}" 沒有輸入連接`);
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
            status: status || '啟用',
            createdBy: createdBy || '設計者',
            updatedBy: updatedBy || '設計者',
            executions: []
          }),
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`更新失敗: ${errorText}`);
        }
        
        message.success(t('workflow.saveSuccess'), 2);
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
            status: status || '啟用',
            createdBy: createdBy || '設計者',
            updatedBy: updatedBy || '設計者',
            executions: []
          }),
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`創建失敗: ${errorText}`);
        }
        
        message.success(t('workflow.saveSuccess'), 2);
      }
    } catch (error) {
      console.error('保存失敗:', error);
      message.error('❌ 保存失敗: ' + error.message);
    }
  };

  // nodeTypesObj 用 useMemo，依賴 handleDeleteNode
  const nodeTypesObj = useMemo(() => createNodeTypesObj(handleDeleteNode), [handleDeleteNode]);

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
          prompt: '請輸入有效內容',
          retryMessage: '輸入不正確，請重新輸入',
          maxRetries: 3
        }
      };
      
      form.setFieldsValue(initialValues);
    }
  }, [selectedNode, form]);

  return (
    <div style={{ display: 'flex', height: '100%', flexDirection: 'column', position: 'relative' }}>
      <style>{purpleButtonStyle}</style>
      <div style={{ padding: 12, background: '#f7f7f7', borderBottom: '1px solid #eee', display: 'flex', gap: 12, alignItems: 'center' }}>
        {/* 左上角返回按鈕 */}
        <Button
          type="primary"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/workflow-list')}
          title={t('workflow.back')}
          style={{ 
            marginRight: 8, 
            backgroundColor: '#722ed1', 
            borderColor: '#722ed1'
          }}
          className="purple-back-button"
        />
        <Tooltip title={t('workflow.save')} placement="bottom">
          <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} style={{ marginRight: 8 }} />
        </Tooltip>
        <Input style={{ width: 220 }} placeholder={t('workflow.name')} value={name} onChange={e => setName(e.target.value)} />
        <Input style={{ width: 320 }} placeholder={t('workflow.description')} value={description} onChange={e => setDescription(e.target.value)} />
        <Tooltip title="簡化連接點設計：綠色=接出，橙色=接入" placement="bottom">
          <Tag color="purple" style={{ marginLeft: 'auto', cursor: 'help' }}>
                          🎯 簡化連接
          </Tag>
        </Tooltip>
      </div>
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* 左側節點清單 */}
        <div style={{ width: 180, background: '#f7f7f7', padding: 12 }}>
          <h4>{t('workflow.nodeTypes')}</h4>
          <div style={{ 
            marginBottom: '12px', 
            padding: '8px', 
            backgroundColor: '#f6ffed', 
            borderRadius: '4px', 
            fontSize: '11px',
            border: '1px solid #b7eb8f'
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>💡 簡化連接點設計：</div>
            <div>• 🟢 綠色：所有接出點（source handles）</div>
            <div>• 🟠 橙色：所有接入點（target handles）</div>
            <div>• 動畫連接線顯示流程方向</div>
          </div>
          {loadingNodeTypes ? (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <div>載入節點類型中...</div>
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
                            開發中
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
        {/* 中間流程畫布 */}
        <div style={{ flex: 1, background: '#fafbfc', position: 'relative', height: '100%' }}>
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
                    刪除
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
                    點擊選擇連接線
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
              <Form.Item label="Task Name" name="taskName">
                <Input placeholder="輸入任務名稱" />
              </Form.Item>
              
              {selectedNode.data.type === 'sendWhatsApp' && (
                <>
                  <Form.Item label={t('workflow.to')}>
                    <Input 
                      value={selectedNode.data.to || ''}
                      placeholder="輸入電話號碼 (例如: 85296366318) 或點擊選擇用戶" 
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
                              清除
                            </Button>
                          )}
                          <Button 
                            type="text" 
                            size="small" 
                            onClick={() => setIsUserModalVisible(true)}
                          >
                            選擇用戶
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
                      placeholder="輸入電話號碼 (例如: 85296366318) 或點擊選擇用戶" 
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
                              清除
                            </Button>
                          )}
                          <Button 
                            type="text" 
                            size="small" 
                            onClick={() => setIsUserModalVisible(true)}
                          >
                            選擇用戶
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
                      placeholder="選擇模板" 
                      readOnly 
                      onClick={() => setIsTemplateModalVisible(true)}
                      suffix={<MessageOutlined />}
                    />
                  </Form.Item>
                  {selectedNode.data.templateId && (
                    <Card size="small" title="模板信息" style={{ marginBottom: 16 }}>
                      <p><strong>模板ID：</strong>{selectedNode.data.templateId}</p>
                      <p><strong>模板名稱：</strong>{selectedNode.data.templateName}</p>
                    </Card>
                  )}
                </>
              )}
              {selectedNode.data.type === 'waitReply' && (
                <>
                  <Form.Item label="回覆類型" name="replyType">
                    <Select
                      options={[
                        { value: 'initiator', label: '流程啟動人' },
                        { value: 'specified', label: '指定人員' }
                      ]}
                    />
                  </Form.Item>
                  
                  {selectedNode.data.replyType === 'specified' && (
                    <Form.Item label="指定人員">
                      <Input 
                        value={selectedNode.data.specifiedUsers || ''}
                        placeholder="選擇指定人員" 
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
                              選擇人員
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
                  
                  <Form.Item label="提示訊息" name="message">
                    <Input.TextArea 
                      rows={3} 
                      placeholder="輸入等待用戶回覆時的提示訊息"
                    />
                  </Form.Item>
                  <Form.Item label="驗證配置">
                    <Card size="small" title="驗證設定" style={{ marginBottom: 16 }}>
                      <Form.Item label="啟用驗證" name={['validation', 'enabled']}>
                        <Select
                          options={[
                            { value: true, label: '是' },
                            { value: false, label: '否' }
                          ]}
                        />
                      </Form.Item>
                      <Form.Item label="驗證器類型" name={['validation', 'validatorType']}>
                        <Select
                          options={[
                            { value: 'default', label: '預設驗證器' },
                            { value: 'custom', label: '自定義驗證器' },
                            { value: 'openai', label: 'OpenAI 驗證' },
                            { value: 'xai', label: 'XAI 驗證' }
                          ]}
                        />
                      </Form.Item>
                      <Form.Item label="提示文字" name={['validation', 'prompt']}>
                        <Input placeholder="例如：請輸入請假日期，格式：YYYY-MM-DD" />
                      </Form.Item>
                      <Form.Item label="重試訊息" name={['validation', 'retryMessage']}>
                        <Input placeholder="例如：格式不正確，請重新輸入，例如：2024-01-15" />
                      </Form.Item>
                      <Form.Item label="最大重試次數" name={['validation', 'maxRetries']}>
                        <Input type="number" min="1" max="10" />
                      </Form.Item>
                    </Card>
                  </Form.Item>
                  <Card size="small" title="功能說明" style={{ marginTop: 16 }}>
                    <p style={{ fontSize: '12px', margin: '4px 0' }}>
                      1. 流程執行到此節點時會暫停等待用戶回覆
                    </p>
                    <p style={{ fontSize: '12px', margin: '4px 0' }}>
                      2. 只有指定的用戶回覆才會繼續執行流程
                    </p>
                    <p style={{ fontSize: '12px', margin: '4px 0' }}>
                      3. 如果啟用驗證，會檢查用戶輸入是否符合要求
                    </p>
                    <p style={{ fontSize: '12px', margin: '4px 0', color: '#1890ff' }}>
                      4. 驗證失敗時會要求用戶重新輸入
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
                      placeholder="選擇要發送的 e-Form" 
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
                            選擇表單
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
                      placeholder="輸入電話號碼 (例如: 85296366318) 或點擊選擇用戶" 
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
                              清除
                            </Button>
                          )}
                          <Button 
                            type="text" 
                            size="small" 
                            onClick={() => setIsUserModalVisible(true)}
                          >
                            選擇用戶
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
                    <Card size="small" title="表單信息" style={{ marginBottom: 16 }}>
                      <p><strong>表單ID：</strong>{selectedNode.data.formId}</p>
                      <p><strong>表單名稱：</strong>{selectedNode.data.formName}</p>
                      {selectedNode.data.formDescription && (
                        <p><strong>描述：</strong>{selectedNode.data.formDescription}</p>
                      )}
                    </Card>
                  )}
                  
                  <Card size="small" title="功能說明" style={{ marginTop: 16 }}>
                    <p style={{ fontSize: '12px', margin: '4px 0' }}>
                      1. 選擇要發送的 e-Form 表單
                    </p>
                    <p style={{ fontSize: '12px', margin: '4px 0' }}>
                      2. 選擇接收表單的用戶（電話號碼）
                    </p>
                    <p style={{ fontSize: '12px', margin: '4px 0' }}>
                      3. 系統會將表單連結發送給指定用戶
                    </p>
                    <p style={{ fontSize: '12px', margin: '4px 0' }}>
                      4. 用戶可以點擊連結填寫表單
                    </p>
                    <p style={{ fontSize: '12px', margin: '4px 0', color: '#1890ff' }}>
                      5. 表單提交後會觸發後續流程
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
              <h4>啟動方式配置</h4>
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
                <Form.Item label="啟動方式" name="activationType">
                  <Select
                    options={[
                      { value: 'manual', label: '手動啟動' },
                      { value: 'webhook', label: 'Meta Webhook 呼叫' },
                      { value: 'scheduled', label: '定時監看數據表' }
                    ]}
                  />
                </Form.Item>
                
                {selectedNode.data.activationType === 'webhook' && (
                  <>
                    <Card size="small" title="Meta Webhook 配置說明" style={{ marginTop: 16 }}>
                      <p style={{ fontSize: '12px', margin: '4px 0' }}>
                        1. 請在公司設定頁面配置 Meta Webhook URL
                      </p>
                      <p style={{ fontSize: '12px', margin: '4px 0' }}>
                        2. 當收到 WhatsApp 訊息時，系統會回覆選單讓用戶選擇功能
                      </p>
                      <p style={{ fontSize: '12px', margin: '4px 0' }}>
                        3. 根據用戶選擇啟動對應的流程
                      </p>
                      <p style={{ fontSize: '12px', margin: '4px 0', color: '#1890ff' }}>
                        4. 此流程將在用戶選擇後執行
                      </p>
                    </Card>
                  </>
                )}
                
                {selectedNode.data.activationType === 'scheduled' && (
                  <>
                    <Form.Item label="監看數據表" name="scheduledTable">
                      <Input placeholder="例如: dbo.SoOrderManage" />
                    </Form.Item>
                    <Form.Item label="查詢條件" name="scheduledQuery">
                      <Input.TextArea 
                        rows={3} 
                        placeholder="例如: WHERE status = 'PENDING' AND created_at > @lastCheckTime"
                      />
                    </Form.Item>
                    <Form.Item label="檢查間隔 (秒)" name="scheduledInterval">
                      <Input type="number" min="60" max="3600" />
                    </Form.Item>
                    <Card size="small" title="定時監看說明" style={{ marginTop: 16 }}>
                      <p style={{ fontSize: '12px', margin: '4px 0' }}>
                        此功能正在開發中，將在後續版本中實現
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
        title="選擇 WhatsApp 模板"
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
              暫無可用的模板，請先創建模板
            </div>
          )}
        </div>
      </Modal>

      {/* 用戶選擇 Modal */}
      <Modal
        title="選擇用戶"
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
              暫無可用的用戶，請先添加用戶
            </div>
          )}
        </div>
      </Modal>

      {/* EForm 選擇 Modal */}
      <Modal
        title="選擇 e-Form 表單"
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
                    <Tag color="green">啟用</Tag>
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
              暫無可用的 e-Form 表單，請先創建表單
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default WhatsAppWorkflowDesigner; 