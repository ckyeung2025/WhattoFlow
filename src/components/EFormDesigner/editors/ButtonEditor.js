import React from 'react';
import { Input } from 'antd';
import { useLanguage } from '../../../contexts/LanguageContext';

const ButtonEditor = ({ formData, onFormChange }) => {
  const { t } = useLanguage();
  return (
    <div>
      <h3 style={{ margin: '0 0 20px 0', color: '#333' }}>{t('eformDesigner.editButton')}</h3>
      
      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>{t('eformDesigner.buttonText')}:</label>
        <Input
          value={formData.text || ''}
          onChange={(e) => onFormChange('text', e.target.value)}
          placeholder={t('eformDesigner.pleaseEnterButtonText')}
        />
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>{t('eformDesigner.buttonType')}:</label>
        <select
          value={formData.type || 'button'}
          onChange={(e) => onFormChange('type', e.target.value)}
          style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
        >
          <option value="button">{t('eformDesigner.normalButton')}</option>
          <option value="submit">{t('eformDesigner.submitButton')}</option>
          <option value="reset">{t('eformDesigner.resetButton')}</option>
        </select>
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>{t('eformDesigner.buttonStyle')}:</label>
        <select
          value={formData.style || 'primary'}
          onChange={(e) => onFormChange('style', e.target.value)}
          style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
        >
          <option value="primary">{t('eformDesigner.primaryButton')}</option>
          <option value="secondary">{t('eformDesigner.secondaryButton')}</option>
          <option value="success">{t('eformDesigner.successButton')}</option>
          <option value="danger">{t('eformDesigner.dangerButton')}</option>
          <option value="warning">{t('eformDesigner.warningButton')}</option>
          <option value="info">{t('eformDesigner.infoButton')}</option>
          <option value="light">{t('eformDesigner.lightButton')}</option>
          <option value="dark">{t('eformDesigner.darkButton')}</option>
        </select>
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>{t('eformDesigner.buttonSize')}:</label>
        <select
          value={formData.size || 'medium'}
          onChange={(e) => onFormChange('size', e.target.value)}
          style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
        >
          <option value="small">{t('eformDesigner.small')}</option>
          <option value="medium">{t('eformDesigner.medium')}</option>
          <option value="large">{t('eformDesigner.large')}</option>
        </select>
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

export default ButtonEditor; 