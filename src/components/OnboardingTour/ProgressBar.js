import React, { useState, useEffect } from 'react';
import { 
  Progress, 
  Typography, 
  Space, 
  Tooltip 
} from 'antd';
import { 
  CheckCircleOutlined, 
  PlayCircleOutlined,
  ClockCircleOutlined 
} from '@ant-design/icons';

const { Text } = Typography;

const ProgressBar = ({ current, total, progress }) => {
  const [animatedProgress, setAnimatedProgress] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedProgress(progress);
    }, 300);
    return () => clearTimeout(timer);
  }, [progress]);

  const steps = Array.from({ length: total }, (_, index) => ({
    number: index + 1,
    completed: index < current,
    current: index === current,
    upcoming: index > current
  }));

  return (
    <div className="progress-bar-container">
      <div className="progress-header">
        <Space>
          <Text strong className="progress-text">
            步驟 {current + 1} / {total}
          </Text>
          <Text className="progress-percentage">
            {Math.round(progress)}%
          </Text>
        </Space>
      </div>
      
      <div className="progress-bar-wrapper">
        <Progress
          percent={animatedProgress}
          showInfo={false}
          strokeColor={{
            '0%': '#52c41a',
            '50%': '#faad14',
            '100%': '#7234CF'
          }}
          trailColor="rgba(255, 255, 255, 0.2)"
          strokeWidth={8}
          className="main-progress"
        />
      </div>

      <div className="step-indicators">
        {steps.map((step, index) => (
          <Tooltip 
            key={index}
            title={`步驟 ${step.number}`}
            placement="top"
          >
            <div 
              className={`step-indicator ${
                step.completed ? 'completed' : 
                step.current ? 'current' : 
                'upcoming'
              }`}
            >
              {step.completed ? (
                <CheckCircleOutlined className="step-icon" />
              ) : step.current ? (
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

export default ProgressBar;

