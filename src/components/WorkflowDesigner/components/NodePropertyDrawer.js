import React, { useEffect, useMemo, useCallback, useState } from 'react';
import { Drawer, Form, Input, Select, Card, Button, Space, Tag, message, Alert, Table, Modal } from 'antd';
import { MinusCircleOutlined, PlusOutlined, SettingOutlined, FormOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import ProcessVariableSelect from './ProcessVariableSelect';
import RecipientModal from '../modals/RecipientModal';
import RecipientSelector from './RecipientSelector';
import DataSetQueryConditionModal from '../modals/DataSetQueryConditionModal';
import DataSetQueryConditionEditModal from '../modals/DataSetQueryConditionEditModal';
import DataSetFieldMappingModal from '../modals/DataSetFieldMappingModal';
import { getAvailableOutputPaths } from '../utils';
import { apiService } from '../services/apiService';

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
  t,
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
}) => {
  // DataSet 相關狀態
  const [dataSets, setDataSets] = useState([]);
  const [dataSetColumns, setDataSetColumns] = useState([]);
  const [operationDataFields, setOperationDataFields] = useState([]);
  const [availableProcessVariables, setAvailableProcessVariables] = useState([]);
  const [loadingDataSets, setLoadingDataSets] = useState(false);
  const [testingOperation, setTestingOperation] = useState(false);
  
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

  // 當 selectedNode 改變時，更新 Form 的字段值
  useEffect(() => {
    if (selectedNode && form) {
      // 重置表單並設置新的初始值
      form.resetFields();
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
        qrCodeSuccessMessage: selectedNode.data.qrCodeSuccessMessage || t('workflowDesigner.dataSet.qrCodeSuccessMessage'),
        qrCodeErrorMessage: selectedNode.data.qrCodeErrorMessage || t('workflowDesigner.dataSet.qrCodeErrorMessage'),
        approvalResultVariable: selectedNode.data.approvalResultVariable || '',
        activationType: selectedNode.data.activationType || 'manual',
        webhookToken: selectedNode.data.webhookToken || '',
        scheduledTable: selectedNode.data.scheduledTable || '',
        scheduledQuery: selectedNode.data.scheduledQuery || '',
        scheduledInterval: selectedNode.data.scheduledInterval || 300,
        validation: selectedNode.data.validation || {},
        // DataSet 查詢節點相關字段
        dataSetId: selectedNode.data.dataSetId || '',
        operationType: selectedNode.data.operationType || 'SELECT',
        queryConditions: selectedNode.data.queryConditions || '',
        operationData: selectedNode.data.operationData || {},
        mappedFields: selectedNode.data.mappedFields || [],
        ...selectedNode.data
      });
    }
  }, [selectedNode?.id, form]); // 只依賴 selectedNode.id，而不是整個 selectedNode 對象

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
              dataSetId: requestData.dataSetId,
              whereClause: whereClause,
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
            // 更新查詢結果預覽數據
            setQueryPreviewData(result.data);
            message.success(`查詢成功！找到 ${result.totalCount} 條記錄。`);
          } else {
            throw new Error(result.message || '獲取預覽數據失敗');
          }
        } catch (previewError) {
          console.error('獲取預覽數據失敗:', previewError);
          message.error('獲取預覽數據失敗: ' + previewError.message);
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
      // 使用 setTimeout 來避免在輸入過程中觸發重新渲染
      setTimeout(() => {
        handleNodeDataChange(otherValues);
      }, 0);
    }
  }, [handleNodeDataChange]);

  if (!selectedNode) return null;

  return (
    <Drawer
      title={selectedNode ? t(`workflowDesigner.${selectedNode.data.type}Node`) : ''}
      placement="right"
      open={drawerOpen}
      onClose={() => setDrawerOpen(false)}
      width={340}
    >
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
          
          {/* 發送 WhatsApp 消息節點 */}
          {selectedNode.data.type === 'sendWhatsApp' && (
            <>
              <Form.Item label={t('workflow.to')}>
                <div style={{ position: 'relative' }}>
                  <RecipientSelector
                    value={selectedNode.data.to || ''}
                    recipientDetails={selectedNode.data.recipientDetails}
                    placeholder={t('workflowDesigner.selectRecipients')}
                    compact={true}
                    onChange={(value, detailedValue) => {
                      handleNodeDataChange({ 
                        to: value,
                        recipientDetails: detailedValue 
                      });
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
                    <Button 
                      type="text" 
                      size="small" 
                      onClick={() => setIsRecipientModalVisible(true)}
                      style={{ padding: '0 4px', fontSize: '12px' }}
                    >
                      {t('workflowDesigner.selectRecipients')}
                    </Button>
                  </div>
                </div>
              </Form.Item>
              <Form.Item label={t('workflow.message')} name="message">
                <Input.TextArea 
                  rows={3} 
                  placeholder={t('workflowDesigner.messageWithVariablesPlaceholder')}
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
                          form.setFieldValue('message', newValue);
                          handleNodeDataChange({ message: newValue });
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
                    onChange={(value, detailedValue) => {
                      handleNodeDataChange({ 
                        to: value,
                        recipientDetails: detailedValue 
                      });
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
                    <Button 
                      type="text" 
                      size="small" 
                      onClick={() => setIsRecipientModalVisible(true)}
                      style={{ padding: '0 4px', fontSize: '12px' }}
                    >
                      {t('workflowDesigner.selectRecipients')}
                    </Button>
                  </div>
                </div>
              </Form.Item>
              <Form.Item label={t('workflowDesigner.dataSet.template')}>
                <Input 
                  value={selectedNode.data.templateName || ''}
                  placeholder={t('workflowDesigner.selectTemplate')} 
                  readOnly 
                  onClick={() => setIsTemplateModalVisible(true)}
                  suffix={<FormOutlined />}
                />
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
                      onChange={(value, detailedValue) => {
                        handleNodeDataChange({ 
                          specifiedUsers: value,
                          recipientDetails: detailedValue 
                        });
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
                      <Button 
                        type="text" 
                        size="small" 
                        onClick={() => setIsRecipientModalVisible(true)}
                        style={{ padding: '0 4px', fontSize: '12px' }}
                      >
                        {t('workflowDesigner.selectRecipients')}
                      </Button>
                    </div>
                  </div>
                </Form.Item>
              )}
              
              <Form.Item label={t('workflowDesigner.promptMessage')} name="message">
                <Input.TextArea 
                  rows={3} 
                  placeholder={t('workflowDesigner.waitReplyMessagePlaceholder')}
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
                          form.setFieldValue('message', newValue);
                          handleNodeDataChange({ message: newValue });
                        }}
                      >
                        {pv.variableName} ({pv.dataType})
                      </Tag>
                    ))}
                  </div>
                </Form.Item>
              )}
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
                      onChange={(value, detailedValue) => {
                        handleNodeDataChange({ 
                          specifiedUsers: value,
                          recipientDetails: detailedValue 
                        });
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
                      <Button 
                        type="text" 
                        size="small" 
                        onClick={() => setIsRecipientModalVisible(true)}
                        style={{ padding: '0 4px', fontSize: '12px' }}
                      >
                        {t('workflowDesigner.selectRecipients')}
                      </Button>
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
              
              <Form.Item label={t('workflowDesigner.promptMessage')} name="message">
                <Input.TextArea 
                  rows={3} 
                  placeholder={t('workflowDesigner.qrCodeMessagePlaceholder')}
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
                          form.setFieldValue('message', newValue);
                          handleNodeDataChange({ message: newValue });
                        }}
                      >
                        {pv.variableName} ({pv.dataType})
                      </Tag>
                    ))}
                  </div>
                </Form.Item>
              )}
              
              <Form.Item label={t('workflowDesigner.timeout')} name="timeout">
                <Input 
                  type="number" 
                  placeholder="300" 
                  addonAfter={t('workflowDesigner.seconds')}
                />
              </Form.Item>
              
              <Form.Item label={t('workflowDesigner.qrCodeSuccessMessage')} name="qrCodeSuccessMessage">
                <Input.TextArea 
                  rows={2} 
                  placeholder={t('workflowDesigner.dataSet.qrCodeSuccessMessage')}
                />
              </Form.Item>
              
              <Form.Item label={t('workflowDesigner.qrCodeErrorMessage')} name="qrCodeErrorMessage">
                <Input.TextArea 
                  rows={2} 
                  placeholder={t('workflowDesigner.dataSet.qrCodeErrorMessage')}
                />
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
                    onChange={(value, detailedValue) => {
                      handleNodeDataChange({ 
                        to: value,
                        recipientDetails: detailedValue 
                      });
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
                    <Button 
                      type="text" 
                      size="small" 
                      onClick={() => setIsRecipientModalVisible(true)}
                      style={{ padding: '0 4px', fontSize: '12px' }}
                    >
                      {t('workflowDesigner.selectRecipients')}
                    </Button>
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
                <Form.Item label={t('workflowDesigner.webhookToken')} name="webhookToken">
                  <Input placeholder={t('workflowDesigner.webhookTokenPlaceholder')} />
                </Form.Item>
                <Card size="small" title={t('workflowDesigner.webhookInfo')} style={{ marginTop: 16 }}>
                  <p style={{ fontSize: '12px', margin: '4px 0' }}>
                    {t('workflowDesigner.webhookDescription1')}
                  </p>
                  <p style={{ fontSize: '12px', margin: '4px 0' }}>
                    {t('workflowDesigner.webhookDescription2')}
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
          </Form>
        </div>
      )}

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
                                dataSetId: currentNode.data.dataSetId,
                                whereClause: whereClause,
                                limit: 10,
                                processVariableValues: pvSimulationData
                              })
                            });

                            if (!response.ok) {
                              const errorText = await response.text();
                              throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
                            }

                            const result = await response.json();
                            
                            if (result.success && result.data) {
                              setQueryPreviewData(result.data);
                              message.success(`查詢成功！找到 ${result.totalCount} 條記錄。`);
                            } else {
                              throw new Error(result.message || '獲取預覽數據失敗');
                            }
                          } catch (error) {
                            console.error('查詢失敗:', error);
                            message.error('查詢失敗: ' + error.message);
                          } finally {
                            setTestingOperation(false);
                          }
                        }}
                        loading={testingOperation}
                        disabled={!selectedNode?.data?.dataSetId}
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
        onCancel={() => setQueryPreviewModalVisible(false)}
        width={1000}
        footer={[
          <Button key="close" onClick={() => setQueryPreviewModalVisible(false)}>
            {t('workflowDesigner.dataSet.close')}
          </Button>
        ]}
        destroyOnClose
      >
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>
            {t('workflowDesigner.dataSet.queryResultDescription')}
          </div>
          {(() => {
            const currentNode = nodes.find(node => node.id === selectedNode?.id);
            const conditionGroups = currentNode?.data?.queryConditionGroups || [];
            const whereClause = generateWhereClause(conditionGroups);
            
            return (
              <div style={{ 
                padding: '8px 12px', 
                backgroundColor: '#f5f5f5', 
                borderRadius: '4px',
                fontSize: '12px',
                color: '#666',
                marginBottom: '16px'
              }}>
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{t('workflowDesigner.dataSet.generatedWhereClause')}:</div>
                <div style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                  {whereClause || t('workflowDesigner.dataSet.noQueryConditions')}
                </div>
              </div>
            );
          })()}
        </div>
        
        {queryPreviewData.length > 0 ? (
          <Table
            dataSource={queryPreviewData}
            columns={Object.keys(queryPreviewData[0] || {}).map(key => ({
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
    </Drawer>
  );
};

export default React.memo(NodePropertyDrawer);
