import React from 'react';
import { Input } from 'antd';

const TextInputEditor = ({ formData, onFormChange }) => {
  return (
    <div>
      <h3 style={{ margin: '0 0 20px 0', color: '#333' }}>編輯文字輸入框</h3>
      
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
        <Input
          value={formData.value || ''}
          onChange={(e) => onFormChange('value', e.target.value)}
          placeholder="請輸入預設值"
        />
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>輸入類型:</label>
        <select
          value={formData.type || 'text'}
          onChange={(e) => onFormChange('type', e.target.value)}
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
            onChange={(e) => onFormChange('required', e.target.checked)}
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
            onChange={(e) => onFormChange('disabled', e.target.checked)}
            style={{ marginRight: '8px' }}
          />
          <span style={{ fontWeight: 'bold' }}>禁用</span>
        </label>
      </div>
    </div>
  );
};

export default TextInputEditor; 