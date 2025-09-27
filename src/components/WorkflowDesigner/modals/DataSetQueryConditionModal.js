import React, { useEffect } from 'react';
import { Modal, Form, Input, Select, Button, Space, Card } from 'antd';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';

// DataSet 查詢條件編輯 Modal
const DataSetQueryConditionModal = ({
  visible,
  onCancel,
  editingConditionGroup,
  conditionGroupForm,
  dataSetColumns,
  processVariables,
  onSave,
  onEditCondition,
  onAddCondition,
  onDeleteCondition,
  t
}) => {
  // 當模態框打開時，設置表單的初始值
  useEffect(() => {
    if (visible && editingConditionGroup && conditionGroupForm) {
      console.log('=== 設置 DataSet 查詢條件組表單初始值 ===');
      console.log('editingConditionGroup:', editingConditionGroup);
      
      conditionGroupForm.setFieldsValue({
        relation: editingConditionGroup.relation || 'and'
      });
    }
  }, [visible, editingConditionGroup, conditionGroupForm]);

  // 從節點數據中獲取當前條件群組的條件列表
  const getCurrentConditions = () => {
    console.log('=== DataSet 查詢條件模態框獲取條件列表 ===');
    console.log('editingConditionGroup:', editingConditionGroup);
    
    // 如果是新增條件群組（groupIndex === -1），直接使用 editingConditionGroup.conditions
    if (!editingConditionGroup || editingConditionGroup.groupIndex === -1) {
      console.log('新增條件群組，使用 editingConditionGroup.conditions');
      return editingConditionGroup?.conditions || [];
    }
    
    // 如果是編輯現有條件群組，從節點數據中獲取
    const conditions = editingConditionGroup?.conditions || [];
    console.log('條件列表:', conditions);
    return conditions;
  };
  
  const currentConditions = getCurrentConditions();
  
  return (
    <Modal
      title={editingConditionGroup && editingConditionGroup.groupIndex === -1 ? 
        '添加查詢條件組' : 
        '編輯查詢條件組'
      }
      open={visible}
      onCancel={onCancel}
      width={800}
      footer={null}
      destroyOnClose
    >
      <Form
        form={conditionGroupForm}
        layout="vertical"
        onFinish={onSave}
      >
        <Form.Item
          label="條件關係"
          name="relation"
          rules={[{ required: true, message: '請選擇條件關係' }]}
        >
          <Select>
            <Select.Option value="and">AND - 所有條件都必須滿足</Select.Option>
            <Select.Option value="or">OR - 任一條件滿足即可</Select.Option>
          </Select>
        </Form.Item>
        
        <Form.Item label="查詢條件">
          <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #d9d9d9', borderRadius: '6px', padding: '8px' }}>
            {console.log('=== DataSet 查詢條件模態框渲染條件列表 ===')}
            {console.log('currentConditions:', currentConditions)}
            {currentConditions.map((condition, condIndex) => (
              <div key={condition.id} style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                marginBottom: '8px',
                padding: '8px',
                backgroundColor: '#f5f5f5',
                borderRadius: '4px'
              }}>
                <div style={{ flex: 1, fontSize: '14px' }}>
                  <strong>{condition.fieldName}</strong> {condition.operator} <strong>{condition.value}</strong>
                  {condition.label && <div style={{ fontSize: '12px', color: '#666' }}>{condition.label}</div>}
                </div>
                <Button 
                  type="text" 
                  size="small"
                  icon={<EditOutlined />}
                  onClick={() => onEditCondition(condition, condIndex)}
                />
                <Button 
                  type="text" 
                  danger 
                  size="small"
                  icon={<DeleteOutlined />}
                  onClick={() => onDeleteCondition(condIndex)}
                />
              </div>
            ))}
            
            {(!currentConditions || currentConditions.length === 0) && (
              <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                暫無查詢條件
              </div>
            )}
            
            <Button 
              type="dashed" 
              onClick={onAddCondition}
              style={{ width: '100%' }}
            >
              添加查詢條件
            </Button>
          </div>
        </Form.Item>
        
        <div style={{ textAlign: 'right' }}>
          <Space>
            <Button onClick={onCancel}>
              取消
            </Button>
            <Button type="primary" htmlType="submit">
              {editingConditionGroup && editingConditionGroup.groupIndex === -1 ? '添加' : '更新'}
            </Button>
          </Space>
        </div>
      </Form>
    </Modal>
  );
};

export default DataSetQueryConditionModal;
