import React from 'react';
import { Input, Button } from 'antd';

const CheckboxEditor = ({ formData, onFormChange }) => {
  return (
    <div>
      <h3 style={{ margin: '0 0 20px 0', color: '#333' }}>編輯複選框</h3>
      
      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>欄位名稱:</label>
        <Input
          value={formData.name || ''}
          onChange={(e) => onFormChange('name', e.target.value)}
          placeholder="請輸入欄位名稱"
        />
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>選項列表:</label>
        <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #d9d9d9', borderRadius: '4px', padding: '8px' }}>
          {(formData.options || []).map((option, index) => (
            <div key={index} style={{ display: 'flex', marginBottom: '8px', gap: '8px', alignItems: 'center' }}>
              <Input
                placeholder="選項值"
                value={option.value}
                onChange={(e) => {
                  const newOptions = [...(formData.options || [])];
                  newOptions[index] = { ...option, value: e.target.value };
                  onFormChange('options', newOptions);
                }}
                style={{ flex: 1 }}
              />
              <Input
                placeholder="選項文字"
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
                刪除
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
            + 添加選項
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

export default CheckboxEditor; 