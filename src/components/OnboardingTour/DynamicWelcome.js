import React, { useState, useEffect, useRef } from 'react';
import { Button, Space, Typography } from 'antd';
import { PlayCircleOutlined, CloseOutlined } from '@ant-design/icons';
import { useLanguage } from '../../contexts/LanguageContext';
import './DynamicWelcome.css';

const { Title, Text } = Typography;

const DynamicWelcome = ({ onStart, onSkip }) => {
  const { t } = useLanguage();
  const canvasRef = useRef(null);
  const [animationPhase, setAnimationPhase] = useState(0);
  const [particles, setParticles] = useState([]);

  // 動畫階段
  const phases = [
    { name: 'workflow', duration: 3000, color: '#7234CF' }, // AI 流程及表單管理
    { name: 'customer', duration: 3000, color: '#25D366' }, // 客戶服務
    { name: 'order', duration: 3000, color: '#FF6B35' }, // 訂單與交易更新
    { name: 'appointment', duration: 3000, color: '#4CAF50' }, // 預約與提醒管理
    { name: 'promotion', duration: 3000, color: '#E91E63' }, // 廣告與行銷推廣
    { name: 'survey', duration: 3000, color: '#9C27B0' }   // 調查與反饋收集
  ];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    let animationId;
    let phaseTimer;
    let currentPhase = 0;

    const createParticles = (phase) => {
      const newParticles = [];
      const phaseConfig = phases[phase];
      
      for (let i = 0; i < 50; i++) {
        newParticles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 2,
          vy: (Math.random() - 0.5) * 2,
          size: Math.random() * 4 + 2,
          color: phaseConfig.color,
          opacity: Math.random() * 0.8 + 0.2,
          phase: phase
        });
      }
      return newParticles;
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      particles.forEach(particle => {
        // 更新位置
        particle.x += particle.vx;
        particle.y += particle.vy;
        
        // 邊界檢查
        if (particle.x < 0 || particle.x > canvas.width) particle.vx *= -1;
        if (particle.y < 0 || particle.y > canvas.height) particle.vy *= -1;
        
        // 繪製粒子
        ctx.save();
        ctx.globalAlpha = particle.opacity;
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // 繪製連接線
      particles.forEach((particle, i) => {
        particles.slice(i + 1).forEach(otherParticle => {
          const dx = particle.x - otherParticle.x;
          const dy = particle.y - otherParticle.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance < 100) {
            ctx.save();
            ctx.globalAlpha = (100 - distance) / 100 * 0.2;
            ctx.strokeStyle = particle.color;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(particle.x, particle.y);
            ctx.lineTo(otherParticle.x, otherParticle.y);
            ctx.stroke();
            ctx.restore();
          }
        });
      });

      animationId = requestAnimationFrame(animate);
    };

    const startPhase = (phaseIndex) => {
      setAnimationPhase(phaseIndex);
      setParticles(createParticles(phaseIndex));
      
      phaseTimer = setTimeout(() => {
        const nextPhase = (phaseIndex + 1) % phases.length;
        startPhase(nextPhase);
      }, phases[phaseIndex].duration);
    };

    // 開始動畫
    startPhase(0);
    animate();

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
      if (phaseTimer) clearTimeout(phaseTimer);
    };
  }, []);

  const getPhaseContent = () => {
    const phase = phases[animationPhase];
    switch (phase.name) {
      case 'workflow':
        return {
          title: t('onboarding.features.workflow.title'),
          subtitle: t('onboarding.features.workflow.subtitle'),
          icon: '⚡',
          description: t('onboarding.features.workflow.description')
        };
      case 'customer':
        return {
          title: t('onboarding.features.customer.title'),
          subtitle: t('onboarding.features.customer.subtitle'),
          icon: '🤖',
          description: t('onboarding.features.customer.description')
        };
      case 'order':
        return {
          title: t('onboarding.features.order.title'),
          subtitle: t('onboarding.features.order.subtitle'),
          icon: '📦',
          description: t('onboarding.features.order.description')
        };
      case 'appointment':
        return {
          title: t('onboarding.features.appointment.title'),
          subtitle: t('onboarding.features.appointment.subtitle'),
          icon: '📅',
          description: t('onboarding.features.appointment.description')
        };
      case 'promotion':
        return {
          title: t('onboarding.features.promotion.title'),
          subtitle: t('onboarding.features.promotion.subtitle'),
          icon: '📢',
          description: t('onboarding.features.promotion.description')
        };
      case 'survey':
        return {
          title: t('onboarding.features.survey.title'),
          subtitle: t('onboarding.features.survey.subtitle'),
          icon: '📊',
          description: t('onboarding.features.survey.description')
        };
      default:
        return {
          title: t('onboarding.features.default.title'),
          subtitle: t('onboarding.features.default.subtitle'),
          icon: '🚀',
          description: t('onboarding.features.default.description')
        };
    }
  };

  const content = getPhaseContent();

  return (
    <div className="dynamic-welcome">
      <div className="welcome-header">
        <Title level={1} className="welcome-title">
          {t('onboarding.welcome.title')}
        </Title>
        <Text className="welcome-subtitle">
          {t('onboarding.welcome.subtitle')}
        </Text>
      </div>

      <div className="dynamic-content">
        <canvas 
          ref={canvasRef} 
          className="particle-canvas"
        />
        
        <div className="content-overlay">
          <div className="phase-indicator">
            {phases.map((phase, index) => (
              <div 
                key={index}
                className={`phase-dot ${index === animationPhase ? 'active' : ''}`}
                style={{ backgroundColor: phase.color }}
              />
            ))}
          </div>

          <div className="feature-showcase">
            <div className="feature-icon-large">
              {content.icon}
            </div>
            <Title level={2} className="feature-title-large">
              {content.title}
            </Title>
            <Text className="feature-subtitle-large">
              {content.subtitle}
            </Text>
            <Text className="feature-description-large">
              {content.description}
            </Text>
          </div>

          <div className="progress-ring">
            <svg className="progress-svg" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="#f0f0f0"
                strokeWidth="8"
              />
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke={phases[animationPhase].color}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 45}`}
                strokeDashoffset={`${2 * Math.PI * 45 * (1 - (animationPhase + 1) / phases.length)}`}
                className="progress-circle"
              />
            </svg>
            <div className="progress-text">
              {animationPhase + 1}/{phases.length}
            </div>
          </div>
        </div>
      </div>


      <div className="welcome-actions">
        <Space size="large">
          <Button 
            type="primary" 
            size="large"
            icon={<PlayCircleOutlined />}
            onClick={onStart}
            className="start-tour-btn"
          >
            {t('onboarding.welcome.startTour')}
          </Button>
          <Button 
            size="large"
            onClick={onSkip}
            className="skip-tour-btn"
          >
            {t('onboarding.welcome.skipTour')}
          </Button>
        </Space>
      </div>
    </div>
  );
};

export default DynamicWelcome;
