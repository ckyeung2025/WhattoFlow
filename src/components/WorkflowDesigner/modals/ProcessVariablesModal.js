import React from 'react';
import { Modal, Button, Card, Tag, Popconfirm, Form, Input, Select, Space } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';

// 流程變量管理 Modal
const ProcessVariablesModal = ({
  visible,
  onCancel,
  processVariables,
  selectedProcessVariable,
  editingProcessVariable,
  processVariableForm,
  onAddProcessVariable,
  onEditProcessVariable,
  onDeleteProcessVariable,
  onSaveProcessVariable,
  onCancelProcessVariableEdit,
  t
}) => {
  return (
    <Modal
      title={t('processVariables.title')}
      open={visible}
      onCancel={onCancel}
      width={1200}
      footer={null}
      destroyOnClose
      style={{ top: 20 }}
    >
      <div style={{ display: 'flex', height: '70vh', minHeight: '600px' }}>
        {/* 左側：變量列表 */}
        <div style={{ width: '40%', borderRight: '1px solid #e8e8e8', paddingRight: '16px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <h4 style={{ margin: 0 }}>{t('processVariables.variableList')}</h4>
            <Button 
              type="primary" 
              icon={<PlusOutlined />}
              onClick={onAddProcessVariable}
              size="small"
            >
              {t('processVariables.addVariable')}
            </Button>
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto', paddingRight: '8px' }}>
            {!processVariables || processVariables.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                {t('processVariables.noVariables')}
              </div>
            ) : (
              processVariables.map(variable => (
                <Card
                  key={variable.id}
                  size="small"
                  style={{ 
                    marginBottom: '8px',
                    cursor: 'pointer',
                    border: selectedProcessVariable && selectedProcessVariable.id === variable.id ? '2px solid #1890ff' : '1px solid #d9d9d9'
                  }}
                  onClick={() => onEditProcessVariable(variable)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
                        {variable.variableName}
                      </div>
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        {variable.displayName || t('processVariables.noDisplayName')}
                      </div>
                      <Tag size="small" color="blue">
                        {variable.dataType}
                      </Tag>
                      {variable.isRequired && (
                        <Tag size="small" color="red">
                          {t('processVariables.required')}
                        </Tag>
                      )}
                    </div>
                    <Popconfirm
                      title={t('processVariables.confirmDelete')}
                      onConfirm={() => onDeleteProcessVariable(variable.id)}
                      okText={t('processVariables.confirmDeleteOk')}
                      cancelText={t('processVariables.confirmDeleteCancel')}
                    >
                      <Button 
                        type="text" 
                        danger 
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </Popconfirm>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
        
        {/* 右側：變量編輯表單 */}
        <div style={{ width: '60%', paddingLeft: '16px', display: 'flex', flexDirection: 'column' }}>
          {editingProcessVariable ? (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ flex: 1, overflowY: 'auto', paddingRight: '8px' }}>
                <Form
                  form={processVariableForm}
                  layout="vertical"
                  onFinish={onSaveProcessVariable}
                >
                  <Form.Item
                    label={t('processVariables.variableName')}
                    name="variableName"
                    rules={[
                      { required: true, message: t('processVariables.variableNameRequired') },
                      { pattern: /^[a-zA-Z_][a-zA-Z0-9_]*$/, message: t('processVariables.variableNamePattern') }
                    ]}
                  >
                    <Input placeholder={t('processVariables.variableNamePlaceholder')} />
                  </Form.Item>
                  
                  <Form.Item
                    label={t('processVariables.displayName')}
                    name="displayName"
                  >
                    <Input placeholder={t('processVariables.displayNamePlaceholder')} />
                  </Form.Item>
                  
                  <Form.Item
                    label={t('processVariables.dataType')}
                    name="dataType"
                    rules={[{ required: true, message: t('processVariables.dataTypeRequired') }]}
                  >
                    <Select
                      options={[
                        { value: 'string', label: t('processVariables.dataTypeString') },
                        { value: 'int', label: t('processVariables.dataTypeInt') },
                        { value: 'decimal', label: t('processVariables.dataTypeDecimal') },
                        { value: 'datetime', label: t('processVariables.dataTypeDatetime') },
                        { value: 'boolean', label: t('processVariables.dataTypeBoolean') },
                        { value: 'text', label: t('processVariables.dataTypeText') },
                        { value: 'json', label: t('processVariables.dataTypeJson') }
                      ]}
                    />
                  </Form.Item>
                  
                  <Form.Item
                    label={t('processVariables.description')}
                    name="description"
                  >
                    <Input.TextArea rows={2} placeholder={t('processVariables.descriptionPlaceholder')} />
                  </Form.Item>
                  
                  <Form.Item
                    label={t('processVariables.isRequired')}
                    name="isRequired"
                    valuePropName="checked"
                  >
                    <input type="checkbox" />
                  </Form.Item>
                  
                  <Form.Item
                    label={t('processVariables.defaultValue')}
                    name="defaultValue"
                  >
                    <Input placeholder={t('processVariables.defaultValuePlaceholder')} />
                  </Form.Item>
                  
                  <Form.Item
                    label={t('processVariables.validationRules')}
                    name="validationRules"
                  >
                    <Input.TextArea rows={2} placeholder={t('processVariables.validationRulesPlaceholder')} />
                  </Form.Item>
                  
                  <Form.Item
                    label={t('processVariables.jsonSchema')}
                    name="jsonSchema"
                  >
                    <Input.TextArea rows={4} placeholder={t('processVariables.jsonSchemaPlaceholder')} />
                  </Form.Item>
                </Form>
              </div>
              
              {/* 固定在底部的按鈕區域 */}
              <div style={{ 
                borderTop: '1px solid #e8e8e8', 
                paddingTop: '16px', 
                marginTop: '16px',
                flexShrink: 0
              }}>
                <Space>
                  <Button 
                    type="primary" 
                    onClick={() => {
                      processVariableForm.validateFields().then(values => {
                        onSaveProcessVariable(values);
                      }).catch(errorInfo => {
                        console.log('表單驗證失敗:', errorInfo);
                      });
                    }}
                  >
                    {editingProcessVariable && editingProcessVariable.id ? t('processVariables.updateVariable') : t('processVariables.createVariable')}
                  </Button>
                  <Button onClick={onCancelProcessVariableEdit}>
                    {t('processVariables.cancel')}
                  </Button>
                </Space>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
              {t('processVariables.selectVariableToEdit')}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default ProcessVariablesModal;
