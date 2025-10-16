import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Button, Input, Select, Card, Space, Typography, Tag, Tooltip } from 'antd';
import { PlusOutlined, DeleteOutlined, InfoCircleOutlined } from '@ant-design/icons';

const { Text } = Typography;

/**
 * 通用模板變量配置組件
 * 支持內部模板和 Meta 官方模板的變量映射
 */
const TemplateVariableConfig = ({ 
  templateId,
  isMetaTemplate,
  processVariables = [],
  value = [],
  onChange,
  t
}) => {
  const [templateVariables, setTemplateVariables] = useState([]);

  // 調試 processVariables 數據結構
  useEffect(() => {
    console.log('🔍 TemplateVariableConfig - processVariables 數據結構:', processVariables);
    console.log('🔍 TemplateVariableConfig - processVariables 數量:', processVariables.length);
    if (processVariables.length > 0) {
      console.log('🔍 TemplateVariableConfig - 第一個流程變量:', processVariables[0]);
      console.log('🔍 TemplateVariableConfig - 第一個流程變量的屬性:', Object.keys(processVariables[0]));
    }
  }, [processVariables]);

  // 使用 useRef 來避免無限循環
  const isInitialized = useRef(false);
  const lastValue = useRef(value);
  const lastTemplateVariables = useRef(templateVariables);

  // 當外部 value 變化時更新內部狀態
  useEffect(() => {
    const valueChanged = lastValue.current !== value;
    
    if (!valueChanged && isInitialized.current) {
      return;
    }

    if (value) {
      setTemplateVariables(value);
    }
    
    lastValue.current = value;
    isInitialized.current = true;
  }, [value]);

  // 當模板變量變化時通知父組件
  useEffect(() => {
    const variablesChanged = lastTemplateVariables.current !== templateVariables;
    
    if (!variablesChanged || !isInitialized.current) {
      return;
    }

    if (onChange) {
      onChange(templateVariables);
    }
    
    lastTemplateVariables.current = templateVariables;
  }, [templateVariables, onChange]);

  // 添加新的模板變量
  const addTemplateVariable = useCallback(() => {
    const newVariable = {
      parameterName: '',
      processVariableId: '',
      processVariableName: ''
    };
    setTemplateVariables(prev => [...prev, newVariable]);
  }, []);

  // 刪除模板變量
  const removeTemplateVariable = useCallback((index) => {
    setTemplateVariables(prev => prev.filter((_, i) => i !== index));
  }, []);

  // 更新參數名稱
  const updateParameterName = useCallback((index, value) => {
    setTemplateVariables(prev => {
      const newVariables = [...prev];
      newVariables[index].parameterName = value;
      return newVariables;
    });
  }, []);

  // 更新流程變量
  const updateProcessVariable = useCallback((index, processVariableId) => {
    setTemplateVariables(prev => {
      const newVariables = [...prev];
      const selectedVariable = processVariables.find(pv => pv.id === processVariableId);
      newVariables[index].processVariableId = processVariableId;
      newVariables[index].processVariableName = selectedVariable 
        ? (selectedVariable.variableName || selectedVariable.name || selectedVariable.displayName || `變量 ${selectedVariable.id}`) 
        : '';
      return newVariables;
    });
  }, [processVariables]);

  // 獲取模板類型說明
  const templateInfo = useMemo(() => {
    if (isMetaTemplate) {
      return {
        title: t('workflowDesigner.metaTemplateVariableConfig'),
        description: t('workflowDesigner.metaTemplateVariableDescription'),
        parameterPlaceholder: t('workflowDesigner.metaTemplateParameterPlaceholder'),
        parameterHint: t('workflowDesigner.metaTemplateParameterHint')
      };
    } else {
      return {
        title: t('workflowDesigner.internalTemplateVariableConfig'),
        description: t('workflowDesigner.internalTemplateVariableDescription'),
        parameterPlaceholder: t('workflowDesigner.internalTemplateParameterPlaceholder'),
        parameterHint: t('workflowDesigner.internalTemplateParameterHint')
      };
    }
  }, [isMetaTemplate, t]);

  return (
    <div>
      {/* 模板變量配置說明 */}
      <Card size="small" style={{ marginBottom: 16, backgroundColor: '#f0f9ff', border: '1px solid #bae6fd' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <InfoCircleOutlined style={{ color: '#1890ff', marginTop: 2 }} />
          <div>
            <div style={{ fontWeight: 'bold', color: '#1890ff', marginBottom: 4 }}>
              {templateInfo.title}
            </div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {templateInfo.description}
            </Text>
          </div>
        </div>
      </Card>

      {/* 添加模板變量按鈕 */}
      <Button 
        type="dashed" 
        icon={<PlusOutlined />}
        onClick={addTemplateVariable}
        style={{ width: '100%', marginBottom: 16 }}
      >
        {t('workflowDesigner.addTemplateVariable')}
      </Button>

      {/* 模板變量列表 */}
      {templateVariables.map((variable, index) => (
        <Card 
          key={index}
          size="small" 
          style={{ marginBottom: 12 }}
          title={
            <Space>
              <Text strong>{t('workflowDesigner.templateVariable')} {index + 1}</Text>
              {variable.parameterName && (
                <Tag color="blue">{variable.parameterName}</Tag>
              )}
              {variable.processVariableName && (
                <Tag color="green">{variable.processVariableName}</Tag>
              )}
            </Space>
          }
          extra={
            <Button
              type="text"
              danger
              size="small"
              icon={<DeleteOutlined />}
              onClick={() => removeTemplateVariable(index)}
            />
          }
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            {/* 參數名稱 */}
            <div>
              <Text strong style={{ display: 'block', marginBottom: 4 }}>
                {t('workflowDesigner.parameterName')}:
              </Text>
              <Input
                placeholder={templateInfo.parameterPlaceholder}
                value={variable.parameterName}
                onChange={(e) => updateParameterName(index, e.target.value)}
                style={{ marginBottom: 4 }}
              />
              <Text type="secondary" style={{ fontSize: 11 }}>
                {templateInfo.parameterHint}
              </Text>
            </div>

            {/* 流程變量 */}
            <div>
              <Text strong style={{ display: 'block', marginBottom: 4 }}>
                {t('workflowDesigner.processVariable')}:
              </Text>
              <Select
                placeholder={t('workflowDesigner.selectProcessVariable')}
                value={variable.processVariableId || undefined}
                onChange={(value) => updateProcessVariable(index, value)}
                style={{ width: '100%' }}
                showSearch
                filterOption={(input, option) =>
                  option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
                }
              >
                {processVariables.map(pv => {
                  const displayName = pv.variableName || pv.name || pv.displayName || `變量 ${pv.id}`;
                  const dataType = pv.dataType || pv.type || 'Unknown';
                  
                  return (
                    <Select.Option key={pv.id} value={pv.id}>
                      <Space>
                        <Text>{displayName}</Text>
                        <Tag size="small" color="orange">{dataType}</Tag>
                      </Space>
                    </Select.Option>
                  );
                })}
              </Select>
            </div>
          </Space>
        </Card>
      ))}

      {/* 空狀態 */}
      {templateVariables.length === 0 && (
        <div style={{ 
          textAlign: 'center', 
          padding: 20, 
          color: '#999',
          border: '1px dashed #d9d9d9',
          borderRadius: 6
        }}>
          {t('workflowDesigner.noTemplateVariables')}
        </div>
      )}
    </div>
  );
};

export default React.memo(TemplateVariableConfig);
