import React from 'react';
import { Input, Select, Space } from 'antd';

const TextInputEditor = ({ formData, onFormChange }) => {
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
          placeholder={isDateType ? "請輸入預設日期" : "請輸入預設值"}
        />
        {isDateType && formData.dateFormat && (
          <div style={{ 
            marginTop: '5px', 
            fontSize: '12px', 
            color: '#666',
            fontStyle: 'italic'
          }}>
            格式預覽: {getDatePreview(formData.dateFormat)}
          </div>
        )}
        {isDateType && (
          <div style={{ 
            marginTop: '5px', 
            fontSize: '11px', 
            color: '#999'
          }}>
            請根據選擇的日期格式輸入預設值，例如: {formData.dateFormat === 'YYYY-MM-DD' ? '2025-12-01' : 
              formData.dateFormat === 'MM/DD/YYYY' ? '12/01/2025' :
              formData.dateFormat === 'DD/MM/YYYY' ? '01/12/2025' :
              formData.dateFormat === 'YYYY/MM/DD' ? '2025/12/01' :
              formData.dateFormat === 'MM-DD-YYYY' ? '12-01-2025' :
              formData.dateFormat === 'DD-MM-YYYY' ? '01-12-2025' : '2025-12-01'}
          </div>
        )}
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>輸入類型:</label>
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
            { value: 'text', label: '文字' },
            { value: 'email', label: '電子郵件' },
            { value: 'password', label: '密碼' },
            { value: 'number', label: '數字' },
            { value: 'tel', label: '電話' },
            { value: 'url', label: '網址' },
            { value: 'date', label: '日期' },
            { value: 'time', label: '時間' },
            { value: 'file', label: '檔案' }
          ]}
        />
      </div>

      {/* 日期格式設置 - 僅在日期類型時顯示 */}
      {isDateType && (
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>日期格式:</label>
          <div style={{ 
            marginBottom: '8px', 
            fontSize: '12px', 
            color: '#666',
            fontStyle: 'italic'
          }}>
            選擇日期在表單中顯示的格式，這將影響用戶看到的日期樣式
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
            選擇的格式: {formData.dateFormat || 'YYYY-MM-DD'}
          </div>
          <div style={{ 
            marginTop: '5px', 
            fontSize: '11px', 
            color: '#999'
          }}>
            提示: 格式設置會影響 WYSIWYG 編輯器中的顯示效果
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