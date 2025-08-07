import React from 'react';
import { Input } from 'antd';

const { TextArea } = Input;

const TextAreaEditor = ({ formData, onFormChange }) => {
  return (
    <div>
      <h3 style={{ margin: '0 0 20px 0', color: '#333' }}>編輯文字區域</h3>
      
      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>佔位符文字:</label>
        <Input
          value={formData.placeholder || ''}
          onChange={(e) => onFormChange('placeholder', e.target.value)}
          placeholder="請輸入佔位符文字"
        />
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>欄位名稱:</label>
        <Input
          value={formData.name || ''}
          onChange={(e) => onFormChange('name', e.target.value)}
          placeholder="請輸入欄位名稱"
        />
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>預設值:</label>
        <TextArea
          value={formData.defaultValue || ''}
          onChange={(e) => onFormChange('defaultValue', e.target.value)}
          placeholder="請輸入預設值"
          rows={4}
          onBlur={(e) => {
            // 確保在失去焦點時也觸發更新
            onFormChange('defaultValue', e.target.value);
          }}
        />
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>行數:</label>
        <Input
          type="number"
          value={formData.rows || 4}
          onChange={(e) => onFormChange('rows', parseInt(e.target.value) || 4)}
          min={1}
          max={20}
        />
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>列數:</label>
        <Input
          type="number"
          value={formData.cols || 50}
          onChange={(e) => onFormChange('cols', parseInt(e.target.value) || 50)}
          min={1}
          max={100}
        />
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
          <input
            type="checkbox"
            checked={formData.required || false}
            onChange={(e) => onFormChange('required', e.target.checked)}
            style={{ marginRight: '8px' }}
          />
          <span style={{ fontWeight: 'bold' }}>必填欄位</span>
        </label>
      </div>
    </div>
  );
};

export default TextAreaEditor; 