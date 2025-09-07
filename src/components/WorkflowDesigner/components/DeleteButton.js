import React from 'react';
import { DeleteOutlined } from '@ant-design/icons';
import { DELETE_BUTTON_STYLES } from '../constants';

// 刪除按鈕組件
const DeleteButton = ({ onClick, t }) => (
  <button 
    className="delete-button"
    style={DELETE_BUTTON_STYLES} 
    onClick={onClick}
    title={t('workflowDesigner.delete')}
  >
    <DeleteOutlined style={{ fontSize: '12px' }} />
  </button>
);

export default DeleteButton;
