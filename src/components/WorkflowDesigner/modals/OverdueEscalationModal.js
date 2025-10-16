import React, { useState, useEffect } from 'react';
import { Modal, Tabs, Input, Button, Space, Tag, Divider } from 'antd';
import { ClockCircleOutlined, MessageOutlined, FileTextOutlined, FormOutlined, UserAddOutlined } from '@ant-design/icons';
import RecipientSelector from '../components/RecipientSelector';
import TemplateVariableConfig from '../components/TemplateVariableConfig';

const { TextArea } = Input;

/**
 * Overdue Escalation 設置模態框
 * 用於配置 Start 節點的流程逾期通知
 */
const OverdueEscalationModal = ({ 
  visible, 
  onCancel, 
  onSave,
  initialConfig,
  onOpenTemplateModal,
  onOpenRecipientModal,
  workflowDefinitionId,
  processVariables = [], // 新增：流程變量列表
  t 
}) => {
  const [activeTab, setActiveTab] = useState('direct');
  const [recipients, setRecipients] = useState('');
  const [recipientDetails, setRecipientDetails] = useState(null);
  const [directMessage, setDirectMessage] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateVariables, setTemplateVariables] = useState([]); // 新增：模板變量配置

  // 當 modal 打開時，載入初始配置
  useEffect(() => {
    if (visible && initialConfig) {
      setRecipients(initialConfig.recipients || '');
      setRecipientDetails(initialConfig.recipientDetails || null);
      
      if (initialConfig.useTemplate) {
        setActiveTab('template');
        setSelectedTemplate({
          id: initialConfig.templateId,
          name: initialConfig.templateName,
          isMetaTemplate: initialConfig.isMetaTemplate || false
        });
        setTemplateVariables(initialConfig.templateVariables || []);
      } else {
        setActiveTab('direct');
        setDirectMessage(initialConfig.message || '');
      }
    } else if (visible && !initialConfig) {
      // 重置為默認值
      setActiveTab('direct');
      setRecipients('');
      setRecipientDetails(null);
      setDirectMessage('');
      setSelectedTemplate(null);
      setTemplateVariables([]);
    }
  }, [visible, initialConfig]);

  const handleSave = () => {
    let config = {
      recipients,
      recipientDetails
    };
    
    if (activeTab === 'direct') {
      config = {
        ...config,
        useTemplate: false,
        message: directMessage
      };
    } else {
      config = {
        ...config,
        useTemplate: true,
        templateId: selectedTemplate?.id || '',
        templateName: selectedTemplate?.name || '',
        isMetaTemplate: selectedTemplate?.isMetaTemplate || false,
        templateVariables: templateVariables
      };
      console.log('🎯 OverdueEscalationModal 保存配置:', config);
    }
    
    onSave(config);
  };

  const handleTemplateSelect = (template, isMetaTemplate) => {
    console.log('🎯 OverdueEscalationModal 模板選擇:', { template: template.name, isMetaTemplate, templateId: template.id });
    setSelectedTemplate({
      id: template.id,
      name: template.name,
      isMetaTemplate
    });
  };

  const handleRecipientChange = (value, detailedValue) => {
    if (value === '' && detailedValue === null) {
      // 點擊了 "Select Recipients" 按鈕
      onOpenRecipientModal();
    } else {
      // 正常選擇或清除
      setRecipients(value);
      setRecipientDetails(detailedValue);
    }
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
            {t('workflowDesigner.overdue.escalationMessageDescription')}
          </div>
          <TextArea
            value={directMessage}
            onChange={(e) => setDirectMessage(e.target.value)}
            placeholder={t('workflowDesigner.overdue.escalationMessagePlaceholder')}
            rows={6}
            maxLength={1000}
            showCount
          />
          <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
            💡 {t('workflowDesigner.overdue.escalationMessageTip')}
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
          <ClockCircleOutlined style={{ marginRight: 8 }} />
          {t('workflowDesigner.overdue.configureEscalation')}
        </span>
      }
      open={visible}
      onCancel={onCancel}
      width={700}
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
          disabled={
            !recipients.trim() || 
            (activeTab === 'direct' ? !directMessage.trim() : !selectedTemplate)
          }
        >
          {t('common.save')}
        </Button>
      ]}
    >
      {/* Recipients 選擇區域 */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ 
          marginBottom: 8, 
          fontSize: 14, 
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center'
        }}>
          <UserAddOutlined style={{ marginRight: 6 }} />
          {t('workflowDesigner.overdue.escalationRecipients')}
        </div>
        <div style={{ marginBottom: 8, fontSize: 13, color: '#666' }}>
          {t('workflowDesigner.overdue.escalationRecipientsDescription')}
        </div>
        <div style={{ position: 'relative' }}>
          <RecipientSelector
            value={recipients}
            recipientDetails={recipientDetails}
            placeholder={t('workflowDesigner.selectRecipients')}
            compact={false}
            workflowDefinitionId={workflowDefinitionId}
            t={t}
            onChange={handleRecipientChange}
          />
          <div style={{ 
            position: 'absolute', 
            right: '8px', 
            top: '50%', 
            transform: 'translateY(-50%)',
            display: 'flex',
            gap: '4px',
            zIndex: 10
          }}>
            {recipients && (
              <Button 
                type="text" 
                size="small" 
                onClick={(e) => {
                  e.stopPropagation();
                  setRecipients('');
                  setRecipientDetails(null);
                }}
                style={{ padding: '0 4px', fontSize: '12px' }}
              >
                {t('workflowDesigner.clear')}
              </Button>
            )}
          </div>
        </div>
      </div>

      <Divider />

      {/* Message 配置區域 */}
      <div>
        <div style={{ 
          marginBottom: 12, 
          fontSize: 14, 
          fontWeight: 'bold',
          display: 'flex',
          alignItems: 'center'
        }}>
          <MessageOutlined style={{ marginRight: 6 }} />
          {t('workflowDesigner.overdue.escalationMessage')}
        </div>
        
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
        />
      </div>
    </Modal>
  );
};

export default React.memo(OverdueEscalationModal);

