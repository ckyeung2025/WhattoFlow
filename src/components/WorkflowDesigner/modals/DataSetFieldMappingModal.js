import React, { useEffect, useState } from 'react';
import { Modal, Form, Input, Select, Button, Space, Card, message } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined, MinusCircleOutlined } from '@ant-design/icons';

// DataSet 欄位映射設置 Modal
const DataSetFieldMappingModal = ({
  visible,
  onCancel,
  editingMappings,
  mappingForm,
  dataSetColumns,
  processVariables,
  onSave,
  t
}) => {
  const [mappedFields, setMappedFields] = useState([]);

  // 當模態框打開時，設置表單的初始值
  useEffect(() => {
    if (visible && editingMappings) {
      console.log('=== 設置 DataSet 欄位映射表單初始值 ===');
      console.log('editingMappings:', editingMappings);
      
      setMappedFields(editingMappings || []);
    }
  }, [visible, editingMappings]);

  const handleSave = async (values) => {
    try {
      onSave(mappedFields);
      setMappedFields([]);
      message.success(t('workflowDesigner.dataSet.fieldMappingSaved'));
    } catch (error) {
      console.error('保存欄位映射失敗:', error);
      message.error(t('workflowDesigner.dataSet.fieldMappingSaveFailed'));
    }
  };

  const handleAddMapping = () => {
    const newMappings = [...mappedFields, { fieldName: '', variableName: '' }];
    setMappedFields(newMappings);
  };

  const handleRemoveMapping = (index) => {
    const newMappings = mappedFields.filter((_, i) => i !== index);
    setMappedFields(newMappings);
  };

  const handleFieldChange = (index, field, value) => {
    const newMappings = [...mappedFields];
    newMappings[index] = { ...newMappings[index], [field]: value };
    setMappedFields(newMappings);
  };

  return (
    <Modal
      title={t('workflowDesigner.dataSet.setFieldMapping')}
      open={visible}
      onCancel={onCancel}
      width={800}
      footer={null}
      destroyOnClose
    >
      <Form
        form={mappingForm}
        layout="vertical"
        onFinish={handleSave}
      >
        <Form.Item label={t('workflowDesigner.dataSet.fieldMapping')}>
          <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid #d9d9d9', borderRadius: '6px', padding: '8px' }}>
            {mappedFields.map((mapping, index) => (
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
                  value={mapping.fieldName}
                  onChange={(value) => handleFieldChange(index, 'fieldName', value)}
                  style={{ width: '40%' }}
                >
                  {dataSetColumns.map(col => (
                    <Select.Option key={col.columnName} value={col.columnName}>
                      {col.displayName || col.columnName} ({col.dataType})
                    </Select.Option>
                  ))}
                </Select>
                <span style={{ color: '#666', fontSize: '14px' }}>→</span>
                <Select 
                  placeholder={t('workflowDesigner.dataSet.selectProcessVariable')}
                  value={mapping.variableName}
                  onChange={(value) => handleFieldChange(index, 'variableName', value)}
                  style={{ width: '40%' }}
                  showSearch
                  filterOption={(input, option) =>
                    option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
                  }
                >
                  {processVariables && processVariables.length > 0 ? (
                    processVariables.map(pv => (
                      <Select.Option key={pv.id} value={pv.variableName}>
                        {pv.variableName} ({pv.dataType})
                      </Select.Option>
                    ))
                  ) : (
                    <Select.Option value="" disabled>
                      暫無流程變量
                    </Select.Option>
                  )}
                </Select>
                <Button 
                  type="text" 
                  danger 
                  size="small"
                  icon={<MinusCircleOutlined />}
                  onClick={() => handleRemoveMapping(index)}
                />
              </div>
            ))}
            
            {mappedFields.length === 0 && (
              <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                {t('workflowDesigner.dataSet.noFieldMapping')}
              </div>
            )}
            
            <Button 
              type="dashed" 
              icon={<PlusOutlined />}
              onClick={handleAddMapping}
              style={{ width: '100%' }}
            >
              {t('workflowDesigner.dataSet.addFieldMapping')}
            </Button>
          </div>
        </Form.Item>
        
        <div style={{ fontSize: '12px', color: '#666', marginBottom: '16px' }}>
          {t('workflowDesigner.dataSet.fieldMappingDescription')}
        </div>
        
        <div style={{ textAlign: 'right' }}>
          <Space>
            <Button onClick={onCancel}>
              {t('common.cancel')}
            </Button>
            <Button type="primary" htmlType="submit">
              {t('common.save')}
            </Button>
          </Space>
        </div>
      </Form>
    </Modal>
  );
};

export default DataSetFieldMappingModal;
