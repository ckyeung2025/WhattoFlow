import React, { useState, useEffect } from 'react';
import { Modal, Tabs, Input, Button, Space, Tag } from 'antd';
import { MessageOutlined, FileTextOutlined, FormOutlined } from '@ant-design/icons';
import TemplateVariableConfig from '../components/TemplateVariableConfig';

const { TextArea } = Input;

/**
 * Retry Message 設置模態框
 * 用於配置 Wait for Reply 節點的提醒訊息
 */
const RetryMessageModal = ({ 
  visible, 
  onCancel, 
  onSave,
  initialConfig,
  onOpenTemplateModal,
  processVariables = [], // 新增：流程變量列表
  t 
}) => {
  console.log('🚀 RetryMessageModal 渲染:', { visible, initialConfig });
  const [activeTab, setActiveTab] = useState('direct');
  const [directMessage, setDirectMessage] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateVariables, setTemplateVariables] = useState([]); // 新增：模板變量配置

  // 當 modal 打開時，載入初始配置
  useEffect(() => {
    if (visible && initialConfig) {
      if (initialConfig.useTemplate) {
        setActiveTab('template');
        setSelectedTemplate({
          id: initialConfig.templateId,
          name: initialConfig.templateName,
          isMetaTemplate: initialConfig.isMetaTemplate || false,
          language: initialConfig.templateLanguage || null  // 載入模板語言
        });
        setTemplateVariables(initialConfig.templateVariables || []);
      } else {
        setActiveTab('direct');
        setDirectMessage(initialConfig.message || '');
      }
    } else if (visible && !initialConfig) {
      // 重置為默認值
      setActiveTab('direct');
      setDirectMessage('');
      setSelectedTemplate(null);
      setTemplateVariables([]);
    }
  }, [visible, initialConfig]);

  const handleSave = () => {
    let config = {};
    
    if (activeTab === 'direct') {
      config = {
        useTemplate: false,
        message: directMessage
      };
    } else {
      config = {
        useTemplate: true,
        templateId: selectedTemplate?.id || '',
        templateName: selectedTemplate?.name || '',
        isMetaTemplate: selectedTemplate?.isMetaTemplate || false,
        templateLanguage: selectedTemplate?.language || null,  // 添加模板語言代碼
        templateVariables: templateVariables
      };
      console.log('🎯 RetryMessageModal 保存配置:', config);
    }
    
    onSave(config);
  };

  const handleTemplateSelect = (template, isMetaTemplate) => {
    console.log('🎯 RetryMessageModal 模板選擇:', { template: template.name, isMetaTemplate, templateId: template.id, language: template.language });
    setSelectedTemplate({
      id: template.id,
      name: template.name,
      isMetaTemplate,
      language: template.language  // 保存模板語言
    });
  };

  const tabItems = [
    {
      key: 'direct',
      label: (
        <span>
          <MessageOutlined /> {t('workflowDesigner.timeValidator.directMessage')}
        </span>
      ),
      children: (
        <div style={{ padding: '16px 0' }}>
          <div style={{ marginBottom: 8, fontSize: 14, color: '#666' }}>
            {t('workflowDesigner.timeValidator.retryMessageDescription')}
          </div>
          <TextArea
            value={directMessage}
            onChange={(e) => setDirectMessage(e.target.value)}
            placeholder={t('workflowDesigner.timeValidator.retryMessagePlaceholder')}
            rows={6}
            maxLength={1000}
            showCount
          />
          <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
            💡 {t('workflowDesigner.timeValidator.retryMessageTip')}
          </div>
        </div>
      )
    },
    {
      key: 'template',
      label: (
        <span>
          <FileTextOutlined /> {t('workflowDesigner.timeValidator.useTemplate')}
        </span>
      ),
      children: (
        <div style={{ padding: '16px 0' }}>
          <div style={{ marginBottom: 12, fontSize: 14, color: '#666' }}>
            {t('workflowDesigner.timeValidator.templateDescription')}
          </div>
          
          <Button 
            type="dashed" 
            icon={<FormOutlined />}
            onClick={onOpenTemplateModal}
            style={{ width: '100%', marginBottom: 12 }}
          >
            {t('workflowDesigner.selectTemplate')}
          </Button>
          
          {selectedTemplate && (
            <div style={{ 
              padding: 12, 
              backgroundColor: '#f5f5f5', 
              borderRadius: 6,
              border: '1px solid #d9d9d9'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
                    {selectedTemplate.name}
                  </div>
                  {selectedTemplate.isMetaTemplate && (
                    <Tag color="blue">{t('workflowDesigner.metaTemplate.title')}</Tag>
                  )}
                </div>
                <Button 
                  type="text" 
                  size="small"
                  onClick={() => setSelectedTemplate(null)}
                >
                  {t('common.clear')}
                </Button>
              </div>
            </div>
          )}
          
          {/* 模板變量配置 */}
          {selectedTemplate && (
            <div style={{ marginTop: 16 }}>
              <TemplateVariableConfig
                templateId={selectedTemplate.id}
                isMetaTemplate={selectedTemplate.isMetaTemplate}
                processVariables={processVariables}
                value={templateVariables}
                onChange={setTemplateVariables}
                t={t}
              />
            </div>
          )}
          
          {!selectedTemplate && (
            <div style={{ 
              textAlign: 'center', 
              padding: 20, 
              color: '#999',
              border: '1px dashed #d9d9d9',
              borderRadius: 6
            }}>
              {t('workflowDesigner.timeValidator.noTemplateSelected')}
            </div>
          )}
        </div>
      )
    }
  ];

  return (
    <Modal
      title={
        <span>
          <MessageOutlined style={{ marginRight: 8 }} />
          {t('workflowDesigner.timeValidator.configureRetryMessage')}
        </span>
      }
      open={visible}
      onCancel={onCancel}
      width={600}
      zIndex={1050}
      destroyOnHidden
      footer={[
        <Button key="cancel" onClick={onCancel}>
          {t('common.cancel')}
        </Button>,
        <Button 
          key="save" 
          type="primary" 
          onClick={handleSave}
          disabled={activeTab === 'direct' ? !directMessage.trim() : !selectedTemplate}
        >
          {t('common.save')}
        </Button>
      ]}
    >
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
      />
    </Modal>
  );
};

export default React.memo(RetryMessageModal);

