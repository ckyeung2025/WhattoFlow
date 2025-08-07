import React, { useState, useEffect } from 'react';
import { Modal, Input, Button, message } from 'antd';

const { TextArea } = Input;

const EFormDesignerEdit = ({ visible, component, editor, onClose, onSave }) => {
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && component) {
      initializeFormData();
    }
  }, [visible, component]);

  const initializeFormData = () => {
    if (!component) {
      console.log('❌ initializeFormData: component is null');
      return;
    }

    const tagName = component.get('tagName');
    const attributes = component.getAttributes();
    const content = component.get('content') || '';
    
    console.log('🔍 initializeFormData 開始:', {
      tagName,
      attributes,
      content,
      componentId: component.getId()
    });

    let initialData = {};

    if (tagName === 'input') {
      initialData = {
        placeholder: attributes.placeholder || '',
        name: attributes.name || '',
        value: attributes.value || '',
        type: attributes.type || 'text',
        required: !!attributes.required,
        disabled: !!attributes.disabled
      };
      console.log('✅ input 初始化完成:', initialData);
    } else if (tagName === 'textarea') {
      // 改進 textarea 默認值讀取邏輯
      let defaultValue = '';
      const el = component.getEl();
      if (el) {
        defaultValue = el.textContent || el.innerHTML || content || '';
        console.log('📝 textarea DOM 元素找到:', {
          textContent: el.textContent,
          innerHTML: el.innerHTML,
          content: content,
          finalValue: defaultValue
        });
      } else {
        defaultValue = content || '';
        console.log('⚠️ textarea DOM 元素未找到，使用 content:', defaultValue);
      }
      
      initialData = {
        placeholder: attributes.placeholder || '',
        name: attributes.name || '',
        defaultValue: defaultValue,
        rows: attributes.rows || 4,
        cols: attributes.cols || 50,
        required: !!attributes.required
      };
      console.log('✅ textarea 初始化完成:', initialData);
    } else if (tagName === 'select') {
      // 添加 select 支持
      const options = [];
      const el = component.getEl();
      console.log('🔍 select 組件 DOM 元素:', el);
      
      if (el) {
        const optionElements = el.querySelectorAll('option');
        console.log('📋 找到 option 元素數量:', optionElements.length);
        
        optionElements.forEach((option, index) => {
          const optionData = {
            value: option.value || `option${index + 1}`,
            text: option.textContent || `選項 ${index + 1}`
          };
          options.push(optionData);
          console.log(`📋 選項 ${index + 1}:`, optionData);
        });
      } else {
        console.log('⚠️ select DOM 元素未找到');
      }
      
      // 如果沒有找到選項，使用默認選項
      if (options.length === 0) {
        console.log('📋 沒有找到選項，使用默認選項');
        options.push(
          { value: '', text: '請選擇...' },
          { value: 'option1', text: '選項 1' },
          { value: 'option2', text: '選項 2' },
          { value: 'option3', text: '選項 3' }
        );
      }
      
      initialData = {
        name: attributes.name || '',
        placeholder: attributes.placeholder || '',
        options: options,
        required: !!attributes.required,
        disabled: !!attributes.disabled
      };
      console.log('✅ select 初始化完成:', initialData);
    } else {
      console.log('❌ 不支援的組件類型:', tagName);
    }

    console.log('🎯 最終初始化數據:', initialData);
    setFormData(initialData);
  };

  const handleFormChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    console.log('💾 handleSave 開始');
    
    if (!component || !editor) {
      console.log('❌ handleSave: component 或 editor 為空', {
        component: !!component,
        editor: !!editor
      });
      return;
    }

    setLoading(true);
    try {
      const tagName = component.get('tagName');
      console.log('🔍 組件類型:', tagName);
      console.log('🔍 組件 ID:', component.getId());
      console.log('🔍 當前表單數據:', formData);
      
      if (tagName === 'input') {
        console.log('📝 更新 input 組件');
        await updateInputComponent();
      } else if (tagName === 'textarea') {
        console.log('📝 更新 textarea 組件');
        await updateTextareaComponent();
      } else if (tagName === 'select') {
        console.log('📝 更新 select 組件');
        await updateSelectComponent();
      } else {
        console.log('❌ 不支援的組件類型:', tagName);
      }

      console.log('✅ 組件更新成功');
      message.success('✅ 組件已更新');
      onSave && onSave();
    } catch (error) {
      console.error('❌ 保存編輯時出錯:', error);
      console.error('❌ 錯誤堆疊:', error.stack);
      message.error('❌ 保存失敗: ' + error.message);
    } finally {
      setLoading(false);
      console.log('💾 handleSave 完成');
    }
  };

  const updateInputComponent = async () => {
    const { placeholder, name, value, type, required, disabled } = formData;
    
    component.addAttributes({
      placeholder,
      name,
      value,
      type,
      ...(required && { required: 'required' }),
      ...(disabled && { disabled: 'disabled' })
    });

    if (!required) component.removeAttributes('required');
    if (!disabled) component.removeAttributes('disabled');

    const el = component.getEl();
    if (el) {
      el.setAttribute('placeholder', placeholder);
      el.setAttribute('name', name);
      el.setAttribute('value', value);
      el.setAttribute('type', type);
      if (required) el.setAttribute('required', 'required');
      else el.removeAttribute('required');
      if (disabled) el.setAttribute('disabled', 'disabled');
      else el.removeAttribute('disabled');
    }

    component.trigger('change:attributes');
    editor.refresh();
  };

  const updateTextareaComponent = async () => {
    const { placeholder, name, defaultValue, rows, cols, required } = formData;
    
    // 更新組件屬性
    component.addAttributes({
      placeholder,
      name,
      rows,
      cols,
      ...(required && { required: 'required' })
    });
    if (!required) component.removeAttributes('required');

    // 更新組件內容
    component.set('content', defaultValue);
    component.set('innerHTML', defaultValue);

    // 更新 DOM 元素
    const el = component.getEl();
    if (el) {
      el.setAttribute('placeholder', placeholder);
      el.setAttribute('name', name);
      el.setAttribute('rows', rows);
      el.setAttribute('cols', cols);
      if (required) el.setAttribute('required', 'required');
      else el.removeAttribute('required');
      
      // 使用 innerHTML 而不是 textContent 來保持格式
      el.innerHTML = defaultValue;
    }

    // 觸發更新事件
    component.trigger('change:content');
    component.trigger('change:attributes');
    
    // 延遲刷新編輯器，確保內容更新完成
    setTimeout(() => {
      editor.refresh();
    }, 100);
  };

  const updateSelectComponent = async () => {
    console.log('🚀 updateSelectComponent 開始');
    const { name, placeholder, options, required, disabled } = formData;
    
    console.log('📊 更新數據:', {
      name,
      placeholder,
      options,
      required,
      disabled
    });
    
    // 構建選項 HTML
    let optionsHtml = '';
    options.forEach((option, index) => {
      const optionHtml = `<option value="${option.value}">${option.text}</option>`;
      optionsHtml += optionHtml;
      console.log(`📋 選項 ${index + 1} HTML:`, optionHtml);
    });
    
    console.log('🎯 最終選項 HTML:', optionsHtml);
    
    // 更新組件屬性
    const attributesToAdd = {
      name: name || '',
      placeholder: placeholder || '',
      ...(required && { required: 'required' }),
      ...(disabled && { disabled: 'disabled' })
    };
    
    console.log('🔧 添加屬性:', attributesToAdd);
    component.addAttributes(attributesToAdd);
    
    if (!required) {
      console.log('🔧 移除 required 屬性');
      component.removeAttributes('required');
    }
    if (!disabled) {
      console.log('🔧 移除 disabled 屬性');
      component.removeAttributes('disabled');
    }
    
    // 更新組件內容（只更新選項，不重新創建整個 select）
    console.log('📝 更新組件內容:', optionsHtml);
    component.set('content', optionsHtml);
    component.set('innerHTML', optionsHtml);
    
    // 更新 DOM 元素
    const el = component.getEl();
    console.log('🔍 DOM 元素:', el);
    
    if (el) {
      console.log('🔍 更新前 DOM innerHTML:', el.innerHTML);
      
      // 只更新選項內容，保持 select 標籤不變
      el.innerHTML = optionsHtml;
      console.log('🔍 更新後 DOM innerHTML:', el.innerHTML);
      
      // 更新屬性
      if (name) {
        el.setAttribute('name', name);
        console.log('🔧 設置 name 屬性:', name);
      } else {
        el.removeAttribute('name');
        console.log('🔧 移除 name 屬性');
      }
      
      if (placeholder) {
        el.setAttribute('placeholder', placeholder);
        console.log('🔧 設置 placeholder 屬性:', placeholder);
      } else {
        el.removeAttribute('placeholder');
        console.log('🔧 移除 placeholder 屬性');
      }
      
      if (required) {
        el.setAttribute('required', 'required');
        console.log('🔧 設置 required 屬性');
      } else {
        el.removeAttribute('required');
        console.log('🔧 移除 required 屬性');
      }
      
      if (disabled) {
        el.setAttribute('disabled', 'disabled');
        console.log('🔧 設置 disabled 屬性');
      } else {
        el.removeAttribute('disabled');
        console.log('🔧 移除 disabled 屬性');
      }
      
      console.log('🔍 最終 DOM 元素:', el.outerHTML);
    } else {
      console.log('❌ DOM 元素未找到');
    }
    
    // 觸發更新事件
    console.log('🔄 觸發更新事件');
    component.trigger('change:content');
    component.trigger('change:attributes');
    
    // 延遲刷新編輯器，確保內容更新完成
    console.log('⏰ 延遲刷新編輯器');
    setTimeout(() => {
      console.log('🔄 執行編輯器刷新');
      editor.refresh();
      console.log('✅ updateSelectComponent 完成');
    }, 100);
  };

  const renderEditForm = () => {
    if (!component) return null;

    const tagName = component.get('tagName');

    if (tagName === 'input') {
      return (
        <div>
          <h3 style={{ margin: '0 0 20px 0', color: '#333' }}>編輯輸入框</h3>
          
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>佔位符文字:</label>
            <Input
              value={formData.placeholder || ''}
              onChange={(e) => handleFormChange('placeholder', e.target.value)}
              placeholder="請輸入佔位符文字"
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>欄位名稱:</label>
            <Input
              value={formData.name || ''}
              onChange={(e) => handleFormChange('name', e.target.value)}
              placeholder="請輸入欄位名稱"
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>預設值:</label>
            <Input
              value={formData.value || ''}
              onChange={(e) => handleFormChange('value', e.target.value)}
              placeholder="請輸入預設值"
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>輸入類型:</label>
            <select
              value={formData.type || 'text'}
              onChange={(e) => handleFormChange('type', e.target.value)}
              style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
            >
              <option value="text">文字</option>
              <option value="email">電子郵件</option>
              <option value="password">密碼</option>
              <option value="number">數字</option>
              <option value="tel">電話</option>
              <option value="url">網址</option>
              <option value="date">日期</option>
              <option value="time">時間</option>
              <option value="file">檔案</option>
            </select>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
              <input
                type="checkbox"
                checked={formData.required || false}
                onChange={(e) => handleFormChange('required', e.target.checked)}
                style={{ marginRight: '8px' }}
              />
              <span style={{ fontWeight: 'bold' }}>必填欄位</span>
            </label>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
              <input
                type="checkbox"
                checked={formData.disabled || false}
                onChange={(e) => handleFormChange('disabled', e.target.checked)}
                style={{ marginRight: '8px' }}
              />
              <span style={{ fontWeight: 'bold' }}>禁用</span>
            </label>
          </div>
        </div>
      );
    } else if (tagName === 'textarea') {
      return (
        <div>
          <h3 style={{ margin: '0 0 20px 0', color: '#333' }}>編輯文字區域</h3>
          
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>佔位符文字:</label>
            <Input
              value={formData.placeholder || ''}
              onChange={(e) => handleFormChange('placeholder', e.target.value)}
              placeholder="請輸入佔位符文字"
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>欄位名稱:</label>
            <Input
              value={formData.name || ''}
              onChange={(e) => handleFormChange('name', e.target.value)}
              placeholder="請輸入欄位名稱"
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>預設值:</label>
            <TextArea
              value={formData.defaultValue || ''}
              onChange={(e) => handleFormChange('defaultValue', e.target.value)}
              placeholder="請輸入預設值"
              rows={4}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>行數:</label>
            <Input
              type="number"
              value={formData.rows || 4}
              onChange={(e) => handleFormChange('rows', parseInt(e.target.value) || 4)}
              min={1}
              max={20}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>列數:</label>
            <Input
              type="number"
              value={formData.cols || 50}
              onChange={(e) => handleFormChange('cols', parseInt(e.target.value) || 50)}
              min={1}
              max={100}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
              <input
                type="checkbox"
                checked={formData.required || false}
                onChange={(e) => handleFormChange('required', e.target.checked)}
                style={{ marginRight: '8px' }}
              />
              <span style={{ fontWeight: 'bold' }}>必填欄位</span>
            </label>
          </div>
                </div>
      );
    } else if (tagName === 'select') {
      return (
        <div>
          <h3 style={{ margin: '0 0 20px 0', color: '#333' }}>編輯下拉選單</h3>
          
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>欄位名稱:</label>
            <Input
              value={formData.name || ''}
              onChange={(e) => handleFormChange('name', e.target.value)}
              placeholder="請輸入欄位名稱"
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>佔位符文字:</label>
            <Input
              value={formData.placeholder || ''}
              onChange={(e) => handleFormChange('placeholder', e.target.value)}
              placeholder="請輸入佔位符文字"
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>選項列表:</label>
            <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #d9d9d9', borderRadius: '4px', padding: '8px' }}>
              {(formData.options || []).map((option, index) => (
                <div key={index} style={{ display: 'flex', marginBottom: '8px', gap: '8px' }}>
                  <Input
                    placeholder="選項值"
                    value={option.value}
                    onChange={(e) => {
                      const newOptions = [...(formData.options || [])];
                      newOptions[index] = { ...option, value: e.target.value };
                      handleFormChange('options', newOptions);
                    }}
                    style={{ flex: 1 }}
                  />
                  <Input
                    placeholder="選項文字"
                    value={option.text}
                    onChange={(e) => {
                      const newOptions = [...(formData.options || [])];
                      newOptions[index] = { ...option, text: e.target.value };
                      handleFormChange('options', newOptions);
                    }}
                    style={{ flex: 1 }}
                  />
                  <Button
                    type="text"
                    danger
                    onClick={() => {
                      const newOptions = (formData.options || []).filter((_, i) => i !== index);
                      handleFormChange('options', newOptions);
                    }}
                  >
                    刪除
                  </Button>
                </div>
              ))}
              <Button
                type="dashed"
                onClick={() => {
                  const newOptions = [...(formData.options || []), { value: '', text: '' }];
                  handleFormChange('options', newOptions);
                }}
                style={{ width: '100%' }}
              >
                + 添加選項
              </Button>
            </div>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
              <input
                type="checkbox"
                checked={formData.required || false}
                onChange={(e) => handleFormChange('required', e.target.checked)}
                style={{ marginRight: '8px' }}
              />
              <span style={{ fontWeight: 'bold' }}>必填欄位</span>
            </label>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
              <input
                type="checkbox"
                checked={formData.disabled || false}
                onChange={(e) => handleFormChange('disabled', e.target.checked)}
                style={{ marginRight: '8px' }}
              />
              <span style={{ fontWeight: 'bold' }}>禁用</span>
            </label>
          </div>
        </div>
      );
    }
    
    return (
      <div>
        <h3 style={{ margin: '0 0 20px 0', color: '#333' }}>編輯組件</h3>
        <p style={{ color: '#666' }}>此組件類型暫不支援編輯，請使用右側樣式面板進行調整。</p>
      </div>
    );
  };

  return (
    <Modal
      title="編輯組件"
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button
          key="save"
          type="primary"
          onClick={handleSave}
          loading={loading}
        >
          保存
        </Button>
      ]}
      width={500}
      destroyOnClose
    >
      {renderEditForm()}
    </Modal>
  );
};

export default EFormDesignerEdit; 