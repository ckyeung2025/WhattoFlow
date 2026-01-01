import React from 'react';
import { Card, Button, Space, Input, Select, Checkbox, Radio } from 'antd';
import { DeleteOutlined, EditOutlined } from '@ant-design/icons';
import ComponentPropertyEditor from './ComponentPropertyEditor';
import { useLanguage } from '../../contexts/LanguageContext';

const ComponentRenderer = ({ component, onUpdate, onDelete, onEdit, screenId, allScreens = [] }) => {
  const { t } = useLanguage();
  const [editing, setEditing] = React.useState(false);

  // 將組件 type 映射到翻譯鍵
  const getComponentLabel = (componentType) => {
    const typeToLabelKey = {
      'text_input': 'textInput',
      'date_picker': 'datePicker',
      'calendar_picker': 'calendarPicker',
      'select': 'select',
      'checkbox': 'checkbox',
      'radio': 'radio',
      'chips_selector': 'chipsSelector',
      'image': 'image',
      'image_carousel': 'imageCarousel',
      'photo_picker': 'photoPicker',
      'document_picker': 'documentPicker',
      'embedded_link': 'embeddedLink',
      'opt_in': 'optIn',
      'if': 'if',
      'switch': 'switch',
      'navigation_list': 'navigationList',
      'rich_text': 'richText',
      'button': 'button'
    };
    const labelKey = typeToLabelKey[componentType];
    if (labelKey) {
      return t(`metaFlowBuilder.componentPalette.componentLabels.${labelKey}`);
    }
    return componentType;
  };
  
  // 檢查 title 是否為默認值（硬編碼的中文）
  const isDefaultTitle = (title, componentType) => {
    const defaultTitles = {
      'text_input': '文字輸入',
      'date_picker': '日期選擇',
      'calendar_picker': '日曆選擇',
      'time_picker': '時間選擇',
      'select': '下拉選擇',
      'checkbox': '複選框組',
      'radio': '單選框組',
      'chips_selector': '小標籤選擇器',
      'image': '圖片',
      'image_carousel': '圖片輪播',
      'photo_picker': '照片選擇器',
      'document_picker': '文檔選擇器',
      'embedded_link': '嵌入式鏈接',
      'opt_in': '選擇加入',
      'if': '條件判斷 (If)',
      'switch': '條件渲染 (Switch)',
      'navigation_list': '導航列表',
      'rich_text': '富文本顯示',
      'button': '按鈕'
    };
    return title === defaultTitles[componentType];
  };
  
  // 獲取組件顯示標題（如果 title 是默認值，使用翻譯；否則使用用戶自定義的 title）
  const getComponentDisplayTitle = (comp) => {
    if (comp.title && !isDefaultTitle(comp.title, comp.type)) {
      return comp.title;
    }
    return getComponentLabel(comp.type);
  };
  
  // 檢查並轉換 Rich Text 的默認文本（如果是默認值，返回翻譯後的文本）
  const getRichTextDisplayContent = (textArray) => {
    if (!textArray || textArray.length === 0) {
      return [t('metaFlowBuilder.componentPropertyEditor.defaultValues.richTextDefault')];
    }
    
    // 檢查是否為默認值
    const defaultTexts = ['請輸入富文本內容', '支持 *粗體*、_斜體_、~刪除線~ 等 Markdown 語法'];
    const isDefaultContent = textArray.length === defaultTexts.length && 
      textArray.every((text, index) => text === defaultTexts[index]);
    
    if (isDefaultContent) {
      // 返回翻譯後的默認文本
      return [
        t('metaFlowBuilder.componentPropertyEditor.defaultValues.richTextDefault'),
        t('metaFlowBuilder.componentPropertyEditor.defaultValues.richTextDefaultLine2')
      ];
    }
    
    return textArray;
  };

  // 渲染組件預覽
  const renderComponentPreview = () => {
    switch (component.type) {
      case 'button':
        return (
          <Button type="primary" style={{ width: '100%' }}>
            {getComponentDisplayTitle(component) || t('metaFlowBuilder.componentRenderer.placeholders.button')}
          </Button>
        );
      
      case 'text_input':
        return (
          <Input
            // 注意：TextInput 不支持 placeholder，使用 label 作為提示
            disabled
            style={{ width: '100%' }}
            addonBefore={getComponentDisplayTitle(component) || t('metaFlowBuilder.componentRenderer.placeholders.textInput')}
          />
        );
      
      case 'rich_text':
        // RichText 使用 text 數組，支持 Markdown 語法
        const textArray = component.data?.text || [];
        const displayTextArray = getRichTextDisplayContent(textArray);
        return (
          <div style={{ 
            padding: '12px', 
            border: '1px solid #d9d9d9', 
            borderRadius: '4px',
            backgroundColor: '#fafafa',
            minHeight: '60px'
          }}>
            {displayTextArray.length > 0 ? (
              <div style={{ whiteSpace: 'pre-wrap' }}>
                {displayTextArray.map((line, index) => (
                  <div key={index}>{line}</div>
                ))}
              </div>
            ) : (
              <span style={{ color: '#999' }}>{t('metaFlowBuilder.componentRenderer.placeholders.richText')}</span>
            )}
          </div>
        );
      
      case 'select':
        return (
          <Select
            placeholder={getComponentDisplayTitle(component) || t('metaFlowBuilder.componentRenderer.placeholders.select')}
            disabled
            style={{ width: '100%' }}
            options={component.data?.options?.map(opt => ({
              label: opt.title || opt.text,
              value: opt.id || opt.value
            })) || []}
          />
        );
      
      case 'date_picker':
        return (
          <Input
            type="date"
            placeholder={getComponentDisplayTitle(component) || t('metaFlowBuilder.componentRenderer.placeholders.datePicker')}
            disabled
            style={{ width: '100%' }}
          />
        );
      
      case 'checkbox':
        return (
          <Space direction="vertical" style={{ width: '100%' }}>
            {component.data?.options?.map(opt => (
              <Checkbox key={opt.id || opt.value} disabled>
                {opt.title || opt.text}
              </Checkbox>
            )) || <Checkbox disabled>{t('metaFlowBuilder.componentRenderer.placeholders.option')}</Checkbox>}
          </Space>
        );
      
      case 'radio':
        return (
          <Radio.Group disabled>
            <Space direction="vertical">
              {component.data?.options?.map(opt => (
                <Radio key={opt.id || opt.value} value={opt.id || opt.value}>
                  {opt.title || opt.text}
                </Radio>
              )) || <Radio value="option1">{t('metaFlowBuilder.componentRenderer.placeholders.option')}</Radio>}
            </Space>
          </Radio.Group>
        );
      
      case 'image':
        return (
          <div style={{ 
            width: '100%', 
            height: '100px', 
            border: '1px dashed #d9d9d9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#fafafa'
          }}>
            {component.data?.url ? (
              <img src={component.data.url} alt="預覽" style={{ maxWidth: '100%', maxHeight: '100%' }} />
            ) : (
              <span style={{ color: '#999' }}>{t('metaFlowBuilder.componentRenderer.placeholders.image')}</span>
            )}
          </div>
        );
      
      case 'image_carousel':
        const carouselImages = component.data?.images || [];
        return (
          <div style={{ 
            padding: '12px', 
            border: '1px solid #d9d9d9', 
            borderRadius: '4px',
            backgroundColor: '#fafafa'
          }}>
            <div style={{ marginBottom: 8, fontWeight: 'bold' }}>圖片輪播 ({carouselImages.length}/3)</div>
            {carouselImages.length > 0 ? (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {carouselImages.map((img, index) => {
                  const previewUrl = img.url || (img.src ? `data:image/png;base64,${img.src}` : null);
                  return (
                    <div key={index} style={{ 
                      width: '80px', 
                      height: '60px', 
                      border: '1px solid #d9d9d9',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: '#fff',
                      overflow: 'hidden'
                    }}>
                      {previewUrl ? (
                        <img src={previewUrl} alt={img['alt-text'] || t('metaFlowBuilder.componentRenderer.placeholders.imageIndex', { index: index + 1 })} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                      ) : (
                        <span style={{ color: '#999', fontSize: '12px' }}>{t('metaFlowBuilder.componentRenderer.placeholders.imageIndex', { index: index + 1 })}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <span style={{ color: '#999' }}>{t('metaFlowBuilder.componentRenderer.placeholders.addImages')}</span>
            )}
            {component.data?.['aspect-ratio'] && (
              <div style={{ marginTop: 8, fontSize: '12px', color: '#666' }}>
                {t('metaFlowBuilder.componentRenderer.helperText.imageCarouselSettings', { aspectRatio: component.data['aspect-ratio'], scaleType: component.data['scale-type'] || 'contain' })}
              </div>
            )}
          </div>
        );
      
      default:
        return <div>{component.type || t('metaFlowBuilder.componentRenderer.placeholders.unknownComponent')}</div>;
    }
  };

  if (editing) {
    return (
      <Card
        size="small"
        title={t('metaFlowBuilder.componentRenderer.cardTitles.edit', { componentType: component.type })}
        extra={
          <Button size="small" onClick={() => setEditing(false)}>{t('metaFlowBuilder.componentRenderer.buttons.cancel')}</Button>
        }
      >
        <ComponentPropertyEditor
          component={component}
          onUpdate={(updates) => {
            onUpdate(updates);
            setEditing(false);
          }}
          screenId={screenId}
          allScreens={allScreens}
        />
      </Card>
    );
  }

  return (
    <Card
      size="small"
      title={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{getComponentDisplayTitle(component) || component.type || t('metaFlowBuilder.componentRenderer.placeholders.component')}</span>
          <Space>
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                if (onEdit) {
                  onEdit(component);
                } else {
                  setEditing(true);
                }
              }}
            />
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                onDelete && onDelete(e);
              }}
            />
          </Space>
        </div>
      }
    >
      {renderComponentPreview()}
    </Card>
  );
};

export default ComponentRenderer;

