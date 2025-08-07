import React from 'react';
import { Input } from 'antd';

const ButtonEditor = ({ formData, onFormChange }) => {
  return (
    <div>
      <h3 style={{ margin: '0 0 20px 0', color: '#333' }}>編輯按鈕</h3>
      
      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>按鈕文字:</label>
        <Input
          value={formData.text || ''}
          onChange={(e) => onFormChange('text', e.target.value)}
          placeholder="請輸入按鈕文字"
        />
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>按鈕類型:</label>
        <select
          value={formData.type || 'button'}
          onChange={(e) => onFormChange('type', e.target.value)}
          style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
        >
          <option value="button">一般按鈕</option>
          <option value="submit">提交按鈕</option>
          <option value="reset">重置按鈕</option>
        </select>
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>按鈕樣式:</label>
        <select
          value={formData.style || 'primary'}
          onChange={(e) => onFormChange('style', e.target.value)}
          style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
        >
          <option value="primary">主要按鈕</option>
          <option value="secondary">次要按鈕</option>
          <option value="success">成功按鈕</option>
          <option value="danger">危險按鈕</option>
          <option value="warning">警告按鈕</option>
          <option value="info">信息按鈕</option>
          <option value="light">淺色按鈕</option>
          <option value="dark">深色按鈕</option>
        </select>
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>按鈕大小:</label>
        <select
          value={formData.size || 'medium'}
          onChange={(e) => onFormChange('size', e.target.value)}
          style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
        >
          <option value="small">小</option>
          <option value="medium">中</option>
          <option value="large">大</option>
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
          <span style={{ fontWeight: 'bold' }}>禁用</span>
        </label>
      </div>
    </div>
  );
};

export default ButtonEditor; 