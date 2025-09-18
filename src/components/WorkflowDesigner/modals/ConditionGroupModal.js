import React from 'react';
import { Modal, Form, Input, Select, Button, Space, Card } from 'antd';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';

// 條件群組編輯 Modal
const ConditionGroupModal = ({
  visible,
  onCancel,
  editingConditionGroup,
  conditionGroupForm,
  selectedNode,
  getAvailableOutputPaths,
  onSave,
  onEditCondition,
  onAddCondition,
  onDeleteCondition,
  t
}) => {
  // 從節點數據中獲取當前條件群組的條件列表
  const getCurrentConditions = () => {
    console.log('=== 條件群組模態框獲取條件列表 ===');
    console.log('selectedNode:', selectedNode);
    console.log('editingConditionGroup:', editingConditionGroup);
    
    // 如果是新增條件群組（groupIndex === -1），直接使用 editingConditionGroup.conditions
    if (!editingConditionGroup || editingConditionGroup.groupIndex === -1) {
      console.log('新增條件群組，使用 editingConditionGroup.conditions');
      console.log('editingConditionGroup.conditions:', editingConditionGroup?.conditions);
      return editingConditionGroup?.conditions || [];
    }
    
    // 如果是編輯現有條件群組，從節點數據中獲取
    if (!selectedNode) {
      console.log('沒有選中的節點，使用 editingConditionGroup.conditions');
      return editingConditionGroup?.conditions || [];
    }
    
    const currentNode = selectedNode;
    const currentGroups = currentNode.data?.conditionGroups || [];
    console.log('節點中的條件群組:', currentGroups);
    console.log('目標群組索引:', editingConditionGroup.groupIndex);
    
    const currentGroup = currentGroups[editingConditionGroup.groupIndex];
    console.log('目標群組:', currentGroup);
    const conditions = currentGroup?.conditions || [];
    console.log('條件列表:', conditions);
    return conditions;
  };
  
  const currentConditions = getCurrentConditions();
  return (
    <Modal
      title={editingConditionGroup && editingConditionGroup.groupIndex === -1 ? 
        t('workflowDesigner.addConditionGroup') : 
        t('workflowDesigner.editConditionGroup')
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
          label={t('workflowDesigner.groupRelation')}
          name="relation"
          rules={[{ required: true, message: t('workflowDesigner.groupRelationRequired') }]}
        >
          <Select>
            <Select.Option value="and">AND - 所有條件都必須滿足</Select.Option>
            <Select.Option value="or">OR - 任一條件滿足即可</Select.Option>
          </Select>
        </Form.Item>
        
        <Form.Item
          label={t('workflowDesigner.outputPath')}
          name="outputPath"
          rules={[{ required: true, message: t('workflowDesigner.outputPathRequired') }]}
        >
          <Select placeholder={t('workflowDesigner.selectOutputPath')}>
            {selectedNode && getAvailableOutputPaths(selectedNode.id, [], [], t).map(path => (
              <Select.Option key={path.id} value={path.id}>
                {path.label}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>
        
        <Form.Item label={t('workflowDesigner.conditions')}>
          <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #d9d9d9', borderRadius: '6px', padding: '8px' }}>
            {console.log('=== 條件群組模態框渲染條件列表 ===')}
            {console.log('currentConditions:', currentConditions)}
            {console.log('currentConditions.length:', currentConditions.length)}
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
                  <strong>{condition.variableName}</strong> {condition.operator} <strong>{condition.value}</strong>
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
                {t('workflowDesigner.noConditions')}
              </div>
            )}
            
            <Button 
              type="dashed" 
              onClick={onAddCondition}
              style={{ width: '100%' }}
            >
              {t('workflowDesigner.addCondition')}
            </Button>
          </div>
        </Form.Item>
        
        <div style={{ textAlign: 'right' }}>
          <Space>
            <Button onClick={onCancel}>
              {t('workflowDesigner.cancel')}
            </Button>
            <Button type="primary" htmlType="submit">
              {editingConditionGroup && editingConditionGroup.groupIndex === -1 ? t('workflowDesigner.add') : t('workflowDesigner.update')}
            </Button>
          </Space>
        </div>
      </Form>
    </Modal>
  );
};

export default ConditionGroupModal;
