import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiService } from '../services/apiService';
import { handleApiError } from '../utils';
import { MOCK_DATA } from '../constants';

// 數據獲取管理 Hook
export const useDataFetching = () => {
  const [searchParams] = useSearchParams();
  const workflowId = searchParams.get('id');
  
  // 工作流程基本信息
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [createdAt, setCreatedAt] = useState('');
  const [updatedAt, setUpdatedAt] = useState('');
  const [createdBy, setCreatedBy] = useState('');
  const [updatedBy, setUpdatedBy] = useState('');
  const [status, setStatus] = useState('');
  
  // 模板相關
  const [templates, setTemplates] = useState([]);
  const [isTemplateModalVisible, setIsTemplateModalVisible] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  
  // 用戶相關
  const [users, setUsers] = useState([]);
  const [isUserModalVisible, setIsUserModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  
  // EForm 相關
  const [eforms, setEforms] = useState([]);
  const [isEFormModalVisible, setIsEFormModalVisible] = useState(false);
  const [selectedEForm, setSelectedEForm] = useState(null);
  
  // 收件人相關
  const [isRecipientModalVisible, setIsRecipientModalVisible] = useState(false);
  
  // 節點類型定義
  const [nodeTypeDefinitions, setNodeTypeDefinitions] = useState([]);
  const [loadingNodeTypes, setLoadingNodeTypes] = useState(true);
  
  // 流程變量相關
  const [processVariables, setProcessVariables] = useState([]);
  const [processVariablesModalVisible, setProcessVariablesModalVisible] = useState(false);
  const [selectedProcessVariable, setSelectedProcessVariable] = useState(null);
  const [editingProcessVariable, setEditingProcessVariable] = useState(null);
  
  // 獲取模板列表
  const fetchTemplates = useCallback(async () => {
    try {
      const templates = await apiService.fetchTemplates();
      setTemplates(templates);
    } catch (error) {
      handleApiError(error, MOCK_DATA.templates, setTemplates, '獲取模板列表錯誤');
    }
  }, []);

  // 獲取用戶列表
  const fetchUsers = useCallback(async () => {
    try {
      const users = await apiService.fetchUsers();
      setUsers(users);
    } catch (error) {
      handleApiError(error, MOCK_DATA.users, setUsers, '獲取用戶列表錯誤');
    }
  }, []);

  // 獲取 EForm 列表
  const fetchEForms = useCallback(async () => {
    try {
      const eforms = await apiService.fetchEForms();
      setEforms(eforms);
    } catch (error) {
      handleApiError(error, MOCK_DATA.eforms, setEforms, '獲取 EForm 列表錯誤');
    }
  }, []);

  // 獲取節點類型定義
  const fetchNodeTypeDefinitions = useCallback(async (nodeTypes) => {
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
  }, []);

  // 獲取流程變量
  const fetchProcessVariables = useCallback(async () => {
    if (!workflowId) return;
    
    try {
      const variables = await apiService.fetchProcessVariables(workflowId);
      setProcessVariables(variables);
    } catch (error) {
      console.error('獲取流程變量失敗:', error);
      setProcessVariables([]);
    }
  }, [workflowId]);

  // 載入現有流程資料
  const loadWorkflow = useCallback(async (setNodes, setEdges, nodeTypes, handleDeleteNode, onEdgeSwitch) => {
    if (!workflowId) return;
    
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
            // 重新添加圖標組件並確保正確的 React Flow 類型
            const nodesWithIcons = flow.nodes.map(node => {
              const nodeType = nodeTypes.find(n => n.type === node.data.type);
              
              // 確定節點的 React Flow 類型
              let reactFlowType;
              if (node.data.type === 'start') {
                reactFlowType = 'input';
              } else if (node.data.type === 'end') {
                reactFlowType = 'output';
              } else {
                reactFlowType = 'default';
              }
              
              return {
                ...node,
                type: reactFlowType, // 確保使用正確的 React Flow 類型
                data: {
                  ...node.data,
                  icon: nodeType ? nodeType.icon : null,
                  label: node.data.label || nodeType?.label || node.data.type,
                  taskName: node.data.taskName || node.data.label || nodeType?.label || node.data.type, // 確保 taskName 被設置
                  onDelete: node.data.type === 'start' ? null : handleDeleteNode // Start 節點不能刪除，其他節點使用 handleDeleteNode
                }
              };
            });
            setNodes(nodesWithIcons);
          }
          if (flow.edges) {
            // 設置連線，確保有正確的樣式和 onEdgeSwitch 函數
            const edgesWithStyle = flow.edges.map(edge => ({
              ...edge,
              type: edge.type || 'smoothstep',
              animated: edge.animated !== undefined ? edge.animated : true,
              style: edge.style || { 
                strokeWidth: 3,
                stroke: '#1890ff'
              },
              markerEnd: edge.markerEnd || {
                type: 'arrowclosed',
                width: 12,
                height: 12,
                color: '#1890ff',
              },
              // 重新添加 onEdgeSwitch 函數，因為函數無法序列化
              data: {
                ...edge.data,
                onEdgeSwitch: onEdgeSwitch
              }
            }));
            setEdges(edgesWithStyle);
            // console.log('載入連線:', edgesWithStyle); // 已移除以避免控制台噪音
          }
        } catch (parseError) {
          console.error('解析流程 JSON 失敗:', parseError);
        }
      }
    } catch (error) {
      console.error('載入流程定義失敗:', error);
      throw error;
    }
  }, [workflowId]);

  // 初始化數據
  const initializeData = useCallback(async (nodeTypes, setNodes, setEdges, handleDeleteNode, onEdgeSwitch) => {
    setStatus('');
    await fetchNodeTypeDefinitions(nodeTypes);
    await fetchTemplates();
    await fetchUsers();
    await fetchEForms();
    
    if (workflowId) {
      await fetchProcessVariables();
      await loadWorkflow(setNodes, setEdges, nodeTypes, handleDeleteNode, onEdgeSwitch);
    }
  }, [workflowId, fetchNodeTypeDefinitions, fetchTemplates, fetchUsers, fetchEForms, fetchProcessVariables, loadWorkflow]);

  return {
    // 工作流程基本信息
    name,
    setName,
    description,
    setDescription,
    createdAt,
    setCreatedAt,
    updatedAt,
    setUpdatedAt,
    createdBy,
    setCreatedBy,
    updatedBy,
    setUpdatedBy,
    status,
    setStatus,
    workflowId,
    
    // 模板相關
    templates,
    setTemplates,
    isTemplateModalVisible,
    setIsTemplateModalVisible,
    selectedTemplate,
    setSelectedTemplate,
    
    // 用戶相關
    users,
    setUsers,
    isUserModalVisible,
    setIsUserModalVisible,
    selectedUser,
    setSelectedUser,
    
    // EForm 相關
    eforms,
    setEforms,
    isEFormModalVisible,
    setIsEFormModalVisible,
    selectedEForm,
    setSelectedEForm,
    
    // 節點類型定義
    nodeTypeDefinitions,
    setNodeTypeDefinitions,
    loadingNodeTypes,
    setLoadingNodeTypes,
    
    // 流程變量相關
    processVariables,
    setProcessVariables,
    processVariablesModalVisible,
    setProcessVariablesModalVisible,
    selectedProcessVariable,
    setSelectedProcessVariable,
    editingProcessVariable,
    setEditingProcessVariable,
    
    // 收件人相關
    isRecipientModalVisible,
    setIsRecipientModalVisible,
    
    // 數據獲取函數
    fetchTemplates,
    fetchUsers,
    fetchEForms,
    fetchNodeTypeDefinitions,
    fetchProcessVariables,
    loadWorkflow,
    initializeData,
  };
};
