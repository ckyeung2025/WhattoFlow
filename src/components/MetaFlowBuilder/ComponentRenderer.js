import React from 'react';
import { Card, Button, Space, Input, Select, Checkbox, Radio } from 'antd';
import { DeleteOutlined, EditOutlined } from '@ant-design/icons';
import ComponentPropertyEditor from './ComponentPropertyEditor';

const ComponentRenderer = ({ component, onUpdate, onDelete, onEdit, screenId, allScreens = [] }) => {
  const [editing, setEditing] = React.useState(false);

  // 渲染組件預覽
  const renderComponentPreview = () => {
    switch (component.type) {
      case 'button':
        return (
          <Button type="primary" style={{ width: '100%' }}>
            {component.title || '按鈕'}
          </Button>
        );
      
      case 'text_input':
        return (
          <Input
            // 注意：TextInput 不支持 placeholder，使用 label 作為提示
            disabled
            style={{ width: '100%' }}
            addonBefore={component.title || '文字輸入'}
          />
        );
      
      case 'rich_text':
        // RichText 使用 text 數組，支持 Markdown 語法
        const textArray = component.data?.text || [];
        return (
          <div style={{ 
            padding: '12px', 
            border: '1px solid #d9d9d9', 
            borderRadius: '4px',
            backgroundColor: '#fafafa',
            minHeight: '60px'
          }}>
            {textArray.length > 0 ? (
              <div style={{ whiteSpace: 'pre-wrap' }}>
                {textArray.map((line, index) => (
                  <div key={index}>{line}</div>
                ))}
              </div>
            ) : (
              <span style={{ color: '#999' }}>富文本內容（支持 Markdown）</span>
            )}
          </div>
        );
      
      case 'select':
        return (
          <Select
            placeholder={component.title || '下拉選擇'}
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
            placeholder={component.title || '日期選擇'}
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
            )) || <Checkbox disabled>選項</Checkbox>}
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
              )) || <Radio value="option1">選項</Radio>}
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
              <span style={{ color: '#999' }}>圖片</span>
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
                        <img src={previewUrl} alt={img['alt-text'] || `圖片 ${index + 1}`} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                      ) : (
                        <span style={{ color: '#999', fontSize: '12px' }}>圖片 {index + 1}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <span style={{ color: '#999' }}>請添加圖片（最少 1 張，最多 3 張）</span>
            )}
            {component.data?.['aspect-ratio'] && (
              <div style={{ marginTop: 8, fontSize: '12px', color: '#666' }}>
                寬高比: {component.data['aspect-ratio']}, 縮放: {component.data['scale-type'] || 'contain'}
              </div>
            )}
          </div>
        );
      
      default:
        return <div>{component.type || '未知組件'}</div>;
    }
  };

  if (editing) {
    return (
      <Card
        size="small"
        title={`編輯 ${component.type}`}
        extra={
          <Button size="small" onClick={() => setEditing(false)}>取消</Button>
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
          <span>{component.title || component.type || '組件'}</span>
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

