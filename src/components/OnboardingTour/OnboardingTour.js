import React, { useState, useEffect } from 'react';
import { Modal, Button, Space, Typography, Card, Row, Col } from 'antd';
import { 
  PlayCircleOutlined, 
  CheckCircleOutlined, 
  TrophyOutlined,
  RocketOutlined,
  BranchesOutlined,
  FileTextOutlined,
  DatabaseOutlined,
  MessageOutlined,
  CloseOutlined,
  LeftOutlined,
  RightOutlined
} from '@ant-design/icons';
import { useLanguage } from '../../contexts/LanguageContext';
import { useOnboardingTour } from '../../hooks/useOnboardingTour';
import TourStep from './TourStep';
import InteractiveProgressBar from './InteractiveProgressBar';
import AchievementBadge from './AchievementBadge';
import DynamicWelcome from './DynamicWelcome';
import ParticleEffect from '../OnboardingAnimations/ParticleEffect';
import './OnboardingTour.css';

const { Title, Text } = Typography;

const OnboardingTour = ({ visible, onComplete, onSkip }) => {
  const { t } = useLanguage();
  const onboardingTour = useOnboardingTour();
  const {
    currentStep,
    totalSteps,
    progress,
    achievements,
    nextStep,
    prevStep,
    completeTour,
    skipTour,
    isCompleted,
    setCurrentStep
  } = onboardingTour;

  const [showWelcome, setShowWelcome] = useState(true);
  const [animationKey, setAnimationKey] = useState(0);
  const [showParticles, setShowParticles] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    console.log('OnboardingTour - visible 狀態變更:', visible);
    if (visible) {
      setShowWelcome(true);
      setAnimationKey(prev => prev + 1);
      setShowParticles(true);
      
      // 延遲 2 秒後再顯示 Modal，讓用戶先看到粒子效果
      setTimeout(() => {
        setShowModal(true);
      }, 2000);
    } else {
      setShowModal(false);
      // 當 Modal 關閉時，延遲隱藏粒子效果
      setTimeout(() => {
        setShowParticles(false);
      }, 5000); // 5秒後隱藏粒子
    }
  }, [visible]);

  const handleStartTour = () => {
    setShowWelcome(false);
  };

  const handleComplete = () => {
    completeTour();
    onComplete?.();
  };

  const handleSkip = () => {
    skipTour();
    onSkip?.();
  };

  const handleStepClick = (stepIndex) => {
    setCurrentStep(stepIndex);
  };

  return (
    <>
      {/* 粒子效果背景 - 獨立於 Modal 狀態 */}
      {showParticles && (
        <ParticleEffect 
          key={animationKey}
          type="sparkles" 
          intensity={1.2} 
        />
      )}
      
      {/* Modal 只在 showModal 為 true 時顯示 */}
      {showModal && (
        <Modal
        open={showModal}
        width="100vw"
        style={{ 
          top: 0,
          paddingBottom: 0,
          maxWidth: '100vw'
        }}
        centered={false}
        footer={null}
        closable={false}
        className="onboarding-tour-modal fullscreen-modal"
        styles={{
          body: { 
            padding: 0,
            height: '100vh',
            overflow: 'hidden'
          },
          mask: { backgroundColor: 'rgba(0, 0, 0, 0.8)' }
        }}
      >
        <div className="onboarding-container fullscreen-container">
          {showWelcome ? (
            <DynamicWelcome onStart={handleStartTour} onSkip={handleSkip} />
          ) : (
            <TourContent 
              currentStep={currentStep}
              totalSteps={totalSteps}
              progress={progress}
              achievements={achievements}
              onNext={nextStep}
              onPrev={prevStep}
              onComplete={handleComplete}
              onSkip={handleSkip}
              onStepClick={handleStepClick}
            />
          )}
        </div>
        </Modal>
      )}
    </>
  );
};

// 歡迎畫面組件
// 導覽內容組件
const TourContent = ({ 
  currentStep, 
  totalSteps, 
  progress, 
  achievements, 
  onNext, 
  onPrev, 
  onComplete, 
  onSkip,
  onStepClick
}) => {
  const { t } = useLanguage();

  return (
    <div className="tour-content">
      {/* 頂部控制欄 */}
      <div className="tour-header">
        <div className="tour-progress">
          <InteractiveProgressBar 
            currentStep={currentStep} 
            totalSteps={totalSteps} 
            onStepClick={onStepClick}
          />
        </div>
        <div className="tour-controls">
          <AchievementBadge achievements={achievements} />
          <Button 
            type="text" 
            icon={<CloseOutlined />}
            onClick={onSkip}
            className="close-tour-btn"
          />
        </div>
      </div>

      {/* 導覽步驟內容 */}
      <div className="tour-step-container">
        {/* 左側導航按鈕 */}
        {currentStep > 0 && (
          <div className="nav-button nav-button-left">
            <Button 
              type="primary"
              shape="circle"
              icon={<LeftOutlined />}
              onClick={onPrev}
              size="large"
            />
          </div>
        )}
        
        {/* 右側導航按鈕 */}
        {currentStep < totalSteps - 1 && (
          <div className="nav-button nav-button-right">
            <Button 
              type="primary"
              shape="circle"
              icon={<RightOutlined />}
              onClick={onNext}
              size="large"
            />
          </div>
        )}
        
        <TourStep 
          step={currentStep}
          onNext={onNext}
          onPrev={onPrev}
          onComplete={onComplete}
        />
      </div>

    </div>
  );
};

export default OnboardingTour;
