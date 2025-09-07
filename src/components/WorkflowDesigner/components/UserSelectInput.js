import React from 'react';
import { Input, Button, Space } from 'antd';

// 用戶選擇輸入組件
const UserSelectInput = ({ value, onChange, onClear, t, isSpecified = false, onOpenModal }) => (
  <Input 
    value={value || ''}
    placeholder={t('workflowDesigner.phoneNumberPlaceholder')}
    readOnly
    onClick={onOpenModal}
    suffix={
      <Space>
        {value && (
          <Button 
            type="text" 
            size="small" 
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
            }}
          >
            {t('workflowDesigner.clear')}
          </Button>
        )}
        <Button 
          type="text" 
          size="small" 
          onClick={onOpenModal}
        >
          {isSpecified ? t('workflowDesigner.selectPerson') : t('workflowDesigner.selectUser')}
        </Button>
      </Space>
    }
    style={{
      color: value ? '#000' : '#999',
      backgroundColor: value ? '#fff' : '#f5f5f5',
      width: '100%',
      minWidth: '300px'
    }}
  />
);

export default UserSelectInput;
