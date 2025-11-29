import React, { useState, useEffect } from 'react';
import { Modal, Tabs, Divider, Button, Form } from 'antd';
import { MessageOutlined, FileTextOutlined, UserAddOutlined, MailOutlined } from '@ant-design/icons';
import RecipientSelector from '../components/RecipientSelector';
import DirectMessageTab from '../components/DirectMessageTab';
import TemplateTab from '../components/TemplateTab';
import EmailTab from '../components/EmailTab';
import { useEmailProviders } from '../hooks/useEmailProviders';

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
  onOpenRecipientModal,
  workflowDefinitionId,
  processVariables = [], // 新增：流程變量列表
  t 
}) => {
  console.log('🚀 RetryMessageModal 渲染:', { visible, initialConfig });
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState('direct');
  const [recipients, setRecipients] = useState('');
  const [recipientDetails, setRecipientDetails] = useState(null);
  const [directMessage, setDirectMessage] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateVariables, setTemplateVariables] = useState([]); // 新增：模板變量配置
  // 移除 emailConfig state，直接使用 initialConfig.emailConfig（與節點屬性頁的做法一致）
  // 用戶的修改會通過 onEmailConfigChange 回調保存到臨時對象，在保存時使用
  const [tempEmailConfig, setTempEmailConfig] = useState(null); // 臨時存儲用戶的修改

  // 使用 Email Providers Hook
  const { emailProviders, loadingEmailProviders } = useEmailProviders(true);

  // 處理模板選擇事件
  useEffect(() => {
    const handleTemplateSelected = (event) => {
      const { template, isMetaTemplate } = event.detail;
      console.log('🎯 RetryMessageModal 收到模板選擇事件:', { template: template.name, isMetaTemplate });
      setSelectedTemplate({
        id: template.id,
        name: template.name,
        isMetaTemplate,
        language: template.language || null
      });
    };

    window.addEventListener('timeValidatorTemplateSelected', handleTemplateSelected);
    
    return () => {
      window.removeEventListener('timeValidatorTemplateSelected', handleTemplateSelected);
    };
  }, []);

  // 當 modal 打開時，載入初始配置
  // 使用 setTimeout 確保 form 已經初始化（因為 Modal 有 destroyOnHidden）
  useEffect(() => {
    if (visible) {
      console.log('🟡 RetryMessageModal useEffect - visible:', visible, 'initialConfig:', initialConfig);
      // 重置臨時 emailConfig
      setTempEmailConfig(null);
      
      // 使用 setTimeout 確保 form 已經初始化
      const timer = setTimeout(() => {
        if (initialConfig) {
          setRecipients(initialConfig.recipients || '');
          setRecipientDetails(initialConfig.recipientDetails || null);
          
          // 檢查是否有 emailConfig（優先檢查 messageMode，如果沒有則檢查 emailConfig 是否存在）
          if ((initialConfig.messageMode === 'email' || initialConfig.emailConfig) && initialConfig.emailConfig) {
            console.log('🟡 RetryMessageModal 載入 email 配置:', initialConfig.emailConfig);
            setActiveTab('email');
            // 同步到 form（與節點屬性頁的做法一致）
            const config = initialConfig.emailConfig;
            // 使用明確的檢查，確保即使值為空字符串也能正確處理
            const providerKeyValue = config.providerKey !== undefined && config.providerKey !== null ? config.providerKey : '';
            const subjectValue = config.subject !== undefined && config.subject !== null ? config.subject : '';
            const bodyValue = config.body !== undefined && config.body !== null ? config.body : '';
            
            form.setFieldsValue({
              'emailConfig.providerKey': providerKeyValue,
              'emailConfig.subject': subjectValue,
              'emailConfig.body': bodyValue,
            });
            
            console.log('🟡 RetryMessageModal 設置 form 值:', {
              'emailConfig.providerKey': providerKeyValue,
              'emailConfig.subject': subjectValue?.substring(0, 30),
              'emailConfig.body': bodyValue?.substring(0, 30)
            });
          } else if (initialConfig.useTemplate) {
            setActiveTab('template');
            setSelectedTemplate({
              id: initialConfig.templateId,
              name: initialConfig.templateName,
              isMetaTemplate: initialConfig.isMetaTemplate || false,
              language: initialConfig.templateLanguage || null
            });
            setTemplateVariables(initialConfig.templateVariables || []);
          } else {
            setActiveTab('direct');
            setDirectMessage(initialConfig.message || '');
          }
        } else {
          // 重置為默認值
          setActiveTab('direct');
          setRecipients('');
          setRecipientDetails(null);
          setDirectMessage('');
          setSelectedTemplate(null);
          setTemplateVariables([]);
          // 重置 form
          form.setFieldsValue({
            'emailConfig.providerKey': '',
            'emailConfig.subject': '',
            'emailConfig.body': '',
          });
        }
      }, 0);
      
      return () => clearTimeout(timer);
    }
  }, [visible, initialConfig, form]);

  const handleSave = () => {
    let config = {
      recipients,
      recipientDetails,
      messageMode: activeTab // 'direct', 'template', 'email'
    };
    
    if (activeTab === 'direct') {
      config = {
        ...config,
        useTemplate: false,
        message: directMessage
      };
    } else if (activeTab === 'template') {
      config = {
        ...config,
        useTemplate: true,
        templateId: selectedTemplate?.id || '',
        templateName: selectedTemplate?.name || '',
        isMetaTemplate: selectedTemplate?.isMetaTemplate || false,
        templateLanguage: selectedTemplate?.language || null,
        templateVariables: templateVariables
      };
      console.log('🎯 RetryMessageModal 保存配置:', config);
    } else if (activeTab === 'email') {
      // 優先使用 tempEmailConfig（用戶的修改），然後是 initialConfig.emailConfig，最後是 form 的值
      // 這與節點屬性頁的做法一致：直接從數據源獲取，而不是依賴內部 state
      const formValues = form.getFieldsValue(['emailConfig.providerKey', 'emailConfig.subject', 'emailConfig.body']);
      const sourceConfig = tempEmailConfig || initialConfig?.emailConfig || {};
      const finalEmailConfig = {
        providerKey: sourceConfig.providerKey !== undefined && sourceConfig.providerKey !== null 
          ? sourceConfig.providerKey 
          : (formValues['emailConfig.providerKey'] || ''),
        subject: sourceConfig.subject !== undefined && sourceConfig.subject !== null 
          ? sourceConfig.subject 
          : (formValues['emailConfig.subject'] || ''),
        body: sourceConfig.body !== undefined && sourceConfig.body !== null 
          ? sourceConfig.body 
          : (formValues['emailConfig.body'] || ''),
        replyTo: sourceConfig.replyTo !== undefined && sourceConfig.replyTo !== null 
          ? sourceConfig.replyTo 
          : '',
      };
      console.log('🟡 RetryMessageModal.handleSave - emailConfig:', finalEmailConfig);
      config = {
        ...config,
        useTemplate: false,
        emailConfig: finalEmailConfig
      };
    }
    
    onSave(config);
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

  // 檢查是否有收件人選擇（包括 groups, hashtags, processVariables, useInitiator）
  const hasRecipients = () => {
    if (recipients && recipients.trim()) {
      return true;
    }
    if (recipientDetails) {
      const hasGroups = recipientDetails.groups && recipientDetails.groups.length > 0;
      const hasHashtags = recipientDetails.hashtags && recipientDetails.hashtags.length > 0;
      const hasProcessVariables = recipientDetails.processVariables && recipientDetails.processVariables.length > 0;
      const hasUseInitiator = recipientDetails.useInitiator === true;
      return hasGroups || hasHashtags || hasProcessVariables || hasUseInitiator;
    }
    return false;
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
        <DirectMessageTab
          form={form}
          t={t}
          processVariables={processVariables}
          fieldName="directMessage"
          mode="modal"
          description={t('workflowDesigner.timeValidator.retryMessageDescription')}
          placeholder={t('workflowDesigner.timeValidator.retryMessagePlaceholder')}
          rows={6}
          tip={t('workflowDesigner.timeValidator.retryMessageTip')}
          value={directMessage}
          onChange={setDirectMessage}
          extraProps={{ maxLength: 1000, showCount: true }}
        />
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
        <TemplateTab
          form={form}
          t={t}
          processVariables={processVariables}
          templateData={{
            templateId: selectedTemplate?.id || null,
            templateName: selectedTemplate?.name || null,
            isMetaTemplate: selectedTemplate?.isMetaTemplate || false,
            templateLanguage: selectedTemplate?.language || null,
            templateVariables: templateVariables || [],
          }}
          onTemplateClear={() => {
            setSelectedTemplate(null);
            setTemplateVariables([]);
          }}
          onTemplateVariablesChange={setTemplateVariables}
          mode="button"
          onOpenTemplateModal={onOpenTemplateModal}
          description={t('workflowDesigner.timeValidator.templateDescription')}
          noTemplateSelectedText={t('workflowDesigner.timeValidator.noTemplateSelected')}
        />
      )
    },
    {
      key: 'email',
      label: (
        <span>
          <MailOutlined /> {t('workflowDesigner.sendEmail')}
        </span>
      ),
      children: (
        <div style={{ padding: '16px 0' }}>
          <div style={{ marginBottom: 8, fontSize: 14, color: '#666' }}>
            {t('workflowDesigner.timeValidator.retryMessageDescription')}
          </div>
          <EmailTab
            form={form}
            t={t}
            processVariables={processVariables}
            emailProviders={emailProviders}
            loadingEmailProviders={loadingEmailProviders}
            // 直接使用 initialConfig.emailConfig（與節點屬性頁的做法一致）
            // 用戶的修改通過 onEmailConfigChange 保存到 tempEmailConfig
            emailConfig={tempEmailConfig || initialConfig?.emailConfig || {}}
            onEmailConfigChange={(newConfig) => {
              console.log('🟡 RetryMessageModal.onEmailConfigChange:', { 
                body: newConfig.body?.substring(0, 50),
                bodyLength: newConfig.body?.length,
                providerKey: newConfig.providerKey,
                subject: newConfig.subject?.substring(0, 30)
              });
              // 保存用戶的修改到臨時對象（與節點屬性頁的 handleNodeDataChange 類似）
              setTempEmailConfig(newConfig);
              // 同步到 form，確保表單狀態正確
              form.setFieldsValue({
                'emailConfig.providerKey': newConfig.providerKey || '',
                'emailConfig.subject': newConfig.subject || '',
              });
            }}
            fieldPrefix="emailConfig"
            showProcessVariables={true}
          />
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
            !hasRecipients() || 
            (activeTab === 'direct' ? !directMessage.trim() : 
             activeTab === 'template' ? !selectedTemplate :
             activeTab === 'email' ? !(tempEmailConfig?.providerKey || initialConfig?.emailConfig?.providerKey) || 
                                     !(tempEmailConfig?.subject || initialConfig?.emailConfig?.subject) || 
                                     !(tempEmailConfig?.body || initialConfig?.emailConfig?.body) : true)
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
          {t('workflowDesigner.timeValidator.retryMessageRecipients')}
        </div>
        <div style={{ marginBottom: 8, fontSize: 13, color: '#666' }}>
          {t('workflowDesigner.timeValidator.retryMessageRecipientsDescription')}
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
          {t('workflowDesigner.timeValidator.retryMessage')}
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

export default React.memo(RetryMessageModal);

