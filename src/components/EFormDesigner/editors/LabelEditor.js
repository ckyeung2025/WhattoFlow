import React from 'react';
import { Input } from 'antd';
import { useLanguage } from '../../../contexts/LanguageContext';

const LabelEditor = ({ formData, onFormChange }) => {
  const { t } = useLanguage();
  return (
    <div>
      <h3 style={{ margin: '0 0 20px 0', color: '#333' }}>{t('eformDesigner.editLabel')}</h3>
      
      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>{t('eformDesigner.labelText')}:</label>
        <Input
          value={formData.text || ''}
          onChange={(e) => onFormChange('text', e.target.value)}
          placeholder={t('eformDesigner.pleaseEnterLabelText')}
        />
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>{t('eformDesigner.associatedField')}:</label>
        <Input
          value={formData.for || ''}
          onChange={(e) => onFormChange('for', e.target.value)}
          placeholder={t('eformDesigner.pleaseEnterAssociatedFieldId')}
        />
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>{t('eformDesigner.labelStyle')}:</label>
        <select
          value={formData.style || 'normal'}
          onChange={(e) => onFormChange('style', e.target.value)}
          style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
        >
          <option value="normal">{t('eformDesigner.normal')}</option>
          <option value="bold">{t('eformDesigner.bold')}</option>
          <option value="italic">{t('eformDesigner.italic')}</option>
          <option value="underline">{t('eformDesigner.underline')}</option>
        </select>
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>{t('eformDesigner.fontSize')}:</label>
        <select
          value={formData.fontSize || '14px'}
          onChange={(e) => onFormChange('fontSize', e.target.value)}
          style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
        >
          <option value="12px">{t('eformDesigner.small12px')}</option>
          <option value="14px">{t('eformDesigner.medium14px')}</option>
          <option value="16px">{t('eformDesigner.large16px')}</option>
          <option value="18px">{t('eformDesigner.extraLarge18px')}</option>
        </select>
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
          <input
            type="checkbox"
            checked={formData.required || false}
            onChange={(e) => onFormChange('required', e.target.checked)}
            style={{ marginRight: '8px' }}
          />
          <span style={{ fontWeight: 'bold' }}>{t('eformDesigner.requiredLabel')}</span>
        </label>
      </div>
    </div>
  );
};

export default LabelEditor; 