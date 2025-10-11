import React, { useState, useEffect, useRef } from 'react';
import { Input } from 'antd';
import { useLanguage } from '../../../contexts/LanguageContext';

const { TextArea } = Input;

const TextAreaEditor = ({ formData, onFormChange }) => {
  const { t } = useLanguage();
  // 使用內部狀態來管理表單數據
  const [localFormData, setLocalFormData] = useState({});
  const textareaRef = useRef(null);
  const isInitialized = useRef(false);
  
  // 當 formData 變化時，更新內部狀態（只在初始化時執行一次）
  useEffect(() => {
    if (formData && Object.keys(formData).length > 0 && !isInitialized.current) {
      console.log(' TextAreaEditor 初始化 formData:', formData);
      setLocalFormData(formData);
      isInitialized.current = true;
    }
  }, [formData]);
  
  // 調試日誌：檢查傳入的 formData 和內部狀態
  console.log('🔍 TextAreaEditor 接收到的 formData:', formData);
  console.log('🔍 TextAreaEditor 內部狀態:', localFormData);
  
  // 優先使用 defaultValue，如果沒有則使用 value
  const currentValue = localFormData.defaultValue || localFormData.value || '';
  
  console.log(' TextAreaEditor 當前值:', {
    defaultValue: localFormData.defaultValue,
    value: localFormData.value,
    currentValue: currentValue
  });

  // 處理表單變更
  const handleFormChange = (field, value) => {
    const newFormData = { ...localFormData, [field]: value };
    setLocalFormData(newFormData);
    onFormChange(field, value);
  };

  // 處理 textarea 的變更
  const handleTextAreaChange = (e) => {
    const newValue = e.target.value;
    console.log('📝 textarea 預設值變更:', newValue);
    
    // 更新本地狀態
    setLocalFormData(prev => ({
      ...prev,
      defaultValue: newValue,
      value: newValue
    }));
    
    // 通知父組件
    onFormChange('defaultValue', newValue);
    onFormChange('value', newValue);
  };

  // 處理 textarea 失去焦點
  const handleTextAreaBlur = (e) => {
    const newValue = e.target.value;
    console.log('📝 textarea 預設值失去焦點:', newValue);
    
    // 只在值真正改變時才更新
    if (newValue !== currentValue) {
      handleTextAreaChange(e);
    }
  };

  return (
    <div>
      <h3 style={{ margin: '0 0 20px 0', color: '#333' }}>{t('eformDesigner.editTextArea')}</h3>
      
      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>{t('eformDesigner.placeholderText')}:</label>
        <Input
          value={localFormData.placeholder || ''}
          onChange={(e) => handleFormChange('placeholder', e.target.value)}
          placeholder={t('eformDesigner.pleaseEnterPlaceholderText')}
        />
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>{t('eformDesigner.fieldName')}:</label>
        <Input
          value={localFormData.name || ''}
          onChange={(e) => handleFormChange('name', e.target.value)}
          placeholder={t('eformDesigner.pleaseEnterFieldName')}
        />
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>{t('eformDesigner.defaultValue')}:</label>
        <TextArea
          ref={textareaRef}
          value={currentValue}
          onChange={handleTextAreaChange}
          placeholder={t('eformDesigner.pleaseEnterDefaultValue')}
          rows={4}
          onBlur={handleTextAreaBlur}
        />
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>{t('eformDesigner.rows')}:</label>
        <Input
          type="number"
          value={localFormData.rows || 4}
          onChange={(e) => handleFormChange('rows', parseInt(e.target.value) || 4)}
          min={1}
          max={20}
        />
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>{t('eformDesigner.columns')}:</label>
        <Input
          type="number"
          value={localFormData.cols || 50}
          onChange={(e) => handleFormChange('cols', parseInt(e.target.value) || 50)}
          min={1}
          max={100}
        />
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
          <input
            type="checkbox"
            checked={localFormData.required || false}
            onChange={(e) => handleFormChange('required', e.target.checked)}
            style={{ marginRight: '8px' }}
          />
          <span style={{ fontWeight: 'bold' }}>{t('eformDesigner.requiredField')}</span>
        </label>
      </div>
    </div>
  );
};

export default TextAreaEditor; 