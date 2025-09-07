import React from 'react';
import { Handle, Position } from 'react-flow-renderer';
import { HANDLE_STYLES } from '../constants';

// 通用連接點組件
const CommonHandle = ({ type, position, id, style, title, t }) => (
  <Handle
    type={type}
    position={position}
    id={id}
    style={{ 
      ...HANDLE_STYLES, 
      ...style,
      ...(type === 'target' ? { background: '#faad14' } : { background: '#52c41a' })
    }}
    title={title || t('workflowDesigner.clickToSelectConnection')}
  />
);

export default CommonHandle;
