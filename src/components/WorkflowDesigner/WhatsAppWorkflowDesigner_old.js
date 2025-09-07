import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  ReactFlow, MiniMap, Controls, Background, addEdge, useNodesState, useEdgesState, Handle, Position, useReactFlow, getBezierPath
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Button, Drawer, Form, Input, Select, message, Tooltip, Modal, Card, Tag, Space, Typography, Table, Popconfirm } from 'antd';
import { SaveOutlined, ArrowLeftOutlined, MessageOutlined, SendOutlined, ClockCircleOutlined, DatabaseOutlined, ApiOutlined, FormOutlined, CheckCircleOutlined, StopOutlined, PlayCircleOutlined, UpOutlined, SettingOutlined, PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useSearchParams, useNavigate } from 'react-router-dom';

// 導入分拆的模塊
import { 
  NODE_TYPE_CONFIGS, 
  MOCK_DATA
} from './constants';
import { purpleButtonStyle } from './styles';
import { 
  handleApiError, 
  processVariableReferences, 
  generateUniqueTaskName, 
  validateWorkflowLogic, 
  getAvailableOutputPaths 
} from './utils';
import { useConditionGroups } from './hooks/useConditionGroups';
import { useNodeData } from './hooks/useNodeData';
import { createNodeTypesObj } from './components/NodeTypes';
import { apiService } from './services/apiService';
import TemplateModal from './modals/TemplateModal';
import UserModal from './modals/UserModal';
import EFormModal from './modals/EFormModal';
import ProcessVariablesModal from './modals/ProcessVariablesModal';
import ConditionModal from './modals/ConditionModal';
import ConditionGroupModal from './modals/ConditionGroupModal';
import DefaultPathModal from './modals/DefaultPathModal';
import ProcessVariableSelect from './components/ProcessVariableSelect';

const { Title } = Typography;

const initialEdges = [];

