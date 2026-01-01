import React, { useRef, useState } from 'react';
import { Input, Select, Button, Space, Form, InputNumber, Switch, Divider, Tooltip, Upload, message } from 'antd';
import { PlusOutlined, DeleteOutlined, BoldOutlined, ItalicOutlined, StrikethroughOutlined, CodeOutlined, UploadOutlined } from '@ant-design/icons';
import { useLanguage } from '../../contexts/LanguageContext';

const { TextArea } = Input;

const ComponentPropertyEditor = ({ component, onUpdate, screenId, allScreens = [] }) => {
  const { t } = useLanguage();
  const [form] = Form.useForm();
  const textAreaRef = useRef(null);
  const [imagePreview, setImagePreview] = useState(null);

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
      'video': '視頻',
      'navigation_list': '導航列表',
      'rich_text': '富文本顯示',
      'button': '按鈕'
    };
    return title === defaultTitles[componentType];
  };

  // 檢查 Rich Text 的 text 數組是否為默認值
  const isDefaultRichTextContent = (textArray) => {
    if (!textArray || !Array.isArray(textArray)) return false;
    const defaultTexts = ['請輸入富文本內容', '支持 *粗體*、_斜體_、~刪除線~ 等 Markdown 語法'];
    return textArray.length === defaultTexts.length && 
      textArray.every((text, index) => text === defaultTexts[index]);
  };

  React.useEffect(() => {
    // 先重置表單，清除之前組件的數據
    form.resetFields();
    
    // 如果 title 是默認值，則顯示為空字符串，讓用戶輸入自己的標題
    const displayTitle = (component.title && !isDefaultTitle(component.title, component.type)) 
      ? component.title 
      : '';
    
    const formValues = {
      id: component.id,
      name: component.name || component.id || '', // 添加 name 字段
      title: displayTitle,
      type: component.type,
      actionType: component.action?.type || 'navigate',
      actionNext: component.action?.next || '',
      actionPayload: component.action?.payload || '',
      actionMethod: component.action?.method || 'GET',
      actionEndpoint: component.action?.endpoint || ''
    };

    // 添加組件特定的 data 字段
    if (component.data) {
      // 對於 rich_text，將 text 數組轉換為字符串（用換行符連接）
      if (component.type === 'rich_text' && Array.isArray(component.data.text)) {
        // 如果 text 是默認值，則顯示為空字符串，讓用戶輸入自己的內容
        if (isDefaultRichTextContent(component.data.text)) {
          formValues.text = '';
        } else {
          formValues.text = component.data.text.join('\n');
        }
      } else {
        Object.assign(formValues, component.data);
      }
    }
    
    // 對於 image 組件，檢查是否有 base64 格式的 src 或 url，如果有則顯示預覽
    if (component.type === 'image') {
      // 優先使用 url（完整 data URL），如果沒有則從 src（純 base64）構建
      const previewUrl = component.data?.url || 
        (component.data?.src ? `data:image/png;base64,${component.data.src}` : null);
      setImagePreview(previewUrl);
    }

    // 處理 image_carousel 的 images
    if (component.type === 'image_carousel' && component.data?.images && Array.isArray(component.data.images)) {
      formValues.images = component.data.images.map(img => ({
        src: img.src || '',
        'alt-text': img['alt-text'] || img.alt || ''
      }));
      formValues['aspect-ratio'] = component.data['aspect-ratio'] || '4:3';
      formValues['scale-type'] = component.data['scale-type'] || 'contain';
    } else if (component.type === 'image_carousel') {
      formValues.images = [];
      formValues['aspect-ratio'] = '4:3';
      formValues['scale-type'] = 'contain';
    }

    // 處理 options（如果是數組）- 只處理當前組件類型支持的選項
    if ((component.type === 'select' || component.type === 'checkbox' || component.type === 'radio' || component.type === 'chips_selector') &&
        component.data?.options && Array.isArray(component.data.options)) {
      formValues.options = component.data.options.map(opt => ({
        id: opt.id || opt.value,
        title: opt.title || opt.text || ''
      }));
    } else {
      // 如果當前組件不支持選項，確保 options 為空數組
      formValues.options = [];
    }

    form.setFieldsValue(formValues);
  }, [component, form]);

  const handleFinish = (values) => {
    // 如果用戶沒有輸入 title（為空），則使用原來的 title（可能是默認值）
    // 如果用戶輸入了 title，則使用用戶輸入的值
    const finalTitle = values.title && values.title.trim() 
      ? values.title.trim() 
      : (component.title || '');
    
    const updates = {
      id: values.id,
      name: values.name || values.id || component.name || component.id, // 保存 name 字段
      title: finalTitle,
      type: values.type || component.type,
      data: {},
      action: {
        type: values.actionType || 'navigate',
        next: values.actionNext || '',
        payload: values.actionPayload || '',
        method: values.actionMethod || 'GET',
        endpoint: values.actionEndpoint || ''
      }
    };

    // 根據組件類型處理 data
    switch (component.type) {
      case 'text_input':
        updates.data = {
          input_type: values.input_type || 'text',
          // 注意：TextInput 不支持 placeholder
          required: values.required || false,
          pattern: values.pattern || '',
          helper_text: values.helper_text || ''
        };
        break;
      
      case 'rich_text':
        // RichText 使用 text 數組，支持 Markdown 語法
        // 將字符串按換行符分割為數組
        const textString = values.text || '';
        const textArray = textString.split('\n').filter(line => line.trim() !== '' || line === '');
        // 如果用戶沒有輸入內容（為空），且原來的內容是默認值，則保留原來的默認值
        // 如果用戶輸入了內容，則使用用戶輸入的內容
        if (textArray.length === 0 || (textArray.length === 1 && textArray[0].trim() === '')) {
          // 如果原來是默認值，保留原來的默認值
          if (component.data?.text && isDefaultRichTextContent(component.data.text)) {
            updates.data = {
              text: component.data.text
            };
          } else {
            // 否則使用翻譯後的默認值（用於新組件）
            updates.data = {
              text: [t('metaFlowBuilder.componentPropertyEditor.defaultValues.richTextDefault')]
            };
          }
        } else {
          updates.data = {
            text: textArray
          };
        }
        break;
      
      case 'select':
      case 'checkbox':
      case 'radio':
        updates.data = {
          options: values.options || []
        };
        break;
      
      case 'chips_selector':
        updates.data = {
          options: values.options || [],
          max_selected_items: values.max_selected_items,
          description: values.description || ''
        };
        break;
      
      case 'image':
        // 處理 base64 字符串
        // 如果 url 是完整 data URL，提取純 base64；否則直接使用 src
        let imageSrc = values.src || '';
        let dataUrlForPreview = values.url || '';
        
        // 如果 url 是完整 data URL，提取純 base64
        if (dataUrlForPreview.startsWith('data:image/')) {
          imageSrc = dataUrlForPreview.includes(',') ? dataUrlForPreview.split(',')[1] : '';
        } else if (!imageSrc && dataUrlForPreview) {
          // 如果 url 不是 data URL 但 src 為空，使用 url
          imageSrc = dataUrlForPreview;
        }
        
        // 如果沒有完整 data URL，從純 base64 構建（用於預覽）
        if (!dataUrlForPreview.startsWith('data:image/') && imageSrc) {
          dataUrlForPreview = `data:image/png;base64,${imageSrc}`;
        }
        
        updates.data = {
          url: dataUrlForPreview, // 完整 data URL 用於編輯器預覽
          src: imageSrc, // 純 base64 字符串用於 JSON 生成（符合官方文檔）
          width: values.width,
          height: values.height
        };
        break;
      
      case 'image_carousel':
        // 處理圖片輪播：每個圖片需要 src (base64) 和 alt-text
        const carouselImages = (values.images || []).map(img => {
          let imgSrc = img.src || '';
          // 如果 src 是完整 data URL，提取純 base64
          if (imgSrc.startsWith('data:image/')) {
            imgSrc = imgSrc.includes(',') ? imgSrc.split(',')[1] : '';
          }
          return {
            src: imgSrc,
            'alt-text': img['alt-text'] || img.alt || ''
          };
        });
        
        updates.data = {
          images: carouselImages,
          'aspect-ratio': values['aspect-ratio'] || '4:3',
          'scale-type': values['scale-type'] || 'contain'
        };
        break;
      
      default:
        updates.data = component.data || {};
    }

    onUpdate(updates);
  };

  const renderTypeSpecificFields = () => {
    switch (component.type) {
      case 'text_input':
        return (
          <>
            <Form.Item label={t('metaFlowBuilder.componentPropertyEditor.labels.inputType')} name="input_type">
              <Select>
                <Select.Option value="text">{t('metaFlowBuilder.componentPropertyEditor.selectOptions.inputTypes.text')}</Select.Option>
                <Select.Option value="email">{t('metaFlowBuilder.componentPropertyEditor.selectOptions.inputTypes.email')}</Select.Option>
                <Select.Option value="phone">{t('metaFlowBuilder.componentPropertyEditor.selectOptions.inputTypes.phone')}</Select.Option>
                <Select.Option value="number">{t('metaFlowBuilder.componentPropertyEditor.selectOptions.inputTypes.number')}</Select.Option>
                <Select.Option value="url">{t('metaFlowBuilder.componentPropertyEditor.selectOptions.inputTypes.url')}</Select.Option>
              </Select>
            </Form.Item>
            {/* 注意：TextInput 不支持 placeholder */}
            <Form.Item label={t('metaFlowBuilder.componentPropertyEditor.labels.required')} name="required" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item label={t('metaFlowBuilder.componentPropertyEditor.labels.validationPattern')} name="pattern">
              <Input placeholder={t('metaFlowBuilder.componentPropertyEditor.placeholders.patternExample')} />
            </Form.Item>
            <Form.Item label={t('metaFlowBuilder.componentPropertyEditor.labels.helperText')} name="helper_text">
              <Input placeholder={t('metaFlowBuilder.componentPropertyEditor.placeholders.helperTextHint')} />
            </Form.Item>
          </>
        );
      
      case 'rich_text':
        // 格式化文本函数
        const applyFormat = (formatType) => {
          const textArea = textAreaRef.current?.resizableTextArea?.textArea;
          if (!textArea) {
            return;
          }

          const start = textArea.selectionStart;
          const end = textArea.selectionEnd;
          const currentValue = form.getFieldValue('text') || '';
          
          // 如果没有选中文字，提示用户
          if (start === end) {
            return;
          }

          const selectedText = currentValue.substring(start, end);
          let formattedText = '';

          switch (formatType) {
            case 'bold':
              formattedText = `**${selectedText}**`;
              break;
            case 'italic':
              formattedText = `*${selectedText}*`;
              break;
            case 'strikethrough':
              formattedText = `~~${selectedText}~~`;
              break;
            case 'code':
              formattedText = `\`${selectedText}\``;
              break;
            case 'heading1':
              formattedText = `# ${selectedText}`;
              break;
            case 'heading2':
              formattedText = `## ${selectedText}`;
              break;
            case 'list':
              // 将选中文本按行分割，每行前加 "- "
              formattedText = selectedText.split('\n').map(line => `- ${line}`).join('\n');
              break;
            case 'link':
              formattedText = `[${selectedText}](URL)`;
              break;
            default:
              formattedText = selectedText;
          }

          const newValue = currentValue.substring(0, start) + formattedText + currentValue.substring(end);
          form.setFieldsValue({ text: newValue });
          
          // 恢复光标位置
          setTimeout(() => {
            if (textArea) {
              const newCursorPos = start + formattedText.length;
              textArea.setSelectionRange(newCursorPos, newCursorPos);
              textArea.focus();
            }
          }, 0);
        };

        return (
          <>
            <div style={{ marginBottom: 8 }}>
              <Space size="small" style={{ 
                padding: '8px 12px', 
                background: '#fafafa', 
                borderRadius: 4,
                border: '1px solid #d9d9d9',
                width: '100%',
                flexWrap: 'wrap'
              }}>
                <Tooltip title={t('metaFlowBuilder.componentPropertyEditor.tooltips.bold')}>
                  <Button
                    size="small"
                    icon={<BoldOutlined />}
                    onClick={() => applyFormat('bold')}
                  />
                </Tooltip>
                <Tooltip title={t('metaFlowBuilder.componentPropertyEditor.tooltips.italic')}>
                  <Button
                    size="small"
                    icon={<ItalicOutlined />}
                    onClick={() => applyFormat('italic')}
                  />
                </Tooltip>
                <Tooltip title={t('metaFlowBuilder.componentPropertyEditor.tooltips.strikethrough')}>
                  <Button
                    size="small"
                    icon={<StrikethroughOutlined />}
                    onClick={() => applyFormat('strikethrough')}
                  />
                </Tooltip>
                <Tooltip title={t('metaFlowBuilder.componentPropertyEditor.tooltips.code')}>
                  <Button
                    size="small"
                    icon={<CodeOutlined />}
                    onClick={() => applyFormat('code')}
                  />
                </Tooltip>
                <Divider type="vertical" />
                <Tooltip title={t('metaFlowBuilder.componentPropertyEditor.tooltips.heading1')}>
                  <Button
                    size="small"
                    onClick={() => applyFormat('heading1')}
                  >
                    H1
                  </Button>
                </Tooltip>
                <Tooltip title={t('metaFlowBuilder.componentPropertyEditor.tooltips.heading2')}>
                  <Button
                    size="small"
                    onClick={() => applyFormat('heading2')}
                  >
                    H2
                  </Button>
                </Tooltip>
                <Divider type="vertical" />
                <Tooltip title={t('metaFlowBuilder.componentPropertyEditor.tooltips.list')}>
                  <Button
                    size="small"
                    onClick={() => applyFormat('list')}
                  >
                    {t('metaFlowBuilder.componentPropertyEditor.buttons.list')}
                  </Button>
                </Tooltip>
                <Tooltip title={t('metaFlowBuilder.componentPropertyEditor.tooltips.link')}>
                  <Button
                    size="small"
                    onClick={() => applyFormat('link')}
                  >
                    {t('metaFlowBuilder.componentPropertyEditor.buttons.link')}
                  </Button>
                </Tooltip>
              </Space>
            </div>
            <Form.Item 
              label={t('metaFlowBuilder.componentPropertyEditor.labels.richTextContent')} 
              name="text"
              tooltip={t('metaFlowBuilder.componentPropertyEditor.tooltips.richTextHint')}
            >
              <TextArea 
                ref={textAreaRef}
                rows={8} 
                placeholder={t('metaFlowBuilder.componentPropertyEditor.placeholders.richTextContentHint')}
                style={{ fontFamily: 'monospace' }}
              />
            </Form.Item>
            <div style={{ fontSize: '12px', color: '#8c8c8c', marginTop: '-12px', marginBottom: '12px' }}>
              {t('metaFlowBuilder.componentPropertyEditor.helperText.richTextHint')}
            </div>
          </>
        );
      
      case 'select':
      case 'checkbox':
      case 'radio':
      case 'chips_selector':
        return (
          <>
            <Form.Item label={t('metaFlowBuilder.componentPropertyEditor.labels.options')} name="options">
              <Form.List name="options">
                {(fields, { add, remove }) => (
                  <>
                    {fields.map(({ key, name, ...restField }) => (
                      <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                        <Form.Item
                          {...restField}
                          name={[name, 'id']}
                          rules={[{ required: true, message: t('metaFlowBuilder.componentPropertyEditor.messages.optionIdRequired') }]}
                        >
                          <Input placeholder={t('metaFlowBuilder.componentPropertyEditor.placeholders.optionId')} />
                        </Form.Item>
                        <Form.Item
                          {...restField}
                          name={[name, 'title']}
                          rules={[{ required: true, message: t('metaFlowBuilder.componentPropertyEditor.messages.optionTitleRequired') }]}
                        >
                          <Input placeholder={t('metaFlowBuilder.componentPropertyEditor.placeholders.optionTitle')} />
                        </Form.Item>
                        <DeleteOutlined onClick={() => remove(name)} />
                      </Space>
                    ))}
                    <Form.Item>
                      <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                        {t('metaFlowBuilder.componentPropertyEditor.buttons.addOption')}
                      </Button>
                    </Form.Item>
                  </>
                )}
              </Form.List>
            </Form.Item>
            {component.type === 'chips_selector' && (
              <>
                <Form.Item label={t('metaFlowBuilder.componentPropertyEditor.labels.maxSelectedItems')} name="max_selected_items">
                  <InputNumber min={1} max={20} placeholder={t('metaFlowBuilder.componentPropertyEditor.placeholders.maxSelectedItemsExample')} />
                </Form.Item>
                <Form.Item label={t('metaFlowBuilder.componentPropertyEditor.labels.description')} name="description">
                  <Input.TextArea rows={2} placeholder={t('metaFlowBuilder.componentPropertyEditor.placeholders.descriptionHint')} />
                </Form.Item>
              </>
            )}
          </>
        );
      
      case 'image':
        // 圖片上傳處理函數
        const handleImageUpload = (file) => {
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              const dataUrl = e.target.result; // 完整的 data URL，用於預覽
              // 提取純 base64 字符串（移除 data:image/xxx;base64, 前綴）
              // 根據官方文檔，src 應該是純 base64 字符串
              const base64Only = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
              
              // 更新表單字段
              // url 保存完整 data URL（用於預覽），src 保存純 base64（用於 JSON 生成）
              form.setFieldsValue({ 
                url: dataUrl, // 完整 data URL 用於預覽
                src: base64Only // 純 base64 字符串用於 JSON
              });
              // 顯示預覽（使用完整 data URL）
              setImagePreview(dataUrl);
              resolve(base64Only);
            };
            reader.onerror = (error) => {
              message.error('圖片讀取失敗');
              reject(error);
            };
            reader.readAsDataURL(file);
          });
        };
        
        const beforeUpload = (file) => {
          // 檢查文件格式（只支持 JPEG 和 PNG）
          const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
          if (!allowedTypes.includes(file.type.toLowerCase())) {
            message.error(t('metaFlowBuilder.componentPropertyEditor.messages.imageFormatError'));
            return Upload.LIST_IGNORE;
          }
          
          // 檢查文件大小（推薦 300kb，最大限制 1MB 以符合總 payload 限制）
          const fileSizeKB = file.size / 1024;
          const maxSizeKB = 1000; // 1MB = 1000KB（總 payload 限制）
          const recommendedSizeKB = 300; // 推薦大小
          
          if (fileSizeKB > maxSizeKB) {
            message.error(t('metaFlowBuilder.componentPropertyEditor.messages.imageSizeExceeded', { maxSizeKB }));
            return Upload.LIST_IGNORE;
          }
          
          if (fileSizeKB > recommendedSizeKB) {
            message.warning(t('metaFlowBuilder.componentPropertyEditor.messages.imageSizeWarning', { fileSizeKB: Math.round(fileSizeKB) }));
          }
          
          // 手動處理上傳
          handleImageUpload(file);
          return false; // 阻止自動上傳
        };
        
        const handleRemove = () => {
          form.setFieldsValue({ url: '', src: '' });
          setImagePreview(null);
        };
        
        return (
          <>
            <Form.Item 
              label={t('metaFlowBuilder.componentPropertyEditor.labels.image')} 
              name="url" 
              tooltip={t('metaFlowBuilder.componentPropertyEditor.tooltips.imageUpload')}
            >
              <Upload
                name="image"
                listType="picture-card"
                showUploadList={false}
                beforeUpload={beforeUpload}
                accept="image/*"
                maxCount={1}
              >
                {imagePreview ? (
                  <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                    <img 
                      src={imagePreview} 
                      alt={t('metaFlowBuilder.componentRenderer.altText.preview')} 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemove();
                      }}
                      style={{
                        position: 'absolute',
                        top: 0,
                        right: 0,
                        background: 'rgba(0,0,0,0.5)',
                        color: 'white'
                      }}
                    >
                      {t('metaFlowBuilder.componentPropertyEditor.buttons.remove')}
                    </Button>
                  </div>
                ) : (
                  <div>
                    <UploadOutlined />
                    <div style={{ marginTop: 8 }}>{t('metaFlowBuilder.componentPropertyEditor.buttons.uploadImage')}</div>
                  </div>
                )}
              </Upload>
            </Form.Item>
            {imagePreview && (
              <div style={{ marginBottom: 16, fontSize: '12px', color: '#8c8c8c' }}>
                {t('metaFlowBuilder.componentPropertyEditor.helperText.imageConverted')}
              </div>
            )}
            <Form.Item label={t('metaFlowBuilder.componentPropertyEditor.labels.width')} name="width">
              <InputNumber min={1} placeholder={t('metaFlowBuilder.componentPropertyEditor.placeholders.widthHeightExample')} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label={t('metaFlowBuilder.componentPropertyEditor.labels.height')} name="height">
              <InputNumber min={1} placeholder={t('metaFlowBuilder.componentPropertyEditor.placeholders.widthHeightExample')} style={{ width: '100%' }} />
            </Form.Item>
          </>
        );
      
      case 'image_carousel':
        // 圖片輪播上傳處理函數（參考 image 控件的 base64 方法）
        const handleCarouselImageUpload = (file, imageIndex) => {
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              const dataUrl = e.target.result; // 完整的 data URL，用於預覽
              // 提取純 base64 字符串（移除 data:image/xxx;base64, 前綴）
              const base64Only = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
              
              // 更新對應的圖片項
              const currentImages = form.getFieldValue('images') || [];
              currentImages[imageIndex] = {
                ...currentImages[imageIndex],
                src: base64Only, // 純 base64 字符串用於 JSON 生成
                url: dataUrl, // 完整 data URL 用於預覽
                'alt-text': currentImages[imageIndex]?.['alt-text'] || t('metaFlowBuilder.componentPropertyEditor.defaultValues.imageAltDefault', { index: imageIndex + 1 })
              };
              form.setFieldsValue({ images: currentImages });
              resolve(base64Only);
            };
            reader.onerror = (error) => {
              message.error('圖片讀取失敗');
              reject(error);
            };
            reader.readAsDataURL(file);
          });
        };
        
        const beforeCarouselUpload = (file, imageIndex) => {
          // 檢查文件格式（只支持 JPEG 和 PNG）
          const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
          if (!allowedTypes.includes(file.type.toLowerCase())) {
            message.error(t('metaFlowBuilder.componentPropertyEditor.messages.imageFormatError'));
            return Upload.LIST_IGNORE;
          }
          
          // 檢查文件大小（推薦 300kb，最大限制 1MB）
          const fileSizeKB = file.size / 1024;
          const maxSizeKB = 1000; // 1MB = 1000KB
          const recommendedSizeKB = 300; // 推薦大小
          
          if (fileSizeKB > maxSizeKB) {
            message.error(t('metaFlowBuilder.componentPropertyEditor.messages.imageSizeExceeded', { maxSizeKB }));
            return Upload.LIST_IGNORE;
          }
          
          if (fileSizeKB > recommendedSizeKB) {
            message.warning(t('metaFlowBuilder.componentPropertyEditor.messages.imageSizeWarning', { fileSizeKB: Math.round(fileSizeKB) }));
          }
          
          // 手動處理上傳
          handleCarouselImageUpload(file, imageIndex);
          return false; // 阻止自動上傳
        };
        
        return (
          <>
            <Form.Item label={t('metaFlowBuilder.componentPropertyEditor.labels.imageList')} name="images">
              <Form.List name="images">
                {(fields, { add, remove }) => (
                  <>
                    {fields.map(({ key, name, ...restField }) => {
                      const imageData = form.getFieldValue(['images', name]);
                      const previewUrl = imageData?.url || (imageData?.src ? `data:image/png;base64,${imageData.src}` : null);
                      
                      return (
                        <div key={key} style={{ marginBottom: 16, padding: 12, border: '1px solid #d9d9d9', borderRadius: 4 }}>
                          <Space direction="vertical" style={{ width: '100%' }} size="middle">
                            <Form.Item
                              {...restField}
                              name={[name, 'alt-text']}
                              label={t('metaFlowBuilder.componentPropertyEditor.labels.altText')}
                              rules={[{ required: true, message: t('metaFlowBuilder.componentPropertyEditor.messages.altTextRequired') }]}
                            >
                              <Input placeholder={t('metaFlowBuilder.componentPropertyEditor.placeholders.altTextHint')} />
                            </Form.Item>
                            <Form.Item label={t('metaFlowBuilder.componentPropertyEditor.labels.image')}>
                              <Upload
                                name="image"
                                listType="picture-card"
                                showUploadList={false}
                                beforeUpload={(file) => beforeCarouselUpload(file, name)}
                                accept="image/*"
                                maxCount={1}
                              >
                                {previewUrl ? (
                                  <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                                    <img 
                                      src={previewUrl} 
                                      alt={imageData?.['alt-text'] || t('metaFlowBuilder.componentPropertyEditor.defaultValues.imageAltDefault', { index: name + 1 })} 
                                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                    <Button
                                      type="text"
                                      danger
                                      icon={<DeleteOutlined />}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const currentImages = form.getFieldValue('images') || [];
                                        currentImages[name] = { ...currentImages[name], src: '', url: '', 'alt-text': currentImages[name]?.['alt-text'] || '' };
                                        form.setFieldsValue({ images: currentImages });
                                      }}
                                      style={{
                                        position: 'absolute',
                                        top: 0,
                                        right: 0,
                                        background: 'rgba(0,0,0,0.5)',
                                        color: 'white'
                                      }}
                                    >
                                      {t('metaFlowBuilder.componentPropertyEditor.buttons.remove')}
                                    </Button>
                                  </div>
                                ) : (
                                  <div>
                                    <UploadOutlined />
                                    <div style={{ marginTop: 8 }}>{t('metaFlowBuilder.componentPropertyEditor.buttons.uploadImage')}</div>
                                  </div>
                                )}
                              </Upload>
                            </Form.Item>
                            <Button 
                              type="link" 
                              danger 
                              onClick={() => remove(name)} 
                              icon={<DeleteOutlined />}
                              block
                            >
                              {t('metaFlowBuilder.componentPropertyEditor.buttons.deleteImage')}
                            </Button>
                          </Space>
                        </div>
                      );
                    })}
                    <Form.Item>
                      <Button 
                        type="dashed" 
                        onClick={() => {
                          const currentCount = fields.length;
                          if (currentCount >= 3) {
                            message.warning(t('metaFlowBuilder.componentPropertyEditor.messages.maxImagesWarning'));
                            return;
                          }
                          add({ src: '', url: '', 'alt-text': t('metaFlowBuilder.componentPropertyEditor.defaultValues.imageAltDefault', { index: currentCount + 1 }) });
                        }} 
                        block 
                        icon={<PlusOutlined />}
                        disabled={fields.length >= 3}
                      >
                        {t('metaFlowBuilder.componentPropertyEditor.buttons.addImage')} {fields.length >= 3 ? '(已達上限)' : `(${fields.length}/3)`}
                      </Button>
                    </Form.Item>
                  </>
                )}
              </Form.List>
            </Form.Item>
            <Form.Item label={t('metaFlowBuilder.componentPropertyEditor.labels.aspectRatio')} name="aspect-ratio">
              <Select>
                <Select.Option value="4:3">4:3</Select.Option>
                <Select.Option value="16:9">16:9</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item label={t('metaFlowBuilder.componentPropertyEditor.labels.scaleType')} name="scale-type">
              <Select>
                <Select.Option value="contain">{t('metaFlowBuilder.componentPropertyEditor.selectOptions.scaleTypes.contain')}</Select.Option>
                <Select.Option value="cover">{t('metaFlowBuilder.componentPropertyEditor.selectOptions.scaleTypes.cover')}</Select.Option>
              </Select>
            </Form.Item>
          </>
        );
      
      default:
        return null;
    }
  };

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleFinish}
      initialValues={component}
    >
      <Form.Item label={t('metaFlowBuilder.componentPropertyEditor.labels.componentId')} name="id">
        <Input disabled />
      </Form.Item>
      
      {/* 對於需要 name 字段的組件，顯示 name 編輯框 */}
      {['text_input', 'select', 'checkbox', 'radio', 'chips_selector', 
        'date_picker', 'calendar_picker', 'time_picker', 
        'photo_picker', 'document_picker'].includes(component.type) && (
        <Form.Item 
          label={t('metaFlowBuilder.componentPropertyEditor.labels.fieldName')} 
          name="name"
          tooltip={t('metaFlowBuilder.componentPropertyEditor.tooltips.fieldNameHint')}
          rules={[
            { required: true, message: t('metaFlowBuilder.componentPropertyEditor.messages.fieldNameRequired') },
            { pattern: /^[a-zA-Z][a-zA-Z0-9_]*$/, message: t('metaFlowBuilder.componentPropertyEditor.messages.fieldNamePattern') }
          ]}
        >
          <Input placeholder={t('metaFlowBuilder.componentPropertyEditor.placeholders.fieldNameExample')} />
        </Form.Item>
      )}
      
      <Form.Item label={t('metaFlowBuilder.componentPropertyEditor.labels.title')} name="title" rules={[{ required: true, message: t('metaFlowBuilder.componentPropertyEditor.messages.titleRequired') }]}>
        <Input />
      </Form.Item>

      {renderTypeSpecificFields()}

      <Divider>{t('metaFlowBuilder.componentPropertyEditor.dividers.actionSettings')}</Divider>

      <Form.Item label={t('metaFlowBuilder.componentPropertyEditor.labels.actionType')} name="actionType">
        <Select>
          <Select.Option value="navigate">{t('metaFlowBuilder.componentPropertyEditor.selectOptions.actionTypes.navigate')}</Select.Option>
          <Select.Option value="submit">{t('metaFlowBuilder.componentPropertyEditor.selectOptions.actionTypes.submit')}</Select.Option>
          <Select.Option value="call">{t('metaFlowBuilder.componentPropertyEditor.selectOptions.actionTypes.call')}</Select.Option>
          <Select.Option value="url">{t('metaFlowBuilder.componentPropertyEditor.selectOptions.actionTypes.url')}</Select.Option>
        </Select>
      </Form.Item>

      <Form.Item 
        label={t('metaFlowBuilder.componentPropertyEditor.labels.targetScreen')} 
        name="actionNext"
        tooltip={t('metaFlowBuilder.componentPropertyEditor.tooltips.targetScreenHint')}
      >
        <Select placeholder={t('metaFlowBuilder.componentPropertyEditor.placeholders.selectScreen')}>
          {allScreens.map(screen => (
            <Select.Option key={screen.id} value={screen.id}>
              {screen.title || screen.id}
            </Select.Option>
          ))}
        </Select>
      </Form.Item>

      <Form.Item label={t('metaFlowBuilder.componentPropertyEditor.labels.payload')} name="actionPayload">
        <TextArea rows={2} placeholder={t('metaFlowBuilder.componentPropertyEditor.placeholders.payloadHint')} />
      </Form.Item>

      <Form.Item label={t('metaFlowBuilder.componentPropertyEditor.labels.httpMethod')} name="actionMethod">
        <Select>
          <Select.Option value="GET">{t('metaFlowBuilder.componentPropertyEditor.selectOptions.httpMethods.get')}</Select.Option>
          <Select.Option value="POST">{t('metaFlowBuilder.componentPropertyEditor.selectOptions.httpMethods.post')}</Select.Option>
          <Select.Option value="PUT">{t('metaFlowBuilder.componentPropertyEditor.selectOptions.httpMethods.put')}</Select.Option>
          <Select.Option value="DELETE">{t('metaFlowBuilder.componentPropertyEditor.selectOptions.httpMethods.delete')}</Select.Option>
        </Select>
      </Form.Item>

      <Form.Item label={t('metaFlowBuilder.componentPropertyEditor.labels.endpointUrl')} name="actionEndpoint">
        <Input placeholder={t('metaFlowBuilder.componentPropertyEditor.placeholders.endpointUrlHint')} />
      </Form.Item>

      <Form.Item>
        <Button type="primary" htmlType="submit" block>
          {t('metaFlowBuilder.componentPropertyEditor.buttons.saveChanges')}
        </Button>
      </Form.Item>
    </Form>
  );
};

export default ComponentPropertyEditor;

