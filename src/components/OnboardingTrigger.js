import React, { useState, useEffect } from 'react';
import { Button, Badge, Tooltip, Modal } from 'antd';
import { 
  QuestionCircleOutlined, 
  TrophyOutlined,
  PlayCircleOutlined,
  CloseOutlined
} from '@ant-design/icons';
import { useLanguage } from '../contexts/LanguageContext';
import { useOnboardingTour } from '../hooks/useOnboardingTour';
import OnboardingTour from './OnboardingTour/OnboardingTour';

const OnboardingTrigger = () => {
  const { t } = useLanguage();
  const [showTour, setShowTour] = useState(false);
  const [showTrigger, setShowTrigger] = useState(true); // 默認顯示觸發器
  
  const {
    isCompleted,
    isTourActive,
    getUserStats,
    startTour
  } = useOnboardingTour();

  const userStats = getUserStats();

  useEffect(() => {
    // 檢查是否應該顯示導覽觸發器
    const shouldShowTrigger = !isCompleted;
    console.log('OnboardingTrigger - 狀態檢查:', {
      isCompleted,
      isTourActive,
      shouldShowTrigger,
      userStats
    });
    setShowTrigger(shouldShowTrigger);
  }, [isCompleted, isTourActive]);

  const handleStartTour = () => {
    console.log('OnboardingTrigger - 開始導覽');
    startTour();
    setShowTour(true);
  };

  const handleTourComplete = () => {
    setShowTour(false);
    setShowTrigger(false);
  };

  const handleTourSkip = () => {
    setShowTour(false);
    setShowTrigger(false);
  };


  // 如果導覽已完成且沒有進行中，不顯示觸發器
  if (!showTrigger) {
    console.log('OnboardingTrigger - 不顯示觸發器，原因:', { isCompleted, isTourActive });
    return null;
  }

  console.log('OnboardingTrigger - 渲染觸發器', { showTrigger, showTour });

  return (
    <>
      {/* 浮動導覽按鈕 */}
      <div 
        className="onboarding-trigger"
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 1000
        }}
      >
        <Tooltip title={t('onboarding.welcome.title')} placement="left">
          <Badge 
            count={userStats.totalAchievements} 
            size="small"
            style={{ 
              backgroundColor: '#faad14',
              color: '#fff'
            }}
          >
            <Button
              type="primary"
              shape="circle"
              size="large"
              icon={<QuestionCircleOutlined />}
              onClick={handleStartTour}
              className="onboarding-trigger-btn"
              style={{
                background: 'linear-gradient(135deg, #FD26BD 0%, #FF6FD9 100%)',
                border: 'none',
                boxShadow: '0 4px 12px rgba(253, 38, 189, 0.3)',
                animation: 'questionBounce 2s infinite'
              }}
            />
          </Badge>
        </Tooltip>
      </div>

      {/* 導覽模態框 */}
      <OnboardingTour
        visible={showTour}
        onComplete={handleTourComplete}
        onSkip={handleTourSkip}
      />
    </>
  );
};

export default OnboardingTrigger;
