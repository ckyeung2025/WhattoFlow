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
      message.success('欄位映射保存成功');
    } catch (error) {
      console.error('保存欄位映射失敗:', error);
      message.error('保存欄位映射失敗');
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
      title="設置欄位映射"
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
        <Form.Item label="欄位映射設置">
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
                  placeholder="選擇 DataSet 欄位"
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
                  placeholder="選擇流程變量"
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
                暫無欄位映射
              </div>
            )}
            
            <Button 
              type="dashed" 
              icon={<PlusOutlined />}
              onClick={handleAddMapping}
              style={{ width: '100%' }}
            >
              添加欄位映射
            </Button>
          </div>
        </Form.Item>
        
        <div style={{ fontSize: '12px', color: '#666', marginBottom: '16px' }}>
          選擇 DataSet 欄位並從現有流程變量中選擇對應的變量，查詢結果會自動映射到流程變量中
        </div>
        
        <div style={{ textAlign: 'right' }}>
          <Space>
            <Button onClick={onCancel}>
              取消
            </Button>
            <Button type="primary" htmlType="submit">
              保存
            </Button>
          </Space>
        </div>
      </Form>
    </Modal>
  );
};

export default DataSetFieldMappingModal;
