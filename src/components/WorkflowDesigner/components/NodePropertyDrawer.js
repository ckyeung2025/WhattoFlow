import React, { useEffect, useMemo, useCallback, useState } from 'react';
import { Drawer, Form, Input, Select, Card, Button, Space, Tag, message, Alert, Table, Modal, Radio, Tabs, Divider, Switch } from 'antd';
import { MinusCircleOutlined, PlusOutlined, SettingOutlined, FormOutlined, EditOutlined, DeleteOutlined, MessageOutlined, FileTextOutlined, BellOutlined, FullscreenOutlined, FullscreenExitOutlined, ClockCircleOutlined, CloseOutlined } from '@ant-design/icons';
import ProcessVariableSelect from './ProcessVariableSelect';
import RecipientModal from '../modals/RecipientModal';
import RecipientSelector from './RecipientSelector';
import DataSetQueryConditionModal from '../modals/DataSetQueryConditionModal';
import DataSetQueryConditionEditModal from '../modals/DataSetQueryConditionEditModal';
import DataSetFieldMappingModal from '../modals/DataSetFieldMappingModal';
import MessageModeTabsComponent from './MessageModeTabsComponent';
import QRCodeMessageTabsComponent from './QRCodeMessageTabsComponent';
import WaitReplyMessageTabsComponent from './WaitReplyMessageTabsComponent';
import TimeValidatorConfigSection from './TimeValidatorConfigSection';
import TemplateModal from '../modals/TemplateModal';
import { getAvailableOutputPaths } from '../utils';
import { apiService } from '../services/apiService';
import './NodePropertyDrawer.css';

