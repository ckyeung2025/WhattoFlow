import React, { useState, useEffect } from 'react';
import { Card, Tabs, Divider, Button, Space, Form, message } from 'antd';
import { MessageOutlined, FileTextOutlined, UserAddOutlined, MailOutlined, CloseOutlined } from '@ant-design/icons';
import RecipientSelector from './RecipientSelector';
import DirectMessageTab from './DirectMessageTab';
import TemplateTab from './TemplateTab';
import EmailTab from './EmailTab';
import { useEmailProviders } from '../hooks/useEmailProviders';

/**
 * Time Validator 配置區塊組件
 * 用於在 NodePropertyDrawer 中內聯顯示 Reminder Message、Escalation、Overdue Escalation 配置
 * 替代原來的模態框方式，避免 destroyOnHidden 導致的狀態重置問題
 */
const TimeValidatorConfigSection = ({
  type, // 'retryMessage' | 'escalation' | 'overdueEscalation'
  selectedNode,
  handleNodeDataChange,
  form,
  processVariables,
  workflowDefinitionId,
  onOpenTemplateModal,
  onOpenRecipientModal,
  t,
  // 配置數據來源
  config, // 對應的配置對象（retryMessageConfig, escalationConfig, escalationConfig）
  // UI 配置
  title,
  recipientsLabel,
  recipientsDescription,
  messageLabel,
  messageDescription,
  messagePlaceholder,
  messageTip,
  // 展開狀態
  expanded,
  onToggleExpanded,
}) => {
  const [activeTab, setActiveTab] = useState('direct');
  const [recipients, setRecipients] = useState('');
  const [recipientDetails, setRecipientDetails] = useState(null);
  const [directMessage, setDirectMessage] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateVariables, setTemplateVariables] = useState([]);
  const [emailConfig, setEmailConfig] = useState({}); // Time Validator 專用的 emailConfig

  // 使用 Email Providers Hook
  const { emailProviders, loadingEmailProviders } = useEmailProviders(true);

  // 從 config 加載初始值（當 config 或 expanded 狀態變化時）
  useEffect(() => {
    // 只在展開時同步 config 到 state，避免在收起時重置用戶的輸入
    if (expanded) {
      if (config) {
        setRecipients(config.recipients || '');
        setRecipientDetails(config.recipientDetails || null);
        
        // 根據 messageMode 或 useTemplate 判斷當前 tab
        if (config.messageMode === 'email' || config.emailConfig) {
          setActiveTab('email');
          // 設置 Time Validator 專用的 emailConfig
          setEmailConfig(config.emailConfig || {});
          // 同步到 form
          if (form && config.emailConfig) {
            form.setFieldsValue({
              'emailConfig.providerKey': config.emailConfig.providerKey || '',
              'emailConfig.subject': config.emailConfig.subject || '',
              'emailConfig.body': config.emailConfig.body || '',
            });
          }
        } else if (config.useTemplate) {
          setActiveTab('template');
          setSelectedTemplate({
            id: config.templateId,
            name: config.templateName,
            isMetaTemplate: config.isMetaTemplate || false,
            language: config.templateLanguage || null
          });
          setTemplateVariables(config.templateVariables || []);
        } else {
          setActiveTab('direct');
          setDirectMessage(config.message || '');
        }
      } else {
        // 重置為默認值（只在沒有 config 時）
        setActiveTab('direct');
        setRecipients('');
        setRecipientDetails(null);
        setDirectMessage('');
        setSelectedTemplate(null);
        setTemplateVariables([]);
        setEmailConfig({});
        // 重置 form
        if (form) {
          form.setFieldsValue({
            'emailConfig.providerKey': '',
            'emailConfig.subject': '',
            'emailConfig.body': '',
          });
        }
      }
    }
  }, [config, form, expanded]);

  // 監聽 config 的收件人變化（當通過 RecipientModal 更新時）
  useEffect(() => {
    if (expanded && config) {
      // 如果 config 中的收件人與 state 不一致，更新 state
      // 這確保了當通過 RecipientModal 更新節點數據後，state 也能同步
      if (config.recipients !== recipients || 
          JSON.stringify(config.recipientDetails) !== JSON.stringify(recipientDetails)) {
        setRecipients(config.recipients || '');
        setRecipientDetails(config.recipientDetails || null);
      }
      // 同樣檢查 emailConfig
      if (config.emailConfig && activeTab === 'email') {
        const configEmail = config.emailConfig;
        if (configEmail.providerKey !== emailConfig.providerKey ||
            configEmail.subject !== emailConfig.subject ||
            configEmail.body !== emailConfig.body) {
          setEmailConfig(configEmail);
          if (form) {
            form.setFieldsValue({
              'emailConfig.providerKey': configEmail.providerKey || '',
              'emailConfig.subject': configEmail.subject || '',
              'emailConfig.body': configEmail.body || '',
            });
          }
        }
      }
    }
  }, [config?.recipients, config?.recipientDetails, config?.emailConfig, expanded, activeTab]);

  // 處理模板選擇事件
  useEffect(() => {
    const handleTemplateSelected = (event) => {
      const { template, isMetaTemplate } = event.detail;
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

  // 保存配置
  const handleSave = () => {
    let newConfig = {
      recipients,
      recipientDetails,
      messageMode: activeTab // 'direct', 'template', 'email'
    };
    
    if (activeTab === 'direct') {
      newConfig = {
        ...newConfig,
        useTemplate: false,
        message: directMessage
      };
    } else if (activeTab === 'template') {
      newConfig = {
        ...newConfig,
        useTemplate: true,
        templateId: selectedTemplate?.id || '',
        templateName: selectedTemplate?.name || '',
        isMetaTemplate: selectedTemplate?.isMetaTemplate || false,
        templateLanguage: selectedTemplate?.language || null,
        templateVariables: templateVariables
      };
    } else if (activeTab === 'email') {
      // 使用 Time Validator 專用的 emailConfig（從 state 獲取）
      // 如果 state 中沒有，則從 form 獲取
      const formValues = form.getFieldsValue(['emailConfig.providerKey', 'emailConfig.subject', 'emailConfig.body']);
      newConfig = {
        ...newConfig,
        useTemplate: false,
        emailConfig: {
          providerKey: emailConfig.providerKey !== undefined && emailConfig.providerKey !== null 
            ? emailConfig.providerKey 
            : (formValues['emailConfig.providerKey'] || ''),
          subject: emailConfig.subject !== undefined && emailConfig.subject !== null 
            ? emailConfig.subject 
            : (formValues['emailConfig.subject'] || ''),
          body: emailConfig.body !== undefined && emailConfig.body !== null 
            ? emailConfig.body 
            : (formValues['emailConfig.body'] || ''),
          replyTo: emailConfig.replyTo !== undefined && emailConfig.replyTo !== null 
            ? emailConfig.replyTo 
            : '',
        }
      };
    }

    // 根據 type 更新對應的配置
    if (type === 'retryMessage') {
      const newValidation = {
        ...(selectedNode.data.validation || {}),
        retryMessageConfig: newConfig
      };
      handleNodeDataChange({ validation: newValidation });
      message.success(t('workflowDesigner.timeValidator.retryMessageSaved'));
    } else if (type === 'escalation') {
      const newValidation = {
        ...(selectedNode.data.validation || {}),
        escalationConfig: newConfig
      };
      handleNodeDataChange({ validation: newValidation });
      message.success(t('workflowDesigner.timeValidator.escalationSaved'));
    } else if (type === 'overdueEscalation') {
      const newOverdueConfig = {
        ...(selectedNode.data.overdueConfig || {}),
        escalationConfig: newConfig
      };
      handleNodeDataChange({ overdueConfig: newOverdueConfig });
      message.success(t('workflowDesigner.timeValidator.escalationSaved'));
    }

    // 收起配置區塊
    if (onToggleExpanded) {
      onToggleExpanded(false);
    }
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

  // 檢查是否有收件人選擇（同時檢查 state 和 config prop）
  const hasRecipients = () => {
    // 先檢查 state（用戶在當前會話中的選擇）
    if (recipients && recipients.trim()) {
      return true;
    }
    if (recipientDetails) {
      const hasGroups = recipientDetails.groups && recipientDetails.groups.length > 0;
      const hasHashtags = recipientDetails.hashtags && recipientDetails.hashtags.length > 0;
      const hasProcessVariables = recipientDetails.processVariables && recipientDetails.processVariables.length > 0;
      const hasUseInitiator = recipientDetails.useInitiator === true;
      if (hasGroups || hasHashtags || hasProcessVariables || hasUseInitiator) {
        return true;
      }
    }
    
    // 如果 state 中沒有，檢查 config prop（從節點數據中獲取）
    if (config) {
      if (config.recipients && config.recipients.trim()) {
        return true;
      }
      if (config.recipientDetails) {
        const hasGroups = config.recipientDetails.groups && config.recipientDetails.groups.length > 0;
        const hasHashtags = config.recipientDetails.hashtags && config.recipientDetails.hashtags.length > 0;
        const hasProcessVariables = config.recipientDetails.processVariables && config.recipientDetails.processVariables.length > 0;
        const hasUseInitiator = config.recipientDetails.useInitiator === true;
        if (hasGroups || hasHashtags || hasProcessVariables || hasUseInitiator) {
          return true;
        }
      }
    }
    
    return false;
  };

  // 檢查是否可以保存
  const canSave = () => {
    const hasRecipientsResult = hasRecipients();
    
    if (!hasRecipientsResult) {
      return false;
    }
    
    if (activeTab === 'direct') {
      return directMessage.trim().length > 0;
    } else if (activeTab === 'template') {
      return !!selectedTemplate;
    } else if (activeTab === 'email') {
      // 檢查 Time Validator 專用的 emailConfig
      // 同時檢查 state 和 config prop（因為可能從 RecipientModal 更新了節點數據，但 state 還沒更新）
      const formValues = form.getFieldsValue(['emailConfig.providerKey', 'emailConfig.subject', 'emailConfig.body']);
      const configEmailConfig = config?.emailConfig || {};
      
      const providerKey = emailConfig.providerKey || configEmailConfig.providerKey || formValues['emailConfig.providerKey'] || '';
      const subject = emailConfig.subject || configEmailConfig.subject || formValues['emailConfig.subject'] || '';
      const body = emailConfig.body || configEmailConfig.body || formValues['emailConfig.body'] || '';
      
      return !!(
        providerKey && providerKey.trim().length > 0 &&
        subject && subject.trim().length > 0 &&
        body && body.trim().length > 0
      );
    }
    return false;
  };

  // 清除配置
  const handleClear = () => {
    if (type === 'retryMessage') {
      const newValidation = {
        ...(selectedNode.data.validation || {}),
        retryMessageConfig: null
      };
      handleNodeDataChange({ validation: newValidation });
    } else if (type === 'escalation') {
      const newValidation = {
        ...(selectedNode.data.validation || {}),
        escalationConfig: null
      };
      handleNodeDataChange({ validation: newValidation });
    } else if (type === 'overdueEscalation') {
      const newOverdueConfig = {
        ...(selectedNode.data.overdueConfig || {}),
        escalationConfig: null
      };
      handleNodeDataChange({ overdueConfig: newOverdueConfig });
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
        <DirectMessageTab
          form={form}
          t={t}
          processVariables={processVariables}
          fieldName="directMessage"
          mode="modal"
          description={messageDescription}
          placeholder={messagePlaceholder}
          rows={6}
          tip={messageTip}
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
            {messageDescription}
          </div>
          <EmailTab
            form={form}
            t={t}
            processVariables={processVariables}
            emailProviders={emailProviders}
            loadingEmailProviders={loadingEmailProviders}
            // 使用 Time Validator 專用的 emailConfig（存儲在 state 中）
            emailConfig={emailConfig}
            onEmailConfigChange={(newConfig) => {
              // 更新 Time Validator 專用的 emailConfig state
              setEmailConfig(newConfig);
              // 同步到 form
              form.setFieldsValue({
                'emailConfig.providerKey': newConfig.providerKey || '',
                'emailConfig.subject': newConfig.subject || '',
                'emailConfig.body': newConfig.body || '',
              });
            }}
            fieldPrefix="emailConfig"
            showProcessVariables={true}
          />
        </div>
      )
    }
  ];

  if (!expanded) {
    return (
      <Card
        size="small"
        style={{ marginBottom: 16 }}
        title={title}
        extra={
          <Space>
            {config && (
              <Button
                type="text"
                danger
                size="small"
                icon={<CloseOutlined />}
                onClick={handleClear}
              >
                {t('workflowDesigner.clear')}
              </Button>
            )}
            <Button
              type="primary"
              size="small"
              onClick={() => onToggleExpanded(true)}
            >
              {config ? t('common.edit') : t('common.configure')}
            </Button>
          </Space>
        }
      >
        {config ? (
          <div style={{ color: '#666', fontSize: 14 }}>
            ✓ {t('common.configured') || 'Configured'}
          </div>
        ) : (
          <div style={{ color: '#999', fontSize: 14 }}>
            {t('common.notConfigured') || 'Not configured'}
          </div>
        )}
      </Card>
    );
  }

  return (
    <Card
      size="small"
      style={{ marginBottom: 16 }}
      title={title}
      extra={
        <Button
          type="text"
          size="small"
          onClick={() => onToggleExpanded(false)}
        >
          {t('common.cancel')}
        </Button>
      }
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
          {recipientsLabel}
        </div>
        <div style={{ marginBottom: 8, fontSize: 13, color: '#666' }}>
          {recipientsDescription}
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
          {messageLabel}
        </div>
        
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
        />
      </div>

      {/* 操作按鈕 */}
      <div style={{ marginTop: 24, textAlign: 'right' }}>
        <Space>
          <Button onClick={() => onToggleExpanded(false)}>
            {t('common.cancel')}
          </Button>
          <Button 
            type="primary" 
            onClick={handleSave}
            disabled={!canSave()}
          >
            {t('common.save')}
          </Button>
        </Space>
      </div>
    </Card>
  );
};

export default TimeValidatorConfigSection;

