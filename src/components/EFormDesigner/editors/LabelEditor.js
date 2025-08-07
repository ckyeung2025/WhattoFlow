import React from 'react';
import { Input } from 'antd';

const LabelEditor = ({ formData, onFormChange }) => {
  return (
    <div>
      <h3 style={{ margin: '0 0 20px 0', color: '#333' }}>編輯標籤</h3>
      
      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>標籤文字:</label>
        <Input
          value={formData.text || ''}
          onChange={(e) => onFormChange('text', e.target.value)}
          placeholder="請輸入標籤文字"
        />
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>關聯欄位:</label>
        <Input
          value={formData.for || ''}
          onChange={(e) => onFormChange('for', e.target.value)}
          placeholder="請輸入關聯欄位的 ID"
        />
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>標籤樣式:</label>
        <select
          value={formData.style || 'normal'}
          onChange={(e) => onFormChange('style', e.target.value)}
          style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
        >
          <option value="normal">一般</option>
          <option value="bold">粗體</option>
          <option value="italic">斜體</option>
          <option value="underline">底線</option>
        </select>
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>字體大小:</label>
        <select
          value={formData.fontSize || '14px'}
          onChange={(e) => onFormChange('fontSize', e.target.value)}
          style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: '4px' }}
        >
          <option value="12px">小 (12px)</option>
          <option value="14px">中 (14px)</option>
          <option value="16px">大 (16px)</option>
          <option value="18px">特大 (18px)</option>
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
          <span style={{ fontWeight: 'bold' }}>必填標示</span>
        </label>
      </div>
    </div>
  );
};

export default LabelEditor; 