// 節點屬性編輯抽屜組件
const NodePropertyDrawer = ({
  selectedNode,
  drawerOpen,
  setDrawerOpen,
  form,
  handleNodeDataChange,
  processVariables,
  nodes,
  edges,
  workflowId,
  t,
  templates,
  metaTemplates,
  // 模態框狀態
  isTemplateModalVisible,
  setIsTemplateModalVisible,
  isUserModalVisible,
  setIsUserModalVisible,
  isEFormModalVisible,
  setIsEFormModalVisible,
  isRecipientModalVisible,
  setIsRecipientModalVisible,
  // 條件相關狀態
  conditionModalVisible,
  setConditionModalVisible,
  conditionGroupModalVisible,
  setConditionGroupModalVisible,
  defaultPathModalVisible,
  setDefaultPathModalVisible,
  editingCondition,
  setEditingCondition,
  editingConditionGroup,
  setEditingConditionGroup,
  conditionForm,
  conditionGroupForm,
  // 處理函數
  handleSelectTemplate,
  handleSelectUser,
  handleSelectEForm,
  onSaveConditionGroup,
  onEditCondition,
  onAddCondition,
  onDeleteCondition,
  onSelectPath,
  // 新增：Time Validator 模板選擇相關
  templateModalSource,
  setTemplateModalSource,
  handleTimeValidatorTemplateSelect,
}) => {
  // 獲取 DataSet Query 節點
  const dataSetQueryNodes = nodes.filter(node => 
    node.data?.type === 'dataSetQuery' && 
    node.data?.operationType === 'SELECT'
  );
  
  // DataSet 相關狀態
  const [dataSets, setDataSets] = useState([]);
  const [dataSetColumns, setDataSetColumns] = useState([]);
  const [operationDataFields, setOperationDataFields] = useState([]);
  const [availableProcessVariables, setAvailableProcessVariables] = useState([]);
  const [loadingDataSets, setLoadingDataSets] = useState(false);
  const [testingOperation, setTestingOperation] = useState(false);

  const [aiProviders, setAiProviders] = useState([]);
  const [loadingAiProviders, setLoadingAiProviders] = useState(false);
  const [aiProvidersError, setAiProvidersError] = useState(null);
  
  // DataSet 查詢條件相關狀態
  const [dataSetConditionGroupModalVisible, setDataSetConditionGroupModalVisible] = useState(false);
  const [dataSetConditionEditModalVisible, setDataSetConditionEditModalVisible] = useState(false);
  const [editingDataSetConditionGroup, setEditingDataSetConditionGroup] = useState(null);
  const [editingDataSetCondition, setEditingDataSetCondition] = useState(null);
  const [dataSetConditionGroupForm] = Form.useForm();
  const [dataSetConditionForm] = Form.useForm();
  
  // DataSet 欄位映射相關狀態
  const [dataSetFieldMappingModalVisible, setDataSetFieldMappingModalVisible] = useState(false);
  const [dataSetFieldMappingForm] = Form.useForm();
  
  // 操作數據設置相關狀態
  const [operationDataModalVisible, setOperationDataModalVisible] = useState(false);
  const [editingOperationData, setEditingOperationData] = useState([]);
  
  // PV 模擬數據相關狀態
  const [pvSimulationData, setPvSimulationData] = useState({});
  const [showPvSimulation, setShowPvSimulation] = useState(false);
  
  // 查詢結果預覽狀態
  const [queryPreviewData, setQueryPreviewData] = useState([]);
  const [showQueryPreview, setShowQueryPreview] = useState(false);
  const [queryPreviewModalVisible, setQueryPreviewModalVisible] = useState(false);

  // Time Validator 相關狀態（Wait for Reply 節點）
  const [retryMessageExpanded, setRetryMessageExpanded] = useState(false);
  const [escalationConfigExpanded, setEscalationConfigExpanded] = useState(false);
  const [timeValidatorRecipientModalVisible, setTimeValidatorRecipientModalVisible] = useState(false); // Time Validator 專用的 Recipient Modal
  
  // Overdue Settings 相關狀態（Start 節點）
  const [overdueEscalationExpanded, setOverdueEscalationExpanded] = useState(false);
  
  // Drawer 全屏狀態
  const [isFullscreen, setIsFullscreen] = useState(false);

  const watchedValidatorType = Form.useWatch(['validation', 'validatorType'], form);
  const watchedAiIsActive = Form.useWatch(['validation', 'aiIsActive'], form);
  const watchedTimeIsActive = Form.useWatch(['validation', 'timeIsActive'], form);

  const aiIsActive = typeof watchedAiIsActive === 'boolean'
    ? watchedAiIsActive
    : (selectedNode?.data?.validation?.aiIsActive ?? false);

  const timeIsActive = typeof watchedTimeIsActive === 'boolean'
    ? watchedTimeIsActive
    : (selectedNode?.data?.validation?.timeIsActive ?? false);

  const normalizedValidatorType = ((watchedValidatorType ?? selectedNode?.data?.validation?.validatorType) || '').toLowerCase();

  const allowedValidatorTypes = ['ai', 'time'];
  const [activeValidatorTab, setActiveValidatorTab] = useState(
    allowedValidatorTypes.includes(normalizedValidatorType) ? normalizedValidatorType : 'ai'
  );

  const syncValidationState = useCallback((updates) => {
    if (!selectedNode) {
      return;
    }

    const currentFormValidation = form?.getFieldValue?.('validation') || {};
    const mergedValidation = {
      ...(selectedNode.data.validation || {}),
      ...currentFormValidation,
      ...updates
    };

    const aiActive = mergedValidation.aiIsActive ?? false;
    const timeActive = mergedValidation.timeIsActive ?? false;

    // ✅ 簡化：validatorType 僅用於決定初始 tab 顯示，不再強制設置
    // 如果沒有明確設置，根據 IsActive 狀態推斷（僅用於向後兼容）
    if (!updates.validatorType && !mergedValidation.validatorType) {
      mergedValidation.validatorType = aiActive ? 'ai' : timeActive ? 'time' : 'ai';
    }

    mergedValidation.enabled = aiActive || timeActive;

    form?.setFieldsValue?.({
      validation: mergedValidation
    });

    handleNodeDataChange({
      validation: mergedValidation
    });
  }, [allowedValidatorTypes, form, handleNodeDataChange, selectedNode]);

  const handleValidatorToggle = useCallback((key, isActive) => {
    const updates = key === 'ai'
      ? { aiIsActive: isActive }
      : { timeIsActive: isActive }; // 明確設置 timeIsActive 為 true 或 false

    // ✅ 簡化：不再強制設置 validatorType，僅在啟用時切換到對應的 tab
    syncValidationState(updates);

    if (isActive) {
      setActiveValidatorTab(key);
    }
  }, [syncValidationState]);

  useEffect(() => {
    if (aiIsActive && !timeIsActive) {
      setActiveValidatorTab('ai');
    } else if (!aiIsActive && timeIsActive) {
      setActiveValidatorTab('time');
    } else if (!aiIsActive && !timeIsActive) {
      const next = allowedValidatorTypes.includes(normalizedValidatorType) ? normalizedValidatorType : 'ai';
      setActiveValidatorTab(next);
    }
  }, [aiIsActive, timeIsActive, normalizedValidatorType]);

  // 監聽 Time Validator 模板選擇事件
  useEffect(() => {
    const handleTimeValidatorTemplateSelected = (event) => {
      const { template, isMetaTemplate, source } = event.detail;
      console.log('🎯 NodePropertyDrawer 收到 Time Validator 模板選擇事件:', { template: template.name, isMetaTemplate, source });
      
      // 根據來源直接更新節點數據（不再使用臨時狀態）
      if (source === 'retryMessage') {
        const currentConfig = selectedNode?.data?.validation?.retryMessageConfig || {};
        const newValidation = {
          ...(selectedNode.data.validation || {}),
          retryMessageConfig: {
            ...currentConfig,
            useTemplate: true,
            messageMode: 'template',
            templateId: template.id,
            templateName: template.name,
            isMetaTemplate: isMetaTemplate,
            templateLanguage: template.language || null
          }
        };
        handleNodeDataChange({ validation: newValidation });
      } else if (source === 'escalation') {
        const currentConfig = selectedNode?.data?.validation?.escalationConfig || {};
        const newValidation = {
          ...(selectedNode.data.validation || {}),
          escalationConfig: {
            ...currentConfig,
            useTemplate: true,
            messageMode: 'template',
            templateId: template.id,
            templateName: template.name,
            isMetaTemplate: isMetaTemplate,
            templateLanguage: template.language || null
          }
        };
        handleNodeDataChange({ validation: newValidation });
      } else if (source === 'overdue') {
        const currentConfig = selectedNode?.data?.overdueConfig?.escalationConfig || {};
        const newOverdueConfig = {
          ...(selectedNode.data.overdueConfig || {}),
          escalationConfig: {
            ...currentConfig,
            useTemplate: true,
            messageMode: 'template',
            templateId: template.id,
            templateName: template.name,
            isMetaTemplate: isMetaTemplate,
            templateLanguage: template.language || null
          }
        };
        handleNodeDataChange({ overdueConfig: newOverdueConfig });
      }
    };

    window.addEventListener('timeValidatorTemplateSelected', handleTimeValidatorTemplateSelected);
    
    return () => {
      window.removeEventListener('timeValidatorTemplateSelected', handleTimeValidatorTemplateSelected);
    };
  }, []); // 移除 selectedNode 依賴，避免不必要的重新註冊


  // 生成 WHERE 子句的函數
  const generateWhereClause = (conditionGroups) => {
    if (!conditionGroups || conditionGroups.length === 0) {
      return '';
    }

    return conditionGroups.map(group => {
      if (!group.conditions || group.conditions.length === 0) {
        return '';
      }

      const groupConditions = group.conditions.map(condition => {
        const { fieldName, operator, value } = condition;
        
        // 安全處理欄位名稱 - 使用方括號包圍
        const safeFieldName = `[${fieldName}]`;
        
        // 安全處理值 - 轉義單引號
        const safeValue = value ? value.toString().replace(/'/g, "''") : '';
        
        // 根據操作符生成條件
        switch (operator) {
          case 'equals':
            return `${safeFieldName} = '${safeValue}'`;
          case 'notEquals':
            return `${safeFieldName} != '${safeValue}'`;
          case 'greaterThan':
            return `${safeFieldName} > '${safeValue}'`;
          case 'lessThan':
            return `${safeFieldName} < '${safeValue}'`;
          case 'greaterThanOrEqual':
            return `${safeFieldName} >= '${safeValue}'`;
          case 'lessThanOrEqual':
            return `${safeFieldName} <= '${safeValue}'`;
          case 'contains':
            return `${safeFieldName} LIKE '%${safeValue}%'`;
          case 'startsWith':
            return `${safeFieldName} LIKE '${safeValue}%'`;
          case 'endsWith':
            return `${safeFieldName} LIKE '%${safeValue}'`;
          case 'isEmpty':
            return `${safeFieldName} IS NULL OR ${safeFieldName} = ''`;
          case 'isNotEmpty':
            return `${safeFieldName} IS NOT NULL AND ${safeFieldName} != ''`;
          case 'in':
            // 對於 IN 操作，需要處理多個值
            const inValues = safeValue.split(',').map(v => `'${v.trim()}'`).join(', ');
            return `${safeFieldName} IN (${inValues})`;
          case 'notIn':
            // 對於 NOT IN 操作，需要處理多個值
            const notInValues = safeValue.split(',').map(v => `'${v.trim()}'`).join(', ');
            return `${safeFieldName} NOT IN (${notInValues})`;
          default:
            return `${safeFieldName} = '${safeValue}'`;
        }
      }).join(` ${group.relation.toUpperCase()} `);

      return `(${groupConditions})`;
    }).join(' AND ');
  };

  // 提取查詢條件中使用的流程變量
  const extractProcessVariablesFromConditions = (conditionGroups) => {
    const variables = new Set();
    
    if (!conditionGroups || conditionGroups.length === 0) {
      return [];
    }
    
    conditionGroups.forEach(group => {
      if (group.conditions) {
        group.conditions.forEach(condition => {
          if (condition.value && condition.value.includes('${')) {
            // 提取 ${variableName} 格式的變量
            const matches = condition.value.match(/\$\{([^}]+)\}/g);
            if (matches) {
              matches.forEach(match => {
                const variableName = match.replace('${', '').replace('}', '');
                variables.add(variableName);
              });
            }
          }
        });
      }
    });
    
    return Array.from(variables);
  };

  const yesNoOptions = useMemo(() => ([
    { value: true, label: t('workflowDesigner.yes') },
    { value: false, label: t('workflowDesigner.no') }
  ]), [t]);

  const aiProviderOptions = useMemo(() => {
    return aiProviders.map(provider => ({
      value: provider.providerKey,
      label: `${provider.displayName}${provider.active ? '' : ` (${t('workflowDesigner.aiProviderInactive')})`}`,
      disabled: provider.active === false
    }));
  }, [aiProviders, t]);

  // 記憶化 sendEForm 的固定變量列表，避免每次渲染都創建新數組
  const sendEFormFixedVariables = useMemo(() => [
    {
      id: 'formName',
      name: 'formName',
      displayName: '{formName}',
      description: t('workflowDesigner.sendEForm.formNameVariable') || 'Form Name'
    },
    {
      id: 'formUrl',
      name: 'formUrl',
      displayName: '{formUrl}',
      description: t('workflowDesigner.sendEForm.formUrlVariable') || 'Form Link'
    }
  ], [t]);

  const loadAiProviders = useCallback(async () => {
    try {
      setLoadingAiProviders(true);
      setAiProvidersError(null);

      const token = localStorage.getItem('token');
      if (!token) {
        setAiProviders([]);
        return;
      }

      const response = await fetch('/api/apiproviders/company?category=AI', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      if (Array.isArray(data)) {
        setAiProviders(data);
      } else {
        setAiProviders([]);
      }
    } catch (error) {
      console.error('Failed to load AI providers', error);
      setAiProviders([]);
      setAiProvidersError(error.message || 'Failed to load AI providers');
    } finally {
      setLoadingAiProviders(false);
    }
  }, []);

  // DataSet 查詢條件處理函數
  const handleSaveDataSetConditionGroup = async (values) => {
    try {
      const currentNode = nodes.find(node => node.id === selectedNode?.id);
      const currentGroups = currentNode?.data?.queryConditionGroups || [];
      
      if (editingDataSetConditionGroup.groupIndex === -1) {
        // 新增條件群組
        const newGroup = {
          id: `conditionGroup${Date.now()}`,
          relation: values.relation,
          conditions: editingDataSetConditionGroup.conditions || []
        };
        const newGroups = [...currentGroups, newGroup];
        handleNodeDataChange({ queryConditionGroups: newGroups });
      } else {
        // 更新現有條件群組
        const newGroups = [...currentGroups];
        newGroups[editingDataSetConditionGroup.groupIndex] = {
          ...newGroups[editingDataSetConditionGroup.groupIndex],
          relation: values.relation,
          conditions: editingDataSetConditionGroup.conditions || []
        };
        handleNodeDataChange({ queryConditionGroups: newGroups });
      }
      
      setDataSetConditionGroupModalVisible(false);
      setEditingDataSetConditionGroup(null);
      dataSetConditionGroupForm.resetFields();
      message.success(t('workflowDesigner.dataSet.queryConditionGroupSaved'));
    } catch (error) {
      console.error(t('workflowDesigner.dataSet.queryConditionGroupSaveFailed') + ':', error);
      message.error(t('workflowDesigner.dataSet.queryConditionGroupSaveFailed'));
    }
  };

  const handleEditDataSetCondition = (condition, condIndex) => {
    setEditingDataSetCondition({ ...condition, condIndex });
    setDataSetConditionEditModalVisible(true);
    dataSetConditionForm.setFieldsValue({
      fieldName: condition.fieldName,
      operator: condition.operator,
      value: condition.value,
      label: condition.label
    });
  };

  const handleAddDataSetCondition = () => {
    setEditingDataSetCondition({ condIndex: -1 });
    setDataSetConditionEditModalVisible(true);
    dataSetConditionForm.resetFields();
  };

  const handleDeleteDataSetCondition = (condIndex) => {
    const newConditions = [...(editingDataSetConditionGroup?.conditions || [])];
    newConditions.splice(condIndex, 1);
    setEditingDataSetConditionGroup({
      ...editingDataSetConditionGroup,
      conditions: newConditions
    });
  };

  const handleSaveDataSetCondition = async (values) => {
    try {
      const newCondition = {
        id: `condition${Date.now()}`,
        fieldName: values.fieldName,
        operator: values.operator,
        value: values.value,
        label: values.label
      };
      
      const newConditions = [...(editingDataSetConditionGroup?.conditions || [])];
      
      if (editingDataSetCondition.condIndex === -1) {
        // 新增條件
        newConditions.push(newCondition);
      } else {
        // 更新現有條件
        newConditions[editingDataSetCondition.condIndex] = newCondition;
      }
      
      setEditingDataSetConditionGroup({
        ...editingDataSetConditionGroup,
        conditions: newConditions
      });
      
      setDataSetConditionEditModalVisible(false);
      setEditingDataSetCondition(null);
      dataSetConditionForm.resetFields();
      message.success(t('workflowDesigner.dataSet.queryConditionSaved'));
    } catch (error) {
      console.error(t('workflowDesigner.dataSet.queryConditionSaveFailed') + ':', error);
      message.error(t('workflowDesigner.dataSet.queryConditionSaveFailed'));
    }
  };

  // DataSet 欄位映射處理函數
  const handleSaveDataSetFieldMapping = async (mappedFields) => {
    try {
      handleNodeDataChange({ mappedFields });
      setDataSetFieldMappingModalVisible(false);
      dataSetFieldMappingForm.resetFields();
      message.success(t('workflowDesigner.dataSet.fieldMappingSaved'));
    } catch (error) {
      console.error(t('workflowDesigner.dataSet.fieldMappingSaveFailed') + ':', error);
      message.error(t('workflowDesigner.dataSet.fieldMappingSaveFailed'));
    }
  };

  // 處理操作數據設置
  const handleOpenOperationDataModal = () => {
    setEditingOperationData([...operationDataFields]);
    setOperationDataModalVisible(true);
  };

  const handleSaveOperationData = () => {
    setOperationDataFields([...editingOperationData]);
    setOperationDataModalVisible(false);
    message.success(t('workflowDesigner.dataSet.operationDataSaved'));
  };

  const handleCancelOperationData = () => {
    setOperationDataModalVisible(false);
  };

  const handleAddOperationDataField = () => {
    setEditingOperationData([...editingOperationData, { name: '', value: '' }]);
  };

  const handleRemoveOperationDataField = (index) => {
    const newFields = editingOperationData.filter((_, i) => i !== index);
    setEditingOperationData(newFields);
  };

  const handleUpdateOperationDataField = (index, field, value) => {
    const newFields = [...editingOperationData];
    newFields[index][field] = value;
    setEditingOperationData(newFields);
  };

  // 調試 workflowId 傳遞
  useEffect(() => {
    console.log('🔍 NodePropertyDrawer - workflowId 傳遞檢查:', workflowId, 'type:', typeof workflowId);
  }, [workflowId]);

  // 當 selectedNode 改變時，更新 Form 的字段值
  useEffect(() => {
    console.log('🔍 NodePropertyDrawer - workflowId:', workflowId, 'type:', typeof workflowId);
    console.log('🔍 NodePropertyDrawer - selectedNode:', selectedNode?.id);
    if (selectedNode && form && form.resetFields) {
      // 重置表單並設置新的初始值
      form.resetFields();
      const validation = selectedNode.data.validation || {};
      const normalizedInitialValidatorType = (validation.validatorType || '').toLowerCase();
      const derivedAiIsActive = typeof validation.aiIsActive === 'boolean'
        ? validation.aiIsActive
        : (validation.enabled === true && normalizedInitialValidatorType === 'ai');
      const derivedTimeIsActive = typeof validation.timeIsActive === 'boolean'
        ? validation.timeIsActive
        : (validation.enabled === true && normalizedInitialValidatorType === 'time');
      // 獲取 emailConfig，確保所有字段都存在
      const emailConfig = selectedNode.data.emailConfig || {};
      const emailConfigFields = {
        'emailConfig.providerKey': emailConfig.providerKey || '',
        'emailConfig.subject': emailConfig.subject || '',
        'emailConfig.body': emailConfig.body || '',
        'emailConfig.replyTo': emailConfig.replyTo || '',
      };

      form.setFieldsValue({
        taskName: selectedNode.data.taskName || selectedNode.data.label,
        to: selectedNode.data.to || '',
        message: selectedNode.data.message || '',
        templateName: selectedNode.data.templateName || '',
        timeout: selectedNode.data.timeout || '',
        sql: selectedNode.data.sql || '',
        url: selectedNode.data.url || '',
        formName: selectedNode.data.formName || '',
        result: selectedNode.data.result || '',
        replyType: selectedNode.data.replyType || '',
        specifiedUsers: selectedNode.data.specifiedUsers || '',
        qrCodeVariable: selectedNode.data.qrCodeVariable || '',
        // QR Code 提示訊息（使用 messageMode 和 message）
        messageMode: selectedNode.data.messageMode || 'direct',
        message: selectedNode.data.message || '',
        // QR Code 成功訊息
        qrCodeSuccessMessage: selectedNode.data.qrCodeSuccessMessage || t('workflowDesigner.dataSet.qrCodeSuccessMessage'),
        qrCodeSuccessMessageMode: selectedNode.data.qrCodeSuccessMessageMode || 'direct',
        qrCodeSuccessTemplateId: selectedNode.data.qrCodeSuccessTemplateId || '',
        qrCodeSuccessTemplateName: selectedNode.data.qrCodeSuccessTemplateName || '',
        qrCodeSuccessIsMetaTemplate: selectedNode.data.qrCodeSuccessIsMetaTemplate || false,
        qrCodeSuccessTemplateLanguage: selectedNode.data.qrCodeSuccessTemplateLanguage || null,
        qrCodeSuccessTemplateVariables: selectedNode.data.qrCodeSuccessTemplateVariables || [],
        // QR Code 錯誤訊息
        qrCodeErrorMessage: selectedNode.data.qrCodeErrorMessage || t('workflowDesigner.dataSet.qrCodeErrorMessage'),
        qrCodeErrorMessageMode: selectedNode.data.qrCodeErrorMessageMode || 'direct',
        qrCodeErrorTemplateId: selectedNode.data.qrCodeErrorTemplateId || '',
        qrCodeErrorTemplateName: selectedNode.data.qrCodeErrorTemplateName || '',
        qrCodeErrorIsMetaTemplate: selectedNode.data.qrCodeErrorIsMetaTemplate || false,
        qrCodeErrorTemplateLanguage: selectedNode.data.qrCodeErrorTemplateLanguage || null,
        qrCodeErrorTemplateVariables: selectedNode.data.qrCodeErrorTemplateVariables || [],
        approvalResultVariable: selectedNode.data.approvalResultVariable || '',
        activationType: selectedNode.data.activationType || 'manual',
        scheduledTable: selectedNode.data.scheduledTable || '',
        scheduledQuery: selectedNode.data.scheduledQuery || '',
        scheduledInterval: selectedNode.data.scheduledInterval || 300,
        validation: {
          ...validation,
          enabled: (validation.enabled ?? false) || derivedAiIsActive || derivedTimeIsActive,
          aiIsActive: derivedAiIsActive,
          timeIsActive: derivedTimeIsActive
        },
        // DataSet 查詢節點相關字段
        dataSetId: selectedNode.data.dataSetId || '',
        operationType: selectedNode.data.operationType || 'SELECT',
        queryConditions: selectedNode.data.queryConditions || '',
        operationData: selectedNode.data.operationData || {},
        mappedFields: selectedNode.data.mappedFields || [],
        // Email 配置字段
        ...emailConfigFields,
        ...selectedNode.data
      });
    }
  }, [selectedNode?.id, form]); // 只依賴 selectedNode.id，而不是整個 selectedNode 對象

  useEffect(() => {
    if (drawerOpen) {
      loadAiProviders();
    }
  }, [drawerOpen, loadAiProviders]);

  useEffect(() => {
    if (!selectedNode?.data?.validation) {
      return;
    }
    const rawType = selectedNode.data.validation.validatorType;
    if (!rawType) {
      return;
    }
    const normalizedType = rawType.toLowerCase();
    if (normalizedType === 'openai' || normalizedType === 'xai') {
      const fallbackProviderKey = selectedNode.data.validation.aiProviderKey || normalizedType;
      const newValidation = {
        ...selectedNode.data.validation,
        validatorType: 'ai',
        aiProviderKey: fallbackProviderKey
      };
      handleNodeDataChange({
        validation: newValidation,
        aiProviderKey: selectedNode.data.aiProviderKey ?? fallbackProviderKey
      });
    }
  }, [
    selectedNode?.id,
    selectedNode?.data?.validation?.validatorType,
    selectedNode?.data?.validation?.aiProviderKey,
    selectedNode?.data?.aiProviderKey,
    handleNodeDataChange
  ]);

  useEffect(() => {
    if (!drawerOpen || !selectedNode) {
      return;
    }
    if (!aiProviders.length) {
      return;
    }

    const activeProvider = aiProviders.find(p => p.active);
    const fallbackProvider = activeProvider || aiProviders[0];

    if (selectedNode.data?.type === 'sendEForm' && selectedNode.data.sendEFormMode === 'integrateWaitReply') {
      const currentKey = selectedNode.data.aiProviderKey;
      const exists = currentKey && aiProviders.some(p => p.providerKey === currentKey);
      if (!exists && fallbackProvider) {
        handleNodeDataChange({ aiProviderKey: fallbackProvider.providerKey });
      }
    }

    const validationType = selectedNode.data?.validation?.validatorType?.toLowerCase();
    if (validationType === 'ai') {
      const currentKey = selectedNode.data.validation?.aiProviderKey || selectedNode.data.aiProviderKey;
      const exists = currentKey && aiProviders.some(p => p.providerKey === currentKey);
      if (!exists && fallbackProvider) {
        const newValidation = {
          ...(selectedNode.data.validation || {}),
          aiProviderKey: fallbackProvider.providerKey
        };
        handleNodeDataChange({
          validation: newValidation,
          aiProviderKey: selectedNode.data.aiProviderKey ?? fallbackProvider.providerKey
        });
      }
    }
  }, [
    drawerOpen,
    selectedNode?.id,
    selectedNode?.data?.type,
    selectedNode?.data?.sendEFormMode,
    selectedNode?.data?.validation?.validatorType,
    selectedNode?.data?.validation?.aiProviderKey,
    selectedNode?.data?.aiProviderKey,
    aiProviders,
    handleNodeDataChange
  ]);

  // 載入 DataSet 列表和流程變量
  useEffect(() => {
    if (selectedNode?.data?.type === 'dataSetQuery') {
      loadDataSets();
      loadAvailableProcessVariables();
    }
  }, [selectedNode?.data?.type]);

  // 當 DataSet 改變時，載入欄位信息
  useEffect(() => {
    if (selectedNode?.data?.dataSetId) {
      loadDataSetColumns(selectedNode.data.dataSetId);
    }
  }, [selectedNode?.data?.dataSetId]);

  // 載入 DataSet 列表
  const loadDataSets = async () => {
    try {
      setLoadingDataSets(true);
      const response = await fetch('/api/datasets', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('載入 DataSet 列表失敗');
      }

      const data = await response.json();
      setDataSets(data.data || []);
    } catch (error) {
      message.error('載入 DataSet 列表失敗: ' + error.message);
    } finally {
      setLoadingDataSets(false);
    }
  };

  // 載入可用的流程變量
  const loadAvailableProcessVariables = async () => {
    try {
      // 這裡可以從工作流定義中獲取已定義的流程變量
      // 或者從當前工作流執行中獲取可用的變量
      // 暫時使用一些示例變量
      const commonVariables = [
        'QRCode_Text',
        'CustomerNo',
        'InvoiceNo',
        'OrderNo',
        'Amount',
        'Status',
        'Date',
        'Time',
        'User',
        'Company'
      ];
      setAvailableProcessVariables(commonVariables);
    } catch (error) {
      console.error('載入流程變量失敗:', error);
    }
  };

  // 載入 DataSet 欄位信息
  const loadDataSetColumns = async (dataSetId) => {
    try {
      // 清除查詢結果預覽
      setQueryPreviewData([]);
      setQueryPreviewModalVisible(false);
      
      const response = await fetch(`/api/datasets/${dataSetId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('載入 DataSet 欄位失敗');
      }

      const data = await response.json();
      setDataSetColumns(data.data?.columns || []);
    } catch (error) {
      message.error('載入 DataSet 欄位失敗: ' + error.message);
    }
  };

  // 添加操作數據欄位
  const addOperationDataField = () => {
    const newFields = [...operationDataFields, { name: '', value: '' }];
    setOperationDataFields(newFields);
  };

  // 移除操作數據欄位
  const removeOperationDataField = (index) => {
    const newFields = operationDataFields.filter((_, i) => i !== index);
    setOperationDataFields(newFields);
    
    // 更新表單值
    const operationData = {};
    newFields.forEach(field => {
      if (field.name && field.value) {
        operationData[field.name] = field.value;
      }
    });
    
    handleNodeDataChange({ operationData });
  };

  // 更新操作數據欄位
  const updateOperationDataField = (index, field, value) => {
    const newFields = [...operationDataFields];
    newFields[index][field] = value;
    setOperationDataFields(newFields);
    
    // 更新表單值
    const operationData = {};
    newFields.forEach(field => {
      if (field.name && field.value) {
        operationData[field.name] = field.value;
      }
    });
    
    handleNodeDataChange({ operationData });
  };

  // 測試 DataSet 操作
  const testDataSetOperation = async () => {
    try {
      setTestingOperation(true);
      const currentNode = nodes.find(node => node.id === selectedNode?.id);
      
      if (!currentNode?.data?.dataSetId) {
        message.error(t('workflowDesigner.dataSet.pleaseSelectDataSet'));
        return;
      }
      
      if (!currentNode?.data?.operationType) {
        message.error(t('workflowDesigner.dataSet.pleaseSelectOperationType'));
        return;
      }
      
      // 構建測試請求數據
      const requestData = {
        dataSetId: currentNode.data.dataSetId,
        operationType: currentNode.data.operationType,
        queryConditionGroups: currentNode.data.queryConditionGroups || [],
        operationData: currentNode.data.operationData || {},
        mappedFields: currentNode.data.mappedFields || []
      };
      
      console.log('=== 測試 DataSet 操作 ===');
      console.log('請求數據:', requestData);
      
      // 替換查詢條件中的流程變量為模擬數據
      let processedConditionGroups = requestData.queryConditionGroups;
      if (requestData.operationType === 'SELECT' && Object.keys(pvSimulationData).length > 0) {
        processedConditionGroups = requestData.queryConditionGroups.map(group => ({
          ...group,
          conditions: group.conditions.map(condition => ({
            ...condition,
            value: condition.value.replace(/\$\{([^}]+)\}/g, (match, variableName) => {
              return pvSimulationData[variableName] || match;
            })
          }))
        }));
      }
      
      // 生成 SQL 預覽
      const whereClause = generateWhereClause(processedConditionGroups);
      console.log(t('workflowDesigner.dataSet.generatedWhereClause') + ':', whereClause);
      
      // 顯示測試預覽
      const previewInfo = {
        DataSet: dataSets.find(ds => ds.id === requestData.dataSetId)?.name || '未知',
        [t('workflowDesigner.dataSet.operationType')]: requestData.operationType,
        [t('workflowDesigner.dataSet.queryConditions')]: whereClause || t('workflowDesigner.dataSet.noQueryConditions'),
        [t('workflowDesigner.dataSet.operationData')]: Object.keys(requestData.operationData).length > 0 ? JSON.stringify(requestData.operationData) : t('workflowDesigner.dataSet.noOperationData'),
        [t('workflowDesigner.dataSet.fieldMapping')]: requestData.mappedFields.length > 0 ? 
          requestData.mappedFields.map(m => `${m.fieldName} → $${m.variableName}`).join(', ') : t('workflowDesigner.dataSet.noFieldMapping')
      };
      
      console.log('測試預覽:', previewInfo);
      
      // 顯示預覽模態窗口
      setQueryPreviewData([]); // 先清空數據
      setQueryPreviewModalVisible(true);
      
      // 如果是 SELECT 操作且有模擬數據，嘗試獲取預覽數據
      if (requestData.operationType === 'SELECT' && Object.keys(pvSimulationData).length > 0) {
        try {
          // 調用真實的 API 獲取預覽數據
          const response = await fetch('/api/datasets/preview', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              dataSetId: currentNode?.data?.dataSetId || selectedNode?.data?.dataSetId,
              whereClause,
              limit: 10,
              processVariableValues: pvSimulationData
            })
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error('API 錯誤響應:', errorText);
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
          }

          const result = await response.json();
          console.log('API 響應結果:', result);

          if (result.success && result.data) {
            setQueryPreviewData(result.data);
            const total = result.totalCount ?? result.data.length;
            message.success(`查詢成功！找到 ${total} 條記錄。`);
          } else {
            throw new Error(result.message || '獲取預覽數據失敗');
          }
        } catch (previewError) {
          console.error('獲取預覽數據失敗:', previewError);
          message.error(t('workflowDesigner.dataSet.previewFailed', { message: previewError.message }));
        } finally {
          setTestingOperation(false);
        }
      } else {
        // 非 SELECT 操作或無模擬數據時顯示基本配置信息
        message.success('測試配置成功！請在彈窗中輸入模擬數據進行查詢測試。');
      }
      
    } catch (error) {
      console.error('測試操作失敗:', error);
      message.error('測試操作失敗: ' + error.message);
    } finally {
      setTestingOperation(false);
    }
  };

  // 優化 onValuesChange 處理函數
  const handleFormValuesChange = useCallback((changedValues, allValues) => {
    // 只更新非 taskName 字段，taskName 使用 onBlur 事件處理
    const { taskName, ...otherValues } = changedValues;
    if (Object.keys(otherValues).length > 0) {
      // 特殊處理 validation 對象，確保嵌套更新時保持其他屬性
      if (otherValues.validation) {
        otherValues.validation = {
          ...(selectedNode?.data?.validation || {}),
          ...otherValues.validation
        };

        const validatorType = otherValues.validation.validatorType?.toLowerCase();
        if (validatorType === 'ai') {
          if (!otherValues.validation.aiProviderKey && aiProviders.length > 0) {
            const fallback = aiProviders.find(p => p.active) || aiProviders[0];
            if (fallback) {
              otherValues.validation.aiProviderKey = fallback.providerKey;
            }
          }
        }

        if (!otherValues.aiProviderKey && otherValues.validation.aiProviderKey) {
          otherValues.aiProviderKey = otherValues.validation.aiProviderKey;
        }
      }
      
      // 特殊處理 emailConfig 字段，確保所有字段都正確保存
      // 檢查是否有 emailConfig 相關的字段變化
      const hasEmailConfigChange = otherValues.emailConfig || 
        changedValues['emailConfig.providerKey'] !== undefined || 
        changedValues['emailConfig.subject'] !== undefined || 
        changedValues['emailConfig.body'] !== undefined;
      
      if (hasEmailConfigChange) {
        const currentEmailConfig = selectedNode?.data?.emailConfig || {};
        const newEmailConfig = {
          ...currentEmailConfig,
          // 優先使用 changedValues 中的值，然後是 otherValues.emailConfig，最後是當前值
          providerKey: changedValues['emailConfig.providerKey'] !== undefined 
            ? changedValues['emailConfig.providerKey'] 
            : (otherValues.emailConfig?.providerKey !== undefined ? otherValues.emailConfig.providerKey : currentEmailConfig.providerKey || ''),
          subject: changedValues['emailConfig.subject'] !== undefined 
            ? changedValues['emailConfig.subject'] 
            : (otherValues.emailConfig?.subject !== undefined ? otherValues.emailConfig.subject : currentEmailConfig.subject || ''),
          body: changedValues['emailConfig.body'] !== undefined 
            ? changedValues['emailConfig.body'] 
            : (otherValues.emailConfig?.body !== undefined ? otherValues.emailConfig.body : currentEmailConfig.body || ''),
          replyTo: otherValues.emailConfig?.replyTo !== undefined 
            ? otherValues.emailConfig.replyTo 
            : (currentEmailConfig.replyTo || ''),
        };
        otherValues.emailConfig = newEmailConfig;
        // 移除單獨的字段，因為我們已經合併到 emailConfig 對象中
        delete otherValues['emailConfig.providerKey'];
        delete otherValues['emailConfig.subject'];
        delete otherValues['emailConfig.body'];
        console.log('🟡 NodePropertyDrawer.handleFormValuesChange - emailConfig:', newEmailConfig);
      }
      
      // 使用 setTimeout 來避免在輸入過程中觸發重新渲染
      setTimeout(() => {
        handleNodeDataChange(otherValues);
      }, 0);
    }
  }, [handleNodeDataChange, selectedNode, aiProviders]);

  if (!selectedNode) return null;

  return (
    <>
      <Drawer
        title={
          selectedNode ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginRight: 40 }}>
              <span>{t(`workflowDesigner.${selectedNode.data.type}Node`)}</span>
              <Button
                type="text"
                icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsFullscreen(!isFullscreen);
                }}
                style={{ 
                  marginLeft: 8,
                  fontSize: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title={isFullscreen ? t('workflowDesigner.exitFullscreen') : t('workflowDesigner.enterFullscreen')}
              />
            </div>
          ) : ''
        }
        placement="right"
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setIsFullscreen(false); // 關閉時重置全屏狀態
        }}
        width={isFullscreen ? '100%' : 340}
        style={{
          transition: 'width 0.3s ease'
        }}
      >
        <div style={{
          maxWidth: isFullscreen ? '1200px' : '100%',
          margin: isFullscreen ? '0 auto' : '0',
          padding: isFullscreen ? '20px 40px' : '0'
        }}>
        {selectedNode && selectedNode.data.type !== 'start' && (
          <Form
            form={form}
            key={selectedNode.id}
            layout="vertical"
            onValuesChange={handleFormValuesChange}
          >
            <Form.Item label={t('workflowDesigner.taskNameLabel')} name="taskName">
              <Input 
                placeholder={t('workflowDesigner.taskNamePlaceholder')}
                onBlur={(e) => {
                  const value = e.target.value;
                  if (value !== selectedNode.data.taskName) {
                    handleNodeDataChange({ taskName: value });
                  }
                }}
              />
            </Form.Item>
            
            {/* 發送 WhatsApp 消息節點 - 合併模板和直接訊息功能 */}
            {selectedNode.data.type === 'sendWhatsApp' && (
              <>
                {/* 收件人選擇（共用） */}
                <Form.Item label={t('workflow.to')}>
                  <div style={{ position: 'relative' }}>
                    <RecipientSelector
                      value={selectedNode.data.to || ''}
                      recipientDetails={selectedNode.data.recipientDetails}
                      placeholder={t('workflowDesigner.selectRecipients')}
                      compact={true}
                      workflowDefinitionId={workflowId}
                      t={t}
                      onChange={(value, detailedValue) => {
                        // 如果 value 為空且 detailedValue 為 null，表示用戶點擊了 "Select Recipients" 按鈕
                        if (value === '' && detailedValue === null) {
                          setIsRecipientModalVisible(true);
                        } else {
                          // 處理正常選擇或清除操作
                          handleNodeDataChange({ 
                            to: value,
                            recipientDetails: detailedValue 
                          });
                        }
                      }}
                    />
                    <div style={{ 
                      position: 'absolute', 
                      right: '8px', 
                      top: '50%', 
                      transform: 'translateY(-50%)',
                      display: 'flex',
                      gap: '4px'
                    }}>
                      {selectedNode.data.to && (
                        <Button 
                          type="text" 
                          size="small" 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleNodeDataChange({ to: '', recipientDetails: { users: [], contacts: [], groups: [], hashtags: [], useInitiator: false, phoneNumbers: [] } });
                          }}
                          style={{ padding: '0 4px', fontSize: '12px' }}
                        >
                          {t('workflowDesigner.clear')}
                        </Button>
                      )}
                    </div>
                  </div>
                </Form.Item>
                
                {/* 訊息模式 Tab 切換（共用組件） */}
                <MessageModeTabsComponent
                  selectedNode={selectedNode}
                  handleNodeDataChange={handleNodeDataChange}
                  setIsTemplateModalVisible={setIsTemplateModalVisible}
                  processVariables={processVariables}
                  form={form}
                  t={t}
                  messageLabel={t('workflow.message')}
                  messagePlaceholder={t('workflowDesigner.messageWithVariablesPlaceholder')}
                  messageRows={3}
                  showProcessVariables={true}
                  enableEmailMode={true}
                />
              </>
            )}

            {/* 發送 WhatsApp 模板節點 */}
            {selectedNode.data.type === 'sendWhatsAppTemplate' && (
              <>
                <Form.Item label={t('workflow.to')}>
                  <div style={{ position: 'relative' }}>
                    <RecipientSelector
                      value={selectedNode.data.to || ''}
                      recipientDetails={selectedNode.data.recipientDetails}
                      placeholder={t('workflowDesigner.selectRecipients')}
                      compact={true}
                      workflowDefinitionId={workflowId}
                      t={t}
                      onChange={(value, detailedValue) => {
                        // 如果 value 為空且 detailedValue 為 null，表示用戶點擊了 "Select Recipients" 按鈕
                        if (value === '' && detailedValue === null) {
                          setIsRecipientModalVisible(true);
                        } else {
                          // 處理正常選擇或清除操作
                          handleNodeDataChange({ 
                            to: value,
                            recipientDetails: detailedValue 
                          });
                        }
                      }}
                    />
                    <div style={{ 
                      position: 'absolute', 
                      right: '8px', 
                      top: '50%', 
                      transform: 'translateY(-50%)',
                      display: 'flex',
                      gap: '4px'
                    }}>
                      {selectedNode.data.to && (
                        <Button 
                          type="text" 
                          size="small" 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleNodeDataChange({ to: '', recipientDetails: { users: [], contacts: [], groups: [], hashtags: [], useInitiator: false, phoneNumbers: [] } });
                          }}
                          style={{ padding: '0 4px', fontSize: '12px' }}
                        >
                          {t('workflowDesigner.clear')}
                        </Button>
                      )}
                    </div>
                  </div>
                </Form.Item>
                <Form.Item label={t('workflowDesigner.dataSet.template')}>
                  <div style={{ position: 'relative' }}>
                    <Input 
                      value={selectedNode.data.templateName || ''}
                      placeholder={t('workflowDesigner.selectTemplate')} 
                      readOnly 
                      onClick={() => setIsTemplateModalVisible(true)}
                      suffix={<FormOutlined />}
                    />
                    {selectedNode.data.templateId && (
                      <div style={{ 
                        position: 'absolute', 
                        right: '30px', 
                        top: '50%', 
                        transform: 'translateY(-50%)',
                        zIndex: 1
                      }}>
                        <Button 
                          type="text" 
                          size="small" 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleNodeDataChange({ 
                              templateId: '', 
                              templateName: '', 
                              isMetaTemplate: false,
                              templateLanguage: null,
                              variables: {}
                            });
                          }}
                          style={{ padding: '0 4px', fontSize: '12px' }}
                        >
                          {t('workflowDesigner.clear')}
                        </Button>
                      </div>
                    )}
                  </div>
                </Form.Item>
                {selectedNode.data.templateId && (
                  <Card size="small" title={t('workflowDesigner.templateInfo')} style={{ marginBottom: 16 }}>
                    <p><strong>{t('workflowDesigner.templateId')}</strong>{selectedNode.data.templateId}</p>
                    <p><strong>{t('workflowDesigner.templateName')}</strong>{selectedNode.data.templateName}</p>
                  </Card>
                )}
                
                {/* 模板變數編輯 */}
                {selectedNode.data.templateId && (
                  <Form.Item label={t('workflowDesigner.templateVariables')}>
                    <div style={{ marginBottom: 8 }}>
                      <Button 
                        type="dashed" 
                        onClick={() => {
                          const currentVariables = selectedNode.data.variables || {};
                          const newVariables = { ...currentVariables, [`var_${Date.now()}`]: '' };
                          handleNodeDataChange({ variables: newVariables });
                        }}
                        style={{ width: '100%' }}
                      >
                        <PlusOutlined /> {t('workflowDesigner.addVariable')}
                      </Button>
                    </div>
                    
                    {selectedNode.data.variables && Object.keys(selectedNode.data.variables).length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {Object.entries(selectedNode.data.variables).map(([key, value]) => (
                          <div key={key} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <Input
                              placeholder={t('workflowDesigner.variableName')}
                              value={key}
                              onChange={(e) => {
                                const newVariables = { ...selectedNode.data.variables };
                                delete newVariables[key];
                                newVariables[e.target.value] = value;
                                handleNodeDataChange({ variables: newVariables });
                              }}
                              style={{ flex: 1 }}
                            />
                            <Input
                              placeholder={t('workflowDesigner.variableValue')}
                              value={value}
                              onChange={(e) => {
                                const newVariables = { ...selectedNode.data.variables };
                                newVariables[key] = e.target.value;
                                handleNodeDataChange({ variables: newVariables });
                              }}
                              style={{ flex: 2 }}
                            />
                            <Button
                              type="text"
                              danger
                              onClick={() => {
                                const newVariables = { ...selectedNode.data.variables };
                                delete newVariables[key];
                                handleNodeDataChange({ variables: newVariables });
                              }}
                            >
                              <DeleteOutlined />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                    
                  </Form.Item>
                )}
              </>
            )}

            {/* 等待回覆節點 */}
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
                    <div style={{ position: 'relative' }}>
                      <RecipientSelector
                        value={selectedNode.data.specifiedUsers || ''}
                        recipientDetails={selectedNode.data.recipientDetails}
                        placeholder={t('workflowDesigner.selectRecipients')}
                        compact={true}
                        workflowDefinitionId={workflowId}
                        onChange={(value, detailedValue) => {
                          // 如果 value 為空且 detailedValue 為 null，表示用戶點擊了 "Select Recipients" 按鈕
                          if (value === '' && detailedValue === null) {
                            setIsRecipientModalVisible(true);
                          } else {
                            // 處理正常選擇或清除操作
                            handleNodeDataChange({ 
                              specifiedUsers: value,
                              recipientDetails: detailedValue 
                            });
                          }
                        }}
                      />
                      <div style={{ 
                        position: 'absolute', 
                        right: '8px', 
                        top: '50%', 
                        transform: 'translateY(-50%)',
                        display: 'flex',
                        gap: '4px'
                      }}>
                        {selectedNode.data.specifiedUsers && (
                          <Button 
                            type="text" 
                            size="small" 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleNodeDataChange({ specifiedUsers: '', recipientDetails: null });
                            }}
                            style={{ padding: '0 4px', fontSize: '12px' }}
                          >
                            {t('workflowDesigner.clear')}
                          </Button>
                        )}
                      </div>
                    </div>
                  </Form.Item>
                )}
                
                {/* 訊息配置 Tab（提示訊息、成功訊息、錯誤訊息） */}
                <WaitReplyMessageTabsComponent
                  selectedNode={selectedNode}
                  handleNodeDataChange={handleNodeDataChange}
                  setIsTemplateModalVisible={setIsTemplateModalVisible}
                  processVariables={processVariables}
                  form={form}
                  t={t}
                />
                
                <Form.Item label={t('workflowDesigner.validationConfig')}>
                  <Card 
                    size="small" 
                    title={t('workflowDesigner.validationSettings')} 
                    style={{ marginBottom: 16 }}
                  >
                    <Tabs
                      activeKey={activeValidatorTab}
                      onChange={(key) => setActiveValidatorTab(key)}
                    >
                      <Tabs.TabPane tab={t('workflowDesigner.aiValidator')} key="ai">
                        <Form.Item
                          label={t('workflowDesigner.validatorActiveLabel')}
                          name={['validation', 'aiIsActive']}
                          valuePropName="checked"
                        >
                          <Switch
                            className="validator-switch"
                            checkedChildren={t('workflowDesigner.active')}
                            unCheckedChildren={t('workflowDesigner.inactive')}
                            onChange={(checked) => handleValidatorToggle('ai', checked)}
                          />
                        </Form.Item>
                        {aiIsActive && activeValidatorTab === 'ai' && (
                          <>
                            {!loadingAiProviders && aiProviders.length === 0 && (
                              <Alert
                                type="warning"
                                showIcon
                                message={t('workflowDesigner.aiProviderNotConfigured')}
                                style={{ marginBottom: 12 }}
                              />
                            )}
                            {aiProvidersError && (
                              <Alert
                                type="error"
                                showIcon
                                message={t('workflowDesigner.aiProviderLoadFailed')}
                                description={aiProvidersError}
                                style={{ marginBottom: 12 }}
                              />
                            )}
                            <Form.Item
                              label={t('workflowDesigner.validationAiProvider')}
                              name={['validation', 'aiProviderKey']}
                              rules={[{ required: true, message: t('workflowDesigner.validationAiProviderRequired') }]}
                            >
                              <Select
                                loading={loadingAiProviders}
                                placeholder={t('workflowDesigner.validationAiProviderPlaceholder')}
                                options={aiProviderOptions}
                                allowClear
                              />
                            </Form.Item>
                            <Form.Item
                              label={t('workflowDesigner.validationAiResultVariable')}
                              name={['validation', 'aiResultVariable']}
                              tooltip={t('workflowDesigner.validationAiResultVariableHelp')}
                            >
                              <Select
                                allowClear
                                placeholder={t('workflowDesigner.validationAiResultVariablePlaceholder')}
                              >
                                {processVariables.map(pv => (
                                  <Select.Option key={pv.id} value={pv.variableName}>
                                    {pv.variableName} ({pv.dataType})
                                  </Select.Option>
                                ))}
                              </Select>
                            </Form.Item>
                            <Form.Item label={t('workflowDesigner.promptText')} name={['validation', 'prompt']}>
                              <Input.TextArea
                                placeholder={t('workflowDesigner.promptTextPlaceholder')}
                                rows={6}
                              />
                            </Form.Item>
                            <Form.Item label={t('workflowDesigner.retryMessage')} name={['validation', 'retryMessage']}>
                              <Input placeholder={t('workflowDesigner.retryMessagePlaceholder')} />
                            </Form.Item>
                            <Form.Item label={t('workflowDesigner.maxRetries')} name={['validation', 'maxRetries']}>
                              <Input type="number" min="1" max="10" />
                            </Form.Item>
                          </>
                        )}
                      </Tabs.TabPane>
                      <Tabs.TabPane tab={t('workflowDesigner.timeValidatorLabel')} key="time">
                        <Form.Item
                          label={t('workflowDesigner.validatorActiveLabel')}
                          name={['validation', 'timeIsActive']}
                          valuePropName="checked"
                        >
                          <Switch
                            className="validator-switch"
                            checkedChildren={t('workflowDesigner.active')}
                            unCheckedChildren={t('workflowDesigner.inactive')}
                            onChange={(checked) => handleValidatorToggle('time', checked)}
                          />
                        </Form.Item>
                        {timeIsActive && activeValidatorTab === 'time' && (
                          <>
                            <Form.Item label={t('workflowDesigner.timeValidator.retryInterval')}>
                              <div style={{
                                display: 'grid',
                                gridTemplateColumns: isFullscreen ? '1fr 1fr 1fr' : '1fr',
                                gap: isFullscreen ? '12px' : '8px'
                              }}>
                                <Input 
                                  type="number" 
                                  min="0" 
                                  placeholder="0"
                                  value={selectedNode.data.validation?.retryIntervalDays || 0}
                                  onChange={(e) => {
                                    const newValidation = {
                                      ...(selectedNode.data.validation || {}),
                                      retryIntervalDays: parseInt(e.target.value) || 0
                                    };
                                    handleNodeDataChange({ validation: newValidation });
                                  }}
                                  addonAfter={t('workflowDesigner.days')}
                                />
                                <Input 
                                  type="number" 
                                  min="0" 
                                  max="23"
                                  placeholder="0"
                                  value={selectedNode.data.validation?.retryIntervalHours || 0}
                                  onChange={(e) => {
                                    const newValidation = {
                                      ...(selectedNode.data.validation || {}),
                                      retryIntervalHours: parseInt(e.target.value) || 0
                                    };
                                    handleNodeDataChange({ validation: newValidation });
                                  }}
                                  addonAfter={t('workflowDesigner.hours')}
                                />
                                <Input 
                                  type="number" 
                                  min="0" 
                                  max="59"
                                  placeholder="30"
                                  value={selectedNode.data.validation?.retryIntervalMinutes || 0}
                                  onChange={(e) => {
                                    const newValidation = {
                                      ...(selectedNode.data.validation || {}),
                                      retryIntervalMinutes: parseInt(e.target.value) || 0
                                    };
                                    handleNodeDataChange({ validation: newValidation });
                                  }}
                                  addonAfter={t('workflowDesigner.minutes')}
                                />
                              </div>
                            </Form.Item>
                            <Form.Item label={t('workflowDesigner.timeValidator.retryLimit')}>
                              <Input
                                type="number"
                                min="1"
                                placeholder="5"
                                value={selectedNode.data.validation?.retryLimitValue || 5}
                                onChange={(e) => {
                                  const newValidation = {
                                    ...(selectedNode.data.validation || {}),
                                    retryLimitValue: parseInt(e.target.value) || 5
                                  };
                                  handleNodeDataChange({ validation: newValidation });
                                }}
                              />
                            </Form.Item>
                            <TimeValidatorConfigSection
                              type="retryMessage"
                              selectedNode={selectedNode}
                              handleNodeDataChange={handleNodeDataChange}
                              form={form}
                              processVariables={processVariables}
                              workflowDefinitionId={workflowId}
                              onOpenTemplateModal={() => {
                                setTemplateModalSource('retryMessage');
                                setIsTemplateModalVisible(true);
                              }}
                              onOpenRecipientModal={() => {
                                setTemplateModalSource('retryMessage');
                                setTimeValidatorRecipientModalVisible(true);
                              }}
                              t={t}
                              config={selectedNode?.data?.validation?.retryMessageConfig}
                              title={t('workflowDesigner.timeValidator.configureRetryMessage')}
                              recipientsLabel={t('workflowDesigner.timeValidator.retryMessageRecipients')}
                              recipientsDescription={t('workflowDesigner.timeValidator.retryMessageRecipientsDescription')}
                              messageLabel={t('workflowDesigner.timeValidator.retryMessage')}
                              messageDescription={t('workflowDesigner.timeValidator.retryMessageDescription')}
                              messagePlaceholder={t('workflowDesigner.timeValidator.retryMessagePlaceholder')}
                              messageTip={t('workflowDesigner.timeValidator.retryMessageTip')}
                              expanded={retryMessageExpanded}
                              onToggleExpanded={setRetryMessageExpanded}
                            />
                            <TimeValidatorConfigSection
                              type="escalation"
                              selectedNode={selectedNode}
                              handleNodeDataChange={handleNodeDataChange}
                              form={form}
                              processVariables={processVariables}
                              workflowDefinitionId={workflowId}
                              onOpenTemplateModal={() => {
                                setTemplateModalSource('escalation');
                                setIsTemplateModalVisible(true);
                              }}
                              onOpenRecipientModal={() => {
                                setTemplateModalSource('escalation');
                                setTimeValidatorRecipientModalVisible(true);
                              }}
                              t={t}
                              config={selectedNode?.data?.validation?.escalationConfig}
                              title={t('workflowDesigner.timeValidator.configureEscalation')}
                              recipientsLabel={t('workflowDesigner.timeValidator.escalationRecipients')}
                              recipientsDescription={t('workflowDesigner.timeValidator.escalationRecipientsDescription')}
                              messageLabel={t('workflowDesigner.timeValidator.escalationMessage')}
                              messageDescription={t('workflowDesigner.timeValidator.escalationMessageDescription')}
                              messagePlaceholder={t('workflowDesigner.timeValidator.escalationMessagePlaceholder')}
                              messageTip={t('workflowDesigner.timeValidator.escalationMessageTip')}
                              expanded={escalationConfigExpanded}
                              onToggleExpanded={setEscalationConfigExpanded}
                            />
                          </>
                        )}
                      </Tabs.TabPane>
                    </Tabs>
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

            {/* 等待 QR Code 節點 */}
            {selectedNode.data.type === 'waitForQRCode' && (
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
                    <div style={{ position: 'relative' }}>
                      <RecipientSelector
                        value={selectedNode.data.specifiedUsers || ''}
                        recipientDetails={selectedNode.data.recipientDetails}
                        placeholder={t('workflowDesigner.selectRecipients')}
                        compact={true}
                        workflowDefinitionId={workflowId}
                        onChange={(value, detailedValue) => {
                          // 如果 value 為空且 detailedValue 為 null，表示用戶點擊了 "Select Recipients" 按鈕
                          if (value === '' && detailedValue === null) {
                            setIsRecipientModalVisible(true);
                          } else {
                            // 處理正常選擇或清除操作
                            handleNodeDataChange({ 
                              specifiedUsers: value,
                              recipientDetails: detailedValue 
                            });
                          }
                        }}
                      />
                      <div style={{ 
                        position: 'absolute', 
                        right: '8px', 
                        top: '50%', 
                        transform: 'translateY(-50%)',
                        display: 'flex',
                        gap: '4px'
                      }}>
                        {selectedNode.data.specifiedUsers && (
                          <Button 
                            type="text" 
                            size="small" 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleNodeDataChange({ specifiedUsers: '', recipientDetails: null });
                            }}
                            style={{ padding: '0 4px', fontSize: '12px' }}
                          >
                            {t('workflowDesigner.clear')}
                          </Button>
                        )}
                      </div>
                    </div>
                  </Form.Item>
                )}
                
                <Form.Item label={t('workflowDesigner.qrCodeVariable')} name="qrCodeVariable">
                  <Select
                    placeholder={t('workflowDesigner.selectProcessVariable')}
                    allowClear
                  >
                    {processVariables.map(pv => (
                      <Select.Option key={pv.id} value={pv.variableName}>
                        {pv.variableName} ({pv.dataType})
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
                
                {/* QR Code 訊息配置（包含提示訊息、成功訊息、錯誤訊息） */}
                <QRCodeMessageTabsComponent
                  selectedNode={selectedNode}
                  handleNodeDataChange={handleNodeDataChange}
                  setIsTemplateModalVisible={setIsTemplateModalVisible}
                  processVariables={processVariables}
                  form={form}
                  t={t}
                />
                
                <Form.Item label={t('workflowDesigner.timeout')} name="timeout">
                  <Input 
                    type="number" 
                    placeholder="300" 
                    addonAfter={t('workflowDesigner.seconds')}
                  />
                </Form.Item>
                
                <Form.Item label={t('workflowDesigner.validationConfig')}>
                  <Card 
                    size="small" 
                    title={t('workflowDesigner.validationSettings')} 
                    style={{ marginBottom: 16 }}
                  >
                    <Tabs
                      activeKey={activeValidatorTab}
                      onChange={(key) => setActiveValidatorTab(key)}
                    >
                      <Tabs.TabPane tab={t('workflowDesigner.aiValidator')} key="ai">
                        <Form.Item
                          label={t('workflowDesigner.validatorActiveLabel')}
                          name={['validation', 'aiIsActive']}
                          valuePropName="checked"
                        >
                          <Switch
                            className="validator-switch"
                            checkedChildren={t('workflowDesigner.active')}
                            unCheckedChildren={t('workflowDesigner.inactive')}
                            onChange={(checked) => handleValidatorToggle('ai', checked)}
                          />
                        </Form.Item>
                        {aiIsActive && activeValidatorTab === 'ai' && (
                          <>
                            {!loadingAiProviders && aiProviders.length === 0 && (
                              <Alert
                                type="warning"
                                showIcon
                                message={t('workflowDesigner.aiProviderNotConfigured')}
                                style={{ marginBottom: 12 }}
                              />
                            )}
                            {aiProvidersError && (
                              <Alert
                                type="error"
                                showIcon
                                message={t('workflowDesigner.aiProviderLoadFailed')}
                                description={aiProvidersError}
                                style={{ marginBottom: 12 }}
                              />
                            )}
                            <Form.Item
                              label={t('workflowDesigner.validationAiProvider')}
                              name={['validation', 'aiProviderKey']}
                              rules={[{ required: true, message: t('workflowDesigner.validationAiProviderRequired') }]}
                            >
                              <Select
                                loading={loadingAiProviders}
                                placeholder={t('workflowDesigner.validationAiProviderPlaceholder')}
                                options={aiProviderOptions}
                                allowClear
                              />
                            </Form.Item>
                            <Form.Item
                              label={t('workflowDesigner.validationAiResultVariable')}
                              name={['validation', 'aiResultVariable']}
                              tooltip={t('workflowDesigner.validationAiResultVariableHelp')}
                            >
                              <Select
                                allowClear
                                placeholder={t('workflowDesigner.validationAiResultVariablePlaceholder')}
                              >
                                {processVariables.map(pv => (
                                  <Select.Option key={pv.id} value={pv.variableName}>
                                    {pv.variableName} ({pv.dataType})
                                  </Select.Option>
                                ))}
                              </Select>
                            </Form.Item>
                            <Form.Item 
                              label={t('workflowDesigner.promptText')} 
                              name={['validation', 'prompt']}
                              tooltip={t('workflowDesigner.qrCodeAiValidatorPromptHelp')}
                            >
                              <Input.TextArea
                                placeholder={t('workflowDesigner.qrCodeAiValidatorPromptPlaceholder')}
                                rows={6}
                              />
                            </Form.Item>
                            <Form.Item label={t('workflowDesigner.retryMessage')} name={['validation', 'retryMessage']}>
                              <Input placeholder={t('workflowDesigner.retryMessagePlaceholder')} />
                            </Form.Item>
                            <Form.Item label={t('workflowDesigner.maxRetries')} name={['validation', 'maxRetries']}>
                              <Input type="number" min="1" max="10" />
                            </Form.Item>
                          </>
                        )}
                      </Tabs.TabPane>
                      <Tabs.TabPane tab={t('workflowDesigner.timeValidatorLabel')} key="time">
                        <Form.Item
                          label={t('workflowDesigner.validatorActiveLabel')}
                          name={['validation', 'timeIsActive']}
                          valuePropName="checked"
                        >
                          <Switch
                            className="validator-switch"
                            checkedChildren={t('workflowDesigner.active')}
                            unCheckedChildren={t('workflowDesigner.inactive')}
                            onChange={(checked) => handleValidatorToggle('time', checked)}
                          />
                        </Form.Item>
                        {timeIsActive && activeValidatorTab === 'time' && (
                          <>
                            <Form.Item label={t('workflowDesigner.timeValidator.retryInterval')}>
                              <div style={{
                                display: 'grid',
                                gridTemplateColumns: isFullscreen ? '1fr 1fr 1fr' : '1fr',
                                gap: isFullscreen ? '12px' : '8px'
                              }}>
                                <Input 
                                  type="number" 
                                  min="0" 
                                  placeholder="0"
                                  value={selectedNode.data.validation?.retryIntervalDays || 0}
                                  onChange={(e) => {
                                    const newValidation = {
                                      ...(selectedNode.data.validation || {}),
                                      retryIntervalDays: parseInt(e.target.value) || 0
                                    };
                                    handleNodeDataChange({ validation: newValidation });
                                  }}
                                  addonAfter={t('workflowDesigner.days')}
                                />
                                <Input 
                                  type="number" 
                                  min="0" 
                                  max="23"
                                  placeholder="0"
                                  value={selectedNode.data.validation?.retryIntervalHours || 0}
                                  onChange={(e) => {
                                    const newValidation = {
                                      ...(selectedNode.data.validation || {}),
                                      retryIntervalHours: parseInt(e.target.value) || 0
                                    };
                                    handleNodeDataChange({ validation: newValidation });
                                  }}
                                  addonAfter={t('workflowDesigner.hours')}
                                />
                                <Input 
                                  type="number" 
                                  min="0" 
                                  max="59"
                                  placeholder="30"
                                  value={selectedNode.data.validation?.retryIntervalMinutes || 0}
                                  onChange={(e) => {
                                    const newValidation = {
                                      ...(selectedNode.data.validation || {}),
                                      retryIntervalMinutes: parseInt(e.target.value) || 0
                                    };
                                    handleNodeDataChange({ validation: newValidation });
                                  }}
                                  addonAfter={t('workflowDesigner.minutes')}
                                />
                              </div>
                            </Form.Item>
                            <Form.Item label={t('workflowDesigner.timeValidator.retryLimit')}>
                              <Input
                                type="number"
                                min="1"
                                placeholder="5"
                                value={selectedNode.data.validation?.retryLimitValue || 5}
                                onChange={(e) => {
                                  const newValidation = {
                                    ...(selectedNode.data.validation || {}),
                                    retryLimitValue: parseInt(e.target.value) || 5
                                  };
                                  handleNodeDataChange({ validation: newValidation });
                                }}
                              />
                            </Form.Item>
                            <TimeValidatorConfigSection
                              type="retryMessage"
                              selectedNode={selectedNode}
                              handleNodeDataChange={handleNodeDataChange}
                              form={form}
                              processVariables={processVariables}
                              workflowDefinitionId={workflowId}
                              onOpenTemplateModal={() => {
                                setTemplateModalSource('retryMessage');
                                setIsTemplateModalVisible(true);
                              }}
                              onOpenRecipientModal={() => {
                                setTemplateModalSource('retryMessage');
                                setTimeValidatorRecipientModalVisible(true);
                              }}
                              t={t}
                              config={selectedNode?.data?.validation?.retryMessageConfig}
                              title={t('workflowDesigner.timeValidator.configureRetryMessage')}
                              recipientsLabel={t('workflowDesigner.timeValidator.retryMessageRecipients')}
                              recipientsDescription={t('workflowDesigner.timeValidator.retryMessageRecipientsDescription')}
                              messageLabel={t('workflowDesigner.timeValidator.retryMessage')}
                              messageDescription={t('workflowDesigner.timeValidator.retryMessageDescription')}
                              messagePlaceholder={t('workflowDesigner.timeValidator.retryMessagePlaceholder')}
                              messageTip={t('workflowDesigner.timeValidator.retryMessageTip')}
                              expanded={retryMessageExpanded}
                              onToggleExpanded={setRetryMessageExpanded}
                            />
                            <TimeValidatorConfigSection
                              type="escalation"
                              selectedNode={selectedNode}
                              handleNodeDataChange={handleNodeDataChange}
                              form={form}
                              processVariables={processVariables}
                              workflowDefinitionId={workflowId}
                              onOpenTemplateModal={() => {
                                setTemplateModalSource('escalation');
                                setIsTemplateModalVisible(true);
                              }}
                              onOpenRecipientModal={() => {
                                setTemplateModalSource('escalation');
                                setTimeValidatorRecipientModalVisible(true);
                              }}
                              t={t}
                              config={selectedNode?.data?.validation?.escalationConfig}
                              title={t('workflowDesigner.timeValidator.configureEscalation')}
                              recipientsLabel={t('workflowDesigner.timeValidator.escalationRecipients')}
                              recipientsDescription={t('workflowDesigner.timeValidator.escalationRecipientsDescription')}
                              messageLabel={t('workflowDesigner.timeValidator.escalationMessage')}
                              messageDescription={t('workflowDesigner.timeValidator.escalationMessageDescription')}
                              messagePlaceholder={t('workflowDesigner.timeValidator.escalationMessagePlaceholder')}
                              messageTip={t('workflowDesigner.timeValidator.escalationMessageTip')}
                              expanded={escalationConfigExpanded}
                              onToggleExpanded={setEscalationConfigExpanded}
                            />
                          </>
                        )}
                      </Tabs.TabPane>
                    </Tabs>
                  </Card>
                </Form.Item>
                
                <Card size="small" title={t('workflowDesigner.functionDescription')} style={{ marginTop: 16 }}>
                  <p style={{ fontSize: '12px', margin: '4px 0' }}>
                    {t('workflowDesigner.qrCodeDescription1')}
                  </p>
                  <p style={{ fontSize: '12px', margin: '4px 0' }}>
                    {t('workflowDesigner.qrCodeDescription2')}
                  </p>
                  <p style={{ fontSize: '12px', margin: '4px 0', color: '#1890ff' }}>
                    {t('workflowDesigner.qrCodeDescription3')}
                  </p>
                </Card>
              </>
            )}

            {/* DataSet 查詢節點 */}
            {selectedNode.data.type === 'dataSetQuery' && (
              <>
                <Form.Item label={t('workflowDesigner.dataSet.selectDataSet')} name="dataSetId">
                  <Select 
                    placeholder={t('workflowDesigner.dataSet.selectDataSetPlaceholder')}
                    loading={loadingDataSets}
                    onChange={(value) => {
                      handleNodeDataChange({ dataSetId: value });
                      loadDataSetColumns(value);
                    }}
                  >
                    {dataSets.map(ds => (
                      <Select.Option key={ds.id} value={ds.id}>
                        {ds.name} ({ds.dataSourceType})
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
                
                <Form.Item label={t('workflowDesigner.dataSet.operationType')} name="operationType">
                  <Select 
                    placeholder={t('workflowDesigner.dataSet.operationTypePlaceholder')}
                    onChange={(value) => {
                      // 清除查詢結果預覽
                      setQueryPreviewData([]);
                      setQueryPreviewModalVisible(false);
                      handleNodeDataChange({ operationType: value });
                    }}
                  >
                    <Select.Option value="SELECT">{t('workflowDesigner.dataSet.select')}</Select.Option>
                    <Select.Option value="INSERT">{t('workflowDesigner.dataSet.insert')}</Select.Option>
                    <Select.Option value="UPDATE">{t('workflowDesigner.dataSet.update')}</Select.Option>
                    <Select.Option value="DELETE">{t('workflowDesigner.dataSet.delete')}</Select.Option>
                  </Select>
                </Form.Item>
                
                  {/* 查詢條件 - SELECT/UPDATE/DELETE 時顯示 */}
                  {(selectedNode.data.operationType === 'SELECT' || 
                    selectedNode.data.operationType === 'UPDATE' || 
                    selectedNode.data.operationType === 'DELETE') && (
                    <Form.Item label={t('workflowDesigner.dataSet.queryConditions')}>
                      <div style={{ marginBottom: '8px' }}>
                        <Button 
                          type="dashed" 
                          onClick={() => {
                            const newConditionGroup = {
                              id: `conditionGroup${Date.now()}`,
                              relation: 'and',
                              conditions: [],
                              groupIndex: -1
                            };
                            setEditingDataSetConditionGroup(newConditionGroup);
                            setDataSetConditionGroupModalVisible(true);
                          }}
                          style={{ width: '100%' }}
                        >
                          {t('workflowDesigner.dataSet.addQueryConditionGroup')}
                        </Button>
                      </div>
                      {(() => {
                        const currentNode = nodes.find(node => node.id === selectedNode?.id);
                        const currentConditionGroups = currentNode?.data?.queryConditionGroups || [];
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
                              console.log('=== 編輯 DataSet 查詢條件組 ===');
                              console.log('group:', group);
                              console.log('groupIndex:', groupIndex);
                              const editingGroup = { ...group, groupIndex };
                              console.log('editingGroup:', editingGroup);
                              setEditingDataSetConditionGroup(editingGroup);
                              setDataSetConditionGroupModalVisible(true);
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '4px' }}>
                                  {t('workflowDesigner.dataSet.queryConditionGroup')} {groupIndex + 1}
                                </div>
                                <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                                  {t('workflowDesigner.dataSet.conditionCount')}: {group.conditions?.length || 0}
                                  {group.relation && ` • ${group.relation.toUpperCase()}`}
                                </div>
                                {group.conditions && group.conditions.length > 0 && (
                                  <div style={{ fontSize: '11px', color: '#999' }}>
                                    {group.conditions.slice(0, 2).map(condition => 
                                      `${condition.fieldName} ${condition.operator} ${condition.value}`
                                    ).join(', ')}
                                    {group.conditions.length > 2 && ` +${group.conditions.length - 2} more`}
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
                                    console.log('=== 編輯按鈕點擊 DataSet 查詢條件組 ===');
                                    console.log('group:', group);
                                    console.log('groupIndex:', groupIndex);
                                    const editingGroup = { ...group, groupIndex };
                                    console.log('editingGroup:', editingGroup);
                                    setEditingDataSetConditionGroup(editingGroup);
                                    setDataSetConditionGroupModalVisible(true);
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
                                    const currentGroups = currentNode?.data?.queryConditionGroups || [];
                                    const newGroups = currentGroups.filter((_, i) => i !== groupIndex);
                                    handleNodeDataChange({ queryConditionGroups: newGroups });
                                  }}
                                />
                              </div>
                            </div>
                          </Card>
                        ));
                      })()}
                      
                      {/* 顯示生成的 SQL WHERE 條件預覽 */}
                      {(() => {
                        const currentNode = nodes.find(node => node.id === selectedNode?.id);
                        const conditionGroups = currentNode?.data?.queryConditionGroups || [];
                        if (conditionGroups.length > 0) {
                          const sqlPreview = generateWhereClause(conditionGroups);
                          return (
                            <div style={{ 
                              marginTop: '12px',
                              padding: '8px 12px', 
                              backgroundColor: '#f5f5f5', 
                              borderRadius: '4px',
                              fontSize: '12px',
                              color: '#666'
                            }}>
                              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{t('workflowDesigner.dataSet.generatedWhereClause')}:</div>
                              <div style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                                {sqlPreview}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </Form.Item>
                  )}
                
                {/* 操作數據 - INSERT/UPDATE 時顯示 */}
                {(selectedNode.data.operationType === 'INSERT' || 
                  selectedNode.data.operationType === 'UPDATE') && (
                  <>
                    <Form.Item label={t('workflowDesigner.dataSet.operationData')}>
                      <div style={{ marginBottom: '8px' }}>
                        <Button 
                          type="dashed" 
                          onClick={handleOpenOperationDataModal}
                          icon={<SettingOutlined />}
                          style={{ width: '100%' }}
                          disabled={!selectedNode.data.dataSetId}
                        >
                          {t('workflowDesigner.dataSet.setOperationData')}
                        </Button>
                      </div>
                      {operationDataFields.length > 0 && (
                        <div style={{ 
                          border: '1px solid #d9d9d9', 
                          borderRadius: '4px', 
                          padding: '8px', 
                          backgroundColor: '#f9f9f9',
                          fontSize: '12px',
                          color: '#666'
                        }}>
                          {t('workflowDesigner.dataSet.operationDataSummary', { count: operationDataFields.length })}
                        </div>
                      )}
                    </Form.Item>
                  </>
                )}
                
                  {/* 映射字段 - SELECT 時顯示 */}
                  {selectedNode.data.operationType === 'SELECT' && (
                    <Form.Item label={t('workflowDesigner.dataSet.fieldMapping')}>
                      <div style={{ marginBottom: '8px' }}>
                        <Button 
                          type="dashed" 
                          onClick={() => {
                            const currentNode = nodes.find(node => node.id === selectedNode?.id);
                            const currentMappings = currentNode?.data?.mappedFields || [];
                            dataSetFieldMappingForm.setFieldsValue({ mappedFields: currentMappings });
                            setDataSetFieldMappingModalVisible(true);
                          }}
                          style={{ width: '100%' }}
                          disabled={!selectedNode.data.dataSetId}
                        >
                          {t('workflowDesigner.dataSet.setFieldMapping')}
                        </Button>
                      </div>
                      {(() => {
                        const currentNode = nodes.find(node => node.id === selectedNode?.id);
                        const mappedFields = currentNode?.data?.mappedFields || [];
                        if (mappedFields.length > 0) {
                          return (
                            <div style={{ 
                              border: '1px solid #d9d9d9', 
                              borderRadius: '4px', 
                              padding: '8px',
                              backgroundColor: '#fafafa'
                            }}>
                              <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                                {t('workflowDesigner.dataSet.fieldMappingSummary', { count: mappedFields.length })}:
                              </div>
                              {mappedFields.slice(0, 3).map((mapping, index) => (
                                <div key={index} style={{ fontSize: '11px', color: '#999', marginBottom: '2px' }}>
                                  {mapping.fieldName} → ${mapping.variableName}
                                </div>
                              ))}
                              {mappedFields.length > 3 && (
                                <div style={{ fontSize: '11px', color: '#999' }}>
                                  +{mappedFields.length - 3} 個更多...
                                </div>
                              )}
                            </div>
                          );
                        }
                        return (
                          <div style={{ 
                            textAlign: 'center', 
                            padding: '20px', 
                            color: '#999',
                            border: '1px dashed #d9d9d9',
                            borderRadius: '4px'
                          }}>
                            {t('workflowDesigner.dataSet.noFieldMapping')}
                          </div>
                        );
                      })()}
                      <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                        {t('workflowDesigner.dataSet.clickToSetFieldMapping')}
                      </div>
                    </Form.Item>
                  )}
                
                  <Form.Item label={t('workflowDesigner.dataSet.operationPreview')}>
                    <div style={{ 
                      padding: '8px 12px', 
                      backgroundColor: '#f5f5f5', 
                      borderRadius: '4px',
                      fontSize: '12px',
                      color: '#666',
                      minHeight: '40px'
                    }}>
                      {selectedNode.data.dataSetId && selectedNode.data.operationType ? (
                        <div>
                          <div><strong>DataSet:</strong> {dataSets.find(ds => ds.id === selectedNode.data.dataSetId)?.name}</div>
                          <div><strong>{t('workflowDesigner.dataSet.operationType')}:</strong> {selectedNode.data.operationType}</div>
                          {(() => {
                            const currentNode = nodes.find(node => node.id === selectedNode?.id);
                            const conditionGroups = currentNode?.data?.queryConditionGroups || [];
                            if (conditionGroups.length > 0) {
                              const sqlPreview = generateWhereClause(conditionGroups);
                              return <div><strong>{t('workflowDesigner.dataSet.queryConditions')}:</strong> {sqlPreview}</div>;
                            }
                            return null;
                          })()}
                          {Object.keys(selectedNode.data.operationData || {}).length > 0 && (
                            <div><strong>{t('workflowDesigner.dataSet.operationData')}:</strong> {JSON.stringify(selectedNode.data.operationData)}</div>
                          )}
                          {(() => {
                            const currentNode = nodes.find(node => node.id === selectedNode?.id);
                            const mappedFields = currentNode?.data?.mappedFields || [];
                            if (mappedFields.length > 0) {
                              return (
                                <div>
                                  <strong>{t('workflowDesigner.dataSet.fieldMapping')}:</strong>
                                  <ul style={{ margin: '4px 0', paddingLeft: '16px' }}>
                                    {mappedFields.map((mapping, index) => (
                                      <li key={index}>
                                        {mapping.fieldName} → ${mapping.variableName}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      ) : (
                        t('workflowDesigner.dataSet.pleaseSelectDataSetAndOperationType')
                      )}
                    </div>
                  </Form.Item>
                

                <Form.Item>
                  <Button 
                    type="default" 
                    onClick={testDataSetOperation}
                    loading={testingOperation}
                    disabled={!selectedNode.data.dataSetId || !selectedNode.data.operationType}
                    style={{ width: '100%' }}
                  >
                    {t('workflowDesigner.dataSet.testOperation')}
                  </Button>
                </Form.Item>

              </>
            )}

            {/* API 調用節點 */}
            {selectedNode.data.type === 'callApi' && (
              <Form.Item label={t('workflow.apiUrl')} name="url">
                <Input />
              </Form.Item>
            )}
            
            {/* 表單節點 */}
            {selectedNode.data.type === 'sendEForm' && (
              <>
                <Form.Item label={t('workflowDesigner.selectForm')}>
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
                            {t('workflowList.clear')}
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
                  <div style={{ position: 'relative' }}>
                    <RecipientSelector
                      value={selectedNode.data.to || ''}
                      recipientDetails={selectedNode.data.recipientDetails}
                      placeholder={t('workflowDesigner.selectRecipients')}
                      compact={true}
                      workflowDefinitionId={workflowId}
                      t={t}
                      onChange={(value, detailedValue) => {
                        // 如果 value 為空且 detailedValue 為 null，表示用戶點擊了 "Select Recipients" 按鈕
                        if (value === '' && detailedValue === null) {
                          setIsRecipientModalVisible(true);
                        } else {
                          // 處理正常選擇或清除操作
                          handleNodeDataChange({ 
                            to: value,
                            recipientDetails: detailedValue 
                          });
                        }
                      }}
                    />
                    <div style={{ 
                      position: 'absolute', 
                      right: '8px', 
                      top: '50%', 
                      transform: 'translateY(-50%)',
                      display: 'flex',
                      gap: '4px'
                    }}>
                      {selectedNode.data.to && (
                        <Button 
                          type="text" 
                          size="small" 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleNodeDataChange({ to: '', recipientDetails: { users: [], contacts: [], groups: [], hashtags: [], useInitiator: false, phoneNumbers: [] } });
                          }}
                          style={{ padding: '0 4px', fontSize: '12px' }}
                        >
                          {t('workflowDesigner.clear')}
                        </Button>
                      )}
                    </div>
                  </div>
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

                {/* 表單填充模式配置 */}
                <Form.Item label={t('workflowDesigner.sendEForm.fillMode')}>
                  <div style={{ marginBottom: 8 }}>
                    <Radio.Group
                      value={selectedNode.data.sendEFormMode || 'integrateWaitReply'}
                      onChange={(e) => {
                        const mode = e.target.value;
                        handleNodeDataChange({ 
                          sendEFormMode: mode,
                          integratedDataSetQueryNodeId: mode === 'integrateDataSetQuery' ? (selectedNode.data.integratedDataSetQueryNodeId || '') : ''
                        });
                      }}
                    >
                      <div style={{ marginBottom: 8 }}>
                        <Radio value="integrateWaitReply">{t('workflowDesigner.sendEForm.integrateWaitReply')}</Radio>
                      </div>
                      <div style={{ marginBottom: 8 }}>
                        <Radio value="integrateDataSetQuery">{t('workflowDesigner.sendEForm.integrateDataSetQuery')}</Radio>
                      </div>
                      <div>
                        <Radio value="manualFill">{t('workflowDesigner.sendEForm.manualFill')}</Radio>
                      </div>
                    </Radio.Group>
                  </div>
                  
                  {/* 模式說明 */}
                  <div style={{ 
                    padding: '8px 12px', 
                    backgroundColor: '#f0f8ff', 
                    border: '1px solid #1890ff',
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: '#666',
                    marginTop: 8
                  }}>
                    {selectedNode.data.sendEFormMode === 'integrateWaitReply' && (
                      <div>{t('workflowDesigner.sendEForm.integrateWaitReplyDesc')}</div>
                    )}
                    {selectedNode.data.sendEFormMode === 'integrateDataSetQuery' && (
                      <div>{t('workflowDesigner.sendEForm.integrateDataSetQueryDesc')}</div>
                    )}
                    {selectedNode.data.sendEFormMode === 'manualFill' && (
                      <div>{t('workflowDesigner.sendEForm.manualFillDesc')}</div>
                    )}
                  </div>
                  
                  {selectedNode.data.sendEFormMode === 'integrateWaitReply' && (
                    <>
                      {!loadingAiProviders && aiProviders.length === 0 && (
                        <Alert
                          type="warning"
                          showIcon
                          message={t('workflowDesigner.aiProviderNotConfigured')}
                          style={{ marginBottom: 12 }}
                        />
                      )}
                      {aiProvidersError && (
                        <Alert
                          type="error"
                          showIcon
                          message={t('workflowDesigner.aiProviderLoadFailed')}
                          description={aiProvidersError}
                          style={{ marginBottom: 12 }}
                        />
                      )}
                      <Form.Item
                        label={t('workflowDesigner.sendEForm.aiProvider')}
                        name="aiProviderKey"
                        rules={[{ required: true, message: t('workflowDesigner.sendEForm.aiProviderRequired') }]}
                      >
                        <Select
                          loading={loadingAiProviders}
                          placeholder={t('workflowDesigner.sendEForm.aiProviderPlaceholder')}
                          options={aiProviderOptions}
                          allowClear
                        />
                      </Form.Item>
                    </>
                  )}
                  
                  {/* DataSet Query 節點選擇 */}
                  {selectedNode.data.sendEFormMode === 'integrateDataSetQuery' && (
                    <div style={{ marginTop: 12 }}>
                      <Form.Item label={t('workflowDesigner.sendEForm.selectDataSetQueryNode')}>
                        <Select
                          placeholder={t('workflowDesigner.sendEForm.selectDataSetQueryNodePlaceholder')}
                          value={selectedNode.data.integratedDataSetQueryNodeId || undefined}
                          onChange={(value) => handleNodeDataChange({ integratedDataSetQueryNodeId: value })}
                          allowClear
                        >
                          {(() => {
                            // 從流程中獲取 DataSet Query 節點列表（操作類型為 SELECT）
                            const dataSetQueryNodes = nodes.filter(node => 
                              node.data?.type === 'dataSetQuery' && 
                              node.data?.operationType === 'SELECT' &&
                              node.id !== selectedNode.id // 排除當前節點
                            );
                            
                            if (dataSetQueryNodes.length === 0) {
                              return (
                                <Select.Option value="" disabled>
                                  {t('workflowDesigner.sendEForm.noDataSetQueryNodes')}
                                </Select.Option>
                              );
                            }
                            
                            return dataSetQueryNodes.map(node => (
                              <Select.Option key={node.id} value={node.id}>
                                {node.data?.taskName || node.data?.label || `DataSet Query Node ${node.id}`}
                              </Select.Option>
                            ));
                          })()}
                        </Select>
                        <div style={{ marginTop: 4, fontSize: '12px', color: '#666' }}>
                          {t('workflowDesigner.sendEForm.dataSetQueryNodeHelp')}
                        </div>
                      </Form.Item>
                    </div>
                  )}
                </Form.Item>

                {/* 提示訊息配置 */}
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: 'rgba(0, 0, 0, 0.88)', marginBottom: 4 }}>
                    {t('workflowDesigner.promptMessage')}
                  </div>
                  <div style={{ fontSize: '12px', color: 'rgba(0, 0, 0, 0.45)' }}>
                    {t('workflowDesigner.promptMessageHelp')}
                  </div>
                </div>
                
                {/* 訊息模式 Tab 切換（共用組件） - 提示訊息 */}
                <Form.Item 
                  name="promptMessage"
                  initialValue={selectedNode.data.promptMessage || ''}
                >
                  <Input.TextArea 
                    rows={3} 
                    placeholder={t('workflowDesigner.sendEForm.promptMessagePlaceholder')}
                  />
                </Form.Item>

                <Divider />

                {/* 通知訊息配置 */}
                <Form.Item label={t('workflowDesigner.sendEForm.notificationMessage')}>
                  {/* 訊息模式 Tab 切換（共用組件） */}
                  <MessageModeTabsComponent
                    selectedNode={selectedNode}
                    handleNodeDataChange={handleNodeDataChange}
                    setIsTemplateModalVisible={setIsTemplateModalVisible}
                    processVariables={processVariables}
                    form={form}
                    t={t}
                    showProcessVariables={true}
                    fixedVariables={sendEFormFixedVariables}
                    directMessageContent={(
                      // sendEForm 特殊的直接訊息內容（預設訊息 vs 自定義訊息）
                      <>
                        <div style={{ marginBottom: 8 }}>
                          <Radio.Group
                            value={selectedNode.data.useCustomMessage ? 'custom' : 'default'}
                            onChange={(e) => {
                              const useCustom = e.target.value === 'custom';
                              handleNodeDataChange({ 
                                useCustomMessage: useCustom,
                                messageTemplate: useCustom ? (selectedNode.data.messageTemplate || t('workflowDesigner.sendEForm.defaultNotificationMessage')) : t('workflowDesigner.sendEForm.defaultNotificationMessage')
                              });
                            }}
                          >
                            <Radio value="default">{t('workflowDesigner.sendEForm.useDefaultMessage')}</Radio>
                            <Radio value="custom">{t('workflowDesigner.sendEForm.customMessage')}</Radio>
                          </Radio.Group>
                        </div>
                        
                        {selectedNode.data.useCustomMessage && (
                          <>
                            <Input.TextArea
                              value={selectedNode.data.messageTemplate || ''}
                              placeholder={t('workflowDesigner.sendEForm.notificationMessagePlaceholder')}
                              rows={4}
                              onChange={(e) => handleNodeDataChange({ messageTemplate: e.target.value })}
                            />
                            <div style={{ marginTop: 4, fontSize: '12px', color: '#666' }}>
                              {t('workflowDesigner.sendEForm.notificationMessageHelp')}
                            </div>
                          </>
                        )}
                        
                        {!selectedNode.data.useCustomMessage && (
                          <div style={{ 
                            padding: '8px 12px', 
                            backgroundColor: '#f5f5f5', 
                            border: '1px solid #d9d9d9',
                            borderRadius: '6px',
                            fontSize: '14px',
                            color: '#666'
                          }}>
                            {t('workflowDesigner.sendEForm.defaultNotificationMessage')}
                          </div>
                        )}
                      </>
                    )}
                  />
                </Form.Item>
                
                <Form.Item label={t('workflowDesigner.approvalResultVariable')} name="approvalResultVariable">
                  <Select
                    placeholder={t('workflowDesigner.selectApprovalResultVariable')}
                    allowClear
                  >
                    {processVariables.map(pv => (
                      <Select.Option key={pv.id} value={pv.variableName}>
                        {pv.variableName} ({pv.dataType})
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
                
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
                  <p style={{ fontSize: '12px', margin: '4px 0' }}>
                    {t('workflowDesigner.eFormDescription5')}
                  </p>
                  <p style={{ fontSize: '12px', margin: '4px 0' }}>
                    {t('workflowDesigner.eFormDescription6')}
                  </p>
                  <p style={{ fontSize: '12px', margin: '4px 0', color: '#1890ff' }}>
                    {t('workflowDesigner.eFormDescription7')}
                  </p>
                </Card>
              </>
            )}
            
            {/* 條件分支節點 */}
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
                                handleNodeDataChange({ conditionGroups: newGroups });
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
                
                <Card size="small" title={t('workflowDesigner.functionDescription')} style={{ marginTop: 16 }}>
                  <p style={{ fontSize: '12px', margin: '4px 0' }}>
                    {t('workflowDesigner.switchDescription1')}
                  </p>
                  <p style={{ fontSize: '12px', margin: '4px 0' }}>
                    {t('workflowDesigner.switchDescription2')}
                  </p>
                  <p style={{ fontSize: '12px', margin: '4px 0', color: '#1890ff' }}>
                    {t('workflowDesigner.switchDescription3')}
                  </p>
                </Card>
              </>
            )}
          </Form>
        )}
        
        {/* Start 節點屬性 */}
        {selectedNode && selectedNode.data.type === 'start' && (
          <div style={{ color: '#888' }}>
            <Form
              form={form}
              key={selectedNode.id}
              layout="vertical"
              onValuesChange={handleFormValuesChange}
            >
              <Form.Item label={t('workflowDesigner.taskNameLabel')} name="taskName">
                <Input 
                  placeholder={t('workflowDesigner.taskNamePlaceholder')}
                  onBlur={(e) => {
                    const value = e.target.value;
                    if (value !== selectedNode.data.taskName) {
                      handleNodeDataChange({ taskName: value });
                    }
                  }}
                />
              </Form.Item>
              
              <h4>{t('workflowDesigner.activationConfig')}</h4>
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
                  <Card size="small" title={t('workflowDesigner.webhookInfo')} style={{ marginTop: 16 }}>
                    <p style={{ fontSize: '12px', margin: '4px 0' }}>
                      {t('workflowDesigner.webhookDescription1')}
                    </p>
                    <p style={{ fontSize: '12px', margin: '4px 0' }}>
                      {t('workflowDesigner.webhookDescription2')}
                    </p>
                    <p style={{ fontSize: '12px', margin: '4px 0', color: '#1890ff' }}>
                      💡 {t('workflowDesigner.webhookDescription3')}
                    </p>
                  </Card>
                </>
              )}
              
              {selectedNode.data.activationType === 'scheduled' && (
                <>
                  <Form.Item label={t('workflowDesigner.scheduledTable')} name="scheduledTable">
                    <Input placeholder={t('workflowDesigner.scheduledTablePlaceholder')} />
                  </Form.Item>
                  <Form.Item label={t('workflowDesigner.scheduledQuery')} name="scheduledQuery">
                    <Input.TextArea rows={3} placeholder={t('workflowDesigner.scheduledQueryPlaceholder')} />
                  </Form.Item>
                  <Form.Item label={t('workflowDesigner.scheduledInterval')} name="scheduledInterval">
                    <Input 
                      type="number" 
                      placeholder="300" 
                      addonAfter={t('workflowDesigner.seconds')}
                    />
                  </Form.Item>
                  <Card size="small" title={t('workflowDesigner.scheduledInfo')} style={{ marginTop: 16 }}>
                    <p style={{ fontSize: '12px', margin: '4px 0' }}>
                      {t('workflowDesigner.scheduledDescription1')}
                    </p>
                    <p style={{ fontSize: '12px', margin: '4px 0' }}>
                      {t('workflowDesigner.scheduledDescription2')}
                    </p>
                  </Card>
                </>
              )}
              
              {/* Overdue Settings - 流程逾期設置 */}
              <h4 style={{ marginTop: 24 }}>{t('workflowDesigner.overdueConfig')}</h4>
              <Card size="small" title={t('workflowDesigner.overdueSettings')} style={{ marginBottom: 16 }}>
                {/* Enable Overdue Monitoring */}
                <Form.Item label={t('workflowDesigner.overdue.enabled')} name={['overdueConfig', 'enabled']}>
                  <Select
                    options={[
                      { value: true, label: t('workflowDesigner.yes') },
                      { value: false, label: t('workflowDesigner.no') }
                    ]}
                  />
                </Form.Item>
                
                {selectedNode.data.overdueConfig?.enabled && (
                  <>
                    {/* Overdue Duration - 天/時/分 */}
                    <Form.Item label={t('workflowDesigner.overdue.duration')}>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: isFullscreen ? '1fr 1fr 1fr' : '1fr',
                        gap: isFullscreen ? '12px' : '8px'
                      }}>
                        <Input 
                          type="number" 
                          min="0" 
                          placeholder="7"
                          value={selectedNode.data.overdueConfig?.days || 0}
                          onChange={(e) => {
                            const newConfig = {
                              ...(selectedNode.data.overdueConfig || {}),
                              days: parseInt(e.target.value) || 0
                            };
                            handleNodeDataChange({ overdueConfig: newConfig });
                          }}
                          addonAfter={t('workflowDesigner.days')}
                        />
                        <Input 
                          type="number" 
                          min="0" 
                          max="23"
                          placeholder="8"
                          value={selectedNode.data.overdueConfig?.hours || 0}
                          onChange={(e) => {
                            const newConfig = {
                              ...(selectedNode.data.overdueConfig || {}),
                              hours: parseInt(e.target.value) || 0
                            };
                            handleNodeDataChange({ overdueConfig: newConfig });
                          }}
                          addonAfter={t('workflowDesigner.hours')}
                        />
                        <Input 
                          type="number" 
                          min="0" 
                          max="59"
                          placeholder="0"
                          value={selectedNode.data.overdueConfig?.minutes || 0}
                          onChange={(e) => {
                            const newConfig = {
                              ...(selectedNode.data.overdueConfig || {}),
                              minutes: parseInt(e.target.value) || 0
                            };
                            handleNodeDataChange({ overdueConfig: newConfig });
                          }}
                          addonAfter={t('workflowDesigner.minutes')}
                        />
                      </div>
                      <div style={{ marginTop: 4, fontSize: 12, color: '#999' }}>
                        💡 {t('workflowDesigner.overdue.durationHelp')}
                      </div>
                    </Form.Item>
                    
                    {/* Escalation 設置按鈕 */}
                    <Form.Item label={t('workflowDesigner.overdue.escalation')}>
                      <TimeValidatorConfigSection
                        type="overdueEscalation"
                        selectedNode={selectedNode}
                        handleNodeDataChange={handleNodeDataChange}
                        form={form}
                        processVariables={processVariables}
                        workflowDefinitionId={workflowId}
                        onOpenTemplateModal={() => {
                          setTemplateModalSource('overdue');
                          setIsTemplateModalVisible(true);
                        }}
                        onOpenRecipientModal={() => {
                          setTemplateModalSource('overdue');
                          setTimeValidatorRecipientModalVisible(true);
                        }}
                        t={t}
                        config={selectedNode?.data?.overdueConfig?.escalationConfig}
                        title={t('workflowDesigner.overdue.configureEscalation')}
                        recipientsLabel={t('workflowDesigner.timeValidator.overdueEscalationRecipients')}
                        recipientsDescription={t('workflowDesigner.timeValidator.overdueEscalationRecipientsDescription')}
                        messageLabel={t('workflowDesigner.timeValidator.overdueEscalationMessage')}
                        messageDescription={t('workflowDesigner.timeValidator.overdueEscalationMessageDescription')}
                        messagePlaceholder={t('workflowDesigner.timeValidator.overdueEscalationMessagePlaceholder')}
                        messageTip={t('workflowDesigner.timeValidator.overdueEscalationMessageTip')}
                        expanded={overdueEscalationExpanded}
                        onToggleExpanded={setOverdueEscalationExpanded}
                      />
                      
                      {/* 顯示已配置的摘要 */}
                      {selectedNode.data.overdueConfig?.escalationConfig && (
                        <div style={{ marginTop: 8, padding: 8, backgroundColor: '#fff7e6', borderRadius: 4, border: '1px solid #ffd666' }}>
                          <div style={{ fontSize: 12, color: '#d48806' }}>
                            📢 Recipients: {selectedNode.data.overdueConfig.escalationConfig.recipients || 'Not set'}
                          </div>
                          <div style={{ fontSize: 12, color: '#d48806', marginTop: 4 }}>
                            {selectedNode.data.overdueConfig.escalationConfig.useTemplate 
                              ? `📄 Template: ${selectedNode.data.overdueConfig.escalationConfig.templateName}`
                              : `✉️ Message: ${selectedNode.data.overdueConfig.escalationConfig.message?.substring(0, isFullscreen ? 100 : 50)}...`
                            }
                          </div>
                        </div>
                      )}
                    </Form.Item>
                    
                    {/* Overdue 說明 */}
                    <div style={{ 
                      padding: '8px 12px', 
                      backgroundColor: '#f0f8ff', 
                      border: '1px solid #1890ff',
                      borderRadius: '6px',
                      fontSize: '12px',
                      color: '#666',
                      marginTop: 8
                    }}>
                      <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
                        ⏰ {t('workflowDesigner.overdue.howItWorks')}
                      </div>
                      <ul style={{ margin: '4px 0', paddingLeft: '20px' }}>
                        <li>{t('workflowDesigner.overdue.description1')}</li>
                        <li>{t('workflowDesigner.overdue.description2')}</li>
                        <li>{t('workflowDesigner.overdue.description3')}</li>
                      </ul>
                    </div>
                  </>
                )}
              </Card>
            </Form>
          </div>
        )}
        </div>

        {/* 收件人選擇模態框 */}
        <RecipientModal
          visible={isRecipientModalVisible}
          onCancel={() => setIsRecipientModalVisible(false)}
          onSelect={(value, detailedValue) => {
            console.log('📤 NodePropertyDrawer - 收到選擇值:', value);
            console.log('📤 NodePropertyDrawer - 收到詳細值:', detailedValue);
            // 根據節點類型更新對應的字段
            if (selectedNode.data.type === 'sendWhatsApp' || selectedNode.data.type === 'sendWhatsAppTemplate' || selectedNode.data.type === 'sendEForm') {
              // 保存電話號碼字符串到 to 字段
              handleNodeDataChange({ to: value });
              // 保存詳細信息到 recipientDetails 字段
              if (detailedValue) {
                handleNodeDataChange({ recipientDetails: detailedValue });
              }
            } else if (selectedNode.data.type === 'waitReply' || selectedNode.data.type === 'waitForQRCode') {
              // 保存電話號碼字符串到 specifiedUsers 字段
              handleNodeDataChange({ specifiedUsers: value });
              // 保存詳細信息到 recipientDetails 字段
              if (detailedValue) {
                handleNodeDataChange({ recipientDetails: detailedValue });
              }
            }
          }}
          value={
            selectedNode.data.type === 'sendWhatsApp' || selectedNode.data.type === 'sendWhatsAppTemplate' || selectedNode.data.type === 'sendEForm'
              ? selectedNode.data.to 
              : (selectedNode.data.type === 'waitReply' || selectedNode.data.type === 'waitForQRCode')
              ? selectedNode.data.specifiedUsers
              : ''
          }
          recipientDetails={selectedNode.data.recipientDetails}
          allowMultiple={true}
          placeholder={t('workflowDesigner.selectRecipients')}
          workflowDefinitionId={workflowId}
        />

        {/* DataSet 查詢條件組模態框 */}
        <DataSetQueryConditionModal
          visible={dataSetConditionGroupModalVisible}
          onCancel={() => {
            setDataSetConditionGroupModalVisible(false);
            setEditingDataSetConditionGroup(null);
            dataSetConditionGroupForm.resetFields();
          }}
          editingConditionGroup={editingDataSetConditionGroup}
          conditionGroupForm={dataSetConditionGroupForm}
          dataSetColumns={dataSetColumns}
          processVariables={processVariables}
          onSave={handleSaveDataSetConditionGroup}
          onEditCondition={handleEditDataSetCondition}
          onAddCondition={handleAddDataSetCondition}
          onDeleteCondition={handleDeleteDataSetCondition}
          t={t}
        />

        {/* DataSet 查詢條件編輯模態框 */}
        <DataSetQueryConditionEditModal
          visible={dataSetConditionEditModalVisible}
          onCancel={() => {
            setDataSetConditionEditModalVisible(false);
            setEditingDataSetCondition(null);
            dataSetConditionForm.resetFields();
          }}
          editingCondition={editingDataSetCondition}
          conditionForm={dataSetConditionForm}
          dataSetColumns={dataSetColumns}
          processVariables={processVariables}
          onSave={handleSaveDataSetCondition}
          t={t}
        />

        {/* DataSet 欄位映射設置模態框 */}
        <DataSetFieldMappingModal
          visible={dataSetFieldMappingModalVisible}
          onCancel={() => {
            setDataSetFieldMappingModalVisible(false);
            dataSetFieldMappingForm.resetFields();
          }}
          editingMappings={(() => {
            const currentNode = nodes.find(node => node.id === selectedNode?.id);
            return currentNode?.data?.mappedFields || [];
          })()}
          mappingForm={dataSetFieldMappingForm}
          dataSetColumns={dataSetColumns}
          processVariables={processVariables}
          onSave={handleSaveDataSetFieldMapping}
          t={t}
        />

        {/* 操作數據設置模態框 */}
        <Modal
          title={t('workflowDesigner.dataSet.setOperationData')}
          open={operationDataModalVisible}
          onCancel={handleCancelOperationData}
          width={800}
          footer={null}
          destroyOnClose
        >
          <Form
            layout="vertical"
            onFinish={handleSaveOperationData}
          >
            <Form.Item label={t('workflowDesigner.dataSet.operationData')}>
              <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid #d9d9d9', borderRadius: '6px', padding: '8px' }}>
                {editingOperationData.map((field, index) => (
                  <div key={index} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px', 
                    marginBottom: '8px',
                    padding: '8px',
                    backgroundColor: '#f5f5f5',
                    borderRadius: '4px'
                  }}>
                    <Select
                      placeholder={t('workflowDesigner.dataSet.selectDataSetField')}
                      value={field.name}
                      onChange={(value) => handleUpdateOperationDataField(index, 'name', value)}
                      style={{ width: '40%' }}
                      showSearch
                      filterOption={(input, option) =>
                        (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                      }
                      options={dataSetColumns.map(col => ({
                        value: col.columnName,
                        label: `${col.displayName || col.columnName} (${col.dataType})`
                      }))}
                    />
                    <span style={{ color: '#666', fontSize: '14px' }}>←</span>
                    <Select
                      placeholder={t('workflowDesigner.dataSet.selectProcessVariable')}
                      value={field.value}
                      onChange={(value) => handleUpdateOperationDataField(index, 'value', value)}
                      style={{ width: '40%' }}
                      showSearch
                      filterOption={(input, option) =>
                        (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                      }
                      options={availableProcessVariables.map(pv => ({
                        value: `\${${pv}}`,
                        label: pv
                      }))}
                    />
                    <Button 
                      type="text" 
                      danger 
                      size="small"
                      icon={<MinusCircleOutlined />}
                      onClick={() => handleRemoveOperationDataField(index)}
                    />
                  </div>
                ))}
                
                {editingOperationData.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                    {t('workflowDesigner.dataSet.noOperationData')}
                  </div>
                )}
                
                <Button 
                  type="dashed" 
                  icon={<PlusOutlined />}
                  onClick={handleAddOperationDataField}
                  style={{ width: '100%' }}
                >
                  {t('workflowDesigner.dataSet.addFieldMapping')}
                </Button>
              </div>
            </Form.Item>
            
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '16px' }}>
              {t('workflowDesigner.dataSet.operationDataDescription')}
            </div>
            
            <div style={{ textAlign: 'right' }}>
              <Space>
                <Button onClick={handleCancelOperationData}>
                  {t('common.cancel')}
                </Button>
                <Button type="primary" htmlType="submit">
                  {t('common.save')}
                </Button>
              </Space>
            </div>
          </Form>
        </Modal>

        {/* 查詢結果預覽模態窗口 */}
        <Modal
          title={
            <div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>
                {t('workflowDesigner.dataSet.queryResultPreview')}
              </div>
              {/* PV 模擬數據輸入 - 在模態窗口標題中顯示 */}
              {(() => {
                const currentNode = nodes.find(node => node.id === selectedNode?.id);
                const conditionGroups = currentNode?.data?.queryConditionGroups || [];
                const usedVariables = extractProcessVariablesFromConditions(conditionGroups);
                
                if (usedVariables.length > 0) {
                  return (
                    <div style={{ 
                      backgroundColor: '#f8f9fa', 
                      padding: '12px', 
                      borderRadius: '6px', 
                      border: '1px solid #e9ecef',
                      marginTop: '8px'
                    }}>
                      <div style={{ fontSize: '14px', color: '#6c757d', marginBottom: '12px' }}>
                        {t('workflowDesigner.dataSet.pvSimulationDataDescription')}
                      </div>
                      
                      {usedVariables.map(variableName => (
                        <div key={variableName} style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ width: '120px', fontSize: '14px', fontWeight: '500', color: '#495057' }}>
                            ${variableName}:
                          </span>
                          <Input 
                            placeholder={`輸入 ${variableName} 的測試值`}
                            value={pvSimulationData[variableName] || ''}
                            onChange={(e) => {
                              setPvSimulationData(prev => ({
                                ...prev,
                                [variableName]: e.target.value
                              }));
                            }}
                            style={{ flex: 1 }}
                          />
                        </div>
                      ))}
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                        <div style={{ fontSize: '12px', color: '#6c757d' }}>
                          {t('workflowDesigner.dataSet.pvSimulationDataHelp')}
                        </div>
                        <Button 
                          type="primary" 
                          size="small"
                          onClick={async () => {
                            try {
                              setTestingOperation(true);
                              const currentNode = nodes.find(node => node.id === selectedNode?.id);
                              
                              // 替換查詢條件中的流程變量為模擬數據
                              const conditionGroups = currentNode?.data?.queryConditionGroups || [];
                              const processedConditionGroups = conditionGroups.map(group => ({
                                ...group,
                                conditions: group.conditions.map(condition => ({
                                  ...condition,
                                  value: condition.value.replace(/\$\{([^}]+)\}/g, (match, variableName) => {
                                    return pvSimulationData[variableName] || match;
                                  })
                                }))
                              }));
                              
                              const whereClause = generateWhereClause(processedConditionGroups);
                              
                              // 調用 API 獲取預覽數據
                              const response = await fetch('/api/datasets/preview', {
                                method: 'POST',
                                headers: {
                                  'Authorization': `Bearer ${localStorage.getItem('token')}`,
                                  'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                  dataSetId: currentNode?.data?.dataSetId || selectedNode?.data?.dataSetId,
                                  whereClause,
                                  limit: 10,
                                  processVariableValues: pvSimulationData
                                })
                              });

                              if (!response.ok) {
                                const errorText = await response.text();
                                console.error('API 錯誤響應:', errorText);
                                throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
                              }

                              const result = await response.json();
                              console.log('API 響應結果:', result);

                              if (result.success && result.data) {
                                setQueryPreviewData(result.data);
                                const total = result.totalCount ?? result.data.length;
                                message.success(`查詢成功！找到 ${total} 條記錄。`);
                              } else {
                                throw new Error(result.message || '獲取預覽數據失敗');
                              }
                            } catch (previewError) {
                              console.error('獲取預覽數據失敗:', previewError);
                              message.error('獲取預覽數據失敗: ' + previewError.message);
                            } finally {
                              setTestingOperation(false);
                            }
                          }}
                          loading={testingOperation}
                        >
                          {t('workflowDesigner.dataSet.testQuery')}
                        </Button>
                      </div>
                    </div>
                  );
                }

                return null;
              })()}
            </div>
          }
          open={queryPreviewModalVisible}
          onCancel={() => {
            setQueryPreviewModalVisible(false);
            setQueryPreviewData([]);
            setPvSimulationData({});
          }}
          footer={null}
          width={isFullscreen ? '85vw' : 960}
          style={{ top: 24 }}
          destroyOnClose
        >
          {queryPreviewData.length > 0 ? (
            <Table
              dataSource={queryPreviewData}
              columns={Object.keys(queryPreviewData[0]).map(key => ({
                title: key,
                dataIndex: key,
                key: key,
                width: 120,
                render: (text) => {
                  if (typeof text === 'number') {
                    return text.toLocaleString();
                  }
                  return text;
                }
              }))}
              pagination={false}
              size="small"
              scroll={{ x: 'max-content' }}
              style={{ fontSize: '12px' }}
              rowKey={(record, index) => `preview-row-${index}`}
            />
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
              {t('workflowDesigner.dataSet.noQueryResultData')}
            </div>
          )}
          
          <div style={{ fontSize: '12px', color: '#666', marginTop: '12px', textAlign: 'right' }}>
            {t('workflowDesigner.dataSet.totalRecords', { count: queryPreviewData.length })}
          </div>
        </Modal>

        {/* Time Validator Recipient Modal */}
        <RecipientModal
          visible={timeValidatorRecipientModalVisible}
          onCancel={() => setTimeValidatorRecipientModalVisible(false)}
          onSelect={(recipients, recipientDetails) => {
            // 直接更新節點數據，而不是臨時狀態
            if (templateModalSource === 'retryMessage') {
              const currentConfig = selectedNode?.data?.validation?.retryMessageConfig || {};
              const newValidation = {
                ...(selectedNode.data.validation || {}),
                retryMessageConfig: {
                  ...currentConfig,
                  recipients,
                  recipientDetails
                }
              };
              handleNodeDataChange({ validation: newValidation });
            } else if (templateModalSource === 'escalation') {
              const currentConfig = selectedNode?.data?.validation?.escalationConfig || {};
              const newValidation = {
                ...(selectedNode.data.validation || {}),
                escalationConfig: {
                  ...currentConfig,
                  recipients,
                  recipientDetails
                }
              };
              handleNodeDataChange({ validation: newValidation });
            } else if (templateModalSource === 'overdue') {
              const currentConfig = selectedNode?.data?.overdueConfig?.escalationConfig || {};
              const newOverdueConfig = {
                ...(selectedNode.data.overdueConfig || {}),
                escalationConfig: {
                  ...currentConfig,
                  recipients,
                  recipientDetails
                }
              };
              handleNodeDataChange({ overdueConfig: newOverdueConfig });
            }
            setTimeValidatorRecipientModalVisible(false);
          }}
          value={
            templateModalSource === 'retryMessage'
              ? (selectedNode?.data?.validation?.retryMessageConfig?.recipients || '')
              : templateModalSource === 'overdue'
              ? (selectedNode?.data?.overdueConfig?.escalationConfig?.recipients || '')
              : (selectedNode?.data?.validation?.escalationConfig?.recipients || '')
          }
          recipientDetails={
            templateModalSource === 'retryMessage'
              ? (selectedNode?.data?.validation?.retryMessageConfig?.recipientDetails || null)
              : templateModalSource === 'overdue'
              ? (selectedNode?.data?.overdueConfig?.escalationConfig?.recipientDetails || null)
              : (selectedNode?.data?.validation?.escalationConfig?.recipientDetails || null)
          }
          allowMultiple
          workflowDefinitionId={workflowId}
          t={t}
        />
      </Drawer>
    </>
  );
};

export default NodePropertyDrawer;