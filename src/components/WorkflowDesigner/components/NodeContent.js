import React from 'react';

// 節點內容組件
const NodeContent = ({ data }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
    {data.icon && React.createElement(data.icon, { style: { fontSize: '14px', color: '#666' } })}
    <span>{data.taskName || data.label}</span>
  </div>
);

export default NodeContent;
