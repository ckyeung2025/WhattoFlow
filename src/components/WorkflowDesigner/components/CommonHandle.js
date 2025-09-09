import React, { useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { HANDLE_STYLES } from '../constants';

// 簡化的連接點組件
const CommonHandle = ({ 
  type, 
  position, 
  id, 
  style, 
  title, 
  t, 
  nodeId,
  nodeData,
  isEditable = true,
  zIndex = 1000
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseEnter = () => {
    if (isEditable) {
      setIsHovered(true);
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  const getHandleStyle = () => {
    const baseStyle = { 
      ...HANDLE_STYLES.default,
      ...style,
      width: 8,
      height: 8,
      cursor: isEditable ? 'crosshair' : 'default',
      transform: isHovered && isEditable ? 'scale(1.3)' : 'scale(1)',
      transition: 'all 0.2s ease',
      pointerEvents: 'auto',
      zIndex: zIndex,
      ...(type === 'target' ? { 
        background: '#faad14',
        borderColor: '#d48806'
      } : { 
        background: '#52c41a',
        borderColor: '#389e0d'
      })
    };
    return baseStyle;
  };

  const getTooltipText = () => {
    if (!isEditable) {
      return title || '點擊選擇連接';
    }
    return type === 'source' 
      ? '拖拽創建連線'
      : '拖拽創建連線';
  };

  // 直接使用原始 ID，不進行轉換
  const handleId = id;

  // 調試日誌 - 已移除以避免控制台噪音

  return (
    <Handle
      type={type}
      position={position}
      id={handleId}
      style={getHandleStyle()}
      title={getTooltipText()}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      isConnectable={true}
    />
  );
};

export default CommonHandle;
