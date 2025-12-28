import React from 'react';
import { Modal, Card, Button, Tag, Space } from 'antd';

// EForm 選擇 Modal
const EFormModal = ({ 
  visible, 
  onCancel, 
  eforms, 
  onSelectEForm, 
  t 
}) => {
  return (
    <Modal
      title={t('workflowDesigner.selectEForm')}
      open={visible}
      onCancel={onCancel}
      footer={null}
      width={600}
    >
      <div style={{ maxHeight: '400px', overflow: 'auto' }}>
        {eforms.map(form => (
          <Card
            key={form.id}
            size="small"
            style={{ marginBottom: 8, cursor: 'pointer' }}
            onClick={() => onSelectEForm(form)}
            hoverable
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: 0 }}>{form.name}</h4>
                {form.description && (
                  <p style={{ margin: '4px 0', color: '#666' }}>{form.description}</p>
                )}
                <Space>
                  <Tag color="blue">e-Form</Tag>
                  {form.formType && (
                    <Tag color={form.formType === 'MetaFlows' ? 'purple' : 'cyan'}>
                      {form.formType === 'MetaFlows' ? 'Meta Flows' : 'HTML'}
                    </Tag>
                  )}
                  <Tag color="green">{t('workflowDesigner.statusEnabled')}</Tag>
                  {form.created_at && (
                    <Tag color="orange">
                      {new Date(form.created_at).toLocaleDateString('zh-TW')}
                    </Tag>
                  )}
                </Space>
              </div>
              <Button 
                type="primary" 
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectEForm(form);
                }}
              >
                {t('workflowList.select')}
              </Button>
            </div>
          </Card>
        ))}
        {eforms.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
            {t('workflowDesigner.noEFormsAvailable')}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default EFormModal;
