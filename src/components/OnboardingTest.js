import React, { useState } from 'react';
import { Button, Card, Typography, Space } from 'antd';
import { RocketOutlined } from '@ant-design/icons';
import OnboardingTour from './OnboardingTour/OnboardingTour';

const { Title, Text } = Typography;

const OnboardingTest = () => {
  const [showTour, setShowTour] = useState(false);

  const handleStartTour = () => {
    console.log('測試 - 開始導覽');
    setShowTour(true);
  };

  const handleTourComplete = () => {
    console.log('測試 - 導覽完成');
    setShowTour(false);
  };

  const handleTourSkip = () => {
    console.log('測試 - 跳過導覽');
    setShowTour(false);
  };

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <Title level={3}>
          <RocketOutlined style={{ marginRight: 8, color: '#7234CF' }} />
          小精靈導覽測試
        </Title>
        
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Text>
            點擊下面的按鈕測試小精靈導覽功能：
          </Text>
          
          <Button
            type="primary"
            size="large"
            icon={<RocketOutlined />}
            onClick={handleStartTour}
            style={{
              background: 'linear-gradient(135deg, #7234CF 0%, #8c4dd4 100%)',
              border: 'none',
              height: 48,
              fontSize: 16
            }}
          >
            開始導覽測試
          </Button>
          
          <Text type="secondary">
            如果導覽正常顯示，說明功能正常。如果沒有反應，請檢查控制台日誌。
          </Text>
        </Space>
      </Card>

      <OnboardingTour
        visible={showTour}
        onComplete={handleTourComplete}
        onSkip={handleTourSkip}
      />
    </div>
  );
};

export default OnboardingTest;


