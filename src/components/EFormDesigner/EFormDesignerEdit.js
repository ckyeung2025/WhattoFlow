import React, { useState, useEffect } from 'react';
import { Modal, Button, message } from 'antd';
import {
  TextInputEditor,
  TextAreaEditor,
  SelectEditor,
  RadioEditor,
  CheckboxEditor,
  ButtonEditor,
  LabelEditor
} from './editors';

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
        // 優先使用 value 屬性，然後是 textContent，最後是 innerHTML
        defaultValue = el.value || el.textContent || el.innerHTML || content || '';
        console.log('📝 textarea DOM 元素找到:', {
          value: el.value,
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
            value: option.value || '',
            text: option.textContent || option.text || `選項 ${index + 1}`
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
    
    console.log('📝 更新 textarea 組件:', { placeholder, name, defaultValue, rows, cols, required });
    
    // 使用 GrapesJS 官方方法更新組件
    try {
      // 構建完整的 textarea HTML
      const textareaHtml = `
        <textarea 
          ${name ? `name="${name}"` : ''}
          ${placeholder ? `placeholder="${placeholder}"` : ''}
          rows="${rows || 4}"
          cols="${cols || 50}"
          ${required ? 'required' : ''}
        >${defaultValue || ''}</textarea>
      `;
      
      console.log('🎯 構建的 textarea HTML:', textareaHtml);
      
      // 使用 replaceWith 完全替換組件
      component.replaceWith(textareaHtml);
      
      // 觸發組件更新事件
      editor.trigger('component:update', component);
      
      // 強制刷新編輯器
      editor.refresh();
      
      console.log('✅ updateTextareaComponent 完成');
    } catch (error) {
      console.error('❌ replaceWith 失敗:', error);
      
      // 備用方案：使用傳統方法
      component.addAttributes({
        placeholder,
        name,
        rows,
        cols,
        ...(required && { required: 'required' })
      });
      if (!required) component.removeAttributes('required');

      // 更新組件內容 - 確保 defaultValue 正確設置
      const contentValue = defaultValue || '';
      component.set('content', contentValue);
      component.set('innerHTML', contentValue);

      // 更新 DOM 元素
      const el = component.getEl();
      if (el) {
        el.setAttribute('placeholder', placeholder);
        el.setAttribute('name', name);
        el.setAttribute('rows', rows);
        el.setAttribute('cols', cols);
        if (required) el.setAttribute('required', 'required');
        else el.removeAttribute('required');
        
        // 使用 textContent 而不是 innerHTML 來設置 textarea 的內容
        el.textContent = contentValue;
        el.value = contentValue; // 也設置 value 屬性
      }

      // 觸發更新事件
      component.trigger('change:content');
      component.trigger('change:attributes');
      
      editor.refresh();
      
      console.log('✅ 備用方案完成');
    }
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
    
    // 構建完整的 select HTML（使用 GrapesJS 官方推薦的 replaceWith 方法）
    const selectHtml = `
      <select 
        ${name ? `name="${name}"` : ''}
        ${placeholder ? `placeholder="${placeholder}"` : ''}
        ${required ? 'required' : ''}
        ${disabled ? 'disabled' : ''}
      >
        ${options.map(option => 
          `<option value="${option.value || ''}">${option.text || ''}</option>`
        ).join('')}
      </select>
    `;
    
    console.log('🎯 構建的 select HTML:', selectHtml);
    
    try {
      // 使用 GrapesJS 官方的 replaceWith 方法完全替換組件
      console.log('🔄 使用 replaceWith 替換組件');
      component.replaceWith(selectHtml);
      
      // 觸發組件更新事件
      console.log('🔄 觸發組件更新事件');
      editor.trigger('component:update', component);
      
      // 強制刷新編輯器
      console.log('🔄 刷新編輯器');
      editor.refresh();
      
      console.log('✅ updateSelectComponent 完成');
    } catch (error) {
      console.error('❌ replaceWith 失敗:', error);
      
      // 備用方案：使用傳統方法
      console.log('🔄 使用備用方案');
      
      // 更新組件屬性
      const attributesToAdd = {
        name: name || '',
        placeholder: placeholder || '',
        ...(required && { required: 'required' }),
        ...(disabled && { disabled: 'disabled' })
      };
      
      component.addAttributes(attributesToAdd);
      
      if (!required) component.removeAttributes('required');
      if (!disabled) component.removeAttributes('disabled');
      
      // 更新組件內容
      const optionsHtml = options.map(option => 
        `<option value="${option.value || ''}">${option.text || ''}</option>`
      ).join('');
      
      component.set('content', optionsHtml);
      component.set('innerHTML', optionsHtml);
      
      // 更新 DOM 元素
      const el = component.getEl();
      if (el) {
        el.innerHTML = optionsHtml;
        
        if (name) el.setAttribute('name', name);
        else el.removeAttribute('name');
        
        if (placeholder) el.setAttribute('placeholder', placeholder);
        else el.removeAttribute('placeholder');
        
        if (required) el.setAttribute('required', 'required');
        else el.removeAttribute('required');
        
        if (disabled) el.setAttribute('disabled', 'disabled');
        else el.removeAttribute('disabled');
      }
      
      // 觸發更新事件
      component.trigger('change:content');
      component.trigger('change:attributes');
      editor.refresh();
      
      console.log('✅ 備用方案完成');
    }
  };

  const renderEditForm = () => {
    if (!component) return null;

    const tagName = component.get('tagName');
    const inputType = component.getAttributes().type || 'text';

    // 根據組件類型和屬性選擇對應的編輯器
    if (tagName === 'input') {
      return <TextInputEditor formData={formData} onFormChange={handleFormChange} />;
    } else if (tagName === 'textarea') {
      return <TextAreaEditor formData={formData} onFormChange={handleFormChange} />;
    } else if (tagName === 'select') {
      return <SelectEditor formData={formData} onFormChange={handleFormChange} />;
    } else if (tagName === 'input' && inputType === 'radio') {
      return <RadioEditor formData={formData} onFormChange={handleFormChange} />;
    } else if (tagName === 'input' && inputType === 'checkbox') {
      return <CheckboxEditor formData={formData} onFormChange={handleFormChange} />;
    } else if (tagName === 'button') {
      return <ButtonEditor formData={formData} onFormChange={handleFormChange} />;
    } else if (tagName === 'label') {
      return <LabelEditor formData={formData} onFormChange={handleFormChange} />;
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