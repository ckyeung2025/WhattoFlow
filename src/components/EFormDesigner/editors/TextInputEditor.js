import React from 'react';
import { Input, Select, Space } from 'antd';
import { useLanguage } from '../../../contexts/LanguageContext';

const TextInputEditor = ({ formData, onFormChange }) => {
  const { t } = useLanguage();
  // 日期格式選項
  const dateFormatOptions = [
    { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (2025-12-01)' },
    { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (12/01/2025)' },
    { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (01/12/2025)' },
    { value: 'YYYY/MM/DD', label: 'YYYY/MM/DD (2025/12/01)' },
    { value: 'MM-DD-YYYY', label: 'MM-DD-YYYY (12-01-2025)' },
    { value: 'DD-MM-YYYY', label: 'DD-MM-YYYY (01-12-2025)' }
  ];

  // 根據日期格式生成預覽值
  const getDatePreview = (format) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    
    switch (format) {
      case 'YYYY-MM-DD':
        return `${year}-${month}-${day}`;
      case 'MM/DD/YYYY':
        return `${month}/${day}/${year}`;
      case 'DD/MM/YYYY':
        return `${day}/${month}/${year}`;
      case 'YYYY/MM/DD':
        return `${year}/${month}/${day}`;
      case 'MM-DD-YYYY':
        return `${month}-${day}-${year}`;
      case 'DD-MM-YYYY':
        return `${day}-${month}-${year}`;
      default:
        return `${year}-${month}-${day}`;
    }
  };

  // 檢查是否為日期類型
  const isDateType = formData.type === 'date';

  return (
    <div>
      <h3 style={{ margin: '0 0 20px 0', color: '#333' }}>{t('eformDesigner.editTextInput')}</h3>
      
      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>{t('eformDesigner.placeholderText')}:</label>
        <Input
          value={formData.placeholder || ''}
          onChange={(e) => onFormChange('placeholder', e.target.value)}
          placeholder={t('eformDesigner.pleaseEnterPlaceholderText')}
        />
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>{t('eformDesigner.fieldName')}:</label>
        <Input
          value={formData.name || ''}
          onChange={(e) => onFormChange('name', e.target.value)}
          placeholder={t('eformDesigner.pleaseEnterFieldName')}
        />
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>{t('eformDesigner.defaultValue')}:</label>
        <Input
          value={formData.value || ''}
          onChange={(e) => onFormChange('value', e.target.value)}
          placeholder={isDateType ? t('eformDesigner.pleaseEnterDefaultDate') : t('eformDesigner.pleaseEnterDefaultValue')}
        />
        {isDateType && formData.dateFormat && (
          <div style={{ 
            marginTop: '5px', 
            fontSize: '12px', 
            color: '#666',
            fontStyle: 'italic'
          }}>
            {t('eformDesigner.formatPreview', { preview: getDatePreview(formData.dateFormat) })}
          </div>
        )}
        {isDateType && (
          <div style={{ 
            marginTop: '5px', 
            fontSize: '11px', 
            color: '#999'
          }}>
            {t('eformDesigner.pleaseEnterDefaultValueAccordingToDateFormat', { example: formData.dateFormat === 'YYYY-MM-DD' ? '2025-12-01' : 
              formData.dateFormat === 'MM/DD/YYYY' ? '12/01/2025' :
              formData.dateFormat === 'DD/MM/YYYY' ? '01/12/2025' :
              formData.dateFormat === 'YYYY/MM/DD' ? '2025/12/01' :
              formData.dateFormat === 'MM-DD-YYYY' ? '12-01-2025' :
              formData.dateFormat === 'DD-MM-YYYY' ? '01-12-2025' : '2025-12-01'
            })}
          </div>
        )}
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>{t('eformDesigner.inputType')}:</label>
        <Select
          value={formData.type || 'text'}
          onChange={(value) => {
            onFormChange('type', value);
            // 如果選擇日期類型且還沒有設置日期格式，自動設置默認格式
            if (value === 'date' && !formData.dateFormat) {
              onFormChange('dateFormat', 'YYYY-MM-DD');
              // 自動設置一個示例預設值
              const exampleDate = getDatePreview('YYYY-MM-DD');
              onFormChange('value', exampleDate);
            }
          }}
          style={{ width: '100%' }}
          options={[
            { value: 'text', label: t('eformDesigner.text') },
            { value: 'email', label: t('eformDesigner.email') },
            { value: 'password', label: t('eformDesigner.password') },
            { value: 'number', label: t('eformDesigner.number') },
            { value: 'tel', label: t('eformDesigner.phone') },
            { value: 'url', label: t('eformDesigner.url') },
            { value: 'date', label: t('eformDesigner.date') },
            { value: 'time', label: t('eformDesigner.time') },
            { value: 'file', label: t('eformDesigner.file') }
          ]}
        />
      </div>

      {/* 日期格式設置 - 僅在日期類型時顯示 */}
      {isDateType && (
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>{t('eformDesigner.dateFormat')}:</label>
          <div style={{ 
            marginBottom: '8px', 
            fontSize: '12px', 
            color: '#666',
            fontStyle: 'italic'
          }}>
            {t('eformDesigner.dateFormatDescription')}
          </div>
          <Select
            value={formData.dateFormat || 'YYYY-MM-DD'}
            onChange={(value) => {
              onFormChange('dateFormat', value);
              // 如果當前有預設值，根據新格式更新提示
              if (formData.value) {
                // 這裡可以添加邏輯來轉換日期格式
                console.log('📅 日期格式已更改為:', value);
              }
            }}
            style={{ width: '100%' }}
            options={dateFormatOptions}
          />
          <div style={{ 
            marginTop: '8px', 
            fontSize: '12px', 
            color: '#1890ff',
            fontWeight: '500'
          }}>
            {t('eformDesigner.selectedFormat', { format: formData.dateFormat || 'YYYY-MM-DD' })}
          </div>
          <div style={{ 
            marginTop: '5px', 
            fontSize: '11px', 
            color: '#999'
          }}>
            {t('eformDesigner.tip')}
          </div>
        </div>
      )}

      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
          <input
            type="checkbox"
            checked={formData.required || false}
            onChange={(e) => onFormChange('required', e.target.checked)}
            style={{ marginRight: '8px' }}
          />
          <span style={{ fontWeight: 'bold' }}>{t('eformDesigner.requiredField')}</span>
        </label>
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
          <input
            type="checkbox"
            checked={formData.disabled || false}
            onChange={(e) => onFormChange('disabled', e.target.checked)}
            style={{ marginRight: '8px' }}
          />
          <span style={{ fontWeight: 'bold' }}>{t('eformDesigner.disabled')}</span>
        </label>
      </div>
    </div>
  );
};

export default TextInputEditor; 