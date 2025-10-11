import React from 'react';
import { Input, Button } from 'antd';
import { useLanguage } from '../../../contexts/LanguageContext';

const CheckboxEditor = ({ formData, onFormChange }) => {
  const { t } = useLanguage();
  return (
    <div>
      <h3 style={{ margin: '0 0 20px 0', color: '#333' }}>{t('eformDesigner.editCheckbox')}</h3>
      
      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>{t('eformDesigner.fieldName')}:</label>
        <Input
          value={formData.name || ''}
          onChange={(e) => onFormChange('name', e.target.value)}
          placeholder={t('eformDesigner.pleaseEnterFieldName')}
        />
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>{t('eformDesigner.optionList')}:</label>
        <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #d9d9d9', borderRadius: '4px', padding: '8px' }}>
          {(formData.options || []).map((option, index) => (
            <div key={index} style={{ display: 'flex', marginBottom: '8px', gap: '8px', alignItems: 'center' }}>
              <Input
                placeholder={t('eformDesigner.optionValue')}
                value={option.value}
                onChange={(e) => {
                  const newOptions = [...(formData.options || [])];
                  newOptions[index] = { ...option, value: e.target.value };
                  onFormChange('options', newOptions);
                }}
                style={{ flex: 1 }}
              />
              <Input
                placeholder={t('eformDesigner.optionText')}
                value={option.text}
                onChange={(e) => {
                  const newOptions = [...(formData.options || [])];
                  newOptions[index] = { ...option, text: e.target.value };
                  onFormChange('options', newOptions);
                }}
                style={{ flex: 1 }}
              />
              <Button
                type="text"
                danger
                onClick={() => {
                  const newOptions = (formData.options || []).filter((_, i) => i !== index);
                  onFormChange('options', newOptions);
                }}
              >
{t('eformDesigner.delete')}
              </Button>
            </div>
          ))}
          <Button
            type="dashed"
            onClick={() => {
              const newOptions = [...(formData.options || []), { value: '', text: '' }];
              onFormChange('options', newOptions);
            }}
            style={{ width: '100%' }}
          >
{t('eformDesigner.addOption')}
          </Button>
        </div>
      </div>

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

export default CheckboxEditor; 