const WhatsAppWorkflowDesigner = () => {
  const { t, isReady } = useLanguage();
  const [form] = Form.useForm();
  
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
  
  // 流程變量管理狀態
  const [processVariablesModalVisible, setProcessVariablesModalVisible] = useState(false);
  const [processVariables, setProcessVariables] = useState([]);
  const [selectedProcessVariable, setSelectedProcessVariable] = useState(null);
  const [editingProcessVariable, setEditingProcessVariable] = useState(null);
  const [processVariableForm] = Form.useForm();
  
  // Switch 節點條件管理狀態
  const [conditionModalVisible, setConditionModalVisible] = useState(false);
  const [conditionGroupModalVisible, setConditionGroupModalVisible] = useState(false);
  const [defaultPathModalVisible, setDefaultPathModalVisible] = useState(false);
  const [editingCondition, setEditingCondition] = useState(null);
  const [editingConditionGroup, setEditingConditionGroup] = useState(null);
  const [conditionForm] = Form.useForm();
  const [conditionGroupForm] = Form.useForm();
  
  const navigate = useNavigate();
  const reactFlowInstanceRef = useRef();
  
  // 使用條件群組管理 Hook
  const {
    getCurrentConditionGroups,
    updateConditionGroups,
    addConditionGroup,
    updateConditionGroup,
    removeConditionGroup
  } = useConditionGroups(selectedNode, nodes, setNodes);
  
  // 使用節點數據管理 Hook
  const { defaultNodeData } = useNodeData(isReady, t);
  
  // 在組件內部定義 nodeTypeLabel 函數，這樣可以使用 nodeTypes
  const nodeTypeLabel = useCallback((type) => nodeTypes.find(n => n.type === type)?.label || type, [nodeTypes]);
  
  // 工具欄收合切換
  const toggleToolbar = () => {
    setIsToolbarCollapsed(!isToolbarCollapsed);
  };

  // 獲取模板列表
  const fetchTemplates = async () => {
    try {
      const templates = await apiService.fetchTemplates();
      setTemplates(templates);
    } catch (error) {
      handleApiError(error, MOCK_DATA.templates, setTemplates, '獲取模板列表錯誤');
    }
  };

  // 獲取用戶列表
  const fetchUsers = async () => {
    try {
      const users = await apiService.fetchUsers();
      setUsers(users);
    } catch (error) {
      handleApiError(error, MOCK_DATA.users, setUsers, '獲取用戶列表錯誤');
    }
  };

  // 獲取 EForm 列表
  const fetchEForms = async () => {
    try {
      const eforms = await apiService.fetchEForms();
      setEforms(eforms);
    } catch (error) {
      handleApiError(error, MOCK_DATA.eforms, setEforms, '獲取 EForm 列表錯誤');
    }
  };

  // 獲取節點類型定義
  const fetchNodeTypeDefinitions = async () => {
    try {
      setLoadingNodeTypes(true);
      const definitions = await apiService.fetchNodeTypeDefinitions();
      if (definitions) {
        // 將後端數據與本地翻譯合併
        const mergedData = definitions.map(backendNodeType => {
          const localNodeType = nodeTypes.find(nt => nt.type === backendNodeType.type);
          return {
            ...backendNodeType,
            label: localNodeType ? localNodeType.label : backendNodeType.label
          };
        });
        setNodeTypeDefinitions(mergedData);
      } else {
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

  // 獲取流程變量
  const fetchProcessVariables = async () => {
    if (!workflowId) return;
    
    try {
      const variables = await apiService.fetchProcessVariables(workflowId);
      setProcessVariables(variables);
    } catch (error) {
      console.error('獲取流程變量失敗:', error);
      setProcessVariables([]);
    }
  };

  // 初始化數據
  useEffect(() => {
    setStatus('');
    fetchNodeTypeDefinitions();
    fetchTemplates();
    fetchUsers();
    fetchEForms();
    
    if (workflowId) {
      fetchProcessVariables();
    }
  }, [workflowId]);

  // 設置條件群組表單初始值
  useEffect(() => {
    if (editingConditionGroup && conditionGroupForm) {
      console.log('設置條件群組表單初始值:', editingConditionGroup);
      conditionGroupForm.setFieldsValue({
        relation: editingConditionGroup.relation || 'and',
        outputPath: editingConditionGroup.outputPath || ''
      });
    }
  }, [editingConditionGroup, conditionGroupForm]);

  // 設置條件編輯表單初始值
  useEffect(() => {
    if (editingCondition && conditionForm) {
      console.log('設置條件編輯表單初始值:', editingCondition);
      conditionForm.setFieldsValue({
        variableName: editingCondition.variableName || '',
        operator: editingCondition.operator || '',
        value: editingCondition.value || '',
        label: editingCondition.label || ''
      });
    }
  }, [editingCondition, conditionForm]);

  // 載入現有流程資料
  useEffect(() => {
    if (workflowId) {
      const loadWorkflow = async () => {
        try {
          const data = await apiService.fetchWorkflowDefinition(workflowId);
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
            } catch (parseError) {
              console.error('解析流程 JSON 失敗:', parseError);
            }
          }
        } catch (error) {
          console.error('載入流程定義失敗:', error);
          message.error('載入流程定義失敗');
        }
      };
      
      loadWorkflow();
    }
  }, [workflowId, nodeTypes]);

  // 語言系統準備好後設置狀態
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

  // 儲存流程（驗證至少有 Start/End 並有連線）
  const handleSave = async () => {
    // 驗證工作流程邏輯
    const { errors, warnings } = validateWorkflowLogic(nodes, edges, t);
    
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
      const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
      const token = localStorage.getItem('token');
      let companyId = userInfo.company_id;
      
      // 如果從 userInfo 中無法獲取，嘗試從 JWT token 中解析
      if (!companyId && token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          companyId = payload.company_id;
        } catch (error) {
          console.error('解析 JWT token 失敗:', error);
        }
      }
      
      if (!companyId) {
        message.error('無法獲取用戶的公司信息，請重新登入');
        return;
      }
      
      const workflowData = {
        name: name,
        description: description,
        json: flowJson,
        status: status || 'Enabled',
        createdBy: createdBy || t('workflowDesigner.designer'),
        updatedBy: updatedBy || t('workflowDesigner.designer'),
        executions: []
      };
      
      await apiService.saveWorkflowDefinition(workflowData, !!workflowId, workflowId);
      
      message.success(t('workflow.saveSuccess'), 2);
      // 儲存成功後延遲 1 秒再導航，讓用戶看到成功訊息
      setTimeout(() => {
        navigate('/workflow-list');
      }, 1000);
    } catch (error) {
      console.error('保存工作流程失敗:', error);
      message.error(error.message || '保存失敗');
    }
  };


  // 處理節點選擇（單擊只選中節點，不打開屬性視窗）
  const onNodeClick = (event, node) => {
    setSelectedNode(node);
    // 移除 setDrawerOpen(true) - 單擊不再打開屬性視窗
  };

  // 處理節點雙擊（雙擊才打開屬性視窗）
  const onNodeDoubleClick = (event, node) => {
    setSelectedNode(node);
    setDrawerOpen(true);
  };

  // 處理邊選擇
  const onEdgeClick = (event, edge) => {
    setSelectedEdge(edge);
  };

  // 處理連接
  const onConnect = (params) => {
    const newEdge = {
      ...params,
      id: `edge_${params.source}_${params.target}_${Date.now()}`,
      type: 'default',
      animated: false,
      style: { stroke: '#b1b1b7', strokeWidth: 2 }
    };
    setEdges(eds => addEdge(newEdge, eds));
  };

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

  // 創建節點類型對象
  const nodeTypesObj = useMemo(() => {
    return createNodeTypesObj(handleDeleteNode, t);
  }, [handleDeleteNode, t]);

  // 拖放處理函數
  const onDragStart = (event, nodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  const onDrop = (event) => {
    event.preventDefault();
    const nodeType = event.dataTransfer.getData('application/reactflow');
    if (!nodeType) return;

    // 檢查 React Flow 實例是否存在
    if (!reactFlowInstanceRef.current) {
      console.error('React Flow 實例不存在');
      return;
    }

    // 嘗試使用不同的方法來獲取位置
    let position;
    try {
      // 首先嘗試 screenToFlowPosition 方法
      if (typeof reactFlowInstanceRef.current.screenToFlowPosition === 'function') {
        position = reactFlowInstanceRef.current.screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });
      } else if (typeof reactFlowInstanceRef.current.project === 'function') {
        // 如果 screenToFlowPosition 不存在，嘗試使用 project 方法
        position = reactFlowInstanceRef.current.project({
          x: event.clientX,
          y: event.clientY,
        });
      } else {
        // 如果都不存在，使用默認位置
        position = { x: 100, y: 100 };
        console.warn('無法獲取拖放位置，使用默認位置');
      }
    } catch (error) {
      console.error('獲取拖放位置失敗:', error);
      position = { x: 100, y: 100 };
    }

    if (position) {
      handleAddNode(nodeType, position);
    }
  };

  // 修改添加節點函數以支持位置參數
  const handleAddNode = (nodeType, position = null) => {
    const nodeTypeConfig = nodeTypes.find(nt => nt.type === nodeType);
    if (!nodeTypeConfig) return;

    const defaultPosition = position || { x: Math.random() * 400 + 200, y: Math.random() * 300 + 100 };
    
    const newNode = {
      id: `${nodeType}_${Date.now()}`,
      type: nodeType === 'start' ? 'input' : nodeType === 'end' ? 'output' : 'default',
      position: defaultPosition,
      data: {
        ...defaultNodeData(nodeType),
        type: nodeType,
        icon: nodeTypeConfig.icon,
        label: nodeTypeConfig.label
      }
    };

    setNodes(nds => [...nds, newNode]);
  };

  // 處理節點數據變更
  const handleNodeDataChange = (newData) => {
    if (!selectedNode) return;
    
    setNodes(nds => nds.map(node => 
      node.id === selectedNode.id 
        ? { ...node, data: { ...node.data, ...newData } }
        : node
    ));
  };

  // 邊的懸停處理
  const onEdgeMouseEnter = (event, edge) => {
    setHoveredEdge(edge);
  };

  const onEdgeMouseLeave = () => {
    setHoveredEdge(null);
  };

  // 處理模板選擇
  const handleSelectTemplate = (template) => {
    if (selectedNode) {
      handleNodeDataChange({
        templateId: template.id,
        templateName: template.name,
        templateDescription: template.description
      });
      setSelectedTemplate(template);
    }
    setIsTemplateModalVisible(false);
  };

  // 處理用戶選擇
  const handleSelectUser = (user) => {
    if (selectedNode) {
      handleNodeDataChange({
        to: user.phone,
        selectedUserName: user.name
      });
      setSelectedUser(user);
    }
    setIsUserModalVisible(false);
  };

  // 處理 EForm 選擇
  const handleSelectEForm = (eform) => {
    if (selectedNode) {
      handleNodeDataChange({
        formId: eform.id,
        formName: eform.name,
        formDescription: eform.description
      });
      setSelectedEForm(eform);
    }
    setIsEFormModalVisible(false);
  };
  
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
          <Button
            icon={<SettingOutlined />}
            onClick={() => setProcessVariablesModalVisible(true)}
            style={{
              height: '32px',
              width: '32px',
              padding: '0'
            }}
            title={t('processVariables.manageProcessVariables')}
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
            onNodeDoubleClick={onNodeDoubleClick}
            onEdgeClick={onEdgeClick}
            onEdgeMouseEnter={onEdgeMouseEnter}
            onEdgeMouseLeave={onEdgeMouseLeave}
            nodeTypes={nodeTypesObj}
            edgeTypes={{}}
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
              form={form}
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
                    <Input.TextArea 
                      rows={3} 
                      placeholder={t('workflowDesigner.messageWithVariablesPlaceholder')}
                      onChange={(e) => {
                        // 實時預覽變量引用
                        const processedText = processVariableReferences(e.target.value, processVariables);
                        // 可以在這裡添加預覽功能
                      }}
                    />
                  </Form.Item>
                  {processVariables && processVariables.length > 0 && (
                    <Form.Item label={t('workflowDesigner.availableVariables')}>
                      <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                        {t('workflowDesigner.variableSyntaxHelp')}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {processVariables.map(pv => (
                          <Tag 
                            key={pv.id} 
                            style={{ cursor: 'pointer' }}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const currentValue = form.getFieldValue('message') || '';
                              const newValue = currentValue + `\${${pv.variableName}}`;
                              // 更新表單值
                              form.setFieldValue('message', newValue);
                              // 觸發節點數據更新
                              handleNodeDataChange({ message: newValue });
                              console.log('Clicked variable:', pv.variableName, 'New value:', newValue);
                            }}
                          >
                            {pv.variableName} ({pv.dataType})
                          </Tag>
                        ))}
                      </div>
                    </Form.Item>
                  )}
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
                                {t('workflowList.clear')}
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
                          color: selectedNode.data.specifiedUsers ? '#000' : '#999',
                          backgroundColor: selectedNode.data.specifiedUsers ? '#fff' : '#f5f5f5',
                          width: '100%',
                          minWidth: '300px'
                        }}
                      />
                    </Form.Item>
                  )}
                  
                  <Form.Item label={t('workflowDesigner.replyMessage')} name="message">
                    <Input.TextArea 
                      rows={3} 
                      placeholder={t('workflowDesigner.replyMessagePlaceholder')}
                    />
                  </Form.Item>
                </>
              )}
              {selectedNode.data.type === 'waitForQRCode' && (
                <>
                  <Form.Item label={t('workflowDesigner.qrCodeVariable')} name="qrCodeVariable">
                    <Input placeholder={t('workflowDesigner.qrCodeVariablePlaceholder')} />
                  </Form.Item>
                  <Form.Item label={t('workflowDesigner.qrCodeMessage')} name="message">
                    <Input.TextArea 
                      rows={3} 
                      placeholder={t('workflowDesigner.qrCodeMessagePlaceholder')}
                    />
                  </Form.Item>
                  <Form.Item label={t('workflowDesigner.timeout')} name="timeout">
                    <Input 
                      type="number" 
                      placeholder={t('workflowDesigner.timeoutPlaceholder')}
                      suffix={t('workflowDesigner.seconds')}
                    />
                  </Form.Item>
                </>
              )}
               {selectedNode.data.type === 'switch' && (
                 <>
                   <Form.Item label={t('workflowDesigner.conditionGroups')}>
                     <div style={{ marginBottom: '8px' }}>
                       <Button 
                         type="dashed" 
                         onClick={() => {
                           const newGroup = {
                             id: `group${Date.now()}`,
                             relation: 'and',
                             conditions: [],
                             outputPath: '',
                             groupIndex: -1
                           };
                           setEditingConditionGroup(newGroup);
                           setConditionGroupModalVisible(true);
                         }}
                         style={{ width: '100%' }}
                       >
                         {t('workflowDesigner.addConditionGroup')}
                       </Button>
                     </div>
                     {(() => {
                       // 從 nodes 狀態中獲取最新的節點數據
                       const currentNode = nodes.find(node => node.id === selectedNode?.id);
                       const currentConditionGroups = currentNode?.data?.conditionGroups || [];
                       return currentConditionGroups.map((group, groupIndex) => (
                         <Card 
                           key={group.id} 
                           size="small" 
                           style={{ 
                             marginBottom: '8px', 
                             border: '1px solid #d9d9d9',
                             cursor: 'pointer'
                           }}
                           onClick={() => {
                             setEditingConditionGroup({ ...group, groupIndex });
                             setConditionGroupModalVisible(true);
                           }}
                         >
                           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                             <div>
                               <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '4px' }}>
                                 {t('workflowDesigner.conditionGroup')} {groupIndex + 1}
                               </div>
                               <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                                 {t('workflowDesigner.conditions')}: {group.conditions?.length || 0}
                                 {group.relation && ` • ${group.relation.toUpperCase()}`}
                               </div>
                               {group.conditions && group.conditions.length > 0 && (
                                 <div style={{ fontSize: '11px', color: '#999' }}>
                                   {group.conditions.slice(0, 2).map(condition => 
                                     `${condition.variableName} ${condition.operator} ${condition.value}`
                                   ).join(', ')}
                                   {group.conditions.length > 2 && ` +${group.conditions.length - 2} more`}
                                 </div>
                               )}
                               {group.outputPath && selectedNode && (
                                 <div style={{ fontSize: '11px', color: '#1890ff', marginTop: '2px' }}>
                                   → {getAvailableOutputPaths(selectedNode.id, edges, nodes, t).find(p => p.id === group.outputPath)?.label || group.outputPath}
                                 </div>
                               )}
                             </div>
                             <div style={{ display: 'flex', gap: '4px' }}>
                               <Button 
                                 type="text" 
                                 size="small"
                                 icon={<EditOutlined />}
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   setEditingConditionGroup({ ...group, groupIndex });
                                   setConditionGroupModalVisible(true);
                                 }}
                               />
                               <Button 
                                 type="text" 
                                 danger 
                                 size="small"
                                 icon={<DeleteOutlined />}
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   const currentNode = nodes.find(node => node.id === selectedNode?.id);
                                   const currentGroups = currentNode?.data?.conditionGroups || [];
                                   const newGroups = currentGroups.filter((_, i) => i !== groupIndex);
                                   setNodes(prev => prev.map(node => 
                                     node.id === selectedNode?.id 
                                       ? { ...node, data: { ...node.data, conditionGroups: newGroups } }
                                       : node
                                   ));
                                 }}
                               />
                             </div>
                           </div>
                         </Card>
                       ));
                     })()}
                   </Form.Item>
                   
                   <Form.Item label={t('workflowDesigner.defaultPath')}>
                     <div style={{ 
                       padding: '8px 12px', 
                       border: '1px solid #d9d9d9', 
                       borderRadius: '6px',
                       backgroundColor: '#fafafa',
                       cursor: 'pointer'
                     }}
                     onClick={() => {
                       setDefaultPathModalVisible(true);
                     }}
                     >
                       {selectedNode?.data?.defaultPath ? (
                         <span style={{ color: '#1890ff' }}>
                           → {selectedNode && getAvailableOutputPaths(selectedNode.id, edges, nodes, t).find(p => p.id === selectedNode.data.defaultPath)?.label || selectedNode?.data?.defaultPath}
                         </span>
                       ) : (
                         <span style={{ color: '#999' }}>
                           {t('workflowDesigner.clickToSelectDefaultPath')}
                         </span>
                       )}
                     </div>
                   </Form.Item>
                 </>
               )}
              {selectedNode.data.type === 'dbQuery' && (
                <Form.Item label={t('workflowDesigner.sqlQuery')} name="sql">
                  <Input.TextArea 
                    rows={6} 
                    placeholder={t('workflowDesigner.sqlQueryPlaceholder')}
                  />
                </Form.Item>
              )}
              {selectedNode.data.type === 'callApi' && (
                <Form.Item label={t('workflowDesigner.apiUrl')} name="url">
                  <Input placeholder={t('workflowDesigner.apiUrlPlaceholder')} />
                </Form.Item>
              )}
              {selectedNode.data.type === 'sendEForm' && (
                <>
                  <Form.Item label={t('workflowDesigner.eForm')}>
                    <Input 
                      value={selectedNode.data.formName || ''}
                      placeholder={t('workflowDesigner.selectEForm')} 
                      readOnly 
                      onClick={() => setIsEFormModalVisible(true)}
                      suffix={<FormOutlined />}
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
                  <ProcessVariableSelect
                    label={t('workflowDesigner.approvalResultVariable')}
                    name="approvalResultVariable"
                    placeholder={t('workflowDesigner.selectApprovalResultVariable')}
                    processVariables={processVariables}
                  />
                </>
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

      {/* 模態框組件 */}
       <TemplateModal
         visible={isTemplateModalVisible}
         onCancel={() => setIsTemplateModalVisible(false)}
         templates={templates}
         onSelectTemplate={handleSelectTemplate}
         t={t}
       />

       <UserModal
         visible={isUserModalVisible}
         onCancel={() => setIsUserModalVisible(false)}
         users={users}
         onSelectUser={handleSelectUser}
         t={t}
       />

       <EFormModal
         visible={isEFormModalVisible}
         onCancel={() => setIsEFormModalVisible(false)}
         eforms={eforms}
         onSelectEForm={handleSelectEForm}
         t={t}
       />

      <ProcessVariablesModal
        visible={processVariablesModalVisible}
        onCancel={() => setProcessVariablesModalVisible(false)}
        processVariables={processVariables}
        selectedProcessVariable={selectedProcessVariable}
        editingProcessVariable={editingProcessVariable}
        processVariableForm={processVariableForm}
        onAddProcessVariable={() => {
          const newVariable = {
            id: null,
            workflowDefinitionId: workflowId,
            variableName: '',
            displayName: '',
            dataType: 'string',
            description: '',
            isRequired: false,
            defaultValue: '',
            validationRules: '',
            jsonSchema: ''
          };
          setEditingProcessVariable(newVariable);
          setSelectedProcessVariable(newVariable);
          processVariableForm.setFieldsValue(newVariable);
        }}
        onEditProcessVariable={(variable) => {
          setEditingProcessVariable(variable);
          setSelectedProcessVariable(variable);
          processVariableForm.setFieldsValue(variable);
        }}
         onDeleteProcessVariable={async (variableId) => {
           try {
             const token = localStorage.getItem('token');
             const response = await fetch(`/api/processvariables/definitions/${variableId}`, {
               method: 'DELETE',
               headers: {
                 'Authorization': `Bearer ${token}`
               }
             });
             
             if (response.ok) {
               message.success(t('processVariables.deleteSuccess'));
               fetchProcessVariables();
               if (selectedProcessVariable && selectedProcessVariable.id === variableId) {
                 setSelectedProcessVariable(null);
                 setEditingProcessVariable(null);
                 processVariableForm.resetFields();
               }
             } else {
               message.error(t('processVariables.deleteFailed'));
             }
           } catch (error) {
             console.error('刪除流程變量失敗:', error);
             message.error(t('processVariables.deleteFailed'));
           }
         }}
         onSaveProcessVariable={async (values) => {
           try {
             // 如果沒有 values，先驗證表單
             if (!values) {
               values = await processVariableForm.validateFields();
             }
             
             const token = localStorage.getItem('token');
             
             const variableData = {
               ...values,
               workflowDefinitionId: workflowId
             };
             
             console.log('保存流程變量 - 接收到的 values:', values);
             console.log('保存流程變量 - variableData:', variableData);
             console.log('保存流程變量 - editingProcessVariable:', editingProcessVariable);
             
             let response;
             if (editingProcessVariable && editingProcessVariable.id) {
               // 更新現有變量
               response = await fetch(`/api/processvariables/definitions/${editingProcessVariable.id}`, {
                 method: 'PUT',
                 headers: {
                   'Content-Type': 'application/json',
                   'Authorization': `Bearer ${token}`
                 },
                 body: JSON.stringify(variableData)
               });
             } else {
               // 創建新變量
               response = await fetch('/api/processvariables/definitions', {
                 method: 'POST',
                 headers: {
                   'Content-Type': 'application/json',
                   'Authorization': `Bearer ${token}`
                 },
                 body: JSON.stringify(variableData)
               });
             }
             
             if (response.ok) {
               message.success(editingProcessVariable && editingProcessVariable.id ? t('processVariables.updateSuccess') : t('processVariables.createSuccess'));
               fetchProcessVariables();
               setEditingProcessVariable(null);
               setSelectedProcessVariable(null);
               processVariableForm.resetFields();
             } else {
               const errorText = await response.text();
               console.error('API 錯誤響應:', errorText);
               
               let errorMessage = editingProcessVariable && editingProcessVariable.id ? t('processVariables.updateFailed') : t('processVariables.createFailed');
               
               try {
                 const errorData = JSON.parse(errorText);
                 if (errorData.message && errorData.message.includes('database triggers')) {
                   errorMessage = '數據庫配置問題：請聯繫管理員檢查數據庫觸發器配置。這是一個後端配置問題，需要修復 Entity Framework Core 與 SQL Server 觸發器的兼容性。';
                 } else if (errorData.message) {
                   errorMessage = errorData.message;
                 }
               } catch (e) {
                 // 如果無法解析 JSON，使用默認錯誤信息
               }
               
               message.error(errorMessage);
             }
           } catch (error) {
             console.error('保存流程變量失敗:', error);
             message.error(t('processVariables.saveFailed'));
           }
         }}
        onCancelProcessVariableEdit={() => {
          setEditingProcessVariable(null);
          processVariableForm.resetFields();
        }}
         t={t}
       />

       {/* 條件群組編輯 Modal */}
       <ConditionGroupModal
         visible={conditionGroupModalVisible}
         onCancel={() => {
           setConditionGroupModalVisible(false);
           setEditingConditionGroup(null);
           conditionGroupForm.resetFields();
         }}
         editingConditionGroup={editingConditionGroup}
         conditionGroupForm={conditionGroupForm}
         selectedNode={selectedNode}
         getAvailableOutputPaths={(nodeId) => getAvailableOutputPaths(nodeId, edges, nodes, t)}
         onSave={(values) => {
           if (editingConditionGroup) {
             const updatedGroup = {
               ...editingConditionGroup,
               ...values,
               id: editingConditionGroup.id || `group_${Date.now()}`
             };
             
             if (editingConditionGroup.groupIndex === -1) {
               // 新增群組
               const currentGroups = selectedNode?.data?.conditionGroups || [];
               const newGroups = [...currentGroups, updatedGroup];
               handleNodeDataChange({ conditionGroups: newGroups });
             } else {
               // 更新現有群組
               const currentGroups = selectedNode?.data?.conditionGroups || [];
               const newGroups = [...currentGroups];
               newGroups[editingConditionGroup.groupIndex] = updatedGroup;
               handleNodeDataChange({ conditionGroups: newGroups });
             }
           }
           setConditionGroupModalVisible(false);
           setEditingConditionGroup(null);
           conditionGroupForm.resetFields();
         }}
         onEditCondition={(condition, condIndex) => {
           setEditingCondition({ ...condition, groupIndex: editingConditionGroup.groupIndex, condIndex });
           setConditionModalVisible(true);
         }}
         onAddCondition={() => {
           setEditingCondition({ groupIndex: editingConditionGroup.groupIndex, condIndex: -1 });
           setConditionModalVisible(true);
         }}
         onDeleteCondition={(condIndex) => {
           const currentConditions = editingConditionGroup.conditions || [];
           const newConditions = currentConditions.filter((_, i) => i !== condIndex);
           setEditingConditionGroup({ ...editingConditionGroup, conditions: newConditions });
         }}
         t={t}
       />

       {/* 條件編輯 Modal */}
       <ConditionModal
         visible={conditionModalVisible}
         onCancel={() => {
           setConditionModalVisible(false);
           setEditingCondition(null);
           conditionForm.resetFields();
         }}
         editingCondition={editingCondition}
         conditionForm={conditionForm}
         processVariables={processVariables}
         onSave={(values) => {
           if (editingCondition && selectedNode) {
             const condition = {
               id: editingCondition.id || `condition_${Date.now()}`,
               variableName: values.variableName,
               operator: values.operator,
               value: values.value,
               label: values.label || `${values.variableName} ${values.operator} ${values.value}`
             };
             
             const currentGroups = selectedNode.data.conditionGroups || [];
             const newGroups = [...currentGroups];
             
             if (editingCondition.groupIndex >= 0 && newGroups[editingCondition.groupIndex]) {
               if (!newGroups[editingCondition.groupIndex].conditions) {
                 newGroups[editingCondition.groupIndex].conditions = [];
               }
               
               if (editingCondition.condIndex === -1) {
                 // 新增條件
                 newGroups[editingCondition.groupIndex].conditions.push(condition);
               } else {
                 // 更新現有條件
                 newGroups[editingCondition.groupIndex].conditions[editingCondition.condIndex] = condition;
               }
               
               handleNodeDataChange({ conditionGroups: newGroups });
             }
           }
           setConditionModalVisible(false);
           setEditingCondition(null);
           conditionForm.resetFields();
         }}
         t={t}
       />

       {/* 默認路徑選擇 Modal */}
       <DefaultPathModal
         visible={defaultPathModalVisible}
         onCancel={() => setDefaultPathModalVisible(false)}
         selectedNode={selectedNode}
         availablePaths={selectedNode ? getAvailableOutputPaths(selectedNode.id, edges, nodes, t) : []}
         onSelectPath={(pathId) => {
           if (selectedNode) {
             handleNodeDataChange({ defaultPath: pathId });
           }
           setDefaultPathModalVisible(false);
         }}
         t={t}
       />
     </div>
   );
};

export default WhatsAppWorkflowDesigner;
