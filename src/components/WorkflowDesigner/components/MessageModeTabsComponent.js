import React from 'react';
import { Tabs, Form, Input, Tag, Card, Button } from 'antd';
import { MessageOutlined, FileTextOutlined, FormOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import TemplateVariableConfig from './TemplateVariableConfig';

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
}) => {
  // 渲染直接訊息 Tab 內容
  const renderDirectMessageTab = () => {
    if (directMessageContent) {
      // 如果提供了自定義內容，直接使用（用於 sendEForm）
      return directMessageContent;
    }
    
    // 處理 messagePlaceholder：如果包含點（.），則視為語言鍵並翻譯
    let finalPlaceholder;
    if (messagePlaceholder && messagePlaceholder.includes('.')) {
      // 視為語言鍵並翻譯
      finalPlaceholder = t(messagePlaceholder);
    } else {
      // 直接使用提供的字符串或默認值
      finalPlaceholder = messagePlaceholder || t('workflowDesigner.messageWithVariablesPlaceholder');
    }
    
    // 默認的直接訊息輸入界面
    return (
      <>
        <Form.Item 
          label={messageLabel === null ? null : (messageLabel || t('workflow.message'))} 
          name="message"
        >
          <Input.TextArea 
            rows={messageRows} 
            placeholder={finalPlaceholder}
          />
        </Form.Item>
        
        {showProcessVariables && processVariables && processVariables.length > 0 && (
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
                    const currentValue = form.getFieldValue('message') || '';
                    const newValue = currentValue + `\${${pv.variableName}}`;
                    form.setFieldValue('message', newValue);
                    handleNodeDataChange({ message: newValue });
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
  const renderTemplateTab = () => (
    <>
      <Form.Item label={t('workflowDesigner.dataSet.template')}>
        <Input 
          value={selectedNode.data.templateName || ''}
          placeholder={t('workflowDesigner.selectTemplate')} 
          readOnly 
          onClick={() => setIsTemplateModalVisible(true)}
          suffix={<FormOutlined />}
        />
      </Form.Item>
      
      {selectedNode.data.templateId && (
        <Card size="small" title={t('workflowDesigner.templateInfo')} style={{ marginBottom: 16 }}>
          <p><strong>{t('workflowDesigner.templateId')}</strong>{selectedNode.data.templateId}</p>
          <p><strong>{t('workflowDesigner.templateName')}</strong>{selectedNode.data.templateName}</p>
          {selectedNode.data.isMetaTemplate && (
            <p>
              <Tag color="blue">{t('workflowDesigner.metaTemplate.title')}</Tag>
            </p>
          )}
        </Card>
      )}
      
      {/* 模板變數編輯 */}
      {selectedNode.data.templateId && (
        <TemplateVariableConfig
          templateId={selectedNode.data.templateId}
          isMetaTemplate={selectedNode.data.isMetaTemplate}
          processVariables={processVariables}
          value={selectedNode.data.templateVariables || []}
          onChange={(templateVariables) => handleNodeDataChange({ templateVariables })}
          t={t}
        />
      )}
    </>
  );

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

  return (
    <Tabs
      activeKey={selectedNode.data.messageMode || 'direct'}
      onChange={(key) => handleNodeDataChange({ messageMode: key })}
      items={items}
    />
  );
};

export default MessageModeTabsComponent;

