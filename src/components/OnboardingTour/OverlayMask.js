import React, { useState, useEffect } from 'react';

const OverlayMask = ({ target, show = false, opacity = 0.7 }) => {
  const [targetElement, setTargetElement] = useState(null);
  const [highlightRect, setHighlightRect] = useState(null);

  useEffect(() => {
    if (!target || !show) {
      setTargetElement(null);
      setHighlightRect(null);
      return;
    }

    const element = document.querySelector(target);
    if (!element) return;

    setTargetElement(element);

    const updateHighlight = () => {
      const rect = element.getBoundingClientRect();
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

      setHighlightRect({
        top: rect.top + scrollTop,
        left: rect.left + scrollLeft,
        width: rect.width,
        height: rect.height
      });
    };

    updateHighlight();

    // 監聽滾動和調整大小
    const handleScroll = () => updateHighlight();
    const handleResize = () => updateHighlight();

    window.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [target, show]);

  if (!show || !targetElement || !highlightRect) return null;

  return (
    <div
      className="overlay-mask"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: `rgba(0, 0, 0, ${opacity})`,
        zIndex: 9998,
        pointerEvents: 'none',
        transition: 'opacity 0.3s ease'
      }}
    >
      {/* 高亮區域 */}
      <div
        className="highlight-area"
        style={{
          position: 'absolute',
          top: highlightRect.top,
          left: highlightRect.left,
          width: highlightRect.width,
          height: highlightRect.height,
          borderRadius: 8,
          boxShadow: `
            0 0 0 4px rgba(114, 52, 207, 0.8),
            0 0 0 8px rgba(114, 52, 207, 0.4),
            0 0 20px rgba(114, 52, 207, 0.6)
          `,
          animation: 'highlight-pulse 2s infinite',
          pointerEvents: 'auto',
          cursor: 'pointer'
        }}
        onClick={(e) => {
          e.stopPropagation();
          // 可以添加點擊處理邏輯
        }}
      />
    </div>
  );
};

export default OverlayMask;

