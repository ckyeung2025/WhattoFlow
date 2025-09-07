import React from 'react';
import { DeleteOutlined } from '@ant-design/icons';
import { Tooltip } from 'antd';

// 刪除按鈕組件
const DeleteButton = ({ onClick, t }) => (
  <Tooltip title={t('workflowDesigner.delete')} placement="top">
    <button 
      className="delete-button"
      style={{
        position: 'absolute',
        top: -8,
        right: -8,
        background: '#ff4d4f',
        border: 'none',
        borderRadius: '50%',
        width: 24,
        height: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        zIndex: 1000,
        fontSize: '12px',
        color: '#fff',
        fontWeight: 'bold',
        padding: '0',
        minWidth: '24px',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
      }} 
      onClick={onClick}
    >
      <DeleteOutlined style={{ fontSize: '12px' }} />
    </button>
  </Tooltip>
);

export default DeleteButton;
