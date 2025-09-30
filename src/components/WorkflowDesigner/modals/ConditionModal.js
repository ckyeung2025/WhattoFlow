import React, { useEffect } from 'react';
import { Modal, Form, Input, Select, Button, Space } from 'antd';

// 條件編輯 Modal
const ConditionModal = ({
  visible,
  onCancel,
  editingCondition,
  conditionForm,
  processVariables,
  onSave,
  t
}) => {
  // 監聽運算符變化，自動清除條件值（當選擇為空/不為空時）
  const selectedOperator = Form.useWatch('operator', conditionForm);
  
  useEffect(() => {
    if (selectedOperator === 'isEmpty' || selectedOperator === 'isNotEmpty') {
      conditionForm.setFieldsValue({ value: '' });
    }
  }, [selectedOperator, conditionForm]);

  return (
    <Modal
      title={t('workflowDesigner.editCondition')}
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
          label={t('workflowDesigner.selectProcessVariable')}
          name="variableName"
          rules={[{ required: true, message: t('workflowDesigner.selectProcessVariableRequired') }]}
        >
          <Select placeholder={t('workflowDesigner.selectProcessVariable')}>
            {processVariables.length > 0 ? (
              processVariables.map(pv => (
                <Select.Option key={pv.id} value={pv.variableName}>
                  {pv.variableName} ({pv.dataType})
                </Select.Option>
              ))
            ) : (
              <Select.Option value="" disabled>
                {t('workflowDesigner.noProcessVariables')}
              </Select.Option>
            )}
          </Select>
          {processVariables.length === 0 && (
            <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
              {t('workflowDesigner.noProcessVariablesHint')}
            </div>
          )}
        </Form.Item>
        
        <Form.Item
          label={t('workflowDesigner.operator')}
          name="operator"
          rules={[{ required: true, message: t('workflowDesigner.operatorRequired') }]}
        >
          <Select>
            <Select.Option value="equals">{t('workflowDesigner.equals')}</Select.Option>
            <Select.Option value="notEquals">{t('workflowDesigner.notEquals')}</Select.Option>
            <Select.Option value="greaterThan">{t('workflowDesigner.greaterThan')}</Select.Option>
            <Select.Option value="lessThan">{t('workflowDesigner.lessThan')}</Select.Option>
            <Select.Option value="contains">{t('workflowDesigner.contains')}</Select.Option>
            <Select.Option value="isEmpty">{t('workflowDesigner.isEmpty')}</Select.Option>
            <Select.Option value="isNotEmpty">{t('workflowDesigner.isNotEmpty')}</Select.Option>
          </Select>
        </Form.Item>
        
        <Form.Item
          label={t('workflowDesigner.conditionValue')}
          name="value"
          rules={[
            ({ getFieldValue }) => ({
              validator(_, value) {
                const operator = getFieldValue('operator');
                // 如果是「為空」或「不為空」運算符，不需要條件值
                if (operator === 'isEmpty' || operator === 'isNotEmpty') {
                  return Promise.resolve();
                }
                // 其他運算符需要條件值
                if (!value) {
                  return Promise.reject(new Error(t('workflowDesigner.conditionValueRequired')));
                }
                return Promise.resolve();
              }
            })
          ]}
        >
          <Input 
            placeholder={t('workflowDesigner.conditionValuePlaceholder')} 
            disabled={selectedOperator === 'isEmpty' || selectedOperator === 'isNotEmpty'}
          />
        </Form.Item>
        
        <Form.Item
          label={t('workflowDesigner.conditionLabel')}
          name="label"
        >
          <Input placeholder={t('workflowDesigner.conditionLabelPlaceholder')} />
        </Form.Item>
        
        <div style={{ textAlign: 'right' }}>
          <Space>
            <Button onClick={onCancel}>
              {t('workflowDesigner.cancel')}
            </Button>
            <Button type="primary" htmlType="submit">
              {editingCondition && editingCondition.condIndex !== -1 ? t('workflowDesigner.update') : t('workflowDesigner.add')}
            </Button>
          </Space>
        </div>
      </Form>
    </Modal>
  );
};

export default ConditionModal;
