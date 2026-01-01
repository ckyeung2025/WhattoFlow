import React, { useState, useEffect } from 'react';
import { Card, Input, Button, Space, Divider, message } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { getDefaultComponent } from '../../utils/metaFlowUtils';
import ComponentRenderer from './ComponentRenderer';
import { useLanguage } from '../../contexts/LanguageContext';

const { TextArea } = Input;

const ScreenEditor = ({ screen, onUpdate, onComponentSelect, allScreens = [] }) => {
  const { t } = useLanguage();
  const [localScreen, setLocalScreen] = useState(screen);
  
  // 檢查並獲取 Body 顯示值（如果是默認值，返回翻譯後的默認值）
  const getBodyDisplayValue = () => {
    const bodyText = localScreen.data?.body?.text || '';
    const defaultBodyText = '請輸入內容';
    if (bodyText === defaultBodyText || bodyText === '') {
      // 如果是默認值或為空，顯示翻譯後的默認值
      return t('metaFlowBuilder.screenEditor.defaultValues.bodyText');
    }
    return bodyText;
  };
  
  // 檢查並獲取 Footer 顯示值（如果是默認值，返回翻譯後的默認值）
  const getFooterDisplayValue = () => {
    const footerText = localScreen.data?.footer?.text || '';
    const defaultFooterText = '提交';
    if (footerText === defaultFooterText || footerText === '') {
      // 如果是默認值或為空，顯示翻譯後的默認值
      return t('metaFlowBuilder.screenEditor.defaultValues.footerText');
    }
    return footerText;
  };
  
  // 檢查值是否為翻譯後的默認值
  const isTranslatedDefault = (value, defaultKey) => {
    const translatedDefault = t(defaultKey);
    return value === translatedDefault;
  };
  
  // 處理 Body 值變化
  const handleBodyChangeWithDefault = (value) => {
    // 如果用戶輸入的值等於翻譯後的默認值，或者為空，保存為硬編碼的默認值
    const translatedDefault = t('metaFlowBuilder.screenEditor.defaultValues.bodyText');
    if (!value || value.trim() === '' || value === translatedDefault) {
      handleBodyChange('請輸入內容');
    } else {
      handleBodyChange(value);
    }
  };
  
  // 處理 Footer 值變化
  const handleFooterChangeWithDefault = (value) => {
    // 如果用戶輸入的值等於翻譯後的默認值，或者為空，保存為硬編碼的默認值
    const translatedDefault = t('metaFlowBuilder.screenEditor.defaultValues.footerText');
    if (!value || value.trim() === '' || value === translatedDefault) {
      handleFooterChange('提交');
    } else {
      handleFooterChange(value);
    }
  };

  // 當 screen prop 改變時更新本地狀態
  useEffect(() => {
    setLocalScreen(screen);
  }, [screen]);

  // 更新本地狀態並通知父組件
  const updateScreen = (updates) => {
    const updated = { ...localScreen, ...updates };
    setLocalScreen(updated);
    console.log('📝 ScreenEditor updateScreen:', {
      screenId: updated.id,
      updates: updates,
      actionsCount: updated.data?.actions?.length || 0
    });
    onUpdate(updated);
  };

  // 更新 data 中的某個部分
  const updateData = (key, value) => {
    const newData = { ...localScreen.data, [key]: value };
    updateScreen({ data: newData });
  };

  // 處理拖放
  const handleDrop = (e) => {
    e.preventDefault();
    const componentType = e.dataTransfer.getData('application/metaflow-component');
    if (componentType) {
      handleAddComponent(componentType);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  // 添加組件
  const handleAddComponent = (componentType) => {
    const currentActions = localScreen.data?.actions || [];
    
    // 檢查 Image 組件數量限制（每個屏幕最多 3 張圖片）
    if (componentType === 'image') {
      const imageCount = currentActions.filter(action => action.type === 'image').length;
      if (imageCount >= 3) {
        message.error(t('metaFlowBuilder.screenEditor.messages.maxImagesError'));
        return;
      }
    }
    
    // 傳入現有組件列表，以便生成唯一的 name
    const newComponent = getDefaultComponent(componentType, null, currentActions);
    
    // 如果添加的是 RichText，需要移除 TextHeading 和 TextBody
    if (componentType === 'rich_text') {
      const updatedData = { ...localScreen.data };
      
      // 移除 Header（TextHeading）
      if (updatedData.header) {
        updatedData.header = null;
      }
      
      // 清空 Body（TextBody）
      if (updatedData.body) {
        updatedData.body = {
          type: 'body',
          text: ''
        };
      }
      
      // 更新 actions
      updatedData.actions = [...currentActions, newComponent];
      
      updateScreen({ data: updatedData });
      message.success(t('metaFlowBuilder.screenEditor.messages.addRichTextSuccess', { componentType }));
    } else {
      updateData('actions', [...currentActions, newComponent]);
      message.success(t('metaFlowBuilder.screenEditor.messages.addComponentSuccess', { componentType }));
    }
  };

  // 刪除組件
  const handleDeleteComponent = (componentId) => {
    const currentActions = localScreen.data?.actions || [];
    const componentToDelete = currentActions.find(comp => 
      (comp.id || comp.name) === componentId
    );
    
    // 如果刪除的是 RichText，需要恢復 TextHeading 和 TextBody
    if (componentToDelete?.type === 'rich_text') {
      const updatedData = { ...localScreen.data };
      
      // 恢復 Header（TextHeading）- 如果之前沒有，設置默認值
      if (!updatedData.header) {
        updatedData.header = {
          type: 'header',
          format: 'TEXT',
          text: t('metaFlowBuilder.screenEditor.defaultValues.headerText')
        };
      }
      
      // 恢復 Body（TextBody）- 如果為空，設置默認值
      if (!updatedData.body || !updatedData.body.text) {
        updatedData.body = {
          type: 'body',
          text: t('metaFlowBuilder.screenEditor.defaultValues.bodyText')
        };
      }
      
      // 移除 RichText 組件
      updatedData.actions = currentActions.filter(comp => 
        (comp.id || comp.name) !== componentId
      );
      
      updateScreen({ data: updatedData });
      message.success(t('metaFlowBuilder.screenEditor.messages.deleteRichTextSuccess'));
    } else {
      updateData('actions', currentActions.filter(comp => 
        (comp.id || comp.name) !== componentId
      ));
      message.success(t('metaFlowBuilder.screenEditor.messages.deleteComponentSuccess'));
    }
  };

  // 更新組件
  const handleUpdateComponent = (componentId, updates) => {
    const currentActions = localScreen.data?.actions || [];
    updateData('actions', currentActions.map(comp => 
      (comp.id || comp.name) === componentId ? { ...comp, ...updates } : comp
    ));
  };

  // 更新 Body
  const handleBodyChange = (text) => {
    updateData('body', {
      type: 'body',
      text: text
    });
  };

  // 更新 Footer
  const handleFooterChange = (text) => {
    // Footer 是必填項，如果為空則使用默認值（保存為中文 "提交"，顯示時會通過 getFooterDisplayValue 轉換）
    const footerText = text.trim() || '提交';
    updateData('footer', {
      type: 'footer',
      text: footerText
    });
  };

  // 更新 Header
  const handleHeaderChange = (field, value) => {
    const currentHeader = localScreen.data?.header || { type: 'header', format: 'TEXT' };
    updateData('header', {
      ...currentHeader,
      [field]: value
    });
  };

  return (
    <div 
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      style={{ minHeight: '100%' }}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {/* Header 編輯 */}
        {/* 如果存在 RichText 組件，隱藏 Header 和 Body 編輯器 */}
        {!localScreen.data?.actions?.some(comp => comp.type === 'rich_text') && (
        <Card size="small" title={t('metaFlowBuilder.screenEditor.cardTitles.header')}>
          <Space direction="vertical" style={{ width: '100%' }} size="small">
            <div>
              <label>{t('metaFlowBuilder.screenEditor.labels.headerType')}</label>
              <select
                value={localScreen.data?.header?.format || 'TEXT'}
                onChange={(e) => handleHeaderChange('format', e.target.value)}
                style={{ width: '100%', marginTop: '4px', padding: '4px' }}
              >
                <option value="TEXT">{t('metaFlowBuilder.screenEditor.selectOptions.headerTypes.text')}</option>
                <option value="IMAGE">{t('metaFlowBuilder.screenEditor.selectOptions.headerTypes.image')}</option>
                <option value="VIDEO">{t('metaFlowBuilder.screenEditor.selectOptions.headerTypes.video')}</option>
                <option value="DOCUMENT">{t('metaFlowBuilder.screenEditor.selectOptions.headerTypes.document')}</option>
              </select>
            </div>
            {localScreen.data?.header?.format === 'TEXT' && (
              <div>
                <label>{t('metaFlowBuilder.screenEditor.labels.headerText')}</label>
                <Input
                  value={localScreen.data?.header?.text || ''}
                  onChange={(e) => handleHeaderChange('text', e.target.value)}
                  placeholder={t('metaFlowBuilder.screenEditor.placeholders.headerText')}
                  style={{ marginTop: '4px' }}
                />
              </div>
            )}
            {(localScreen.data?.header?.format === 'IMAGE' || 
              localScreen.data?.header?.format === 'VIDEO' || 
              localScreen.data?.header?.format === 'DOCUMENT') && (
              <div>
                <label>{t('metaFlowBuilder.screenEditor.labels.mediaUrl')}</label>
                <Input
                  value={localScreen.data?.header?.media?.url || ''}
                  onChange={(e) => handleHeaderChange('media', { 
                    ...localScreen.data?.header?.media, 
                    url: e.target.value 
                  })}
                  placeholder={t('metaFlowBuilder.screenEditor.placeholders.mediaUrl')}
                  style={{ marginTop: '4px' }}
                />
              </div>
            )}
            {localScreen.data?.header && (
              <Button
                size="small"
                danger
                onClick={() => updateData('header', null)}
              >
                {t('metaFlowBuilder.screenEditor.buttons.removeHeader')}
              </Button>
            )}
            {!localScreen.data?.header && (
              <Button
                size="small"
                onClick={() => handleHeaderChange('format', 'TEXT')}
              >
                {t('metaFlowBuilder.screenEditor.buttons.addHeader')}
              </Button>
            )}
          </Space>
        </Card>
        )}

        {/* Body 編輯 */}
        {!localScreen.data?.actions?.some(comp => comp.type === 'rich_text') && (
        <Card size="small" title={t('metaFlowBuilder.screenEditor.cardTitles.body')}>
          <TextArea
            value={getBodyDisplayValue()}
            onChange={(e) => handleBodyChangeWithDefault(e.target.value)}
            placeholder={t('metaFlowBuilder.screenEditor.placeholders.bodyContent')}
            rows={4}
            style={{ marginTop: '4px' }}
          />
        </Card>
        )}

        {/* Footer 編輯 */}
        <Card size="small" title={t('metaFlowBuilder.screenEditor.cardTitles.footer')}>
          <Input
            value={getFooterDisplayValue()}
            onChange={(e) => handleFooterChangeWithDefault(e.target.value)}
            placeholder={t('metaFlowBuilder.screenEditor.placeholders.footerContent')}
            style={{ marginTop: '4px' }}
            maxLength={60}
            showCount
            required
          />
          <div style={{ fontSize: '12px', color: '#ff4d4f', marginTop: '4px' }}>
            {t('metaFlowBuilder.screenEditor.helperText.footerRequired')}
          </div>
        </Card>

        {/* Actions 編輯 */}
        <Card 
          size="small" 
          title={t('metaFlowBuilder.screenEditor.cardTitles.actions')}
          extra={
            <Button
              size="small"
              icon={<PlusOutlined />}
              onClick={() => {
                const componentType = prompt(t('metaFlowBuilder.screenEditor.placeholders.addComponent'));
                if (componentType) {
                  // 如果已經有 RichText，不允許添加其他組件（除了 Footer）
                  if (localScreen.data?.actions?.some(comp => comp.type === 'rich_text') && componentType !== 'rich_text') {
                    message.warning(t('metaFlowBuilder.screenEditor.messages.richTextConflict1'));
                    return;
                  }
                  // 如果添加其他組件，且已經有 RichText，提示並阻止
                  if (componentType !== 'rich_text' && localScreen.data?.actions?.some(comp => comp.type === 'rich_text')) {
                    message.warning(t('metaFlowBuilder.screenEditor.messages.richTextConflict2'));
                    return;
                  }
                  handleAddComponent(componentType);
                }
              }}
            >
              {t('metaFlowBuilder.screenEditor.buttons.addComponent')}
            </Button>
          }
        >
          <div style={{ 
            minHeight: '200px',
            padding: '12px',
            border: '2px dashed #d9d9d9',
            borderRadius: '4px',
            backgroundColor: '#fafafa'
          }}>
                {localScreen.data?.actions && localScreen.data.actions.length > 0 ? (
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                {localScreen.data.actions.map((component, index) => (
                  <div key={component.id || component.name || `component_${index}`}>
                    <div
                      onClick={(e) => {
                        // 如果點擊的是按鈕，不觸發選擇
                        if (e.target.closest('button')) {
                          return;
                        }
                        if (onComponentSelect) {
                          onComponentSelect(component);
                        }
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <ComponentRenderer
                        component={component}
                        onUpdate={(updates) => handleUpdateComponent(component.id || component.name, updates)}
                        onDelete={(e) => {
                          e?.stopPropagation();
                          handleDeleteComponent(component.id || component.name);
                        }}
                        onEdit={(comp) => {
                          if (onComponentSelect) {
                            onComponentSelect(comp);
                          }
                        }}
                        screenId={localScreen.id}
                        allScreens={allScreens}
                      />
                    </div>
                  </div>
                ))}
              </Space>
            ) : (
              <div style={{ 
                textAlign: 'center', 
                color: '#999', 
                padding: '40px 0',
                fontSize: '14px'
              }}>
                {t('metaFlowBuilder.screenEditor.placeholders.dropZone')}
              </div>
            )}
          </div>
        </Card>
      </Space>
    </div>
  );
};

export default ScreenEditor;

