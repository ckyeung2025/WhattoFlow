import React from 'react';
import { Modal, Form, Input, Select, Button, Space } from 'antd';

// DataSet 查詢條件編輯 Modal
const DataSetQueryConditionEditModal = ({
  visible,
  onCancel,
  editingCondition,
  conditionForm,
  dataSetColumns,
  processVariables,
  onSave,
  t
}) => {
  return (
    <Modal
      title={t('workflowDesigner.dataSet.editQueryCondition')}
      open={visible}
      onCancel={onCancel}
      width={600}
      footer={null}
      destroyOnClose
    >
      <Form
        form={conditionForm}
        layout="vertical"
        onFinish={onSave}
      >
        <Form.Item
          label={t('workflowDesigner.dataSet.selectDataSetField')}
          name="fieldName"
          rules={[{ required: true, message: t('workflowDesigner.dataSet.selectDataSetFieldPlaceholder') }]}
        >
          <Select placeholder={t('workflowDesigner.dataSet.selectDataSetField')}>
            {dataSetColumns.length > 0 ? (
              dataSetColumns.map(col => (
                <Select.Option key={col.columnName} value={col.columnName}>
                  {col.displayName || col.columnName} ({col.dataType})
                </Select.Option>
              ))
            ) : (
              <Select.Option value="" disabled>
                {t('workflowDesigner.dataSet.noDataSetFields')}
              </Select.Option>
            )}
          </Select>
          {dataSetColumns.length === 0 && (
            <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
              {t('workflowDesigner.dataSet.pleaseSelectDataSet')}
            </div>
          )}
        </Form.Item>
        
        <Form.Item
          label={t('workflowDesigner.dataSet.operator')}
          name="operator"
          rules={[{ required: true, message: t('workflowDesigner.dataSet.operatorPlaceholder') }]}
        >
          <Select>
            <Select.Option value="equals">等於 (=)</Select.Option>
            <Select.Option value="notEquals">不等於 (!=)</Select.Option>
            <Select.Option value="greaterThan">大於 (>)</Select.Option>
            <Select.Option value="lessThan">小於 (&lt;)</Select.Option>
            <Select.Option value="greaterThanOrEqual">大於等於 (&gt;=)</Select.Option>
            <Select.Option value="lessThanOrEqual">小於等於 (&lt;=)</Select.Option>
            <Select.Option value="contains">包含 (LIKE %value%)</Select.Option>
            <Select.Option value="startsWith">開始於 (LIKE value%)</Select.Option>
            <Select.Option value="endsWith">結束於 (LIKE %value)</Select.Option>
            <Select.Option value="isEmpty">為空 (IS NULL OR = '')</Select.Option>
            <Select.Option value="isNotEmpty">不為空 (IS NOT NULL AND != '')</Select.Option>
            <Select.Option value="in">在列表中 (IN)</Select.Option>
            <Select.Option value="notIn">不在列表中 (NOT IN)</Select.Option>
          </Select>
        </Form.Item>
        
        <Form.Item
          label={t('workflowDesigner.dataSet.conditionValue')}
          name="value"
          rules={[{ required: true, message: t('workflowDesigner.dataSet.conditionValuePlaceholder') }]}
        >
          <Input placeholder={t('workflowDesigner.dataSet.conditionValueInputPlaceholder')} />
        </Form.Item>
        
        <Form.Item
          label={t('workflowDesigner.dataSet.conditionLabel')}
          name="label"
        >
          <Input placeholder={t('workflowDesigner.dataSet.conditionLabelPlaceholder')} />
        </Form.Item>
        
        {/* 顯示可用的流程變量 */}
        {processVariables && processVariables.length > 0 && (
          <Form.Item label={t('workflowDesigner.dataSet.availableProcessVariables')}>
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
              {t('workflowDesigner.dataSet.clickVariableToInsert')}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {processVariables.map(pv => (
                <span 
                  key={pv.id} 
                  style={{ 
                    cursor: 'pointer',
                    padding: '2px 6px',
                    backgroundColor: '#f0f0f0',
                    borderRadius: '3px',
                    fontSize: '12px',
                    border: '1px solid #d9d9d9'
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const currentValue = conditionForm.getFieldValue('value') || '';
                    const newValue = currentValue + `\${${pv.variableName}}`;
                    conditionForm.setFieldValue('value', newValue);
                  }}
                >
                  {pv.variableName} ({pv.dataType})
                </span>
              ))}
            </div>
          </Form.Item>
        )}
        
        <div style={{ textAlign: 'right' }}>
          <Space>
            <Button onClick={onCancel}>
              {t('workflowDesigner.dataSet.cancel')}
            </Button>
            <Button type="primary" htmlType="submit">
              {editingCondition && editingCondition.condIndex !== -1 ? t('workflowDesigner.dataSet.update') : t('workflowDesigner.dataSet.add')}
            </Button>
          </Space>
        </div>
      </Form>
    </Modal>
  );
};

export default DataSetQueryConditionEditModal;
