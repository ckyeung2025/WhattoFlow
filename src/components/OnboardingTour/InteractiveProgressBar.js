import React, { useState, useEffect } from 'react';
import { Tooltip } from 'antd';
import { 
  CheckCircleOutlined, 
  PlayCircleOutlined, 
  ClockCircleOutlined
} from '@ant-design/icons';
import './InteractiveProgressBar.css';

const InteractiveProgressBar = ({ 
  currentStep, 
  totalSteps, 
  onStepClick
}) => {
  const [animatedProgress, setAnimatedProgress] = useState(0);

  const progressPercentage = (currentStep / (totalSteps - 1)) * 100;

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedProgress(progressPercentage);
    }, 300);
    return () => clearTimeout(timer);
  }, [progressPercentage]);

  const steps = Array.from({ length: totalSteps }, (_, index) => ({
    id: index,
    number: index + 1,
    isCompleted: index < currentStep,
    isCurrent: index === currentStep,
    isUpcoming: index > currentStep,
    position: (index / (totalSteps - 1)) * 100
  }));

  return (
    <div className="interactive-progress-container">
      <div className="progress-track">
        <div className="track-background"></div>
        <div 
          className="track-fill" 
          style={{ width: `${animatedProgress}%` }}
        ></div>

        {steps.map((step) => (
          <Tooltip 
            key={step.id}
            title={`點擊跳轉到步驟 ${step.number}`}
            placement="top"
          >
            <div 
              className={`step-marker ${
                step.isCompleted ? 'completed' : 
                step.isCurrent ? 'current' : 
                'upcoming'
              }`}
              style={{ left: `${step.position}%` }}
              onClick={() => onStepClick(step.id)}
            >
              {step.isCompleted ? (
                <CheckCircleOutlined className="step-icon" />
              ) : step.isCurrent ? (
                <PlayCircleOutlined className="step-icon" />
              ) : (
                <ClockCircleOutlined className="step-icon" />
              )}
            </div>
          </Tooltip>
        ))}
      </div>
    </div>
  );
};

export default InteractiveProgressBar;
