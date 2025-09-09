import React, { useState } from 'react';
import { Edge, getBezierPath, EdgeLabelRenderer, BaseEdge } from '@xyflow/react';
import { Button } from 'antd';
import { SwapOutlined } from '@ant-design/icons';

const EdgeWithSwitch = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
  selected,
  ...props
}) => {
  const { onEdgeSwitch } = data || {};
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const [isHovered, setIsHovered] = useState(false);

  const handleSwitch = (e) => {
    e.stopPropagation();
    if (onEdgeSwitch) {
      onEdgeSwitch(id);
    }
  };

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          ...style,
          strokeWidth: selected ? 3 : 2,
          stroke: selected ? '#1890ff' : '#b1b1b7',
        }}
        markerEnd={markerEnd}
      />
      
      {/* 切換按鈕 */}
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
            opacity: selected || isHovered ? 1 : 0,
            transition: 'opacity 0.2s ease',
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <Button
            type="primary"
            shape="circle"
            size="small"
            icon={<SwapOutlined />}
            onClick={handleSwitch}
            style={{
              width: 24,
              height: 24,
              minWidth: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              zIndex: 1000,
            }}
            title="切換連線方向"
          />
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

export default EdgeWithSwitch;
