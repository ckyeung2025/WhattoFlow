import React from 'react';
import { Modal, Card, Button, Tag, Space } from 'antd';

// 模板選擇 Modal
const TemplateModal = ({ 
  visible, 
  onCancel, 
  templates, 
  onSelectTemplate, 
  t 
}) => {
  return (
    <Modal
      title={t('workflowDesigner.selectWhatsAppTemplate')}
      open={visible}
      onCancel={onCancel}
      footer={null}
      width={800}
    >
      <div style={{ maxHeight: '400px', overflow: 'auto' }}>
        {templates.map(template => (
          <Card
            key={template.id}
            size="small"
            style={{ marginBottom: 8, cursor: 'pointer' }}
            onClick={() => onSelectTemplate(template)}
            hoverable
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h4 style={{ margin: 0 }}>{template.name}</h4>
                <p style={{ margin: '4px 0', color: '#666' }}>{template.description}</p>
                <Space>
                  <Tag color="blue">{template.category}</Tag>
                  <Tag color="green">{template.templateType}</Tag>
                  <Tag color="orange">{template.language}</Tag>
                </Space>
              </div>
              <Button type="primary" size="small">{t('workflowList.select')}</Button>
            </div>
          </Card>
        ))}
        {templates.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
            {t('workflowDesigner.noTemplatesAvailable')}
          </div>
        )}
      </div>
    </Modal>
  );
};

export default TemplateModal;
