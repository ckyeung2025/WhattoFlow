import React, { useRef, useState } from 'react';
import { Input, Select, Button, Space, Form, InputNumber, Switch, Divider, Tooltip, Upload, message } from 'antd';
import { PlusOutlined, DeleteOutlined, BoldOutlined, ItalicOutlined, StrikethroughOutlined, CodeOutlined, UploadOutlined } from '@ant-design/icons';

const { TextArea } = Input;

const ComponentPropertyEditor = ({ component, onUpdate, screenId, allScreens = [] }) => {
  const [form] = Form.useForm();
  const textAreaRef = useRef(null);
  const [imagePreview, setImagePreview] = useState(null);

  React.useEffect(() => {
    // 先重置表單，清除之前組件的數據
    form.resetFields();
    
    const formValues = {
      id: component.id,
      title: component.title || '',
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
        formValues.text = component.data.text.join('\n');
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
    const updates = {
      id: values.id,
      title: values.title,
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
        updates.data = {
          text: textArray.length > 0 ? textArray : ['請輸入富文本內容']
        };
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
            <Form.Item label="輸入類型" name="input_type">
              <Select>
                <Select.Option value="text">文字</Select.Option>
                <Select.Option value="email">電子郵件</Select.Option>
                <Select.Option value="phone">電話</Select.Option>
                <Select.Option value="number">數字</Select.Option>
                <Select.Option value="url">URL</Select.Option>
              </Select>
            </Form.Item>
            {/* 注意：TextInput 不支持 placeholder */}
            <Form.Item label="必填" name="required" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item label="驗證模式 (Pattern)" name="pattern">
              <Input placeholder="例如: [0-9]+" />
            </Form.Item>
            <Form.Item label="幫助文字" name="helper_text">
              <Input placeholder="顯示在輸入框下方的提示文字" />
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
                <Tooltip title="粗體 (**文字**)">
                  <Button
                    size="small"
                    icon={<BoldOutlined />}
                    onClick={() => applyFormat('bold')}
                  />
                </Tooltip>
                <Tooltip title="斜體 (*文字*)">
                  <Button
                    size="small"
                    icon={<ItalicOutlined />}
                    onClick={() => applyFormat('italic')}
                  />
                </Tooltip>
                <Tooltip title="刪除線 (~~文字~~)">
                  <Button
                    size="small"
                    icon={<StrikethroughOutlined />}
                    onClick={() => applyFormat('strikethrough')}
                  />
                </Tooltip>
                <Tooltip title="行內代碼 (`代碼`)">
                  <Button
                    size="small"
                    icon={<CodeOutlined />}
                    onClick={() => applyFormat('code')}
                  />
                </Tooltip>
                <Divider type="vertical" />
                <Tooltip title="標題 1 (# 標題)">
                  <Button
                    size="small"
                    onClick={() => applyFormat('heading1')}
                  >
                    H1
                  </Button>
                </Tooltip>
                <Tooltip title="標題 2 (## 標題)">
                  <Button
                    size="small"
                    onClick={() => applyFormat('heading2')}
                  >
                    H2
                  </Button>
                </Tooltip>
                <Divider type="vertical" />
                <Tooltip title="無序列表 (- 項目)">
                  <Button
                    size="small"
                    onClick={() => applyFormat('list')}
                  >
                    列表
                  </Button>
                </Tooltip>
                <Tooltip title="鏈接 ([文字](URL))">
                  <Button
                    size="small"
                    onClick={() => applyFormat('link')}
                  >
                    鏈接
                  </Button>
                </Tooltip>
              </Space>
            </div>
            <Form.Item 
              label="富文本內容" 
              name="text"
              tooltip="支持 Markdown 語法：*粗體*、_斜體_、~刪除線~、# 標題等。每行將作為數組中的一個元素。"
            >
              <TextArea 
                ref={textAreaRef}
                rows={8} 
                placeholder="輸入富文本內容，支持 Markdown 語法&#10;例如：&#10;# 標題&#10;這是 *粗體* 和 _斜體_ 文本&#10;~刪除線~"
                style={{ fontFamily: 'monospace' }}
              />
            </Form.Item>
            <div style={{ fontSize: '12px', color: '#8c8c8c', marginTop: '-12px', marginBottom: '12px' }}>
              提示：每行將作為數組中的一個元素。支持 Markdown 語法。選中文字後點擊上方按鈕進行格式化。
            </div>
          </>
        );
      
      case 'select':
      case 'checkbox':
      case 'radio':
      case 'chips_selector':
        return (
          <>
            <Form.Item label="選項" name="options">
              <Form.List name="options">
                {(fields, { add, remove }) => (
                  <>
                    {fields.map(({ key, name, ...restField }) => (
                      <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                        <Form.Item
                          {...restField}
                          name={[name, 'id']}
                          rules={[{ required: true, message: '選項 ID 必填' }]}
                        >
                          <Input placeholder="選項 ID" />
                        </Form.Item>
                        <Form.Item
                          {...restField}
                          name={[name, 'title']}
                          rules={[{ required: true, message: '選項標題必填' }]}
                        >
                          <Input placeholder="選項標題" />
                        </Form.Item>
                        <DeleteOutlined onClick={() => remove(name)} />
                      </Space>
                    ))}
                    <Form.Item>
                      <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                        添加選項
                      </Button>
                    </Form.Item>
                  </>
                )}
              </Form.List>
            </Form.Item>
            {component.type === 'chips_selector' && (
              <>
                <Form.Item label="最大選擇數量" name="max_selected_items">
                  <InputNumber min={1} max={20} placeholder="例如: 2" />
                </Form.Item>
                <Form.Item label="描述" name="description">
                  <Input.TextArea rows={2} placeholder="選擇器的描述文字" />
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
            message.error('只支持 JPEG 和 PNG 格式的圖片！');
            return Upload.LIST_IGNORE;
          }
          
          // 檢查文件大小（推薦 300kb，最大限制 1MB 以符合總 payload 限制）
          const fileSizeKB = file.size / 1024;
          const maxSizeKB = 1000; // 1MB = 1000KB（總 payload 限制）
          const recommendedSizeKB = 300; // 推薦大小
          
          if (fileSizeKB > maxSizeKB) {
            message.error(`圖片大小不能超過 ${maxSizeKB}KB（1MB）！`);
            return Upload.LIST_IGNORE;
          }
          
          if (fileSizeKB > recommendedSizeKB) {
            message.warning(`圖片大小 ${Math.round(fileSizeKB)}KB 超過推薦值 300KB，可能影響性能`);
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
              label="圖片" 
              name="url" 
              tooltip="上傳圖片，將自動轉換為 base64 格式並作為 src 屬性生成到 JSON 中"
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
                      alt="預覽" 
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
                      移除
                    </Button>
                  </div>
                ) : (
                  <div>
                    <UploadOutlined />
                    <div style={{ marginTop: 8 }}>上傳圖片</div>
                  </div>
                )}
              </Upload>
            </Form.Item>
            {imagePreview && (
              <div style={{ marginBottom: 16, fontSize: '12px', color: '#8c8c8c' }}>
                提示：圖片已轉換為 base64 格式
              </div>
            )}
            <Form.Item label="寬度 (width)" name="width">
              <InputNumber min={1} placeholder="例如: 200" style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item label="高度 (height)" name="height">
              <InputNumber min={1} placeholder="例如: 200" style={{ width: '100%' }} />
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
                'alt-text': currentImages[imageIndex]?.['alt-text'] || `圖片 ${imageIndex + 1}`
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
            message.error('只支持 JPEG 和 PNG 格式的圖片！');
            return Upload.LIST_IGNORE;
          }
          
          // 檢查文件大小（推薦 300kb，最大限制 1MB）
          const fileSizeKB = file.size / 1024;
          const maxSizeKB = 1000; // 1MB = 1000KB
          const recommendedSizeKB = 300; // 推薦大小
          
          if (fileSizeKB > maxSizeKB) {
            message.error(`圖片大小不能超過 ${maxSizeKB}KB（1MB）！`);
            return Upload.LIST_IGNORE;
          }
          
          if (fileSizeKB > recommendedSizeKB) {
            message.warning(`圖片大小 ${Math.round(fileSizeKB)}KB 超過推薦值 300KB，可能影響性能`);
          }
          
          // 手動處理上傳
          handleCarouselImageUpload(file, imageIndex);
          return false; // 阻止自動上傳
        };
        
        return (
          <>
            <Form.Item label="圖片列表" name="images">
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
                              label="替代文字"
                              rules={[{ required: true, message: '替代文字必填' }]}
                            >
                              <Input placeholder="圖片描述（用於無障礙訪問）" />
                            </Form.Item>
                            <Form.Item label="圖片">
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
                                      alt={imageData?.['alt-text'] || `圖片 ${name + 1}`} 
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
                                      移除
                                    </Button>
                                  </div>
                                ) : (
                                  <div>
                                    <UploadOutlined />
                                    <div style={{ marginTop: 8 }}>上傳圖片</div>
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
                              刪除此圖片
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
                            message.warning('最多只能添加 3 張圖片！');
                            return;
                          }
                          add({ src: '', url: '', 'alt-text': `圖片 ${currentCount + 1}` });
                        }} 
                        block 
                        icon={<PlusOutlined />}
                        disabled={fields.length >= 3}
                      >
                        添加圖片 {fields.length >= 3 ? '(已達上限)' : `(${fields.length}/3)`}
                      </Button>
                    </Form.Item>
                  </>
                )}
              </Form.List>
            </Form.Item>
            <Form.Item label="寬高比" name="aspect-ratio">
              <Select>
                <Select.Option value="4:3">4:3</Select.Option>
                <Select.Option value="16:9">16:9</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item label="縮放類型" name="scale-type">
              <Select>
                <Select.Option value="contain">Contain（完整顯示）</Select.Option>
                <Select.Option value="cover">Cover（填充）</Select.Option>
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
      <Form.Item label="組件 ID" name="id">
        <Input disabled />
      </Form.Item>
      
      <Form.Item label="標題" name="title" rules={[{ required: true, message: '請輸入標題' }]}>
        <Input />
      </Form.Item>

      {renderTypeSpecificFields()}

      <Divider>操作設置</Divider>

      <Form.Item label="操作類型" name="actionType">
        <Select>
          <Select.Option value="navigate">導航到 Screen</Select.Option>
          <Select.Option value="submit">提交</Select.Option>
          <Select.Option value="call">調用</Select.Option>
          <Select.Option value="url">打開 URL</Select.Option>
        </Select>
      </Form.Item>

      <Form.Item 
        label="目標 Screen" 
        name="actionNext"
        tooltip="選擇導航到的 Screen ID"
      >
        <Select placeholder="選擇 Screen">
          {allScreens.map(screen => (
            <Select.Option key={screen.id} value={screen.id}>
              {screen.title || screen.id}
            </Select.Option>
          ))}
        </Select>
      </Form.Item>

      <Form.Item label="Payload" name="actionPayload">
        <TextArea rows={2} placeholder="可選的 payload 數據" />
      </Form.Item>

      <Form.Item label="HTTP 方法" name="actionMethod">
        <Select>
          <Select.Option value="GET">GET</Select.Option>
          <Select.Option value="POST">POST</Select.Option>
          <Select.Option value="PUT">PUT</Select.Option>
          <Select.Option value="DELETE">DELETE</Select.Option>
        </Select>
      </Form.Item>

      <Form.Item label="端點 URL" name="actionEndpoint">
        <Input placeholder="API 端點 URL" />
      </Form.Item>

      <Form.Item>
        <Button type="primary" htmlType="submit" block>
          保存更改
        </Button>
      </Form.Item>
    </Form>
  );
};

export default ComponentPropertyEditor;

