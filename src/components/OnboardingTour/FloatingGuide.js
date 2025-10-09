import React, { useState, useEffect } from 'react';
import { Card, Typography, Space } from 'antd';
import { ArrowRightOutlined, InfoCircleOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const FloatingGuide = ({ target, title, description, position = 'bottom' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [targetElement, setTargetElement] = useState(null);
  const [guidePosition, setGuidePosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!target) return;

    const element = document.querySelector(target);
    if (!element) return;

    setTargetElement(element);
    
    // 計算位置
    const updatePosition = () => {
      const rect = element.getBoundingClientRect();
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
      
      let top, left;
      
      switch (position) {
        case 'top':
          top = rect.top + scrollTop - 120;
          left = rect.left + scrollLeft + rect.width / 2;
          break;
        case 'bottom':
          top = rect.bottom + scrollTop + 20;
          left = rect.left + scrollLeft + rect.width / 2;
          break;
        case 'left':
          top = rect.top + scrollTop + rect.height / 2;
          left = rect.left + scrollLeft - 300;
          break;
        case 'right':
          top = rect.top + scrollTop + rect.height / 2;
          left = rect.right + scrollLeft + 20;
          break;
        default:
          top = rect.bottom + scrollTop + 20;
          left = rect.left + scrollLeft + rect.width / 2;
      }
      
      setGuidePosition({ top, left });
    };

    updatePosition();
    
    // 監聽滾動和調整大小
    const handleScroll = () => updatePosition();
    const handleResize = () => updatePosition();
    
    window.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', handleResize);
    
    // 延遲顯示，讓動畫更流暢
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 300);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [target, position]);

  if (!targetElement || !isVisible) return null;

  return (
    <div
      className={`floating-guide ${position}`}
      style={{
        position: 'absolute',
        top: guidePosition.top,
        left: guidePosition.left,
        transform: 'translateX(-50%)',
        zIndex: 10001,
        animation: 'slideInUp 0.5s ease-out'
      }}
    >
      <Card 
        className="guide-card"
        size="small"
        style={{
          minWidth: 280,
          maxWidth: 320,
          background: 'linear-gradient(135deg, #7234CF 0%, #8c4dd4 100%)',
          border: 'none',
          borderRadius: 12,
          boxShadow: '0 8px 24px rgba(114, 52, 207, 0.3)'
        }}
      >
        <div className="guide-content">
          <Space direction="vertical" size="small" style={{ width: '100%' }}>
            <div className="guide-header">
              <Space>
                <InfoCircleOutlined style={{ color: '#fff' }} />
                <Title level={5} style={{ color: '#fff', margin: 0 }}>
                  {title}
                </Title>
              </Space>
            </div>
            
            <Text style={{ color: '#fff', fontSize: '14px' }}>
              {description}
            </Text>
            
            <div className="guide-arrow">
              <ArrowRightOutlined style={{ color: '#fff' }} />
            </div>
          </Space>
        </div>
      </Card>
      
      {/* 指向箭頭 */}
      <div 
        className={`guide-pointer ${position}`}
        style={{
          position: 'absolute',
          width: 0,
          height: 0,
          ...(position === 'top' && {
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            borderLeft: '8px solid transparent',
            borderRight: '8px solid transparent',
            borderTop: '8px solid #7234CF'
          }),
          ...(position === 'bottom' && {
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            borderLeft: '8px solid transparent',
            borderRight: '8px solid transparent',
            borderBottom: '8px solid #7234CF'
          }),
          ...(position === 'left' && {
            left: '100%',
            top: '50%',
            transform: 'translateY(-50%)',
            borderTop: '8px solid transparent',
            borderBottom: '8px solid transparent',
            borderLeft: '8px solid #7234CF'
          }),
          ...(position === 'right' && {
            right: '100%',
            top: '50%',
            transform: 'translateY(-50%)',
            borderTop: '8px solid transparent',
            borderBottom: '8px solid transparent',
            borderRight: '8px solid #7234CF'
          })
        }}
      />
    </div>
  );
};

export default FloatingGuide;

