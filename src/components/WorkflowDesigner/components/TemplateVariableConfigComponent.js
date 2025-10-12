import React, { useState, useEffect } from 'react';
import { 
  Button, 
  Input, 
  Select, 
  Card, 
  Space, 
  Typography, 
  Divider,
  Alert
} from 'antd';
import { 
  PlusOutlined, 
  DeleteOutlined, 
  SettingOutlined
} from '@ant-design/icons';

const { Option } = Select;
const { Text, Title } = Typography;

const TemplateVariableConfigComponent = ({
  selectedNode,
  handleNodeDataChange,
  processVariables = [],
  t
}) => {

  // 獲取模板變數配置
  const templateVariables = selectedNode.data.templateVariables || [];
  const isMetaTemplate = selectedNode.data.isMetaTemplate;

  // 添加新的模板變數
  const addTemplateVariable = () => {
    const newVariables = [...templateVariables, {
      id: `var_${Date.now()}`,
      parameterName: '', // Meta 模板參數名 (1, 2, 3... 或 customer_name)
      processVariableId: '', // 流程變數 ID
      processVariableName: '' // 流程變數名稱
    }];
    handleNodeDataChange({ templateVariables: newVariables });
  };

  // 更新模板變數
  const updateTemplateVariable = (index, field, value) => {
    const newVariables = [...templateVariables];
    newVariables[index] = { ...newVariables[index], [field]: value };
    
    // 如果更改了流程變數 ID，更新流程變數名稱
    if (field === 'processVariableId') {
      const processVar = processVariables.find(v => v.id === value);
      if (processVar) {
        const displayName = processVar.VariableName || processVar.name || processVar.variableName || processVar.displayName || 'Unknown';
        newVariables[index].processVariableName = displayName;
      }
    }
    
    handleNodeDataChange({ templateVariables: newVariables });
  };

  // 刪除模板變數
  const removeTemplateVariable = (index) => {
    const newVariables = templateVariables.filter((_, i) => i !== index);
    handleNodeDataChange({ templateVariables: newVariables });
  };

  // 獲取流程變數選項
  const getProcessVariableOptions = () => {
    if (!processVariables || processVariables.length === 0) {
      return [];
    }
    
    return processVariables.map(variable => {
      // 使用正確的屬性名稱 VariableName
      const displayName = variable.VariableName || variable.name || variable.variableName || variable.displayName || 'Unknown';
      
      return (
        <Option key={variable.id} value={variable.id}>
          <Space>
            <SettingOutlined />
            <span>{displayName}</span>
          </Space>
        </Option>
      );
    });
  };

  return (
    <div>
      <Title level={5}>{t('whatsappTemplate.templateVariables')}</Title>
      
      {isMetaTemplate && (
        <Alert
          message={t('whatsappTemplate.metaTemplateVariableHint')}
          description={t('whatsappTemplate.metaTemplateVariableDescription')}
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <div style={{ marginBottom: 8 }}>
        <Button 
          type="dashed" 
          onClick={addTemplateVariable}
          style={{ width: '100%' }}
          icon={<PlusOutlined />}
        >
          {t('whatsappTemplate.addTemplateVariable')}
        </Button>
      </div>

      {templateVariables.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {templateVariables.map((variable, index) => (
            <Card key={variable.id} size="small" style={{ border: '1px solid #d9d9d9' }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                {/* 參數名稱 */}
                <div>
                  <Text strong>{t('whatsappTemplate.parameterName')}:</Text>
                  <Input
                    placeholder={isMetaTemplate ? "1, 2, 3..." : "customer_name, order_id"}
                    value={variable.parameterName}
                    onChange={(e) => updateTemplateVariable(index, 'parameterName', e.target.value)}
                    style={{ marginTop: 4 }}
                  />
                  {isMetaTemplate && (
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {t('whatsappTemplate.metaParameterHint')}
                    </Text>
                  )}
                </div>

                <Divider style={{ margin: '8px 0' }} />

                {/* 流程變數選擇 */}
                <div>
                  <Text strong>{t('whatsappTemplate.processVariable')}:</Text>
                  <Space style={{ width: '100%', marginTop: 4 }}>
                        <Select
                          value={variable.processVariableId}
                          onChange={(value) => updateTemplateVariable(index, 'processVariableId', value)}
                          placeholder={t('whatsappTemplate.selectVariable')}
                          style={{ flex: 1, minWidth: '200px' }}
                        >
                      {getProcessVariableOptions()}
                    </Select>

                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => removeTemplateVariable(index)}
                    />
                  </Space>
                </div>

                {/* 顯示選中的變數信息 */}
                {variable.processVariableName && (
                  <div>
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {t('whatsappTemplate.selectedVariable', { variableName: variable.processVariableName })}
                    </Text>
                  </div>
                )}
              </Space>
            </Card>
          ))}
        </div>
      )}

    </div>
  );
};

export default TemplateVariableConfigComponent;