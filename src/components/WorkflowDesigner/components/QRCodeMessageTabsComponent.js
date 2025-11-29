import React, { useState, useEffect } from 'react';
import { Tabs } from 'antd';
import { MessageOutlined, FileTextOutlined, CheckCircleOutlined, CloseCircleOutlined, MailOutlined } from '@ant-design/icons';
import DirectMessageTab from './DirectMessageTab';
import TemplateTab from './TemplateTab';
import EmailTab from './EmailTab';
import { useEmailProviders } from '../hooks/useEmailProviders';

/**
 * QR Code 訊息配置組件
 * 包含外層 Tab（提示訊息、成功訊息、錯誤訊息）和內層 Tab（直接輸入訊息、使用模板）
 */
const QRCodeMessageTabsComponent = ({
  selectedNode,
  handleNodeDataChange,
  setIsTemplateModalVisible,
  processVariables,
  form,
  t,
}) => {
  const [activeMessageType, setActiveMessageType] = useState('prompt'); // prompt, success, error
  
  // 使用 Email Providers Hook
  const { emailProviders, loadingEmailProviders } = useEmailProviders(true);

  // 根據訊息類型獲取對應的數據字段前綴
  const getFieldPrefix = (messageType) => {
    switch (messageType) {
      case 'prompt':
        return {
          messageMode: 'messageMode',
          message: 'message',
          templateId: 'templateId',
          templateName: 'templateName',
          isMetaTemplate: 'isMetaTemplate',
          templateLanguage: 'templateLanguage',
          templateVariables: 'templateVariables',
          emailConfig: 'emailConfig',
        };
      case 'success':
        return {
          messageMode: 'qrCodeSuccessMessageMode',
          message: 'qrCodeSuccessMessage',
          templateId: 'qrCodeSuccessTemplateId',
          templateName: 'qrCodeSuccessTemplateName',
          isMetaTemplate: 'qrCodeSuccessIsMetaTemplate',
          templateLanguage: 'qrCodeSuccessTemplateLanguage',
          templateVariables: 'qrCodeSuccessTemplateVariables',
          emailConfig: 'qrCodeSuccessEmailConfig',
        };
      case 'error':
        return {
          messageMode: 'qrCodeErrorMessageMode',
          message: 'qrCodeErrorMessage',
          templateId: 'qrCodeErrorTemplateId',
          templateName: 'qrCodeErrorTemplateName',
          isMetaTemplate: 'qrCodeErrorIsMetaTemplate',
          templateLanguage: 'qrCodeErrorTemplateLanguage',
          templateVariables: 'qrCodeErrorTemplateVariables',
          emailConfig: 'qrCodeErrorEmailConfig',
        };
      default:
        return {};
    }
  };

  // 獲取當前訊息類型的數據
  const getCurrentData = (messageType) => {
    const prefix = getFieldPrefix(messageType);
    return {
      messageMode: selectedNode.data[prefix.messageMode] || 'direct',
      message: selectedNode.data[prefix.message] || '',
      templateId: selectedNode.data[prefix.templateId] || '',
      templateName: selectedNode.data[prefix.templateName] || '',
      isMetaTemplate: selectedNode.data[prefix.isMetaTemplate] || false,
      templateLanguage: selectedNode.data[prefix.templateLanguage] || null,
      templateVariables: selectedNode.data[prefix.templateVariables] || [],
      emailConfig: selectedNode.data[prefix.emailConfig] || {},
    };
  };

  // 更新當前訊息類型的數據
  const updateCurrentData = (messageType, updates) => {
    const prefix = getFieldPrefix(messageType);
    const dataUpdates = {};
    Object.keys(updates).forEach(key => {
      if (prefix[key]) {
        dataUpdates[prefix[key]] = updates[key];
      }
    });
    handleNodeDataChange(dataUpdates);
  };

  // 處理模板選擇 - 通過事件監聽器處理
  useEffect(() => {
    const handleQRCodeTemplateSelected = (event) => {
      const { template, isMetaTemplate, messageType } = event.detail;
      console.log('🎯 QRCodeMessageTabsComponent 收到模板選擇事件:', { template: template.name, isMetaTemplate, messageType });
      
      if (messageType === activeMessageType) {
        updateCurrentData(messageType, {
          messageMode: 'template', // 重要：設置為模板模式
          templateId: template.id,
          templateName: template.name,
          isMetaTemplate: isMetaTemplate,
          templateLanguage: template.language || null,
        });
        setIsTemplateModalVisible(false);
      }
    };

    window.addEventListener('qrCodeTemplateSelected', handleQRCodeTemplateSelected);
    
    return () => {
      window.removeEventListener('qrCodeTemplateSelected', handleQRCodeTemplateSelected);
    };
  }, [activeMessageType]);

  // 渲染直接訊息 Tab 內容
  const renderDirectMessageTab = (messageType) => {
    const prefix = getFieldPrefix(messageType);
    
    let placeholder;
    if (messageType === 'prompt') {
      placeholder = t('workflowDesigner.qrCodeMessagePlaceholder');
    } else if (messageType === 'success') {
      placeholder = t('workflowDesigner.dataSet.qrCodeSuccessMessage');
    } else {
      placeholder = t('workflowDesigner.dataSet.qrCodeErrorMessage');
    }

    return (
      <DirectMessageTab
        form={form}
        t={t}
        processVariables={processVariables}
        fieldName={prefix.message}
        label={null}
        placeholder={placeholder}
        rows={messageType === 'prompt' ? 3 : 2}
        showProcessVariables={true}
        onChange={(value) => updateCurrentData(messageType, { message: value })}
        onVariableInsert={(variableName) => {
          const currentValue = form.getFieldValue(prefix.message) || '';
          const newValue = currentValue + `\${${variableName}}`;
          form.setFieldValue(prefix.message, newValue);
          updateCurrentData(messageType, { message: newValue });
        }}
      />
    );
  };

  // 渲染模板 Tab 內容
  const renderTemplateTab = (messageType) => {
    const currentData = getCurrentData(messageType);

    return (
      <TemplateTab
        form={form}
        t={t}
        processVariables={processVariables}
        templateData={{
          templateId: currentData.templateId,
          templateName: currentData.templateName,
          isMetaTemplate: currentData.isMetaTemplate,
          templateLanguage: currentData.templateLanguage,
          templateVariables: currentData.templateVariables || [],
        }}
        onTemplateSelect={() => {
          window.dispatchEvent(new CustomEvent('qrCodeTemplateSelectRequest', { 
            detail: { messageType: messageType } 
          }));
          setIsTemplateModalVisible(true);
        }}
        onTemplateClear={() => {
          updateCurrentData(messageType, {
            messageMode: 'direct',
            templateId: '',
            templateName: '',
            isMetaTemplate: false,
            templateLanguage: null,
            templateVariables: []
          });
        }}
        onTemplateVariablesChange={(templateVariables) => {
          updateCurrentData(messageType, { templateVariables });
        }}
        mode="input"
        onOpenTemplateModal={() => {
          window.dispatchEvent(new CustomEvent('qrCodeTemplateSelectRequest', { 
            detail: { messageType: messageType } 
          }));
          setIsTemplateModalVisible(true);
        }}
        onCustomEvent={true}
        eventName="qrCodeTemplateSelectRequest"
        eventData={{ messageType }}
      />
    );
  };

  // 渲染 Email Tab 內容
  const renderEmailTab = (messageType) => {
    const currentData = getCurrentData(messageType);
    const prefix = getFieldPrefix(messageType);
    const emailConfig = currentData.emailConfig || {};
    
    return (
      <EmailTab
        form={form}
        t={t}
        processVariables={processVariables}
        emailProviders={emailProviders}
        loadingEmailProviders={loadingEmailProviders}
        emailConfig={emailConfig}
        onEmailConfigChange={(newConfig) => {
          updateCurrentData(messageType, { emailConfig: newConfig });
        }}
        fieldPrefix={prefix.emailConfig}
        showProcessVariables={true}
        onVariableInsert={(variableName) => {
          const currentBody = emailConfig.body || '';
          const newBody = currentBody + `\${${variableName}}`;
          updateCurrentData(messageType, { 
            emailConfig: {
              ...emailConfig,
              body: newBody
            }
          });
        }}
      />
    );
  };

  // 渲染內層 Tab（直接輸入訊息/使用模板）
  const renderInnerTabs = (messageType) => {
    const currentData = getCurrentData(messageType);
    const prefix = getFieldPrefix(messageType);

    const innerItems = [
      {
        key: 'direct',
        label: (
          <span>
            <MessageOutlined /> {t('workflowDesigner.directMessage')}
          </span>
        ),
        children: renderDirectMessageTab(messageType)
      },
      {
        key: 'template',
        label: (
          <span>
            <FileTextOutlined /> {t('workflowDesigner.useTemplate')}
          </span>
        ),
        children: renderTemplateTab(messageType)
      },
      {
        key: 'email',
        label: (
          <span>
            <MailOutlined /> {t('workflowDesigner.sendEmail')}
          </span>
        ),
        children: renderEmailTab(messageType)
      }
    ];

    return (
      <Tabs
        activeKey={currentData.messageMode || 'direct'}
        onChange={(key) => updateCurrentData(messageType, { messageMode: key })}
        items={innerItems}
      />
    );
  };

  // 外層 Tab 項目
  const outerItems = [
    {
      key: 'prompt',
      label: (
        <span>
          <MessageOutlined /> {t('workflowDesigner.promptMessage')}
        </span>
      ),
      children: (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: '12px', color: 'rgba(0, 0, 0, 0.45)', marginBottom: 12 }}>
            {t('workflowDesigner.promptMessageHelp')}
          </div>
          {renderInnerTabs('prompt')}
        </div>
      )
    },
    {
      key: 'success',
      label: (
        <span>
          <CheckCircleOutlined /> {t('workflowDesigner.qrCodeSuccessMessage')}
        </span>
      ),
      children: renderInnerTabs('success')
    },
    {
      key: 'error',
      label: (
        <span>
          <CloseCircleOutlined /> {t('workflowDesigner.qrCodeErrorMessage')}
        </span>
      ),
      children: renderInnerTabs('error')
    }
  ];

  return (
    <Tabs
      activeKey={activeMessageType}
      onChange={setActiveMessageType}
      items={outerItems}
    />
  );
};

export default QRCodeMessageTabsComponent;

