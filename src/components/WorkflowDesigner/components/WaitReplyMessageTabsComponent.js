import React, { useState, useEffect } from 'react';
import { Tabs, Form, Input, Tag, Card, Button } from 'antd';
import { MessageOutlined, FileTextOutlined, FormOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import TemplateVariableConfig from './TemplateVariableConfig';

/**
 * Wait for User Reply 訊息配置組件
 * 包含外層 Tab（提示訊息、成功訊息、錯誤訊息）和內層 Tab（直接輸入訊息、使用模板）
 */
const WaitReplyMessageTabsComponent = ({
  selectedNode,
  handleNodeDataChange,
  setIsTemplateModalVisible,
  processVariables,
  form,
  t,
}) => {
  const [activeMessageType, setActiveMessageType] = useState('prompt'); // prompt, success, error

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
        };
      case 'success':
        return {
          messageMode: 'waitReplySuccessMessageMode',
          message: 'waitReplySuccessMessage',
          templateId: 'waitReplySuccessTemplateId',
          templateName: 'waitReplySuccessTemplateName',
          isMetaTemplate: 'waitReplySuccessIsMetaTemplate',
          templateLanguage: 'waitReplySuccessTemplateLanguage',
          templateVariables: 'waitReplySuccessTemplateVariables',
        };
      case 'error':
        return {
          messageMode: 'waitReplyErrorMessageMode',
          message: 'waitReplyErrorMessage',
          templateId: 'waitReplyErrorTemplateId',
          templateName: 'waitReplyErrorTemplateName',
          isMetaTemplate: 'waitReplyErrorIsMetaTemplate',
          templateLanguage: 'waitReplyErrorTemplateLanguage',
          templateVariables: 'waitReplyErrorTemplateVariables',
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
    const handleWaitReplyTemplateSelected = (event) => {
      const { template, isMetaTemplate, messageType } = event.detail;
      console.log('🎯 WaitReplyMessageTabsComponent 收到模板選擇事件:', { template: template.name, isMetaTemplate, messageType });
      
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

    window.addEventListener('waitReplyTemplateSelected', handleWaitReplyTemplateSelected);
    
    return () => {
      window.removeEventListener('waitReplyTemplateSelected', handleWaitReplyTemplateSelected);
    };
  }, [activeMessageType, setIsTemplateModalVisible]);

  // 渲染直接訊息 Tab 內容
  const renderDirectMessageTab = (messageType) => {
    const currentData = getCurrentData(messageType);
    const prefix = getFieldPrefix(messageType);
    
    let placeholder;
    if (messageType === 'prompt') {
      placeholder = t('workflowDesigner.waitReplyMessagePlaceholder');
    } else if (messageType === 'success') {
      placeholder = t('workflowDesigner.waitReplySuccessMessagePlaceholder');
    } else {
      placeholder = t('workflowDesigner.waitReplyErrorMessagePlaceholder');
    }

    return (
      <>
        <Form.Item 
          label={null}
          name={prefix.message}
        >
          <Input.TextArea 
            rows={messageType === 'prompt' ? 3 : 2}
            placeholder={placeholder}
            onChange={(e) => {
              updateCurrentData(messageType, { message: e.target.value });
            }}
          />
        </Form.Item>
        
        {processVariables && processVariables.length > 0 && (
          <Form.Item label={t('workflowDesigner.availableVariables')}>
            <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
              {t('workflowDesigner.variableSyntaxHelp')}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {processVariables.map(pv => (
                <Tag 
                  key={pv.id} 
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const currentValue = form.getFieldValue(prefix.message) || '';
                    const newValue = currentValue + `\${${pv.variableName}}`;
                    form.setFieldValue(prefix.message, newValue);
                    updateCurrentData(messageType, { message: newValue });
                  }}
                >
                  {pv.variableName} ({pv.dataType})
                </Tag>
              ))}
            </div>
          </Form.Item>
        )}
      </>
    );
  };

  // 渲染模板 Tab 內容
  const renderTemplateTab = (messageType) => {
    const currentData = getCurrentData(messageType);
    const prefix = getFieldPrefix(messageType);

    return (
      <>
        <Form.Item label={t('workflowDesigner.dataSet.template')}>
          <div style={{ position: 'relative' }}>
            <Input 
              value={currentData.templateName || ''}
              placeholder={t('workflowDesigner.selectTemplate')} 
              readOnly 
              onClick={() => {
                // 設置模板選擇的來源，以便在 TemplateModal 中知道是為哪個訊息類型選擇模板
                // 通過自定義事件傳遞訊息類型
                window.dispatchEvent(new CustomEvent('waitReplyTemplateSelectRequest', { 
                  detail: { messageType: messageType } 
                }));
                setIsTemplateModalVisible(true);
              }}
              suffix={<FormOutlined />}
            />
            {currentData.templateId && (
              <div style={{ 
                position: 'absolute', 
                right: '30px', 
                top: '50%', 
                transform: 'translateY(-50%)',
                zIndex: 1
              }}>
                <Button 
                  type="text" 
                  size="small" 
                  onClick={(e) => {
                    e.stopPropagation();
                    updateCurrentData(messageType, {
                      messageMode: 'direct', // 清除模板時切換回直接訊息模式
                      templateId: '',
                      templateName: '',
                      isMetaTemplate: false,
                      templateLanguage: null,
                      templateVariables: []
                    });
                  }}
                  style={{ padding: '0 4px', fontSize: '12px' }}
                >
                  {t('workflowDesigner.clear')}
                </Button>
              </div>
            )}
          </div>
        </Form.Item>
        
        {currentData.templateId && (
          <Card size="small" title={t('workflowDesigner.templateInfo')} style={{ marginBottom: 16 }}>
            <p><strong>{t('workflowDesigner.templateId')}</strong>{currentData.templateId}</p>
            <p><strong>{t('workflowDesigner.templateName')}</strong>{currentData.templateName}</p>
            {currentData.isMetaTemplate && (
              <p>
                <Tag color="blue">{t('workflowDesigner.metaTemplate.title')}</Tag>
              </p>
            )}
          </Card>
        )}
        
        {/* 模板變數編輯 */}
        {currentData.templateId && (
          <TemplateVariableConfig
            templateId={currentData.templateId}
            isMetaTemplate={currentData.isMetaTemplate}
            processVariables={processVariables}
            value={currentData.templateVariables || []}
            onChange={(templateVariables) => updateCurrentData(messageType, { templateVariables })}
            t={t}
          />
        )}
      </>
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
          <CheckCircleOutlined /> {t('workflowDesigner.waitReplySuccessMessage')}
        </span>
      ),
      children: renderInnerTabs('success')
    },
    {
      key: 'error',
      label: (
        <span>
          <CloseCircleOutlined /> {t('workflowDesigner.waitReplyErrorMessage')}
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

export default WaitReplyMessageTabsComponent;


