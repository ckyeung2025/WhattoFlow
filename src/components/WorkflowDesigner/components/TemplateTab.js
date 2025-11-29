import React from 'react';
import { Form, Input, Card, Button, Tag } from 'antd';
import { FormOutlined } from '@ant-design/icons';
import TemplateVariableConfig from './TemplateVariableConfig';

/**
 * 模板選擇 Tab 組件
 * 支持兩種模式：
 * 1. Input 模式：使用 Input 組件顯示模板名稱，點擊打開模板選擇 Modal
 * 2. Button 模式：使用 Button 打開模板選擇 Modal，然後顯示選中的模板信息
 * 
 * @param {Object} props
 * @param {Function} props.form - Ant Design Form 實例
 * @param {Function} props.t - 翻譯函數
 * @param {Array} props.processVariables - 流程變量列表
 * @param {Object} props.templateData - 模板數據對象 { templateId, templateName, isMetaTemplate, templateLanguage, templateVariables }
 * @param {Function} props.onTemplateSelect - 模板選擇回調函數
 * @param {Function} props.onTemplateClear - 模板清除回調函數
 * @param {Function} props.onTemplateVariablesChange - 模板變量變更回調函數
 * @param {string} props.mode - 模式：'input' 或 'button'，默認 'input'
 * @param {Function} props.onOpenTemplateModal - 打開模板選擇 Modal 的回調函數
 * @param {Function} props.onCustomEvent - 自定義事件處理函數（用於 WaitReply 和 QRCode 組件）
 * @param {string} props.eventName - 自定義事件名稱（用於 WaitReply 和 QRCode 組件）
 * @param {Object} props.eventData - 自定義事件數據（用於 WaitReply 和 QRCode 組件）
 * @param {Array} props.fixedVariables - 固化變量列表（用於 sendEForm）
 * @param {string} props.description - 描述文本（用於 Modal 模式）
 * @param {string} props.noTemplateSelectedText - 未選擇模板時的提示文本
 */
const TemplateTab = ({
  form,
  t,
  processVariables = [],
  templateData = {
    templateId: null,
    templateName: null,
    isMetaTemplate: false,
    templateLanguage: null,
    templateVariables: [],
  },
  onTemplateSelect = null,
  onTemplateClear = null,
  onTemplateVariablesChange = null,
  mode = 'input', // 'input' 或 'button'
  onOpenTemplateModal = null,
  onCustomEvent = null,
  eventName = null,
  eventData = null,
  fixedVariables = [],
  description = null,
  noTemplateSelectedText = null,
}) => {
  const handleTemplateClick = () => {
    if (mode === 'input') {
      // Input 模式：觸發自定義事件或直接打開 Modal
      if (onCustomEvent && eventName && eventData) {
        window.dispatchEvent(new CustomEvent(eventName, { detail: eventData }));
      }
      if (onOpenTemplateModal) {
        onOpenTemplateModal();
      }
    } else {
      // Button 模式：直接打開 Modal
      if (onOpenTemplateModal) {
        onOpenTemplateModal();
      }
    }
  };

  const handleClear = (e) => {
    if (e) {
      e.stopPropagation();
    }
    if (onTemplateClear) {
      onTemplateClear();
    }
  };

  const handleTemplateVariablesChange = (templateVariables) => {
    if (onTemplateVariablesChange) {
      onTemplateVariablesChange(templateVariables);
    }
  };

  if (mode === 'button') {
    // Button 模式（用於 Modal）
    return (
      <div style={{ padding: '16px 0' }}>
        {description && (
          <div style={{ marginBottom: 12, fontSize: 14, color: '#666' }}>
            {description}
          </div>
        )}
        
        <Button 
          type="dashed" 
          icon={<FormOutlined />}
          onClick={handleTemplateClick}
          style={{ width: '100%', marginBottom: 12 }}
        >
          {t('workflowDesigner.selectTemplate')}
        </Button>
        
        {templateData.templateId && (
          <div style={{ 
            padding: 12, 
            backgroundColor: '#f5f5f5', 
            borderRadius: 6,
            border: '1px solid #d9d9d9'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
                  {templateData.templateName}
                </div>
                {templateData.isMetaTemplate && (
                  <Tag color="blue">{t('workflowDesigner.metaTemplate.title')}</Tag>
                )}
              </div>
              <Button 
                type="text" 
                size="small"
                onClick={handleClear}
              >
                {t('common.clear')}
              </Button>
            </div>
          </div>
        )}
        
        {/* 模板變量配置 */}
        {templateData.templateId && (
          <div style={{ marginTop: 16 }}>
            <TemplateVariableConfig
              templateId={templateData.templateId}
              isMetaTemplate={templateData.isMetaTemplate}
              processVariables={processVariables}
              value={templateData.templateVariables || []}
              onChange={handleTemplateVariablesChange}
              t={t}
            />
          </div>
        )}
        
        {!templateData.templateId && (
          <div style={{ 
            textAlign: 'center', 
            padding: 20, 
            color: '#999',
            border: '1px dashed #d9d9d9',
            borderRadius: 6
          }}>
            {noTemplateSelectedText || t('workflowDesigner.timeValidator.noTemplateSelected')}
          </div>
        )}
      </div>
    );
  }

  // Input 模式（用於組件內）
  return (
    <>
      <Form.Item label={t('workflowDesigner.dataSet.template')}>
        <div style={{ position: 'relative' }}>
          <Input 
            value={templateData.templateName || ''}
            placeholder={t('workflowDesigner.selectTemplate')} 
            readOnly 
            onClick={handleTemplateClick}
            suffix={<FormOutlined />}
          />
          {templateData.templateId && (
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
                onClick={handleClear}
                style={{ padding: '0 4px', fontSize: '12px' }}
              >
                {t('workflowDesigner.clear')}
              </Button>
            </div>
          )}
        </div>
      </Form.Item>
      
      {templateData.templateId && (
        <Card size="small" title={t('workflowDesigner.templateInfo')} style={{ marginBottom: 16 }}>
          <p><strong>{t('workflowDesigner.templateId')}</strong>{templateData.templateId}</p>
          <p><strong>{t('workflowDesigner.templateName')}</strong>{templateData.templateName}</p>
          {templateData.isMetaTemplate && (
            <p>
              <Tag color="blue">{t('workflowDesigner.metaTemplate.title')}</Tag>
            </p>
          )}
        </Card>
      )}
      
      {/* 模板變數編輯 */}
      {templateData.templateId && (
        <TemplateVariableConfig
          templateId={templateData.templateId}
          isMetaTemplate={templateData.isMetaTemplate}
          processVariables={processVariables}
          fixedVariables={fixedVariables}
          value={templateData.templateVariables || []}
          onChange={handleTemplateVariablesChange}
          t={t}
        />
      )}
    </>
  );
};

export default TemplateTab;


