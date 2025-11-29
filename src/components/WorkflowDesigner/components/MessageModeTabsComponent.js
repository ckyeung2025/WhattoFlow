import React, { useEffect } from 'react';
import { Tabs } from 'antd';
import { MessageOutlined, FileTextOutlined, MailOutlined } from '@ant-design/icons';
import DirectMessageTab from './DirectMessageTab';
import TemplateTab from './TemplateTab';
import EmailTab from './EmailTab';
import { useEmailProviders } from '../hooks/useEmailProviders';

/**
 * 統一的訊息模式 Tab 組件
 * 用於所有需要發送訊息的節點（sendWhatsApp, waitReply, waitForQRCode, sendEForm）
 */
const MessageModeTabsComponent = ({
  selectedNode,
  handleNodeDataChange,
  setIsTemplateModalVisible,
  processVariables,
  form,
  t,
  // 可選配置
  messageLabel = null,  // 訊息輸入框的標籤
  messagePlaceholder = null,  // 訊息輸入框的佔位符
  messageRows = 3,  // 訊息輸入框的行數
  showProcessVariables = true,  // 是否顯示流程變數
  directMessageContent = null,  // 自定義直接訊息內容（用於 sendEForm 的特殊情況）
  fixedVariables = [],  // 新增：固化變量列表（用於 sendEForm 的 formName 和 formUrl）
  enableEmailMode = true,  // 是否啟用 Email 模式
}) => {
  // 使用 Email Providers Hook
  const { emailProviders, loadingEmailProviders } = useEmailProviders(enableEmailMode);

  // 確保 form 中的 emailConfig 字段與節點數據同步
  useEffect(() => {
    if (form && selectedNode?.data?.emailConfig) {
      const emailConfig = selectedNode.data.emailConfig;
      const currentFormValues = form.getFieldsValue(['emailConfig.providerKey', 'emailConfig.subject', 'emailConfig.body']);
      // 只在值不同時才更新，避免不必要的重新渲染
      if (currentFormValues['emailConfig.providerKey'] !== emailConfig.providerKey ||
          currentFormValues['emailConfig.subject'] !== emailConfig.subject ||
          currentFormValues['emailConfig.body'] !== emailConfig.body) {
        form.setFieldsValue({
          'emailConfig.providerKey': emailConfig.providerKey || '',
          'emailConfig.subject': emailConfig.subject || '',
          'emailConfig.body': emailConfig.body || '',
        });
      }
    }
  }, [form, selectedNode?.data?.emailConfig?.providerKey, selectedNode?.data?.emailConfig?.subject, selectedNode?.data?.emailConfig?.body]);

  // 渲染直接訊息 Tab 內容
  const renderDirectMessageTab = () => {
    return (
      <DirectMessageTab
        form={form}
        t={t}
        processVariables={processVariables}
        fieldName="message"
        label={messageLabel}
        placeholder={messagePlaceholder}
        rows={messageRows}
        showProcessVariables={showProcessVariables}
        onChange={(value) => handleNodeDataChange({ message: value })}
        customContent={directMessageContent}
      />
    );
  };

  // 渲染 Email Tab 內容
  const renderEmailTab = () => {
    const emailConfig = selectedNode.data.emailConfig || {};
    
    return (
      <EmailTab
        form={form}
        t={t}
        processVariables={processVariables}
        emailProviders={emailProviders}
        loadingEmailProviders={loadingEmailProviders}
        emailConfig={emailConfig}
        onEmailConfigChange={(newConfig) => handleNodeDataChange({ emailConfig: newConfig })}
        fieldPrefix="emailConfig"
        showProcessVariables={showProcessVariables}
      />
    );
  };

  // 渲染模板 Tab 內容
  const renderTemplateTab = () => {
    return (
      <TemplateTab
        form={form}
        t={t}
        processVariables={processVariables}
        templateData={{
          templateId: selectedNode.data.templateId,
          templateName: selectedNode.data.templateName,
          isMetaTemplate: selectedNode.data.isMetaTemplate,
          templateLanguage: selectedNode.data.templateLanguage,
          templateVariables: selectedNode.data.templateVariables || [],
        }}
        onTemplateSelect={() => setIsTemplateModalVisible(true)}
        onTemplateClear={() => {
          handleNodeDataChange({ 
            templateId: '', 
            templateName: '', 
            isMetaTemplate: false,
            templateLanguage: null,
            templateVariables: []
          });
        }}
        onTemplateVariablesChange={(templateVariables) => {
          handleNodeDataChange({ templateVariables });
        }}
        mode="input"
        onOpenTemplateModal={() => setIsTemplateModalVisible(true)}
        fixedVariables={fixedVariables}
      />
    );
  };

  const items = [
    {
      key: 'direct',
      label: (
        <span>
          <MessageOutlined /> {t('workflowDesigner.directMessage')}
        </span>
      ),
      children: renderDirectMessageTab()
    },
    {
      key: 'template',
      label: (
        <span>
          <FileTextOutlined /> {t('workflowDesigner.useTemplate')}
        </span>
      ),
      children: renderTemplateTab()
    }
  ];

  // 如果啟用 Email 模式，添加 Email tab
  if (enableEmailMode) {
    items.push({
      key: 'email',
      label: (
        <span>
          <MailOutlined /> {t('workflowDesigner.sendEmail')}
        </span>
      ),
      children: renderEmailTab()
    });
  }

  return (
    <Tabs
      activeKey={selectedNode.data.messageMode || 'direct'}
      onChange={(key) => handleNodeDataChange({ messageMode: key })}
      items={items}
    />
  );
};

export default MessageModeTabsComponent;

