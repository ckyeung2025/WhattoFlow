import React, { useState } from 'react';
import { Modal, Card, Button, Tag, Space, Tabs, Badge } from 'antd';

// 模板選擇 Modal
const TemplateModal = ({ 
  visible, 
  onCancel, 
  templates,
  metaTemplates,
  onSelectTemplate, 
  t 
}) => {
  console.log('🚀 TemplateModal 渲染:', { visible, templatesCount: templates?.length, metaTemplatesCount: metaTemplates?.length });
  const [activeTab, setActiveTab] = useState('meta');

  // 渲染模板列表
  const renderTemplateList = (templateList, isMetaTemplate = false) => (
    <div style={{ maxHeight: '400px', overflow: 'auto' }}>
      {templateList.map(template => (
        <Card
          key={template.id}
          size="small"
          style={{ marginBottom: 8, cursor: 'pointer' }}
          onClick={() => {
            console.log('🎯 模板選擇:', { template: template.name, isMetaTemplate, templateId: template.id });
            onSelectTemplate(template, isMetaTemplate);
          }}
          hoverable
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h4 style={{ margin: 0 }}>{template.name}</h4>
                {isMetaTemplate && template.status && (
                  <Badge 
                    status={template.status === 'APPROVED' ? 'success' : 
                            template.status === 'PENDING' ? 'processing' : 
                            template.status === 'REJECTED' ? 'error' : 'default'} 
                    text={
                      template.status === 'APPROVED' ? t('workflowDesigner.metaTemplate.approved') :
                      template.status === 'PENDING' ? t('workflowDesigner.metaTemplate.pending') :
                      template.status === 'REJECTED' ? t('workflowDesigner.metaTemplate.rejected') :
                      template.status
                    }
                  />
                )}
              </div>
              <p style={{ margin: '4px 0', color: '#666' }}>{template.description}</p>
              <Space>
                {template.category && <Tag color="blue">{template.category}</Tag>}
                {!isMetaTemplate && template.templateType && <Tag color="green">{template.templateType}</Tag>}
                {template.language && <Tag color="orange">{template.language}</Tag>}
              </Space>
            </div>
            <Button type="primary" size="small">{t('workflowList.select')}</Button>
          </div>
        </Card>
      ))}
      {templateList.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          {t('workflowDesigner.noTemplatesAvailable')}
        </div>
      )}
    </div>
  );

  const items = [
    {
      key: 'meta',
      label: (
        <span>
          {t('workflowDesigner.metaTemplate.title')}
          {metaTemplates.length > 0 && (
            <Badge 
              count={metaTemplates.length} 
              style={{ marginLeft: 8, backgroundColor: '#1890ff' }} 
            />
          )}
        </span>
      ),
      children: renderTemplateList(metaTemplates, true)
    },
    {
      key: 'internal',
      label: (
        <span>
          {t('workflowDesigner.internalTemplate')}
          {templates.length > 0 && (
            <Badge 
              count={templates.length} 
              style={{ marginLeft: 8, backgroundColor: '#52c41a' }} 
            />
          )}
        </span>
      ),
      children: renderTemplateList(templates, false)
    }
  ];

  return (
    <Modal
      title={t('workflowDesigner.selectWhatsAppTemplate')}
      open={visible}
      onCancel={onCancel}
      footer={null}
      width={800}
      zIndex={1100}
      destroyOnHidden
    >
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={items}
      />
    </Modal>
  );
};

export default React.memo(TemplateModal);
