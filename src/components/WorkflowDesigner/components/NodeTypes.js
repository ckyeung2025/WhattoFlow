import React from 'react';
import { Handle, Position } from '@xyflow/react';
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
export const createNodeTypesObj = (onDelete, t, onHandleTypeChange) => {
  return {
    default: ({ id, data, selected }) => (
      <div
        style={getNodeStyle('default', selected)}
        className="custom-node"
      >
        {/* 頂部 handle */}
        <CommonHandle
          type="target"
          position={Position.Top}
          id="top-target"
          style={{ top: -7, left: '50%' }}
          t={t}
          onTypeChange={onHandleTypeChange}
          nodeId={id}
        />
        
        {/* 左側 handle */}
        <CommonHandle
          type="target"
          position={Position.Left}
          id="left-target"
          style={{ left: -7, top: '50%' }}
          t={t}
          onTypeChange={onHandleTypeChange}
          nodeId={id}
        />
        
        {/* 右側 handle */}
        <CommonHandle
          type="source"
          position={Position.Right}
          id="right-source"
          style={{ right: -7, top: '50%' }}
          t={t}
          onTypeChange={onHandleTypeChange}
          nodeId={id}
        />
        
        <NodeContent data={data} />
        
        {/* 底部 handle */}
        <CommonHandle
          type="source"
          position={Position.Bottom}
          id="bottom-source"
          style={{ bottom: -7, left: '50%' }}
          t={t}
          onTypeChange={onHandleTypeChange}
          nodeId={id}
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
        {/* 左側 handle */}
        <CommonHandle
          type="target"
          position={Position.Left}
          id="left-target"
          style={{ left: -7, top: '50%' }}
          t={t}
          onTypeChange={onHandleTypeChange}
          nodeId={id}
        />
        
        <NodeContent data={data} />
        
        {/* 右側 handle */}
        <CommonHandle
          type="source"
          position={Position.Right}
          id="right-source"
          style={{ right: -7, top: '50%' }}
          t={t}
          onTypeChange={onHandleTypeChange}
          nodeId={id}
        />
        
        {/* 底部 handle */}
        <CommonHandle
          type="source"
          position={Position.Bottom}
          id="bottom-source"
          style={{ bottom: -7, left: '50%' }}
          t={t}
          onTypeChange={onHandleTypeChange}
          nodeId={id}
        />
      </div>
    ),
    output: ({ id, data, selected }) => (
      <div
        style={getNodeStyle('output', selected)}
        className="custom-node"
      >
        {/* 頂部 handle */}
        <CommonHandle
          type="target"
          position={Position.Top}
          id="top-target"
          style={{ top: -7, left: '50%' }}
          t={t}
          onTypeChange={onHandleTypeChange}
          nodeId={id}
        />
        
        {/* 左側 handle */}
        <CommonHandle
          type="target"
          position={Position.Left}
          id="left-target"
          style={{ left: -7, top: '50%' }}
          t={t}
          onTypeChange={onHandleTypeChange}
          nodeId={id}
        />
        
        <NodeContent data={data} />
        
        {/* 右側 handle */}
        <CommonHandle
          type="source"
          position={Position.Right}
          id="right-source"
          style={{ right: -7, top: '50%' }}
          t={t}
          onTypeChange={onHandleTypeChange}
          nodeId={id}
        />
        
        {selected && (
          <DeleteButton onClick={() => onDelete(id)} t={t} />
        )}
      </div>
    ),
  };
};
