import React from 'react';
import { Handle, Position } from 'react-flow-renderer';
import { NODE_STYLES } from '../constants';
import CommonHandle from './CommonHandle';
import DeleteButton from './DeleteButton';
import NodeContent from './NodeContent';

// 創建節點樣式函數
const getNodeStyle = (nodeType, selected) => {
  const baseStyle = { ...NODE_STYLES.default };
  
  switch (nodeType) {
    case 'input':
      return {
        ...baseStyle,
        ...NODE_STYLES.input,
        ...(selected ? NODE_STYLES.inputSelected : {})
      };
    case 'output':
      return {
        ...baseStyle,
        ...NODE_STYLES.output,
        ...(selected ? NODE_STYLES.outputSelected : {})
      };
    default:
      return {
        ...baseStyle,
        ...NODE_STYLES.unselected,
        ...(selected ? NODE_STYLES.selected : {})
      };
  }
};

// 創建節點類型對象
export const createNodeTypesObj = (onDelete, t) => {
  return {
    default: ({ id, data, selected }) => (
      <div
        style={getNodeStyle('default', selected)}
        className="custom-node"
      >
        <CommonHandle
          type="target"
          position={Position.Top}
          id="top-target"
          style={{ top: -7, left: '50%' }}
          t={t}
        />
        
        <NodeContent data={data} />
        
        <CommonHandle
          type="source"
          position={Position.Bottom}
          id="bottom-source"
          style={{ bottom: -7, left: '50%' }}
          t={t}
        />
        
        {selected && data.type !== 'start' && (
          <DeleteButton onClick={() => onDelete(id)} t={t} />
        )}
      </div>
    ),
    input: ({ id, data, selected }) => (
      <div
        style={getNodeStyle('input', selected)}
        className="custom-node"
      >
        <NodeContent data={data} />
        
        <CommonHandle
          type="source"
          position={Position.Bottom}
          id="bottom-source"
          style={{ bottom: -7, left: '50%' }}
          t={t}
        />
      </div>
    ),
    output: ({ id, data, selected }) => (
      <div
        style={getNodeStyle('output', selected)}
        className="custom-node"
      >
        <CommonHandle
          type="target"
          position={Position.Top}
          id="top-target"
          style={{ top: -7, left: '50%' }}
          t={t}
        />
        
        <NodeContent data={data} />
        
        {selected && (
          <DeleteButton onClick={() => onDelete(id)} t={t} />
        )}
      </div>
    ),
  };
};
